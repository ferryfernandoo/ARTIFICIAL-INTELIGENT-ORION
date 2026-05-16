# 🎉 Orion AI - Complete File Generation & Financial Documents System

Advanced AI agent system that can generate **any type of file** including professional **financial statements in Microsoft Word format**.

## ✨ Key Features

- 💬 **Advanced Chat Interface** - Real-time conversations with Orion AI
- 🚀 **File Generation Agent** - Generate Python, JavaScript, HTML, CSS, JSON files
- 📊 **Financial Documents** - Professional Word documents (Laporan Laba Rugi, Neraca, Arus Kas)
- 📁 **File Manager** - Download, view, delete all generated files
- 💾 **Code Execution** - Run generated code with automatic compilation
- 🔒 **Private Mode** - Untracked, unlogged conversations
- ⚙️ **Smart Settings** - Customize AI personalities and behaviors
- 📱 **Responsive Design** - Works perfectly on desktop and mobile
- 🎨 **Beautiful UI** - Gradient themes with smooth animations
- 🧠 **Memory System** - Remember context across conversations

## ⚙️ Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Python 3.7+ (for file generation and financial documents)
- Deepseek API Key from https://platform.deepseek.com/

## 🚀 Quick Start (5 Minutes)

### Step 1: Install Node Dependencies
```bash
cd f:\chat bot
npm install
```

### Step 2: Install Python Packages
```bash
# Windows
install_python_packages.bat

# Mac/Linux
chmod +x install_python_packages.sh
./install_python_packages.sh

# Or manually
pip install python-docx
```

### Step 3: Configure API Key
Create/update `.env` file:
```
VITE_DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
VITE_FILE_API_URL=http://localhost:3001/api
```

### Step 4: Start Everything
```bash
npm run dev:all
```

This starts:
- ✅ Backend server (port 3001)
- ✅ Frontend app (port 5173)

### Step 5: Open Browser
```
http://localhost:5173
```

You're ready! 🎉

---

## 💡 How to Use

### Generate Code Files
1. Type: `"Buat file Python untuk calculate factorial"`
2. Orion generates code
3. Click "Buat File" button
4. Download file instantly
5. Run: `python filename.py`

### Generate Financial Reports
1. Click 📊 button in sidebar
2. Click "Buat Laporan Keuangan"
3. Wait 5-10 seconds
4. Download 3 Word documents
5. Open in Microsoft Word
6. Edit with your data

### Manage Files
1. Click 📁 button to open File Manager
2. View all generated files
3. Download or delete files
4. Clear all with one click

---

## 📁 Project Structure

```
f:\chat bot\
├── server.js                           (Backend server)
├── package.json                        (Dependencies)
├── requirements.txt                    (Python deps)
├── install_python_packages.bat         (Windows installer)
├── install_python_packages.sh          (Mac/Linux installer)
│
├── src/
│   ├── components/
│   │   ├── ChatBot.jsx                (Main chat)
│   │   ├── FileGenerator.jsx          (File gen UI)
│   │   ├── FilesManager.jsx           (File manager)
│   │   ├── FinancialDocsGenerator.jsx (Financial docs - NEW!)
│   │   └── *.css                      (Styling)
│   │
│   ├── services/
│   │   ├── grokApi.js                 (Orion AI API)
│   │   ├── fileGenerationService.js   (File ops - UPDATED!)
│   │   └── memoryService.js           (Memory system)
│   │
│   └── templates/
│       └── generate_financial_statements.py (Word gen - NEW!)
│
├── temp-files/                        (Generated files storage)
│
└── 📖 DOCUMENTATION
    ├── README.md                      (This file)
    ├── GETTING_STARTED.md
    ├── FINANCIAL_DOCS_QUICK_START.md  (⭐ NEW!)
    ├── FILE_GENERATION_GUIDE.md
    ├── API_DOCS.md
    ├── SETUP_CHECKLIST.md
    └── TROUBLESHOOTING.md
```

---

## � RAG Dataset Eksternal

