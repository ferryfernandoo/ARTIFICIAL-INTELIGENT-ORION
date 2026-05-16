#!/usr/bin/env node
/**
 * Test DeepernNova API Streaming Mode
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001/api/v1';
const ADMIN_KEY = 'admin_deepernova_secret_key_12345';

async function test() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 DeepernNova API - Streaming Mode Test');
  console.log('='.repeat(80) + '\n');

  try {
    // Create customer
    console.log('📋 Creating customer...');
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
    console.log(`✅ API Key: ${apiKey}\n`);

    // Test streaming
    console.log('🌊 Sending streaming request...\n');
    console.log('📍 REQUEST:');
    console.log(`   URL: POST ${BASE_URL}/chat/completions`);
    console.log(`   Headers: x-api-key, Content-Type: application/json`);
    console.log(`   Body: { stream: true, model: "deepernova-full", messages: [...] }\n`);

    const startTime = Date.now();
    let chunkCount = 0;
    let content = '';

    const resp = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify({
        stream: true,
        model: 'deepernova-full',
        messages: [
          { role: 'user', content: 'Jelaskan apa itu cloud computing dalam 3 paragraf' }
        ]
      })
    });

    if (!resp.ok) {
      const error = await resp.text();
      console.log(`❌ Error: ${resp.status} ${error}`);
      return;
    }

    console.log('📍 RESPONSE:');
    console.log(`   Status: ${resp.status} ${resp.statusText}`);
    console.log(`   Content-Type: ${resp.headers.get('content-type')}`);
    console.log(`\n🌊 STREAMING CHUNKS:\n`);
    console.log('-'.repeat(80));

    // Process stream using text()
    const text = await resp.text();
    const lines = text.split('\n').filter(l => l.trim());

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.substring(6);
        if (data === '[DONE]') {
          console.log(`\n✅ Stream finished!\n`);
        } else {
          try {
            const chunk = JSON.parse(data);
            chunkCount++;
            
            // Extract content
            const delta = chunk.choices?.[0]?.delta;
            if (delta?.content) {
              content += delta.content;
              process.stdout.write(delta.content);
            }
            
            // Show chunk details periodically
            if (chunkCount % 5 === 0) {
              console.log(`\n  [Chunk ${chunkCount}]`);
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }

    const responseTime = Date.now() - startTime;
    
    console.log('\n' + '-'.repeat(80));
    console.log('\n📊 STREAMING STATISTICS:');
    console.log(`   Response time: ${responseTime}ms`);
    console.log(`   Total chunks: ${chunkCount}`);
    console.log(`   Content length: ${content.length} characters`);
    console.log(`   Throughput: ${(chunkCount / (responseTime / 1000)).toFixed(2)} chunks/sec`);
    console.log('='.repeat(80) + '\n');

  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
  }
}

test();
