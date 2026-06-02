# 🌐 SETUP FRONTEND KE HOSTINGER VPS

Backend sudah jalan di VPS: **http://187.77.116.90:3001** ✅

## FRONTEND CONFIGURATION SUDAH UPDATED:

✅ `.env` - VITE_API_BASE_URL = http://187.77.116.90:3001
✅ `.env.production` - Created untuk production
✅ `vite.config.js` - Proxy target updated
✅ Build complete - `dist/` ready untuk VPS

---

## NEXT STEPS:

### 1️⃣ OPTION A: Test di Local (Dev Mode)
```bash
cd c:\Users\ferry fernando\ARTIFICIAL-INTELIGENT-ORION
npm run dev
# Buka: http://localhost:5173
# Frontend akan connect ke VPS backend (187.77.116.90:3001)
```

### 2️⃣ OPTION B: Deploy Frontend ke VPS via Nginx

Upload `dist/` folder ke VPS:

```bash
# Di Windows
scp -r "c:\Users\ferry fernando\ARTIFICIAL-INTELIGENT-ORION\dist" root@187.77.116.90:/home/apps/deepernova/

# Atau gunakan WinSCP / FileZilla
```

Di VPS, setup Nginx:
```bash
ssh root@187.77.116.90

# Copy dist ke Nginx root
cp -r /home/apps/deepernova/dist /var/www/html/

# Restart Nginx
systemctl restart nginx
```

Buka: **http://187.77.116.90** (frontend akan jalan)

---

## ✅ TESTING CHECKLIST

```bash
# 1. Test backend di VPS
curl http://187.77.116.90:3001/health
# Expected: response

# 2. Test frontend dev mode
npm run dev
# Open browser: http://localhost:5173

# 3. Test API connection
# Di chat, try: "buat docx"
# Harus terhubung ke VPS backend

# 4. Test file generation
# Generate PPTX/DOCX dan download
# Harus working dari VPS
```

---

## ⚠️ ISSUE: DEEPSEEK_API_KEY not loaded

**Di VPS .env** masih belum ada API keys!

```bash
# SSH ke VPS
ssh root@187.77.116.90

# Edit .env
nano /root/agent/.env
# atau
nano /home/apps/deepernova/.env

# Add:
DEEPSEEK_API_KEY=sk-bf333936dd084c5f9016521b1b896610
VITE_DEEPSEEK_API_KEY=sk-bf333936dd084c5f9016521b1b896610
# ... semua keys dari .env.example

# Save & restart
pm2 restart deepernova-server
```

---

## 📝 CURRENT STATUS

| Component | Status | Details |
|-----------|--------|---------|
| Backend (VPS) | ✅ Running | http://187.77.116.90:3001 |
| Python | ✅ Available | Python 3.12.3 |
| Database | ✅ Initialized | SQLite ready |
| Frontend (Local) | ✅ Updated | Pointing to VPS |
| Frontend (VPS) | ⏳ Ready to deploy | dist/ folder built |
| API Keys (VPS) | ⚠️ Missing | Need to add .env |
| Nginx | ⏳ Ready | Can serve frontend |

---

## 🚀 QUICK DEPLOYMENT PLAN

```bash
# 1. Fix VPS .env (add API keys)
ssh root@187.77.116.90
nano /root/agent/.env
# Add all API keys
pm2 restart deepernova-server

# 2. Test backend
curl http://187.77.116.90:3001

# 3. Deploy frontend (optional)
scp -r dist/ root@187.77.116.90:/var/www/html/
# Or use Nginx to serve from dist folder

# 4. Setup domain (if have)
# Point DNS to 187.77.116.90

# 5. Done!
```

---

**Mau saya bantu:**
1. Add .env keys ke VPS? 
2. Deploy frontend ke VPS?
3. Test connection?

Kasih tahu langkah mana yang mau dilakukan next! 🎯
