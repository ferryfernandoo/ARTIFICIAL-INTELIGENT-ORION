import express from 'express';
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load env variables FIRST, before any other imports
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

// Now load other modules
import cors from 'cors';
import multer from 'multer';
import XLSX from 'xlsx';
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
import agentService from './agentService.js';
import sharp from 'sharp';

// RAG Service initialization flag
let ragInitialized = false;

// Initialize database
initializeDatabase();

const HARDCODED_DEEPSEEK_API_KEY = 'sk-bf333936dd084c5f9016521b1b896610';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY || HARDCODED_DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// Debug: Log if API key is loaded
if (!process.env.DEEPSEEK_API_KEY && !process.env.VITE_DEEPSEEK_API_KEY && process.env.NODE_ENV !== 'production') {
  console.warn(`⚠️  Using hardcoded fallback DEEPSEEK_API_KEY because .env is not set.`);
}

const app = express();
app.set('trust proxy', 1);
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
      'https://deepernova.com',
      'https://www.deepernova.com',
      'https://indoai-sigma.vercel.app',
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

// Serve static files from public folder (for watermarked images, etc.)
app.use(express.static(path.join(process.cwd(), 'public')));

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

// Ensure PPT temp directory exists
const tempPptDir = path.join(__dirname, 'temp_ppt');
if (!fs.existsSync(tempPptDir)) {
  fs.mkdirSync(tempPptDir, { recursive: true });
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
      'application/vnd.ms-powerpoint',
      // Image formats for vision analysis
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif'
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
app.use('/download', express.static(tempPptDir));
app.use('/download/uploads', express.static(uploadsDir));

/**
 * POST /api/vision/upload
 * Upload an image and return a public URL for vision analysis
 */
app.post('/api/vision/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    const fileUrl = `${req.protocol}://${req.get('host')}/download/uploads/${encodeURIComponent(req.file.filename)}`;
    console.log('[VISION_UPLOAD] Saved image:', req.file.filename);
    console.log('[VISION_UPLOAD] Public URL:', fileUrl);

    res.json({
      success: true,
      url: fileUrl,
      filename: req.file.filename,
    });
  } catch (err) {
    console.error('[VISION_UPLOAD] Error uploading image:', err);
    res.status(500).json({ error: 'Vision upload failed: ' + err.message });
  }
});

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
    console.log('[DEBUG] Total messages in array:', messages.length);
    for (let i = 0; i < messages.length; i++) {
      console.log(`[DEBUG] Message ${i}: role="${messages[i].role}", content="${messages[i].content.substring(0, 50)}..."`);
    }
    
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userQuery = messages[i].content;
        console.log('[DEBUG] Found user message at index', i);
        break;
      }
    }

    console.log('[DEBUG] Extracted userQuery:', userQuery.substring(0, 100));

    // More permissive agentic detection - match agentic verbs with file types/operations
    // Use only the top-level instruction before any embedded conversation blocks
    const agenticScope = userQuery.split(/\b(?:User|AI):/i)[0];
    const agenticPattern = /(bikinin|buatin|bikin|buat|buatkan|perbaiki|benerin|repair|fix|jalankan|execute|run|jalanin|baca|analyze|generate|create|export).*(ppt|pptx|powerpoint|presentation|slides|docx|file|doc|word|excel|xlsx|sheet|csv|pdf|json|txt|py|js|code|script)/i;
    const shouldUseAgentic = agenticPattern.test(agenticScope) || (!/\b(?:User|AI):/i.test(userQuery) && agenticPattern.test(userQuery));

    if (shouldUseAgentic) {
      console.log(`\n╔════════════════════════════════════════════════╗`);
      console.log(`║ [SERVER] 🤖 AGENTIC REQUEST DETECTED`);
      console.log(`║ Task: "${userQuery.substring(0, 60)}..."`);
      console.log(`╚════════════════════════════════════════════════╝`);
      
      // Set streaming headers for SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      try {
        const userId = req.user?.id || req.sessionID || 'guest';
        console.log(`[SERVER] User: ${userId.substring(0, 8)}...`);

        // Stream: Show thinking message
        console.log(`[SERVER → CLIENT] 📤 Sending: "Sedang membuat file..."`);
        res.write(`data: ${JSON.stringify({ 
          choices: [{ delta: { content: '⏳ Sedang membuat file untuk kamu...\n\n' } }] 
        })}\n\n`);
        
        // Execute the actual task with heartbeat to keep connection alive
        console.log(`[SERVER] ⚙️ Calling agentService.executeTask()...`);
        const startTaskTime = Date.now();
        
        // Start heartbeat to keep connection alive during long execution
        const heartbeatInterval = setInterval(() => {
          res.write(': heartbeat\n\n'); // SSE comment (keeps connection alive)
        }, 5000);
        
        try {
          const agentResult = await agentService.executeTask(userQuery, userId);
          clearInterval(heartbeatInterval);
          const taskDuration = Date.now() - startTaskTime;
          console.log(`[SERVER] 📥 Agent result received after ${taskDuration}ms: status=${agentResult.status}, fileName=${agentResult.fileName || 'null'}, logs=${agentResult.logs?.length || 0} items`);
          
          // HIDE LOGS: Process logs for summary instead of displaying them
          let logSummary = '';
          if (agentResult.logs && Array.isArray(agentResult.logs) && agentResult.logs.length > 0) {
            console.log(`[SERVER] 📋 Processing ${agentResult.logs.length} logs for summary...`);
            const cleanedLogs = agentResult.logs
              .map(log => log.replace(/<[^>]+>/g, ''))
              .filter(log => log.trim() && !log.includes('╔') && !log.includes('╚') && !log.includes('║'))
              .join('\n');
            
            // Generate summary from logs
            if (cleanedLogs.trim()) {
              const hasError = agentResult.status !== 'success' || cleanedLogs.toLowerCase().includes('error') || cleanedLogs.toLowerCase().includes('gagal');
              logSummary = hasError 
                ? `⚠️ Terjadi error dalam proses generation. Waktu: ${agentResult.executionTime}`
                : `✅ File dibuat dengan sukses. Waktu: ${agentResult.executionTime}. Status: Ready untuk download.`;
            }
          }
          
          // Stream: Send completion message
          const fileName = agentResult.fileName || null;
          const downloadUrl = fileName ? `/api/download/${userId}/${encodeURIComponent(fileName)}` : null;
          
          if (agentResult.status === 'success' && fileName) {
            console.log(`[SERVER → CLIENT] 📤 Sending: File ready - ${fileName}`);
            const finalResponse = `✅ File Berhasil Dibuat!`;
            res.write(`data: ${JSON.stringify({ 
              choices: [{ delta: { content: finalResponse } }] 
            })}\n\n`);
            
            // Add download metadata with summary embedded
            console.log(`[SERVER → CLIENT] 📤 Sending: Download metadata with summary`);
            const summaryEncoded = encodeURIComponent(logSummary || 'File ready');
            const downloadMetadata = `\n[FILE_DOWNLOAD_START:${downloadUrl}:${fileName}:${summaryEncoded}][FILE_DOWNLOAD_END]\n`;
            res.write(`data: ${JSON.stringify({ 
              choices: [{ 
                delta: { content: downloadMetadata } 
              }] 
            })}\n\n`);
          } else {
            // Sanitize error message to hide API details
            const errorMsg = (agentResult.error || 'Kesalahan tidak diketahui').replace(/api\.deepseek\.com|deepseek/gi, 'sistem').replace(/https:\/\/[^\s]+/g, 'server');
            console.log(`[SERVER → CLIENT] 📤 Sending: Error message: ${errorMsg}`);
            const errorResponse = `\n\n😅 Gagal membuat file: ${errorMsg}\n\nMau coba lagi?`;
            res.write(`data: ${JSON.stringify({ 
              choices: [{ delta: { content: errorResponse } }] 
            })}\n\n`);
          }

          // End stream
          console.log(`[SERVER → CLIENT] 📤 Sending: [DONE]`);
          res.write('data: [DONE]\n\n');
          res.end();
          console.log(`[SERVER] ✅ Response sent successfully\n`);
        } catch (taskError) {
          clearInterval(heartbeatInterval);
          throw taskError;
        }

      } catch (error) {
        console.error(`[SERVER] ❌ Agent error:`, error.message);
        // Sanitize error message to hide API details
        const sanitizedError = error.message.replace(/api\.deepseek\.com|deepseek/gi, 'sistem').replace(/https:\/\/[^\s]+/g, 'server');
        console.log(`[SERVER → CLIENT] 📤 Sending: Catch error: ${sanitizedError}`);
        res.write(`data: ${JSON.stringify({ 
          choices: [{ 
            delta: { content: `❌ Kesalahan teknis: ${sanitizedError}\n\nMau aku coba ulang?` } 
          }] 
        })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      }
    } else {
      // Regular (non-agentic) chat - send to Deepseek
      console.log(`[CHAT] 💬 Regular chat: "${userQuery.substring(0, 50)}..."`);
      
      try {
        // Call Deepseek API for streaming response
        const deepseekResponse = await fetch(DEEPSEEK_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: messages,
            temperature: 0.5,
            max_tokens: 1200,
            frequency_penalty: 0.2,
            stream: true,
          }),
        });

        if (!deepseekResponse.ok) {
          throw new Error(`API Error: ${deepseekResponse.status} ${deepseekResponse.statusText}`);
        }

        // Set response headers for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Pipe the stream directly from Deepseek to client
        deepseekResponse.body.pipe(res);
      } catch (error) {
        console.error('[CHAT] Regular chat error:', error);
        // Sanitize error message to hide API details
        const sanitizedError = error.message.replace(/api\.deepseek\.com|deepseek/gi, 'sistem').replace(/https:\/\/[^\s]+/g, 'server');
        res.write(`data: ${JSON.stringify({ 
          choices: [{ 
            delta: { content: `❌ Maaf, terjadi kesalahan: ${sanitizedError}` } 
          }] 
        })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      }
    }
  } catch (outerError) {
    console.error('[CHAT] Outer error:', outerError);
    res.status(500).json({
      success: false,
      error: outerError.message,
    });
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
 * AGENTIC AI ENDPOINT - Execute automated tasks in sandbox
 */
app.post('/api/agent/execute', async (req, res) => {
  try {
    const { task } = req.body;
    const userId = req.user?.id || req.sessionID || 'guest';

    if (!task || typeof task !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Task description is required' 
      });
    }

    if (task.length < 5) {
      return res.status(400).json({ 
        success: false, 
        error: 'Task description too short (min 5 chars)' 
      });
    }

    console.log(`[API/AGENT] Executing task for user ${userId}:`, task);

    // Execute task in sandbox
    const result = await agentService.executeTask(task, userId);

    // Return execution result
    res.json({
      success: result.status === 'success',
      ...result
    });

  } catch (error) {
    console.error('[API/AGENT] Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Agent execution failed'
    });
  }
});

