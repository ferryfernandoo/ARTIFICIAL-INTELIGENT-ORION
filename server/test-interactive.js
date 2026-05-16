#!/usr/bin/env node
/**
 * Interactive API Test - Send custom messages to DeepernNova API
 * Gunakan untuk test dengan pesan Anda sendiri
 */

import fetch from 'node-fetch';
import readline from 'readline';

const BASE_URL = 'http://localhost:3001/api/v1';

// Konfigurasi
const config = {
  apiKey: 'deepernova_b7ac2c4f_1777420663243_4awvatg86', // Default API key (bisa diganti)
  model: 'deepernova-full'
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function sendMessage(message) {
  console.log('\n📤 Mengirim pesan...\n');
  
  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'user', content: message }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.log(`❌ Error (${response.status}): ${error.error}`);
      console.log(`   Error code: ${error.error_code}`);
      return;
    }

    const data = await response.json();
    const reply = data.choices[0]?.message?.content || 'No response';
    const tokens = data.usage?.total_tokens || 0;

    console.log('✅ Response menerima:\n');
    console.log(`💬 ${reply}\n`);
    console.log(`📊 Tokens used: ${tokens}\n`);
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

async function checkBilling() {
  console.log('\n💰 Checking billing...\n');
  
  try {
    const response = await fetch(`${BASE_URL}/billing/dashboard`, {
      headers: {
        'x-api-key': config.apiKey
      }
    });

    if (!response.ok) {
      const error = await response.json();
      console.log(`❌ Error: ${error.error}`);
      return;
    }

    const data = await response.json();
    const billing = data.billing;

    console.log('📊 Status Billing:\n');
    console.log(`   Plan: ${billing.plan}`);
    console.log(`   Cost this month: $${billing.costThisMonth}`);
    console.log(`   Requests today: ${billing.requestsToday || 'N/A'}/${billing.dailyLimit || 'unlimited'}`);
    console.log(`   Total requests: ${billing.requestsThisMonth}`);
    console.log(`   Status: ${billing.status}\n`);
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

function showMenu() {
  console.log('\n' + '='.repeat(60));
  console.log('🤖 DeepernNova API Test - Interactive Mode');
  console.log('='.repeat(60) + '\n');
  console.log('Commands:');
  console.log('  1. Send message ke AI');
  console.log('  2. Check billing status');
  console.log('  3. Change API key');
  console.log('  4. Exit\n');
}

function askQuestion() {
  rl.question('Pilih (1-4): ', async (choice) => {
    switch (choice.trim()) {
      case '1':
        rl.question('\n💬 Masukkan pesan: ', async (message) => {
          await sendMessage(message);
          setTimeout(askQuestion, 500);
        });
        break;
        
      case '2':
        await checkBilling();
        setTimeout(askQuestion, 500);
        break;
        
      case '3':
        rl.question('\n🔑 Masukkan API key baru: ', (newKey) => {
          config.apiKey = newKey.trim();
          console.log('✅ API key updated');
          setTimeout(askQuestion, 500);
        });
        break;
        
      case '4':
        console.log('\n👋 Goodbye!\n');
        rl.close();
        process.exit(0);
        break;
        
      default:
        console.log('❌ Invalid choice');
        setTimeout(askQuestion, 500);
    }
  });
}

console.log(`
  ╔════════════════════════════════════════════════════════════╗
  ║       🚀 DeepernNova API - Interactive Test Client         ║
  ║                                                            ║
  ║  Test API Anda dengan pesan sendiri!                      ║
  ║  Send custom messages to test the DeepernNova API         ║
  ╚════════════════════════════════════════════════════════════╝
`);

console.log(`Current API Key: ${config.apiKey.substring(0, 40)}...`);
console.log(`API URL: ${BASE_URL}`);

showMenu();
askQuestion();
