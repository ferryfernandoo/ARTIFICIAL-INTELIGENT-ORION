# 📦 PANDUAN DEPLOYMENT KE HOSTINGER VPS

> Panduan lengkap upload Deepernova AI ke Hostinger VPS menggunakan Git Clone

---

## 1️⃣ PRE-DEPLOYMENT CHECKLIST

Sebelum deploy, pastikan:

### ✅ Di Laptop (Local)
- [ ] Semua kode sudah commit ke Git
- [ ] `.env` file EXISTS dan berisi semua API keys
- [ ] `.gitignore` sudah set (jangan push API keys ke public repo!)
- [ ] `node_modules/` sudah di `.gitignore`
- [ ] Test run `npm run dev` & `npm start` berjalan lancar
- [ ] Build frontend: `npm run build` berhasil (output di `dist/`)

### ✅ Di Hostinger VPS
- [ ] SSH access sudah aktif
- [ ] Node.js v18+ sudah installed
- [ ] Python 3.10+ sudah installed (untuk file generation)
- [ ] Git sudah installed
- [ ] npm/yarn package manager ready

---

## 2️⃣ SETUP VPS (FIRST TIME ONLY)

### Step 1: SSH ke VPS
```bash
ssh root@your_vps_ip
# atau
ssh username@your_vps_ip
```

### Step 2: Update System
```bash
apt update && apt upgrade -y
```

### Step 3: Install Dependencies
```bash
# Node.js & npm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs

# Python3 (untuk file generation)
apt install -y python3 python3-pip python3-venv

# Git
apt install -y git

# Optional: PM2 (process manager)
npm install -g pm2

# Verify installations
node --version
python3 --version
git --version
```

### Step 4: Setup Project Directory
```bash
# Create app folder
mkdir -p /home/apps
cd /home/apps

# Clone repository
git clone https://github.com/your-username/ARTIFICIAL-INTELIGENT-ORION.git deepernova
cd deepernova
```

---

## 3️⃣ HANDLE .ENV FILE (CRITICAL!)

### Option A: Manual Setup (RECOMMENDED untuk production)
```bash
# Create .env file di VPS
nano .env
```

Copy paste isi .env file dari laptop. Atur:
```
# Backend URL HARUS sesuai domain VPS
VITE_API_BASE_URL=https://api.yourdomain.com
# atau
VITE_API_BASE_URL=http://your_vps_ip:3001

# Pastikan semua API keys updated
DEEPSEEK_API_KEY=sk-...
VITE_DEEPSEEK_API_KEY=sk-...
WORLD_NEWS_API_KEY=...
TOKENMIX_API_KEY=...
SERPAPI_KEY=...

# Production mode
NODE_ENV=production

# Secure admin key - GANTI DENGAN RANDOM STRING
ADMIN_API_KEY=your_secure_random_key_here_12345

# Pastikan semua keys ada sebelum continue
```

Ctrl+O → Enter → Ctrl+X (to save & exit nano)

### Option B: Git + .env.example (BETTER for team)
Jika ingin secure:
1. **Di laptop**, buat file `.env.example` (tanpa sensitive data):
```bash
# Copy .env tapi hapus API key values
cp .env .env.example
# Edit .env.example, ganti values jadi placeholder:
# DEEPSEEK_API_KEY=your_key_here
# Commit: git add .env.example && git commit
```

2. **Di VPS**, setelah git clone:
```bash
cp .env.example .env
nano .env
# Edit dengan actual API keys
```

---

## 4️⃣ INSTALL DEPENDENCIES

### Frontend
```bash
cd /home/apps/deepernova
npm install
npm run build  # Generate dist/ folder
```

### Server
```bash
cd /home/apps/deepernova/server
npm install
```

### Python (untuk file generation)
```bash
cd /home/apps/deepernova
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install --upgrade pip
pip install matplotlib python-docx python-pptx xlsxwriter
pip install beautifulsoup4 requests lxml

# Check installation
python3 -c "import docx; print('✅ python-docx installed')"
python3 -c "from pptx import Presentation; print('✅ python-pptx installed')"

deactivate  # Exit virtual env
```

---

## 5️⃣ STARTUP OPTIONS

