/**
 * Sophisticated Memory System for Context Awareness
 * - Stores user preferences and important facts across conversations
 * - Uses semantic search to retrieve relevant memories
 * - Token-efficient (500-800 tokens budgeted)
 * - Cross-room memory references with timestamps
 */

const MEMORY_KEY = 'orion_memory_system';
const MAX_MEMORIES = 100;
const MEMORY_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Memory structure:
 * {
 *   id: string,
 *   type: 'preference' | 'fact' | 'pattern' | 'context',
 *   content: string,
 *   conversationId: string,
 *   timestamp: number,
 *   weight: number (0-1), // importance score
 *   tags: string[], // keywords for search
 *   accessCount: number,
 *   embedding: number[] // simple semantic embedding
 * }
 */

class MemoryService {
  constructor() {
    this.memories = this.loadMemories();
  }

  /**
   * Load all memories from localStorage
   */
  loadMemories() {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    try {
      const stored = localStorage.getItem(MEMORY_KEY);
      if (!stored) return [];
      
      try {
        const memories = JSON.parse(stored);
        // Clean expired memories
        return memories.filter(m => m && typeof m.timestamp === 'number' && Date.now() - m.timestamp < MEMORY_TTL);
      } catch (parseError) {
        console.error('Error parsing memory storage:', parseError);
        localStorage.removeItem(MEMORY_KEY);
        return [];
      }
    } catch (e) {
      console.error('Error loading memories:', e);
      return [];
    }
  }

