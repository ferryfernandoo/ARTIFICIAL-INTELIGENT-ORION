/**
 * Frontend Research Service
 * Integrates with backend research API for smart caching and source visualization
 */

class ResearchService {
  constructor() {
    this.baseUrl = 'http://localhost:3001/api/research';
    this.cache = new Map();
    // Generate anonymous user ID for research memory
    this.anonymousUserId = this.getOrCreateAnonymousId();
  }

  /**
   * Get or create anonymous user ID (stored in localStorage)
   */
  getOrCreateAnonymousId() {
    let id = localStorage.getItem('research_anonymous_id');
    if (!id) {
      id = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('research_anonymous_id', id);
    }
    return id;
  }

  /**
   * Perform smart research (auto-decides cache vs search)
   */
  async smartSearch(query, options = {}) {
    const userId = options.userId || this.anonymousUserId;
    try {
      const response = await fetch(`${this.baseUrl}/smart-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, userId, options })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data.result || data;
    } catch (error) {
      console.error('Smart search failed:', error);
      throw error;
    }
  }

  /**
   * Direct search without caching logic
   */
  async directSearch(query, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/direct-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, options })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Direct search failed:', error);
      throw error;
    }
  }

  /**
   * Format search results for AI context
   */
  async formatContextForAI(searchData, maxTokens = 3000) {
    try {
      const response = await fetch(`${this.baseUrl}/format-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchData, maxTokens })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Format context failed:', error);
      throw error;
    }
  }

  /**
   * Generate comprehensive research prompt
   */
  async generateResearchPrompt(query, searchData, cachedContext = '') {
    try {
      const response = await fetch(`${this.baseUrl}/generate-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, searchData, cachedContext })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Generate prompt failed:', error);
      throw error;
    }
  }

  /**
   * Get cached research memory
   */
  async getCachedResearch(userId, category = null, limit = 50) {
    try {
      const params = new URLSearchParams({ limit });
      if (category) params.append('category', category);

      const response = await fetch(`${this.baseUrl}/memory/${userId}?${params}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Get cached research failed:', error);
      throw error;
    }
  }

  /**
   * Format sources for visual display
   */
  formatSourcesForDisplay(sources = []) {
    return sources.map((source, idx) => ({
      id: source.id || `source-${idx}`,
      title: source.title,
      url: source.url,
      source: source.source,
      type: source.type,
      icon: this.getSourceIcon(source.source),
      thumbnail: source.thumbnail,
      snippet: source.snippet,
      credibility: this.calculateCredibility(source),
      domain: new URL(source.url).hostname
    }));
  }

  /**
   * Get icon emoji for source
   */
  getSourceIcon(sourceName = '') {
    const icons = {
      'Google': '🔍',
      'Google Shopping': '🛒',
      'BBC': '📺',
      'Reuters': '📰',
      'AP': '📰',
      'CNN': '📺',
      'Food Network': '🍽️',
      'Wikipedia': '📖',
      'Medium': '📝',
      'GitHub': '💻',
      'Stack Overflow': '💻',
      'Twitter': '𝕏',
      'TechCrunch': '💼',
      'ArXiv': '📚',
      'Nature': '🧬',
      'Science': '🔬',
      'Instagram': '📸',
      'LinkedIn': '💼',
      'Reddit': '🔗',
      'YouTube': '▶️'
    };

    for (const [key, icon] of Object.entries(icons)) {
      if (sourceName.includes(key)) return icon;
    }

    return '📄';
  }

  /**
   * Calculate credibility score (0-100)
   */
  calculateCredibility(source) {
    let score = 70;

    const majorSources = [
      'BBC', 'Reuters', 'AP', 'NPR', 'Guardian', 
      'New York Times', 'Washington Post', 'Financial Times', 'The Economist'
    ];

    if (majorSources.some(s => source.source?.includes(s))) score += 20;

    if (source.type === 'product') score -= 10;
    if (source.type === 'reference') score += 10;
    if (source.type === 'news') score += 15;

    if (source.snippet && source.snippet.length > 100) score += 5;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Get average credibility of all sources
   */
  getAverageCredibility(sources = []) {
    if (sources.length === 0) return 0;
    const total = sources.reduce((sum, s) => sum + this.calculateCredibility(s), 0);
    return Math.round(total / sources.length);
  }
}

export const researchService = new ResearchService();
