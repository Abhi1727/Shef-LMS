# ⚡ Hostinger VPS Quick Start - Deploy in 20 Minutes!

## 🎯 Your Setup
- **VPS IP:** 31.220.55.193
- **Domain:** learnwithshef.com (Hostinger)
- **Server:** Ubuntu 24.04 LTS with 15GB RAM

---

## 🚀 One-Command Deployment

```bash
sudo /root/Shef-LMS/deploy-vps.sh
```

**This automated script will:**
1. ✅ Install Nginx web server
2. ✅ Install PM2 process manager
3. ✅ Setup backend API
4. ✅ Build and deploy frontend
5. ✅ Configure firewall
6. ✅ Setup SSL certificate
7. ✅ Start everything automatically

**Total time: ~15-20 minutes**

---

## 📋 Before Running the Script

### Step 1: Setup Firebase (10 minutes)

**This is REQUIRED - your app won't work without it!**

1. **Go to:** https://console.firebase.google.com
2. **Create new project:** `shef-lms-production`
3. **Enable Firestore Database:**
   - Click "Firestore Database" → "Create database"
   - Choose "Production mode"
   - Select location (us-central1 recommended)
   - Click "Enable"

4. **Enable Authentication:**
   - Click "Authentication" → "Get started"
   - Click "Email/Password" → Enable → Save

5. **Get Web App Credentials:**
   - Go to Project Settings (gear icon)
   - Scroll to "Your apps" section
   - Click "</>" (Web icon)
   - Register app name: "SHEF LMS"
   - Copy these 6 values (you'll need them):
     - `apiKey`
     - `authDomain`
     - `projectId`
     - `storageBucket`
     - `messagingSenderId`
     - `appId`

6. **Get Admin SDK Key (for backend):**
   - Go to Project Settings → Service Accounts
   - Click "Generate new private key"
   - Download the JSON file
   - Keep it safe!
   - Extract these values from the JSON:
     - `project_id`
     - `private_key`
     - `client_email`

### Step 2: Configure DNS in Hostinger (5 minutes)

1. **Login to Hostinger hPanel:** https://hpanel.hostinger.com
2. **Go to:** Domains → learnwithshef.com → DNS / Name Servers
3. **Add these DNS records:**

```
Type: A
Name: @
Points to: 31.220.55.193
TTL: 14400

Type: A
Name: www
Points to: 31.220.55.193
TTL: 14400
```

4. **Save** and wait 5-10 minutes for propagation

---

## 🎬 Run Deployment

Now you're ready! Run:

```bash
sudo /root/Shef-LMS/deploy-vps.sh
```

**The script will:**
- Ask if you've setup Firebase (say 'y')
- Ask for your VPS IP (it will show: 31.220.55.193)
- Prompt you to edit backend/.env with Firebase credentials
- Prompt you to edit frontend/.env.production with Firebase credentials
- Install everything
- Ask if DNS is configured
- Ask for email to setup SSL certificate

**Just follow the prompts!**

---

## 📝 What to Paste When Prompted

### Backend .env File

When the script opens the editor, update these lines:

```bash
FIREBASE_PROJECT_ID=shef-lms-production
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour_actual_private_key_from_downloaded_json\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@shef-lms-production.iam.gserviceaccount.com
```

**Note:** For `FIREBASE_PRIVATE_KEY`, copy the entire private key from your downloaded JSON, including the BEGIN and END lines, and replace `\n` with actual newlines.

### Frontend .env.production File

When prompted, update these lines:

```bash
REACT_APP_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXX
REACT_APP_FIREBASE_AUTH_DOMAIN=shef-lms-production.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=shef-lms-production
REACT_APP_FIREBASE_STORAGE_BUCKET=shef-lms-production.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789012
REACT_APP_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

Use the values from Step 1 (Firebase Web App credentials).

---

## ✅ After Deployment

### 1. Test Your Site

Visit: http://learnwithshef.com (or https:// if SSL was installed)

You should see the SHEF LMS login page!

### 2. Create Admin Account

1. Click "Register" on the site
2. Register with: `admin@learnwithshef.com`
3. Go to Firebase Console → Firestore Database
4. Click on "users" collection
5. Find your user document
6. Click edit → Change `role` field to `admin`
7. Save

### 3. Add Sample Content

As admin, you can now:
- Add courses
- Create modules
- Add lessons
- Manage students

---

## 🔍 Check Everything is Working

### Check Backend
```bash
pm2 status
# Should show: shef-lms-backend | online

pm2 logs shef-lms-backend
# Should show: Server running on port 5000
```

### Check Frontend
```bash
curl http://localhost
# Should return HTML content

ls /var/www/shef-lms/
# Should show: index.html, static/, etc.
```

### Check Nginx
```bash
sudo systemctl status nginx
# Should show: active (running)
```

### Check SSL
```bash
sudo certbot certificates
# Should list: learnwithshef.com
```

---

## 🔄 Update Your Site Later

### Update Backend Code
```bash
cd /root/Shef-LMS
git pull origin main
cd backend
npm install
pm2 restart shef-lms-backend
```

### Update Frontend Code
```bash
cd /root/Shef-LMS
git pull origin main
cd frontend
npm install
npm run build
sudo cp -r build/* /var/www/shef-lms/
```

---

## 🆘 Troubleshooting

### Site not loading?
```bash
# Check if DNS has propagated
nslookup learnwithshef.com

# Check Nginx
sudo systemctl status nginx
sudo nginx -t

# Check logs
sudo tail -f /var/log/nginx/error.log
```

### Backend errors?
```bash
# View logs
pm2 logs shef-lms-backend

# Restart
pm2 restart shef-lms-backend

# Check environment
cat /root/Shef-LMS/backend/.env
```

### Firebase connection issues?
- Double-check all Firebase credentials
- Make sure Firestore is enabled
- Verify Authentication is enabled
- Check Firebase console for errors

### SSL certificate failed?
```bash
# Make sure DNS is pointing to your VPS
# Wait 5-10 minutes after DNS update
# Then run:
sudo certbot --nginx -d learnwithshef.com -d www.learnwithshef.com
```

---

## 📊 Useful Commands

```bash
# PM2 (Backend management)
pm2 status                    # Check status
pm2 logs shef-lms-backend    # View logs
pm2 restart shef-lms-backend # Restart backend
pm2 monit                     # Monitor resources

# Nginx (Web server)
sudo systemctl status nginx   # Check status
sudo nginx -t                 # Test config
sudo systemctl restart nginx  # Restart

# Firewall
sudo ufw status              # Check firewall rules

# SSL
sudo certbot certificates    # List certificates
sudo certbot renew          # Renew certificates
```

---

## 💰 Cost

**Total:** Just your Hostinger VPS plan!
- ✅ Everything else is FREE
- ✅ Free SSL certificate (Let's Encrypt)
- ✅ Free Firebase tier (50K reads/day)
- ✅ No additional hosting fees

---

## 🎉 You're Ready to Deploy!

**Run this command and follow the prompts:**

```bash
sudo /root/Shef-LMS/deploy-vps.sh
```

**Your site will be live at:** https://learnwithshef.com 🚀

---

## 📞 Need Help?

- **Full VPS Guide:** `/root/Shef-LMS/VPS_DEPLOYMENT.md`
- **Firebase Docs:** https://firebase.google.com/docs
- **Hostinger Support:** https://www.hostinger.com/contact

---

**Good luck with your launch!** 🎓✨
