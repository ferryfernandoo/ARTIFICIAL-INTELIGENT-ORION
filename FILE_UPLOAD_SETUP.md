# 📄 File Upload Feature - Complete Setup Guide

## 🎯 What Was Implemented

A complete file upload system that allows users to upload various document formats (PDF, DOCX, TXT, CSV, JSON, HTML, Markdown, XLSX, PPTX) and have them automatically converted to plain text that the AI can read and reference in conversations.

### Key Features:
- ✅ Upload files directly from sidebar
- ✅ Automatic format detection and conversion to text
- ✅ Support for 9+ file formats
- ✅ File content stored in memory system for AI access
- ✅ Real-time upload status with spinner
- ✅ File metadata display (filename, type, character count)
- ✅ Automatic cleanup of temporary files
- ✅ 50MB file size limit
- ✅ Error handling for unsupported formats

---

## 🛠️ Installation & Setup

### Step 1: Install Node.js Dependencies
```bash
cd "f:\chat bot"
npm install
```

This will install:
- `express` - Backend server
- `multer` - File upload handling
- `cors` - Cross-origin support
- Other dependencies...

### Step 2: Install Python Libraries
The file parser requires Python and optional libraries for different formats:

```bash
# Install all optional libraries (recommended)
pip install PyPDF2 python-docx openpyxl python-pptx

# Or install individually:
pip install PyPDF2          # For PDF parsing
pip install python-docx     # For DOCX (Word documents)
pip install openpyxl        # For XLSX (Excel spreadsheets)
pip install python-pptx     # For PPTX (PowerPoint presentations)
```

**Note:** TXT, JSON, CSV, HTML, and Markdown don't require additional libraries - they work with standard Python.

### Step 3: Verify Python Installation
```bash
# Check if Python is installed
python --version

# Should output something like: Python 3.9.0 or higher
```

If Python is not found, install it from https://www.python.org/downloads/

---

## 🚀 Starting the Application

### Option 1: Start Backend Server Only
```bash
node server.js
```
- Backend runs on: `http://localhost:3001`
- Includes API endpoints for file upload and code generation

### Option 2: Start Frontend (Vite Dev Server)
```bash
npm run dev
```
- Frontend runs on: `http://localhost:5173`

### Option 3: Start Both Together
```bash
# In one terminal
node server.js

# In another terminal
npm run dev
```

Then open: `http://localhost:5173` in your browser

---

## 📤 How to Use File Upload

### Quick Start:
1. **Look for the Upload Section** in the left sidebar
2. **Click "📤 Choose File"** button
3. **Select a file** from your computer
4. **Wait for upload** - You'll see a progress spinner
5. **Success!** - File content saved to memory, AI can now reference it

### Supported File Formats:
| Format | Extension | Example |
|--------|-----------|---------|
| Plain Text | .txt | notes.txt |
| Markdown | .md | readme.md |
| JSON | .json | data.json |
| CSV | .csv | spreadsheet.csv |
| HTML | .html | webpage.html |
| PDF | .pdf | document.pdf |
| Word | .docx | report.docx |
| Excel | .xlsx | data.xlsx |
| PowerPoint | .pptx | slides.pptx |

### Maximum File Size:
- **50 MB** per file
- Larger files will be rejected

---

## 🎨 UI Components

### File Upload Section (Sidebar)
Located in the left sidebar under "Token Usage":

```
📄 Upload File
┌─────────────────────┐
│ 📤 Choose File      │  ← Click to select file
└─────────────────────┘
```

### Status Display
After selecting a file:

```
⏳ Uploading...         ← Shows while uploading
✓ document.pdf (245 tokens) ← Shows when complete
❌ Error message        ← Shows if failed
```

### Uploaded Files List
Shows all successfully uploaded files:

```
📄 document.pdf
   PDF | 45,234 chars
```

---

## 🧠 How AI Uses Uploaded Files

### Memory Integration:
1. When you upload a file, its content is stored in the **Memory Bank**
2. The AI can reference this content automatically
3. The file content is available with **HIGH PRIORITY** (weight: 2)

### Asking Questions:
After uploading a file, you can ask the AI about it:

```
User: "Apa isi dari file yang saya upload?"
AI: [Reads file from memory and answers]

User: "Summarize the document"
AI: [Provides summary of uploaded content]

User: "Extract key points from the PDF"
AI: [Extracts information from file]
```

