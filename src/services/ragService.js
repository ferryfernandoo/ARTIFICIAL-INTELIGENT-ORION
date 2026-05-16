/**
 * Lightweight RAG (Retrieval-Augmented Generation) service
 * - Indexes plain text documents (title + content)
 * - Chunking, simple keyword-based embeddings, cosine similarity search
 * - Persists index to localStorage under key `orion_rag_index`
 */

const RAG_INDEX_KEY = 'orion_rag_index_v1';
const DEFAULT_CHUNK_SIZE = 800; // chars
const MAX_DOCS = 1000;
const QUERY_CACHE_TTL = 1000 * 60 * 5; // 5 minutes

class RagService {
  constructor() {
    this.index = this.loadIndex();
    this.remoteIndexAttempted = false;
    this.docFreq = {};
    this.idf = {};
    this.vocabList = [];
    this.totalDocs = (this.index.docs || []).length;
    this.queryCache = new Map();
    // Attempt to seed from a server-provided static index (public/rag_index.json)
    // if localStorage doesn't already have an index. This runs async and won't
    // block the app; it will populate the in-memory index when available.
    this.tryLoadRemoteIndex();
  }

  loadIndex() {
    try {
      const raw = localStorage.getItem(RAG_INDEX_KEY);
      if (!raw) return { docs: [] };
      const parsed = JSON.parse(raw);
      const docs = (parsed.docs || []).map((doc) => this.normalizeDoc(doc));
      // build global stats asynchronously
      setTimeout(() => this.buildGlobalStats(), 0);
      return { docs };
    } catch (e) {
      console.error('Failed to load RAG index:', e);
      localStorage.removeItem(RAG_INDEX_KEY);
      return { docs: [] };
    }
  }

  async tryLoadRemoteIndex() {
    if (this.remoteIndexAttempted) return;
    this.remoteIndexAttempted = true;

    try {
      const haveLocal = Array.isArray(this.index?.docs) && this.index.docs.length > 0;
      if (haveLocal) return;

      // Fetch from public folder served by dev server / production static files
      const url = '/rag_index.json';
      const resp = await fetch(url, { cache: 'no-cache' });
      if (!resp.ok) return;
      const data = await resp.json();
      if (data && Array.isArray(data.docs) && data.docs.length) {
        this.index = { docs: data.docs.map((doc) => this.normalizeDoc(doc)) };
        // compute global stats for new index
        try { this.buildGlobalStats(); } catch { console.debug('buildGlobalStats failed'); }
        // Persist to localStorage for faster subsequent loads
        try {
          const docsToSave = this.index.docs.map(({ keywordSet: _ks, ...rest }) => rest);
          localStorage.setItem(RAG_INDEX_KEY, JSON.stringify({ docs: docsToSave }));
        } catch (_e) {
          // ignore storage error
        }
      }
    } catch (e) {
      // Non-fatal
      console.debug('No remote RAG index found or failed to load:', e?.message || e);
    }
  }

  saveIndex() {
    try {
      const trimmed = this.index.docs.slice(-MAX_DOCS).map(({ keywordSet: _ks, ...rest }) => rest);
      localStorage.setItem(RAG_INDEX_KEY, JSON.stringify({ docs: trimmed }));
    } catch (e) {
      console.error('Failed to save RAG index:', e);
    }
  }

  normalizeDoc(doc) {
    const normalized = {
      id: doc.id,
      docId: doc.docId || doc.id,
      title: doc.title || doc.docId || doc.id,
      content: doc.content || doc.text || '',
      keywords: Array.isArray(doc.keywords) ? doc.keywords : this.extractKeywords(doc.content || doc.text || ''),
      termFreq: {},
      docLength: 0,
      embedding: Array.isArray(doc.embedding) ? doc.embedding : [],
      createdAt: doc.createdAt || Date.now(),
    };
    // compute term frequencies
    const words = (normalized.content || '').toLowerCase().match(/\b\w+\b/g) || [];
    normalized.docLength = words.length;
    words.forEach(w => { normalized.termFreq[w] = (normalized.termFreq[w] || 0) + 1; });
    normalized.keywordSet = new Set(normalized.keywords);
    return normalized;
  }

