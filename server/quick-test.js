#!/usr/bin/env node
/**
 * Quick test: Create customer → Send message → Check if server responds
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001/api/v1';
const ADMIN_KEY = 'admin_deepernova_secret_key_12345';

async function test() {
  console.log('\n📋 DeepernNova API Test - Full Flow\n');
  console.log('='.repeat(60));
  
  try {
    // Step 1: Create customer
    console.log('\n✏️  STEP 1: Creating new free tier customer...');
    const createResp = await fetch(`${BASE_URL}/admin/customer/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': ADMIN_KEY
      },
      body: JSON.stringify({
        email: `test_${Date.now()}@deepernova.test`,
        name: 'Test User',
        plan: 'free'
      })
    });

    if (!createResp.ok) {
      const error = await createResp.json();
      console.log(`❌ Failed to create customer: ${error.error}`);
      return;
    }

    const respData = await createResp.json();
    const customer = respData.customer;
    const apiKey = customer.apiKey;
    console.log(`✅ Customer created!`);
    console.log(`   Email: ${customer.email}`);
    console.log(`   Plan: ${customer.plan}`);
    console.log(`   API Key: ${apiKey}`);

    // Step 2: Send message
    console.log('\n📤 STEP 2: Sending test message to API...');
    const testMsg = 'Halo! Apa itu cloud computing?';
    console.log(`   Message: "${testMsg}"`);

    const chatResp = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify({
        model: 'deepernova-full',
        messages: [
          { role: 'user', content: testMsg }
        ]
      })
    });

    if (!chatResp.ok) {
      const error = await chatResp.json();
      console.log(`\n❌ Error (${chatResp.status}): ${error.error}`);
      console.log(`   Error code: ${error.error_code}`);
      return;
    }

    const response = await chatResp.json();
    const reply = response.choices[0]?.message?.content || 'No response';
    const tokens = response.usage?.total_tokens || 0;

    console.log(`\n✅ Response received from server!`);
    console.log(`\n🤖 AI Response:`);
    console.log(`   "${reply}"`);
    console.log(`\n📊 Token usage: ${tokens} tokens`);

    // Step 3: Check billing
    console.log('\n💳 STEP 3: Checking billing status...');
    const billResp = await fetch(`${BASE_URL}/billing/dashboard`, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey
      }
    });

    if (!billResp.ok) {
      const error = await billResp.json();
      console.log(`❌ Error: ${error.error}`);
      return;
    }

    const billData = await billResp.json();
    const billing = billData.billing;
    console.log(`✅ Billing dashboard:`);
    console.log(`   Plan: ${billing.plan}`);
    console.log(`   Cost this month: $${billing.costThisMonth}`);
    console.log(`   Requests today: ${billing.requestsToday}/${billing.dailyLimit}`);
    console.log(`   Tokens used: ${billing.tokensThisMonth}`);
    console.log(`   Status: ${billing.status}`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED - Server is responding correctly!\n');

  } catch (err) {
    console.log(`\n❌ Connection error: ${err.message}`);
    console.log(`\n⚠️  Make sure the servers are running:`);
    console.log(`   npm run dev (in the server directory)`);
  }
}

test();