### Cross-Conversation Access:
- Files uploaded in one room appear in the Memory Bank
- Can be referenced in other conversations
- Memory persists until manually cleared

---

## 🐛 Troubleshooting

### Problem: Upload button not working
**Solution:**
- Make sure server is running: `node server.js`
- Check browser console (F12) for errors
- Verify `localhost:3001/api/upload-file` endpoint is accessible

### Problem: "File type not allowed" error
**Solution:**
- Check that the file extension is in the supported list
- Try renaming: `document` → `document.pdf`
- Ensure MIME type is correct

### Problem: "File parsing failed"
**Solution:**
- Install missing Python library: `pip install PyPDF2` (for PDF) or `pip install python-docx` (for DOCX)
- Check Python version: `python --version` (should be 3.7+)
- Try uploading a simpler file first (TXT or JSON)

### Problem: Browser shows "CORS error"
**Solution:**
- Ensure server is running on `localhost:3001`
- Check that frontend is on `localhost:5173`
- Clear browser cache and refresh

### Problem: Uploaded file not visible in AI responses
**Solution:**
- Check Memory Bank status
- Verify file was successfully parsed (check upload status)
- Try asking AI directly about the file: "What's in the file I just uploaded?"
- Check character count - very large files may be truncated

---

## 📊 File Parsing Details

### What Happens:
1. **Upload** → File sent to server
2. **Validate** → Check file type and size
3. **Store Temporary** → Save to `temp-files/uploads/`
4. **Parse** → Run Python `parse_file.py` script
5. **Extract Text** → Convert to plain text
6. **Calculate Tokens** → Estimate token count (1 token ≈ 4 chars)
7. **Store in Memory** → Save content for AI
8. **Cleanup** → Delete temporary file
9. **Report** → Show success message and file info

### Example Output:
```json
{
  "success": true,
  "filename": "report.pdf",
  "file_type": ".pdf",
  "content": "Page 1\n---\nDocument content here...",
  "char_count": 45234,
  "token_estimate": 11309
}
```

---

## ⚙️ Configuration

### Change File Size Limit:
Edit `server.js`, find `multer` configuration:
```javascript
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // Change this: 50MB
  // ...
});
```

Change to:
```javascript
limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
```

### Add New File Format:
Edit `scripts/parse_file.py`:
1. Add parser function: `def parse_xyz(file_path):`
2. Add MIME type to allowed list in `server.js`
3. Add format mapping in parse_file function

---

## 📝 API Reference

### Upload File Endpoint
```
POST /api/upload-file
Content-Type: multipart/form-data

Request:
{
  file: <binary file data>
}

Response:
{
  "success": true,
  "filename": "document.pdf",
  "file_type": ".pdf",
  "content": "extracted text...",
  "char_count": 12345,
  "token_estimate": 3086
}
```

---

## 🔒 Security Considerations

- Files are temporarily stored in `temp-files/uploads/`
- Files are automatically deleted after parsing
- MIME type validation prevents executable files
- File size limited to 50MB
- Python execution sandboxed to specific script

---

## 🚨 Important Notes

1. **Python Required**: File upload feature requires Python 3.7+ installed
2. **Dependencies Installation**: Run Python library installation before using complex formats
3. **Server Must Run**: Backend server (`node server.js`) must be running
4. **Memory Usage**: Large files consume memory - consider file size
5. **Temporary Files**: Files stored in `temp-files/` directory (auto-cleanup enabled)

---

## ✅ Quick Verification Checklist

After installation, verify everything works:

- [ ] Node dependencies installed: `npm install` completed
- [ ] Python installed: `python --version` shows 3.7+
- [ ] Python libraries installed: (optional for each format)
- [ ] Server started: `node server.js` (no errors)
- [ ] Frontend running: `npm run dev` (http://localhost:5173)
- [ ] Upload button visible in sidebar
- [ ] Can select a file
- [ ] Upload completes successfully
- [ ] File appears in uploaded files list
- [ ] AI can reference uploaded content

---

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Verify all dependencies are installed
3. Check browser console (F12) for error messages
4. Verify Python is in system PATH
5. Check that ports 3001 and 5173 are available

---

## 🎉 That's It!

You now have a fully functional file upload system integrated with your AI chatbot. Happy uploading! 📤
