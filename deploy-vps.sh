#!/bin/bash

# Automated VPS Deployment Script for SHEF LMS on Hostinger
# Domain: learnwithshef.com

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║     🚀 SHEF LMS - Hostinger VPS Deployment Script 🚀       ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Please run as root: sudo ./deploy-vps.sh${NC}"
    exit 1
fi

echo "📋 Pre-deployment Checklist"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "Have you set up Firebase project? (y/n): " firebase_setup
if [ "$firebase_setup" != "y" ]; then
    echo -e "${YELLOW}⚠️  Please setup Firebase first:${NC}"
    echo "1. Go to https://console.firebase.google.com"
    echo "2. Create project: shef-lms-production"
    echo "3. Enable Firestore and Authentication"
    echo "4. Get credentials"
    echo ""
    read -p "Press Enter when done..."
fi

read -p "Enter your VPS IP address: " VPS_IP
if [ -z "$VPS_IP" ]; then
    echo -e "${RED}❌ IP address is required${NC}"
    exit 1
fi

echo ""
echo "🔧 Step 1: Installing System Dependencies"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
apt update
apt install -y nginx certbot python3-certbot-nginx

echo ""
echo "✅ Nginx installed"

# Install PM2 if not already installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    npm install -g pm2
fi
echo "✅ PM2 installed"

echo ""
echo "🔥 Step 2: Firebase Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd /root/Shef-LMS/backend

if [ ! -f .env ]; then
    echo "Creating backend .env file..."
    cat > .env << 'ENVEOF'
NODE_ENV=production
PORT=5000

# Firebase Admin SDK (REPLACE WITH YOUR VALUES!)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour_Key_Here\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com

# JWT Configuration
JWT_SECRET=shef_lms_secure_jwt_secret_key_$(openssl rand -hex 16)
JWT_EXPIRE=7d

# CORS Configuration
ALLOWED_ORIGINS=https://learnwithshef.com,https://www.learnwithshef.com

# Application URLs
FRONTEND_URL=https://learnwithshef.com
BACKEND_URL=https://learnwithshef.com/api
ENVEOF

    echo -e "${YELLOW}⚠️  IMPORTANT: Edit backend/.env with your Firebase credentials!${NC}"
    echo "File location: /root/Shef-LMS/backend/.env"
    read -p "Press Enter to edit now (or Ctrl+C to exit and edit later)..."
    nano .env
fi

echo ""
echo "📦 Step 3: Installing Backend Dependencies"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
npm install
echo "✅ Backend dependencies installed"

echo ""
echo "⚛️  Step 4: Setting up Frontend"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd /root/Shef-LMS/frontend

if [ ! -f .env.production ]; then
    echo "Creating frontend .env.production..."
    cat > .env.production << 'FRONTEOF'
# Firebase Configuration (REPLACE WITH YOUR VALUES!)
REACT_APP_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXX
REACT_APP_FIREBASE_AUTH_DOMAIN=shef-lms-production.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=shef-lms-production
REACT_APP_FIREBASE_STORAGE_BUCKET=shef-lms-production.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789012
REACT_APP_FIREBASE_APP_ID=1:123456789012:web:abcdef123456

# Backend API
REACT_APP_API_URL=https://learnwithshef.com/api

REACT_APP_NAME=SHEF LMS
REACT_APP_VERSION=1.0.0
REACT_APP_ENVIRONMENT=production
FRONTEOF

    echo -e "${YELLOW}⚠️  IMPORTANT: Edit frontend/.env.production with your Firebase credentials!${NC}"
    echo "File location: /root/Shef-LMS/frontend/.env.production"
    read -p "Press Enter to edit now (or Ctrl+C to exit and edit later)..."
    nano .env.production
fi

echo ""
echo "📦 Installing frontend dependencies..."
npm install

echo ""
echo "🔨 Building frontend..."
npm run build

