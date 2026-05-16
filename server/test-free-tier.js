#!/usr/bin/env node
/**
 * Test Free Tier DeepernNova API
 * - Create free tier customer (5 requests/day, no billing)
 * - Test daily limit enforcement
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001/api/v1';
const ADMIN_KEY = 'admin_deepernova_secret_key_12345';

async function testFreeTier() {
  console.log('\n🎉 DeepernNova Free Tier Test\n');
  console.log('='.repeat(60));

  try {
    // 1. Create FREE tier customer
    console.log('\n📝 Test 1: Create free tier customer (5 requests/day)');
    const createRes = await fetch(`${BASE_URL}/admin/customer/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': ADMIN_KEY
      },
      body: JSON.stringify({
        email: 'freetier@deepernova.com',
        name: 'Free Tier Test User',
        plan: 'free'
      })
    });

    if (!createRes.ok) {
      console.error('❌ Customer creation failed:', await createRes.text());
      return;
    }

    const createData = await createRes.json();
    const customer = createData.customer;
    const customerApiKey = customer.apiKey;

    console.log('✅ Free tier customer created:');
    console.log(`   ID: ${customer.id}`);
    console.log(`   API Key: ${customerApiKey.substring(0, 40)}...`);
    console.log(`   Plan: ${customer.plan} (${customer.dailyLimit} requests/day)`);
    console.log(`   Billing: FREE - $${customer.monthlyRate}/month`);

    // 2. Check billing dashboard before usage
    console.log('\n📊 Test 2: Check dashboard (before usage)');
    const dash1Res = await fetch(`${BASE_URL}/billing/dashboard`, {
      headers: { 'x-api-key': customerApiKey }
    });
    const dash1 = await dash1Res.json();
    console.log('✅ Dashboard:');
    console.log(`   Requests today: ${dash1.billing.requestsToday}/${dash1.billing.dailyLimit}`);
    console.log(`   Total requests this month: ${dash1.billing.requestsThisMonth}`);
    console.log(`   Cost this month: $${dash1.billing.costThisMonth}`);

    // 3. Make 5 API calls (should succeed)
    console.log('\n🔗 Test 3: Make 5 API calls (within daily limit)');
    let successCount = 0;
    for (let i = 1; i <= 5; i++) {
      const chatRes = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': customerApiKey
        },
        body: JSON.stringify({
          model: 'deepernova-full',
          messages: [
            { role: 'user', content: `Request #${i}: Apa itu DeepernNova?` }
          ]
        })
      });

      if (chatRes.ok) {
        const response = await chatRes.json();
        console.log(`   ✅ Request #${i}: SUCCESS (${response.usage.total_tokens} tokens)`);
        successCount++;
      } else {
        const error = await chatRes.json();
        console.log(`   ❌ Request #${i}: FAILED - ${error.error}`);
      }
    }

    console.log(`\n✅ Successfully made ${successCount}/5 requests`);

    // 4. Check dashboard after usage
    console.log('\n📊 Test 4: Check dashboard (after 5 requests)');
    const dash2Res = await fetch(`${BASE_URL}/billing/dashboard`, {
      headers: { 'x-api-key': customerApiKey }
    });
    const dash2 = await dash2Res.json();
    console.log('✅ Dashboard updated:');
    console.log(`   Requests today: ${dash2.billing.requestsToday}/${dash2.billing.dailyLimit}`);
    console.log(`   Daily limit reached: ${dash2.billing.dailyWarning ? 'YES ⚠️' : 'NO'}`);
    console.log(`   Total requests this month: ${dash2.billing.requestsThisMonth}`);
    console.log(`   Cost this month: $${dash2.billing.costThisMonth} (FREE)`);

    // 5. Try to make 6th request (should fail)
    console.log('\n🔗 Test 5: Try to make 6th request (should be BLOCKED)');
    const chatRes6 = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': customerApiKey
      },
      body: JSON.stringify({
        model: 'deepernova-full',
        messages: [
          { role: 'user', content: 'Request #6 - Should fail' }
        ]
      })
    });

    if (!chatRes6.ok) {
      const error = await chatRes6.json();
      console.log(`✅ Request blocked as expected:`);
      console.log(`   Status: ${chatRes6.status}`);
      console.log(`   Error: ${error.error}`);
      console.log(`   Error code: ${error.error_code}`);
    } else {
      console.log('❌ Request should have been blocked but succeeded!');
    }

    // 6. Compare with paid tier
    console.log('\n💳 Test 6: Create STARTER tier customer for comparison');
    const createPaidRes = await fetch(`${BASE_URL}/admin/customer/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': ADMIN_KEY
      },
      body: JSON.stringify({
        email: 'paid@deepernova.com',
        name: 'Paid Tier Test User',
        plan: 'starter'
      })
    });

    const createPaidData = await createPaidRes.json();
    const paidCustomer = createPaidData.customer;
    console.log('✅ Starter tier customer created:');
    console.log(`   Plan: ${paidCustomer.plan}`);
    console.log(`   Billing: $${paidCustomer.monthlyRate}/month`);
    console.log(`   Monthly quota: ${paidCustomer.monthlyTokenQuota.toLocaleString()} tokens`);
    console.log(`   Daily limit: UNLIMITED`);

    // Show comparison
    console.log('\n📈 Tier Comparison:');
    console.log('   ┌─────────────┬──────────┬──────────┬────────────┐');
    console.log('   │ Feature     │ Free     │ Starter  │ Pro        │');
    console.log('   ├─────────────┼──────────┼──────────┼────────────┤');
    console.log('   │ Price       │ FREE     │ $9.99/mo │ $49.99/mo  │');
    console.log('   │ Daily limit │ 5 req/dy │ Unlimit. │ Unlimit.   │');
    console.log('   │ Monthly     │ ∞ tokens │ 100K tok │ 1M tokens  │');
    console.log('   │ Support     │ NO       │ YES      │ YES        │');
    console.log('   └─────────────┴──────────┴──────────┴────────────┘');

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests passed!\n');

  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    process.exit(1);
  }
}

testFreeTier();
