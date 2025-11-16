# 🔐 항해 전투(Expedition) 보안 패치

## 📅 패치 날짜
2025-11-16

## 🚨 발견된 보안 취약점

### 1. 소켓 이벤트 인증 부재 (심각)
- **문제**: `expeditionPlayerAttack`, `expeditionCompanionAttack`, `expeditionMonsterAttack` 소켓 이벤트에 JWT 인증이 없음
- **영향**: 인증되지 않은 사용자가 임의로 공격 요청을 보낼 수 있음

### 2. 클라이언트 조작 가능한 playerId (심각)
- **문제**: 클라이언트가 `playerId`를 전송하여 다른 플레이어로 공격 가능
- **영향**: 다른 플레이어의 캐릭터를 조작하여 부정 행위 가능

### 3. 동료 소유권 검증 부재 (높음)
- **문제**: 클라이언트가 `companionName`을 임의로 전송하여 다른 플레이어의 동료를 조작 가능
- **영향**: 타인의 동료를 사용하여 부정 행위 가능

### 4. 몬스터 방 검증 부재 (중간)
- **문제**: 클라이언트가 `monsterId`를 임의로 전송하여 다른 방의 몬스터를 공격 가능
- **영향**: 다른 방의 전투에 개입 가능

---

## ✅ 적용된 보안 수정

### 1. ExpeditionSystem 보안 메서드 추가
**파일**: `server/src/modules/expeditionSystem.js`

추가된 메서드:
```javascript
// 🔒 플레이어가 방에 있는지 확인
isPlayerInRoom(playerId)

// 🔒 몬스터가 플레이어의 방에 있는지 확인
isMonsterInPlayerRoom(monsterId, playerId)

// 🔒 동료가 플레이어의 것인지 확인
isCompanionOwnedByPlayer(companionName, playerId)
```

### 2. 소켓 이벤트 인증 및 검증 강화
**파일**: `server/src/index.js`

#### expeditionPlayerAttack
```javascript
// ✅ 인증 확인
if (!socket.data.isAuthenticated) return;

// ✅ Socket에서 인증된 userUuid 추출 (클라이언트 조작 방지)
const authenticatedPlayerId = socket.data.userUuid || socket.userUuid;

// ✅ 방 소속 검증
if (!expeditionSystem.isPlayerInRoom(authenticatedPlayerId)) return;
```

#### expeditionCompanionAttack
```javascript
// ✅ 인증 확인
if (!socket.data.isAuthenticated) return;

// ✅ Socket에서 인증된 userUuid 추출
const authenticatedPlayerId = socket.data.userUuid || socket.userUuid;

// ✅ 방 소속 검증
if (!expeditionSystem.isPlayerInRoom(authenticatedPlayerId)) return;

// ✅ 동료 소유권 검증 (NEW!)
if (!expeditionSystem.isCompanionOwnedByPlayer(companionName, authenticatedPlayerId)) return;
```

#### expeditionMonsterAttack
```javascript
// ✅ 인증 확인
if (!socket.data.isAuthenticated) return;

// ✅ Socket에서 인증된 userUuid 추출
const authenticatedPlayerId = socket.data.userUuid || socket.userUuid;

// ✅ 방 소속 검증
if (!expeditionSystem.isPlayerInRoom(authenticatedPlayerId)) return;

// ✅ 몬스터가 플레이어 방에 있는지 검증 (NEW!)
if (!expeditionSystem.isMonsterInPlayerRoom(monsterId, authenticatedPlayerId)) return;
```

### 3. 클라이언트 코드 정리
**파일**: `client/src/components/ExpeditionTab.jsx`

- ❌ 제거: 클라이언트에서 `playerId` 전송 (보안 위험)
- ✅ 변경: 서버가 Socket 인증 정보에서 자동 추출
- ✅ 추가: 보안 관련 주석으로 의도 명확화

---

## 🛡️ 보안 개선 효과

### Before (취약)
```javascript
// 클라이언트가 임의의 playerId 전송 가능
socket.emit('expeditionPlayerAttack', { playerId: 'other-player-uuid' });
```

### After (보안)
```javascript
// 서버가 Socket 인증 정보에서 자동 추출
socket.emit('expeditionPlayerAttack', {});
// 서버: authenticatedPlayerId = socket.data.userUuid (조작 불가)
```

---

## 🔍 검증 로직 흐름

### 플레이어 공격
```
1. Socket 인증 확인 (isAuthenticated)
2. Socket에서 실제 userUuid 추출
3. 플레이어가 방에 있는지 검증
4. 공격 실행
```

### 동료 공격
```
1. Socket 인증 확인 (isAuthenticated)
2. Socket에서 실제 userUuid 추출
3. 플레이어가 방에 있는지 검증
4. 동료가 해당 플레이어 소유인지 검증 ✨ NEW
5. 공격 실행
```

### 몬스터 공격
```
1. Socket 인증 확인 (isAuthenticated)
2. Socket에서 실제 userUuid 추출
3. 플레이어가 방에 있는지 검증
4. 몬스터가 플레이어 방에 있는지 검증 ✨ NEW
5. 공격 실행
```

---

## 📊 보안 레벨 비교

| 항목 | Before | After |
|------|--------|-------|
| 인증 | ❌ 없음 | ✅ JWT 검증 |
| playerId 조작 | ❌ 가능 | ✅ 불가능 |
| 타인 캐릭터 조작 | ❌ 가능 | ✅ 불가능 |
| 타인 동료 조작 | ❌ 가능 | ✅ 불가능 |
| 타 방 개입 | ❌ 가능 | ✅ 불가능 |
| 방 소속 검증 | ❌ 없음 | ✅ 있음 |
| 동료 소유권 검증 | ❌ 없음 | ✅ 있음 |
| 몬스터 방 검증 | ❌ 없음 | ✅ 있음 |

---

## 🚀 배포 시 주의사항

### 1. 서버 재시작 필수
- ExpeditionSystem 모듈 변경
- Socket 이벤트 핸들러 변경

### 2. 클라이언트 캐시 클리어 권장
- ExpeditionTab 컴포넌트 변경
- 브라우저 하드 리프레시 권장

### 3. 기존 연결 세션
- 기존 Socket 연결은 재인증 필요
- 사용자에게 페이지 새로고침 안내

---

## 🧪 테스트 체크리스트

- [✅] 정상 플레이어 공격 작동
- [✅] 정상 동료 공격 작동
- [✅] 정상 몬스터 공격 작동
- [✅] 인증 없이 공격 시도 → 차단
- [✅] 다른 플레이어 ID로 공격 시도 → 차단 (서버가 무시)
- [✅] 다른 플레이어 동료로 공격 시도 → 차단
- [✅] 다른 방 몬스터 공격 시도 → 차단
- [✅] 방에 없는 플레이어 공격 시도 → 차단

---

## 📝 로그 모니터링

보안 위반 시도 시 서버 로그:
```
🚨 [SECURITY] Unauthenticated expedition player attack attempt: socket-id
🚨 [SECURITY] Missing userUuid in socket data: socket-id
🚨 [SECURITY] Player uuid not in any room
🚨 [SECURITY] Player uuid tried to control companion name
🚨 [SECURITY] Player uuid tried to control monster monsterId from different room
```

---

## 🔗 관련 파일

### 서버
- `server/src/modules/expeditionSystem.js` - 보안 검증 메서드 추가
- `server/src/index.js` - 소켓 이벤트 인증 강화

### 클라이언트
- `client/src/components/ExpeditionTab.jsx` - playerId 제거

---

## 👨‍💻 작성자
AI Assistant

## 📌 버전
v1.4 Security Patch

