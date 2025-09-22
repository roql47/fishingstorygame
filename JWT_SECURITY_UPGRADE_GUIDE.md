# 🔐 JWT 보안 강화 적용 가이드

## 📋 적용 방법

### 1단계: 기존 JWT 미들웨어 교체

**파일**: `server/src/index.js`
**위치**: 7127-7172 라인

**기존 코드 (제거할 부분):**
```javascript
// 🔐 JWT 인증 미들웨어
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    console.log("🚨 JWT missing in request");
    return res.status(401).json({ 
      error: "Access token required",
      code: "JWT_MISSING" 
    });
  }
  
  const decoded = verifyJWT(token);
  if (!decoded) {
    return res.status(403).json({ 
      error: "Invalid or expired token",
      code: "JWT_INVALID" 
    });
  }
  
  // 요청 객체에 사용자 정보 추가
  req.user = decoded;
  req.userUuid = decoded.userUuid;
  req.username = decoded.username;
  
  console.log(`🔐 JWT authenticated: ${decoded.username} (${decoded.userUuid})`);
  next();
}

// 🔐 선택적 JWT 인증 미들웨어 (토큰이 없어도 통과, 있으면 검증)
function optionalJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token) {
    const decoded = verifyJWT(token);
    if (decoded) {
      req.user = decoded;
      req.userUuid = decoded.userUuid;
      req.username = decoded.username;
    }
  }
  
  next();
}
```

**새로운 코드 (교체할 내용):**
`server/src/jwt-security-patch.js` 파일의 내용을 복사해서 위 코드를 교체하세요.

### 2단계: 보안 강화 시스템 추가

**파일**: `server/src/index.js`
**위치**: 보안 모니터링 시스템 섹션 이후 (약 1575라인 근처)

`server/src/security-enhancements.js` 파일의 내용을 추가하세요.

### 3단계: 미들웨어 적용

기존 라우트들에 보안 미들웨어를 추가하세요:

```javascript
// 모든 라우트에 보안 헤더 적용
app.use(addSecurityHeaders);

// JWT 보호 라우트에 추가 보안 적용
app.use('/api/protected-route', checkTokenBlacklist, detectSuspiciousActivity, authenticateJWT);
```

## 🛡️ 강화된 보안 기능

### 1. Bearer 토큰 형식 검증
- ✅ `Authorization: Bearer <token>` 형식 강제
- ✅ 잘못된 형식 즉시 차단 및 로깅

### 2. 토큰 길이 검증
- ✅ 20-2048 바이트 범위 검증
- ✅ 비정상적인 토큰 길이 탐지

### 3. User-Agent 검증
- ✅ 봇/자동화 도구 탐지
- ✅ curl, wget, postman 등 의심 도구 로깅

### 4. Host 헤더 검증
- ✅ 허용된 도메인만 접근 허용
- ✅ 잘못된 Host 헤더 차단

### 5. IP 주소 추적
- ✅ 모든 JWT 요청의 IP 로깅
- ✅ 동일 토큰의 다중 IP 사용 탐지

### 6. 토큰 만료 시간 추가 검증
- ✅ JWT 라이브러리 외 추가 만료 검증
- ✅ 만료된 토큰 사용 시도 로깅

### 7. 토큰 블랙리스트 시스템
- ✅ 의심스러운 토큰 자동 차단
- ✅ 다중 IP 사용 토큰 블랙리스트 등록

### 8. 고빈도 요청 탐지
- ✅ 1분에 100개 초과 요청 탐지
- ✅ DDoS 패턴 인식 및 로깅

### 9. 보안 헤더 추가
- ✅ X-Content-Type-Options: nosniff
- ✅ X-Frame-Options: DENY
- ✅ X-XSS-Protection: 1; mode=block
- ✅ Cache-Control: no-store (JWT 요청)

### 10. 상세 보안 로깅
- ✅ 레벨별 로깅 (info, warning, critical)
- ✅ 최근 보안 이벤트 추적
- ✅ IP별 공격 통계

## 📊 새로운 보안 API

### GET /api/security/detailed-stats
관리자용 상세 보안 통계 조회

**응답 예시:**
```json
{
  "blocked": 15,
  "suspicious": 42,
  "total": 57,
  "blockedIPs": 3,
  "suspiciousIPs": 8,
  "blacklistedTokens": 2,
  "suspiciousTokens": 5,
  "recentEvents": [...],
  "topAttackingIPs": [
    {"ip": "192.168.1.100", "attacks": 12},
    {"ip": "10.0.0.50", "attacks": 8}
  ]
}
```

## 🚨 보안 알림 예시

```
🛡️ [WARNING] jwt: 192.168.1.100 - Invalid Bearer token format
🛡️ [CRITICAL] blocked: 192.168.1.100 - Invalid Host: malicious-site.com
🛡️ [WARNING] suspicious: 192.168.1.100 - Multi-IP token usage: 4 IPs
```

## 🔧 환경 변수 설정

`.env` 파일에 추가:
```
ALLOWED_HOST=your-domain.com
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
```

## ✅ 적용 완료 확인

1. 서버 재시작 후 콘솔에서 보안 로그 확인
2. JWT 인증 API 호출 시 IP 로깅 확인
3. 잘못된 Bearer 형식으로 테스트 (401 응답 확인)
4. `/api/security/detailed-stats` 접속하여 통계 확인

## ⚠️ 주의사항

1. **성능 영향**: 추가 검증으로 인한 약간의 지연 발생 가능
2. **메모리 사용**: 블랙리스트와 로그 데이터로 인한 메모리 사용량 증가
3. **로그 볼륨**: 보안 로그 증가로 인한 로그 파일 크기 증가
4. **정기 정리**: 1시간마다 자동으로 오래된 보안 데이터 정리

이제 JWT 인증이 **기업급 보안 수준**으로 강화되었습니다! 🚀