  // Simple keyword extractor reused from memoryService style
  extractKeywords(text) {
    if (!text || typeof text !== 'string') return [];
    const raw = text.toLowerCase();
    const words = raw.match(/\b\w{2,}\b/g) || [];
    const stopWords = new Set(['the','and','for','with','that','this','have','from','your','you','are','our','but','not','was','were','will','can','dari','ke','di','yang','dan','atau','untuk','dengan','adalah','saya','anda','ini','itu','atau']);
    const filtered = words.filter(w => !stopWords.has(w));
    // include bigrams
    const bigrams = [];
    for (let i = 0; i < filtered.length - 1; i++) {
      bigrams.push(`${filtered[i]} ${filtered[i+1]}`);
    }
    const candidates = [...filtered, ...bigrams];
    const freq = {};
    candidates.forEach(w => freq[w] = (freq[w] || 0) + 1);
    return Object.keys(freq).sort((a,b)=>freq[b]-freq[a]).slice(0,60);
  }

  createEmbedding(text, _keywords) {
    // lightweight TF-IDF vector over current vocabList
    if (!text || typeof text !== 'string' || !this.vocabList.length) return [];
    const freq = {};
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
    const N = words.length || 1;
    return this.vocabList.map(term => {
      const tf = (freq[term] || 0) / N;
      const idf = this.idf[term] || 0;
      return tf * idf;
    });
  }

  // build vocabulary list and idf scores from current index
  buildGlobalStats() {
    const docs = this.index.docs || [];
    this.totalDocs = docs.length;
    const df = {};
    docs.forEach(d => {
      const seen = new Set();
      const words = (d.content || '').toLowerCase().match(/\b\w+\b/g) || [];
      words.forEach(w => { if (!seen.has(w)) { df[w] = (df[w] || 0) + 1; seen.add(w); } });
    });
    this.docFreq = df;
    this.idf = {};
    Object.keys(df).forEach(term => { this.idf[term] = Math.log(1 + (this.totalDocs / (1 + df[term]))); });
    this.vocabList = Object.keys(df).sort((a,b)=>df[b]-df[a]).slice(0,256);
    // precompute embeddings for docs
    docs.forEach(d => { d.embedding = this.createEmbedding(d.content || '', []); });
  }

  cosineSimilarity(a, b) {
    const maxLen = Math.max(a.length, b.length);
    const A = [...a, ...Array(maxLen - a.length).fill(0)];
    const B = [...b, ...Array(maxLen - b.length).fill(0)];
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < maxLen; i++) {
      dot += A[i] * B[i];
      na += A[i] * A[i];
      nb += B[i] * B[i];
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom === 0 ? 0 : dot / denom;
  }

  chunkText(text, size = DEFAULT_CHUNK_SIZE) {
    const chunks = [];
    let i = 0;
    while (i < text.length) {
      const part = text.slice(i, i + size);
      chunks.push(part);
      i += size;
    }
    return chunks;
  }

  // docs: [{ id?, title, text, namespace? }]
  indexDocuments(docs = []) {
    const added = [];
    docs.forEach(doc => {
      const title = doc.title || (doc.id || '').toString();
      const namespace = doc.namespace || 'default';
      const chunks = this.chunkText(doc.text || doc.content || '');
      chunks.forEach((chunk, idx) => {
        const chunkId = `${doc.id || title}_${idx}_${Date.now().toString(36)}`;
        const keywords = this.extractKeywords(chunk);
        const words = (chunk || '').toLowerCase().match(/\b\w+\b/g) || [];
        const termFreq = {};
        words.forEach(w => { termFreq[w] = (termFreq[w] || 0) + 1; });
        const docLength = words.length;
        const obj = {
          id: chunkId,
          docId: doc.id || title,
          title,
          content: chunk,
          namespace,
          keywords,
          keywordSet: new Set(keywords),
          termFreq,
          docLength,
          embedding: [],
          createdAt: Date.now()
        };
        // push then update global stats and embedding
        this.index.docs.push(obj);
        added.push(chunkId);
      });
    });
    // rebuild global stats and save
    this.buildGlobalStats();
    this.saveIndex();
    return added;
  }

