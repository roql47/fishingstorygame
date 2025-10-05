@echo off
echo ========================================
echo 🚀 클라이언트 빌드 및 업데이트 알림 스크립트
echo ========================================

REM 환경 변수 설정
set SERVER_URL=http://localhost:4000
set ADMIN_TOKEN=YOUR_ADMIN_JWT_TOKEN_HERE

echo.
echo 📦 클라이언트 빌드 시작...
cd client
call npm run build

if %ERRORLEVEL% neq 0 (
    echo ❌ 빌드 실패!
    pause
    exit /b 1
)

echo ✅ 빌드 완료!

cd ..

echo.
echo 📢 클라이언트들에게 업데이트 알림 전송 중...

REM 현재 시간으로 버전 생성
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "YY=%dt:~2,2%" & set "YYYY=%dt:~0,4%" & set "MM=%dt:~4,2%" & set "DD=%dt:~6,2%"
set "HH=%dt:~8,2%" & set "Min=%dt:~10,2%" & set "Sec=%dt:~12,2%"
set "VERSION=%YYYY%%MM%%DD%_%HH%%Min%%Sec%"

echo 🔄 생성된 버전: %VERSION%

REM 업데이트 알림 API 호출
curl -X POST "%SERVER_URL%/api/admin/notify-update" ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer %ADMIN_TOKEN%" ^
  -d "{\"version\": \"%VERSION%\", \"message\": \"새로운 버전이 배포되었습니다. 잠시 후 자동으로 새로고침됩니다.\"}" ^
  --connect-timeout 10 ^
  --max-time 30

if %ERRORLEVEL% neq 0 (
    echo ⚠️ 업데이트 알림 전송 실패 (서버가 실행 중인지 확인하세요)
) else (
    echo ✅ 업데이트 알림 전송 완료!
)

echo.
echo 🎉 배포 완료!
echo 📱 버전: %VERSION%
echo 🌐 서버: %SERVER_URL%
echo.
pause