Orion sekarang mendukung dataset JSON eksternal untuk RAG (Retrieval-Augmented Generation). Logikanya:

1. Orion mencari di `public/rag_index.json` yang berisi indeks dokumen JSON.
2. Jika ditemukan dokumen yang relevan, Orion menggunakan informasi tersebut untuk menjawab.
3. Jika tidak ada referensi yang relevan, Orion tetap menjawab berdasarkan pengetahuan internalnya.

### Contoh dataset tambahan
Simpan file JSON di `data/datasets/` seperti ini:

```json
[
  {
    "id": "orion_profile",
    "title": "Profil Orion AI",
    "text": "Orion AI adalah model deepernova_id1_ dengan 912 miliar parameter..."
  },
  {
    "id": "vite_guide",
    "title": "Panduan Vite Cepat",
    "text": "Vite adalah bundler frontend cepat yang menggunakan modul ECMAScript..."
  }
]
```

### Cara membangunnya
Jalankan script ingest berikut:

```bash
node scripts/rag_ingest.js --input data/datasets --out public/rag_index.json
```

Setelah `public/rag_index.json` tersedia, Orion akan memuatnya otomatis saat localStorage kosong.

### Logika RAG yang diterapkan
- Pertanyaan masuk ke AI.
- Sebelum menjawab, sistem mencari dokumen JSON eksternal relevan.
- Jika ada, dokumen tersebut disertakan ke model sebagai konteks referensi.
- Jika tidak ada, AI menggunakan jawaban internal tanpa mengandalkan referensi palsu.

---

## �📊 Financial Documents Generator (NEW!)

### What You Get

**3 Professional Word Documents in one click:**

#### 1. LAPORAN_LABA_RUGI.docx (Income Statement)
```
LAPORAN LABA RUGI - PERIODE 2024

PENDAPATAN
├─ Penjualan Bersih      Rp 1.000.000.000    100%
├─ Pendapatan Lain-lain  Rp 50.000.000       5%
└─ TOTAL PENDAPATAN      Rp 1.050.000.000    100%

BEBAN OPERASIONAL
├─ Harga Pokok Penjualan Rp 600.000.000      57%
├─ Gaji dan Upah         Rp 150.000.000      14%
└─ TOTAL BEBAN           Rp 900.000.000      86%

LABA BERSIH              Rp 150.000.000      14%
```

#### 2. NERACA.docx (Balance Sheet)
```
ASET (Landscape)         |  KEWAJIBAN & EKUITAS
├─ Aset Lancar           |  ├─ Utang Lancar
├─ Aset Tetap            |  ├─ Utang Jangka Panjang
└─ TOTAL ASET            |  └─ TOTAL ASET = LIABILITAS
```

#### 3. ARUS_KAS.docx (Cash Flow)
```
ARUS KAS OPERASIONAL       Rp 200.000.000
ARUS KAS INVESTASI        Rp (250.000.000)
ARUS KAS PENDANAAN        Rp 100.000.000
Perubahan Neto Kas        Rp 50.000.000
```

### Features

✅ **Professional Formatting**
- Blue headers with white text
- Gray footer rows for totals
- Perfect alignment & spacing
- Percentage calculations

✅ **Fully Editable**
- Change any value
- Add/remove rows
- Update company info
- Customize colors

✅ **Print Ready**
- Proper margins
- Professional appearance
- Portrait & landscape layouts
- High quality output

### How to Use Generated Documents

1. **Download from browser**
   - Files go to Downloads folder
   - Three .docx files created

2. **Open in Word**
   - Double-click file
   - Or: Word > File > Open

3. **Edit & Customize**
   - Update values
   - Add company logo
   - Change dates/names

4. **Export & Share**
   - Save as PDF
   - Print for reports
   - Email to stakeholders
   - Share with accountants

---

## 📝 Supported File Types

