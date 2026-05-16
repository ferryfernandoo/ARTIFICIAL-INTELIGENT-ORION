# 🚀 Deepernova API - Complete Documentation

**Base URL:** `https://api.deepernova.id/v1`  
**Version:** 1.0.0  
**Status:** Production Ready

---

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication](#authentication)
3. [Chat Completions API](#chat-completions-api)
4. [Models](#models)
5. [Usage & Rate Limiting](#usage--rate-limiting)
6. [Error Handling](#error-handling)
7. [Code Examples](#code-examples)
8. [Best Practices](#best-practices)
9. [Support](#support)

---

## Getting Started

### 1. Get Your API Key

1. Visit [Deepernova Dashboard](https://api.deepernova.id)
2. Click "Get Started"
3. Your API key will be generated automatically
4. Save it in a safe place - you won't see it again

### 2. Make Your First Request

```bash
curl -X POST https://api.deepernova.id/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepernova-full",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

---

## Authentication

### Bearer Token

Include your API key in the `Authorization` header using Bearer authentication:

```
Authorization: Bearer deepernova_user123_abc123def456
```

### Example

```bash
curl https://api.deepernova.id/v1/models \
  -H "Authorization: Bearer deepernova_user123_abc123def456"
```

---

## Chat Completions API

### Endpoint

```
POST /chat/completions
```

### Request

#### Headers

```
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY
```

#### Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| model | string | Yes | Model ID: `deepernova-full` or `deepernova-fast` |
| messages | array | Yes | Array of message objects |
| temperature | number | No | Sampling temperature (0.0-2.0), default: 0.7 |
| max_tokens | integer | No | Max completion tokens, default: 1000 |
| stream | boolean | No | Stream responses, default: false |
| top_p | number | No | Nucleus sampling parameter (0.0-1.0) |

#### Messages Format

```json
{
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant."
    },
    {
      "role": "user",
      "content": "What is machine learning?"
    },
    {
      "role": "assistant",
      "content": "Machine learning is..."
    }
  ]
}
```

### Response

#### Success (200)

```json
{
  "id": "deepernova_1234567890",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "deepernova-full",
  "provider": "deepernova",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! I'm here to help you with any questions."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 20,
    "total_tokens": 35
  }
}
```

#### Streaming Response

When `stream: true`, response is sent as Server-Sent Events (SSE):

```
data: {"id":"deepernova_123","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}

data: {"id":"deepernova_123","choices":[{"index":0,"delta":{"content":" there"},"finish_reason":null}]}

data: [DONE]
```

---

## Models

### List Models

```
GET /models
```

#### Response

```json
{
  "object": "list",
  "data": [
    {
      "id": "deepernova-full",
      "object": "model",
      "created": 1234567890,
      "owned_by": "deepernova",
      "permission": []
    },
    {
      "id": "deepernova-fast",
      "object": "model",
      "created": 1234567890,
      "owned_by": "deepernova",
      "permission": []
    }
  ]
}
```

### Model Specifications

| Model | Speed | Quality | Context | Cost |
|-------|-------|---------|---------|------|
| deepernova-full | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 128K | $0.001/1K tokens |
| deepernova-fast | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 64K | $0.0005/1K tokens |

---

## Usage & Rate Limiting

### Get Usage Stats

```
GET /usage
```

#### Response

```json
{
  "user_id": "user123",
  "stats": {
    "totalRequests": 1250,
    "totalTokens": 45000,
    "totalCost": 45.00,
    "requestsThisHour": 32
  },
  "rate_limit": {
    "limit": 100,
    "remaining": 68,
    "reset_at": "2024-01-15T14:30:00Z"
  }
}
```

### Rate Limiting

- **Free Tier**: 10 requests/hour
- **Pro Tier**: 100 requests/hour
- **Enterprise**: Custom limits

### Headers

The API includes rate limit info in response headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 68
X-RateLimit-Reset: 1705335000
```

---

## Error Handling

### Error Responses

All errors follow this format:

```json
{
  "error": "Error message",
  "error_code": "ERROR_CODE"
}
```

### Status Codes

| Code | Error | Description |
|------|-------|-------------|
| 200 | - | Success |
| 400 | INVALID_REQUEST | Missing or invalid parameters |
| 401 | UNAUTHORIZED | Invalid or missing API key |
| 429 | RATE_LIMIT_EXCEEDED | Rate limit exceeded |
| 500 | INTERNAL_ERROR | Server error |
| 503 | SERVICE_UNAVAILABLE | Service temporarily unavailable |

### Common Errors

#### Invalid API Key
```json
{
  "error": "Invalid API key",
  "error_code": "UNAUTHORIZED"
}
```

#### Rate Limit Exceeded
```json
{
  "error": "Rate limit exceeded",
  "error_code": "RATE_LIMIT_EXCEEDED"
}
```

#### Missing Parameters
```json
{
  "error": "Missing required field: messages",
  "error_code": "INVALID_REQUEST"
}
```

---

## Code Examples

### Python

```python
import requests
import json

API_KEY = "deepernova_user123_abc123def456"
BASE_URL = "https://api.deepernova.id/v1"

def chat_completion(messages):
    url = f"{BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "deepernova-full",
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 1000
    }
    
    response = requests.post(url, json=payload, headers=headers)
    return response.json()

# Example usage
messages = [
    {"role": "user", "content": "What is AI?"}
]

result = chat_completion(messages)
print(result['choices'][0]['message']['content'])
```

### JavaScript/Node.js

```javascript
const API_KEY = "deepernova_user123_abc123def456";
const BASE_URL = "https://api.deepernova.id/v1";

async function chatCompletion(messages) {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'deepernova-full',
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000
    })
  });

  return await response.json();
}

// Example usage
const messages = [
  { role: 'user', content: 'What is AI?' }
];

chatCompletion(messages).then(result => {
  console.log(result.choices[0].message.content);
});
```

### Streaming Response (Python)

```python
import requests
import json

API_KEY = "deepernova_user123_abc123def456"
BASE_URL = "https://api.deepernova.id/v1"

def stream_chat_completion(messages):
    url = f"{BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "deepernova-full",
        "messages": messages,
        "stream": True
    }
    
    with requests.post(url, json=payload, headers=headers, stream=True) as response:
        for line in response.iter_lines():
            if line:
                data = line.decode('utf-8')
                if data.startswith('data: '):
                    content = data[6:]
                    if content == '[DONE]':
                        break
                    try:
                        chunk = json.loads(content)
                        if 'choices' in chunk:
                            delta = chunk['choices'][0].get('delta', {})
                            if 'content' in delta:
                                print(delta['content'], end='', flush=True)
                    except json.JSONDecodeError:
                        pass

# Example usage
messages = [
    {"role": "user", "content": "Tell me a story"}
]

stream_chat_completion(messages)
```

### cURL

```bash
# Non-streaming
curl -X POST https://api.deepernova.id/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepernova-full",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "temperature": 0.7,
    "max_tokens": 1000
  }'

# Streaming
curl -X POST https://api.deepernova.id/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepernova-full",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "stream": true
  }'
```

---

## Best Practices

### 1. API Key Security
- ✅ Store API keys in environment variables
- ✅ Use separate keys for development and production
- ✅ Rotate keys regularly
- ❌ Never commit keys to version control
- ❌ Never expose keys in client-side code

### 2. Error Handling

```javascript
try {
  const response = await fetch('/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json();
    console.error(`Error: ${error.error_code} - ${error.error}`);
  }

  const data = await response.json();
  return data;
} catch (error) {
  console.error('Network error:', error);
}
```

### 3. Optimize Costs

- Use `deepernova-fast` for simple tasks
- Set appropriate `max_tokens` limits
- Cache responses when possible
- Batch requests when applicable

### 4. Rate Limiting

```javascript
const queue = [];
let currentRequests = 0;
const MAX_CONCURRENT = 10;

async function queueRequest(request) {
  if (currentRequests >= MAX_CONCURRENT) {
    await new Promise(resolve => queue.push(resolve));
  }

  currentRequests++;
  try {
    return await request();
  } finally {
    currentRequests--;
    const resolve = queue.shift();
    if (resolve) resolve();
  }
}
```

### 5. Monitoring & Logging

```javascript
const logRequest = (model, tokens, cost) => {
  console.log(`[API] Model: ${model}, Tokens: ${tokens}, Cost: $${cost}`);
};

// After each request
logRequest(
  response.model,
  response.usage.total_tokens,
  calculateCost(response.usage.total_tokens)
);
```

---

## Support

### Documentation
- 📖 [Full API Docs](https://docs.deepernova.id)
- 🎓 [Tutorials](https://learn.deepernova.id)
- 💬 [Community Forum](https://community.deepernova.id)

### Help & Support
- 📧 Email: support@deepernova.id
- 💬 Discord: [Join Our Server](https://discord.gg/deepernova)
- 🐛 Issues: [GitHub Issues](https://github.com/deepernova/api)

### Status
- 📊 [Status Page](https://status.deepernova.id)
- 🔔 [Subscribe to Updates](https://deepernova.id/subscribe)

---

## Changelog

### v1.0.0 (Current)
- ✅ Chat Completions API
- ✅ Streaming support
- ✅ Multiple models
- ✅ Usage tracking
- ✅ Rate limiting

---

**Last Updated:** January 2024  
**Next Review:** July 2024
