#!/bin/bash

# Frontend Deployment Script for learnwithus.sbs
# This script builds the React frontend and deploys it
# to the server directory served by Nginx: /var/www/shef-lms

set -e

echo "🚀 SHEF LMS - Frontend Deployment Script (No Vercel)"
echo "===================================================="
echo ""

# Check if in correct directory
if [ ! -d "frontend" ]; then
    echo "❌ Error: frontend directory not found!"
    echo "Please run this script from the project root directory."
    exit 1
fi

# Navigate to frontend
cd frontend

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo "⚠️  Warning: .env.production not found!"
    echo "Creating template from .env.example..."
    cp .env.example .env.production
    echo ""
    echo "❗ IMPORTANT: Please edit frontend/.env.production with your Firebase credentials"
    echo "Then run this script again."
    exit 1
fi

echo "✅ Environment file found"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

echo "🔨 Building frontend (production)..."
npm run build

echo ""
echo "📁 Copying build to Nginx web directory (/var/www/shef-lms)..."
mkdir -p /var/www/shef-lms
cp -r build/* /var/www/shef-lms/

if command -v chown &> /dev/null; then
    chown -R www-data:www-data /var/www/shef-lms || true
fi

echo ""
echo "✅ Frontend build deployed to /var/www/shef-lms"
echo "If Nginx is already configured to serve this path,"
echo "your latest frontend (including timing updates) should now be live."
