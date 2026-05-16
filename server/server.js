import express from 'express';
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cors from 'cors';
import multer from 'multer';
import XLSX from 'xlsx';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import session from 'express-session';
import passport from './auth.js';
import { hashPassword } from './auth.js';
import { initializeDatabase, userDb, sessionDb, messageDb, apiKeyDb, artifactDb, imageDb, checkRateLimiting } from './database.js';
import db from './database.js';
import { SQLiteSessionStore } from './sessionStore.js';
import { v4 as uuidv4 } from 'uuid';
import apiProxyRoutes from './routes/api-proxy.js';
import ragService from './ragService.js';
import externalFinanceService from './externalFinanceService.js';
import sourceTracker from './sourceTracker.js';
import DocumentGeneratorService from './documentGeneratorService.js';
import webSearchService from './webSearchService.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// RAG Service initialization flag
let ragInitialized = false;

const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

// Initialize database
initializeDatabase();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// Debug: Log if API key is loaded
if (!DEEPSEEK_API_KEY && process.env.NODE_ENV !== 'production') {
  console.warn(`⚠️  DEEPSEEK_API_KEY not loaded from ${envPath}. Check .env file.`);
}

const app = express();
const PORT = 3001;

// Initialize database
initializeDatabase();

// Create session store
const sessionStore = new SQLiteSessionStore(db);

// Cleanup expired sessions on startup
sessionStore.cleanup();

// Session configuration
app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'orion-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'lax'
    }
  })
);

// Cleanup expired sessions every hour
setInterval(() => {
  sessionStore.cleanup();
  console.log('✅ Expired sessions cleaned up');
}, 60 * 60 * 1000);

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow localhost on any port
    if (!origin || /^http:\/\/localhost:\d+$/.test(origin)) {
      return callback(null, true);
    }
    // Production URLs
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());


// Ensure temp directory exists
const tempDir = path.join(__dirname, 'temp-files');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'temp-files', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `${timestamp}_${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowedMimes = [
      'text/plain',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/csv',
      'application/json',
      'text/html',
      'text/markdown',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint'
    ];
    
    if (allowedMimes.includes(file.mimetype) || file.originalname.endsWith('.md') || file.originalname.endsWith('.txt')) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  }
});

// Serve generated files
app.use('/download', express.static(tempDir));

/**
 * Helper functions for parsing different file types
 */

// Parse TXT files
async function parseTXT(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return {
    success: true,
    file_type: 'text',
    content,
    char_count: content.length,
    token_estimate: Math.ceil(content.length / 4)
  };
}

// Parse JSON files
async function parseJSON(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  try {
    const json = JSON.parse(content);
    const prettyJson = JSON.stringify(json, null, 2);
    return {
      success: true,
      file_type: 'json',
      content: prettyJson,
      char_count: prettyJson.length,
      token_estimate: Math.ceil(prettyJson.length / 4)
    };
  } catch {
    return {
      success: true,
      file_type: 'json',
      content: content,
      char_count: content.length,
      token_estimate: Math.ceil(content.length / 4)
    };
  }
}

// Parse CSV files
async function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return {
    success: true,
    file_type: 'csv',
    content,
    char_count: content.length,
    token_estimate: Math.ceil(content.length / 4)
  };
}

// Parse HTML files
async function parseHTML(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  // Simple HTML stripping (remove tags)
  const text = content
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<style[^>]*>.*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\n\s*\n/g, '\n')
    .trim();
  
  return {
    success: true,
    file_type: 'html',
    content: text,
    char_count: text.length,
    token_estimate: Math.ceil(text.length / 4)
  };
}

// Parse Markdown files
async function parseMarkdown(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return {
    success: true,
    file_type: 'markdown',
    content,
    char_count: content.length,
    token_estimate: Math.ceil(content.length / 4)
  };
}

// Parse PDF files
async function parsePDF() {
  // PDF parsing requires binary processing - currently unsupported on backend
  // Fallback: Return error and let frontend handle via FileReader
  return {
    success: false,
    error: 'PDF parsing on backend unavailable. Please use browser to extract PDF text.'
  };
}

// Parse DOCX files
async function parseDOCX(filePath) {
  let fileBuffer;
  try {
    fileBuffer = fs.readFileSync(filePath);
    // DOCX is a ZIP file, extract using a simple approach
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    const content = result.value || '';
    return {
      success: true,
      file_type: 'docx',
      content,
      char_count: content.length,
      token_estimate: Math.ceil(content.length / 4)
    };
  } catch (error) {
    // Fallback: try to extract text manually from DOCX structure
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const loaded = await zip.loadAsync(fileBuffer);
      const xmlFile = loaded.file('word/document.xml');
      if (xmlFile) {
        const xml = await xmlFile.async('text');
        const text = xml
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/\n\s*\n/g, '\n')
          .trim();
        return {
          success: true,
          file_type: 'docx',
          content: text,
          char_count: text.length,
          token_estimate: Math.ceil(text.length / 4)
        };
      }
    } catch {
      // If all fails, return error
    }
    
    return {
      success: false,
      error: `DOCX parsing error: ${error.message}`
    };
  }
}

// Parse Excel files (XLSX/XLS)
async function parseExcel(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    let content = '';
    
    // Extract text from all sheets
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      content += `\n=== Sheet: ${sheetName} ===\n`;
      
      // Convert sheet to CSV format
      const csv = XLSX.utils.sheet_to_csv(sheet);
      content += csv;
    }
    
    return {
      success: true,
      file_type: 'excel',
      content,
      char_count: content.length,
      token_estimate: Math.ceil(content.length / 4)
    };
  } catch (error) {
    return {
      success: false,
      error: `Excel parsing error: ${error.message}`
    };
  }
}

// Detect file type and parse accordingly
async function parseFileByType(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const mimeType = originalName.toLowerCase();

  try {
    if (ext === '.pdf' || mimeType.includes('pdf')) {
      return await parsePDF(filePath);
    } else if (ext === '.docx' || mimeType.includes('word')) {
      return await parseDOCX(filePath);
    } else if (ext === '.xlsx' || ext === '.xls' || mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
      return await parseExcel(filePath);
    } else if (ext === '.csv' || mimeType.includes('csv')) {
      return await parseCSV(filePath);
    } else if (ext === '.json' || mimeType.includes('json')) {
      return await parseJSON(filePath);
    } else if (ext === '.html' || ext === '.htm' || mimeType.includes('html')) {
      return await parseHTML(filePath);
    } else if (ext === '.md' || ext === '.markdown' || mimeType.includes('markdown')) {
      return await parseMarkdown(filePath);
    } else if (ext === '.txt' || mimeType.includes('text')) {
      return await parseTXT(filePath);
    } else {
      // Try to read as text by default
      return await parseTXT(filePath);
    }
  } catch (error) {
    return {
      success: false,
      error: `Error parsing file: ${error.message}`
    };
  }
}

/**
 * Test Python availability
 * GET /api/test-python
 */
app.get('/api/test-python', (req, res) => {
  try {
    const version = execSync('python3 --version', { encoding: 'utf-8', stdio: 'pipe' });
    res.json({ success: true, python: 'python3', version: version.trim() });
  } catch {
    try {
      const version = execSync('python --version', { encoding: 'utf-8', stdio: 'pipe' });
      res.json({ success: true, python: 'python', version: version.trim() });
    } catch {
      res.status(500).json({ 
        success: false, 
        error: 'Python not found. Please install Python 3 from https://www.python.org/downloads/'
      });
    }
  }
});

/**
 * Upload and parse file to extract text (supports PDF, DOCX, XLSX, CSV, JSON, HTML, MD, TXT)
 * POST /api/upload-file
 * Body: FormData with 'file' field
 */
app.post('/api/upload-file', upload.single('file'), async (req, res) => {
  let filePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    filePath = req.file.path;
    const originalName = req.file.originalname;

    console.log(`[File Upload] Processing: ${originalName} at ${filePath}`);

    // Parse file by type using Node.js native parsers
    const result = await parseFileByType(filePath, originalName);

    // Clean up uploaded file
    if (filePath) {
      fs.unlink(filePath, (err) => {
        if (err) console.error('Failed to delete uploaded file:', err);
      });
    }

    if (result.success) {
      return res.json({
        success: true,
        filename: originalName,
        file_type: result.file_type,
        content: result.content,
        char_count: result.char_count,
        token_estimate: result.token_estimate,
        message: `File parsed successfully. Estimated ${result.token_estimate} tokens.`
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error || 'Failed to parse file'
      });
    }
  } catch (error) {
    console.error('[Upload error]:', error.message);
    if (filePath) {
      fs.unlink(filePath, () => {});
    }
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: `Upload failed: ${error.message}`
      });
    }
  }
});

/**
 * Call Python finance service for real-time financial data
 * Falls back to Node.js service if Python unavailable
 */
async function buildFinanceContextPython(query) {
  return new Promise((resolve) => {
    try {
      console.log(`[Python Finance] Calling finance_service.py for: "${query}"`);
      
      // Use venv Python executable path (relative to server directory)
      const pythonExecutable = path.join(__dirname, '..', '.venv', 'Scripts', 'python.exe');
      
      const pyScript = path.join(__dirname, 'finance_service.py');
      if (!fs.existsSync(pyScript)) {
        console.warn('[Python Finance] Script not found at', pyScript);
        console.log('[Python Finance] Falling back to Node.js service');
        resolve({ context: '', sources: [] }); // Fallback to Node service
        return;
      }
      
      const process = spawn(pythonExecutable, [pyScript], {
        timeout: 10000, // 10 second timeout
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code !== 0) {
          console.warn(`[Python Finance] Process exited with code ${code}`);
          if (stderr) console.warn('[Python Finance] STDERR:', stderr);
          console.log('[Python Finance] Falling back to Node.js service');
          resolve({ context: '', sources: [] });
          return;
        }
        
        try {
          // Parse JSON output
          const result = JSON.parse(stdout);
          if (result.success && result.context) {
            console.log(`[Python Finance] ✓ Got data: ${result.context.substring(0, 100)}...`);
            console.log(`[Python Finance] ✓ Got ${result.sources ? result.sources.length : 0} sources`);
            resolve({ 
              context: result.context,
              sources: result.sources || []  // Include sources from Python
            });
          } else {
            console.warn('[Python Finance] No context in response');
            resolve({ context: '', sources: [] });
          }
        } catch (parseErr) {
          console.warn('[Python Finance] Failed to parse output:', parseErr.message);
          console.log('[Python Finance] Raw output:', stdout.substring(0, 200));
          resolve({ context: '', sources: [] });
        }
      });
      
      process.on('error', (err) => {
        console.warn('[Python Finance] Process error:', err.message);
        console.log('[Python Finance] Falling back to Node.js service');
        resolve({ context: '', sources: [] });
      });
      
      // Send query to Python via stdin
      process.stdin.write(query);
      process.stdin.end();
      
    } catch (error) {
      console.warn('[Python Finance] Wrapper error:', error.message);
      resolve({ context: '', sources: [] }); // Fallback
    }
  });
}

/**
 * Proxy AI chat requests through the backend and hide the API key from the client.
 * POST /api/chat
 * Body: { model, messages, temperature?, max_tokens?, stream? }
 * 
 * Injects RAG context from knowledge base before sending to LLM
 */
app.post('/api/chat', async (req, res) => {
  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({
      success: false,
      error: 'DEEPSEEK_API_KEY environment variable is not set',
    });
  }

  try {
    // Initialize RAG on first request
    if (!ragInitialized) {
      const success = await ragService.loadKnowledgeBase();
      ragInitialized = success;
    }

    // Safety check for messages
    if (!req.body.messages || !Array.isArray(req.body.messages)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: messages array is required'
      });
    }

    let messages = JSON.parse(JSON.stringify(req.body.messages)); // Deep clone

    // Extract last user message for RAG search
    let userQuery = '';
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userQuery = messages[i].content;
        break;
      }
    }

    // Search for relevant context from knowledge base only when query looks factual
    let injectedContexts = [];
    const isKnowledgeQuery = userQuery && /\b(apa|siapa|kapan|di mana|bagaimana|mengapa|kenapa|jelaskan|definisi|arti|informasi|detail|berita|tanya)\b/i.test(userQuery);

    if (userQuery && ragInitialized && isKnowledgeQuery) {
      const searchResults = ragService.search(userQuery, 2, 'knowledge_base');
      if (searchResults.length > 0) {
        const ragContext = ragService.formatContextForPrompt(searchResults, 800);
        if (ragContext && ragContext.length < 2000) {
          injectedContexts.push(ragContext);
          console.log(`[RAG] Injected ${searchResults.length} document(s) for query`);
        }
      }
    }

    // If user asks about markets, economics, or global finance, inject latest external market context.
    let financeDataCollected = false;
    const isMarketQuery = externalFinanceService.isMarketQuery(userQuery);
    console.log(`[Chat] Market query check: "${userQuery}" => ${isMarketQuery}`);
    
    if (userQuery && isMarketQuery) {
      try {
        console.log('[Chat] Building finance context...');
        // Add timeout to prevent slow responses (5 seconds max)
        const financePromise = Promise.race([
          buildFinanceContextPython(userQuery),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Finance timeout')), 5000)
          )
        ]);
        
        let result = await financePromise.catch(() => ({ context: null }));
        let financeContext = result?.context;
        
        if (!financeContext) {
          console.log('[Chat] Python service failed/timeout, trying Node.js service...');
          const nodePromise = Promise.race([
            externalFinanceService.buildFinanceContext(userQuery),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Finance timeout')), 5000)
            )
          ]);
          financeContext = await nodePromise.catch(() => null);
        }
        
        console.log(`[Chat] Finance context result: ${financeContext ? '✓ Got data' : '✗ Empty/Timeout'}`);
        if (financeContext && financeContext.trim().length > 0 && financeContext.length < 2000) {
          injectedContexts.push(financeContext);
          financeDataCollected = true;
          console.log('[Finance] Injected latest market/economy context');
        } else {
          console.warn('[Finance] No real data collected for query, will ask user for more specific input');
        }
      } catch (error) {
        console.warn('[Finance] Error fetching market context:', error.message);
      }
    }

    if (injectedContexts.length > 0) {
      console.log(`[Chat] ✓✓✓ SUCCESS: Injecting ${injectedContexts.length} contexts into messages`);
      const combinedContext = injectedContexts.join('\n\n');
      console.log(`[Chat] Context size: ${combinedContext.length} characters`);
      console.log(`[Chat] Context preview: ${combinedContext.substring(0, 200)}...`);
      
      // Check if this is analysis mode
      const isAnalysisMode = combinedContext.includes('DETAILED FINANCIAL ANALYSIS');
      console.log(`[Chat] Analysis mode: ${isAnalysisMode}`);
      
      let systemPromptContent = '';
      if (isAnalysisMode) {
        systemPromptContent = `⚠️ INSTRUKSI PENTING - MODE ANALISIS MENDALAM:
