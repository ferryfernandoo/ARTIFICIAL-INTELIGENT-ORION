#!/usr/bin/env node
/**
 * Interactive Streaming Test
 */

import fetch from 'node-fetch';
import readline from 'readline';

const BASE_URL = 'http://localhost:3001/api/v1';
const ADMIN_KEY = 'admin_deepernova_secret_key_12345';

let currentApiKey = null;

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
    console.log(`\n✅ New API Key: ${currentApiKey}\n`);
    return currentApiKey;
  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
  }
}

async function testStreaming(message) {
  if (!currentApiKey) {
    console.log('❌ No API key');
    return;
  }

  console.log('\n' + '='.repeat(80));
  console.log('🌊 STREAMING MODE TEST');
  console.log('='.repeat(80));
  console.log(`\n💬 Message: "${message}"\n`);
  console.log('📍 Response (real-time streaming):\n');
  console.log('-'.repeat(80));

  const startTime = Date.now();
  let chunkCount = 0;
  let content = '';

  try {
    const resp = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': currentApiKey
      },
      body: JSON.stringify({
        stream: true,
        model: 'deepernova-full',
        messages: [{ role: 'user', content: message }]
      })
    });

    if (!resp.ok) {
      console.log(`❌ Error: ${resp.status}`);
      return;
    }

    const text = await resp.text();
    const lines = text.split('\n').filter(l => l.trim());

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.substring(6);
        if (data === '[DONE]') {
          // Done
        } else {
          try {
            const chunk = JSON.parse(data);
            chunkCount++;
            
            const delta = chunk.choices?.[0]?.delta;
            if (delta?.content) {
              content += delta.content;
              process.stdout.write(delta.content);
            }
          } catch {
            // Skip
          }
        }
      }
    }

    const responseTime = Date.now() - startTime;
    console.log('\n' + '-'.repeat(80));
    console.log('\n📊 STREAMING STATS:');
    console.log(`   Response time: ${responseTime}ms`);
    console.log(`   Chunks received: ${chunkCount}`);
    console.log(`   Content length: ${content.length} chars`);
    console.log(`   Throughput: ${(chunkCount / (responseTime / 1000)).toFixed(2)} chunks/sec`);
    console.log(`   Speed: ${(content.length / (responseTime / 1000)).toFixed(0)} chars/sec`);
    console.log('='.repeat(80) + '\n');

  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
  }
}

async function testNonStreaming(message) {
  if (!currentApiKey) {
    console.log('❌ No API key');
    return;
  }

  console.log('\n' + '='.repeat(80));
  console.log('⚡ NON-STREAMING MODE TEST');
  console.log('='.repeat(80));
  console.log(`\n💬 Message: "${message}"\n`);
  console.log('📍 Response:\n');
  console.log('-'.repeat(80));

  const startTime = Date.now();

  try {
    const resp = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': currentApiKey
      },
      body: JSON.stringify({
        model: 'deepernova-full',
        messages: [{ role: 'user', content: message }]
      })
    });

    if (!resp.ok) {
      console.log(`❌ Error: ${resp.status}`);
      return;
    }

    const data = await resp.json();
    const content = data.choices[0]?.message?.content || '';
    const responseTime = Date.now() - startTime;

    console.log(content);
    console.log('\n' + '-'.repeat(80));
    console.log('\n⚡ NON-STREAMING STATS:');
    console.log(`   Response time: ${responseTime}ms`);
    console.log(`   Content length: ${content.length} chars`);
    console.log(`   Speed: ${(content.length / (responseTime / 1000)).toFixed(0)} chars/sec`);
    console.log('='.repeat(80) + '\n');

  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
  }
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🌊 DeepernNova API - Streaming vs Non-Streaming Test');
  console.log('='.repeat(80) + '\n');

  await createNewCustomer();

  let running = true;
  while (running) {
    console.log('-'.repeat(80));
    console.log('OPTIONS:');
    console.log('  1 = Test streaming mode');
    console.log('  2 = Test non-streaming mode');
    console.log('  3 = Create new customer');
    console.log('  4 = Exit');
    console.log('-'.repeat(80));

    const choice = await prompt('\nPilih (1-4): ');

    switch (choice.trim()) {
      case '1': {
        const streamMsg = await prompt('💬 Masukkan pesan: ');
        await testStreaming(streamMsg);
        break;
      }

      case '2': {
        const nonStreamMsg = await prompt('💬 Masukkan pesan: ');
        await testNonStreaming(nonStreamMsg);
        break;
      }

      case '3':
        await createNewCustomer();
        break;

      case '4':
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
