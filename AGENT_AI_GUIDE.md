# 🤖 AGENTIC AI - Agent Execution Guide

## Overview

Deepernova sekarang punya **Agentic AI** - AI yang bisa autonomously:
- 📝 **Generate code** menggunakan Deepseek
- 🏃 **Execute code** dalam sandbox aman (tidak bahaya server)
- 📊 **Process files** - baca/tulis file automation
- ⚡ **Real-time monitoring** dengan resource limits

---

## 🚀 How to Use

### Command Format di Chat:

```
Automate: [task description]
```

### Contoh Commands:

#### 1️⃣ **File Processing**
```
Automate: Buat file CSV dari list nama: nando, budi, siti dengan nama lengkap di kolom kedua
```

#### 2️⃣ **Data Analysis**
```
Automate: Generate laporan statistik dari file data.json dan export ke CSV
```

#### 3️⃣ **Text Manipulation**
```
Automate: Bersihkan dan format file log.txt, remove duplicates dan sort
```

#### 4️⃣ **Batch Operations**
```
Automate: Rename semua file dalam folder dengan format YYYY-MM-DD-filename
```

#### 5️⃣ **Data Conversion**
```
Automate: Convert file XLSX ke JSON dengan header sebagai keys
```

---

## 🔒 Sandbox Security

### Resource Limits:
- ⏱️ **Timeout**: 60 detik max per task
- 💾 **Memory**: 512MB max
- 📦 **File Size**: 10MB max per file
- 📁 **Isolation**: Semua files dalam `/server/sandbox/[userId]/`

### Operasi Dilarang:
- ❌ `os.system()` - shell injection
- ❌ `subprocess` - system execution
- ❌ Network requests tanpa whitelist
- ❌ Delete system files
- ❌ Access database produksi

### Operasi Diizinkan:
- ✅ File read/write (dalam sandbox)
- ✅ Data processing (pandas, numpy)
- ✅ JSON/CSV operations
- ✅ Text manipulation
- ✅ Calculations
- ✅ Basic system info

---

## 📊 Response Format

### Success Response:
```json
{
  "success": true,
  "isAutomation": true,
  "agentResult": {
    "status": "success",
    "output": "Task output here",
    "executionTime": "1234ms",
    "totalTime": "2456ms",
    "taskId": "uuid"
  },
  "message": "✅ Task executed successfully\n\nOutput:\nTask output here"
}
```

### Error Response:
```json
{
  "success": false,
  "isAutomation": true,
  "error": "Automation failed: error message"
}
```

---

## 🔧 API Endpoints

### 1. Execute Task
```bash
POST /api/agent/execute
Content-Type: application/json

{
  "task": "Create CSV file dengan data user"
}
```

### 2. Get Sandbox Stats
```bash
GET /api/agent/sandbox-stats
```

Response:
```json
{
  "success": true,
  "stats": {
    "path": "/server/sandbox/user-id",
    "exists": true,
    "files": 5,
    "totalSize": 102400,
    "totalSizeMB": "0.10"
  }
}
```

### 3. Cleanup Old Sandboxes
```bash
POST /api/agent/cleanup
Content-Type: application/json

{
  "ageHours": 24
}
```

---

## 💡 Example Use Cases

### 1. Data Processing
```
Automate: Baca file dataset.csv, filter rows dimana kolom age > 25, export ke new-dataset.json
```

AI akan:
1. Generate Python code untuk read CSV
2. Filter data dengan kondisi
3. Export ke JSON
4. Return hasil dengan summary

### 2. Log Analysis
```
Automate: Parse file error.log, count error types, generate report.txt
```

### 3. Batch File Operations
```
Automate: Generate 100 test JSON files dengan format: {"id": 1-100, "name": "test-N", "timestamp": "2026-05-27"}
```

### 4. Data Transformation
```
Automate: Convert file users.xlsx sheet 'active_users' ke CSV dan merge dengan departments.json
```

---

## 🎯 Best Practices

### DO ✅:
- Describe tasks clearly
- Use Indonesian atau English (keduanya supported)
- Break complex tasks menjadi simpler steps
- Wait untuk execution complete

### DON'T ❌:
- Request system access
- Ask untuk access production database
- Try bypass sandbox restrictions
- Request file outside sandbox folder

---

## 📈 Execution Monitoring

### Real-time Logs:
```
[AGENT] 🚀 Starting task execution: task-uuid
[AGENT] Generating code for task: ...
[AGENT] Code generated: ...
[AGENT] Script written to: /path/to/script.py
[AGENT] ✅ Execution successful (1234ms)
```

### Error Tracking:
```
[AGENT] ❌ Execution failed (1200ms): error message
[AGENT] Traceback: ...
```

---

## 🚨 Rate Limits & Quotas

- Per user per session: Unlimited (karena Deepseek unlimited)
- Per execution: 60 detik max
- Concurrent executions: 1 per user (queued after)
- File storage: No hard limit (auto cleanup old sandboxes)

---

## 📝 Troubleshooting

### Task Timeout (60s exceeded)
**Solution**: Break task menjadi lebih kecil parts

### Memory Limit (512MB exceeded)
**Solution**: Process file dalam chunks, jangan load semuanya

### Code Generation Failed
**Solution**: Describe task dengan lebih detail, provide contoh format input/output

### File Not Found
**Solution**: File harus ada dalam sandbox folder user, gunakan relative paths

---

## 🔐 Security Notes

1. **Sandbox Isolation**: Setiap user punya folder terpisah
2. **No Network**: Default no internet access (hanya file operations)
3. **Resource Capped**: CPU/Memory/Time tidak bisa dilampaui
4. **Code Validation**: Semua generated code di-validate sebelum execution
5. **Audit Trail**: Semua execution di-log untuk security audit

---

## 📞 Support

Untuk testing atau debug:
- Check server logs di terminal (search `[AGENT]`)
- Check sandbox folder di `/server/sandbox/[userId]/`
- Review generated Python scripts dalam folder

---

**Ready to automate? Try it now in chat! 🚀**

Example:
```
Automate: Create test file dengan 10 random names
```
