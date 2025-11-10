@echo off
echo ========================================
echo SHEF LMS - Installation Script
echo ========================================
echo.

echo [1/4] Installing Backend Dependencies...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Backend installation failed
    pause
    exit /b %errorlevel%
)
echo Backend dependencies installed successfully!
echo.

echo [2/4] Installing Frontend Dependencies...
cd ..\frontend
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Frontend installation failed
    pause
    exit /b %errorlevel%
)
echo Frontend dependencies installed successfully!
echo.

echo [3/4] Creating .env file for backend...
cd ..\backend
if not exist .env (
    echo PORT=5000 > .env
    echo JWT_SECRET=shef_lms_secret_key_2025 >> .env
    echo. >> .env
    echo # Add your Firebase credentials here: >> .env
    echo # GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccountKey.json >> .env
    echo # OR >> .env
    echo # FIREBASE_PROJECT_ID=your-project-id >> .env
    echo # FIREBASE_CLIENT_EMAIL=your-client-email >> .env
    echo # FIREBASE_PRIVATE_KEY=your-private-key >> .env
    echo .env file created! Please update it with your Firebase credentials.
) else (
    echo .env file already exists!
)
echo.

echo [4/4] Installation Complete!
echo.
echo ========================================
echo Next Steps:
echo ========================================
echo 1. Set up Firebase project (see FIREBASE_SETUP_GUIDE.md)
echo 2. Update frontend/src/firebase/config.js with your Firebase config
echo 3. Update backend/.env with your Firebase credentials
echo 4. Run 'npm start' in backend folder
echo 5. Run 'npm start' in frontend folder (in a new terminal)
echo 6. Open http://localhost:3000
echo.
echo Demo Credentials:
echo   Admin: admin@sheflms.com / SuperAdmin@123
echo   Student: lqdeleon@gmail.com / Admin@123
echo.
echo For detailed setup instructions, see FIREBASE_SETUP_GUIDE.md
echo ========================================
echo.
pause
