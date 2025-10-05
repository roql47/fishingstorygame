# 🔄 클라이언트 자동 업데이트 시스템

웹소켓을 통한 실시간 클라이언트 자동 새로고침 시스템입니다.

## 🚀 기능

- ✅ **실시간 알림**: 새 버전 배포 시 즉시 모든 접속 중인 클라이언트에게 알림
- ✅ **자동 새로고침**: 버전 불일치 시 자동으로 페이지 새로고침
- ✅ **사용자 선택권**: 업데이트 알림 시 사용자가 새로고침 시점 선택 가능
- ✅ **관리자 전용**: 관리자만 업데이트 알림을 보낼 수 있음
- ✅ **버전 추적**: 로컬스토리지에 버전 정보 저장으로 중복 알림 방지

## 📋 구현된 기능

### 서버 측 (server/src/index.js)

1. **버전 관리 시스템**
   ```javascript
   let currentBuildVersion = process.env.BUILD_VERSION || Date.now().toString();
   ```

2. **업데이트 알림 함수**
   ```javascript
   function notifyClientUpdate(newVersion) {
     io.emit('app:update-available', { 
       version: newVersion,
       message: '새로운 버전이 배포되었습니다...',
       timestamp: Date.now()
     });
   }
   ```

3. **관리자 API 엔드포인트**
   ```
   POST /api/admin/notify-update
   ```

### 클라이언트 측 (client/src/App.jsx)

1. **버전 체크 로직**
   - 접속 시 서버에서 현재 버전 수신
   - 로컬 버전과 비교하여 불일치 시 자동 새로고침

2. **실시간 업데이트 알림**
   - 사용자에게 확인 대화상자 표시
   - 거부 시 다음 페이지 이동 시 새로고침

## 🛠️ 사용 방법

### 1. 관리자 토큰 설정

`build_and_notify.bat` 파일에서 관리자 JWT 토큰을 설정하세요:

```batch
set ADMIN_TOKEN=YOUR_ADMIN_JWT_TOKEN_HERE
```

### 2. 빌드 및 배포

```cmd
build_and_notify.bat
```

또는 수동으로:

```cmd
# 1. 클라이언트 빌드
cd client
npm run build

# 2. 업데이트 알림 전송
curl -X POST http://localhost:4000/api/admin/notify-update \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"version": "20241201_143000", "message": "새로운 버전이 배포되었습니다."}'
```

### 3. 환경 변수 설정 (선택사항)

서버 시작 시 빌드 버전을 환경 변수로 설정:

```cmd
set BUILD_VERSION=20241201_143000
npm start
```

## 🔧 API 사용법

### 업데이트 알림 전송

**요청:**
```http
POST /api/admin/notify-update
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json

{
  "version": "20241201_143000",
  "message": "새로운 버전이 배포되었습니다. 잠시 후 자동으로 새로고침됩니다."
}
```

**응답:**
```json
{
  "success": true,
  "version": "20241201_143000",
  "message": "새로운 버전이 배포되었습니다...",
  "connectedClients": 15,
  "timestamp": 1701423000000
}
```

## 🎯 동작 흐름

1. **관리자가 새 버전 배포**
   - `build_and_notify.bat` 실행
   - 클라이언트 빌드 완료
   - API 호출로 업데이트 알림 전송

2. **서버에서 알림 브로드캐스트**
   - 모든 연결된 클라이언트에게 `app:update-available` 이벤트 전송
   - 연결된 클라이언트 수 로깅

3. **클라이언트에서 알림 수신**
   - 사용자에게 확인 대화상자 표시
   - 승인 시 즉시 새로고침
   - 거부 시 다음 페이지 이동 시 새로고침

4. **버전 체크**
   - 클라이언트 접속 시 서버에서 현재 버전 전송
   - 로컬 버전과 비교하여 불일치 시 자동 새로고침

## 🔒 보안

- ✅ 관리자 권한 확인 (JWT 토큰 + isAdmin 체크)
- ✅ API 요청 로깅
- ✅ 잘못된 요청 차단

## 📝 로그 예시

```
📱 현재 앱 버전: 20241201_143000
🔑 [ADMIN] Update notification request: { version: '20241201_143000', adminUsername: 'admin' }
📢 새 버전 배포 알림 전송: 20241201_143000 (연결된 클라이언트: 15개)
✅ [ADMIN] Update notification sent by admin: 20241201_143000
```

## 🚨 주의사항

1. **관리자 토큰 보안**: JWT 토큰을 안전하게 보관하세요
2. **서버 실행 확인**: 배포 전 서버가 실행 중인지 확인하세요
3. **네트워크 연결**: curl 명령어가 정상 작동하는지 확인하세요
4. **브라우저 호환성**: 모든 주요 브라우저에서 테스트하세요

## 🔄 향후 개선 사항

- [ ] 우아한 새로고침 (작업 중인 사용자 고려)
- [ ] 업데이트 진행률 표시
- [ ] 롤백 기능
- [ ] 업데이트 히스토리 관리

