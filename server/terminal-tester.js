#!/usr/bin/env node
/**
 * DeepernNova API Interactive Terminal Tester
 * Test API from client perspective - see full details, response time, tokens
 */

import fetch from 'node-fetch';
import readline from 'readline';

const BASE_URL = 'http://localhost:3001/api/v1';
const ADMIN_KEY = 'admin_deepernova_secret_key_12345';

let currentApiKey = null;
let totalTokensUsed = 0;
let totalRequests = 0;
let totalCost = 0;
let startTime = Date.now();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function createNewCustomer() {
  console.log('\n📋 Creating new free tier customer...');
  try {
    const resp = await fetch(`${BASE_URL}/admin/customer/create`, {
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

    const data = await resp.json();
    currentApiKey = data.customer.apiKey;
    console.log(`✅ New API Key: ${currentApiKey}`);
    return currentApiKey;
  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
  }
}

async function sendMessage(message) {
  if (!currentApiKey) {
    console.log('❌ No API key. Create customer first.');
    return;
  }

  const startTime = Date.now();
  console.log('\n📤 Sending message...\n');

  try {
    const requestBody = {
      model: 'deepernova-full',
      messages: [
        { role: 'user', content: message }
      ]
    };

    console.log('📍 REQUEST:');
    console.log(`   URL: POST ${BASE_URL}/chat/completions`);
    console.log(`   Headers:`);
    console.log(`     - Content-Type: application/json`);
    console.log(`     - x-api-key: ${currentApiKey}`);
    console.log(`   Body:`);
    console.log(`   ${JSON.stringify(requestBody, null, 4)}\n`);

    const resp = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': currentApiKey
      },
      body: JSON.stringify(requestBody)
    });

    const responseTime = Date.now() - startTime;
    const data = await resp.json();

    console.log('📍 RESPONSE:');
    console.log(`   Status: ${resp.status} ${resp.statusText}`);
    console.log(`   Response Time: ${responseTime}ms`);
    console.log(`   Headers:`);
    console.log(`     - Content-Type: ${resp.headers.get('content-type')}`);
    console.log(`   Body:\n`);
    console.log(JSON.stringify(data, null, 4));

    console.log('\n' + '='.repeat(80));
    console.log('✨ AI RESPONSE:');
    console.log('='.repeat(80));
    console.log(`\n${data.choices[0]?.message?.content}\n`);

    const tokens = data.usage?.total_tokens || 0;
    const cost = tokens * 0.000001;
    
    totalTokensUsed += tokens;
    totalRequests += 1;
    totalCost += cost;

    console.log('='.repeat(80));
    console.log('📊 USAGE STATS:');
    console.log('='.repeat(80));
    console.log(`   Prompt tokens:       ${data.usage?.prompt_tokens}`);
    console.log(`   Completion tokens:   ${data.usage?.completion_tokens}`);
    console.log(`   Total tokens:        ${tokens}`);
    console.log(`   Cost:                $${cost.toFixed(6)}`);
    console.log(`   Response time:       ${responseTime}ms`);
    console.log(`\n📈 SESSION STATS:`);
    console.log(`   Total requests:      ${totalRequests}`);
    console.log(`   Total tokens:        ${totalTokensUsed}`);
    console.log(`   Total cost:          $${totalCost.toFixed(6)}`);
    console.log(`   Avg time/request:    ${Math.round(Date.now() - startTime / totalRequests)}ms`);
    console.log('='.repeat(80) + '\n');

  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
  }
}

async function getBillingStatus() {
  if (!currentApiKey) {
    console.log('❌ No API key. Create customer first.');
    return;
  }

  try {
    const resp = await fetch(`${BASE_URL}/billing/dashboard`, {
      method: 'GET',
      headers: {
        'x-api-key': currentApiKey
      }
    });

    const data = await resp.json();
    
    console.log('\n📊 BILLING DASHBOARD:\n');
    console.log(JSON.stringify(data, null, 4));
    console.log();
  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
  }
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 DeepernNova API - Interactive Terminal Tester');
  console.log('='.repeat(80));
  console.log('Test the API from client perspective - Full response & performance analysis\n');

  // Create initial customer
  await createNewCustomer();

  let running = true;
  while (running) {
    console.log('\n' + '-'.repeat(80));
    console.log('OPTIONS:');
    console.log('  1 = Send message to AI');
    console.log('  2 = Check billing status');
    console.log('  3 = Create new customer');
    console.log('  4 = Change API key');
    console.log('  5 = Show session stats');
    console.log('  6 = Exit');
    console.log('-'.repeat(80));

    const choice = await prompt('\nPilih (1-6): ');

    switch (choice.trim()) {
      case '1': {
        const message = await prompt('💬 Masukkan pesan: ');
        await sendMessage(message);
        break;
      }

      case '2': {
        await getBillingStatus();
        break;
      }

      case '3': {
        await createNewCustomer();
        break;
      }

      case '4': {
        const newKey = await prompt('🔑 Masukkan API key baru: ');
        currentApiKey = newKey;
        console.log('✅ API key updated');
        break;
      }

      case '5':
        console.log('\n📈 SESSION STATISTICS:');
        console.log(`   Total requests:      ${totalRequests}`);
        console.log(`   Total tokens:        ${totalTokensUsed}`);
        console.log(`   Total cost:          $${totalCost.toFixed(6)}`);
        console.log(`   Session time:        ${Math.floor((Date.now() - startTime) / 1000)}s`);
        console.log(`   Avg tokens/request:  ${totalRequests > 0 ? (totalTokensUsed / totalRequests).toFixed(2) : 0}`);
        console.log(`   Avg cost/request:    $${totalRequests > 0 ? (totalCost / totalRequests).toFixed(6) : 0}\n`);
        break;

      case '6':
        console.log('\n👋 Goodbye!\n');
        running = false;
        break;

      default:
        console.log('❌ Invalid choice');
    }
  }

  rl.close();
}

main();
