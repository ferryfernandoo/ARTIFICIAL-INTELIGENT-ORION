# Research Memory System - API Reference

## Quick Reference Card

### Base URL
```
http://localhost:3001/api/research
```

---

## Endpoints Summary

| Method | Endpoint | Purpose | Key Response |
|--------|----------|---------|--------------|
| POST | `/smart-search` | Auto cache decision | `{source: 'memory'\|'fresh_search', decision, data}` |
| GET | `/memory/:userId` | Get cached searches | `{results[], count}` |
| POST | `/direct-search` | Force new search | `{result: {success, results, sources}}` |
| POST | `/format-context` | Prepare for AI | `{formatted: {context, tokenCount}}` |
| POST | `/generate-prompt` | 14-section prompt | `{prompt, sources[], summary}` |
| POST | `/cleanup` | Remove expired | `{cleanedRecords}` |

---

## 1. Smart Search (Intelligent Caching)

**Endpoint**: `POST /api/research/smart-search`

**Request**:
```json
{
  "query": "Latest developments in AI",
  "userId": "user123",
  "options": {
    "category": "general",
    "isNews": false,
    "engine": "google_ai_mode",
    "ttl": 604800000,
    "confidence": 75
  }
}
```

**Response (Cache Hit)**:
```json
{
  "success": true,
  "result": {
    "source": "memory",
    "decision": "USE_CACHE",
    "reason": "Using fresh cached data (confidence: 90%, age: 2.5h)",
    "data": {
      "searchResults": {...},
      "sources": [...],
      "timestamp": "2026-05-13T08:00:00Z"
    }
  },
  "timestamp": "2026-05-13T10:30:00Z"
}
```

**Response (Fresh Search)**:
```json
{
  "success": true,
  "result": {
    "source": "fresh_search",
    "decision": "SEARCH_EXECUTED",
    "reason": "No cached data found",
    "data": {
      "query": "Latest developments in AI",
      "results": {...},
      "sources": [...],
      "textBlocks": [...],
      "memoryId": "research_...",
      "queryHash": "sha256..."
    }
  },
  "timestamp": "2026-05-13T10:30:00Z"
}
```

**Decision Rules**:
- `USE_CACHE`: Data fresh (<24h news or <7d general) + high confidence (>=75%)
- `REFRESH`: Old data (>24h) or low confidence; returns cached but flags for update
- `SEARCH`: No cache found; executes new search
- `FALLBACK_TO_CACHE`: Search failed; returns cache if available

---

## 2. Get Cached Research

**Endpoint**: `GET /api/research/memory/:userId`

**Query Parameters**:
```
?category=news     - Filter by category (optional)
?limit=50          - Max results (default: 50)
```

**Example**:
```bash
GET http://localhost:3001/api/research/memory/user123?category=research&limit=100
```

**Response**:
```json
{
  "success": true,
  "results": [
    {
      "id": "research_...",
      "userId": "user123",
      "query": "Climate change effects",
      "summary": "Climate change causes...",
      "category": "research",
      "confidence": 90,
      "sources": [...],
      "lastUpdated": "2026-05-13T08:00:00Z",
      "expiresAt": "2026-05-20T08:00:00Z"
    }
  ],
  "count": 5,
  "timestamp": "2026-05-13T10:30:00Z"
}
```

---

## 3. Direct Search (No Cache Decision)

**Endpoint**: `POST /api/research/direct-search`

**Request**:
```json
{
  "query": "Coffee types and brewing methods",
  "options": {
    "engine": "google_ai_mode",
    "device": "desktop",
    "gl": "us"
  }
}
```

**Response**:
```json
{
  "success": true,
  "result": {
    "success": true,
    "query": "Coffee types and brewing methods",
    "engine": "google_ai_mode",
    "results": {
      "search_metadata": {...},
      "search_parameters": {...},
      "text_blocks": [...],
      "shopping_results": [...],
      "references": [...]
    },
    "sources": [
      {
        "id": "ref-0",
        "title": "Best Coffee Brands of 2025",
        "url": "https://example.com",
        "source": "Food Network",
        "snippet": "Coffee encompasses...",
        "type": "reference",
        "sourceIcon": "..."
      }
    ],
    "textBlocks": [...],
    "shoppingResults": [...],
    "totalTime": 0.88
  },
  "timestamp": "2026-05-13T10:30:00Z"
}
```

---

## 4. Format Context for AI

**Endpoint**: `POST /api/research/format-context`

**Request**:
```json
{
  "searchData": {
    "sources": [...],
    "textBlocks": [...],
    "shopping_results": [...]
  },
  "maxTokens": 3000
}
```

**Response**:
```json
{
  "success": true,
  "formatted": {
    "context": "Coffee encompasses a wide range of beans...\n\n## Sources:\n- [Best Coffee Brands](url)",
    "tokenCount": 847,
    "truncated": false
  },
  "timestamp": "2026-05-13T10:30:00Z"
}
```

**Token Estimation**: ~0.25 tokens per character

---

## 5. Generate Research Prompt

**Endpoint**: `POST /api/research/generate-prompt`

**Request**:
```json
{
  "query": "Impact of climate change",
  "searchData": {
    "sources": [...],
    "textBlocks": [...],
    "relatedQuestions": [...]
  },
  "cachedContext": ""
}
```