/**
 * GET sandbox stats
 */
app.get('/api/agent/sandbox-stats', async (req, res) => {
  try {
    const userId = req.user?.id || req.sessionID || 'guest';
    const stats = agentService.getSandboxStats(userId);
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('[API/AGENT] Stats error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST cleanup old sandboxes (admin only)
 */
app.post('/api/agent/cleanup', async (req, res) => {
  try {
    // Optional: Add auth check if needed
    const ageHours = req.body?.ageHours || 24;
    const result = agentService.cleanupOldSandboxes(ageHours);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[API/AGENT] Cleanup error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Download generated file from agent sandbox
 * GET /api/download/:userId/:filename
 */
app.get('/api/download/:userId/:filename', (req, res) => {
  try {
    const { userId, filename } = req.params;
    
    // Security: validate userId and filename to prevent path traversal
    if (!userId || !filename || userId.includes('..') || filename.includes('..')) {
      return res.status(400).json({ error: 'Invalid userId or filename' });
    }
    
    // Construct safe file path - NOTE: sandbox is at /server/server/sandbox, not /server/sandbox
    const sandboxDir = path.join(__dirname, 'server', 'sandbox', userId);
    const filePath = path.join(sandboxDir, filename);
    
    // Verify file exists and is within sandbox directory
    if (!fs.existsSync(filePath)) {
      console.log(`[DOWNLOAD] File not found at: ${filePath}`);
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Ensure file is within the sandbox (prevent path traversal)
    const realPath = fs.realpathSync(filePath);
    const realSandboxDir = fs.realpathSync(sandboxDir);
    if (!realPath.startsWith(realSandboxDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Send file
    console.log(`[DOWNLOAD] Serving file: ${filename} from: ${filePath}`);
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('[DOWNLOAD] Error sending file:', err);
      } else {
        console.log(`[DOWNLOAD] File sent successfully: ${filename}`);
      }
    });
  } catch (error) {
    console.error('[DOWNLOAD] Error:', error);
    res.status(500).json({ error: error.message });
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
    return res.status(401).json({ 
      authenticated: false, 
      guest: false,
      error: 'Not authenticated' 
    });
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

// Update current user profile (persist name)
app.put('/auth/me', (req, res) => {
  if (req.session.isGuest) {
    return res.status(403).json({ error: 'Guests cannot update profile.' });
  }

  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const displayName = String(req.body.name || '').trim();
  if (!displayName) {
    return res.status(400).json({ error: 'Nama tidak boleh kosong.' });
  }

  try {
    const updatedUser = userDb.update(req.user.id, { name: displayName });
    const userWithoutPassword = {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      picture: updatedUser.picture,
      createdAt: updatedUser.createdAt
    };

    res.json({ success: true, user: userWithoutPassword });
  } catch (error) {
    console.error('[AUTH/UPDATE_PROFILE] Error updating user name:', error);
    res.status(500).json({ error: 'Gagal menyimpan nama. Coba lagi nanti.' });
  }
});

// Logout
app.post('/auth/logout', (req, res) => {
  const finishLogout = () => {
    req.session.destroy((err) => {
      if (err) {
        console.error('[AUTH/LOGOUT] Session destroy error:', err.message);
      }
      res.clearCookie('connect.sid');
      console.log('[AUTH/LOGOUT] ✅ User logged out successfully');
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

// Guest login endpoint
app.post('/auth/guest', (req, res) => {
  try {
    req.session.isGuest = true;
    console.log(`[AUTH/GUEST] ✅ Guest session created for session ${req.sessionID}`);
    res.json({
      authenticated: false,
      guest: true,
      user: { name: 'Guest', email: 'guest@deepernova.com', guest: true },
    });
  } catch (err) {
    console.error('[AUTH/GUEST] Error creating guest session:', err);
    res.status(500).json({ error: 'Failed to create guest session' });
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
 * Add watermark to image
 * @param {string} imageUrl - URL of the image to watermark
 * @param {string} watermarkText - Text to add as watermark (default: 'ORION')
 * @returns {Promise<Buffer>} - Image buffer with watermark
 */
async function addWatermarkToImage(imageUrl, watermarkText = 'ORION') {
  try {
    console.log(`[WATERMARK] Adding watermark to image: ${imageUrl.substring(0, 50)}...`);
    
    // Fetch image from URL
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status}`);
    }
    
    // Convert ArrayBuffer to Buffer for node-fetch v3
    const arrayBuffer = await imageResponse.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);
    console.log(`[WATERMARK] Image downloaded: ${imageBuffer.length} bytes`);
    
    // Create SVG overlay for watermark
    const svgText = `
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style>
            .watermark-text {
              font-family: Arial, sans-serif;
              font-size: 48px;
              font-weight: bold;
              fill: white;
              opacity: 0.5;
              text-anchor: end;
            }
          </style>
        </defs>
      </svg>
    `;
    
    // Get image dimensions to position watermark
    const metadata = await sharp(imageBuffer).metadata();
    const { width, height } = metadata;
    console.log(`[WATERMARK] Image dimensions: ${width}x${height}`);
    
    // Calculate watermark position (bottom-right, with padding)
    const padding = 20;
    const fontSize = Math.max(40, Math.floor(width / 20)); // Scale font size with image
    const x = width - padding;
    const y = height - padding;
    
    // Create watermark SVG
    const watermarkSvg = Buffer.from(`
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <text 
          x="${x}" 
          y="${y}" 
          font-family="Arial, sans-serif" 
          font-size="${fontSize}" 
          font-weight="bold" 
          fill="white" 
          opacity="0.5" 
          text-anchor="end"
          dominant-baseline="text-bottom"
        >${watermarkText}</text>
      </svg>
    `);
    
    // Composite watermark onto image
    const watermarkedImage = await sharp(imageBuffer)
      .composite([
        {
          input: watermarkSvg,
          blend: 'over'
        }
      ])
      .toBuffer();
    
    console.log(`[WATERMARK] Watermark applied successfully: ${watermarkedImage.length} bytes`);
    return watermarkedImage;
  } catch (err) {
    console.error('[WATERMARK] Error adding watermark:', err.message);
    throw err;
  }
}

/**
 * Save watermarked image to public folder
 * @param {Buffer} imageBuffer - Image buffer to save
 * @returns {Promise<string>} - Public URL path
 */
async function saveWatermarkedImage(imageBuffer) {
  try {
    const filename = `watermarked-${uuidv4()}.png`;
    const filepath = path.join(process.cwd(), 'public', filename);
    
    // Ensure public directory exists
    if (!fs.existsSync(path.join(process.cwd(), 'public'))) {
      fs.mkdirSync(path.join(process.cwd(), 'public'), { recursive: true });
    }
    
    await fs.promises.writeFile(filepath, imageBuffer);
    console.log(`[WATERMARK] Image saved to: ${filepath}`);
    
    // Return full backend URL so frontend can load from correct domain
    const fullUrl = `http://localhost:${PORT}/${filename}`;
    return fullUrl;
  } catch (err) {
    console.error('[WATERMARK] Error saving watermarked image:', err.message);
    throw err;
  }
}

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

    // Add watermark to image
    let watermarkedUrl = imageUrl;
    try {
      console.log('[IMG_GEN] Starting watermark process...');
      const watermarkedBuffer = await addWatermarkToImage(imageUrl, 'ORION');
      watermarkedUrl = await saveWatermarkedImage(watermarkedBuffer);
      console.log(`[IMG_GEN] ✅ Watermarked image saved: ${watermarkedUrl}`);
      
      // Update database with watermarked URL
      db.prepare(`UPDATE generated_images SET imageUrl = ? WHERE id = ?`).run(watermarkedUrl, imageId);
      console.log(`[IMG_GEN] ✅ Database updated with watermarked URL`);
    } catch (watermarkErr) {
      console.error('[IMG_GEN] ⚠️  Watermark failed, returning original image:', watermarkErr.message);
      // If watermark fails, continue with original image
    }

    // Image generation is now free for all users.
    res.json({
      success: true,
      image: {
        id: imageId,
        url: watermarkedUrl,
        prompt,
        model,
        size,
        timestamp: new Date().toISOString(),
        savedToDb: true,
        watermarked: watermarkedUrl !== imageUrl,
      },
    });
  } catch (err) {
    console.error('[IMG_GEN] Image generation error:', err);
    res.status(500).json({ error: 'Failed to generate image: ' + err.message });
  }
});

// ============== VISION ANALYSIS API ==============

const TOKENMIX_CHAT_URL = 'https://api.tokenmix.ai/v1/chat/completions';

/**
 * POST /api/vision/analyze
 * Analyze image content using Tokenmix Qwen3-VL Flash
 * Body: { imageUrl: string, question: string }
 */
app.post('/api/vision/analyze', async (req, res) => {
  try {
    const { imageUrl, question = 'What is in this image? Describe briefly.' } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'imageUrl is required' });
    }

    if (!TOKENMIX_API_KEY) {
      console.error('[VISION] TOKENMIX_API_KEY not configured');
      return res.status(500).json({ error: 'Vision analysis service not configured' });
    }

    console.log('[VISION] Analyzing image with Qwen3-VL Flash');
    console.log('[VISION] Image input type:', imageUrl.substring(0, 20));
    console.log('[VISION] Question:', question.substring(0, 100));
    console.log('[VISION] API Key configured:', !!TOKENMIX_API_KEY);

    // Build image content - Tokenmix accepts data URIs in image_url field
    let imageContent = null;
    if (imageUrl.startsWith('data:')) {
      // Data URL format for base64
      imageContent = {
        type: 'image_url',
        image_url: { url: imageUrl }
      };
      console.log('[VISION] Using base64 data URI');
    } else if (imageUrl.startsWith('https://')) {
      // Public HTTPS URL
      imageContent = {
        type: 'image_url',
        image_url: { url: imageUrl }
      };
      console.log('[VISION] Using public HTTPS URL');
    } else {
      throw new Error('Image must be either base64 data URL or public HTTPS URL');
    }

    // Try flat content format instead of nested array
    // Some APIs prefer: { type: 'image_url', image_url: {...} } as separate item
    const messageContent = [
      { type: 'text', text: question },
      imageContent
    ];

    console.log('[VISION] Message content structure:', JSON.stringify(messageContent, null, 2));

    // Call Tokenmix Qwen3-VL Flash for vision analysis
    const payload = {
      model: 'qwen3-vl-flash',
      messages: [
        {
          role: 'user',
          content: messageContent
        }
      ],
      max_tokens: 200,
      temperature: 0.5,
    };

    console.log('[VISION] Payload being sent to Tokenmix:');
    console.log('[VISION] Full payload:', JSON.stringify(payload, null, 2));
    console.log('[VISION] Messages structure:', JSON.stringify(payload.messages, null, 2));

    const visionResponse = await fetch(TOKENMIX_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKENMIX_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      console.error('[VISION] Tokenmix API error:', visionResponse.status, visionResponse.statusText);
      console.error('[VISION] Error response body:', errorText.substring(0, 500));
      throw new Error(`Tokenmix Vision API error: ${visionResponse.status} ${visionResponse.statusText} - ${errorText.substring(0, 200)}`);
    }

    const visionData = await visionResponse.json();
    console.log('[VISION] Analysis complete');
    console.log('[VISION] Response keys:', Object.keys(visionData));

    // Extract analysis from response
    const analysis = visionData.choices?.[0]?.message?.content || 'Unable to analyze image';
    
    res.json({
      success: true,
      analysis: analysis,
      model: 'qwen3-vl-flash',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[VISION] Image analysis error:', err.message);
    console.error('[VISION] Full error stack:', err.stack);
    res.status(500).json({ error: 'Failed to analyze image: ' + err.message });
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

/**
 * ============== POWERPOINT GENERATION API ==============
 * POST /api/generate-ppt
 * Generate PowerPoint presentations with security measures
 * Body: { title: string, subtitle?: string, slides: [{title: string, content: string}] }
 */
app.post('/api/generate-ppt', async (req, res) => {
  let pythonProcess = null;
  
  try {
    const { title, subtitle, slides } = req.body;
    
    // Input validation
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Judul presentasi wajib diisi' 
      });
    }
    
    if (!Array.isArray(slides) || slides.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Minimal 1 slide diperlukan' 
      });
    }
    
    // Validate request data
    if (slides.length > 100) {
      return res.status(400).json({ 
        success: false, 
        error: 'Maksimal 100 slide (terlalu kompleks)' 
      });
    }
    
    // Build sanitized PPT data
    const pptData = {
      title: String(title).substring(0, 200),
      subtitle: String(subtitle || '').substring(0, 200),
      slides: slides.map((s, i) => ({
        title: String(s.title || `Slide ${i+1}`).substring(0, 200),
        content: String(s.content || '').substring(0, 10000)
      }))
    };
    
    console.log(`[PPT_GEN] Generating PPT: "${pptData.title}" with ${pptData.slides.length} slides`);
    
    // Spawn Python generator dengan timeout
    const pythonScript = path.join(__dirname, 'pptxGenerator.py');
    if (!fs.existsSync(pythonScript)) {
      return res.status(500).json({
        success: false,
        error: 'PPT generator script tidak ditemukan di server'
      });
    }
    
    // Detect Python executable - try multiple variants
    let pythonExe = 'python';
    const pythonCandidates = [
      'C:\\Users\\ferry fernando\\miniconda3\\python.exe',
      'C:\\Python311\\python.exe',
      'python3',
      'python'
    ];
    
    for (const candidate of pythonCandidates) {
      try {
        execSync(`"${candidate}" --version`, { stdio: 'pipe' });
        pythonExe = candidate;
        console.log(`[PPT_GEN] Using Python: ${pythonExe}`);
        break;
      } catch (e) {
        // Continue to next candidate
      }
    }

    pythonProcess = spawn(pythonExe, [pythonScript], {
      timeout: 30000, // 30 second hard timeout
      maxBuffer: 50 * 1024 * 1024 // 50MB max output
    });
    
    let stdout = '';
    let stderr = '';
    let completed = false;
    
    const timeoutId = setTimeout(() => {
      if (!completed) {
        console.warn('[PPT_GEN] Timeout - killing process');
        if (pythonProcess) {
          pythonProcess.kill('SIGTERM');
          setTimeout(() => {
            if (pythonProcess && !pythonProcess.killed) {
              pythonProcess.kill('SIGKILL');
            }
          }, 2000);
        }
      }
    }, 30000);
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(`[PPT_GEN] Python stderr: ${data.toString().substring(0, 200)}`);
    });
    
    pythonProcess.on('close', (code) => {
      completed = true;
      clearTimeout(timeoutId);
      
      if (code !== 0) {
        console.error(`[PPT_GEN] Process exit code ${code}`);
        if (stderr) console.error(`[PPT_GEN] Error: ${stderr.substring(0, 500)}`);
        
        if (!res.headersSent) {
          return res.status(500).json({
            success: false,
            error: `Generator error: ${stderr.substring(0, 200) || 'Unknown error'}`
          });
        }
      }
      
      try {
        const result = JSON.parse(stdout);
        
        if (!result.success) {
          console.error(`[PPT_GEN] Generation failed: ${result.data?.error}`);
          if (!res.headersSent) {
            return res.status(400).json({
              success: false,
              error: result.data?.error || 'Failed to generate'
            });
          }
        }
        
        console.log(`[PPT_GEN] ✅ Success: ${result.data.filename} (${result.data.size_mb}MB)`);
        
        if (!res.headersSent) {
          res.json({
            success: true,
            filename: result.data.filename,
            size_mb: result.data.size_mb,
            slides_count: result.data.slides,
            downloadUrl: `/download/${result.data.filename}`,
            message: `Presentasi berhasil dibuat dengan ${result.data.slides} slide`
          });
        }
      } catch (parseErr) {
        console.error(`[PPT_GEN] Parse error: ${parseErr.message}`);
        console.error(`[PPT_GEN] Output: ${stdout.substring(0, 300)}`);
        
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Failed to parse generator output'
          });
        }
      }
    });
    
    pythonProcess.on('error', (err) => {
      clearTimeout(timeoutId);
      console.error(`[PPT_GEN] Process error: ${err.message}`);
      
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: `Process error: ${err.message}`
        });
      }
    });
    
    // Send PPT data to Python via stdin
    pythonProcess.stdin.write(JSON.stringify(pptData));
    pythonProcess.stdin.end();
    
  } catch (error) {
    console.error('[PPT_GEN] Endpoint error:', error);
    
    if (pythonProcess && !pythonProcess.killed) {
      pythonProcess.kill('SIGKILL');
    }
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: `Server error: ${error.message}`
      });
    }
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
