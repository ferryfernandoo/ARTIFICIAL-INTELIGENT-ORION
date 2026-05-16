const fs = require('fs');

const filePath = 'f:/chat bot/public/rag_index.json';
let data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

data.docs = data.docs.map(doc => {
  if (doc.docId === 'orion_security') {
    doc.title = 'Keamanan Sistem AI';
    doc.content = 'Sistem AI tidak menyimpan percakapan pengguna secara permanen. Data hanya diproses dalam memori saat sesi aktif. Sistem juga tidak mengakses file pribadi tanpa izin eksplisit. Untuk keamanan maksimal, pengguna disarankan tidak membagikan informasi sensitif seperti password atau token akses dalam percakapan.';
    doc.keywords = ['keamanan', 'privasi', 'data', 'tidak menyimpan', 'percakapan', 'sesi aktif', 'file pribadi', 'izin', 'informasi sensitif', 'password', 'token', 'rekomendasi'];
  }
  if (doc.docId === 'rag_hybrid_search') {
    doc.content = 'Pencarian RAG mendukung pencarian berbasis kata kunci dan pencarian vektor (embedding similarity). Sistem menggabungkan skor dari BM25 (keyword) dan cosine similarity (vektor) untuk mendapatkan dokumen paling relevan. Bobot default adalah 0.5 untuk keyword dan 0.5 untuk vektor.';
    doc.keywords = ['hybrid', 'search', 'rag', 'bm25', 'cosine similarity', 'vektor', 'keyword', 'bobot', 'relevansi', 'dokumen', 'pencarian'];
  }
  return doc;
});

fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
console.log('✓ RAG index cleaned: Orion references removed');
