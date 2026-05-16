#!/usr/bin/env node
/**
 * Send message: "siapa kamu?"
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001/api/v1';
const ADMIN_KEY = 'admin_deepernova_secret_key_12345';

async function test() {
  try {
    // Create customer
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

    // Send message
    const chatResp = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify({
        model: 'deepernova-full',
        messages: [
          { role: 'user', content: 'siapa kamu?' }
        ]
      })
    });

    const chatData = await chatResp.json();
    const aiResponse = chatData.choices[0]?.message?.content;

    console.log('\n' + '='.repeat(70));
    console.log('💬 Pesan: "siapa kamu?"');
    console.log('='.repeat(70));
    console.log(`\n🤖 Jawaban AI:\n${aiResponse}\n`);
    console.log('='.repeat(70));
    console.log(`📊 Tokens: ${chatData.usage?.total_tokens}\n`);

  } catch (err) {
    console.log(`Error: ${err.message}`);
  }
}

test();
