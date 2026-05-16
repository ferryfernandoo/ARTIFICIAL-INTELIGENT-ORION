# Web Search Integration - Workflow Documentation

## Overview
Deepernova now has integrated web search capability via Google SerpAPI. When a user enables "Search Web Mode" and sends a query, the system follows this workflow:

```
User Query (Web Search Mode Enabled)
    ↓
[ChatBot.jsx] Triggers callWebSearch()
    ↓
POST /api/chat/web-search
    ↓
[webSearchService.js] Search Google via SerpAPI
    ↓
IF SUCCESS:
  ├─ Format search results
  ├─ Send to DeepSeek with augmented context
  ├─ Return answer directly to ChatBot
  └─ Display sources
    
IF FAILURE:
  └─ Return: "Maaf, search web gagal tidak tersedia untuk saat ini."
```

## Implementation Files

### 1. Backend: `server/webSearchService.js`
**Purpose**: Handles Google Search via SerpAPI

**Key Methods**:
- `searchGoogle(query, maxResults)` - Calls SerpAPI and returns formatted results
- `formatSearchResultsForPrompt(results)` - Formats results for AI context injection
- `augmentPromptWithWebSearch(userQuery, systemPrompt)` - Enriches system prompt with search results
- `getErrorMessage()` - Returns Indonesian error message

**Error Handling**:
```javascript
// If SERPAPI_KEY not configured:
{
  success: false,
  error: 'SERPAPI_KEY tidak dikonfigurasi'
}

// If no results found:
{
  success: false,
  error: 'Tidak ada hasil pencarian ditemukan'
}
```

### 2. Backend: `server/server.js` - New Endpoint
**Endpoint**: `POST /api/chat/web-search`

**Request**:
```json
{
  "query": "user question here",
  "conversationHistory": [/* previous messages */],
  "language": "id",
  "model": "deepseek-chat"
}
```

**Success Response**:
```json
{
  "success": true,
  "query": "user question",
  "answer": "AI answer with search results context",
  "searchResults": [
    {
      "title": "...",
      "url": "...",
      "snippet": "...",
      "position": 1
    }
  ],
  "searchPerformed": true,
  "searchSucceeded": true
}
```

**Failure Response** (503):
```json
{
  "error": "Maaf, search web gagal tidak tersedia untuk saat ini.",
  "code": "WEB_SEARCH_FAILED",
  "details": "original error message",
  "searchPerformed": true,
  "searchSucceeded": false
}
```

### 3. Frontend: `src/components/ChatBot.jsx` 

**New Helper Function**: `callWebSearch(query)`
- Calls `/api/chat/web-search` endpoint
- Returns success/error with answer
- Handles network errors gracefully

**Modified Flow in `handleSendMessage`**:
```javascript
if (isSearchWebMode) {
  // Uses new web search endpoint
  const result = await callWebSearch(inputValue);
  
  if (result.success) {
    // Skip normal processing
    // Add user message + bot message directly
    // Display search sources
    return; // Early exit
  } else {
    // Show error, continue with normal chat
    setError(result.error);
  }
}
```

**UI Elements**:
- Checkbox toggle: "🔍 Search Web" in menu
- Status: "Mencari di web..." while searching
- Error display: Shows error message in red
- Sources: Displays search results with titles, URLs, snippets

## Usage Flow - Step by Step

### Step 1: User Enables Web Search Mode
```
User clicks: Menu → 🔍 Search Web
State: isSearchWebMode = true
```

### Step 2: User Sends Query
```
Input: "Siapa presiden Indonesia 2024?"
Click: Send
```

### Step 3: Frontend Calls Web Search
```javascript
// ChatBot.jsx line ~2965
const result = await callWebSearch(inputValue);
// Makes POST to /api/chat/web-search
```

### Step 4: Backend Searches Google
```javascript
// server/webSearchService.js
const results = await searchGoogle(query, 5);
// Calls: https://serpapi.com/search?q=...&api_key=SERPAPI_KEY
```

### Step 5: Google Results Processed
```
Results:
[
  {
    title: "Joko Widodo - Wikipedia",
    url: "https://...",
    snippet: "Joko Widodo adalah presiden Indonesia ke-7..."
  },
  // ... more results
]
```

### Step 6: Results Formatted & Sent to DeepSeek
```
System Prompt:
"Anda adalah asisten AI yang membantu pengguna Indonesia.
Berikut adalah hasil pencarian web terkini:

📊 **HASIL PENCARIAN WEB:**

1. **Joko Widodo - Wikipedia**
   Joko Widodo adalah presiden Indonesia ke-7...
   📌 https://...
..."
```

### Step 7: DeepSeek Generates Answer
```
DeepSeek receives:
- System prompt with search context
- Conversation history (last 5 messages)
- User query: "Siapa presiden Indonesia 2024?"

Returns:
"Berdasarkan hasil pencarian web terkini, 
Joko Widodo adalah presiden Indonesia yang menjabat 
dari tahun 2014 hingga 2024. Pada tahun 2024, 
ia telah menjalani dua periode pemerintahan..."
```

### Step 8: Answer Displayed to User
```
Messages:
1. [User] Siapa presiden Indonesia 2024?
2. [Bot] Berdasarkan hasil pencarian web...

Sources Sidebar:
🔍 Search Results:
- Joko Widodo - Wikipedia
- Presiden Joko Widodo Periode 2 - ...
- ...
```

