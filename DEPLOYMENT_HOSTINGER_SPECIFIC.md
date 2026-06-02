# 🌐 HOSTINGER VPS - SPECIFIC SETUP

> Panduan khusus untuk Hostinger VPS, includes Hostinger-specific settings

---

## 1️⃣ HOSTINGER VPS ACCESS

### Get SSH Credentials
1. Login ke [Hostinger Dashboard](https://hpanel.hostinger.com)
2. Go to **VPS** → Select your VPS instance
3. Click **Manage** → **SSH Access**
4. Copy credentials:
   - **IP Address**: `xxx.xxx.xxx.xxx`
   - **Username**: `root` (or your user)
   - **Password**: (shown once, save!)
   - **Port**: Usually `22` (default)

### SSH Connect
```bash
# Windows (PowerShell, Cmd, atau PuTTY)
ssh -p 22 root@your_vps_ip
# Password: (paste dari Hostinger)

# macOS/Linux
ssh root@your_vps_ip
```

### First Login - Change Password
```bash
passwd
# Enter new password (STRONG!)
# This is your root password now
```

---

## 2️⃣ HOSTINGER-SPECIFIC SETUP

### Check VPS Specs
```bash
# CPU cores
nproc

# RAM
free -h

# Disk space
df -h

# OS version
cat /etc/os-release
```

Typical Hostinger specs:
- **VPS Basic**: 1 vCPU, 2GB RAM, 50GB SSD → NOT enough
- **VPS Pro**: 2 vCPU, 4GB RAM, 100GB SSD → GOOD for Deepernova
- **VPS Max**: 4 vCPU, 8GB RAM, 200GB SSD → EXCELLENT

### Node.js Installation (Hostinger Recommended)
```bash
# NodeSource repo (latest LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs

# Verify
node --version  # Should be v20.x
npm --version
```

---

## 3️⃣ HOSTINGER FIREWALL SETUP

### Via Dashboard
1. **hPanel** → **VPS** → **Settings** → **Firewall**
2. **Add Rule**:
   - Inbound Port `22` (SSH)
   - Inbound Port `80` (HTTP)
   - Inbound Port `443` (HTTPS)
   - Inbound Port `3001` (optional, for debugging)

### Via Command Line
```bash
# UFW (Uncomplicated Firewall)
ufw enable
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 3001/tcp  # Backend (optional)
ufw status

# Or allow all inbound from specific IP
ufw allow from 192.168.1.1
```

---

## 4️⃣ HOSTINGER DOMAIN SETUP

### Connect Domain to VPS IP

If your domain is also at Hostinger:
1. **hPanel** → **Domains** → Select your domain
2. **DNS Records** → **Edit**
3. Add/Update:
   ```
   A Record:
   Name: @ (or www)
   Type: A
   Value: your_vps_ip
   TTL: 3600
   ```

4. Save and wait 5-30 min for DNS propagation

### Test DNS Resolution
```bash
nslookup yourdomain.com
# Should resolve to your_vps_ip
```

---

## 5️⃣ SSL CERTIFICATE (FREE with Certbot)

### Install Certbot
```bash
apt install -y certbot python3-certbot-nginx
```

### Get Certificate
```bash
certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com
# Or with nginx (if already running):
certbot certonly --nginx -d yourdomain.com
```

### Update Nginx Config
```bash
nano /etc/nginx/sites-available/deepernova
```

Add SSL section:
```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Security headers
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    add_header Strict-Transport-Security "max-age=31536000" always;

    # ... rest of your config
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

```bash
# Test and restart
nginx -t
systemctl restart nginx

# Auto-renewal setup
systemctl enable certbot.timer
systemctl start certbot.timer

# Check cert status
certbot certificates
```

---

## 6️⃣ HOSTINGER CPANEL (If available)

Some Hostinger plans include cPanel:

### Access cPanel
1. **hPanel** → **Services** → **cPanel**
2. Or direct URL: `https://yourvps_ip:2083`

### Using cPanel for Nginx/Web
- Go to **Software** → **EasyApache**
- Or **Web Server Configuration**

For Deepernova, use **Terminal** in cPanel:
```bash
# Same commands as SSH, but via cPanel interface
```

---

## 7️⃣ HOSTINGER BACKUP MANAGEMENT

### Automated Backups (if available)
1. **hPanel** → **VPS** → **Backups**
2. Create snapshot before deployment
3. Schedule automatic backups

### Manual Backup
```bash
# Create backup directory
mkdir -p /home/backups

# Backup everything
tar -czf /home/backups/deepernova_$(date +%Y%m%d_%H%M%S).tar.gz /home/apps/deepernova/

# Backup database only
cp /home/apps/deepernova/server/deepernova.db /home/backups/deepernova.db.backup

# List backups
ls -lah /home/backups/
```

### Download Backups to Local
```bash
# From your local machine
scp root@your_vps_ip:/home/backups/deepernova_*.tar.gz ~/Downloads/
```

---

## 8️⃣ HOSTINGER PERFORMANCE TUNING

### Increase Nginx Worker Connections
```bash
nano /etc/nginx/nginx.conf
```

Find and update:
```nginx
worker_processes auto;  # Use all available CPUs

events {
    worker_connections 2000;  # Default 512
}

http {
    client_max_body_size 500M;  # Allow large file uploads
    gzip on;  # Enable compression
    gzip_min_length 1024;
    gzip_types text/plain text/css text/javascript application/json;
}
```

### Optimize Node.js
```bash
# Create .env tweak
NODE_ENV=production
NODE_OPTIONS=--max-old-space-size=2048  # 2GB max memory
```

### Database Optimization
```bash
# Once daily
sqlite3 /home/apps/deepernova/server/deepernova.db "PRAGMA optimize; PRAGMA analyze;"
```

---

## 9️⃣ HOSTINGER MONITORING

### Check Resource Usage
```bash
# CPU & Memory
top
# Press 'q' to exit

# Disk I/O
iostat -x 1 5

# Network
netstat -an | grep ESTABLISHED | wc -l

# Check logs
tail -f /var/log/syslog
tail -f /var/log/auth.log
```

### Monitor PM2 in background
```bash
# Install PM2 monitoring
npm install -g pm2
pm2 install pm2-auto-pull  # Auto-update from git

# Monitor
pm2 logs --lines 100
pm2 monit
```

### Cron Job untuk Health Check
```bash
# Edit crontab
crontab -e

# Add this line to check backend every 5 minutes
*/5 * * * * curl -f http://localhost:3001/health || (pm2 restart deepernova-server && echo "Restarted at $(date)" >> /var/log/deepernova-health.log)
```

---

## 🔟 HOSTINGER SECURITY

### Fail2Ban (Prevent Brute Force)
```bash
apt install -y fail2ban

# Create filter
cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
nano /etc/fail2ban/jail.local

# Add this section
[sshd]
enabled = true
maxretry = 5
findtime = 600
bantime = 3600

# Start
systemctl enable fail2ban
systemctl start fail2ban
systemctl status fail2ban
```

### Strong SSH Key (Better than Password)
```bash
# On local machine
ssh-keygen -t ed25519 -f ~/.ssh/hostinger_key -C "deepernova@hostinger"

# Copy to VPS
ssh-copy-id -i ~/.ssh/hostinger_key.pub -p 22 root@your_vps_ip

# Disable password auth (optional, risky if key lost!)
nano /etc/ssh/sshd_config
# Set: PermitRootLogin prohibit-password
# Or: PubkeyAuthentication yes, PasswordAuthentication no
systemctl restart sshd
```

### Limit Root Access
```bash
# Create non-root user
useradd -m -s /bin/bash deployer
usermod -aG sudo deployer
passwd deployer  # Set password

# Switch to deployer
su - deployer

# Future SSH: ssh deployer@your_vps_ip
```

---

## 1️⃣1️⃣ TROUBLESHOOTING HOSTINGER-SPECIFIC

### Issue: Can't reach backend from frontend
```bash
# Check firewall
ufw status

# Allow backend port
ufw allow 3001/tcp

# Check if backend running
ps aux | grep node

# Check listening ports
netstat -tlnp | grep 3001
```

### Issue: DNS not resolving
```bash
# Wait 5-30 min for DNS propagation
nslookup yourdomain.com

# If still not working, check Hostinger DNS settings:
# hPanel → Domains → DNS Records
# Verify A record points to your VPS IP
```

### Issue: SSL certificate not renewing
```bash
# Check certificate
certbot certificates

# Renew manually
certbot renew --force-renewal

# Check renewal logs
tail -f /var/log/letsencrypt/letsencrypt.log
```

### Issue: Out of disk space
```bash
# Check disk usage
df -h

# Find large files
du -sh /home/apps/deepernova/*
du -sh /home/apps/deepernova/server/*

# Clean temp files
rm -rf /home/apps/deepernova/server/temp-files/*
rm -f /home/backups/*.gz  # Old backups

# Clean npm cache
npm cache clean --force
```

### Issue: RAM insufficient
```bash
# Check memory
free -h

# Enable swap (if not present)
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
swapon --show

# Make permanent
echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab
```

---

## 1️⃣2️⃣ DEPLOYMENT FLOW (Hostinger)

```bash
# 1. SSH to VPS
ssh root@your_vps_ip

# 2. Setup (first time only)
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs python3 python3-pip git nginx certbot python3-certbot-nginx
npm install -g pm2

# 3. Clone & setup
mkdir -p /home/apps && cd /home/apps
git clone https://github.com/your-username/ARTIFICIAL-INTELIGENT-ORION.git deepernova
cd deepernova

# 4. .env (CRITICAL)
nano .env
# Paste all content, fill API keys
# Ctrl+O → Enter → Ctrl+X

# 5. Install deps
npm install
cd server && npm install && cd ..
npm run build

# 6. Python
python3 -m pip install matplotlib python-docx python-pptx xlsxwriter beautifulsoup4 requests

# 7. Start backend
pm2 start server/server.js --name deepernova-server
pm2 startup
pm2 save

# 8. Setup Nginx (copy config from earlier steps)
nano /etc/nginx/sites-available/deepernova
# ... paste config ...
ln -s /etc/nginx/sites-available/deepernova /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

# 9. SSL
certbot certonly --nginx -d yourdomain.com

# 10. Test
curl http://localhost:3001
curl https://yourdomain.com

# Done! 🎉
```

---

## 1️⃣3️⃣ HOSTINGER SUPPORT RESOURCES

- **Docs**: https://support.hostinger.com/en/articles/4632381
- **Control Panel**: https://hpanel.hostinger.com
- **Tickets**: Support chat in hPanel
- **Community**: https://hostinger.com/forums

---

## FINAL CHECKLIST (Hostinger VPS)

- [ ] VPS purchased & running (check hPanel)
- [ ] SSH access working
- [ ] Password changed
- [ ] Firewall configured (80, 443, 22)
- [ ] Domain DNS pointing to VPS IP
- [ ] Node.js & Python installed
- [ ] Repository cloned
- [ ] .env created with API keys (MANUAL, not from git)
- [ ] npm install & npm run build done
- [ ] Backend running (pm2 status)
- [ ] Nginx configured & running
- [ ] SSL certificate installed
- [ ] Test: `https://yourdomain.com` loads
- [ ] Test: File generation works
- [ ] Backups scheduled
- [ ] Monitoring setup (cron job)
- [ ] Done! ✅

---

**Tips:**
- Keep backups on external storage (not on VPS)
- Monitor disk space weekly
- Update packages monthly
- Check logs for errors daily first week
- Enable email alerts for uptime monitoring

Sukses deploy di Hostinger! 🚀
