#!/bin/bash

# Shef-LMS Docker Migration Script
set -e

echo "=========================================="
echo "Shef-LMS Backend Docker Migration"
echo "=========================================="

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

cd /root/Shef-LMS/backend

echo -e "${YELLOW}Step 1: Checking current setup...${NC}"
if pm2 list | grep -q "shef-lms-backend"; then
    echo "✓ Found PM2 process"
else
    echo "⚠ PM2 process not found"
fi

echo -e "${YELLOW}Step 2: Backing up current .env...${NC}"
if [ -f .env ]; then
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    echo -e "${GREEN}✓ Backup created${NC}"
fi

echo -e "${YELLOW}Step 3: Testing Docker build...${NC}"
docker compose build
echo -e "${GREEN}✓ Build successful${NC}"

echo -e "${YELLOW}Step 4: Stopping PM2 process...${NC}"
pm2 stop shef-lms-backend || echo "Process not running"
pm2 delete shef-lms-backend || echo "Process not in PM2"
echo -e "${GREEN}✓ PM2 process stopped${NC}"

echo -e "${YELLOW}Step 5: Starting Docker containers...${NC}"
docker compose up -d
echo -e "${GREEN}✓ Containers started${NC}"

sleep 5

echo -e "${YELLOW}Step 6: Checking container status...${NC}"
docker compose ps

echo -e "${YELLOW}Step 7: Testing backend endpoint...${NC}"
sleep 3
curl -s http://localhost:5000 | head -100 && echo -e "\n${GREEN}✓ Backend responding${NC}"

echo ""
echo -e "${GREEN}=========================================="
echo "Migration Complete!"
echo "==========================================${NC}"
echo ""
echo "Container Status:"
docker compose ps
echo ""
echo "View logs: cd /root/Shef-LMS/backend && docker compose logs -f"
echo "Restart: docker compose restart"
echo "Stop: docker compose down"
echo ""
echo "If issues occur, rollback with:"
echo "./rollback-docker.sh"
