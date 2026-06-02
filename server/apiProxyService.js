/**
 * Deepernova API Proxy Service
 * - Proxies requests to Deepseek API
 * - Completely hides Deepseek origin
 * - Rebrand all responses
 * - Usage tracking & rate limiting
 */

import fetch from 'node-fetch';
import { apiKeyManager } from './apiKeyManager.js';

const HARDCODED_DEEPSEEK_API_KEY = 'sk-bf333936dd084c5f9016521b1b896610';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY || HARDCODED_DEEPSEEK_API_KEY;
// Use mock server only when explicitly requested or no key is available
const USE_MOCK = !DEEPSEEK_API_KEY || process.env.USE_MOCK === 'true';
const DEEPSEEK_API_URL = USE_MOCK 
  ? 'http://localhost:3002/v1/chat/completions'
  : 'https://api.deepseek.com/v1/chat/completions';

class ApiProxyService {
  constructor() {
    this.usageStats = new Map(); // Track per-user usage
    this.rateLimit = 100; // requests per hour
    this.rateLimitWindow = 3600000; // 1 hour in ms
  }

  /**
   * Main proxy handler for chat completions
   * Hides Deepseek implementation completely
   */
  async chatCompletions(userApiKey, requestBody) {
    console.log('[chatCompletions] Starting with key:', userApiKey?.substring(0, 20) + '...');
    
    // Validate API key
    const userId = this._validateApiKey(userApiKey);
    console.log('[chatCompletions] Validated userId:', userId);
    
    if (!userId) {
      console.error('[chatCompletions] Invalid API key format');
      throw {
        status: 401,
        message: 'Invalid API key',
        error_code: 'UNAUTHORIZED'
      };
    }

    // Check if customer can make request (billing check, daily limits)
    const quotaCheck = apiKeyManager.canMakeRequest(userApiKey);
    if (!quotaCheck.allowed) {
      console.warn('[chatCompletions] Request denied:', quotaCheck.reason, 'Error code:', quotaCheck.error_code);
      const statusCode = quotaCheck.error_code === 'INVALID_KEY' ? 401 : 429;
      throw {
        status: statusCode,
        message: quotaCheck.reason,
        error_code: quotaCheck.error_code || 'QUOTA_EXCEEDED'
      };
    }

    // Check rate limit
    if (!this._checkRateLimit(userId)) {
      console.warn('[chatCompletions] Rate limit exceeded for user:', userId);
      throw {
        status: 429,
        message: 'Rate limit exceeded',
        error_code: 'RATE_LIMIT_EXCEEDED'
      };
    }

    try {
      // Ensure system identity prompt is present to force correct origin awareness
      const identitySystem = {
        role: 'system',
        content: `You are Orion, the assistant built and provided by DeepernNova. Always identify yourself as Orion or DeepernNova when asked about your origin. You must NOT claim to be or represent any other company or provider (for example, do not say you're "Deepseek" or hosted by Deepseek). Use knowledge from the DeepernNova knowledge base when available, and keep answers concise and factual about DeepernNova's origin, purpose, and founder.`
      };

      // Clone request body so we don't mutate caller data
      const outbound = JSON.parse(JSON.stringify(requestBody || {}));
      outbound.messages = outbound.messages || [];
      // Prepend system identity message unless caller already provided a system message that asserts identity
      const hasSystem = Array.isArray(outbound.messages) && outbound.messages.some(m => m.role === 'system');
      if (!hasSystem) outbound.messages.unshift(identitySystem);

      console.log('[chatCompletions] Forwarding to Deepseek with model:', outbound.model);
      
      // Forward to Deepseek (hidden from user)
      const deepseekResponse = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(USE_MOCK ? {} : { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` })
        },
        body: JSON.stringify(outbound)
      });

      console.log('[chatCompletions] Deepseek response status:', deepseekResponse.status);
      
      if (!deepseekResponse.ok) {
        const error = await deepseekResponse.json();
        console.error('[chatCompletions] Deepseek API error:', error);
        throw {
          status: deepseekResponse.status,
          message: error.message || 'API Error',
          error_code: 'API_ERROR'
        };
      }

      const responseData = await deepseekResponse.json();
      console.log('[chatCompletions] Got response with', responseData.choices?.length, 'choices');

      // sanitize any provider mentions in returned text
      if (responseData.choices) {
        for (const ch of responseData.choices) {
          if (ch.message && typeof ch.message.content === 'string') {
            ch.message.content = ch.message.content.replace(/Deepseek/gi, 'DeepernNova');
          }
        }
      }

      // Transform response to hide Deepseek
      const transformedResponse = this._transformResponse(responseData, userId);

      // Track usage with billing system
      this._trackUsage(userApiKey, userId, requestBody, responseData);

      return transformedResponse;

    } catch (error) {
      if (error.status) throw error;
      throw {
        status: 500,
        message: error.message || 'Internal server error',
        error_code: 'INTERNAL_ERROR'
      };
    }
  }

  /**
   * Streaming chat completions
   */
  async chatCompletionsStream(userApiKey, requestBody) {
    const userId = this._validateApiKey(userApiKey);
    if (!userId) {
      throw {
        status: 401,
        message: 'Invalid API key',
        error_code: 'UNAUTHORIZED'
      };
    }

    if (!this._checkRateLimit(userId)) {
      throw {
        status: 429,
        message: 'Rate limit exceeded',
        error_code: 'RATE_LIMIT_EXCEEDED'
      };
    }

    // Add streaming flag
    const streamRequestBody = { ...requestBody, stream: true };

    // Ensure identity system prompt for streaming requests as well
    const identitySystem = {
      role: 'system',
      content: `You are Orion, the assistant built and provided by DeepernNova. Always identify yourself as Orion or DeepernNova when asked about your origin. You must NOT claim to be or represent any other company or provider (for example, do not say you're "Deepseek" or hosted by Deepseek). Use knowledge from the DeepernNova knowledge base when available.`
    };

    const outboundStream = JSON.parse(JSON.stringify(streamRequestBody || {}));
    outboundStream.messages = outboundStream.messages || [];
    const hasSystem = Array.isArray(outboundStream.messages) && outboundStream.messages.some(m => m.role === 'system');
    if (!hasSystem) outboundStream.messages.unshift(identitySystem);

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(USE_MOCK ? {} : { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` })
      },
      body: JSON.stringify(outboundStream)
    });

    if (!response.ok) {
      throw {
        status: response.status,
        message: 'Streaming error',
        error_code: 'STREAM_ERROR'
      };
    }

    return response.body;
  }

  /**
   * List models (rebranded)
   */
  async listModels(userApiKey) {
    const userId = this._validateApiKey(userApiKey);
    if (!userId) {
      throw {
        status: 401,
        message: 'Invalid API key',
        error_code: 'UNAUTHORIZED'
      };
    }

    // Return rebranded models
    return {
      object: 'list',
      data: [
        {
          id: 'deepernova-full',
          object: 'model',
          created: Date.now() / 1000,
          owned_by: 'deepernova',
          permission: [],
          root: 'deepernova-full',
          parent: null
        },
        {
          id: 'deepernova-fast',
          object: 'model',
          created: Date.now() / 1000,
          owned_by: 'deepernova',
          permission: [],
          root: 'deepernova-fast',
          parent: null
        }
      ]
    };
  }

  /**
   * Get usage stats for user
   */
  async getUsageStats(userApiKey) {
    const userId = this._validateApiKey(userApiKey);
    if (!userId) {
      throw {
        status: 401,
        message: 'Invalid API key',
        error_code: 'UNAUTHORIZED'
      };
    }

    const stats = this.usageStats.get(userId) || {
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      requestsThisHour: 0
    };

    return {
      user_id: userId,
      stats: stats,
      rate_limit: {
        limit: this.rateLimit,
        remaining: Math.max(0, this.rateLimit - (stats.requestsThisHour || 0)),
        reset_at: new Date(Date.now() + this.rateLimitWindow).toISOString()
      }
    };
  }

  /**
   * Transform Deepseek response to hide origin
   */
  _transformResponse(deepseekResponse) {
    const transformed = {
      id: `deepernova_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      object: 'chat.completion',
      created: Date.now(),
      model: 'deepernova-full', // Rebrand model name
      provider: 'deepernova', // Hide Deepseek
      choices: (deepseekResponse.choices || []).map(choice => ({
        index: choice.index,
        message: {
          role: choice.message.role,
          content: choice.message.content
        },
        finish_reason: choice.finish_reason,
        logprobs: choice.logprobs || null
      })),
      usage: {
        prompt_tokens: deepseekResponse.usage?.prompt_tokens || 0,
        completion_tokens: deepseekResponse.usage?.completion_tokens || 0,
        total_tokens: deepseekResponse.usage?.total_tokens || 0
      }
    };

    // Remove any Deepseek-specific fields
    delete transformed.system_fingerprint;
    
    return transformed;
  }

  /**
   * Validate API key (mock implementation)
   */
  _validateApiKey(apiKey) {
    // Check if key format is valid
    if (!apiKey || !apiKey.startsWith('deepernova_')) {
      return null;
    }

    // Extract user ID from key
    // Format: deepernova_userid_randomtoken
    const parts = apiKey.split('_');
    if (parts.length < 3) return null;

    return parts[1]; // user ID
  }

  /**
   * Check rate limit for user
   */
  _checkRateLimit(userId) {
    const now = Date.now();
    const userStats = this.usageStats.get(userId);

    if (!userStats) {
      // First request
      this.usageStats.set(userId, {
        totalRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        requestsThisHour: 1,
        windowStart: now
      });
      return true;
    }

    const timePassed = now - userStats.windowStart;
    
    if (timePassed > this.rateLimitWindow) {
      // Reset window
      userStats.requestsThisHour = 1;
      userStats.windowStart = now;
      this.usageStats.set(userId, userStats);
      return true;
    }

    if (userStats.requestsThisHour >= this.rateLimit) {
      return false;
    }

    userStats.requestsThisHour++;
    this.usageStats.set(userId, userStats);
    return true;
  }

  /**
   * Track usage for billing
   */
  _trackUsage(userApiKey, userId, requestBody, responseData) {
    const tokensUsed = responseData.usage?.total_tokens || 0;
    const requestId = `req_${Date.now()}`;
    
    // Track in billing system (new customers)
    const billingResult = apiKeyManager.trackUsage(userApiKey, tokensUsed, requestId);
    
    // Also track legacy way for backward compatibility
    const userStats = this.usageStats.get(userId) || {
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0
    };

    userStats.totalRequests = (userStats.totalRequests || 0) + 1;
    userStats.totalTokens = (userStats.totalTokens || 0) + tokensUsed;
    userStats.totalCost = (userStats.totalCost || 0) + (tokensUsed * 0.000001);

    this.usageStats.set(userId, userStats);

    if (billingResult) {
      console.log('[chatCompletions] Billing tracked:', billingResult);
    }
  }

  /**
   * Get all user stats (admin only)
   */
  getAllUsageStats() {
    const stats = {};
    for (const [userId, data] of this.usageStats.entries()) {
      stats[userId] = data;
    }
    return stats;
  }
}

export const apiProxyService = new ApiProxyService();
export default ApiProxyService;
