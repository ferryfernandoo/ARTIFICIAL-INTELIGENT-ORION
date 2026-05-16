# 🎯 Deepernova API Integration Guide

## Overview

Deepernova API is a **rebranded Deepseek API proxy** that provides:
- ✅ Transparent proxy layer (hides Deepseek backend)
- ✅ User-friendly dashboard
- ✅ Usage tracking & billing
- ✅ Rate limiting & security
- ✅ Complete API documentation

---

## Architecture

```
┌─────────────────┐
│  End Users      │
└────────┬────────┘
         │ API Request
         ↓
┌─────────────────────────────────────┐
│  Deepernova Frontend                │
│  - Dashboard                        │
│  - API Key Management               │
│  - Pricing & Docs                   │
└────────────┬────────────────────────┘
             │ API Call with Bearer Token
             ↓
┌─────────────────────────────────────┐
│  Deepernova API Server              │
│  (routes/api-proxy.js)              │
│  - Auth validation                  │
│  - Rate limiting                    │
│  - Usage tracking                   │
│  - Rebrand responses                │
└────────────┬────────────────────────┘
             │ Forward to Deepseek
             ↓
┌─────────────────────────────────────┐
│  Deepseek API (Hidden)              │
│  (Actual LLM Provider)              │
└─────────────────────────────────────┘
```

---

## Setup Instructions

### Backend Setup

**1. Ensure Server is Running**
```bash
cd server
npm run dev  # Starts on port 3001
```

**2. API Routes Available**
- `POST /api/v1/chat/completions` - Chat API
- `GET /api/v1/models` - List models
- `GET /api/v1/usage` - Get usage stats
- `GET /api/v1/health` - Health check
- `GET /api/v1/docs` - Documentation

**3. Verify API Key Proxy**
```bash
curl http://localhost:3001/api/v1/health
```

### Frontend Setup

**1. Import ApiMarketplace Component**
```javascript
import ApiMarketplace from './components/ApiMarketplace';
```

**2. Add Route in App.jsx** (or your router)
```javascript
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ApiMarketplace from './components/ApiMarketplace';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/api" element={<ApiMarketplace />} />
        {/* Other routes */}
      </Routes>
    </Router>
  );
}
```

**3. Or Show in Navigation**
```javascript
<nav>
  <Link to="/api">Deepernova API</Link>
</nav>
```

---

## How It Works

### User Journey

1. **User Visits Dashboard**
   - Access `/api` route
   - See landing page with features

2. **Generate API Key**
   - Click "Get Started" button
   - Frontend generates key: `deepernova_user{timestamp}_{random}`
   - Store in localStorage & backend
   - Show in modal dialog

3. **View Documentation**
   - Read API docs within dashboard
   - See code examples in multiple languages
   - Copy curl commands

4. **Make API Calls**
   - Use API key with `Authorization: Bearer` header
   - Call `/api/v1/chat/completions`
   - Server validates key & forwards to Deepseek
   - Response is rebranded to hide Deepseek

5. **Monitor Usage**
   - Dashboard shows usage stats
   - Track tokens used & cost
   - See rate limit remaining

---

## API Usage Examples

### Generate API Key (Frontend)

```javascript
const generateApiKey = () => {
  const newKey = `deepernova_user${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem('deepernova_api_key', newKey);
  return newKey;
};
```

### Chat Completion Request

```javascript
// Frontend code
const apiKey = localStorage.getItem('deepernova_api_key');

const response = await fetch('http://localhost:3001/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'deepernova-full',
    messages: [
      { role: 'user', content: 'Hello!' }
    ]
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);
```

### Streaming Response

```javascript
const apiKey = localStorage.getItem('deepernova_api_key');

const response = await fetch('http://localhost:3001/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'deepernova-full',
    messages: [{ role: 'user', content: 'Tell me a story' }],
    stream: true
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split('\n').filter(l => l.trim());

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.substring(6);
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices[0].delta?.content;
        if (content) {
          process.stdout.write(content);
        }
      } catch (e) {
        // Invalid JSON, skip
      }
    }
  }
}
```

---

## Security Considerations

### API Key Management

✅ **Safe Implementation:**
```javascript
// Store in localStorage for frontend demo
// In production, use secure cookie or backend session
const apiKey = localStorage.getItem('deepernova_api_key');

// Or from environment variable (backend)
const apiKey = process.env.DEEPERNOVA_API_KEY;
```

❌ **Unsafe Implementation:**
```javascript
// Don't expose in client-side JavaScript
const API_KEY = 'deepernova_user123_abc123'; // EXPOSED!

