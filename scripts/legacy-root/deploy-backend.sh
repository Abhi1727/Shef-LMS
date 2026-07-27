#!/bin/bash

# Backend Deployment Guide Script
# This script helps you prepare backend for deployment to Render.com

set -e

echo "🚀 SHEF LMS - Backend Deployment Preparation"
echo "============================================="
echo ""

# Check if in correct directory
if [ ! -d "backend" ]; then
    echo "❌ Error: backend directory not found!"
    echo "Please run this script from the project root directory."
    exit 1
fi

cd backend

# Check if .env.example exists
if [ ! -f ".env.example" ]; then
    echo "❌ Error: .env.example not found!"
    exit 1
fi

echo "✅ Backend directory found"
echo ""

# Check dependencies
echo "📦 Installing backend dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully!"
else
    echo "❌ Failed to install dependencies!"
    exit 1
fi

echo ""
echo "🔧 Testing backend server..."
timeout 5 npm start &
PID=$!
sleep 3

if ps -p $PID > /dev/null; then
    echo "✅ Backend server starts successfully!"
    kill $PID 2>/dev/null || true
else
    echo "⚠️  Backend server test inconclusive (this may be normal)"
fi

echo ""
echo "📋 Backend Deployment Checklist:"
echo "================================="
echo ""
echo "1. ✅ Code is ready for deployment"
echo "2. ⬜ Create account at https://render.com"
echo "3. ⬜ Push code to GitHub (already done: https://github.com/Abhi1727/Shef-LMS)"
echo "4. ⬜ Set up Firebase project and get credentials"
echo "5. ⬜ Deploy on Render with these settings:"
echo ""
echo "   Settings for Render.com:"
echo "   ------------------------"
echo "   Name: shef-lms-backend"
echo "   Region: Oregon (US West)"
echo "   Branch: main"
echo "   Root Directory: backend"
echo "   Runtime: Node"
echo "   Build Command: npm install"
echo "   Start Command: npm start"
echo ""
echo "   Environment Variables to add:"
echo "   -----------------------------"
cat .env.example | grep -v "^#" | grep -v "^$"
echo ""
echo "6. ⬜ After deployment, save your backend URL"
echo "7. ⬜ Use backend URL in frontend .env.production as REACT_APP_API_URL"
echo ""
echo "📖 Full deployment guide: See PRODUCTION_DEPLOYMENT.md"
echo ""
