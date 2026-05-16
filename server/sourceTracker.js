/**
 * Source Tracker Service
 * Tracks and manages sources from financial data and web searches
 */

class SourceTracker {
  constructor() {
    this.sources = new Map(); // conversationId -> Array of sources
  }

  /**
   * Add sources from a financial query
   * @param {string} conversationId - Chat session ID
   * @param {string} query - User query
   */
  addFinancialSources(conversationId, query) {
    if (!this.sources.has(conversationId)) {
      this.sources.set(conversationId, []);
    }

    const sources = this.sources.get(conversationId);
    
    // Add Bitcoin price source
    if (query.toLowerCase().includes('btc') || query.toLowerCase().includes('bitcoin')) {
      sources.push({
        id: `src_${Date.now()}_btc`,
        title: '💰 Bitcoin Price Data',
        url: 'https://finance.yahoo.com/quote/BTC-USD',
        type: 'finance_data',
        source: 'Yahoo Finance / yfinance',
        query: query,
        timestamp: new Date().toISOString()
      });
    }

    // Add other crypto sources
    const cryptoMatches = query.match(/ethereum|eth|cardano|ada|solana|sol|ripple|xrp|doge/gi);
    if (cryptoMatches) {
      sources.push({
        id: `src_${Date.now()}_crypto`,
        title: '💱 Cryptocurrency Data',
        url: 'https://www.coingecko.com',
        type: 'crypto_data',
        source: 'CoinGecko (Free API)',
        query: query,
        timestamp: new Date().toISOString()
      });
    }

    // Add stock sources
    const stockMatches = query.match(/BBCA|TLKM|BMRI|BBRI|MSFT|AAPL|GOOGL|TSLA/gi);
    if (stockMatches) {
      sources.push({
        id: `src_${Date.now()}_stock`,
        title: '📈 Stock Price Data',
        url: 'https://finance.yahoo.com',
        type: 'stock_data',
        source: 'Yahoo Finance',
        query: query,
        timestamp: new Date().toISOString()
      });
    }

    // Add macro indicators
    if (query.toLowerCase().includes('gdp') || query.toLowerCase().includes('inflasi') || query.toLowerCase().includes('inflation')) {
      sources.push({
        id: `src_${Date.now()}_macro`,
        title: '📊 Macro Economic Data',
        url: 'https://fred.stlouisfed.org',
        type: 'macro_data',
        source: 'Federal Reserve Economic Data (FRED)',
        query: query,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Add web search sources
   * @param {string} conversationId - Chat session ID
   * @param {string} query - Search query
   * @param {Array} searchResults - Array of {title, url, source}
   */
  addWebSearchSources(conversationId, query, searchResults = []) {
    if (!this.sources.has(conversationId)) {
      this.sources.set(conversationId, []);
    }

    const sources = this.sources.get(conversationId);
    
    searchResults.forEach((result, idx) => {
      sources.push({
        id: `src_${Date.now()}_web_${idx}`,
        title: result.title || 'Web Search Result',
        url: result.url || 'https://duckduckgo.com',
        type: 'web_search',
        source: result.source || 'DuckDuckGo',
        description: result.description || '',
        query: query,
        timestamp: result.timestamp || new Date().toISOString()
      });
    });
  }

  /**
   * Get all sources for a conversation
   * @param {string} conversationId - Chat session ID
   * @returns {Array} Array of sources
   */
  getSources(conversationId) {
    return this.sources.get(conversationId) || [];
  }

  /**
   * Get unique sources (no duplicates) for a conversation
   * @param {string} conversationId - Chat session ID
   * @returns {Array} Array of unique sources
   */
  getUniqueSources(conversationId) {
    const all = this.getSources(conversationId);
    const seen = new Set();
    return all.filter(src => {
      const key = `${src.source}-${src.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Clear sources for a conversation (when chat ends)
   * @param {string} conversationId - Chat session ID
   */
  clearSources(conversationId) {
    this.sources.delete(conversationId);
  }

  /**
   * Format sources for display in chat
   * @param {string} conversationId - Chat session ID
   * @returns {string} Formatted sources HTML
   */
  formatSourcesForDisplay(conversationId) {
    const sources = this.getUniqueSources(conversationId);
    if (sources.length === 0) return '';

    let html = '<div class="message-sources"><strong>📚 Sumber Informasi:</strong><ul>';
    sources.forEach((src) => {
      const icon = this.getSourceIcon(src.type);
      html += `<li><a href="#" data-source-id="${src.id}" class="source-link">${icon} ${src.source}</a></li>`;
    });
    html += '</ul></div>';
    return html;
  }

  /**
   * Get icon for source type
   * @param {string} type - Source type
   * @returns {string} Icon emoji
   */
  getSourceIcon(type) {
    const icons = {
      finance_data: '💰',
      crypto_data: '💱',
      stock_data: '📈',
      macro_data: '📊',
      web_search: '🔍',
      default: '📎'
    };
    return icons[type] || icons.default;
  }

  /**
   * Get source details by ID
   * @param {string} conversationId - Chat session ID
   * @param {string} sourceId - Source ID
   * @returns {Object} Source details
   */
  getSourceDetails(conversationId, sourceId) {
    const sources = this.getSources(conversationId);
    return sources.find(src => src.id === sourceId) || null;
  }
}

export default new SourceTracker();
