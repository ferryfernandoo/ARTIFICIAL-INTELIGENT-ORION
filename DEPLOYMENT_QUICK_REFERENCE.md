# ⚡ QUICK DEPLOYMENT REFERENCE CARD

## STEP-BY-STEP SINGKAT (15 MENIT)

### 1️⃣ SSH & SETUP (First time only)
```bash
ssh root@your_vps_ip
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs python3 python3-pip git nginx

# Python packages for file generation
python3 -m pip install matplotlib python-docx python-pptx xlsxwriter beautifulsoup4 requests
```

### 2️⃣ CLONE & SETUP PROJECT
```bash
mkdir -p /home/apps && cd /home/apps
git clone https://github.com/your-username/ARTIFICIAL-INTELIGENT-ORION.git deepernova
cd deepernova

# Create .env file (nano editor)
nano .env
# Paste isi dari .env.example, isi semua API keys
# Ctrl+O → Enter → Ctrl+X
```

### 3️⃣ INSTALL DEPENDENCIES
```bash
npm install
cd server && npm install && cd ..
npm run build  # Build frontend (generate dist/)
```

### 4️⃣ START SERVER (PILIH SATU)

#### A. Simple (debugging)
```bash
cd /home/apps/deepernova/server
node server.js
# Ctrl+C untuk stop
```

#### B. PM2 (RECOMMENDED - auto restart)
```bash
npm install -g pm2
pm2 start server/server.js --name deepernova-server
pm2 startup
pm2 save

# Monitor
pm2 logs
pm2 status
```

#### C. Systemd (production)
```bash
# Setup described in full guide
sudo systemctl start deepernova
sudo systemctl enable deepernova
```

### 5️⃣ SETUP NGINX (Serve frontend + proxy backend)
```bash
# Replace IP di config
cat > /etc/nginx/sites-available/deepernova << 'EOF'
server {
    listen 80;
    server_name your_domain.com;

    root /home/apps/deepernova/dist;
    index index.html;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy backend
    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Enable
sudo ln -s /etc/nginx/sites-available/deepernova /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 6️⃣ TEST
```bash
# Backend
curl http://localhost:3001/health

# Frontend  
curl http://your_vps_ip
# Expected: HTML

# Logs
pm2 logs deepernova-server
```

---

## ✅ VERIFICATION CHECKLIST

- [ ] `node --version` shows v18+
- [ ] `python3 --version` shows 3.10+
- [ ] `npm list -g pm2` shows pm2 installed
- [ ] `cat /home/apps/deepernova/.env | grep DEEPSEEK_API_KEY` shows key
- [ ] `curl http://localhost:3001` returns response (backend works)
- [ ] `curl http://your_vps_ip` returns HTML (frontend works)
- [ ] `pm2 status` shows running
- [ ] Database exists: `ls -la /home/apps/deepernova/server/deepernova.db`

---

## 🔧 COMMON COMMANDS

```bash
# Backend
pm2 restart deepernova-server    # Restart
pm2 stop deepernova-server        # Stop
pm2 logs deepernova-server        # View logs
pm2 status                        # Check status

# Git updates
cd /home/apps/deepernova
git pull origin main
npm install
npm run build
pm2 restart deepernova-server

# Database backup
cp /home/apps/deepernova/server/deepernova.db ~/deepernova.db.backup

# View firewall
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Nginx
sudo systemctl restart nginx
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

---

## 🚨 TROUBLESHOOTING QUICK FIX

| Issue | Solution |
|-------|----------|
| "Module not found: better-sqlite3" | `cd server && npm rebuild better-sqlite3` |
| "DEEPSEEK_API_KEY not found" | `nano .env` → add key → `pm2 restart deepernova-server` |
| "502 Bad Gateway" | `pm2 status` → `pm2 logs` → check if backend running |
| "Cannot connect to backend" | Check firewall: `sudo ufw allow 3001/tcp` |
| "Port 3001 already in use" | `sudo lsof -i :3001` → `sudo kill -9 <PID>` |

---

## ENV VARIABLES MINIMUM REQUIRED

```env
DEEPSEEK_API_KEY=sk-...
VITE_DEEPSEEK_API_KEY=sk-...
WORLD_NEWS_API_KEY=...
TOKENMIX_API_KEY=...
SERPAPI_KEY=...
XENDIT_API_KEY=xnd_...
NODE_ENV=production
VITE_API_BASE_URL=https://yourdomain.com
ADMIN_API_KEY=random_secure_key_12345
```

---

## FOR CI/CD (FUTURE)

Jika ingin auto-deploy dengan git push:

```bash
# Di VPS, setup git hook
cat > /home/apps/deepernova/.git/hooks/post-receive << 'EOF'
#!/bin/bash
cd /home/apps/deepernova
git reset --hard HEAD
npm install
npm run build
pm2 restart deepernova-server
EOF

chmod +x /home/apps/deepernova/.git/hooks/post-receive
```

Maka setiap `git push`, VPS auto-deploy!

---

**More detailed guide:** See `DEPLOYMENT_HOSTINGER_VPS.md` in project root