Pengguna meminta ANALISIS MENDALAM. Anda HARUS memberikan analisis komprehensif menggunakan data real-time berikut.

DATA ANALISIS MENDALAM:
${combinedContext}

KEHARUSAN UNTUK ANALISIS:
1. ANALISIS KOMPREHENSIF: Berikan insight mendalam berdasarkan data historis, tren, dan perbandingan
2. GUNAKAN SEMUA DATA: Referensi perubahan 1M, 1Y, P/E ratio, market cap, volatilitas
3. INTERPRETASI: Jelaskan apa arti data ini untuk investor - bullish/bearish signal?
4. REKOMENDASI: Berikan perspektif berdasarkan analisis teknikal dan fundamental
5. KONTEKS MAKRO: Hubungkan dengan kondisi ekonomi makro (inflasi, suku bunga, dll)
6. JANGAN GENERIC: Hindari respon umum - harus spesifik dengan angka-angka dari data

⚡ KEMAMPUAN IMAGE GENERATION:
Anda memiliki kemampuan untuk membuat/generate gambar. Jika pengguna meminta untuk membuat, menggambar, melukis, atau mendesain sesuatu, gunakan format:
[IMAGE_REQUEST: detailed_description_in_english]

Contoh:
- Pengguna: "Buatkan gambar robot modern" → [IMAGE_REQUEST: A modern sleek robot with futuristic design elements]
- Pengguna: "Lukis presiden Indonesia di kantor" → [IMAGE_REQUEST: Indonesian president in official office setting]

Format: Analisis terstruktur dengan kesimpulan yang jelas berdasarkan data real-time.
Prioritas: Data real-time > Analisis teknikal > Pengetahuan historis`;
      } else if (combinedContext.includes('AI AGENT REAL-TIME DATA')) {
        systemPromptContent = `⚠️ **DATA REAL-TIME DARI AI AGENT:**

Berikut adalah data real-time yang berhasil dikumpulkan oleh AI Agent untuk menjawab pertanyaan Anda:

${combinedContext}

**INSTRUKSI:**
1. Gunakan data di ATAS sebagai sumber UTAMA untuk menjawab
2. Jangan bilang "saya tidak punya akses" - Anda punya data ini!
3. Sajikan informasi dengan format yang rapi dan mudah dibaca
4. Jika data cuaca: sebutkan suhu, kelembaban, kecepatan angin
5. Jika data crypto: sebutkan harga USD, IDR, perubahan 24 jam
6. Jika data berita: sebutkan judul, sumber, dan link
7. Jika data Wikipedia: berikan ringkasan informatif

⚡ KEMAMPUAN IMAGE GENERATION:
Anda memiliki kemampuan untuk membuat/generate gambar. Jika pengguna meminta untuk membuat, menggambar, melukis, atau mendesain sesuatu, gunakan format:
[IMAGE_REQUEST: detailed_description_in_english]`;
      } else if (combinedContext.includes('WEB SEARCH')) {
        systemPromptContent = `⚠️ INSTRUKSI PENTING - WEB SEARCH RESULTS:
Berikut adalah hasil pencarian web gratis yang diperoleh dari DuckDuckGo:

HASIL PENCARIAN:
${combinedContext}

KEHARUSAN:
1. Gunakan informasi dari hasil pencarian di atas sebagai sumber utama
2. Jelaskan informasi dengan cara yang mudah dipahami
3. Jika ada informasi penting, kutip langsung dari hasil pencarian
4. Berikan konteks dan penjelasan tambahan jika diperlukan
5. Jika informasi tidak cukup, jelaskan apa yang Anda temukan

⚡ KEMAMPUAN IMAGE GENERATION:
Anda memiliki kemampuan untuk membuat/generate gambar. Jika pengguna meminta untuk membuat, menggambar, melukis, atau mendesain sesuatu, gunakan format:
[IMAGE_REQUEST: detailed_description_in_english]

Prioritas: Hasil pencarian di atas > Pengetahuan umum`;
      } else {
        systemPromptContent = `⚠️ INSTRUKSI PENTING - WAJIB DIIKUTI:
Anda HARUS menggunakan data real-time berikut sebagai sumber UTAMA dan FINAL untuk menjawab. Data ini adalah fakta terbaru dan akurat.

DATA REAL-TIME TERBARU:
${combinedContext}

