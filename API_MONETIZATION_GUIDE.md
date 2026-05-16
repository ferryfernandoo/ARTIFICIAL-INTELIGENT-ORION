# 🚀 DeepernNova API - Developer Guide

## Penjualan API via DeepernNova Proxy

Jual akses ke API Deepseek dengan rebranding sebagai "DeepernNova" dan monetisasi per-token.

---

## 📋 Daftar Isi
1. [Cara Kerja](#cara-kerja)
2. [Authentication](#authentication)
3. [Endpoints](#endpoints)
4. [Pricing](#pricing)
5. [Contoh Implementasi](#contoh-implementasi)
6. [Admin Dashboard](#admin-dashboard)

---

## Cara Kerja

```
Customer App
    ↓ (API Call + Key)
    ↓
DeepernNova Proxy (Port 3001)
    ↓ (Inject Orion Identity System Prompt)
    ↓
Deepseek API / Mock API
    ↓ (Response)
    ↓
Track Usage & Billing
    ↓
Return Response + Record Transaction
```

**Flow:**
1. Customer daftar dan dapat **API Key** format: `deepernova_CUST_ID_TOKEN`
2. Customer membuat request ke `/api/v1/chat/completions` dengan key
3. Proxy memvalidasi key, inject system prompt Orion/DeepernNova
4. Forward ke Deepseek API
5. Catat token usage × harga = charge ke customer
6. Return response dengan rebranding

---

## Authentication

### Header Format
```bash
curl -X POST https://api.deepernova.id/v1/chat/completions \
  -H "x-api-key: deepernova_cust_abc123_xyz789" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

### Format API Key
- `deepernova_` = prefix
- `CUST_ID` = customer ID (12 karakter)
- `TOKEN` = random token (16 karakter)
- **Contoh:** `deepernova_b7ac2c4f_1777420663243_4awvatg86`

---

## Endpoints

### 1. Chat Completions (Main)
```
POST /api/v1/chat/completions
```

**Request:**
```json
{
  "model": "deepernova-full",
  "messages": [
    {"role": "user", "content": "Hello"}
  ],
  "stream": false
}
```

**Response:**
```json
{
  "id": "deepernova_1234567890_abc",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "deepernova-full",
  "provider": "deepernova",
  "choices": [
    {
      "index": 0,
      "message": {"role": "assistant", "content": "..."},
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 50,
    "total_tokens": 60
  }
}
```

---

### 2. Billing Dashboard
```
GET /api/v1/billing/dashboard
```

**Response:**
```json
{
  "customer": {
    "id": "cust_abc123",
    "name": "My Company",
    "email": "dev@company.com",
    "plan": "starter",
    "status": "active"
  },
  "billing": {
    "monthlyRate": 9.99,
    "costThisMonth": "12.34",
    "requestsThisMonth": 50,
    "tokensThisMonth": 12340,
    "tokenQuota": 1000000,
    "quotaUsagePercent": "1.2",
    "quotaWarning": false,
    "nextBillingDate": "2026-06-01"
  },
  "recentUsage": [
    {
      "timestamp": "2026-05-01T12:34:56Z",
      "requestId": "req_123",
      "tokensUsed": 100,
      "cost": 0.0001
    }
  ]
}
```

---

### 3. Models List
```
GET /api/v1/models
```

**Response:**
```json
{
  "object": "list",
  "data": [
    {
      "id": "deepernova-full",
      "object": "model",
      "owned_by": "deepernova"
    },
    {
      "id": "deepernova-fast",
      "object": "model",
      "owned_by": "deepernova"
    }
  ]
}
```

---

## Pricing

| Plan | Monthly | Token Quota | Price per Token |
|------|---------|-------------|-----------------|
| **Starter** | $9.99 | 1M tokens | $0.000001 |
| **Pro** | $49.99 | 10M tokens | $0.000001 |
| **Enterprise** | Custom | Unlimited | Negotiable |

**Cara Hitung:**
- Per token usage: `tokens × $0.000001`
- Contoh: 1M tokens = $1.00
- Plus monthly subscription

---

## Contoh Implementasi

### JavaScript/Node.js
```javascript
const API_KEY = 'deepernova_cust_abc123_xyz789';
const BASE_URL = 'https://api.deepernova.id/v1';

async function chat(message) {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY
    },
    body: JSON.stringify({
      model: 'deepernova-full',
      messages: [{ role: 'user', content: message }],
      stream: false
    })
  });

  const data = await response.json();
  console.log('Response:', data.choices[0].message.content);
  console.log('Tokens:', data.usage.total_tokens);
  console.log('Cost: $' + (data.usage.total_tokens * 0.000001).toFixed(6));
}

chat('Halo, siapa founder DeepernNova?');
```

### Python
```python
import requests

API_KEY = 'deepernova_cust_abc123_xyz789'
BASE_URL = 'https://api.deepernova.id/v1'

response = requests.post(
    f'{BASE_URL}/chat/completions',
    headers={
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
    },
    json={
        'model': 'deepernova-full',
        'messages': [{'role': 'user', 'content': 'Halo'}],
        'stream': False
    }
)

data = response.json()
print(data['choices'][0]['message']['content'])
```

---

## Admin Dashboard

### Create Customer
```bash
curl -X POST http://localhost:3001/api/v1/admin/customer/create \
  -H "x-admin-key: admin_deepernova_secret_key_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@company.com",
    "name": "Company Name",
    "monthlyTokenQuota": 1000000,
    "plan": "starter"
  }'
```

### View Revenue & Customers
```bash
curl -X GET http://localhost:3001/api/v1/admin/revenue \
  -H "x-admin-key: admin_deepernova_secret_key_12345"
```

**Response:**
```json
{
  "totalCustomers": 5,
  "activeCustomers": 4,
  "totalRevenue": "149.95",
  "totalRequests": 1250,
  "customers": [...]
}
```

---

## Status Monitoring

### Health Check
```
GET /api/v1/health
```

---

## Errors

| Code | Status | Meaning |
|------|--------|---------|
| `UNAUTHORIZED` | 401 | API key invalid |
| `QUOTA_EXCEEDED` | 429 | Monthly token quota exceeded |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `API_ERROR` | 500 | Upstream API error |

---

## Support
- Email: support@deepernova.id
- Docs: https://docs.deepernova.id
- Status: https://status.deepernova.id
