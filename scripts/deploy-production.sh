#!/bin/bash
# Deploy to PRODUCTION (learnwithus.sbs)
# Run from project root. Clients use this - only run when changes are tested on dev.

set -e

# Load nvm (SSH non-interactive sessions don't load .bashrc)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

cd "$(dirname "$0")/.."

echo "🚀 Deploying to PRODUCTION (learnwithus.sbs)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Ensure we're on main (skip prompt when non-interactive e.g. CI/CD)
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
    if [ -t 0 ]; then
        echo "⚠️  You're on branch '$BRANCH'. Production deploys from main."
        read -p "Deploy anyway? (y/n): " confirm
        [ "$confirm" != "y" ] && exit 1
    else
        echo "::error::Not on main. Refusing production deploy."
        exit 1
    fi
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
echo "🌐 Ensuring Nginx upload limit is high enough for multipart requests..."
if ! sudo grep -q "client_max_body_size 12M;" /etc/nginx/sites-available/shef-lms; then
    sudo perl -0pi -e 's/(server_name learnwithus\.sbs www\.learnwithus\.sbs 31\.220\.55\.193;\n)/$1\n    client_max_body_size 12M;\n/' /etc/nginx/sites-available/shef-lms
fi
sudo nginx -t
sudo systemctl reload nginx

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
