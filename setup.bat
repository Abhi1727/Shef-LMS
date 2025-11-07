@echo off
echo ========================================
echo   SHEF LMS - Quick Start Setup
echo ========================================
echo.

echo Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo X Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo √ Node.js version: %NODE_VERSION%

echo.
echo ========================================
echo   Installing Backend Dependencies
echo ========================================

cd backend
call npm install
if errorlevel 1 (
    echo X Failed to install backend dependencies
    pause
    exit /b 1
)
echo √ Backend dependencies installed successfully

cd ..

echo.
echo ========================================
echo   Installing Frontend Dependencies
echo ========================================

cd frontend
call npm install
if errorlevel 1 (
    echo X Failed to install frontend dependencies
    pause
    exit /b 1
)
echo √ Frontend dependencies installed successfully

cd ..

echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo To start the application:
echo.
echo 1. Start Backend (Terminal 1):
echo    cd backend
echo    npm start
echo.
echo 2. Start Frontend (Terminal 2):
echo    cd frontend
echo    npm start
echo.
echo Demo Credentials:
echo    Email: demo@sheflms.com
echo    Password: demo123
echo.
echo Application will be available at:
echo    Frontend: http://localhost:3000
echo    Backend: http://localhost:5000
echo.
pause
