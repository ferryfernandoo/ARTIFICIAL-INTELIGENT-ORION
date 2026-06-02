# 🏗️ ARSITEKTUR & DEPLOYMENT STRATEGY

## OVERVIEW SISTEM DEEPERNOVA

```
┌─────────────────────────────────────────────────────────────────┐
│                          VPS HOSTINGER                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  NGINX (Reverse Proxy + Static Server)                   │  │
│  │  Port 80/443 - Frontend routing, API proxy               │  │
│  └────────────────────┬─────────────────────────────────────┘  │
│                       │                                          │
│         ┌─────────────┼─────────────┐                           │
│         │             │             │                           │
│         ▼             ▼             ▼                           │
│  ┌──────────┐  ┌─────────────┐  ┌──────────────┐              │
│  │   dist/  │  │  PORT 3001  │  │   SQLite     │              │
│  │ Frontend │  │   Backend   │  │   Database   │              │
│  │  (React) │  │  (Express)  │  │  (deepernova │              │
│  │          │  │             │  │     .db)     │              │
│  └──────────┘  └─────────────┘  └──────────────┘              │
│         │             │             │                           │
│         └──────┬──────┴──────┬──────┘                           │
│                │             │                                   │
│                ▼             ▼                                   │
│         ┌─────────────────────────────┐                         │
│         │  Python Environment (venv)  │                         │
│         │  - python-docx              │                         │
│         │  - python-pptx              │                         │
│         │  - xlsxwriter               │                         │
│         │  - matplotlib               │                         │
│         └─────────────────────────────┘                         │
│                                                                   │
│         ┌─────────────────────────────┐                         │
│         │  External API Integrations  │                         │
│         │  - Deepseek API             │                         │
│         │  - Tokenmix API             │                         │
│         │  - World News API           │                         │
│         │  - SerpAPI                  │                         │
│         │  - Xendit (Payment)         │                         │
│         └─────────────────────────────┘                         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

CLIENT (Browser)
       │
       ▼
  (HTTP/HTTPS)
       │
       ▼
    NGINX ◄──► Backend ◄──► Python ◄──► External APIs
  (Port 80/443) (Port 3001)  (venv)
```

---

## FILE STRUCTURE DI VPS

```
/home/apps/deepernova/
├── .env                          # ⚠️ SENSITIVE - created manually di VPS
├── .env.example                  # ✅ Safe - commit ke git
├── .gitignore
├── package.json
├── package-lock.json
├── vite.config.js
├── dist/                         # Frontend build output (GENERATED)
├── src/                          # React source code
├── public/
├── server/
│   ├── server.js               # MAIN BACKEND ENTRY POINT
│   ├── package.json
│   ├── agentService.js         # AI file generation
│   ├── database.js             # SQLite setup
│   ├── auth.js                 # Authentication
│   ├── routes/                 # API endpoints
│   ├── deepernova.db           # SQLite database (CREATED AUTO)
│   ├── deepernova.db-shm       # Database shared memory
│   ├── deepernova.db-wal       # Database write-ahead log
│   ├── temp-files/             # Generated PPTX, DOCX files
│   └── logs/                   # Application logs
├── venv/                        # Python virtual environment (CREATED)
│   ├── bin/
│   ├── lib/
│   └── ...
├── ecosystem.config.js          # PM2 configuration (optional)
├── node_modules/               # (auto-installed)
└── DEPLOYMENT_*.md             # Guides
```

---

## ENVIRONMENT VARIABLES (CRITICAL)

### Development (.env.local)
```env
NODE_ENV=development
VITE_API_BASE_URL=http://localhost:3001
DEEPSEEK_API_KEY=sk-...
# ... other keys
```

### Production (VPS .env)
```env
NODE_ENV=production
VITE_API_BASE_URL=https://yourdomain.com
DEEPSEEK_API_KEY=sk-...
# ... ALL keys must be present
```

**⚠️ CRITICAL: .env file TIDAK boleh commit ke Git (sudah di .gitignore)**

---

## STARTUP SEQUENCE

### Startup Process (saat VPS restart atau manual start)

```
1. PM2/SystemD starts: node server/server.js
   │
   ├─ Load .env variables (dotenv.config)
   ├─ Initialize SQLite database (better-sqlite3)
   ├─ Check Python availability
   ├─ Create temp-files directory
   └─ Listen on PORT 3001 ✅

2. Nginx routes:
   ├─ GET / → serve dist/index.html (frontend)
   ├─ GET /api/* → proxy to localhost:3001
   └─ Listen on PORT 80/443 ✅

3. Frontend (React):
   ├─ Loads from dist/ (built at npm run build)
   ├─ Points API calls to VITE_API_BASE_URL
   └─ Connects to backend ✅

4. Backend ready for:
   ├─ Chat requests (via OpenRouter/Deepseek)
   ├─ File generation (PPTX/DOCX/Excel)
   ├─ File uploads
   └─ Database queries ✅

5. Python environment:
   ├─ python-pptx ready for PPT generation
   ├─ python-docx ready for DOCX generation
   ├─ xlsxwriter ready for Excel
   └─ matplotlib ready for charts ✅
```

---

## GIT WORKFLOW (UPDATES)

### Untuk update code di VPS:

```bash
cd /home/apps/deepernova

# 1. Pull latest from GitHub
git pull origin main

# 2. If package.json changed
npm install
cd server && npm install && cd ..

# 3. If frontend changed
npm run build

# 4. Restart backend
pm2 restart deepernova-server

# 5. Done!
```

**JANGAN edit .env dari git** - itu manual di VPS saja!

---

## PORT MAPPING