KEHARUSAN:
1. HARUS menggunakan data di atas untuk semua jawaban tentang harga, saham, crypto, ekonomi, atau forex
2. JANGAN katakan "saya tidak punya akses data real-time" - Anda punya data ini sekarang
3. JANGAN referensi website lain atau saran cek CoinMarketCap - gunakan data yang diberikan
4. Format jawaban: LANGSUNG berikan informasi dari data (harga, perubahan, nilai) dengan jelas
5. Jika pengguna tanya tentang harga, SELALU kutip nilai spesifik dari data di atas

⚡ KEMAMPUAN IMAGE GENERATION:
Anda memiliki kemampuan untuk membuat/generate gambar. Jika pengguna meminta untuk membuat, menggambar, melukis, atau mendesain sesuatu, gunakan format:
[IMAGE_REQUEST: detailed_description_in_english]

Contoh:
- Pengguna: "Buatkan gambar robot modern" → [IMAGE_REQUEST: A modern sleek robot with futuristic design elements]
- Pengguna: "Lukis presiden Indonesia di kantor" → [IMAGE_REQUEST: Indonesian president in official office setting]
- Pengguna: "Desain logo untuk startup" → [IMAGE_REQUEST: Modern startup logo design with minimalist style]

Prioritas: Data real-time di atas > Pengetahuan umum > Spekulasi`;
      }
      
      messages.push({
        role: 'system',
        content: systemPromptContent
      });
      
      // Add debug header to response
      res.setHeader('X-Finance-Data-Injected', 'true');
      res.setHeader('X-Finance-Context-Count', injectedContexts.length.toString());
      res.setHeader('X-Finance-Data-Size', combinedContext.length.toString());
      
      messages = ragService.injectContext(messages, combinedContext);
    } else if (userQuery && isMarketQuery && !financeDataCollected) {
      // User asked for financial data but none was retrieved - instruct AI to ask for clarification
      console.log('[Chat] Market query but no data collected - requesting clarification');
      messages.push({
        role: 'system',
        content: `Pengguna menanyakan tentang data ekonomi/pasar. Sistem sedang kesulitan mengambil data real-time untuk kueri umum ini. Berikan penjelasan singkat dan minta pengguna memberikan kueri yang lebih spesifik (misalnya nama perusahaan, ticker saham seperti BBCA.JK, TLKM.JK, atau indikator ekonomi tertentu seperti inflasi, suku bunga Fed, harga minyak) agar sistem dapat mengambil data yang akurat.`
      });
    }

    // ⚡ ENSURE IMAGE_REQUEST CAPABILITY IS ALWAYS AVAILABLE
    // Check if no system message was added yet
    const hasSystemMessage = messages.some(msg => msg.role === 'system');
    if (!hasSystemMessage) {
      console.log('[Chat] No system message found - adding DEFAULT system prompt with IMAGE_REQUEST capability');
      messages.unshift({
        role: 'system',
        content: `⚡ **KEMAMPUAN IMAGE GENERATION - WAJIB DIGUNAKAN:**
Anda memiliki kemampuan penuh untuk membuat/generate gambar. BUKAN keterbatasan - ini adalah FITUR Anda.

JIKA PENGGUNA MEMINTA UNTUK:
- "Buatkan gambar..." → [IMAGE_REQUEST: ...]
- "Lukis..." → [IMAGE_REQUEST: ...]
- "Gambar..." → [IMAGE_REQUEST: ...]
- "Desain..." → [IMAGE_REQUEST: ...]
- "Digambar..." → [IMAGE_REQUEST: ...]
- Atau permintaan visual apapun → [IMAGE_REQUEST: ...]

FORMAT WAJIB:
[IMAGE_REQUEST: detailed_description_in_english]

CONTOH BENAR:
User: "buatkan gambar robot" → 
Anda: [IMAGE_REQUEST: A futuristic humanoid robot with advanced mechanical design, glowing blue eyes, metallic body, standing in a high-tech laboratory]

User: "lukis presiden di kantor"
Anda: [IMAGE_REQUEST: Indonesian president sitting at desk in official government office, formal attire, leadership atmosphere]