// Don't commit to git
// .env file should be in .gitignore
```

### Rate Limiting

```javascript
// Backend enforces rate limits
// Check headers for remaining quota
const remaining = response.headers.get('X-RateLimit-Remaining');
if (remaining === '0') {
  console.warn('Rate limit reached!');
}
```

### Response Transformation

**Server hides Deepseek by:**
- Changing model name: `deepseek-chat` → `deepernova-full`
- Changing provider: `deepseek` → `deepernova`
- Removing Deepseek-specific fields
- Generating new response IDs

---

## Monitoring & Analytics

### Track Usage

```javascript
// After each API call
const trackUsage = async (apiKey) => {
  const stats = await fetch('http://localhost:3001/api/v1/usage', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  }).then(r => r.json());

  console.log(`Total tokens: ${stats.stats.totalTokens}`);
  console.log(`Total cost: $${stats.stats.totalCost}`);
  console.log(`Requests remaining: ${stats.rate_limit.remaining}`);
};
```

### Dashboard Display

The `ApiMarketplace` component shows:
- Current request count
- Tokens used this month
- Total cost
- Rate limit remaining
- Reset time

---

## Pricing Model

### Free Tier
- 10K requests/month
- 1M tokens/month
- $0

### Pro Tier
- 1M requests/month
- 100M tokens/month
- $29/month

### Enterprise
- Unlimited requests
- Unlimited tokens
- Custom pricing

### Token Pricing
- **Input tokens**: $0.001 per 1K tokens
- **Output tokens**: $0.002 per 1K tokens

---

## Troubleshooting

### Issue: "Invalid API key"
**Solution:** Ensure API key format is correct: `deepernova_user{timestamp}_{random}`

### Issue: "Rate limit exceeded"
**Solution:** 
- Check `X-RateLimit-Remaining` header
- Upgrade to Pro tier
- Contact support for enterprise limits

### Issue: Streaming not working
**Solution:**
- Ensure `stream: true` in request
- Check browser supports ReadableStream
- Verify content-type header is set

### Issue: Can't see responses being rebranded
**Solution:**
- Check DevTools Network tab
- Look at response model name (should be `deepernova-full`)
- Verify provider field is `deepernova`

---

## Advanced Features

### Batch Requests

```javascript
const batchRequest = async (requests, apiKey) => {
  const results = [];
  for (const req of requests) {
    const response = await fetch('http://localhost:3001/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req)
    });
    results.push(await response.json());
  }
  return results;
};
```

### Custom Models

Add more models in `apiProxyService.js`:

```javascript
async listModels(userApiKey) {
  return {
    object: 'list',
    data: [
      { id: 'deepernova-full', ... },
      { id: 'deepernova-fast', ... },
      { id: 'deepernova-reasoning', ... }, // Add custom
    ]
  };
}
```

### WebSocket Support

For real-time connections (future enhancement):

```javascript
const ws = new WebSocket('wss://api.deepernova.id/stream');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};
```

---

## Deployment

### Production Checklist

- [ ] API key format validated on backend
- [ ] Rate limiting enforced
- [ ] HTTPS enabled for all connections
- [ ] CORS configured properly
- [ ] Error handling comprehensive
- [ ] Logging & monitoring active
- [ ] Database for API key persistence
- [ ] Billing system integrated
- [ ] Support email configured
- [ ] Status page setup

### Environment Variables

```env
# .env
DEEPSEEK_API_KEY=your_deepseek_key_here
API_RATE_LIMIT=100
API_RATE_WINDOW=3600000
CORS_ORIGIN=https://deepernova.id
```

---

## API Analytics Dashboard

Track:
- Total requests per day/week/month
- Average response time
- Error rates
- Popular models/endpoints
- Top users by usage
- Revenue by tier

---

## Future Enhancements

- [ ] Multiple language model support
- [ ] Fine-tuning API endpoint
- [ ] Image generation API
- [ ] Embeddings API
- [ ] Function calling
- [ ] Multi-modal support
- [ ] Webhook notifications
- [ ] SDKs (Python, JS, Go, etc)
- [ ] CLI tool
- [ ] Mobile app

---

## Support & Contact

- 📧 support@deepernova.id
- 💬 [Community Discord](https://discord.gg/deepernova)
- 📱 [Twitter](https://twitter.com/deepernova)
- 🐛 [GitHub Issues](https://github.com/deepernova/api)

---

**Ready to go live?** 🚀 Start selling your Deepernova API today!
