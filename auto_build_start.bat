@echo off
chcp 65001 >nul
echo ========================================
echo    자동 빌드 및 서버 시작
echo ========================================

echo.
echo [1단계] 기존 서버 프로세스 종료 중...
taskkill /f /im node.exe 2>nul
echo 기존 프로세스 종료 완료!

echo.
echo [2단계] 클라이언트 빌드 중...
cd client
call npm run build
if errorlevel 1 (
    echo 클라이언트 빌드 실패!
    pause
    exit /b 1
)
echo 클라이언트 빌드 완료!

echo.
echo [3단계] 정적 파일 복사 중...
cd ..
cd server
call node scripts/copy-static.cjs
if errorlevel 1 (
    echo 정적 파일 복사 실패!
    pause
    exit /b 1
)
echo 정적 파일 복사 완료!

echo.
echo [4단계] 서버 시작 중...
echo 서버가 시작되면 http://localhost:4000 에서 게임을 플레이할 수 있습니다.
echo.
echo ========================================
echo    서버를 종료하려면 Ctrl+C 를 누르세요
echo ========================================
echo.

call npm start

echo.
echo 서버가 종료되었습니다.
pause