| Type | Extension | Status | Example |
|------|-----------|--------|---------|
| Python | .py | ✅ Complete | data_processor.py |
| JavaScript | .js | ✅ Complete | converter.js |
| HTML | .html | ✅ Complete | form.html |
| CSS | .css | ✅ Complete | style.css |
| JSON | .json | ✅ Complete | config.json |
| SQL | .sql | ✅ Complete | query.sql |
| **Word Documents** | **.docx** | **✅ NEW!** | **LAPORAN_LABA_RUGI.docx** |
| TypeScript | .ts | ✅ Available | app.ts |

---

## 🔧 System Architecture

### How It Works

```
User Request (Chat)
       ↓
Orion AI (Analyzes request)
       ↓
FileGenerator Component (Detects code blocks)
       ↓
User Clicks "Buat File"
       ↓
Backend Server (server.js)
       ↓
Python/JavaScript Execution (Safe sandbox)
       ↓
Files Saved to temp-files/
       ↓
User Downloads File(s)
```

### Financial Documents Flow

```
User Clicks 📊 Button
       ↓
FinancialDocsGenerator Component
       ↓
API Request to /api/generate-financial-documents
       ↓
Backend Spawns Python Process
       ↓
generate_financial_statements.py
       ↓
python-docx Library Creates Word Documents
       ↓
3 .docx Files Generated & Saved
       ↓
Download Links Provided
       ↓
Open in Microsoft Word
```

### Backend (server.js)
- Express.js on port 3001
- Routes for file generation API
- Python subprocess execution
- Financial document generation

### Frontend (React)
- ChatBot: Main interface
- FileGenerator: File generation UI
- FilesManager: File management
- FinancialDocsGenerator: Financial reports
- All with beautiful animations

### Services
- `grokApi.js` - Orion AI communication
- `fileGenerationService.js` - File operations
- `memoryService.js` - Conversation context

### Python Scripts
- `generate_financial_statements.py` - Creates Word documents

---

## 🎓 Documentation

| Document | Purpose | Read When |
|----------|---------|-----------|
| [GETTING_STARTED.md](GETTING_STARTED.md) | Quick setup | First time using |
| [FINANCIAL_DOCS_QUICK_START.md](FINANCIAL_DOCS_QUICK_START.md) | Report generation | Generating documents |
| [FILE_GENERATION_GUIDE.md](FILE_GENERATION_GUIDE.md) | File generation features | Creating code files |
| [API_DOCS.md](API_DOCS.md) | API reference | Developing features |
| [SETUP_CHECKLIST.md](SETUP_CHECKLIST.md) | Verify setup | Troubleshooting |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Common problems | Issues occur |

---

## 🆘 Troubleshooting

### 📊 Button not visible
```bash
npm run dev:all  # Restart everything
```

### python-docx not installed
```bash
# Windows
pip install python-docx

# Mac/Linux
pip3 install python-docx
```

### Files not downloading
- Check browser console (F12)
- Verify server running
- Try different browser
- Clear browser cache

### "Cannot find module" errors
```bash
npm install
pip install -r requirements.txt
```

### Port already in use
```bash
# Windows
taskkill /F /IM node.exe

# Mac/Linux
lsof -ti:3001 | xargs kill -9

# Then restart
npm run dev:all
```

---

## 🎯 Quick Tips

✨ **Pro Tips:**
- Type `"Buat file..."` to auto-generate files
- Click 📊 for instant financial reports
- Use 📁 to organize generated files
- Try private mode (🔒) for sensitive conversations
- Adjust settings (⚙️) for different AI personalities

⚡ **Keyboard Shortcuts:**
- `Enter` - Send message
- `Shift + Enter` - New line in message
- `Ctrl/Cmd + K` - Clear chat (if available)

🔒 **Security Notes:**
- Files stored in temp-files/ directory
- Auto-delete supported
- Private mode not logged
- Safe Python execution sandbox

---

## 📈 Use Cases

### Business
✅ Generate financial statements
✅ Create business reports
✅ Generate invoices and forms

### Development
✅ Create boilerplate code
✅ Generate database scripts
✅ Create configuration files