  /**
   * Save all memories to localStorage
   */
  saveMemories() {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      // Keep only top memories by weight and access count to save space
      const prioritized = this.memories
        .sort((a, b) => (b.weight * b.accessCount) - (a.weight * a.accessCount))
        .slice(0, MAX_MEMORIES);
      
      localStorage.setItem(MEMORY_KEY, JSON.stringify(prioritized));
    } catch (e) {
      console.error('Error saving memories:', e);
    }
  }

  /**
   * Extract keywords from text (simple tokenization)
   */
  extractKeywords(text) {
    // Ensure text is a string
    if (!text || typeof text !== 'string') {
      return [];
    }
    
    const words = text
      .toLowerCase()
      .match(/\b\w{3,}\b/g) || [];
    
    // Filter common words
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
      'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can',
      'dari', 'ke', 'di', 'yang', 'dan', 'atau', 'untuk', 'dengan', 'adalah',
      'saya', 'anda', 'mereka', 'kami', 'kita', 'aku', 'kamu', 'dia'
    ]);
    
    return [...new Set(words.filter(w => !stopWords.has(w)))];
  }

  /**
   * Simple embedding using keyword frequency
   * Returns vector of top keywords with frequency scores
   */
  createEmbedding(text, keywords) {
    // Ensure text is a string
    if (!text || typeof text !== 'string') {
      return [];
    }
    
    const freq = {};
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    
    words.forEach(w => {
      freq[w] = (freq[w] || 0) + 1;
    });
    
    return keywords
      .slice(0, 20)
      .map(k => freq[k] || 0)
      .map(f => f / (words.length || 1));
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(emb1, emb2) {
    const maxLen = Math.max(emb1.length, emb2.length);
    const a = [...emb1, ...Array(maxLen - emb1.length).fill(0)];
    const b = [...emb2, ...Array(maxLen - emb2.length).fill(0)];
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < maxLen; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Extract important information from a conversation
   * Returns array of potential memories to store
   */
  extractMemories(messages, conversationId, _language = 'en') {
    const extracted = [];
    
    messages.forEach((msg) => {
      if (msg.sender === 'user' && msg.text.length > 20) {
        const keywords = this.extractKeywords(msg.text);
        
        // Rules for what to remember
        // 1. User preferences (I like, I prefer, I want)
        if (/\b(like|prefer|want|need|love|hate|dislike)\b/i.test(msg.text)) {
          extracted.push({
            type: 'preference',
            content: msg.text,
            weight: 0.9,
            keywords
          });
        }
        
        // 2. User facts (I'm, I have, I work, I'm from)
        if (/\b(im|im|i'm|i have|i work|i'm from|i live)\b/i.test(msg.text) ||
            /\b(saya|punya|bekerja|dari|tinggal)\b/i.test(msg.text)) {
          extracted.push({
            type: 'fact',
            content: msg.text,
            weight: 0.85,
            keywords
          });
        }
        
        // 3. Context patterns (when, how often, usually)
        if (/\b(when|how often|usually|always|never|daily|weekly|context)\b/i.test(msg.text) ||
            /\b(kapan|berapa sering|biasanya|selalu|tidak pernah|setiap)\b/i.test(msg.text)) {
          extracted.push({
            type: 'pattern',
            content: msg.text,
            weight: 0.75,
            keywords
          });
        }
        
        // 4. Important context (long and specific messages)
        if (msg.text.length > 100 && keywords.length > 5) {
          extracted.push({
            type: 'context',
            content: msg.text.substring(0, 200), // Limit length
            weight: 0.6,
            keywords: keywords.slice(0, 10)
          });
        }
      }
    });
    
    return extracted;
  }

  /**
   * Add a new memory
   */
  addMemory(memory, conversationId, currentLanguage = 'en') {
    const keywords = memory.keywords || this.extractKeywords(memory.content);
    const embedding = this.createEmbedding(memory.content, keywords);
    
    const newMemory = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: memory.type || 'context',
      content: memory.content,
      conversationId,
      timestamp: Date.now(),
      weight: memory.weight || 0.7,
      tags: keywords,
      accessCount: 0,
      embedding,
      language: currentLanguage,
      metadata: memory.metadata || null,
      sources: memory.sources || null,
    };
    
    this.memories.push(newMemory);
    
    // Remove duplicates (same content or very similar)
    this.memories = this.deduplicateMemories();
    
    // Keep memory size manageable
    if (this.memories.length > MAX_MEMORIES) {
      this.memories.sort((a, b) => (b.weight * b.accessCount) - (a.weight * a.accessCount));
      this.memories = this.memories.slice(0, MAX_MEMORIES);
    }
    
    this.saveMemories();
    return newMemory;
  }

  /**
   * Remove duplicate or very similar memories
   */
  deduplicateMemories() {
    const unique = [];
    
    this.memories.forEach((mem) => {
      let isDuplicate = false;
      
      for (let i = 0; i < unique.length; i++) {
        const sim = this.cosineSimilarity(mem.embedding, unique[i].embedding);
        // If similarity too high (>0.8) or exact same content, mark as duplicate
        if (sim > 0.8 || mem.content === unique[i].content) {
          // Keep the one with higher weight
          if (mem.weight > unique[i].weight) {
            unique.splice(i, 1);
          } else {
            isDuplicate = true;
          }
          break;
        }
      }
      
      if (!isDuplicate) {
        unique.push(mem);
      }
    });
    
    return unique;
  }

  /**
   * Search memories by topic using semantic similarity
   * Returns top N most relevant memories
   */
  searchMemories(query, limit = 5, currentConversationId = null, includeCurrentConversation = false) {
    if (this.memories.length === 0) return [];
    
    const queryKeywords = this.extractKeywords(query);
    const queryEmbedding = this.createEmbedding(query, queryKeywords);
    
    // Score each memory
    const scored = this.memories
      .filter(m => includeCurrentConversation ? true : (m.conversationId !== currentConversationId))
      .map(mem => {
        // Semantic similarity
        const semantic = this.cosineSimilarity(queryEmbedding, mem.embedding);
        
        // Keyword overlap
        const keywordOverlap = queryKeywords.filter(k => mem.tags.includes(k)).length;
        const keywordScore = keywordOverlap / Math.max(queryKeywords.length, mem.tags.length);
        
        // Combined score
        const score = (semantic * 0.6) + (keywordScore * 0.4);
        
        // Boost by recency and weight
        const recencyBoost = Math.max(0, 1 - (Date.now() - mem.timestamp) / MEMORY_TTL);
        const finalScore = (score * 0.7) + (mem.weight * 0.2) + (recencyBoost * 0.1);
        
        return { memory: mem, score: finalScore };
      })
      .filter(item => item.score > 0.2) // Threshold
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    // Update access count
    scored.forEach(item => {
      item.memory.accessCount += 1;
    });
    
    this.saveMemories();
    
    return scored.map(item => item.memory);
  }

  /**
   * Create a short summary for a block of conversation messages
   */
  createConversationSummaryBlock(messages, blockIndex = 0, language = 'en') {
    const userTexts = messages
      .filter(msg => msg.sender === 'user' && msg.text)
      .map(msg => msg.text.trim())
      .join(' ');
    const aiTexts = messages
      .filter(msg => msg.sender !== 'user' && msg.text)
      .map(msg => msg.text.trim())
      .join(' ');
    
    const trimmedUser = userTexts.split(/[.?!]\s*/)[0].trim();
    const trimmedAi = aiTexts.split(/[.?!]\s*/).filter(Boolean).slice(-1)[0] || '';
    const keywords = this.extractKeywords(`${userTexts} ${aiTexts}`).slice(0, 6);
    const topic = keywords.length ? keywords.join(', ') : (language === 'id' ? 'topik penting' : 'important topic');
    const userSummary = trimmedUser.length > 120 ? `${trimmedUser.substring(0, 117)}...` : trimmedUser;
    const aiSummary = trimmedAi.length > 120 ? `${trimmedAi.substring(0, 117)}...` : trimmedAi;
    
    if (!userSummary && !aiSummary) return null;
    
    if (language === 'id') {
      return `Ringkasan 10 chat #${blockIndex + 1}: User menanyakan "${userSummary || 'topik percakapan'}". Orion menjawab dengan fokus pada ${topic}.`;
    }
    return `Summary of 10 chats #${blockIndex + 1}: User asked "${userSummary || 'the topic'}". Orion answered focusing on ${topic}.`;
  }

  /**
   * Save chunk summaries into memory for the current conversation
   */
  processConversationSummaries(messages, conversationId, language = 'en') {
    if (!conversationId || !messages || !messages.length) return 0;

    const textMessages = messages.filter(msg => msg.text && msg.sender);
    if (textMessages.length < 10) return 0;

    const blockCount = Math.floor(textMessages.length / 10);
    let savedCount = 0;

    for (let i = 0; i < blockCount; i++) {
      const blockMessages = textMessages.slice(i * 10, (i + 1) * 10);
      if (blockMessages.length < 8) continue;

      const summaryText = this.createConversationSummaryBlock(blockMessages, i, language);
      if (!summaryText) continue;

      const alreadySaved = this.memories.some(mem => mem.conversationId === conversationId && mem.type === 'summary' && mem.content === summaryText);
      if (alreadySaved) continue;

      this.addMemory({
        type: 'summary',
        content: summaryText,
        weight: 0.95,
        keywords: this.extractKeywords(summaryText),
      }, conversationId, language);

      savedCount += 1;
    }

    return savedCount;
  }

  /**
   * Get conversation summaries for current conversation
   */
  getConversationSummaries(conversationId, limit = 3) {
    if (!conversationId) return [];

    return this.memories
      .filter(mem => mem.conversationId === conversationId && mem.type === 'summary')
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get formatted summary context for current conversation
   */
  getConversationSummaryContext(conversationId, language = 'en', limit = 3) {
    const summaries = this.getConversationSummaries(conversationId, limit);
    if (summaries.length === 0) return '';

    let context = language === 'id'
      ? '\n📌 RINGKASAN CHAT SEBELUMNYA:\n'
      : '\n📌 PREVIOUS CHAT SUMMARIES:\n';

    summaries.forEach(mem => {
      const summaryText = mem.content.substring(0, 120) + (mem.content.length > 120 ? '...' : '');
      context += `• ${summaryText}\n`;
    });

    return context;
  }

  /**
   * Get memory context for current conversation
   * Returns relevant memories formatted for prompt, including prior search results
   */
  getMemoryContext(currentQuery, currentConversationId, language = 'en') {
    const relevantMemories = this.searchMemories(currentQuery, 5, currentConversationId, true);
    
    if (relevantMemories.length === 0) return '';
    
    // Group by type
    const byType = {};
    relevantMemories.forEach(mem => {
      if (!byType[mem.type]) byType[mem.type] = [];
      byType[mem.type].push(mem);
    });
    
    // Format for prompt (token-efficient)
    let context = language === 'id' 
      ? `\n📚 MEMORI KONTEKS DARI CHAT SEBELUMNYA:\n`
      : `\n📚 RELEVANT CONTEXT FROM PREVIOUS CHATS:\n`;
    
    Object.entries(byType).forEach(([type, mems]) => {
      const typeLabel = {
        preference: language === 'id' ? 'Preferensi Pengguna' : 'User Preferences',
        fact: language === 'id' ? 'Fakta Penting' : 'Important Facts',
        pattern: language === 'id' ? 'Pola/Kebiasaan' : 'Patterns/Habits',
        summary: language === 'id' ? 'Ringkasan Obrolan' : 'Chat Summaries',
        context: language === 'id' ? 'Konteks Lainnya' : 'Other Context',
        search: language === 'id' ? 'Hasil Pencarian Web' : 'Search Results'
      }[type] || type;
      
      context += `\n[${typeLabel}]\n`;
      
      mems.slice(0, 2).forEach(mem => {
        const date = new Date(mem.timestamp).toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US');
        const summary = mem.content.substring(0, 80) + (mem.content.length > 80 ? '...' : '');
        context += `• ${summary} (${date})\n`;
      });
    });
    
    return context;
  }

  /**
   * Extract and store memories from a completed conversation
   */
  processConversation(messages, conversationId, language = 'en') {
    const extracted = this.extractMemories(messages, conversationId, language);
    
    extracted.forEach(mem => {
      this.addMemory(mem, conversationId, language);
    });
    
    const summaryCount = this.processConversationSummaries(messages, conversationId, language);
    if (summaryCount > 0) {
      console.log(`[MemoryService] Saved ${summaryCount} chat summary memory blocks for conversation ${conversationId}`);
    }
    
    return extracted.length + summaryCount;
  }

  /**
   * Get cross-room knowledge context (from other conversations)
   * Helps AI understand context from other rooms for more natural responses
   */
  getCrossRoomContext(currentConversationId, language = 'en', limit = 5) {
    // Get memories from OTHER conversations (not current one)
    // Prioritize 'preference' and 'fact' types as they describe the user/important context
    const otherRoomMemories = this.memories
      .filter(mem => mem.conversationId && mem.conversationId !== currentConversationId)
      .sort((a, b) => {
        // Priority: preference and fact types first (user identity), then by weight, then by recency
        const typeScore = {
          preference: 3,
          fact: 2,
          pattern: 1,
          context: 0
        };
        const scoreA = typeScore[a.type] || 0;
        const scoreB = typeScore[b.type] || 0;
        
        if (scoreA !== scoreB) return scoreB - scoreA;
        if (a.weight !== b.weight) return b.weight - a.weight;
        return b.timestamp - a.timestamp;
      })
      .slice(0, limit);
    
    if (otherRoomMemories.length === 0) return '';
    
    // Format cross-room knowledge - emphasize user profiling
    let context = language === 'id'
      ? `\n🌐 TENTANG ANDA (DARI CHAT SEBELUMNYA):\n`
      : `\n🌐 ABOUT YOU (FROM PREVIOUS CHATS):\n`;
    
    otherRoomMemories.forEach(mem => {
      const type = {
        preference: language === 'id' ? 'Preferensi' : 'Preference',
        fact: language === 'id' ? 'Fakta' : 'Fact',
        pattern: language === 'id' ? 'Pola' : 'Pattern',
        context: language === 'id' ? 'Konteks' : 'Context'
      }[mem.type] || mem.type;
      
      const summary = mem.content.substring(0, 60) + (mem.content.length > 60 ? '...' : '');
      context += `• [${type}] ${summary}\n`;
    });
    
    return context;
  }

  /**
   * Get all memories summary
   */
  getSummary() {
    const byType = {};
    this.memories.forEach(mem => {
      byType[mem.type] = (byType[mem.type] || 0) + 1;
    });
    
    return {
      totalMemories: this.memories.length,
      byType,
      oldestMemory: this.memories.length > 0 ? Math.min(...this.memories.map(m => m.timestamp)) : null,
      newestMemory: this.memories.length > 0 ? Math.max(...this.memories.map(m => m.timestamp)) : null
    };
  }

  /**
   * Clear all memories
   */
  clearMemories() {
    this.memories = [];
    localStorage.removeItem(MEMORY_KEY);
  }
}

// Export singleton instance
export const memoryService = new MemoryService();
export default MemoryService;