## Error Scenarios

### Scenario 1: SERPAPI_KEY Not Configured
```
Response: 503 Service Unavailable
Message: "Maaf, search web gagal tidak tersedia untuk saat ini."
UI: Error message displayed, normal chat continues
```

### Scenario 2: No Search Results Found
```
Response: 503 Service Unavailable
Message: "Tidak ada hasil pencarian ditemukan"
UI: Error message displayed, normal chat continues
```

### Scenario 3: SerpAPI Error (rate limit, etc.)
```
Response: 503 Service Unavailable
Message: "Maaf, search web gagal tidak tersedia untuk saat ini."
Details: Logs actual error (e.g., "Rate limit exceeded")
UI: Error message displayed, normal chat continues
```

### Scenario 4: Network Error
```
Response: 500 Internal Server Error
Message: "Internal server error"
Frontend catches and shows: "Maaf, search web gagal tidak tersedia untuk saat ini."
```

## Configuration

### Required Environment Variables
```bash
# In .env file at project root
SERPAPI_KEY=3dcea72b423f7514a9428d398e9f42cd5d7b9004928fb8212f3694342f61133a
DEEPSEEK_API_KEY=sk-...
```

### API Key Limits
- **SerpAPI**: Free tier has 100 searches/month
- **DeepSeek**: Based on your subscription

### Performance Considerations
- Average search time: 1-3 seconds
- DeepSeek processing: 2-5 seconds
- Total response time: 3-8 seconds
- Timeout: 30 seconds (backend)

## Testing the Feature

### Test 1: Successful Web Search
```
1. Enable "Search Web" mode
2. Ask: "Siapa presiden Indonesia?"
3. Expected: Answer based on current web search
4. Sources: Should show Wikipedia, government sites, etc.
```

### Test 2: Web Search Disabled
```
1. Disable "Search Web" mode
2. Ask: "Siapa presiden Indonesia?"
3. Expected: Answer from knowledge base/model
4. NO web search performed
```

### Test 3: Error Handling
```
1. Stop backend server (simulate error)
2. Enable "Search Web" mode
3. Send query
4. Expected: Error message in Indonesian
5. Chat continues normally
```

### Test 4: Search with Special Characters
```
1. Enable "Search Web" mode
2. Ask: "Apa kabar? Cuaca hari ini?"
3. Expected: Proper URL encoding and results
```

## Code Examples

### From Frontend (ChatBot.jsx)
```javascript
const callWebSearch = async (query) => {
  try {
    const response = await fetch(`${apiBaseUrl}/api/chat/web-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query,
        conversationHistory: messages.slice(-5),
        language: userLanguage || 'id',
        model: selectedModel || 'deepseek-chat'
      })
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      return {
        success: true,
        answer: data.answer,
        searchResults: data.searchResults
      };
    } else {
      return {
        success: false,
        error: data.error || 'Web search failed'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: 'Maaf, search web gagal tidak tersedia untuk saat ini.'
    };
  }
};
```

### From Backend (server/server.js)
```javascript
app.post('/api/chat/web-search', express.json(), async (req, res) => {
  const { query, conversationHistory, language, model } = req.body;
  
  // 1. Perform web search
  const searchResult = await webSearchService.searchGoogle(query, 5);
  
  if (!searchResult.success) {
    return res.status(503).json({
      error: webSearchService.getErrorMessage(),
      code: 'WEB_SEARCH_FAILED'
    });
  }
  
  // 2. Format results
  const searchContext = webSearchService.formatSearchResultsForPrompt(
    searchResult.results
  );
  
  // 3. Send to DeepSeek
  const deepseekResponse = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model || 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt + searchContext },
        ...conversationHistory,
        { role: 'user', content: query }
      ],
      temperature: 0.7,
      max_tokens: 2048
    })
  });
  
  // 4. Return answer
  const answer = await deepseekResponse.json();
  return res.json({
    success: true,
    answer: answer.choices[0].message.content,
    searchResults: searchResult.results
  });
});
```

## Monitoring & Debugging

### Server Logs
When web search is used, look for:
```
[WebSearch] 🔍 Processing web search for: "query text"
[WebSearch] 📡 Calling SerpAPI...
[WebSearch] ✅ Search succeeded! Found 5 results
[WebSearch] 📤 Sending to DeepSeek with search context...
[WebSearch] ✅ SUCCESS! Got answer from DeepSeek (1234 chars)
```

### Chrome DevTools (Frontend)
Check Network tab:
```
POST /api/chat/web-search
Status: 200
Response: {success: true, answer: "...", searchResults: [...]}
```

### Error Logs
```
[WebSearch] ❌ Search failed: SerpAPI returned status 429
[WebSearch] ❌ DeepSeek error: 503
[WebSearch] ❌ Endpoint error: ECONNREFUSED
```

## Future Enhancements
1. Cache search results (5 min TTL)
2. Support other search engines (DuckDuckGo, Bing)
3. Real-time news integration
4. Search result filtering/ranking
5. Conversation context optimization
6. Multi-language results
7. Image/video search integration

---
**Last Updated**: May 2026
**Version**: 1.0 - Initial Release
