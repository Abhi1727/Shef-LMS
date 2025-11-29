# 🚀 Hostinger VPS Deployment Guide for learnwithshef.com

## ✅ VPS Information
- **Provider:** Hostinger VPS
- **OS:** Ubuntu 24.04.3 LTS
- **RAM:** 15GB
- **Storage:** 193GB
- **Domain:** learnwithshef.com (Hostinger DNS)

---

## 📋 What Will Be Installed

1. **Nginx** - Web server & reverse proxy
2. **PM2** - Process manager for Node.js apps
3. **Certbot** - Free SSL certificates (Let's Encrypt)
4. **MongoDB** (Optional) - If you want local DB instead of Firebase
5. **UFW** - Firewall configuration

---

## 🎯 Deployment Architecture

```
learnwithshef.com (Port 80/443)
         ↓
    Nginx (Reverse Proxy)
         ↓
    ┌────────────┬────────────┐
    ↓            ↓            ↓
Frontend    Backend API   Static Files
(React)     (Node:5000)   (/var/www/)
Port 3000   PM2 Managed
```

---

## ⚡ Quick Deployment (Run This Script)

```bash
cd /root/Shef-LMS
./deploy-vps.sh
```

This will:
1. Install all dependencies
2. Setup Firebase credentials
3. Build frontend
4. Configure Nginx
5. Setup SSL certificate
6. Start backend with PM2
7. Configure firewall

**Total time:** ~15 minutes

---

## 🔐 Firebase Setup (Required First!)

### Before deploying, setup Firebase:

1. **Go to:** https://console.firebase.google.com
2. **Create project:** `shef-lms-production`
3. **Enable Firestore Database** (Production mode)
4. **Enable Authentication** (Email/Password)
5. **Get Web App credentials:**
   - Project Settings → Your apps → Add Web App
   - Copy: apiKey, authDomain, projectId, etc.
6. **Get Admin SDK key:**
   - Project Settings → Service Accounts
   - Generate new private key → Download JSON

---

## 📝 Manual Deployment Steps

### Step 1: Install Required Software

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Nginx
sudo apt install nginx -y

# Install PM2 globally
npm install -g pm2

# Install Certbot for SSL
sudo apt install certbot python3-certbot-nginx -y
```

### Step 2: Setup Backend

```bash
cd /root/Shef-LMS/backend

# Install dependencies
npm install

# Create production environment file
cat > .env << 'EOF'
NODE_ENV=production
PORT=5000

# Firebase Admin SDK (from downloaded JSON)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour_Key_Here\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com

# JWT Configuration
JWT_SECRET=your_random_32_character_secret_key_here
JWT_EXPIRE=7d

# CORS Configuration
ALLOWED_ORIGINS=https://learnwithshef.com,https://www.learnwithshef.com

# Application URLs
FRONTEND_URL=https://learnwithshef.com
BACKEND_URL=https://learnwithshef.com/api
EOF

# Start backend with PM2
pm2 start server.js --name shef-lms-backend
pm2 save
pm2 startup
```

### Step 3: Setup Frontend

```bash
cd /root/Shef-LMS/frontend

# Create production environment file
cat > .env.production << 'EOF'
# Firebase Configuration (from Firebase Console)
REACT_APP_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXX
REACT_APP_FIREBASE_AUTH_DOMAIN=shef-lms-production.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=shef-lms-production
REACT_APP_FIREBASE_STORAGE_BUCKET=shef-lms-production.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789012
REACT_APP_FIREBASE_APP_ID=1:123456789012:web:abcdef123456

# Backend API URL (local backend)
REACT_APP_API_URL=https://learnwithshef.com/api

REACT_APP_NAME=SHEF LMS
REACT_APP_VERSION=1.0.0
REACT_APP_ENVIRONMENT=production
EOF

# Install dependencies and build
npm install
npm run build

# Copy build to web directory
sudo mkdir -p /var/www/shef-lms
sudo cp -r build/* /var/www/shef-lms/
sudo chown -R www-data:www-data /var/www/shef-lms
```

### Step 4: Configure Nginx

```bash
# Create Nginx configuration
sudo cat > /etc/nginx/sites-available/shef-lms << 'EOF'
server {
    listen 80;
    server_name learnwithshef.com www.learnwithshef.com;

    # Frontend (React build)
    root /var/www/shef-lms;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Frontend - SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/shef-lms /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Step 5: Configure Firewall

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status
```

### Step 6: Setup SSL Certificate

```bash
# Get SSL certificate from Let's Encrypt
sudo certbot --nginx -d learnwithshef.com -d www.learnwithshef.com

# Follow prompts:
# - Enter email address
# - Agree to terms
# - Choose: Redirect HTTP to HTTPS (option 2)

# Auto-renewal is configured automatically
# Test renewal:
sudo certbot renew --dry-run
```

### Step 7: Configure DNS in Hostinger

1. **Log into Hostinger hPanel**
2. **Go to:** Domains → learnwithshef.com → DNS/Nameservers
3. **Add/Update A Records:**

```
Type: A
Name: @
Points to: YOUR_VPS_IP_ADDRESS
TTL: 14400

Type: A
Name: www
Points to: YOUR_VPS_IP_ADDRESS
TTL: 14400
```

4. **Wait 5-30 minutes** for DNS propagation

---

## ✅ Post-Deployment

### Check Services Status

```bash
# Check Nginx
sudo systemctl status nginx

# Check PM2/Backend
pm2 status
pm2 logs shef-lms-backend

# Check if site is accessible
curl http://localhost
curl http://localhost:5000/api/health
```

### Create Admin User

1. Visit https://learnwithshef.com
2. Register with: admin@learnwithshef.com
3. Go to Firebase Console → Firestore
4. Find user document → Edit → Set `role: "admin"`

---

## 🔄 Update/Redeploy

### Update Backend

```bash
cd /root/Shef-LMS/backend
git pull origin main
npm install
pm2 restart shef-lms-backend
```

### Update Frontend

```bash
cd /root/Shef-LMS/frontend
git pull origin main
npm install
npm run build
sudo cp -r build/* /var/www/shef-lms/
```

---

## 📊 Monitoring

### PM2 Monitoring

```bash
# View logs
pm2 logs shef-lms-backend

# Monitor resources
pm2 monit

# View process info
pm2 info shef-lms-backend
```

### Nginx Logs

```bash
# Access logs
sudo tail -f /var/log/nginx/access.log

# Error logs
sudo tail -f /var/log/nginx/error.log
```

---

## 🆘 Troubleshooting

### Backend not starting?
```bash
cd /root/Shef-LMS/backend
npm start  # Test manually
# Check for errors, fix, then:
pm2 restart shef-lms-backend
```

### Frontend showing 404?
```bash
# Check build exists
ls -la /var/www/shef-lms/
# Rebuild if needed
cd /root/Shef-LMS/frontend
npm run build
sudo cp -r build/* /var/www/shef-lms/
```

### SSL certificate issues?
```bash
# Force renew
sudo certbot renew --force-renewal
sudo systemctl restart nginx
```

### Check firewall
```bash
sudo ufw status
# Make sure 80 and 443 are allowed
```

---

## 💰 Cost

**Total Cost:** Just your Hostinger VPS plan!
- No additional hosting fees
- Free SSL certificates (Let's Encrypt)
- Free Firebase tier (50K reads/day)

---

## 🎯 Performance Tips

1. **Enable Nginx caching** for better performance
2. **Use PM2 cluster mode** for better CPU usage:
   ```bash
   pm2 start server.js --name shef-lms-backend -i max
   ```
3. **Setup CloudFlare** (optional) for CDN and DDoS protection
4. **Regular backups** of Firebase data

---

## 📞 Support

- **Hostinger Support:** https://www.hostinger.com/contact
- **Firebase Docs:** https://firebase.google.com/docs
- **Nginx Docs:** https://nginx.org/en/docs/
- **PM2 Docs:** https://pm2.keymetrics.io/docs/

---

**Your LMS will be live at:** https://learnwithshef.com 🚀
