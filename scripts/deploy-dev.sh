#!/bin/bash
# Deploy to DEV/STAGING (dev.learnwithus.sbs)
# Safe to experiment - clients never see this. Uses separate DB (shef-lms-dev).

set -e

# Load nvm (SSH non-interactive sessions don't load .bashrc)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

cd "$(dirname "$0")/.."

echo "🔧 Deploying to DEV/STAGING (dev.learnwithus.sbs)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check .env.dev exists
if [ ! -f backend/.env.dev ]; then
    echo "❌ backend/.env.dev not found!"
    echo "   Copy backend/.env.dev.example to .env.dev and configure."
    exit 1
fi

if [ ! -f frontend/.env.development ]; then
    echo "⚠️  frontend/.env.development not found. Using .env.development.example values."
    cp -n frontend/.env.development.example frontend/.env.development 2>/dev/null || true
fi

echo "📦 Building frontend for dev..."
cd frontend
# So the built app calls dev API, not production (npm run build uses production env by default)
REACT_APP_API_URL=https://dev.learnwithus.sbs CI=false npm run build
cd ..

echo ""
echo "📁 Copying frontend to /var/www/shef-lms-dev..."
sudo mkdir -p /var/www/shef-lms-dev
sudo cp -r frontend/build/* /var/www/shef-lms-dev/
sudo chown -R www-data:www-data /var/www/shef-lms-dev

echo ""
echo "🐳 Rebuilding and restarting dev backend (port 5001)..."
cd backend
docker compose -p shef-lms-dev -f docker-compose.dev.yml build --no-cache 2>/dev/null || docker-compose -p shef-lms-dev -f docker-compose.dev.yml build --no-cache 2>/dev/null || true
docker compose -p shef-lms-dev -f docker-compose.dev.yml up -d 2>/dev/null || docker-compose -p shef-lms-dev -f docker-compose.dev.yml up -d 2>/dev/null || true
cd ..

echo ""
echo "🔐 Ensuring admin exists in dev DB..."
cd backend
ENV_PATH=.env.dev node scripts/createAdmin.js 2>/dev/null || true
cd ..

echo ""
echo "✅ Dev deployment complete!"
echo "   Frontend: https://dev.learnwithus.sbs"
echo "   Backend:  https://dev.learnwithus.sbs/api"
echo "   Admin: admin@sheflms.com / SuperAdmin@123"
echo ""
echo "   Uses MongoDB database: shef-lms-dev (production data untouched)"
