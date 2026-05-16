/**
 * DeepernNova API - Monetization & Billing Management
 * Handles API key generation, usage tracking, and billing
 */

import { v4 as uuidv4 } from 'uuid';

class APIKeyManager {
  constructor() {
    // In-memory storage (upgrade to database for production)
    this.customers = new Map();
    this.apiKeys = new Map();
    this.usageLog = new Map(); // Track per-customer usage
  }

  /**
   * Create new customer and issue API key
   * @param {string} customerEmail 
   * @param {string} customerName 
   * @param {number} monthlyTokenQuota - Max tokens allowed per month (default: free tier with daily limits)
   * @param {string} planType - 'free' (5 req/day), 'starter', 'pro'
   * @returns {object} - API key and customer details
   */
  createCustomer(customerEmail, customerName, monthlyTokenQuota = null, planType = 'free') {
    const customerId = `cust_${uuidv4().substring(0, 12)}`;
    const apiKey = `deepernova_${customerId}_${uuidv4().substring(0, 16)}`;

    // Plan configs
    const planConfigs = {
      free: { quota: 0, rate: 0, dailyLimit: 5, displayName: 'Free' },
      starter: { quota: 100000, rate: 9.99, dailyLimit: null, displayName: 'Starter' },
      pro: { quota: 1000000, rate: 49.99, dailyLimit: null, displayName: 'Pro' }
    };

    const planConfig = planConfigs[planType] || planConfigs.free;
    const finalQuota = monthlyTokenQuota || planConfig.quota;

    const customer = {
      id: customerId,
      email: customerEmail,
      name: customerName,
      apiKey,
      monthlyTokenQuota: finalQuota,
      createdAt: new Date().toISOString(),
      status: 'active',
      plan: planType,
      monthlyRate: planConfig.rate,
      tokensUsedThisMonth: 0,
      requestsThisMonth: 0,
      costThisMonth: 0,
      // Daily tracking (for free tier)
      requestsToday: 0,
      dailyLimit: planConfig.dailyLimit,
      lastDailyReset: new Date().toISOString()
    };

    this.customers.set(customerId, customer);
    this.apiKeys.set(apiKey, customerId);
    this.usageLog.set(customerId, []);

    const tierName = planConfig.displayName;
    const tierDesc = planConfig.dailyLimit ? `${planConfig.dailyLimit} requests/day` : 'Unlimited daily';
    console.log(`✅ New customer created: ${customerName} (${customerId}) - Plan: ${tierName} (${tierDesc})`);
    return customer;
  }

  /**
   * Get customer by API key
   */
  getCustomerByKey(apiKey) {
    const customerId = this.apiKeys.get(apiKey);
    if (!customerId) return null;
    return this.customers.get(customerId);
  }

  /**
   * Reset daily request counter if needed (every 24 hours)
   */
  resetDailyLimitIfNeeded(customer) {
    if (!customer.dailyLimit) return; // Only for free tier
    
    const lastReset = new Date(customer.lastDailyReset);
    const now = new Date();
    const hoursPassed = (now - lastReset) / (1000 * 60 * 60);
    
    if (hoursPassed >= 24) {
      customer.requestsToday = 0;
      customer.lastDailyReset = now.toISOString();
      console.log(`🔄 Daily reset for ${customer.name}`);
    }
  }

  /**
   * Track API usage for customer
   */
  trackUsage(apiKey, tokensUsed, requestId) {
    const customer = this.getCustomerByKey(apiKey);
    if (!customer) return null;

    // Reset daily counter if needed (for free tier)
    this.resetDailyLimitIfNeeded(customer);

    const costPerToken = customer.plan === 'free' ? 0 : 0.000001; // Free tier: no charge
    const cost = tokensUsed * costPerToken;

    // Update customer stats
    customer.tokensUsedThisMonth += tokensUsed;
    customer.requestsThisMonth += 1;
    customer.requestsToday += 1; // Track daily for free tier
    customer.costThisMonth += cost;

    // Log usage
    const usageEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      tokensUsed,
      cost,
      model: 'deepernova-full',
      plan: customer.plan
    };

    const logs = this.usageLog.get(customer.id) || [];
    logs.push(usageEntry);
    this.usageLog.set(customer.id, logs);

    // Check monthly quota (for paid plans)
    if (customer.monthlyTokenQuota > 0 && customer.tokensUsedThisMonth > customer.monthlyTokenQuota) {
      customer.status = 'quota_exceeded';
      console.warn(`⚠️  Customer ${customer.name} exceeded monthly quota`);
    }

