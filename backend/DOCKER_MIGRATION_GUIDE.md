# 🚀 Shef-LMS Backend Docker Migration Guide

## Current Setup
- **Backend**: Node.js Express on port 5000 (PM2 managed)
- **Database**: MongoDB
- **Website**: learnwithus.sbs

## Docker Files Created
✅ `Dockerfile` - Node.js 20 Alpine image
✅ `docker-compose.yml` - Single backend service
✅ `.dockerignore` - Optimized build
✅ `migrate-to-docker.sh` - Automated migration
✅ `rollback-docker.sh` - Safety rollback
✅ `nginx-shef-lms-docker.conf` - Updated nginx config

## Pre-Migration Checklist
- [x] Docker files created
- [x] Configuration validated
- [x] Migration script ready
- [x] Rollback script ready
- [ ] **Ready to migrate**

## Migration Steps

### Step 1: Run Migration Script
```bash
cd /root/Shef-LMS/backend
./migrate-to-docker.sh
```

This will:
1. Stop PM2 process
2. Build Docker image
3. Start container on port 5000
4. Test the endpoint

### Step 2: Update Nginx (if needed)
```bash
sudo cp nginx-shef-lms-docker.conf /etc/nginx/sites-available/shef-lms
sudo nginx -t
sudo systemctl reload nginx
```

### Step 3: Verify
```bash
# Check container
docker compose ps

# Test backend
curl http://localhost:5000

# Test website
curl -I https://learnwithus.sbs
```

## Rollback (if needed)
```bash
./rollback-docker.sh
```

## Docker Commands
```bash
# View logs
docker compose logs -f

# Restart
docker compose restart

# Stop
docker compose down

# Shell access
docker compose exec backend sh

# Check stats
docker stats shef-lms-backend
```

## Expected Resource Usage
- **Container RAM**: ~100-150MB
- **Current PM2 RAM**: ~115MB
- **Impact**: Minimal (similar usage)

## Hostinger Docker Manager
After migration, container will appear in:
- **Container name**: shef-lms-backend
- **Port**: 5000
- **Status**: Running

You can manage it from the web UI!
