@echo off
chcp 65001 >nul 2>&1
echo ========================================
echo      Fishing Game Build and Start
echo ========================================

echo.
echo [Step 1] Stopping existing server processes...
taskkill /f /im node.exe 2>nul
echo Existing processes stopped!

echo.
echo [Step 2] Building client...
cd /d "%~dp0client"
call npm run build
if errorlevel 1 (
    echo Client build failed!
    pause
    exit /b 1
)
echo Client build completed!

echo.
echo [Step 3] Building server...
cd /d "%~dp0server"
call npm run build
if errorlevel 1 (
    echo Server build failed!
    pause
    exit /b 1
)
echo Server build completed!

echo.
echo [Step 4] Starting server...
echo Server will be available at http://localhost:4000
echo.
echo ========================================
echo    Press Ctrl+C to stop the server
echo ========================================
echo.

npm start

echo.
echo Server stopped.
pause   