**Response**:
```json
{
  "success": true,
  "prompt": {
    "role": "system",
    "content": "You are a comprehensive research assistant...\n\n## YOUR RESPONSE MUST INCLUDE ALL 14 SECTIONS BELOW\n\n### 1. OVERVIEW & SUMMARY..."
  },
  "sources": [
    {
      "id": "source-0",
      "title": "Climate Science 101",
      "url": "https://...",
      "source": "NASA",
      "type": "reference",
      "icon": "🌍",
      "thumbnail": "...",
      "snippet": "Climate change is...",
      "credibility": 95,
      "domain": "nasa.gov"
    }
  ],
  "summary": {
    "totalSources": 8,
    "searchEngine": "google_ai_mode",
    "executionTime": 0.88,
    "hasMultiplePerspectives": true,
    "averageCredibilityScore": 82,
    "readinessForReport": true
  },
  "timestamp": "2026-05-13T10:30:00Z"
}
```

**The 14-Section Prompt Structure**:
1. OVERVIEW & SUMMARY
2. COMPLETE CHRONOLOGY
3. CAUSES & CONTRIBUTING FACTORS
4. CASUALTIES & VICTIMS
5. EYEWITNESS ACCOUNTS
6. OFFICIAL STATEMENTS
7. EXPERT OPINIONS
8. MEDIA COVERAGE
9. PUBLIC REACTION
10. INVESTIGATION STATUS
11. HISTORICAL CONTEXT
12. IMPACT & CONSEQUENCES
13. LATEST UPDATES
14. FUTURE OUTLOOK

---

## 6. Cleanup Expired Research

**Endpoint**: `POST /api/research/cleanup`

**Request**:
```json
{}
```

**Response**:
```json
{
  "success": true,
  "cleanedRecords": 42,
  "timestamp": "2026-05-13T10:30:00Z"
}
```

**Use Case**: Called by background job to clean old expired records (TTL-based removal)

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Query and userId required",
  "success": false
}
```

### 500 Server Error
```json
{
  "error": "Research failed: SerpAPI_KEY not configured",
  "success": false
}
```

### Network Error (Frontend Handling)
```javascript
try {
  const result = await fetch('/api/research/smart-search', {...});
  if (!result.ok) throw new Error(`HTTP ${result.status}`);
  return await result.json();
} catch (error) {
  console.error('Research failed:', error.message);
  // Fallback to cache or graceful degradation
}
```

---

## Response Headers

All responses include:
- `Content-Type: application/json`
- `Access-Control-Allow-Origin: *` (or specified)
- `X-Powered-By: Deepernova/1.0`

---

## Rate Limiting

- **SerpAPI**: Limited by your plan (typically 100/month free)
- **Backend**: No built-in rate limiting; add if needed
- **Database**: No rate limiting on memory reads

**Recommendation**: Cache aggressively to reduce SerpAPI calls

---

## Pagination

Currently no pagination support. Use `limit` parameter:
```bash
GET /api/research/memory/user123?limit=100
```

Future enhancement: Add `offset` parameter for large result sets.

---

## Data Retention

Records automatically deleted based on `expiresAt`:
- Default TTL: **7 days**
- News (if flagged): **24 hours**
- Custom TTL: Via `options.ttl` in request

Manual cleanup: `POST /api/research/cleanup`

---

## Credibility Scoring Algorithm

```javascript
base = 70
if (major_source) score += 20          // BBC, Reuters, AP, etc.
if (type === 'product') score -= 10
if (type === 'reference') score += 10
if (type === 'news') score += 15
if (snippet_length > 100) score += 5
final = clamp(score, 0, 100)
```

**Color Coding**:
- 🟢 **75-100%**: High confidence (use directly)
- 🟡 **50-74%**: Medium (could refresh)
- 🔴 **0-49%**: Low (should refresh)

---

## cURL Examples

### Smart Search
```bash
curl -X POST http://localhost:3001/api/research/smart-search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "latest news",
    "userId": "user123",
    "options": { "category": "news" }
  }'
```

### Get Cached
```bash
curl http://localhost:3001/api/research/memory/user123?limit=50
```

### Direct Search
```bash
curl -X POST http://localhost:3001/api/research/direct-search \
  -H "Content-Type: application/json" \
  -d '{"query": "coffee brewing methods"}'
```

### Format Context
```bash
curl -X POST http://localhost:3001/api/research/format-context \
  -H "Content-Type: application/json" \
  -d '{
    "searchData": {...},
    "maxTokens": 2000
  }'
```

### Generate Prompt
```bash
curl -X POST http://localhost:3001/api/research/generate-prompt \
  -H "Content-Type: application/json" \
  -d '{
    "query": "climate change",
    "searchData": {...}
  }'
```

### Cleanup
```bash
curl -X POST http://localhost:3001/api/research/cleanup \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## Frontend Service Usage

```javascript
import { researchService } from '../services/researchService';

// Smart search
const result = await researchService.smartSearch(query, userId);

// Get cached
const cached = await researchService.getCachedResearch(userId);

// Direct search
const fresh = await researchService.directSearch(query);

// Format context
const { context } = await researchService.formatContextForAI(data);

// Generate prompt
const { prompt, sources } = 
  await researchService.generateResearchPrompt(query, data);

// Format for display
const displayed = researchService.formatSourcesForDisplay(sources);

// Utilities
const icon = researchService.getSourceIcon('BBC');
const cred = researchService.calculateCredibility(source);
const avg = researchService.getAverageCredibility(sources);
```

---

## Common Patterns

### Pattern 1: Smart Cache
```
POST /api/research/smart-search → Use result directly
```

### Pattern 2: Comprehensive Report
```
POST /api/research/smart-search
  → POST /api/research/generate-prompt
  → POST to Gemini with prompt
```

### Pattern 3: Product Research
```
POST /api/research/direct-search (with engine: google_shopping)
  → Extract shopping_results
  → Display in custom UI
```

### Pattern 4: News Digest
```
POST /api/research/smart-search (with isNews: true)
  → Format with /api/research/format-context
  → Include in news digest UI
```

---

**Last Updated**: May 13, 2026  
**API Version**: 1.0  
**Status**: Production Ready ✅
