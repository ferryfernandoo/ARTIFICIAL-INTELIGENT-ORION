import crypto from 'crypto';
import { researchMemoryDb } from './database.js';

const SERPAPI_BASE = 'https://serpapi.com/search.json';

/**
 * Research Service - Intelligent caching + SerpAPI integration
 * Decides whether to search or use cached data based on query freshness & confidence
 */

export class ResearchService {
  constructor() {
    this.searchCache = new Map();
    this.pendingQueries = new Map();
  }

  /**
   * Get SerpAPI key lazily at runtime (not at module load time)
   */
  getSerpApiKey() {
    return process.env.SERPAPI_KEY || '';
  }

  /**
   * Calculate query hash for consistency
   */
  getQueryHash(query) {
    return crypto.createHash('sha256').update(query.toLowerCase()).digest('hex');
  }

  /**
   * AGENTIC DECISION: Should we search or use cache?
   * Factors: freshness, confidence, query complexity
   */
  async shouldSearch(query, userId, options = {}) {
    const queryHash = this.getQueryHash(query);

    // Check database cache first
    const cached = researchMemoryDb.findByQueryHash(queryHash);
    
    if (!cached) {
      return { decision: 'SEARCH', reason: 'No cached data found', cached: null };
    }

    // Force refresh mock cache if a real SerpAPI key is available
    if (cached.searchEngine === 'mock' && this.getSerpApiKey()) {
      return {
        decision: 'REFRESH',
        reason: 'Mock search data found but real SERPAPI key is configured, refreshing with live search',
        cached: cached,
        confidence: Math.max(20, cached.confidence - 10)
      };
    }

    // Check if cache is still fresh (< 24 hours for news, < 7 days for general)
    const ageHours = (Date.now() - new Date(cached.lastUpdated).getTime()) / (1000 * 60 * 60);
    const isFresh = options.isNews ? ageHours < 24 : ageHours < 168; // 7 days for general

    if (!isFresh) {
      return {
        decision: 'REFRESH',
        reason: `Cached data ${ageHours.toFixed(1)} hours old, refreshing`,
        cached: cached,
        confidence: Math.max(20, cached.confidence - 10) // Lower confidence for old data
      };
    }

    // If confidence is high and data is fresh, use cache
    if (cached.confidence >= 75 && isFresh) {
      return {
        decision: 'USE_CACHE',
        reason: `Using fresh cached data (confidence: ${cached.confidence}%, age: ${ageHours.toFixed(1)}h)`,
        cached: cached
      };
    }

    // Borderline case: use cache but flag for verification
    return {
      decision: 'USE_CACHE_WITH_FLAG',
      reason: `Using borderline cache (confidence: ${cached.confidence}%)`,
      cached: cached,
      flaggedForVerification: true
    };
  }

  /**
   * Execute SerpAPI search with intelligent engine selection
   */
  async search(query, options = {}) {
    const apiKey = this.getSerpApiKey();
    
    // If no SERPAPI_KEY, return mock development data
    if (!apiKey) {
      console.warn('[ResearchService] SERPAPI_KEY not configured, using mock data for development');
      return this.getMockSearchResults(query);
    }

    // Google AI Mode untuk research mendalam
    const engine = options.engine || 'google_ai_mode';
    const searchParams = new URLSearchParams({
      api_key: apiKey,
      engine: engine,
      q: query,
      ...(options.device && { device: options.device }),
      ...(options.gl && { gl: options.gl }), // Geo-location
    });

    const url = `${SERPAPI_BASE}?${searchParams}`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`SerpAPI error: ${response.status}`);
      
      const data = await response.json();

      // Extract meaningful sources
      const sources = this.extractSources(data);
      
