#!/bin/bash

echo "========================================"
echo "SHEF LMS - Installation Script"
echo "========================================"
echo ""

echo "[1/4] Installing Backend Dependencies..."
cd backend
npm install
if [ $? -ne 0 ]; then
    echo "ERROR: Backend installation failed"
    exit 1
fi
echo "Backend dependencies installed successfully!"
echo ""

echo "[2/4] Installing Frontend Dependencies..."
cd ../frontend
npm install
if [ $? -ne 0 ]; then
    echo "ERROR: Frontend installation failed"
    exit 1
fi
echo "Frontend dependencies installed successfully!"
echo ""

echo "[3/4] Creating .env file for backend..."
cd ../backend
if [ ! -f .env ]; then
    cat > .env << EOF
PORT=5000
JWT_SECRET=shef_lms_secret_key_2025

# Add your Firebase credentials here:
# GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccountKey.json
# OR
# FIREBASE_PROJECT_ID=your-project-id
# FIREBASE_CLIENT_EMAIL=your-client-email
# FIREBASE_PRIVATE_KEY=your-private-key
EOF
    echo ".env file created! Please update it with your Firebase credentials."
else
    echo ".env file already exists!"
fi
echo ""

echo "[4/4] Installation Complete!"
echo ""
echo "========================================"
echo "Next Steps:"
echo "========================================"
echo "1. Set up Firebase project (see FIREBASE_SETUP_GUIDE.md)"
echo "2. Update frontend/src/firebase/config.js with your Firebase config"
echo "3. Update backend/.env with your Firebase credentials"
echo "4. Run 'npm start' in backend folder"
echo "5. Run 'npm start' in frontend folder (in a new terminal)"
echo "6. Open http://localhost:3000"
echo ""
echo "Demo Credentials:"
echo "  Admin: admin@sheflms.com / SuperAdmin@123"
echo "  Student: lqdeleon@gmail.com / Admin@123"
echo ""
echo "For detailed setup instructions, see FIREBASE_SETUP_GUIDE.md"
echo "========================================"
echo ""
