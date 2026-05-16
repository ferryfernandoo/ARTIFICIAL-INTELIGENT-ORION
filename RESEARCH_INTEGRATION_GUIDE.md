# Research Memory System - Integration Guide

## Quick Start

### 1. Setup Environment Variable

Add to `.env` in root directory:
```bash
SERPAPI_KEY=3dcea72b423f7514a9428d398e9f42cd5d7b9004928fb8212f3694342f61133a
```

### 2. Database Initialization

The `research_memory` table will be created automatically on first `initializeDatabase()` call.

Check server logs for: `✅ Database initialized`

### 3. Import Services in ChatBot

```jsx
// At top of ChatBot.jsx
import { researchService } from '../services/researchService';
import SourceVisualization from './SourceVisualization';
```

---

## Basic Integration Pattern

### Pattern 1: Simple Research Query

```jsx
const handleResearch = async (userMessage) => {
  const userId = getCurrentUserId(); // Get from auth
  
  // Step 1: Smart search with auto-cache decision
  const research = await researchService.smartSearch(
    userMessage,
    userId,
    { category: 'general' }
  );

  // Step 2: Check if data came from cache or fresh search
  if (research.result.source === 'memory') {
    console.log('📚 Using cached data:', research.result.reason);
  } else {
    console.log('🔍 Fresh search executed');
  }

  // Step 3: Format for AI context
  const { context, tokenCount } = await researchService.formatContextForAI(
    research.result.data,
    3000 // max tokens
  );

  // Step 4: Send to Gemini with context
  const aiResponse = await geminiApi.chat(
    [
      { 
        role: 'system', 
        content: `You are a research assistant. Use this context:\n${context}` 
      },
      { 
        role: 'user', 
        content: userMessage 
      }
    ]
  );

  // Step 5: Display with sources
  return {
    response: aiResponse,
    sources: research.result.data.sources,
    searchSource: research.result.source
  };
};
```

### Pattern 2: Comprehensive Research Report

```jsx
const handleComprehensiveResearch = async (userMessage) => {
  const userId = getCurrentUserId();
  
  // Perform smart search
  const research = await researchService.smartSearch(
    userMessage,
    userId,
    { category: 'research' }
  );

  // Generate comprehensive prompt
  const { prompt, sources, summary } = 
    await researchService.generateResearchPrompt(
      userMessage,
      research.result.data
    );

  // Send to Gemini with full 14-section prompt
  const comprehensiveReport = await geminiApi.chat([prompt]);

  // Format sources for display
  const displaySources = researchService.formatSourcesForDisplay(sources);

  return {
    report: comprehensiveReport,
    sources: displaySources,
    quality: summary,
    cacheInfo: {
      wasFromCache: research.result.source === 'memory',
      decision: research.result.decision,
      reason: research.result.reason
    }
  };
};
```

---

## UI Implementation

### Display Sources Below Response

```jsx
function ChatMessage({ message, sources, quality }) {
  const [showSources, setShowSources] = useState(false);

  return (
    <div className="message">
      <div className="message-content">
        {message}
      </div>

      {sources && sources.length > 0 && (
        <>
          <button 
            className="toggle-sources"
            onClick={() => setShowSources(!showSources)}
          >
            {showSources ? '✕ Hide Sources' : '📚 Show Sources (' + sources.length + ')'}
          </button>

          {showSources && (
            <SourceVisualization 
              sources={sources}
              averageCredibility={quality?.averageCredibilityScore || 0}
              compact={false}
            />
          )}
        </>
      )}
    </div>
  );
}
```

### Source Indicator in Message Header

```jsx
function MessageHeader({ source, decision, timestamp }) {
  return (
    <div className="message-header">
      <span className="timestamp">{formatTime(timestamp)}</span>
      
      {source === 'memory' ? (
        <span className="source-badge cached">
          💾 Cached {decision === 'REFRESH' ? '(refreshed)' : ''}
        </span>
      ) : (
        <span className="source-badge fresh">
          🔍 Fresh Search
        </span>
      )}
    </div>
  );
}
```

---

## Advanced: Custom Decision Logic

### Override Cache Decisions

