/**
 * Memory Extraction Service
 * Automatically extracts conclusions and important information from conversations
 * and stores them in long-term memory for AI context
 */

import { memoryDb } from './database.js';
import { v4 as uuidv4 } from 'uuid';

class MemoryExtractionService {
  /**
   * Extract key conclusions from a conversation
   * This analyzes the conversation for important facts, preferences, and conclusions
   */
  static extractConclusions(messages) {
    if (!messages || messages.length < 2) return [];

    const conclusions = [];
    let conversationText = messages
      .map(m => `${m.sender === 'user' ? 'User' : 'AI'}: ${m.text}`)
      .join('\n\n');

    // Pattern-based extraction of important information
    const patterns = [
      {
        regex: /(?:i like|i prefer|i enjoy|my favorite|i love|i'm interested in|i'm passionate about)[:\s]+([^.!?\n]+)/gi,
        category: 'Preferences',
        label: 'User prefers'
      },
      {
        regex: /(?:i work|i'm employed|i'm a|my job|my profession|i do)[:\s]+([^.!?\n]+)/gi,
        category: 'Work',
        label: 'User works as'
      },
      {
        regex: /(?:i live in|i'm from|i'm based in|my location|i reside in)[:\s]+([^.!?\n]+)/gi,
        category: 'Location',
        label: 'User location'
      },
      {
        regex: /(?:i have|i own|my skills include|i can|i'm skilled in)[:\s]+([^.!?\n]+)/gi,
        category: 'Skills',
        label: 'User skills'
      },
      {
        regex: /(?:i need|i want|i'm looking for|i'm trying to|i'm trying to learn)[:\s]+([^.!?\n]+)/gi,
        category: 'Goals',
        label: 'User goals'
      },
      {
        regex: /(?:the solution is|the answer is|therefore|in conclusion|so)[:\s]+([^.!?\n]+)/gi,
        category: 'Conclusions',
        label: 'Conclusion'
      }
    ];

    const seenSummaries = new Set();
    const maxConclusionsPerPattern = 2;
    const maxTotalConclusions = 10;

    for (const pattern of patterns) {
      if (conclusions.length >= maxTotalConclusions) break;
      
      let match;
      let patternCount = 0;
      while ((match = pattern.regex.exec(conversationText)) !== null && patternCount < maxConclusionsPerPattern) {
        if (conclusions.length >= maxTotalConclusions) break;
        
        const summary = `${pattern.label}: ${match[1].trim()}`;
        
        if (summary.length > 10 && summary.length < 500 && !seenSummaries.has(summary.toLowerCase())) {
          seenSummaries.add(summary.toLowerCase());
          conclusions.push({
            summary,
            category: pattern.category,
            confidence: 0.8
          });
          patternCount++;
        }
      }
    }

    return conclusions;
  }

  /**
   * Save extracted conclusions to long-term memory
   */
  static saveConclusions(conclusions, userId, sessionId) {
    if (!conclusions || conclusions.length === 0) return [];

    const savedMemories = [];
    
    for (const conclusion of conclusions) {
      try {
        const memoryId = uuidv4();
        const memory = memoryDb.create(
          memoryId,
          userId,
          conclusion.summary,
          conclusion.category,
          sessionId
        );
        
        if (memory) {
          savedMemories.push(memory);
          console.log(`[MEMORY] Saved: ${conclusion.summary}`);
        }
      } catch (err) {
        console.error('[MEMORY] Error saving conclusion:', err);
      }
    }

    return savedMemories;
  }

  /**
   * Extract and automatically save conclusions from a conversation
   */
  static async processConversation(messages, userId, sessionId) {
    try {
      const conclusions = this.extractConclusions(messages, userId, sessionId);
      if (conclusions.length > 0) {
        const saved = this.saveConclusions(conclusions, userId, sessionId);
        console.log(`[MEMORY] Processed ${saved.length} conclusions from session ${sessionId}`);
        return saved;
      }
    } catch (err) {
      console.error('[MEMORY] Error processing conversation:', err);
    }
    return [];
  }

  static memoryContextCache = new Map();

  /**
   * Get formatted long-term memories for use in AI system prompt
   * Includes basic caching to avoid repeated DB queries
   */
  static getMemoriesForContext(userId, limit = 10) {
    try {
      const cacheKey = `${userId}_${limit}`;
      const cached = this.memoryContextCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < 5 * 60 * 1000) {
        return cached.data;
      }

      const memories = memoryDb.findByUser(userId, limit);
      
      if (!memories || memories.length === 0) {
        return '';
      }

      let contextText = '\n\n### USER LONG-TERM MEMORY (from previous conversations)\n';
      const grouped = {};

      memories.forEach(mem => {
        const cat = mem.category || 'Other';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(mem.summary);
      });

      for (const [category, items] of Object.entries(grouped)) {
        contextText += `\n**${category}:**\n`;
        items.slice(0, 3).forEach(item => {
          contextText += `- ${item}\n`;
        });
      }

      this.memoryContextCache.set(cacheKey, {
        data: contextText,
        timestamp: Date.now()
      });

      return contextText;
    } catch (err) {
      console.error('[MEMORY] Error getting memories for context:', err);
      return '';
    }
  }
}

export default MemoryExtractionService;
