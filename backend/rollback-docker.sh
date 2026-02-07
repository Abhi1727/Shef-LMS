#!/bin/bash

# Shef-LMS Rollback Script
set -e

echo "=========================================="
echo "Shef-LMS Docker Rollback"
echo "=========================================="

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd /root/Shef-LMS/backend

echo -e "${YELLOW}Step 1: Stopping Docker containers...${NC}"
docker compose down
echo -e "${GREEN}✓ Containers stopped${NC}"

echo -e "${YELLOW}Step 2: Restoring .env backup...${NC}"
LATEST_BACKUP=$(ls -t .env.backup.* 2>/dev/null | head -1)
if [ -n "$LATEST_BACKUP" ]; then
    cp "$LATEST_BACKUP" .env
    echo -e "${GREEN}✓ Restored: $LATEST_BACKUP${NC}"
fi

echo -e "${YELLOW}Step 3: Starting with PM2...${NC}"
pm2 start server.js --name shef-lms-backend
echo -e "${GREEN}✓ PM2 process started${NC}"

pm2 save
pm2 list

echo ""
echo -e "${GREEN}Rollback complete!${NC}"
