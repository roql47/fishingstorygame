@echo off
chcp 65001 >nul
echo ========================================
echo      낚시게임 개발 모드 시작
echo ========================================

echo.
echo [1단계] 기존 서버 프로세스 종료 중...
taskkill /f /im node.exe 2>nul
echo 기존 프로세스 종료 완료!

echo.
echo [2단계] 서버 개발 모드 시작 중...
cd /d "%~dp0server"
echo 개발 모드에서는 파일 변경 시 자동으로 서버가 재시작됩니다.
echo 서버가 시작되면 http://localhost:4000 에서 게임을 플레이할 수 있습니다.
echo.
echo ========================================
echo    서버를 종료하려면 Ctrl+C 를 누르세요
echo ========================================
echo.

node src/index.js

echo.
echo 서버가 종료되었습니다.
pause
