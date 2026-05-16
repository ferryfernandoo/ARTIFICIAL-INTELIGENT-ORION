# 🚀 QUICK START: Launch Your API

## ⚡ 5-Minute Setup

### Terminal 1: Start Proxy Server
```bash
cd f:\orion_deepernova-main\server
node server.js
# Expected output: 🚀 File Generation Server running on http://localhost:3001
```

### Terminal 2: Start Mock Deepseek (for testing)
```bash
cd f:\orion_deepernova-main\server
node mock-deepseek.js
# Expected output: 🎭 Mock Deepseek API running on http://localhost:3002
```

### Terminal 3: Test Everything Works
```bash
cd f:\orion_deepernova-main\server
node test-monetization.js
# Expected output: ✅ All tests passed!
```

---

## 📋 Create Your First Customer (2 minutes)

```bash
curl -X POST http://localhost:3001/api/v1/admin/customer/create \
  -H "Content-Type: application/json" \
  -H "x-admin-key: admin_deepernova_secret_key_12345" \
  -d '{
    "email": "acme@company.com",
    "name": "ACME Corporation",
    "monthlyTokenQuota": 500000
  }'
```

**Copy the API key from response:**
```
deepernova_cust_XXXXX_YYYYY
```

---

## 🧪 Test Customer's API Access

Replace `YOUR_API_KEY` with the key from above:

```bash
curl -X POST http://localhost:3001/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "model": "deepernova-full",
    "messages": [
      {
        "role": "user",
        "content": "What is 2+2?"
      }
    ]
  }'
```

**Expected response:**
```json
{
  "model": "deepernova-full",
  "choices": [{
    "message": {
      "content": "2+2 = 4"
    }
  }]
}
```

---

## 💰 Check Customer Billing

Replace `YOUR_API_KEY`:

```bash
curl -X GET http://localhost:3001/api/v1/billing/dashboard \
  -H "x-api-key: YOUR_API_KEY"
```

**Response shows:**
```json
{
  "tokensThisMonth": 42,
  "costThisMonth": "$0.00",
  "requestsThisMonth": 2,
  "quotaUsagePercent": "0.0%"
}
```

---

## 👑 Admin: View All Revenue

```bash
curl -X GET http://localhost:3001/api/v1/admin/revenue \
  -H "x-admin-key: admin_deepernova_secret_key_12345"
```

**Response shows:**
```json
{
  "totalCustomers": 1,
  "activeCustomers": 1,
  "totalRevenue": "$0.00",
  "totalRequests": 2
}
```

---

## 📊 System Architecture

```
Your Customers
       ↓
   (API Key)
       ↓
Proxy Server (port 3001) ← Real Deepseek API OR Mock (port 3002)
  ├─ Validate API key
  ├─ Inject identity: "You are DeepernNova"
  ├─ Track token usage → billing system
  ├─ Sanitize response (no "Deepseek" mentions)
  └─ Return response
       ↑
  Usage recorded in apiKeyManager
       ↑
  Customer sees $0.000001 per token cost
```

---

## 🔑 Important Settings

### Admin Credentials
- Header: `x-admin-key`
- Value: `admin_deepernova_secret_key_12345` (in `.env`)
- Use for: Creating customers, viewing revenue

### Customer Authentication
- Header: `x-api-key`
- Value: Unique per customer (from creation)
- Use for: Making API calls, checking billing

### Pricing
- Per token: **$0.000001**
- Monthly plans: Starter ($9.99) or Pro ($49.99)
- Overages: Charged at per-token rate

---

## ✅ Verification Checklist

- [ ] Proxy server running on port 3001
- [ ] Mock server running on port 3002 (for testing)
- [ ] Can create new customer (test with curl above)
- [ ] Customer can make API call (test with curl above)
- [ ] Usage tracked correctly (check billing dashboard)
- [ ] Admin can see revenue (test with curl above)

---

## 🚨 Troubleshooting

| Problem | Solution |
|---------|----------|
| "Cannot POST /api/v1/admin/customer/create" | Restart proxy server: `node server.js` |
| "Invalid API key" | Copy exact key from customer creation response |
| "Mock server connection error" | Make sure mock-deepseek.js is running on port 3002 |
| "No tokens tracked" | Check mock server logs - should show chat request received |

---

## 💡 Pro Tips

1. **Save these commands**
   - Bookmark the 3 curl commands above
   - Use them to quickly test customer access

2. **Monitor in real-time**
   - Keep proxy server terminal visible
   - Watch logs for every API call with timestamps

3. **Test before selling**
   - Create test customers
   - Make multiple requests
   - Verify billing calculations

4. **Scale later**
   - Current system handles 100+ customers
   - Switch to database (SQLite) when ready
   - Connect real payment processor (Stripe)

---

## 📞 Support

- **System not starting?** → Check Node.js version: `node --version` (need v18+)
- **Port already in use?** → Kill process: `taskkill /F /IM node.exe`
- **Want production key?** → Get real Deepseek API: https://deepseek.com
- **API docs?** → See `API_MONETIZATION_GUIDE.md`

---

**You're all set! Start selling DeepernNova API today! 🎉**
