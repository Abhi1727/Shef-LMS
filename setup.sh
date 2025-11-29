#!/bin/bash

echo "========================================"
echo "  SHEF LMS - Quick Start Setup"
echo "========================================"
echo ""

# Check if Node.js is installed
echo "Checking Node.js installation..."
if ! command -v node &> /dev/null
then
    echo "✗ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✓ Node.js version: $(node --version)"

echo ""
echo "========================================"
echo "  Installing Backend Dependencies"
echo "========================================"

cd backend
npm install

if [ $? -eq 0 ]; then
    echo "✓ Backend dependencies installed successfully"
else
    echo "✗ Failed to install backend dependencies"
    exit 1
fi

cd ..

echo ""
echo "========================================"
echo "  Installing Frontend Dependencies"
echo "========================================"

cd frontend
npm install

if [ $? -eq 0 ]; then
    echo "✓ Frontend dependencies installed successfully"
else
    echo "✗ Failed to install frontend dependencies"
    exit 1
fi

cd ..

echo ""
echo "========================================"
echo "  Setup Complete!"
echo "========================================"
echo ""
echo "To start the application:"
echo ""
echo "1. Start Backend (Terminal 1):"
echo "   cd backend"
echo "   npm start"
echo ""
echo "2. Start Frontend (Terminal 2):"
echo "   cd frontend"
echo "   npm start"
echo ""
echo "Demo Credentials:"
echo "   Email: demo@sheflms.com"
echo "   Password: demo123"
echo ""
echo "Application will be available at:"
echo "   Frontend: http://localhost:3000"
echo "   Backend: http://localhost:5000"
echo ""