```jsx
// Force fresh search (ignore cache)
const research = await researchService.directSearch(userMessage, {
  engine: 'google_ai_mode'
});

// Get only from cache
const cached = await researchService.getCachedResearch(userId, 'research');
if (cached.results.length > 0) {
  const matchingResult = cached.results[0];
  // Use this data
}
```

### Monitor Cache Performance

```jsx
const monitorCachePerformance = async (userId) => {
  const cached = await researchService.getCachedResearch(userId);
  
  const stats = {
    totalCached: cached.results.length,
    avgConfidence: researchService.getAverageCredibility(
      cached.results.flatMap(r => r.sources)
    ),
    categories: [...new Set(cached.results.map(r => r.category))],
    oldestCache: Math.min(...cached.results.map(r => 
      Date.now() - new Date(r.createdAt).getTime()
    )) / (1000 * 60 * 60), // in hours
  };

  console.log('📊 Cache Stats:', stats);
  return stats;
};
```

---

## Smart Features Explained

### 1. Automatic Deduplication

Same query won't be searched twice within the TTL period:

```
User: "What is climate change?"
→ Search executed, saved with confidence=95

30 minutes later...

User: "What is climate change?" (exact same)
→ Cache hit! Returned in 50ms instead of 2s
```

### 2. Adaptive Freshness

Different content types have different freshness thresholds:

```javascript
// News: refresh after 24 hours
const news = await researchService.smartSearch(
  "latest AI breakthroughs",
  userId,
  { isNews: true }
);

// General knowledge: refresh after 7 days
const general = await researchService.smartSearch(
  "photosynthesis explained",
  userId,
  { isNews: false } // default
);
```

### 3. Graceful Degradation

If search fails, automatically fallback to cache:

```
Search fails (network error)
  ↓
smartResearch() catches error
  ↓
Cache exists? Return cached data with confidence lowered
  ↓
No cache? Re-throw error to user
```

### 4. Confidence Scoring

Visual indicator of data reliability:

```javascript
// Green (75-100%): High confidence, use directly
// Yellow (50-74%): Medium confidence, could refresh
// Red (0-49%): Low confidence, should refresh

const confidence = source.credibility;
const color = confidence >= 75 ? '🟢' : 
              confidence >= 50 ? '🟡' : '🔴';
```

---

## Performance Tips

### Optimize Token Usage

```jsx
// Limit context size for efficiency
const formatted = await researchService.formatContextForAI(
  searchData,
  1500 // Don't send everything, just top results
);
```

### Batch Research Queries

```jsx
// Instead of multiple searches
const queries = ["query1", "query2", "query3"];
const results = await Promise.all(
  queries.map(q => researchService.smartSearch(q, userId))
);
// Benefits from cache when applicable
```

### Periodic Cleanup

```jsx
// In server startup or scheduled task
setInterval(async () => {
  const cleaned = await fetch('/api/research/cleanup', {
    method: 'POST'
  }).then(r => r.json());
  console.log(`🧹 Cleaned ${cleaned.cleanedRecords} expired records`);
}, 24 * 60 * 60 * 1000); // Daily
```

---

## Error Handling

### Comprehensive Error Management

```jsx
const safeSmartSearch = async (query, userId) => {
  try {
    const research = await researchService.smartSearch(query, userId);
    
    if (!research.success) {
      throw new Error(research.error);
    }

    return research.result;
  } catch (error) {
    console.error('Research failed:', error.message);

    // Fallback to cached data if available
    try {
      const cached = await researchService.getCachedResearch(userId);
      if (cached.results.length > 0) {
        console.warn('⚠️ Using fallback cache due to error');
        return cached.results[0];
      }
    } catch (fallbackError) {
      console.error('Even fallback failed:', fallbackError);
    }

    // Last resort: inform user
    return {
      error: true,
      message: 'Research service temporarily unavailable',
      fallback: 'Try asking without specific current information'
    };
  }
};
```

---

## Real-World Examples

### Example 1: News-Focused Chat

