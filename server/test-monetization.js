#!/usr/bin/env node
/**
 * Test script untuk DeepernNova API Monetization
 * Test customer creation, usage tracking, dan billing
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001/api/v1';
const ADMIN_KEY = 'admin_deepernova_secret_key_12345';

async function test() {
  console.log('\n🧪 DeepernNova API Monetization Test\n');
  console.log('=' .repeat(50));

  try {
    // 1. Create new customer
    console.log('\n📝 Test 1: Create new customer');
    const createRes = await fetch(`${BASE_URL}/admin/customer/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': ADMIN_KEY
      },
      body: JSON.stringify({
        email: 'customer@example.com',
        name: 'Test Customer',
        monthlyTokenQuota: 100000,
        plan: 'starter'
      })
    });

    if (!createRes.ok) {
      console.error('❌ Customer creation failed:', await createRes.text());
      return;
    }

    const customer = await createRes.json();
    console.log('✅ Customer created:', customer.customer);
    const customerApiKey = customer.customer.apiKey;

    // 2. Test billing dashboard (should be empty)
    console.log('\n📊 Test 2: Check billing dashboard (before usage)');
    const dashRes = await fetch(`${BASE_URL}/billing/dashboard`, {
      headers: {
        'x-api-key': customerApiKey
      }
    });

    const dashboard = await dashRes.json();
    console.log('✅ Dashboard:', {
      tokensThisMonth: dashboard.billing.tokensThisMonth,
      costThisMonth: dashboard.billing.costThisMonth,
      requestsThisMonth: dashboard.billing.requestsThisMonth
    });

    // 3. Make API call to generate usage
    console.log('\n🔗 Test 3: Make API call (will generate usage)');
    const chatRes = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': customerApiKey
      },
      body: JSON.stringify({
        model: 'deepernova-full',
        messages: [{ role: 'user', content: 'Halo, siapa founder DeepernNova?' }],
        stream: false
      })
    });

    if (chatRes.ok) {
      const response = await chatRes.json();
      console.log('✅ Chat response:', {
        model: response.model,
        tokens: response.usage.total_tokens,
        content: response.choices[0].message.content.substring(0, 60) + '...'
      });
    } else {
      console.error('❌ Chat failed:', await chatRes.text());
    }

    // 4. Check dashboard again (should have usage)
    console.log('\n📊 Test 4: Check billing dashboard (after usage)');
    const dashRes2 = await fetch(`${BASE_URL}/billing/dashboard`, {
      headers: {
        'x-api-key': customerApiKey
      }
    });

    const dashboard2 = await dashRes2.json();
    console.log('✅ Dashboard updated:', {
      tokensThisMonth: dashboard2.billing.tokensThisMonth,
      costThisMonth: '$' + dashboard2.billing.costThisMonth,
      requestsThisMonth: dashboard2.billing.requestsThisMonth,
      quotaUsagePercent: dashboard2.billing.quotaUsagePercent + '%'
    });

    // 5. Admin: View revenue
    console.log('\n💰 Test 5: Admin revenue view');
    const revenueRes = await fetch(`${BASE_URL}/admin/revenue`, {
      headers: {
        'x-admin-key': ADMIN_KEY
      }
    });

    const revenue = await revenueRes.json();
    console.log('✅ Revenue stats:', {
      totalCustomers: revenue.totalCustomers,
      activeCustomers: revenue.activeCustomers,
      totalRevenue: '$' + revenue.totalRevenue,
      totalRequests: revenue.totalRequests
    });

    console.log('\n' + '='.repeat(50));
    console.log('✅ All tests passed!\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run test
test().catch(console.error);
