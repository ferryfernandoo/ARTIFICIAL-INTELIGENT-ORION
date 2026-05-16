#!/usr/bin/env node
/**
 * Test token consumption with longer messages
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001/api/v1';
const ADMIN_KEY = 'admin_deepernova_secret_key_12345';

async function sendMessage(message) {
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
        { role: 'user', content: message }
      ]
    })
  });

  const chatData = await chatResp.json();
  return {
    response: chatData.choices[0]?.message?.content,
    tokens: chatData.usage?.total_tokens,
    promptTokens: chatData.usage?.prompt_tokens,
    completionTokens: chatData.usage?.completion_tokens
  };
}

async function test() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 DeepernNova Token Consumption Test');
  console.log('='.repeat(80) + '\n');

  const messages = [
    {
      name: 'Pendek',
      text: 'Siapa kamu?'
    },
    {
      name: 'Sedang',
      text: 'Jelaskan apa itu machine learning dan bagaimana cara kerjanya dengan detail?'
    },
    {
      name: 'Panjang',
      text: 'Saya ingin memahami lebih dalam tentang kecerdasan buatan. Bisa kamu jelaskan mengenai machine learning, deep learning, dan neural networks? Apa perbedaan antara ketiga konsep tersebut? Bagaimana cara kerja masing-masing? Dan apa aplikasi praktis dari teknologi-teknologi ini dalam kehidupan sehari-hari? Berikan contoh konkret.'
    },
    {
      name: 'Sangat Panjang',
      text: 'Saya tertarik untuk mempelajari tentang teknologi AI terbaru dan perkembangannya. Bisa kamu jelaskan secara mendetail tentang transformers, attention mechanism, dan bagaimana model-model bahasa besar seperti GPT bekerja? Apa keuntungan dan keterbatasannya? Bagaimana proses training mereka? Berapa banyak data yang dibutuhkan? Apa saja tantangan yang dihadapi dalam mengembangkan AI yang lebih baik? Dan bagaimana prospek AI di masa depan? Jelaskan dengan contoh-contoh nyata dan data jika memungkinkan.'
    }
  ];

  for (const msg of messages) {
    console.log(`\n📝 ${msg.name} Message:`);
    console.log(`   Length: ${msg.text.length} characters`);
    console.log(`   Text: "${msg.text.substring(0, 60)}..."\n`);
    
    try {
      const result = await sendMessage(msg.text);
      
      console.log(`✅ Response received:`);
      console.log(`   "${result.response.substring(0, 80)}..."\n`);
      console.log(`📊 Token Usage:`);
      console.log(`   Prompt tokens:     ${result.promptTokens}`);
      console.log(`   Completion tokens: ${result.completionTokens}`);
      console.log(`   Total tokens:      ${result.tokens}`);
      console.log(`   Cost:              $${(result.tokens * 0.000001).toFixed(6)}`);
      console.log('-'.repeat(80));
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('💡 Token Analysis:');
  console.log('='.repeat(80));
  console.log('Rate: $0.000001 per token (very cheap!)');
  console.log('1000 requests @ 17 tokens avg = ~$0.017');
  console.log('100,000 requests @ 100 tokens avg = ~$10');
  console.log('1,000,000 requests @ 200 tokens avg = ~$200');
  console.log('='.repeat(80) + '\n');
}

test();