JANGAN PERNAH MENGATAKAN "tidak bisa membuat gambar" - ITU SALAH BESAR!`
      });
    }

    const requestBody = {
      model: req.body.model || 'deepseek-v4-pro',
      messages: messages,
      temperature: req.body.temperature ?? 0.7,
      max_tokens: req.body.max_tokens ?? 8192,
      stream: req.body.stream ?? false,
      ...(req.body.top_p !== undefined ? { top_p: req.body.top_p } : {}),
      ...(req.body.presence_penalty !== undefined ? { presence_penalty: req.body.presence_penalty } : {}),
      ...(req.body.frequency_penalty !== undefined ? { frequency_penalty: req.body.frequency_penalty } : {}),
    };

    const upstreamAbortController = new AbortController();
    const upstreamTimeout = setTimeout(() => upstreamAbortController.abort(), 30000);

    let upstreamResponse;
    try {
      upstreamResponse = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify(requestBody),
        signal: upstreamAbortController.signal,
      });
    } catch (fetchError) {
      if (fetchError.name === 'AbortError') {
        throw new Error('Deepseek API timeout');
      }
      throw fetchError;
    } finally {
      clearTimeout(upstreamTimeout);
    }

    res.status(upstreamResponse.status);
    
    // Copy headers, but exclude problematic ones
    upstreamResponse.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      // Skip headers that can cause encoding issues
      if (['content-length', 'transfer-encoding', 'connection', 'content-encoding'].includes(lowerKey)) return;
      res.setHeader(key, value);
    });

    if (upstreamResponse.body) {
      if (typeof upstreamResponse.body.pipe === 'function') {
        upstreamResponse.body.pipe(res);
      } else {
        const { Readable } = await import('stream');
        Readable.fromWeb(upstreamResponse.body).pipe(res);
      }
    } else {
      const text = await upstreamResponse.text();
      res.send(text);
    }
  } catch (error) {
    console.error('[AI proxy error]:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
});

app.post('/api/external-finance', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ success: false, error: 'Query text is required' });
    }

    const financeContext = await externalFinanceService.buildFinanceContext(query);
    res.json({ success: true, query, financeContext });
  } catch (error) {
    console.error('[External Finance] Error fetching data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Execute Python code and generate files
 * POST /api/generate-file
 * Body: { code: string, filename: string, language?: 'python' | 'javascript' | etc }
 */
app.post('/api/generate-file', async (req, res) => {
  try {
    const { code, filename, language = 'python' } = req.body;

    if (!code || !filename) {
      return res.status(400).json({
        success: false,
        error: 'Code and filename are required',
      });
    }

    // Sanitize filename to prevent directory traversal
    const sanitizedFilename = path.basename(filename);
    const outputPath = path.join(tempDir, sanitizedFilename);

    // Add header comment with generation info
    const headerComment = `# Generated by Orion AI File Generator\n# Generated at ${new Date().toISOString()}\n\n`;
    const fullCode = headerComment + code;

    // Execute based on language
    if (language === 'python') {
      return executePython(fullCode, outputPath, sanitizedFilename, res);
    } else if (language === 'javascript') {
      return executeJavaScript(fullCode, outputPath, sanitizedFilename, res);
    } else {
      // For other languages, just save the file as-is
      fs.writeFileSync(outputPath, code, 'utf-8');
      return res.json({
        success: true,
        filename: sanitizedFilename,
        downloadUrl: `/download/${sanitizedFilename}`,
        message: `File ${sanitizedFilename} generated successfully`,
      });
    }
  } catch (error) {
    console.error('File generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Execute Python code
 */
function executePython(code, outputPath, filename, res) {
  return new Promise(() => {
    // Create a script to execute
    const scriptPath = path.join(tempDir, `script_${Date.now()}.py`);
    fs.writeFileSync(scriptPath, code, 'utf-8');

    const python = spawn('python', [scriptPath], {
      timeout: 30000, // 30 second timeout
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      // Clean up script
      try {
        fs.unlinkSync(scriptPath);
      } catch {
        // ignore
      }

      if (code === 0) {
        // Check if output file was created
        if (fs.existsSync(outputPath)) {
          res.json({
            success: true,
            filename,
            downloadUrl: `/download/${filename}`,
            output: stdout,
            message: `File ${filename} generated successfully`,
          });
        } else {
          res.json({
            success: true,
            filename,
            output: stdout,
            message: 'Code executed successfully',
          });
        }
      } else {
        res.status(400).json({
          success: false,
          error: stderr || 'Python execution failed',
          code,
        });
      }
    });

    python.on('error', (error) => {
      res.status(500).json({
        success: false,
        error: `Failed to execute Python: ${error.message}`,
      });
    });
  });
}

/**
 * Execute JavaScript code
 */
function executeJavaScript(code, outputPath, filename, res) {
  try {
    // For safety, we only allow file writing, no dangerous operations
    const vm = require('vm');
    const sandbox = {
      require,
      console,
      fs,
      process: { env: {} },
      Buffer,
      __dirname: tempDir,
      __filename: outputPath,
    };

    vm.runInNewContext(code, sandbox, { timeout: 5000 });

    if (fs.existsSync(outputPath)) {
      res.json({
        success: true,
        filename,
        downloadUrl: `/download/${filename}`,
        message: `File ${filename} generated successfully`,
      });
    } else {
      res.json({
        success: true,
        filename,
        message: 'Code executed successfully',
      });
    }
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Web Search + DeepSeek Integration Endpoint
 * POST /api/chat/web-search
 */
/**
 * Map frontend model names to valid DeepSeek models
 */
const mapModelToDeepSeek = (modelName) => {
  const modelMap = {
    'deepernova-1.2-flash': 'deepseek-chat',
    'deepernova-2.3-pro': 'deepseek-chat',
    'deepernova-4.6-giga': 'deepseek-chat',
    'deepseek-chat': 'deepseek-chat',
    'deepseek-coder': 'deepseek-coder',
    'deepseek-v4-pro': 'deepseek-v4-pro'
  };
  return modelMap[modelName] || 'deepseek-chat';
};

/**
 * Validate and normalize language code
 */
const validateLanguage = (lang) => {
  const validLanguages = ['id', 'en', 'ja', 'zh', 'es', 'fr', 'de'];
  return validLanguages.includes(lang) ? lang : 'id';
};

app.post('/api/chat/web-search', express.json(), async (req, res) => {
  try {
    let { query, conversationHistory = [], language = 'id', model = 'deepseek-chat' } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        error: 'Query parameter diperlukan',
        code: 'INVALID_QUERY'
      });
    }

    // Normalize model and language
    const validModel = mapModelToDeepSeek(model);
    language = validateLanguage(language);

    console.log(`\n[WebSearch] 🔍 Processing web search for: "${query}"`);
    console.log(`[WebSearch] Language: ${language}, Model: ${model} → ${validModel}`);

    // Step 1: Perform web search
    console.log('[WebSearch] 📡 Calling SerpAPI...');
    const searchResult = await webSearchService.searchGoogle(query, 5, language);

    let systemPrompt = '';

    if (searchResult.success && searchResult.results.length > 0) {
      // Search succeeded - build augmented system prompt
      console.log(`[WebSearch] ✅ Search succeeded! Found ${searchResult.results.length} results`);

      const searchContext = webSearchService.formatSearchResultsForPrompt(searchResult.results);
      systemPrompt = `Anda adalah asisten AI yang membantu pengguna Indonesia. Berikut adalah hasil pencarian web terkini untuk pertanyaan mereka:

${searchContext}

Gunakan informasi di atas untuk menjawab pertanyaan pengguna. Berikan jawaban yang informatif, akurat, dan sertakan sumber ketika relevan.`;
    } else {
      // Search failed - return error message
      console.log(`[WebSearch] ❌ Search failed: ${searchResult.error || 'Unknown error'}`);
      const errorMessage = webSearchService.getErrorMessage();
      
      return res.status(503).json({
        error: errorMessage,
        code: 'WEB_SEARCH_FAILED',
        details: searchResult.error,
        searchPerformed: true,
        searchSucceeded: false
      });
    }

    // Step 2: Send to DeepSeek with augmented context
    console.log('[WebSearch] 📤 Sending to DeepSeek with search context...');

    // Build messages array
    const messages = [];
    
    // Add system prompt with search results
    messages.push({
      role: 'system',
      content: systemPrompt
    });

    // Add conversation history - clean up format for API
    if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
      for (const histMessage of conversationHistory) {
        // Extract only role and content, filter out custom fields
        const cleanMessage = {
          role: histMessage.sender === 'user' ? 'user' : 'assistant',
          content: histMessage.text || histMessage.content || ''
        };
        if (cleanMessage.content) {
          messages.push(cleanMessage);
        }
      }
    }

    // Add current user query
    messages.push({
      role: 'user',
      content: query
    });

    // Call DeepSeek API with validated model
    const deepseekResponse = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: validModel,  // Use mapped model, never trust frontend model name
        messages: messages,
        temperature: 0.7,
        max_tokens: 2048,
        stream: false
      })
    });

    if (!deepseekResponse.ok) {
      console.error(`[WebSearch] ❌ DeepSeek error: ${deepseekResponse.status}`);
      return res.status(deepseekResponse.status).json({
        error: 'Maaf, terjadi kesalahan saat memproses jawaban. Silahkan coba lagi.',
        code: 'DEEPSEEK_ERROR'
      });
    }

    const deepseekData = await deepseekResponse.json();

    // Extract answer from DeepSeek
    const answer = deepseekData.choices?.[0]?.message?.content || '';

    if (!answer) {
      console.warn('[WebSearch] ⚠️  DeepSeek returned empty answer');
      return res.status(500).json({
        error: 'DeepSeek returned empty response',
        code: 'EMPTY_RESPONSE'
      });
    }

    console.log(`[WebSearch] ✅ SUCCESS! Got answer from DeepSeek (${answer.length} chars)`);

    // Return successful response
    return res.json({
      success: true,
      query: query,
      answer: answer,
      searchResults: searchResult.results,
      model: model,
      language: language,
      searchPerformed: true,
      searchSucceeded: true
    });

  } catch (error) {
    console.error('[WebSearch] ❌ Endpoint error:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * List generated files
 */
app.get('/api/files', (req, res) => {
  try {
    const files = fs.readdirSync(tempDir);
    const filesList = files
      .filter((f) => !f.endsWith('.py')) // Don't list temp scripts
      .map((f) => ({
        filename: f,
        size: fs.statSync(path.join(tempDir, f)).size,
        downloadUrl: `/download/${f}`,
      }));

    res.json({
      success: true,
      files: filesList,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Delete generated file
 */
app.delete('/api/files/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const sanitized = path.basename(filename);
    const filePath = path.join(tempDir, sanitized);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({
        success: true,
        message: `File ${sanitized} deleted`,
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'File not found',
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Clear all temporary files
 */
app.post('/api/files/clear', (req, res) => {
  try {
    const files = fs.readdirSync(tempDir);
    files.forEach((f) => {
      fs.unlinkSync(path.join(tempDir, f));
    });

    res.json({
      success: true,
      message: 'All files cleared',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * AUTH ROUTES
 */

// Login with email and password
app.post('/auth/login', (req, res, next) => {
  passport.authenticate('local', { session: false }, (err, user, info) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!user) {
      // Return the specific error message from passport
      return res.status(401).json({ 
        error: true, 
        message: info.message || 'Authentication failed',
        code: info.code || 'AUTH_FAILED'
      });
    }

    // Set the user in request for req.login
    req.user = user;
    
    req.login(user, (loginErr) => {
      if (loginErr) {
        return res.status(500).json({ error: loginErr.message });
      }
      req.session.isGuest = false;
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('[AUTH/LOGIN] Session save error:', saveErr.message);
        }

        // Query fresh user data
        const freshUser = userDb.findById(user.id);
        const userWithoutPassword = {
          id: freshUser.id,
          email: freshUser.email,
          name: freshUser.name,
          picture: freshUser.picture,
          createdAt: freshUser.createdAt
        };
        res.json({ success: true, user: userWithoutPassword });
      });
    });
  })(req, res, next);
});

// Register with email and password
app.post('/auth/register', async (req, res) => {
  const { email, name, password } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const displayName = String(name || '').trim();

  if (!normalizedEmail || !displayName) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }

  // Enforce @deepmail.com domain for all accounts
  if (!normalizedEmail.endsWith('@deepmail.com')) {
    return res.status(400).json({ error: 'Email harus menggunakan domain @deepmail.com (contoh: user@deepmail.com)' });
  }

  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password minimal 8 karakter.' });
  }

  try {
    let user = userDb.findByEmail(normalizedEmail);
    if (user) {
      return res.status(409).json({ error: 'Email sudah terdaftar.' });
    }

    const hashedPassword = await hashPassword(password);
    const userId = uuidv4();
    user = userDb.create(userId, normalizedEmail, displayName, hashedPassword, null);

    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      req.session.isGuest = false;
      const userWithoutPassword = {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        createdAt: user.createdAt
      };
      res.json({ success: true, user: userWithoutPassword });
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registrasi gagal. Coba lagi nanti.' });
  }
});

// Guest chat access without email login
app.post('/auth/guest', (req, res) => {
  req.session.isGuest = true;
  const guestUser = {
    name: 'Guest',
    email: 'guest@deepernova.com',
    guest: true,
  };
  res.json({ success: true, guest: true, user: guestUser });
});

// Get current user
app.get('/auth/me', (req, res) => {
  console.log(`[AUTH/ME] Session ID: ${req.sessionID}, isGuest: ${req.session.isGuest}, isAuthenticated: ${req.isAuthenticated()}, User: ${req.user ? req.user.email : 'none'}`);
  
  if (req.session.isGuest) {
    console.log(`[AUTH/ME] Returning guest user`);
    return res.json({
      authenticated: false,
      guest: true,
      user: { name: 'Guest', email: 'guest@deepernova.com', guest: true },
    });
  }

  if (!req.isAuthenticated()) {
    console.log(`[AUTH/ME] Not authenticated, returning 401`);
    return res.status(401).json({ authenticated: false });
  }

  // Query fresh user data
  const freshUser = userDb.findById(req.user.id);
  const userWithoutPassword = {
    id: freshUser.id,
    email: freshUser.email,
    name: freshUser.name,
    picture: freshUser.picture,
    createdAt: freshUser.createdAt
  };

  console.log(`[AUTH/ME] Authenticated user: ${userWithoutPassword.email}`);
  res.json({ authenticated: true, user: userWithoutPassword });
});

// Logout
app.post('/auth/logout', (req, res) => {
  req.session.isGuest = false;

  const finishLogout = () => {
    req.session.destroy((err) => {
      if (err) {
        console.error('[AUTH/LOGOUT] Session destroy error:', err.message);
      }
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  };

  if (req.isAuthenticated && req.isAuthenticated()) {
    req.logout((err) => {
      if (err) {
        console.error('[AUTH/LOGOUT] Logout error:', err.message);
      }
      finishLogout();
    });
  } else {
    finishLogout();
  }
});

/**
 * CHAT SESSION ROUTES (require authentication)
 */

// Create new chat session
app.post('/api/sessions', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
  
  const { title } = req.body;
  const sessionId = uuidv4();
  const session = sessionDb.create(sessionId, req.user.id, title);
  res.json({ success: true, session });
});

// Get all sessions for user
app.get('/api/sessions', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
  
  const sessions = sessionDb.findByUserId(req.user.id);
  res.json({ success: true, sessions });
});

// Get session with messages
app.get('/api/sessions/:sessionId', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
  
  const session = sessionDb.findById(req.params.sessionId);
  if (!session || session.userId !== req.user.id) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const messages = messageDb.findBySessionId(req.params.sessionId);
  res.json({ success: true, session, messages });
});

// Update session (title, etc)
app.put('/api/sessions/:sessionId', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
  
  const session = sessionDb.findById(req.params.sessionId);
  if (!session || session.userId !== req.user.id) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const updated = sessionDb.update(req.params.sessionId, req.body);
  res.json({ success: true, session: updated });
});

// Delete session
app.delete('/api/sessions/:sessionId', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
  
  const session = sessionDb.findById(req.params.sessionId);
  if (!session || session.userId !== req.user.id) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  sessionDb.delete(req.params.sessionId);
  res.json({ success: true });
});

/**
 * CHAT MESSAGE ROUTES (require authentication)
 */

// Save chat message
app.post('/api/messages', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
  
  const { sessionId, role, content, personality } = req.body;
  
  // Verify session ownership
  const session = sessionDb.findById(sessionId);
  if (!session || session.userId !== req.user.id) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const messageId = uuidv4();
  const message = messageDb.create(messageId, sessionId, req.user.id, role, content, personality);
  res.json({ success: true, message });
});

/**
 * API KEY ROUTES (require authentication)
 */

// Get all API keys for logged-in user
app.get('/api/apikeys', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
  
  const keys = apiKeyDb.findByUserId(req.user.id);
  // Don't send full key to frontend, only partial for display
  const safeKeys = keys.map(k => ({
    id: k.id,
    name: k.name,
    key: k.key.substring(0, 10) + '...' + k.key.substring(k.key.length - 5),
    isActive: k.isActive,
    lastUsed: k.lastUsed,
    createdAt: k.createdAt
  }));
  res.json({ success: true, keys: safeKeys });
});

// Get full API key (for copying)
app.get('/api/apikeys/:id/full', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
  
  const key = apiKeyDb.findById(req.params.id);
  if (!key || key.userId !== req.user.id) {
    return res.status(404).json({ error: 'API key not found' });
  }
  
  res.json({ success: true, fullKey: key.key });
});

// Create new API key
app.post('/api/apikeys', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
  
  const { name } = req.body;
  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'API key name is required' });
  }
  
  // Generate unique API key
  const key = `deepernova_${req.user.id.substring(0, 8)}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const id = uuidv4();
  
  try {
    const newKey = apiKeyDb.create(id, req.user.id, name.trim(), key);
    res.json({ 
      success: true, 
      key: {
        id: newKey.id,
        name: newKey.name,
        key: newKey.key,
        isActive: newKey.isActive,
        createdAt: newKey.createdAt
      }
    });
  } catch (err) {
    console.error('Error creating API key:', err);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

// Update API key (name, isActive)
app.put('/api/apikeys/:id', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
  
  const key = apiKeyDb.findById(req.params.id);
  if (!key || key.userId !== req.user.id) {
    return res.status(404).json({ error: 'API key not found' });
  }
  
  const { name, isActive } = req.body;
  const updates = {};
  
  if (name !== undefined) updates.name = name;
  if (isActive !== undefined) updates.isActive = isActive ? 1 : 0;
  
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No updates provided' });
  }
  
  try {
    const updated = apiKeyDb.update(req.params.id, updates);
    res.json({ 
      success: true, 
      key: {
        id: updated.id,
        name: updated.name,
        key: updated.key.substring(0, 10) + '...' + updated.key.substring(updated.key.length - 5),
        isActive: updated.isActive,
        lastUsed: updated.lastUsed,
        createdAt: updated.createdAt
      }
    });
  } catch (err) {
    console.error('Error updating API key:', err);
    res.status(500).json({ error: 'Failed to update API key' });
  }
});

// Delete API key
app.delete('/api/apikeys/:id', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
  
  const key = apiKeyDb.findById(req.params.id);
  if (!key || key.userId !== req.user.id) {
    return res.status(404).json({ error: 'API key not found' });
  }
  
  try {
    apiKeyDb.delete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting API key:', err);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});

/**
 * CONVERSATION PERSISTENCE ROUTES (for frontend state sync)
 * Saves/loads conversation history for authenticated users to backend
 */

// GET /api/conversations - Load all conversations for user
app.get('/api/conversations', (req, res) => {
  try {
    // Support both authenticated users and guests
    if (req.isAuthenticated && req.isAuthenticated()) {
      // Authenticated user: load from database
      const userId = req.user.id;
      const stmt = db.prepare(`
        SELECT 
          cs.id,
          cs.title,
          cs.createdAt,
          cs.updatedAt,
          json_group_array(
            json_object(
              'id', cm.id,
              'sender', CASE WHEN cm.role = 'user' THEN 'user' ELSE 'bot' END,
              'text', cm.content,
              'timestamp', cm.createdAt,
              'personality', cm.personality
            )
          ) as messagesJson
        FROM chat_sessions cs
        LEFT JOIN chat_messages cm ON cs.id = cm.sessionId
        WHERE cs.userId = ?
        GROUP BY cs.id
        ORDER BY cs.updatedAt DESC
        LIMIT 50
      `);
      
      const sessions = stmt.all(userId);
      
      const conversations = sessions.map(session => {
        const messages = session.messagesJson ? JSON.parse(session.messagesJson).filter(m => m.id) : [];
        
        console.log(`[API/CONV] Session ${session.id}: Loaded ${messages.length} messages from DB`);
        
        // Fetch images for this session as backup
        const images = imageDb.findBySessionId(session.id);
        console.log(`[API/CONV] Session ${session.id}: Found ${images.length} images in database`);
        
        // Enhance messages by extracting image URLs from markdown or matching with stored images
        const enhancedMessages = messages.map((msg, idx) => {
          // Check if message contains image markdown: ![Generated Image](URL)
          const imgMarkdownMatch = msg.text?.match(/!\[Generated Image\]\(([^)]+)\)/);
          
          if (imgMarkdownMatch && imgMarkdownMatch[1]) {
            const extractedUrl = imgMarkdownMatch[1];
            console.log(`[API/CONV] Message ${idx} (${msg.id}): Found image markdown, extracted URL: ${extractedUrl.substring(0, 80)}...`);
            
            // Try to find matching image by URL in the images array
            const matchedImage = images.find(img => img.imageUrl === extractedUrl);
            if (matchedImage) {
              console.log(`[API/CONV] Message ${idx}: Matched with image ID ${matchedImage.id}`);
              return {
                ...msg,
                imageUrl: extractedUrl,
                imageId: matchedImage.id,
                model: matchedImage.model,
                size: matchedImage.size,
                isImage: true
              };
            }
            
            // If no URL match, still return with imageUrl (for backward compatibility)
            console.log(`[API/CONV] Message ${idx}: No image DB match, using extracted URL directly`);
            return {
              ...msg,
              imageUrl: extractedUrl,
              isImage: true
            };
          }
          
          // Fallback: if no markdown found but message appears to be image-related,
          // try to match with stored image by time proximity
          if (msg.text && msg.text.includes('<reasoning>') && images.length > 0) {
            console.log(`[API/CONV] Message ${idx}: No markdown found, trying time-based matching...`);
            const messageTime = new Date(msg.timestamp).getTime();
            // Find image closest in time to this message
            const closestImage = images.reduce((closest, img) => {
              const imgTime = new Date(img.createdAt).getTime();
              const timeDiff = Math.abs(messageTime - imgTime);
              if (!closest || timeDiff < closest.timeDiff) {
                return { ...img, timeDiff };
              }
              return closest;
            }, null);
            
            if (closestImage && closestImage.timeDiff < 5000) { // within 5 seconds
              console.log(`[API/CONV] Message ${idx}: Matched image ${closestImage.id} via time (diff: ${closestImage.timeDiff}ms)`);
              return {
                ...msg,
                imageUrl: closestImage.imageUrl,
                imageId: closestImage.id,
                isImage: true
              };
            }
          }
          
          return msg;
        });
        
        console.log(`[API/CONV] Session ${session.id}: Enhanced ${enhancedMessages.filter(m => m.isImage).length} messages with images`);
        
        return {
          id: session.id,
          title: session.title,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          messages: enhancedMessages,
          images: images.map(img => ({
            id: img.id,
            sessionId: img.sessionId,
            prompt: img.prompt,
            imageUrl: img.imageUrl,
            model: img.model,
            size: img.size,
            reasoningUrl: img.reasoningUrl,
            createdAt: img.createdAt
          }))
        };
      });
      
      console.log(`[API/CONVERSATIONS] Returning ${conversations.length} conversations for user ${userId}`);
      conversations.forEach((c, idx) => {
        const imageCount = c.images.length;
        console.log(`  [${idx}] ID: ${c.id}, Messages: ${c.messages.length}, Images: ${imageCount}, Updated: ${c.updatedAt}`);
      });
      return res.json({ success: true, conversations });
    } else if (req.session.isGuest) {
      // Guest user: return empty (guests use localStorage)
      return res.json({ success: true, conversations: [] });
    } else {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  } catch (err) {
    console.error('Error loading conversations:', err);
    res.status(500).json({ error: 'Failed to load conversations' });
  }
});

// POST /api/conversations - Save conversations for user
app.post('/api/conversations', async (req, res) => {
  try {
    if (!(req.isAuthenticated && req.isAuthenticated())) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.user.id;
    const { conversations } = req.body;

    if (!Array.isArray(conversations)) {
      return res.status(400).json({ error: 'Conversations must be an array' });
    }

    // Use transaction for atomicity
    const saveConversations = db.transaction(() => {
      const sessionIds = conversations.filter(conv => conv.id).map(conv => conv.id);
      if (sessionIds.length > 0) {
        const placeholders = sessionIds.map(() => '?').join(',');
        db.prepare(`DELETE FROM chat_sessions WHERE userId = ? AND id NOT IN (${placeholders})`).run(userId, ...sessionIds);
      } else {
        db.prepare('DELETE FROM chat_sessions WHERE userId = ?').run(userId);
      }

      conversations.forEach(conv => {
        if (!conv.id || !conv.title || !Array.isArray(conv.messages)) {
          return; // Skip invalid conversations
        }

        // Create or update session
        const existingSession = db.prepare('SELECT id FROM chat_sessions WHERE id = ? AND userId = ?').get(conv.id, userId);
        
        if (existingSession) {
          // Update existing session
          db.prepare('UPDATE chat_sessions SET title = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?')
            .run(conv.title, conv.id);
        } else {
          // Create new session
          db.prepare(`
            INSERT INTO chat_sessions (id, userId, title, createdAt, updatedAt)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).run(conv.id, userId, conv.title);
        }

        // Delete old messages for this session
        db.prepare('DELETE FROM chat_messages WHERE sessionId = ?').run(conv.id);

        // Insert new messages with conflict resolution
        const insertMsg = db.prepare(`
          INSERT OR REPLACE INTO chat_messages (id, sessionId, userId, role, content, personality, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        // Track message IDs to detect duplicates
        const messageIds = new Set();
        const duplicateIds = [];

        conv.messages.forEach((msg, idx) => {
          const msgId = msg.id || `msg_${conv.id}_${idx}_${Date.now()}`;
          
          if (messageIds.has(msgId)) {
            duplicateIds.push(msgId);
          }
          messageIds.add(msgId);

          insertMsg.run(
            msgId,
            conv.id,
            userId,
            msg.sender === 'user' ? 'user' : 'assistant',
            msg.text || msg.content || '',
            msg.personality || 'formal',
            msg.timestamp || new Date().toISOString()
          );
        });

        if (duplicateIds.length > 0) {
          console.log(`[API/CONV] ⚠️ Session ${conv.id}: Found ${duplicateIds.length} duplicate message IDs (will be replaced):`, duplicateIds.slice(0, 5));
        }
      });
    });

    try {
      saveConversations();
      
      // Extract and save conclusions from conversations (asynchronously, don't block response)
      try {
        const MemoryExtractionService = (await import('./memoryExtractionService.js')).default;
        conversations.forEach(conv => {
          if (conv.messages && Array.isArray(conv.messages)) {
            // Process each conversation asynchronously
            setImmediate(() => {
              MemoryExtractionService.processConversation(conv.messages, userId, conv.id)
                .catch(err => console.error('[MEMORY] Error processing conversation:', err));
            });
          }
        });
      } catch (memErr) {
        console.error('[MEMORY] Error initializing memory extraction:', memErr);
      }
      
      console.log(`[API/CONVERSATIONS] Successfully saved ${conversations.length} conversations for user ${userId}`);
      res.json({ success: true, message: 'Conversations saved', count: conversations.length });
    } catch (txErr) {
      console.error('Transaction error:', txErr);
      res.status(500).json({ error: 'Failed to save conversations' });
    }
  } catch (err) {
    console.error('Error saving conversations:', err);
    res.status(500).json({ error: 'Failed to save conversations' });
  }
});

// DELETE /api/conversations - Delete all conversations for user
app.delete('/api/conversations', (req, res) => {
  try {
    if (!(req.isAuthenticated && req.isAuthenticated())) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.user.id;

    // Get all session IDs for user
    // Delete all messages for these sessions (will cascade due to FK)
    const deleteStmt = db.prepare('DELETE FROM chat_sessions WHERE userId = ?');
    deleteStmt.run(userId);

    res.json({ success: true, message: 'All conversations deleted' });
  } catch (err) {
    console.error('Error deleting conversations:', err);
    res.status(500).json({ error: 'Failed to delete conversations' });
  }
});

// DELETE /api/conversations/:conversationId - Delete specific conversation
app.delete('/api/conversations/:conversationId', (req, res) => {
  try {
    if (!(req.isAuthenticated && req.isAuthenticated())) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { conversationId } = req.params;
    const userId = req.user.id;

    // Verify user owns this conversation
    const session = db.prepare('SELECT id FROM chat_sessions WHERE id = ? AND userId = ?').get(conversationId, userId);
    
    if (!session) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Delete conversation (messages will cascade delete)
    db.prepare('DELETE FROM chat_sessions WHERE id = ?').run(conversationId);

    res.json({ success: true, message: 'Conversation deleted' });
  } catch (err) {
    console.error('Error deleting conversation:', err);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

/**
 * LONG-TERM MEMORY ROUTES (Backend only - stores knowledge about user)
 */

// GET /api/memory/user - Get all long-term memories for authenticated user
app.get('/api/memory/user', (req, res) => {
  try {
    if (!(req.isAuthenticated && req.isAuthenticated())) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.user.id;
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;
    
    const { memoryDb } = require('./database.js');
    const memories = memoryDb.findByUser(userId, limit);
    
    console.log(`[MEMORY] Retrieved ${memories.length} memories for user ${userId}`);
    res.json({ success: true, memories, count: memories.length });
  } catch (err) {
    console.error('Error fetching memories:', err);
    res.status(500).json({ error: 'Failed to fetch memories' });
  }
});

// GET /api/memory/export - Export long-term memories as TXT file
app.get('/api/memory/export', (req, res) => {
  try {
    if (!(req.isAuthenticated && req.isAuthenticated())) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.user.id;
    const { memoryDb } = require('./database.js');
    const textContent = memoryDb.getAsText(userId);
    
    console.log(`[MEMORY] Exporting memories for user ${userId}`);
    
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="user_memory_${userId}.txt"`);
    res.send(textContent);
  } catch (err) {
    console.error('Error exporting memories:', err);
    res.status(500).json({ error: 'Failed to export memories' });
  }
});