### Option A: Manual Start (Debugging)
```bash
# Terminal 1: Frontend (static serve)
cd /home/apps/deepernova
npm run preview
# atau serve dist/ folder dengan nginx/caddy

# Terminal 2: Backend
cd /home/apps/deepernova/server
node server.js
# Output: 🚀 File Generation Server running on http://localhost:3001
```

### Option B: PM2 (RECOMMENDED - Auto restart)
```bash
# Install PM2 globally (sudah done di Step 2)
npm install -g pm2

# Buat ecosystem file
cat > /home/apps/deepernova/ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'deepernova-server',
      script: './server/server.js',
      cwd: '/home/apps/deepernova',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/server-error.log',
      out_file: './logs/server-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
EOF

# Start dengan PM2
pm2 start ecosystem.config.js

# Make it auto-start on reboot
pm2 startup
pm2 save

# Monitor
pm2 logs deepernova-server
pm2 status
```

### Option C: SystemD Service (PRODUCTION)
```bash
# Create service file
sudo nano /etc/systemd/system/deepernova.service
```

Paste:
```ini
[Unit]
Description=Deepernova AI Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/home/apps/deepernova
Environment="NODE_ENV=production"
Environment="PATH=/home/apps/deepernova/node_modules/.bin:/usr/local/bin:/usr/bin"
ExecStart=/usr/bin/node server/server.js
Restart=on-failure
RestartSec=10
StandardOutput=append:/var/log/deepernova/out.log
StandardError=append:/var/log/deepernova/error.log

[Install]
WantedBy=multi-user.target
```

```bash
# Enable & start
sudo systemctl daemon-reload
sudo systemctl enable deepernova
sudo systemctl start deepernova

# Check status
sudo systemctl status deepernova
sudo tail -f /var/log/deepernova/out.log
```

---

## 6️⃣ FRONTEND SERVING

### Option A: Serve via Nginx (RECOMMENDED)
```bash
# Install nginx
apt install -y nginx

# Create config
sudo nano /etc/nginx/sites-available/deepernova.conf
```

Paste:
```nginx
server {
    listen 80;
    server_name your_domain.com;

    # Redirect HTTP to HTTPS (optional, perlu SSL)
    # return 301 https://$server_name$request_uri;

    # Serve frontend dist/
    root /home/apps/deepernova/dist;
    index index.html;

    # SPA routing - fallback ke index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests ke backend
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/deepernova.conf /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Start
sudo systemctl start nginx
sudo systemctl enable nginx

# Check
sudo systemctl status nginx
```

### Option B: npm preview (Quick test)
```bash
cd /home/apps/deepernova
npm run preview
# Open: http://your_vps_ip:4173
```

---

## 7️⃣ DATABASE SETUP

Server akan auto-create SQLite database:
```bash
# Database location
/home/apps/deepernova/server/deepernova.db

# Verify it exists after first run
ls -la /home/apps/deepernova/server/deepernova.db
```

Jika perlu backup:
```bash
# Backup database
cp /home/apps/deepernova/server/deepernova.db ~/backups/deepernova_backup.db

# Restore
cp ~/backups/deepernova_backup.db /home/apps/deepernova/server/deepernova.db
```

---

## 8️⃣ PORT CONFIGURATION

**Backend Port (default: 3001)**
- Update di `server/server.js` atau `.env` jika perlu ganti
- Make sure firewall allows:
```bash
# Check firewall
sudo ufw status

# Allow ports
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS (if SSL)
sudo ufw allow 3001/tcp # Backend (if direct access)
sudo ufw enable
```

**Frontend Port (via Nginx on 80/443)**
- Nginx handle routing

---

## 9️⃣ SSL/HTTPS (Optional but Recommended)

### Using Let's Encrypt (FREE)
```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot certonly --nginx -d your_domain.com -d www.your_domain.com

# Auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

Update nginx config to use SSL:
```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name your_domain.com;

    ssl_certificate /etc/letsencrypt/live/your_domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your_domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # ... rest of config
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name your_domain.com;
    return 301 https://$server_name$request_uri;
}
```

---

## 🔟 TESTING DEPLOYMENT

```bash
# 1. Check backend running
curl http://localhost:3001/health
# Expected: OK or similar response

# 2. Check frontend available
curl http://your_vps_ip:80
# Expected: HTML content

# 3. Check logs
pm2 logs deepernova-server
# atau
sudo journalctl -u deepernova -f

