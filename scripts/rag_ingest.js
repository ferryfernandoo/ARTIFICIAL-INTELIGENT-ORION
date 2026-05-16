#!/usr/bin/env node
// Simple Node script to ingest JSON datasets and produce public/rag_index.json
// Usage: node scripts/rag_ingest.js --input data/datasets --out public/rag_index.json

const fs = require('fs');
const path = require('path');

const DEFAULT_INPUT = path.resolve(process.cwd(), 'data', 'datasets');
const DEFAULT_OUT = path.resolve(process.cwd(), 'public', 'rag_index.json');
const CHUNK_SIZE = 800;

function usage() {
  console.log('Usage: node scripts/rag_ingest.js --input <folder> --out <out.json>');
}

function extractKeywords(text) {
  const words = (text || '').toLowerCase().match(/\b\w{3,}\b/g) || [];
  const stopWords = new Set(['the','and','for','with','that','this','have','from','your','you','youre','are','our','but','not','was','were','will','can','dari','ke','di','yang','dan','atau','untuk','dengan','adalah','saya','anda']);
  return [...new Set(words.filter(w => !stopWords.has(w)))];
}

function createEmbedding(text, keywords) {
  const freq = {};
  const words = (text || '').toLowerCase().match(/\b\w+\b/g) || [];
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  return keywords.slice(0, 40).map(k => (freq[k] || 0) / (words.length || 1));
}

function chunkText(text, size = CHUNK_SIZE) {
  const chunks = [];
  let i = 0;
  while (i < (text || '').length) {
    chunks.push(text.slice(i, i + size));
    i += size;
  }
  return chunks;
}

function readJsonFilesFromDir(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const docs = [];
  files.forEach(file => {
    try {
      const full = path.join(dir, file);
      const raw = fs.readFileSync(full, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach(item => {
          if (item && (item.text || item.content)) docs.push({ id: item.id || path.basename(file, '.json'), title: item.title || item.id || path.basename(file, '.json'), text: item.text || item.content });
        });
      } else if (parsed && (parsed.text || parsed.content)) {
        docs.push({ id: parsed.id || path.basename(file, '.json'), title: parsed.title || path.basename(file, '.json'), text: parsed.text || parsed.content });
      } else {
        // If it's an object of entries, index each value
        Object.values(parsed).forEach(val => {
          if (val && (val.text || val.content)) docs.push({ id: val.id || path.basename(file, '.json'), title: val.title || path.basename(file, '.json'), text: val.text || val.content });
        });
      }
    } catch (e) {
      console.warn('Skipping file', file, 'error', e.message || e);
    }
  });
  return docs;
}

function buildIndexFromDocs(docs) {
  const index = { docs: [] };
  docs.forEach(doc => {
    const chunks = chunkText(doc.text || '');
    chunks.forEach((chunk, idx) => {
      const chunkId = `${doc.id || doc.title}_${idx}_${Date.now().toString(36)}`;
      const keywords = extractKeywords(chunk);
      const embedding = createEmbedding(chunk, keywords);
      index.docs.push({ id: chunkId, docId: doc.id || doc.title, title: doc.title || doc.id, content: chunk, keywords, embedding, createdAt: Date.now() });
    });
  });
  return index;
}

function main() {
  const args = process.argv.slice(2);
  let input = DEFAULT_INPUT;
  let out = DEFAULT_OUT;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i+1]) { input = path.resolve(args[i+1]); i++; }
    else if (args[i] === '--out' && args[i+1]) { out = path.resolve(args[i+1]); i++; }
    else if (args[i] === '--help') { usage(); return; }
  }

  console.log('Reading JSON files from', input);
  const docs = readJsonFilesFromDir(input);
  console.log('Found documents:', docs.length);
  const index = buildIndexFromDocs(docs);

  // Ensure out directory exists
  const outDir = path.dirname(out);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(out, JSON.stringify(index, null, 2), 'utf8');
  console.log('Wrote RAG index to', out, 'chunks:', index.docs.length);
}

if (require.main === module) main();