  clearIndex(namespace = null) {
    if (!namespace) {
      this.index = { docs: [] };
    } else {
      this.index.docs = this.index.docs.filter(d => d.namespace !== namespace);
    }
    this.saveIndex();
  }

  scoreDocument(queryKeys, queryEmb, doc) {
    // BM25-like scoring combined with semantic similarity
    const k1 = 1.5, b = 0.75;
    const avgdl = this.index.docs.reduce((s, x) => s + (x.docLength || 0), 0) / Math.max(1, this.index.docs.length);
    let bm25 = 0;
    for (const term of queryKeys) {
      const f = doc.termFreq && doc.termFreq[term] ? doc.termFreq[term] : 0;
      if (f === 0) continue;
      const idf = this.idf[term] || Math.log(1 + (this.totalDocs / 1));
      bm25 += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + b * ((doc.docLength || 0) / (avgdl || 1)))));
    }

    const sem = (queryEmb && queryEmb.length && doc.embedding && doc.embedding.length) ? this.cosineSimilarity(queryEmb, doc.embedding) : 0;

    const semWeight = 0.45;
    const bmWeight = 0.55;
    const base = (sem * semWeight) + (bm25 * bmWeight);
    const lengthBoost = Math.min(1.2, 1 + ((doc.docLength || 0) - 300) / 2000);
    return base * lengthBoost;
  }

  // Search the index with a query and return top K document chunks
  search(query, topK = 5, namespace = null) {
    return this.searchWithScores(query, topK, namespace).map(item => item.doc);
  }

  searchWithScores(query, topK = 10, namespace = null) {
    if (!query || this.index.docs.length === 0) return [];
    // cache
    const cached = this.queryCache.get(query);
    if (cached && (Date.now() - cached.ts) < QUERY_CACHE_TTL) return cached.results.slice(0, topK);

    const qKeys = this.extractKeywords(query);
    if (qKeys.length === 0) return [];
    if (!this.vocabList.length) this.buildGlobalStats();
    const queryEmb = this.createEmbedding(query, []);

    const candidates = this.index.docs.filter(d => (namespace ? d.namespace === namespace : true));
    const scored = [];

    for (const doc of candidates) {
      const score = this.scoreDocument(qKeys, queryEmb, doc);
      if (score > 0) {
        scored.push({ doc, score });
      }
    }

    const results = scored.sort((a, b) => b.score - a.score).slice(0, topK);
    this.queryCache.set(query, { ts: Date.now(), results });
    return results;
  }

  // Format search results as context string for injection into prompts
  formatContextForPrompt(searchResults, maxTokens = 2000) {
    if (!searchResults || searchResults.length === 0) return '';
    
    let context = 'KNOWLEDGE BASE CONTEXT (untuk referensi):\n\n';
    let tokenEstimate = 0;
    const tokenPerChar = 0.25; // rough estimate
    
    for (const result of searchResults) {
      const doc = result.doc || result;
      const title = doc.title || 'Unknown';
      const content = doc.content || '';
      const chunk = `[${title}]\n${content}\n`;
      const chunkTokens = Math.ceil(chunk.length * tokenPerChar);
      
      if (tokenEstimate + chunkTokens > maxTokens) break;
      
      context += chunk + '\n---\n\n';
      tokenEstimate += chunkTokens;
    }
    
    return context;
  }

  // Auto-ingest knowledge base from dataset
  async ingestKnowledgeBase(datasource = '/data/datasets/orion_dataset.json') {
    try {
      const response = await fetch(datasource);
      if (!response.ok) return false;
      
      const data = await response.json();
      if (!Array.isArray(data)) return false;
      
      // Clear existing knowledge base docs to avoid duplication
      this.clearIndex('knowledge_base');
      
      // Index each document from dataset
      const docsToIndex = data.map(item => ({
        id: item.id,
        title: item.title,
        text: item.text,
        namespace: 'knowledge_base'
      }));
      
      this.indexDocuments(docsToIndex);
      console.log(`✅ RAG: Ingested ${docsToIndex.length} knowledge base documents`);
      return true;
    } catch (e) {
      console.error('Failed to ingest knowledge base:', e);
      return false;
    }
  }

  getStats() {
    return { totalChunks: this.index.docs.length };
  }
}

export const ragService = new RagService();
export default RagService;
