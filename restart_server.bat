@echo off
chcp 65001 >nul
echo ========================================
echo         낚시게임 서버 재시작
echo ========================================

echo.
echo [1단계] 기존 서버 프로세스 종료 중...
taskkill /f /im node.exe 2>nul
echo 기존 프로세스 종료 완료!

echo.
echo [2단계] 서버 디렉토리로 이동...
cd /d "%~dp0server"

echo.
echo [3단계] 서버 시작 중...
echo 서버가 시작되면 http://localhost:4000 에서 게임을 플레이할 수 있습니다.
echo.
echo ========================================
echo    서버를 종료하려면 Ctrl+C 를 누르세요
echo ========================================
echo.

npm start

echo.
echo 서버가 종료되었습니다.
pause