echo ""
echo "📁 Copying build to web directory..."
mkdir -p /var/www/shef-lms
cp -r build/* /var/www/shef-lms/
chown -R www-data:www-data /var/www/shef-lms

echo "✅ Frontend built and deployed"

echo ""
echo "🌐 Step 5: Configuring Nginx"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cat > /etc/nginx/sites-available/shef-lms << 'NGINXEOF'
server {
    listen 80;
    server_name learnwithshef.com www.learnwithshef.com;

    # Frontend (React build)
    root /var/www/shef-lms;
    index index.html;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;

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
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
    }
}
NGINXEOF

# Enable site
ln -sf /etc/nginx/sites-available/shef-lms /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test configuration
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx configuration valid"
    systemctl restart nginx
    echo "✅ Nginx restarted"
else
    echo -e "${RED}❌ Nginx configuration error${NC}"
    exit 1
fi

echo ""
echo "🚀 Step 6: Starting Backend with PM2"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd /root/Shef-LMS/backend

# Stop existing process if running
pm2 stop shef-lms-backend 2>/dev/null || true
pm2 delete shef-lms-backend 2>/dev/null || true

# Start with PM2
pm2 start server.js --name shef-lms-backend --time
pm2 save
pm2 startup | tail -n 1 | bash

echo "✅ Backend started with PM2"

echo ""
echo "🔒 Step 7: Configuring Firewall"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ufw --force enable
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

echo "✅ Firewall configured"

echo ""
echo "🔐 Step 8: SSL Certificate Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  IMPORTANT: Configure DNS first!"
echo ""
echo "In Hostinger DNS settings, add these A records:"
echo "  Type: A, Name: @, Points to: $VPS_IP"
echo "  Type: A, Name: www, Points to: $VPS_IP"
echo ""
read -p "Have you configured DNS? (y/n): " dns_configured

if [ "$dns_configured" = "y" ]; then
    read -p "Enter email for SSL certificate: " ssl_email
    if [ -n "$ssl_email" ]; then
        echo "Getting SSL certificate..."
        certbot --nginx -d learnwithshef.com -d www.learnwithshef.com --non-interactive --agree-tos -m "$ssl_email" --redirect
        echo "✅ SSL certificate installed"
    else
        echo -e "${YELLOW}⚠️  Skipping SSL. Run manually later:${NC}"
        echo "sudo certbot --nginx -d learnwithshef.com -d www.learnwithshef.com"
    fi
else
    echo -e "${YELLOW}⚠️  SSL skipped. Configure DNS first, then run:${NC}"
    echo "sudo certbot --nginx -d learnwithshef.com -d www.learnwithshef.com"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║          🎉  DEPLOYMENT COMPLETE!  🎉                       ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Deployment Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Nginx installed and configured"
echo "✅ Frontend built and deployed to /var/www/shef-lms"
echo "✅ Backend running with PM2"
echo "✅ Firewall configured"
if [ "$dns_configured" = "y" ] && [ -n "$ssl_email" ]; then
    echo "✅ SSL certificate installed"
fi
echo ""
echo "🌐 Your site will be accessible at:"
echo "   http://learnwithshef.com (after DNS propagation)"
if [ "$dns_configured" = "y" ] && [ -n "$ssl_email" ]; then
    echo "   https://learnwithshef.com (SSL enabled)"
fi
echo ""
echo "📋 Next Steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Verify Firebase credentials in:"
echo "   - /root/Shef-LMS/backend/.env"
echo "   - /root/Shef-LMS/frontend/.env.production"
echo ""
echo "2. If you changed credentials, rebuild:"
echo "   cd /root/Shef-LMS/frontend && npm run build"
echo "   sudo cp -r build/* /var/www/shef-lms/"
echo "   pm2 restart shef-lms-backend"
echo ""
echo "3. Configure DNS in Hostinger (if not done):"
echo "   Add A records pointing to: $VPS_IP"
echo ""
echo "4. Get SSL certificate (if skipped):"
echo "   sudo certbot --nginx -d learnwithshef.com -d www.learnwithshef.com"
echo ""
echo "5. Create admin user:"
echo "   - Visit your site and register"
echo "   - Go to Firebase Console → Firestore"
echo "   - Edit user document → set role: 'admin'"
echo ""
echo "📊 Useful Commands:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "pm2 status              # Check backend status"
echo "pm2 logs shef-lms-backend   # View backend logs"
echo "sudo systemctl status nginx  # Check Nginx status"
echo "sudo tail -f /var/log/nginx/error.log  # Nginx errors"
echo ""
echo "🎓 Documentation: /root/Shef-LMS/VPS_DEPLOYMENT.md"
echo ""