### Education
✅ Generate coding examples
✅ Create learning materials
✅ Build practice projects

### Personal
✅ Create personal documents
✅ Generate scripts
✅ Organize information

---

## 🎉 Summary

**What Makes This Special:**
- 🤖 Advanced AI with 912 Billion Parameters
- 📝 Generate ANY type of file
- 📊 Professional financial documents in Word format
- 💾 One-click downloads
- 🔒 Secure & isolated execution
- 🎨 Beautiful, responsive UI
- 🧠 Smart memory system

**You Can Now:**
1. Chat naturally with Orion AI
2. Generate code files instantly
3. Create financial reports professionally
4. Manage all files in one place
5. Works on desktop and mobile

**Get Started Now:**
```bash
npm run dev:all
```

Then open: http://localhost:5173

---

## 📞 Need Help?

1. **Check Documentation** - Most answers in guides above
2. **Review TROUBLESHOOTING.md** - Common issues covered
3. **Check Terminal Output** - Errors display there
4. **Open Browser Console** - Press F12 for frontend errors

---

## ✅ Features Checklist

- ✅ Real-time chat with Orion AI
- ✅ Generate Python/JavaScript files
- ✅ Financial document generation
- ✅ File download & management
- ✅ Responsive design
- ✅ Private chat mode
- ✅ Settings customization
- ✅ Memory system
- ✅ Beautiful animations
- ✅ Code syntax highlighting
- ✅ Token counting
- ✅ Error handling

---

*Orion AI - Advanced File Generation & Financial Documents System*
*Built with ❤️ | Version 2.0 with Word Support*
*Transform ideas into files instantly! 🚀*


---

## Configuration & Advanced

### Environment Variables
Create `.env` file:
```
VITE_DEEPSEEK_API_KEY=your-api-key-here
VITE_FILE_API_URL=http://localhost:3001/api
VITE_TIMEOUT=30000
```

### API Endpoints

**File Generation:**
```
POST /api/generate-file
POST /api/files
GET /api/files
DELETE /api/files/:filename
```

**Financial Documents:**
```
POST /api/generate-financial-documents
```

### Build & Deploy

**Development:**
```bash
npm run dev:all      # Both frontend and backend
npm run server       # Backend only
npm run dev          # Frontend only
```

**Production:**
```bash
npm run build        # Build frontend
node server.js       # Start server
```

---

## License

This project uses Deepseek API and python-docx library.
Created for advanced file generation and document automation.

---

*Ready to generate ANY file? Start now! 🎉*
- Pastikan API endpoint dapat diakses
- Check browser console untuk error details

### Message Not Sending
- Pastikan input tidak kosong
- Tunggu previous message selesai diproses
- Periksa network tab di developer tools

## Technologies

- **Frontend Framework**: React 19
- **Build Tool**: Vite 8
- **CSS**: Modern CSS3 dengan Flexbox dan Grid
- **HTTP Client**: Fetch API
- **Environment**: Node.js

## Performance

- ⚡ **Dev Mode**: ~1 second startup
- 🔧 **HMR**: Instant hot module replacement
- 📦 **Production Build**: Optimized & minified
- 💾 **Bundle Size**: ~150KB (gzipped)

## Security Notes

⚠️ **IMPORTANT**: 
- Never commit `.env` file ke repository
- Keep your API key private and secure
- Use `.env.local` untuk local testing
- Regenerate API key jika telah di-expose

## Future Enhancements

- [ ] Message persistence dengan localStorage
- [ ] Copy to clipboard untuk messages
- [ ] Multiple conversation threads
- [ ] Export chat history
- [ ] Dark mode toggle
- [ ] Voice input/output
- [ ] Message search functionality
- [ ] User authentication

## License

MIT

## Support

Untuk pertanyaan atau issues, silakan buat issue di repository atau hubungi tim development.

---

**Note**: Pastikan `.env` file sudah dikonfigurasi dengan Deepseek API key yang valid. Orion AI menggunakan Deepseek API backend dengan custom branding dan system prompt.

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