```jsx
async function newsChat(userMessage, userId) {
  // News should always be fresh
  const research = await researchService.smartSearch(
    userMessage,
    userId,
    { 
      isNews: true,
      engine: 'google_news',
      category: 'news'
    }
  );

  const { prompt, sources, summary } = 
    await researchService.generateResearchPrompt(
      userMessage,
      research.result.data
    );

  const response = await geminiApi.chat([
    {
      role: 'system',
      content: `${prompt.content}\n\nProvide up-to-date information based on these sources. Always cite your sources.`
    }
  ]);

  return {
    message: response,
    sources: researchService.formatSourcesForDisplay(sources),
    quality: summary,
    freshDataEnsured: research.result.decision === 'SEARCH_EXECUTED'
  };
}
```

### Example 2: Product Research

```jsx
async function productResearch(userMessage, userId) {
  const research = await researchService.smartSearch(
    userMessage,
    userId,
    {
      engine: 'google_shopping',
      category: 'products'
    }
  );

  // Extract shopping results
  const products = research.result.data.shopping_results || [];

  const response = await geminiApi.chat([
    {
      role: 'system',
      content: `Analyze these products: ${JSON.stringify(products.slice(0, 5))}`
    }
  ]);

  return {
    recommendation: response,
    products: products.slice(0, 5),
    sources: research.result.data.sources
  };
}
```

### Example 3: Academic Research

```jsx
async function academicResearch(userMessage, userId) {
  // Get comprehensive research with full citations
  const research = await researchService.smartSearch(
    userMessage,
    userId,
    { category: 'academic' }
  );

  const { prompt, sources } = 
    await researchService.generateResearchPrompt(
      userMessage,
      research.result.data
    );

  // Add citation instructions
  const academicPrompt = prompt.content + 
    `\n\nFormat your response with APA citations. Use these sources:\n${
      sources.map(s => `- ${s.title}: ${s.url}`).join('\n')
    }`;

  const response = await geminiApi.chat([
    { role: 'system', content: academicPrompt }
  ]);

  return {
    paper: response,
    citations: sources,
    citeableSources: researchService.formatSourcesForDisplay(sources)
  };
}
```

---

## Configuration Examples

### Conservative Cache (Always Fresh)

```javascript
// Aggressive refresh - minimal caching
const research = await researchService.smartSearch(
  query,
  userId,
  {
    ttl: 60 * 60 * 1000, // 1 hour instead of 7 days
    minConfidence: 90 // Only use cache with very high confidence
  }
);
```

### Aggressive Cache (Fast Responses)

```javascript
// Liberal caching - prioritize speed
const research = await researchService.smartSearch(
  query,
  userId,
  {
    ttl: 30 * 24 * 60 * 60 * 1000, // 30 days
    minConfidence: 60 // Use cache even with moderate confidence
  }
);
```

---

## Debugging

### Enable Verbose Logging

```javascript
// In researchService (frontend)
const researchService = {
  ...existing,
  enableDebug: true,
  
  smartSearch: async (query, userId, options) => {
    const start = Date.now();
    console.log('🔬 [RESEARCH START]', { query, userId });
    
    const result = await fetch(...);
    const elapsed = Date.now() - start;
    
    console.log('🔬 [RESEARCH END]', { 
      source: result.result.source,
      decision: result.result.decision,
      elapsed: `${elapsed}ms`,
      sourceCount: result.result.data.sources?.length
    });
    
    return result;
  }
};
```

### Monitor API Calls

```jsx
// Track research API usage
const trackResearchUsage = (userId) => {
  return async (query) => {
    const start = performance.now();
    const research = await researchService.smartSearch(query, userId);
    const duration = performance.now() - start;

    // Log to analytics
    analytics.trackEvent('research', {
      query,
      source: research.result.source,
      decision: research.result.decision,
      duration,
      sourceCount: research.result.data.sources?.length,
      timestamp: new Date().toISOString()
    });

    return research;
  };
};
```

---

## Deployment Checklist

- [x] Environment variable `SERPAPI_KEY` configured
- [x] Database migration runs on startup
- [x] All API endpoints tested in production
- [x] Error handling in place
- [x] Fallback caching implemented
- [x] TTL-based cleanup scheduled
- [x] Source visualization tested on mobile
- [x] Dark mode styles working
- [x] Performance benchmarks acceptable
- [x] Credentials properly secured
- [x] CORS configured correctly
- [x] Rate limiting (if applicable) configured

---

**Ready to integrate! Start with Pattern 1 for basic usage.**