| Service | Port | Protocol | Notes |
|---------|------|----------|-------|
| Frontend (Nginx) | 80 | HTTP | → dist/index.html |
| Frontend (Nginx) | 443 | HTTPS | → dist/index.html (with SSL) |
| Backend API | 3001 | HTTP | Direct backend (proxied by Nginx) |
| SSH | 22 | SSH | Server management |

**Firewall settings:**
```bash
sudo ufw allow 22   # SSH
sudo ufw allow 80   # HTTP
sudo ufw allow 443  # HTTPS
sudo ufw allow 3001 # Backend (optional, biasanya via Nginx)
```

---

## DATABASE PERSISTENCE

SQLite database **otomatis dibuat** saat backend pertama kali start:
```
/home/apps/deepernova/server/deepernova.db
```

**Data persists across:**
- Server restarts ✅
- Backend redeployments ✅
- SSH disconnections ✅

**Backup reguler:**
```bash
# Daily backup
cp /home/apps/deepernova/server/deepernova.db ~/backups/deepernova_$(date +%Y%m%d).db
```

---

## PYTHON INTEGRATION

Backend calls Python untuk file generation:

```javascript
// server/agentService.js
const { spawn } = require('child_process');

// Spawn Python process dengan venv
const python = spawn('python3', ['script.py'], {
  cwd: '/home/apps/deepernova',
  env: { ...process.env, PYTHONPATH: '.../venv/lib/python3.x/site-packages' }
});
```

**Python packages di venv:**
- `matplotlib` - Charts/graphs
- `python-docx` - DOCX generation
- `python-pptx` - PPTX generation
- `xlsxwriter` - Excel generation
- `beautifulsoup4` - Web scraping
- `requests` - HTTP requests

---

## SECURITY BEST PRACTICES

### 1. .env Management
```bash
# ✅ DO - Store actual keys ONLY di VPS .env
nano /home/apps/deepernova/.env
# NEVER share or commit to Git

# ✅ DO - Version control .env.example with placeholders
git add .env.example
git commit -m "Add .env.example template"

# ❌ DON'T - Commit .env with actual keys
git add .env  # WRONG! Already in .gitignore
```

### 2. Admin API Key
```env
# Change default
ADMIN_API_KEY=your_super_secure_random_string_minimum_32_chars
```

### 3. API Keys Rotation
- Store in .env (not in code)
- Rotate quarterly
- Monitor usage in dashboards

### 4. Database Backup
```bash
# Automated backup
00 02 * * * cp /home/apps/deepernova/server/deepernova.db /backups/deepernova_$(date +\%Y\%m\%d).db
```

### 5. SSL/HTTPS (Recommended)
```bash
# Use Let's Encrypt (FREE)
sudo certbot certonly --nginx -d yourdomain.com
# Auto-renews every 60 days
```

---

## MONITORING & HEALTH CHECKS

### Manual Health Check
```bash
# Backend
curl http://localhost:3001/health

# Frontend
curl http://yourdomain.com | head -1
# Expected: <!DOCTYPE html>

# Database
sqlite3 /home/apps/deepernova/server/deepernova.db ".tables"
# Expected: messages users sessions apikeys...
```

### PM2 Monitoring
```bash
pm2 monit          # Real-time stats
pm2 logs            # View logs
pm2 status          # Check running services
pm2 save            # Save to auto-start
```

### Cron Jobs (Optional)
```bash
# Monitor every 5 min
*/5 * * * * curl -f http://localhost:3001/health || pm2 restart deepernova-server

# Daily backup
0 2 * * * cp /home/apps/deepernova/server/deepernova.db /backups/deepernova_$(date +\%Y\%m\%d).db
```

---

## ROLLBACK STRATEGY

If deployment breaks:

```bash
# 1. Check what went wrong
pm2 logs deepernova-server

# 2. Revert to last working version
cd /home/apps/deepernova
git log --oneline -5
git revert <commit-hash>  # or git reset --hard <commit-hash>

# 3. Rebuild & restart
npm install
npm run build
pm2 restart deepernova-server

# 4. Restore database if needed
cp ~/backups/deepernova_backup.db /home/apps/deepernova/server/deepernova.db

# 5. Test
curl http://localhost:3001
```

---

## PERFORMANCE TIPS

1. **Enable Nginx caching**
   - Static assets: 30 days
   - API: no cache

2. **Database optimization**
   ```bash
   sqlite3 /home/apps/deepernova/server/deepernova.db "PRAGMA optimize;"
   ```

3. **PM2 Memory limit**
   - Set in ecosystem.config.js: `max_memory_restart: '500M'`

4. **Log rotation**
   ```bash
   npm install -g pm2-logrotate
   pm2 install pm2-logrotate
   ```

---

## SUMMARY - DEPLOYMENT CHECKLIST

- [ ] VPS setup (Node.js, Python, Git, Nginx)
- [ ] Clone repository: `git clone ...`
- [ ] Create .env with ALL API keys (NOT from git)
- [ ] Install dependencies: `npm install` + `pip install`
- [ ] Build frontend: `npm run build`
- [ ] Start backend: `pm2 start server/server.js`
- [ ] Configure Nginx reverse proxy
- [ ] Test: `curl http://localhost:3001` & `curl http://domain.com`
- [ ] Enable auto-restart: `pm2 startup && pm2 save`
- [ ] Setup SSL: `certbot certonly --nginx -d yourdomain.com`
- [ ] Create backup strategy
- [ ] Monitor with `pm2 logs`
- [ ] Done! ✅

---

**Next steps:**
1. Read `DEPLOYMENT_HOSTINGER_VPS.md` for detailed instructions
2. Use `DEPLOYMENT_QUICK_REFERENCE.md` for quick commands
3. Keep `.env.example` updated when adding new API keys
4. Backup database regularly
5. Monitor logs daily first week, then weekly

Sukses deploy! 🚀