# 4. Test file generation via API
curl -X POST http://localhost:3001/generate-file \
  -H "Content-Type: application/json" \
  -d '{"task":"buat docx file test"}'
```

---

## 1️⃣1️⃣ TROUBLESHOOTING

### Error: "Cannot find module 'better-sqlite3'"
```bash
cd /home/apps/deepernova/server
npm rebuild better-sqlite3
```

### Error: "Python not found"
```bash
# Check Python installed
which python3

# If not, install:
apt install -y python3

# Verify packages
python3 -c "import docx; from pptx import Presentation"
```

### Error: "DEEPSEEK_API_KEY not configured"
```bash
# Check .env exists and has the key
cat /home/apps/deepernova/.env | grep DEEPSEEK

# If missing, add it:
echo "DEEPSEEK_API_KEY=sk-..." >> /home/apps/deepernova/.env

# Restart server
pm2 restart deepernova-server
```

### Error: "Port 3001 already in use"
```bash
# Find process using port
sudo lsof -i :3001

# Kill it
sudo kill -9 <PID>

# Or change port in .env or server.js
PORT=3002 pm2 restart deepernova-server
```

### Error: "Nginx 502 Bad Gateway"
```bash
# Check if backend running
pm2 status

# Check backend logs
pm2 logs deepernova-server

# Restart backend
pm2 restart deepernova-server

# Restart nginx
sudo systemctl restart nginx
```

---

## 1️⃣2️⃣ MONITORING & MAINTENANCE

### Daily Checks
```bash
# Check all services
pm2 status
sudo systemctl status nginx

# Check disk space
df -h

# Check memory usage
free -h

# Check logs
pm2 logs

# Backup database
tar -czf ~/backups/deepernova_$(date +%Y%m%d).tar.gz /home/apps/deepernova/server/deepernova.db
```

### Weekly Tasks
```bash
# Update packages
apt update && apt upgrade -y

# Clean old logs
find /var/log -name "*.log" -mtime +7 -delete

# Check certificate expiry
sudo certbot certificates
```

### Monthly
```bash
# Full system backup
rsync -avz /home/apps/deepernova ~/backups/deepernova_full_$(date +%Y%m%d)/

# Database optimization
sqlite3 /home/apps/deepernova/server/deepernova.db "VACUUM;"
```

---

## 1️⃣3️⃣ QUICK REFERENCE - DEPLOYMENT SCRIPT

Create `deploy.sh` di VPS:
```bash
#!/bin/bash

cd /home/apps/deepernova

# Pull latest code
git pull origin main

# Install dependencies
npm install
cd server && npm install && cd ..

# Build frontend
npm run build

# Restart server
pm2 restart deepernova-server

echo "✅ Deployment complete!"
```

Usage:
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 1️⃣4️⃣ ENV VARIABLES CHECKLIST

Pastikan `.env` di VPS memiliki:

```
# REQUIRED
DEEPSEEK_API_KEY=sk-...
VITE_DEEPSEEK_API_KEY=sk-...
WORLD_NEWS_API_KEY=...
TOKENMIX_API_KEY=...
SERPAPI_KEY=...
XENDIT_API_KEY=xnd_...
ADMIN_API_KEY=your_secure_key

# IMPORTANT
NODE_ENV=production
VITE_API_BASE_URL=https://yourdomain.com (or http://ip:3001)

# OPTIONAL
PORT=3001
```

---

## QUICK START CHECKLIST

1. ✅ SSH ke VPS
2. ✅ `apt update && apt upgrade -y`
3. ✅ Install Node, Python, Git, nginx
4. ✅ `git clone` repository
5. ✅ Create `.env` dengan semua API keys
6. ✅ `npm install` di root & server/
7. ✅ `npm run build` frontend
8. ✅ `pip install` Python packages
9. ✅ Setup PM2 atau SystemD
10. ✅ Setup Nginx reverse proxy
11. ✅ Test: `curl http://localhost:3001`
12. ✅ Done! 🚀

---

**Support:**
- Check logs: `pm2 logs` or `journalctl -u deepernova -f`
- Restart: `pm2 restart deepernova-server`
- Stop: `pm2 stop deepernova-server`
- Status: `pm2 status`

Sukses deploy! 🎉
