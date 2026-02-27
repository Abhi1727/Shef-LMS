#!/bin/bash
# Deploy to DEV/STAGING (dev.learnwithus.sbs) - Fixed Version
# Creates environment files if they don't exist

set -e

# Load nvm (SSH non-interactive sessions don't load .bashrc)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

cd "$(dirname "$0")/.."

echo "🔧 Deploying to DEV/STAGING (dev.learnwithus.sbs)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Create .env.dev if it doesn't exist
if [ ! -f backend/.env.dev ]; then
    echo "📝 Creating backend/.env.dev..."
    cat > backend/.env.dev << 'EOF'
# Backend Development Environment Variables
PORT=5001
NODE_ENV=development
JWT_SECRET=dev_jwt_secret_key_change_in_production
JWT_EXPIRE=7d
AUTH_RATE_LIMIT_MAX=50
ALLOWED_ORIGINS=https://dev.learnwithus.sbs,http://localhost:3000,http://127.0.0.1:3000
MONGODB_USERNAME=Admin
MONGODB_PASSWORD=qsKf6Pt9Mob991iK
MONGODB_CLUSTER=cluster0.i8n2lco.mongodb.net
MONGODB_DATABASE=shef-lms-dev
FRONTEND_URL=https://dev.learnwithus.sbs
BACKEND_URL=https://dev.learnwithus.sbs/api
DEBUG=true
LOG_LEVEL=debug
EOF
    echo "✅ backend/.env.dev created"
else
    echo "✅ backend/.env.dev exists"
fi

# Create .env.development if it doesn't exist
if [ ! -f frontend/.env.development ]; then
    echo "📝 Creating frontend/.env.development..."
    cat > frontend/.env.development << 'EOF'
# Frontend Development Environment Variables
REACT_APP_API_URL=https://dev.learnwithus.sbs/api
REACT_APP_ENV=development
REACT_APP_VERSION=dev
REACT_APP_ENABLE_DEBUG=true
REACT_APP_ENABLE_CONSOLE_LOGS=true
GENERATE_SOURCEMAP=true
EOF
    echo "✅ frontend/.env.development created"
else
    echo "✅ frontend/.env.development exists"
fi

echo "📦 Building frontend for dev..."
cd frontend
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
echo "✅ Dev deployment complete!"
echo "   Frontend: https://dev.learnwithus.sbs"
echo "   Backend:  https://dev.learnwithus.sbs/api"
echo ""
echo "   Uses MongoDB database: shef-lms-dev (production data untouched)"