// POST /api/memory - Add or update a long-term memory
app.post('/api/memory', (req, res) => {
  try {
    if (!(req.isAuthenticated && req.isAuthenticated())) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.user.id;
    const { summary, category, sourceSessionId } = req.body;

    if (!summary || !summary.trim()) {
      return res.status(400).json({ error: 'Summary is required' });
    }

    const { v4: uuidv4 } = require('uuid');
    const { memoryDb } = require('./database.js');
    const memoryId = uuidv4();

    const memory = memoryDb.create(memoryId, userId, summary.trim(), category || null, sourceSessionId || null);
    
    console.log(`[MEMORY] Created memory ${memoryId} for user ${userId}, category: ${category}`);
    res.json({ success: true, memory });
  } catch (err) {
    console.error('Error creating memory:', err);
    res.status(500).json({ error: 'Failed to create memory' });
  }
});

// DELETE /api/memory/:memoryId - Delete a long-term memory
app.delete('/api/memory/:memoryId', (req, res) => {
  try {
    if (!(req.isAuthenticated && req.isAuthenticated())) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.user.id;
    const { memoryId } = req.params;
    const { memoryDb } = require('./database.js');

    const memory = memoryDb.findById(memoryId);
    if (!memory || memory.userId !== userId) {
      return res.status(404).json({ error: 'Memory not found' });
    }

    memoryDb.delete(memoryId);
    console.log(`[MEMORY] Deleted memory ${memoryId} for user ${userId}`);
    res.json({ success: true, message: 'Memory deleted' });
  } catch (err) {
    console.error('Error deleting memory:', err);
    res.status(500).json({ error: 'Failed to delete memory' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ==================== SOURCE TRACKING ENDPOINTS ====================
/**
 * GET /api/sources/:conversationId
 * Get all sources for a conversation
 */
app.get('/api/sources/:conversationId', (req, res) => {
  try {
    const { conversationId } = req.params;
    const sources = sourceTracker.getUniqueSources(conversationId);
    res.json({
      success: true,
      conversationId,
      sources: sources,
      count: sources.length
    });
  } catch (error) {
    console.error('[Source API error]:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sources/:conversationId/:sourceId
 * Get details of a specific source
 */
app.get('/api/sources/:conversationId/:sourceId', (req, res) => {
  try {
    const { conversationId, sourceId } = req.params;
    const source = sourceTracker.getSourceDetails(conversationId, sourceId);
    
    if (!source) {
      return res.status(404).json({
        success: false,
        error: 'Source not found'
      });
    }
    
    res.json({
      success: true,
      source: source
    });
  } catch (error) {
    console.error('[Source detail error]:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sources/:conversationId/add-web-search
 * Add web search sources to conversation
 */
app.post('/api/sources/:conversationId/add-web-search', express.json(), (req, res) => {
  try {
    const { conversationId } = req.params;
    const { query, results } = req.body;
    
    if (!query || !results || !Array.isArray(results)) {
      return res.status(400).json({
        success: false,
        error: 'query and results array are required'
      });
    }
    
    sourceTracker.addWebSearchSources(conversationId, query, results);
    const sources = sourceTracker.getUniqueSources(conversationId);
    
    res.json({
      success: true,
      conversationId,
      sources: sources,
      count: sources.length
    });
  } catch (error) {
    console.error('[Add sources error]:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/sources/:conversationId
 * Clear all sources for a conversation
 */
app.delete('/api/sources/:conversationId', (req, res) => {
  try {
    const { conversationId } = req.params;
    sourceTracker.clearSources(conversationId);
    
    res.json({
      success: true,
      message: 'Sources cleared for conversation',
      conversationId
    });
  } catch (error) {
    console.error('[Clear sources error]:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== DOCUMENT ARTIFACT ROUTES (session-persistent) =====
// Save a new artifact
app.post('/api/artifacts', express.json(), (req, res) => {
  try {
    const { sessionId, prompt, response, type, title, content, excelSheets, activeSheet } = req.body;
    if (!sessionId || !prompt || !response) {
      return res.status(400).json({ error: 'sessionId, prompt, and response are required' });
    }
    const id = uuidv4();
    const userId = (req.isAuthenticated && req.isAuthenticated()) ? req.user.id : null;
    const artifact = artifactDb.create(id, sessionId, prompt, response, type, title, content, excelSheets, activeSheet, userId);
    res.json({ success: true, artifact });
  } catch (error) {
    console.error('[Save artifact error]:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get artifacts by session ID
app.get('/api/artifacts/session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const artifacts = artifactDb.findBySessionId(sessionId);
    res.json({ success: true, artifacts });
  } catch (error) {
    console.error('[Get artifacts error]:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get artifacts by user ID (authenticated users)
app.get('/api/artifacts/user/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const artifacts = artifactDb.findByUserId(userId);
    res.json({ success: true, artifacts });
  } catch (error) {
    console.error('[Get user artifacts error]:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete an artifact
app.delete('/api/artifacts/:id', (req, res) => {
  try {
    const { id } = req.params;
    artifactDb.delete(id);
    res.json({ success: true });
  } catch (error) {
    console.error('[Delete artifact error]:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete all artifacts for a session
app.delete('/api/artifacts/session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    artifactDb.deleteBySessionId(sessionId);
    res.json({ success: true });
  } catch (error) {
    console.error('[Clear session artifacts error]:', error);
    res.status(500).json({ error: error.message });
  }
});

// Deepernova API Proxy Routes (hide Deepseek backend)
app.use('/api/v1', apiProxyRoutes);

// ============== DOCUMENT GENERATION API ==============

/**
 * POST /api/documents/generate/word
 * Generate a Word document
 * Body: { content: string, title: string, userId: string }
 */
app.post('/api/documents/generate/word', async (req, res) => {
  try {
    if (!(req.isAuthenticated && req.isAuthenticated())) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { content, title = 'Generated Document' } = req.body;
    
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Content is required' });
    }

    console.log(`[DOCGEN] Generating Word document for user ${req.user.id}`);

    // Generate document with progress tracking
    const result = await DocumentGeneratorService.generateWordDocument(
      content,
      title,
      (progress) => {
        console.log(`[DOCGEN] Step ${progress.step}: ${progress.status}`);
      }
    );

    res.json({
      success: true,
      file: result,
      downloadUrl: DocumentGeneratorService.getDownloadUrl(result.fileName),
      viewerUrl: DocumentGeneratorService.getViewerUrl(result.fileName, 'docx')
    });
  } catch (err) {
    console.error('[DOCGEN] Word generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/documents/generate/excel
 * Generate an Excel spreadsheet
 * Body: { content: string, title: string, userId: string }
 */
app.post('/api/documents/generate/excel', async (req, res) => {
  try {
    if (!(req.isAuthenticated && req.isAuthenticated())) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { content, title = 'Generated Spreadsheet' } = req.body;
    
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Content is required' });
    }

    console.log(`[DOCGEN] Generating Excel document for user ${req.user.id}`);

    // Generate document with progress tracking
    const result = await DocumentGeneratorService.generateExcelDocument(
      content,
      title,
      (progress) => {
        console.log(`[DOCGEN] Step ${progress.step}: ${progress.status}`);
      }
    );

    res.json({
      success: true,
      file: result,
      downloadUrl: DocumentGeneratorService.getDownloadUrl(result.fileName),
      viewerUrl: DocumentGeneratorService.getViewerUrl(result.fileName, 'xlsx')
    });
  } catch (err) {
    console.error('[DOCGEN] Excel generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/documents/download/:fileName
 * Download generated document
 */
app.get('/api/documents/download/:fileName', (req, res) => {
  try {
    const { fileName } = req.params;
    
    // Security: prevent directory traversal
    if (fileName.includes('..') || fileName.includes('/')) {
      return res.status(400).json({ error: 'Invalid file name' });
    }

    const filePath = path.join('./server/temp-files/documents', fileName);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Determine content type
    const ext = path.extname(fileName).toLowerCase();
    const contentType = ext === '.docx' 
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.sendFile(path.resolve(filePath));
  } catch (err) {
    console.error('[DOCGEN] Download error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/documents/view/docx/:fileName
 * View Word document (returns as downloadable for desktop apps)
 */
app.get('/api/documents/view/docx/:fileName', (req, res) => {
  try {
    const { fileName } = req.params;
    
    if (fileName.includes('..') || fileName.includes('/')) {
      return res.status(400).json({ error: 'Invalid file name' });
    }

    const filePath = path.join('./server/temp-files/documents', fileName);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.sendFile(path.resolve(filePath));
  } catch (err) {
    console.error('[DOCGEN] View error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/documents/view/xlsx/:fileName
 * View Excel spreadsheet
 */
app.get('/api/documents/view/xlsx/:fileName', (req, res) => {
  try {
    const { fileName } = req.params;
    
    if (fileName.includes('..') || fileName.includes('/')) {
      return res.status(400).json({ error: 'Invalid file name' });
    }

    const filePath = path.join('./server/temp-files/documents', fileName);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.sendFile(path.resolve(filePath));
  } catch (err) {
    console.error('[DOCGEN] View error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============== IMAGE GENERATION API ==============

const TOKENMIX_API_KEY = process.env.TOKENMIX_API_KEY || process.env.VITE_TOKENMIX_API_KEY;
const TOKENMIX_API_URL = 'https://api.tokenmix.ai/v1/images/generations';

/**
 * POST /api/images/generate
 * Generate an image using TokenMix API
 * Body: { prompt: string, size: string, model: string }
 */
app.post('/api/images/generate', async (req, res) => {
  try {
    // Get user info if authenticated
    const userId = req.user?.id || null;
    const { prompt, size = '1024x1024', model = 'imagen-4-fast', sessionId } = req.body;
    
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!TOKENMIX_API_KEY) {
      console.error('[IMG_GEN] TOKENMIX_API_KEY not configured');
      return res.status(500).json({ error: 'Image generation service not configured' });
    }

    console.log(`[IMG_GEN] Generating image with model: ${model}, size: ${size}`);
    console.log(`[IMG_GEN] Prompt: ${prompt.substring(0, 100)}...`);
    console.log(`[IMG_GEN] User: ${userId}, SessionId: ${sessionId}`);

    // Call TokenMix API
    const tokenMixResponse = await fetch(TOKENMIX_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKENMIX_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
        size,
      }),
    });

    if (!tokenMixResponse.ok) {
      const errorText = await tokenMixResponse.text();
      console.error('[IMG_GEN] TokenMix API error:', tokenMixResponse.status, errorText);
      throw new Error(`TokenMix API error: ${tokenMixResponse.status}`);
    }

    const imageData = await tokenMixResponse.json();
    console.log('[IMG_GEN] Image generated successfully');
    console.log('[IMG_GEN] 🔴 Raw TokenMix response:', JSON.stringify(imageData).substring(0, 500));

    // Try multiple formats to extract imageUrl from different API response structures
    let imageUrl = null;
    
    console.log('[IMG_GEN] 🔴 Full response keys:', Object.keys(imageData));
    console.log('[IMG_GEN] 🔴 imageData.data type:', typeof imageData.data, 'is array:', Array.isArray(imageData.data));
    
    // Try format 1: { data: [{ url: '...' }] }
    if (imageData.data && Array.isArray(imageData.data) && imageData.data.length > 0) {
      console.log('[IMG_GEN] 🔴 data[0] structure:', JSON.stringify(imageData.data[0]).substring(0, 300));
      if (imageData.data[0]?.url) {
        imageUrl = imageData.data[0].url;
        console.log('[IMG_GEN] ✅ Format 1 matched: data[0].url');
      } else if (typeof imageData.data[0] === 'string') {
        imageUrl = imageData.data[0];
        console.log('[IMG_GEN] ✅ Format 2 matched: data[0] as string');
      }
    }
    
    // Try format 2: { images: [{ url: '...' }] }
    if (!imageUrl && imageData.images && Array.isArray(imageData.images) && imageData.images.length > 0) {
      imageUrl = imageData.images[0]?.url;
      console.log('[IMG_GEN] ✅ Format 3 matched: images[0].url');
    }
    
    // Try format 3: { url: '...' }
    if (!imageUrl && imageData.url) {
      imageUrl = imageData.url;
      console.log('[IMG_GEN] ✅ Format 4 matched: root url');
    }
    
    // Try format 4: direct string URL
    if (!imageUrl && typeof imageData === 'string') {
      imageUrl = imageData;
      console.log('[IMG_GEN] ✅ Format 5 matched: direct string');
    }
    
    console.log('[IMG_GEN] 🔴 Final extracted imageUrl:', imageUrl);
    
    if (!imageUrl) {
      console.error('[IMG_GEN] ❌ No imageUrl found in any format!');
      console.log('[IMG_GEN] Full imageData:', JSON.stringify(imageData, null, 2).substring(0, 2000));
      throw new Error('TokenMix API returned no image URL in any expected format');
    }
    
    // Sanitize URL: fix common malformations
    // Fix malformed protocol (http// → https://)
    imageUrl = imageUrl.replace(/^http\/\//, 'https://');
    imageUrl = imageUrl.replace(/^https:\/\//, 'https://');
    
    // Remove double slashes from path (but preserve :// in protocol)
    imageUrl = imageUrl.replace(/([^:]\/)\/+/g, '$1');
    
    console.log('[IMG_GEN] 🔴 Sanitized imageUrl:', imageUrl);
    
    // Save image to database - validate sessionId exists before using it
    const imageId = uuidv4();
    let validSessionId = null;
    
    // Only use sessionId if it actually exists in the database
    if (sessionId && userId) {
      try {
        const sessionExists = db.prepare('SELECT id FROM chat_sessions WHERE id = ? AND userId = ?').get(sessionId, userId);
        if (sessionExists) {
          validSessionId = sessionId;
          console.log(`[IMG_GEN] Using sessionId: ${sessionId}`);
        } else {
          console.warn(`[IMG_GEN] SessionId ${sessionId} not found for user ${userId}, saving without sessionId`);
        }
      } catch (err) {
        console.warn(`[IMG_GEN] Error checking sessionId: ${err.message}`);
      }
    }
    
    imageDb.create(
      imageId,
      userId,
      validSessionId,
      prompt,
      imageUrl,
      model,
      size
    );
    
    console.log(`[IMG_GEN] ✅ Image saved to database with ID: ${imageId}`);

    // Image generation is now free for all users.
    res.json({
      success: true,
      image: {
        id: imageId,
        url: imageUrl,
        prompt,
        model,
        size,
        timestamp: new Date().toISOString(),
        savedToDb: true,
      },
    });
  } catch (err) {
    console.error('[IMG_GEN] Image generation error:', err);
    res.status(500).json({ error: 'Failed to generate image: ' + err.message });
  }
});

/**
 * GET /api/images/session/:sessionId
 * Get all images generated in a specific session
 */
app.get('/api/images/session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const images = imageDb.findBySessionId(sessionId);
    res.json({
      success: true,
      images: images || [],
      count: images?.length || 0,
    });
  } catch (err) {
    console.error('[IMG_GET] Error retrieving session images:', err);
    res.status(500).json({ error: 'Failed to retrieve images: ' + err.message });
  }
});

/**
 * GET /api/images/user
 * Get all images generated by current user
 */
app.get('/api/images/user', (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const images = imageDb.findByUserId(req.user.id);
    res.json({
      success: true,
      images: images || [],
      count: images?.length || 0,
    });
  } catch (err) {
    console.error('[IMG_GET] Error retrieving user images:', err);
    res.status(500).json({ error: 'Failed to retrieve images: ' + err.message });
  }
});

/**
 * GET /api/images/download/:imageId
 * Download an image (proxy from external URL with CORS support)
 */
app.get('/api/images/download/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    
    console.log(`[IMG_DOWNLOAD] Request to download image: ${imageId}`);
    
    // Find image in database
    const image = imageDb.findById(imageId);
    if (!image) {
      console.error(`[IMG_DOWNLOAD] Image not found in database: ${imageId}`);
      return res.status(404).send('Image not found');
    }
    
    if (!image.imageUrl) {
      console.error(`[IMG_DOWNLOAD] Image URL is empty for ID: ${imageId}`);
      return res.status(404).send('Image URL is empty');
    }

    console.log(`[IMG_DOWNLOAD] Found image ${imageId}, URL: ${image.imageUrl.substring(0, 100)}...`);

    // Fetch image from external URL with timeout
    const fetchPromise = fetch(image.imageUrl);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Fetch timeout')), 30000)
    );
    
    const imageResponse = await Promise.race([fetchPromise, timeoutPromise]);
    
    if (!imageResponse.ok) {
      console.error(`[IMG_DOWNLOAD] Failed to fetch from URL: ${imageResponse.status} ${imageResponse.statusText}`);
      return res.status(502).send('Failed to fetch image from source');
    }

    const contentType = imageResponse.headers.get('content-type') || 'image/png';
    console.log(`[IMG_DOWNLOAD] Fetched image successfully, Content-Type: ${contentType}`);

    // Get the image as buffer
    const arrayBuffer = await imageResponse.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);
    
    if (imageBuffer.length === 0) {
      console.error(`[IMG_DOWNLOAD] Empty buffer for image ${imageId}`);
      return res.status(500).send('Image buffer is empty');
    }

    // Determine file extension based on content type
    let fileExtension = '.png';
    if (contentType.includes('jpeg')) fileExtension = '.jpg';
    else if (contentType.includes('webp')) fileExtension = '.webp';
    else if (contentType.includes('gif')) fileExtension = '.gif';
    else if (contentType.includes('png')) fileExtension = '.png';

    // Set CORS and download headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', imageBuffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="orion-image-${imageId}${fileExtension}"`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    
    console.log(`[IMG_DOWNLOAD] ✅ Sending image ${imageId}, size: ${imageBuffer.length} bytes, type: ${contentType}`);
    res.send(imageBuffer);
  } catch (err) {
    console.error('[IMG_DOWNLOAD] Error downloading image:', err.message);
    res.status(500).send('Error: ' + err.message);
  }
});

/**
 * DELETE /api/images/:imageId
 * Delete a generated image
 */
app.delete('/api/images/:imageId', (req, res) => {
  try {
    const { imageId } = req.params;
    const image = imageDb.findById(imageId);
    
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    // Check ownership - user can only delete their own images
    if (req.user?.id && image.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this image' });
    }
    
    imageDb.delete(imageId);
    res.json({ success: true, message: 'Image deleted' });
  } catch (err) {
    console.error('[IMG_DEL] Error deleting image:', err);
    res.status(500).json({ error: 'Failed to delete image: ' + err.message });
  }
});

/**
/**
 * GET /api/user/rate-limit
 * Check rate limiting status
 */
app.get('/api/user/rate-limit', (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const rateLimitStatus = checkRateLimiting(userId);

    res.json({
      success: true,
      isRateLimited: rateLimitStatus.isRateLimited,
      messageCount: rateLimitStatus.messageCount
    });
  } catch (err) {
    console.error('[RATE_LIMIT] Error:', err);
    res.status(500).json({ error: 'Failed to check rate limit: ' + err.message });
  }
});

// ============ RESEARCH ENDPOINTS ============

// Smart research with caching decision
app.post('/api/research/smart-search', express.json(), async (req, res) => {
  try {
    const { query, userId, options = {} } = req.body;

    if (!query || !userId) {
      return res.status(400).json({ error: 'Query and userId required' });
    }

    const { researchService } = await import('./researchService.js');
    const result = await researchService.smartResearch(query, userId, options);

    res.json({
      success: true,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[RESEARCH] Smart search error:', error.message);
    res.status(500).json({
      error: 'Research failed: ' + error.message,
      success: false
    });
  }
});

// Get research memory (cached searches)
app.get('/api/research/memory/:userId', express.json(), async (req, res) => {
  try {
    const { userId } = req.params;
    const { category, limit = 50 } = req.query;

    const { researchMemoryDb } = await import('./database.js');

    let results;
    if (category) {
      results = researchMemoryDb.findByCategory(userId, category);
    } else {
      results = researchMemoryDb.findByUser(userId, parseInt(limit));
    }

    res.json({
      success: true,
      results,
      count: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[RESEARCH] Memory fetch error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch research memory: ' + error.message,
      success: false
    });
  }
});

// Direct SerpAPI search (without caching decision)
app.post('/api/research/direct-search', express.json(), async (req, res) => {
  try {
    const { query, options = {} } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query required' });
    }

    const { researchService } = await import('./researchService.js');
    const result = await researchService.search(query, options);

    res.json({
      success: true,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[RESEARCH] Direct search error:', error.message);
    res.status(500).json({
      error: 'Search failed: ' + error.message,
      success: false
    });
  }
});

// Format search results for AI context
app.post('/api/research/format-context', express.json(), async (req, res) => {
  try {
    const { searchData, maxTokens = 3000 } = req.body;

    if (!searchData) {
      return res.status(400).json({ error: 'searchData required' });
    }

    const { researchService } = await import('./researchService.js');
    const formatted = researchService.formatForAIContext(searchData, maxTokens);

    res.json({
      success: true,
      formatted,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[RESEARCH] Format context error:', error.message);
    res.status(500).json({
      error: 'Format failed: ' + error.message,
      success: false
    });
  }
});

// Get comprehensive research prompt
app.post('/api/research/generate-prompt', express.json(), async (req, res) => {
  try {
    const { query, searchData, cachedContext = '' } = req.body;

    if (!query || !searchData) {
      return res.status(400).json({ error: 'Query and searchData required' });
    }

    const { buildResearchPrompt, formatSourcesForDisplay, generateResearchSummary } = 
      await import('./researchPrompts.js');

    const prompt = buildResearchPrompt(query, searchData, cachedContext);
    const sources = formatSourcesForDisplay(searchData);
    const summary = generateResearchSummary(searchData);

    res.json({
      success: true,
      prompt,
      sources,
      summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[RESEARCH] Prompt generation error:', error.message);
    res.status(500).json({
      error: 'Prompt generation failed: ' + error.message,
      success: false
    });
  }
});

// Cleanup expired research memory
app.post('/api/research/cleanup', express.json(), async (req, res) => {
  try {
    const { researchMemoryDb } = await import('./database.js');
    const cleaned = researchMemoryDb.cleanExpired();

    res.json({
      success: true,
      cleanedRecords: cleaned,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[RESEARCH] Cleanup error:', error.message);
    res.status(500).json({
      error: 'Cleanup failed: ' + error.message,
      success: false
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 File Generation Server running on http://localhost:${PORT}`);
  console.log(`📁 Temp directory: ${tempDir}`);
  
  // Check Python availability for file uploads
  try {
    try {
      const version = execSync('python3 --version', { encoding: 'utf-8', stdio: 'pipe' });
      console.log(`✅ Python available: ${version.trim()}`);
    } catch {
      const version = execSync('python --version', { encoding: 'utf-8', stdio: 'pipe' });
      console.log(`✅ Python available: ${version.trim()}`);
    }
  } catch {
    console.warn(`⚠️  Python not found. File upload feature will not work.`);
    console.warn(`   Install Python 3 from: https://www.python.org/downloads/`);
  }
});