      return {
        success: true,
        query,
        engine,
        results: data,
        sources,
        textBlocks: data.text_blocks || [],
        shoppingResults: data.shopping_results || [],
        searchMetadata: data.search_metadata || {},
        timestamp: new Date().toISOString(),
        totalTime: data.search_metadata?.total_time_taken
      };
    } catch (error) {
      console.error('SerpAPI search failed:', error.message);
      throw error;
    }
  }

  /**
   * Extract and structure sources from SerpAPI response
   */
  extractSources(data) {
    const sources = [];
    const seenUrls = new Set();

    // From references/news
    if (data.references) {
      data.references.forEach((ref, idx) => {
        if (!seenUrls.has(ref.link)) {
          sources.push({
            id: `ref-${idx}`,
            title: ref.title,
            url: ref.link,
            source: ref.source || 'Unknown',
            snippet: ref.snippet,
            type: 'reference',
            thumbnail: ref.thumbnail,
            sourceIcon: ref.source_icon
          });
          seenUrls.add(ref.link);
        }
      });
    }

    // From shopping results
    if (data.shopping_results) {
      data.shopping_results.forEach((item, idx) => {
        if (!seenUrls.has(item.product_link)) {
          sources.push({
            id: `shop-${idx}`,
            title: item.title,
            url: item.product_link,
            source: 'Google Shopping',
            price: item.price,
            rating: item.rating,
            reviews: item.reviews,
            type: 'product',
            thumbnail: item.thumbnail
          });
          seenUrls.add(item.product_link);
        }
      });
    }

    // From related questions (for potential follow-ups)
    if (data.related_questions) {
      data.relatedQuestions = data.related_questions.map((q, idx) => ({
        id: `question-${idx}`,
        question: q.question,
        serpapi_link: q.serpapi_link
      }));
    }

    return sources;
  }

  /**
   * Smart research with caching decision
   */
  async smartResearch(query, userId, options = {}) {
    const decision = options.forceSearch ? { decision: 'SEARCH', reason: 'Force search mode enabled' } : await this.shouldSearch(query, userId, options);

    if (!options.forceSearch && (decision.decision === 'USE_CACHE' || decision.decision === 'USE_CACHE_WITH_FLAG')) {
      return {
        source: 'memory',
        decision: decision.decision,
        reason: decision.reason,
        data: decision.cached,
        flaggedForVerification: decision.flaggedForVerification || false,
        timestamp: new Date().toISOString()
      };
    }

    // Need fresh search
    try {
      const searchResult = await this.search(query, options);

      // Save to research memory
      const memoryId = `research_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const queryHash = this.getQueryHash(query);

      researchMemoryDb.create(
        memoryId,
        userId,
        query,
        searchResult.results,
        searchResult.sources,
        {
          summary: this.generateSummary(searchResult),
          category: options.category || 'general',
          confidence: 95, // Fresh search = high confidence
          searchEngine: options.engine || (searchResult.isMock ? 'mock' : 'serpapi'),
          totalTime: searchResult.totalTime,
          ttl: options.ttl || 7 * 24 * 60 * 60 * 1000
        }
      );

      return {
        source: 'fresh_search',
        decision: 'SEARCH_EXECUTED',
        reason: 'New search performed',
        data: {
          ...searchResult,
          memoryId: memoryId,
          queryHash: queryHash
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // Fallback to cache if search fails
      if (decision.cached) {
        console.warn('Search failed, falling back to cache:', error.message);
        return {
          source: 'memory_fallback',
          decision: 'FALLBACK_TO_CACHE',
          reason: `Search failed, using cached data: ${error.message}`,
          data: decision.cached,
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
      throw error;
    }
  }

  /**
   * Generate summary from search results
   */
  generateSummary(searchResult) {
    if (searchResult.textBlocks && searchResult.textBlocks.length > 0) {
      const firstBlock = searchResult.textBlocks.find(b => b.type === 'paragraph');
      if (firstBlock) return firstBlock.snippet.substring(0, 300);
    }
    if (searchResult.sources && searchResult.sources.length > 0) {
      return searchResult.sources[0].snippet || searchResult.sources[0].title;
    }
    return 'Research data retrieved';
  }

  /**
   * Format search results for AI context
   */
  formatForAIContext(searchData, maxTokens = 3000) {
    let context = '';
    let tokenCount = 0;
    const estimateTokens = (text) => Math.ceil(text.length / 4);

    // Add main text blocks
    if (searchData.textBlocks) {
      for (const block of searchData.textBlocks) {
        if (block.type === 'paragraph') {
          const text = `${block.snippet}\n\n`;
          const tokens = estimateTokens(text);
          if (tokenCount + tokens > maxTokens) break;
          context += text;
          tokenCount += tokens;
        }
      }
    }

    // Add sources
    if (searchData.sources && searchData.sources.length > 0) {
      context += '\n## Sources:\n';
      for (const source of searchData.sources.slice(0, 5)) {
        const text = `- [${source.title}](${source.url}) - ${source.source}\n`;
        const tokens = estimateTokens(text);
        if (tokenCount + tokens > maxTokens) break;
        context += text;
        tokenCount += tokens;
      }
    }

    return {
      context,
      tokenCount,
      truncated: tokenCount >= maxTokens
    };
  }

  /**
   * Clean up expired research memory (call periodically)
   */
  cleanupExpiredMemory() {
    return researchMemoryDb.cleanExpired();
  }

  /**
   * Generate mock search results for development (when SERPAPI_KEY is not configured)
   */
  getMockSearchResults(query) {
    const mockResults = {
      'AI': [
        {
          title: 'Latest AI Breakthroughs in 2026',
          source: 'TechCrunch',
          type: 'news',
          snippet: 'Leading AI models have achieved significant advances in reasoning and multimodal capabilities. OpenAI, Google DeepMind, and other organizations continue pushing boundaries.',
          url: 'https://techcrunch.com/ai-2026',
          favicon: '🔍'
        },
        {
          title: 'AI Safety and Alignment Updates',
          source: 'ArXiv',
          type: 'research',
          snippet: 'New research on AI alignment has shown promise in creating more interpretable and controllable AI systems.',
          url: 'https://arxiv.org/ai',
          favicon: '📚'
        },
        {
          title: 'Enterprise AI Adoption Trends',
          source: 'Forbes',
          type: 'article',
          snippet: 'Companies are increasingly deploying AI for process automation, customer service, and data analysis.',
          url: 'https://forbes.com/ai-trends',
          favicon: '📰'
        }
      ],
      'default': [
        {
          title: 'Search Results for: ' + query,
          source: 'Development Mock',
          type: 'info',
          snippet: 'Research feature is in development. Configure SERPAPI_KEY in .env to enable real web search.',
          url: '#',
          favicon: '💡'
        }
      ]
    };

    const results = mockResults[query.includes('AI') || query.includes('ai') ? 'AI' : 'default'];
    return {
      success: true,
      results: results,
      sources: results,
      textBlocks: [{
        type: 'paragraph',
        snippet: `Development mode: Using mock results for "${query}". To enable real search, configure SERPAPI_KEY.`
      }],
      totalTime: 200,
      isMock: true
    };
  }
}

export const researchService = new ResearchService();
