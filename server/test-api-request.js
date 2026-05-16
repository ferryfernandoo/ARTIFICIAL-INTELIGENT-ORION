#!/usr/bin/env node
/**
 * Simple API Request Test - See full request/response
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001/api/v1';
const ADMIN_KEY = 'admin_deepernova_secret_key_12345';

async function test() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 DeepernNova API - Request & Response Test');
  console.log('='.repeat(70) + '\n');

  try {
    // Create customer first
    console.log('📋 STEP 1: Create free tier customer...');
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

    const createData = await createResp.json();
    const apiKey = createData.customer.apiKey;
    console.log(`✅ Customer created: ${apiKey}\n`);

    // Send message request
    console.log('📤 STEP 2: Sending message to AI...\n');
    
    const userMessage = 'Halo! Apa itu machine learning dan bagaimana cara kerjanya?';
    
    console.log('📍 REQUEST Details:');
    console.log(`   URL: POST ${BASE_URL}/chat/completions`);
    console.log(`   Headers:`);
    console.log(`     - Content-Type: application/json`);
    console.log(`     - x-api-key: ${apiKey}`);
    console.log(`   Body:`);
    const requestBody = {
      model: 'deepernova-full',
      messages: [
        { role: 'user', content: userMessage }
      ]
    };
    console.log(`   ${JSON.stringify(requestBody, null, 4)}\n`);

    const chatResp = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify(requestBody)
    });

    if (!chatResp.ok) {
      const error = await chatResp.json();
      console.log(`❌ Error: ${error.error}`);
      return;
    }

    const chatData = await chatResp.json();
    
    console.log('📍 RESPONSE Details:');
    console.log(`   Status: ${chatResp.status} OK`);
    console.log(`   Headers:`);
    console.log(`     - Content-Type: ${chatResp.headers.get('content-type')}`);
    console.log(`   Body:\n`);
    console.log(JSON.stringify(chatData, null, 4));

    console.log('\n' + '='.repeat(70));
    console.log('✨ AI RESPONSE:');
    console.log('='.repeat(70));
    const aiResponse = chatData.choices[0]?.message?.content || 'No response';
    console.log(`\n${aiResponse}\n`);
    
    console.log('='.repeat(70));
    console.log(`📊 Usage Stats:`);
    console.log(`   - Tokens used: ${chatData.usage?.total_tokens}`);
    console.log(`   - Completion tokens: ${chatData.usage?.completion_tokens}`);
    console.log(`   - Prompt tokens: ${chatData.usage?.prompt_tokens}`);
    console.log(`   - Model: ${chatData.model}`);
    console.log(`   - Provider: ${chatData.provider}`);
    console.log('='.repeat(70) + '\n');

  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
  }
}

test();
