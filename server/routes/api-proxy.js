/**
 * Deepernova API Routes
 * Proxy endpoints that hide Deepseek backend
 */

import express from 'express';
import { apiProxyService } from '../apiProxyService.js';
import { apiKeyManager } from '../apiKeyManager.js';

const router = express.Router();

/**
 * Handle CORS preflight requests
 */
router.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Key');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

/**
 * Middleware: Extract and validate API key from headers
 */
const apiKeyMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const xApiKey = req.headers['x-api-key'];
  
  console.log('[api-proxy] Incoming request:', {
    method: req.method,
    path: req.path,
    hasAuth: !!authHeader,
    hasXApiKey: !!xApiKey,
    allHeaders: Object.keys(req.headers)
  });
  
  // Accept Bearer token, or fallback to x-api-key header or api_key in body
  if (authHeader && authHeader.startsWith('Bearer ')) {
    req.apiKey = authHeader.substring(7);
    console.log('[api-proxy] Using Bearer token');
  } else if (xApiKey) {
    req.apiKey = xApiKey;
    console.log('[api-proxy] Using x-api-key header');
  } else if (req.body && req.body.api_key) {
    req.apiKey = req.body.api_key;
    console.log('[api-proxy] Using api_key from body');
  } else {
    // Debug log to help with missing header issues
    console.error('[api-proxy] Missing Authorization header. Received headers:', Object.keys(req.headers));
    return res.status(401).json({
      error: 'Missing or invalid authorization header',
      error_code: 'UNAUTHORIZED'
    });
  }
  next();
};

/**
 * POST /api/v1/chat/completions
 * Main chat completion endpoint (rebranded)
 */
router.post('/chat/completions', apiKeyMiddleware, async (req, res) => {
  try {
    const { stream } = req.body;

    if (stream) {
      // Streaming response
      try {
        const responseStream = await apiProxyService.chatCompletionsStream(
          req.apiKey,
          req.body
        );

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Transform stream data
        responseStream.on('data', (chunk) => {
          const text = chunk.toString('utf8');
          const lines = text.split('\n').filter(l => l.trim());
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.substring(6);
              if (data === '[DONE]') {
                res.write('data: [DONE]\n\n');
              } else {
                try {
                  const parsed = JSON.parse(data);
                  // Rebrand the response
                  parsed.model = 'deepernova-full';
                  parsed.provider = 'deepernova';
                  res.write(`data: ${JSON.stringify(parsed)}\n\n`);
                } catch {
                  // Invalid JSON, skip
                }
              }
            }
          }
        });

        responseStream.on('end', () => {
          res.end();
        });

        responseStream.on('error', (error) => {
          res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
          res.end();
        });
      } catch (error) {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      }
    } else {
      // Non-streaming response
      const result = await apiProxyService.chatCompletions(req.apiKey, req.body);
      res.json(result);
    }
  } catch (error) {
    const statusCode = error.status || 500;
    res.status(statusCode).json({
      error: error.message,
      error_code: error.error_code || 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/v1/models
 * List available models (rebranded)
 */
router.get('/models', apiKeyMiddleware, async (req, res) => {
  try {
    const models = await apiProxyService.listModels(req.apiKey);
    res.json(models);
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message,
      error_code: error.error_code || 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/v1/usage
 * Get usage stats for current user
 */
router.get('/usage', apiKeyMiddleware, async (req, res) => {
  try {
    const stats = await apiProxyService.getUsageStats(req.apiKey);
    res.json(stats);
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message,
      error_code: error.error_code || 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/v1/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Deepernova API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

/**
 * Documentation endpoint
 */
router.get('/docs', (req, res) => {
  res.json({
    name: 'Deepernova API',
    version: '1.0.0',
    description: 'Advanced AI API powered by Deepernova',
    endpoints: {
      'POST /v1/chat/completions': 'Chat completion endpoint',
      'GET /v1/models': 'List available models',
      'GET /v1/usage': 'Get usage statistics',
      'GET /v1/health': 'Health check'
    },
    authentication: 'Bearer token in Authorization header',
    baseUrl: 'https://api.deepernova.id/v1',
    documentation: 'https://docs.deepernova.id'
  });
});

/**
 * GET /v1/billing/dashboard
 * Customer billing dashboard
 */
router.get('/billing/dashboard', apiKeyMiddleware, (req, res) => {
  try {
    const dashboard = apiKeyManager.getBillingDashboard(req.apiKey);
    if (!dashboard) {
      return res.status(404).json({
        error: 'Customer not found',
        error_code: 'NOT_FOUND'
      });
    }
    res.json(dashboard);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      error_code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /admin/customer/create
 * Admin: Create new customer
 */
router.post('/admin/customer/create', (req, res) => {
  // In production, check admin auth header
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return res.status(403).json({
      error: 'Forbidden',
      error_code: 'FORBIDDEN'
    });
  }

  const { email, name, monthlyTokenQuota, plan } = req.body;
  if (!email || !name) {
    return res.status(400).json({
      error: 'email and name are required',
      error_code: 'BAD_REQUEST'
    });
  }

  try {
    const customer = apiKeyManager.createCustomer(
      email,
      name,
      monthlyTokenQuota,
      plan || 'free' // Default to free tier
    );
    res.json({
      success: true,
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        apiKey: customer.apiKey,
        plan: customer.plan,
        monthlyRate: customer.monthlyRate,
        monthlyTokenQuota: customer.monthlyTokenQuota,
        dailyLimit: customer.dailyLimit,
        status: customer.status
      }
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      error_code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /admin/revenue
 * Admin: View total revenue and customers
 */
router.get('/admin/revenue', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return res.status(403).json({
      error: 'Forbidden',
      error_code: 'FORBIDDEN'
    });
  }

  try {
    const stats = apiKeyManager.getAllCustomers();
    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      error_code: 'INTERNAL_ERROR'
    });
  }
});

export default router;
