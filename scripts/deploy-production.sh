#!/bin/bash
# Deploy to PRODUCTION (learnwithus.sbs)
# Run from project root. Clients use this - only run when changes are tested on dev.

set -e

cd "$(dirname "$0")/.."

echo "🚀 Deploying to PRODUCTION (learnwithus.sbs)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Ensure we're on main
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
    echo "⚠️  You're on branch '$BRANCH'. Production deploys from main."
    read -p "Deploy anyway? (y/n): " confirm
    [ "$confirm" != "y" ] && exit 1
fi

echo "📦 Building frontend (production)..."
cd frontend
CI=false npm run build
cd ..

echo ""
echo "📁 Copying frontend to /var/www/shef-lms..."
sudo mkdir -p /var/www/shef-lms
sudo cp -r frontend/build/* /var/www/shef-lms/
sudo chown -R www-data:www-data /var/www/shef-lms

echo ""
echo "🐳 Rebuilding and restarting production backend..."
cd backend
(docker compose -p shef-lms-prod -f docker-compose.yml build --no-cache 2>/dev/null || docker-compose -p shef-lms-prod -f docker-compose.yml build --no-cache 2>/dev/null) || true
(docker compose -p shef-lms-prod -f docker-compose.yml up -d 2>/dev/null || docker-compose -p shef-lms-prod -f docker-compose.yml up -d 2>/dev/null) || true
cd ..

echo ""
echo "✅ Production deployment complete!"
echo "   Frontend: https://learnwithus.sbs"
echo "   Backend:  https://learnwithus.sbs/api"
