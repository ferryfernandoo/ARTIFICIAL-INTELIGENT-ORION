/**
 * Retrieval-Augmented Generation (RAG) Service - Backend
 * Loads knowledge base and provides context retrieval for API responses
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class RAGService {
  constructor() {
    this.knowledgeBase = [];
    this.index = new Map(); // namespace -> documents
    this.queryCache = new Map(); // cache for queries
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    this.vocabularyLimit = 256;
    this.chunkSize = 800;
    this.initialized = false;
  }

  /**
   * Load knowledge base from JSON file
   */
  async loadKnowledgeBase(datasource = null) {
    try {
      const filePath = datasource || 
        path.join(__dirname, '..', 'data', 'datasets', 'orion_dataset.json');

      if (!fs.existsSync(filePath)) {
        console.error(`❌ RAG: Knowledge base not found at ${filePath}`);
        return false;
      }

      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(fileContent);

      if (!Array.isArray(data)) {
        console.error('❌ RAG: Knowledge base is not an array');
        return false;
      }

      this.knowledgeBase = data;
      this.indexDocuments(data.map(doc => ({
        id: doc.id,
        title: doc.title,
        text: doc.text,
        namespace: 'knowledge_base'
      })));

      this.initialized = true;
      console.log(`✅ RAG: Loaded ${data.length} knowledge base documents`);
      return true;
    } catch (error) {
      console.error('❌ RAG Error:', error.message);
      return false;
    }
  }

  /**
   * Index documents with TF-IDF + BM25 scoring
   */
  indexDocuments(documents) {
    if (!this.index.has('knowledge_base')) {
      this.index.set('knowledge_base', []);
    }

    const namespace = 'knowledge_base';
    const docs = this.index.get(namespace);

    for (const doc of documents) {
      // Extract vocabulary (split into words, normalize)
      const tokens = this.tokenize(doc.text);
      const vocabulary = [...new Set(tokens)].slice(0, this.vocabularyLimit);

      docs.push({
        ...doc,
        tokens: tokens,
        vocabulary: vocabulary,
        termFreq: this.calculateTermFrequency(tokens)
      });
    }
  }

  /**
   * Search for relevant documents
   */
  search(query, topK = 3, namespace = 'knowledge_base') {
    if (!this.initialized) {
      return [];
    }

    // Check cache first
    const cacheKey = `${namespace}:${query}`;
    const cached = this.queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.results;
    }

    const docs = this.index.get(namespace) || [];
    if (docs.length === 0) {
      return [];
    }

    const queryTokens = this.tokenize(query);
    const results = [];

    for (const doc of docs) {
      const score = this.calculateRelevanceScore(queryTokens, doc);
      results.push({
        doc: {
          id: doc.id,
          title: doc.title,
          content: doc.text
        },
        score: score
      });
    }

    // Sort by score and return top K
    const sorted = results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    // Cache results
    this.queryCache.set(cacheKey, {
      results: sorted,
      timestamp: Date.now()
    });

    return sorted;
  }

  /**
   * Calculate relevance score using TF-IDF + cosine similarity
   */
  calculateRelevanceScore(queryTokens, doc) {
    if (!queryTokens.length || !doc.tokens || !doc.tokens.length) {
      return 0;
    }

    // TF-IDF component
    let tfidfScore = 0;
    const docLength = doc.tokens.length;

    for (const token of queryTokens) {
      const termFreq = (doc.termFreq[token] || 0) / docLength;
      // IDF approximation: log(total_docs / docs_with_term)
      const idf = Math.log(doc.vocabulary.length + 1);
      tfidfScore += termFreq * idf;
    }

    // BM25-like boost
    const intersectionSize = queryTokens.filter(t => doc.vocabulary.includes(t)).length;
    const bm25Boost = (intersectionSize / Math.max(queryTokens.length, 1)) * 2;

    // Cosine similarity component
    const querySet = new Set(queryTokens);
    const docSet = new Set(doc.vocabulary);
    const intersection = [...querySet].filter(t => docSet.has(t)).length;
    const cosineSimilarity = intersection / Math.sqrt(querySet.size * docSet.size || 1);

    // Combined score
    const score = (tfidfScore * 0.4) + (bm25Boost * 0.3) + (cosineSimilarity * 0.3);
    return score;
  }

  /**
   * Tokenize text - split into words, lowercase, remove common words
   */
  tokenize(text) {
    const stopwords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'adalah', 'dan', 'atau', 'dalam', 'pada', 'di', 'ke', 'dari', 'yang', 'ini',
      'itu', 'be', 'is', 'are', 'was', 'were'
    ]);

    return text
      .toLowerCase()
      .match(/\b\w+\b/g)
      ?.filter(word => !stopwords.has(word)) || [];
  }

  /**
   * Calculate term frequency for each token
   */
  calculateTermFrequency(tokens) {
    const freq = {};
    for (const token of tokens) {
      freq[token] = (freq[token] || 0) + 1;
    }
    return freq;
  }

  /**
   * Format retrieved context for prompt injection
   */
  formatContextForPrompt(searchResults, maxTokens = 1000) {
    if (!searchResults || searchResults.length === 0) {
      return '';
    }

    let context = 'KNOWLEDGE BASE CONTEXT (untuk referensi):\n\n';
    let tokenEstimate = 0;
    const tokenPerChar = 0.25; // rough estimate

    for (const result of searchResults) {
      const doc = result.doc || result;
      const title = doc.title || 'Unknown';
      const content = doc.content || doc.text || '';
      const chunk = `[${title}]\n${content}\n`;
      const chunkTokens = Math.ceil(chunk.length * tokenPerChar);

      if (tokenEstimate + chunkTokens > maxTokens) {
        break;
      }

      context += chunk + '\n---\n\n';
      tokenEstimate += chunkTokens;
    }

    return context.trim() ? context : '';
  }

  /**
   * Inject RAG context into messages before sending to LLM
   */
  injectContext(messages, ragContext) {
    if (!ragContext || !ragContext.trim()) {
      return messages;
    }

    // Find the last user message
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        messages[i].content = `${messages[i].content}\n\n${ragContext}`;
        break;
      }
    }

    return messages;
  }
}

export default new RAGService();