    return {
      success: true,
      tokensUsed,
      cost,
      plan: customer.plan,
      costThisMonth: customer.costThisMonth.toFixed(2),
      requestsToday: customer.requestsToday,
      dailyLimit: customer.dailyLimit,
      tokensRemainingThisMonth: customer.monthlyTokenQuota > 0 ? Math.max(0, customer.monthlyTokenQuota - customer.tokensUsedThisMonth) : 'unlimited'
    };
  }

  /**
   * Get customer billing dashboard data
   */
  getBillingDashboard(apiKey) {
    const customer = this.getCustomerByKey(apiKey);
    if (!customer) return null;

    // Reset daily if needed
    this.resetDailyLimitIfNeeded(customer);

    const billing = {
      plan: customer.plan,
      monthlyRate: customer.monthlyRate,
      costThisMonth: customer.costThisMonth.toFixed(2),
      requestsThisMonth: customer.requestsThisMonth,
      tokensThisMonth: customer.tokensUsedThisMonth,
      status: customer.status,
      nextBillingDate: this.getNextBillingDate()
    };

    // Add daily limit info for free tier
    if (customer.dailyLimit) {
      billing.requestsToday = customer.requestsToday;
      billing.dailyLimit = customer.dailyLimit;
      billing.dailyLimitRemaining = Math.max(0, customer.dailyLimit - customer.requestsToday);
      billing.dailyWarning = customer.requestsToday >= customer.dailyLimit;
    } else {
      // Add monthly quota info for paid plans
      if (customer.monthlyTokenQuota > 0) {
        const usagePercentage = (customer.tokensUsedThisMonth / customer.monthlyTokenQuota) * 100;
        billing.tokenQuota = customer.monthlyTokenQuota;
        billing.quotaUsagePercent = usagePercentage.toFixed(1);
        billing.quotaWarning = usagePercentage > 80;
      } else {
        billing.tokenQuota = 'unlimited';
        billing.quotaUsagePercent = 0;
      }
    }

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        plan: customer.plan,
        status: customer.status
      },
      billing,
      recentUsage: (this.usageLog.get(customer.id) || []).slice(-10).reverse()
    };
  }

  /**
   * Check if customer can make request (includes daily limits for free tier)
   */
  canMakeRequest(apiKey) {
    const customer = this.getCustomerByKey(apiKey);
    if (!customer) return { allowed: false, reason: 'Invalid API key', error_code: 'INVALID_KEY' };
    if (customer.status === 'inactive') return { allowed: false, reason: 'Account inactive', error_code: 'ACCOUNT_INACTIVE' };
    
    // Check daily limit (for free tier)
    this.resetDailyLimitIfNeeded(customer);
    if (customer.dailyLimit && customer.requestsToday >= customer.dailyLimit) {
      return { allowed: false, reason: `Daily request limit (${customer.dailyLimit}/day) exceeded`, error_code: 'DAILY_LIMIT_EXCEEDED' };
    }
    
    // Check monthly quota (for paid plans)
    if (customer.status === 'quota_exceeded') return { allowed: false, reason: 'Monthly token quota exceeded', error_code: 'QUOTA_EXCEEDED' };
    if (customer.monthlyTokenQuota > 0 && customer.tokensUsedThisMonth >= customer.monthlyTokenQuota) return { allowed: false, reason: 'Monthly token quota exceeded', error_code: 'QUOTA_EXCEEDED' };
    
    return { allowed: true };
  }

  /**
   * Get all customers (admin only)
   */
  getAllCustomers() {
    const customers = Array.from(this.customers.values()).map(c => ({
      id: c.id,
      name: c.name,
      email: c.email,
      plan: c.plan,
      status: c.status,
      tokensUsedThisMonth: c.tokensUsedThisMonth,
      requestsThisMonth: c.requestsThisMonth,
      costThisMonth: c.costThisMonth.toFixed(2)
    }));

    const totalRevenue = customers.reduce((sum, c) => sum + parseFloat(c.costThisMonth), 0);
    const totalRequests = customers.reduce((sum, c) => sum + c.requestsThisMonth, 0);

    return {
      totalCustomers: customers.length,
      activeCustomers: customers.filter(c => c.status === 'active').length,
      totalRevenue: totalRevenue.toFixed(2),
      totalRequests,
      customers
    };
  }

  /**
   * Upgrade customer plan
   */
  upgradePlan(apiKey, newPlan, newQuota, newMonthlyRate) {
    const customer = this.getCustomerByKey(apiKey);
    if (!customer) return null;

    customer.plan = newPlan;
    customer.monthlyTokenQuota = newQuota;
    customer.monthlyRate = newMonthlyRate;

    console.log(`✅ Plan upgraded for ${customer.name}: ${newPlan}`);
    return customer;
  }

  /**
   * Get next billing date
   */
  getNextBillingDate() {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return nextMonth.toISOString().split('T')[0];
  }

  /**
   * Reset monthly usage (call this on billing cycle)
   */
  resetMonthlyUsage(customerId) {
    const customer = this.customers.get(customerId);
    if (customer) {
      customer.tokensUsedThisMonth = 0;
      customer.requestsThisMonth = 0;
      customer.costThisMonth = 0;
      customer.status = 'active';
      console.log(`✅ Monthly usage reset for ${customer.name}`);
    }
  }
}

export const apiKeyManager = new APIKeyManager();
export default APIKeyManager;
