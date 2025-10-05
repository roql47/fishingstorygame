# 🎣 낚시 게임 API 개발 문서

## 📋 목차

1. [개요](#개요)
2. [인증](#인증)
3. [API 엔드포인트](#api-엔드포인트)
   - [사용자 관리](#사용자-관리)
   - [게임 데이터](#게임-데이터)
   - [낚시 시스템](#낚시-시스템)
   - [인벤토리 및 자원](#인벤토리-및-자원)
   - [동료 시스템](#동료-시스템)
   - [퀘스트 시스템](#퀘스트-시스템)
   - [상점 및 거래](#상점-및-거래)
   - [장비 강화](#장비-강화)
   - [레이드 시스템](#레이드-시스템)
   - [원정 시스템](#원정-시스템)
   - [업적 시스템](#업적-시스템)
   - [관리자 API](#관리자-api)
4. [Socket.IO 이벤트](#socketio-이벤트)
5. [에러 코드](#에러-코드)
6. [환경 변수](#환경-변수)

---

## 개요

### 기본 정보
- **Base URL**: `http://localhost:4000` (개발) / `https://fising-master.onrender.com` (프로덕션)
- **API 버전**: v2024.12.19
- **프로토콜**: HTTP/HTTPS, WebSocket (Socket.IO)
- **데이터 포맷**: JSON
- **인증 방식**: JWT (JSON Web Token)

### 기술 스택
- Node.js + Express.js
- MongoDB + Mongoose
- Socket.IO (실시간 통신)
- JWT (인증)
- Google OAuth 2.0
- Kakao OAuth

---

## 인증

### JWT 토큰 구조
```javascript
{
  "userUuid": "string",    // 사용자 고유 ID
  "username": "string",    // 사용자명
  "displayName": "string", // 표시 이름
  "isAdmin": boolean       // 관리자 여부
}
```

### 인증 방식
모든 보호된 엔드포인트는 HTTP Authorization 헤더에 Bearer 토큰을 포함해야 합니다:

```
Authorization: Bearer <JWT_TOKEN>
```

### 인증이 필요한 엔드포인트
대부분의 API 엔드포인트는 `authenticateJWT` 미들웨어를 사용하여 보호됩니다.
일부 조회 API는 `optionalJWT`를 사용하여 선택적 인증을 지원합니다.

---

## API 엔드포인트

### 사용자 관리

#### 1. Kakao 토큰 교환
```
POST /api/kakao-token
```

**요청 본문**:
```json
{
  "code": "string",      // Kakao OAuth 인증 코드
  "redirectUri": "string" // 리다이렉트 URI
}
```

**응답**:
```json
{
  "userInfo": {
    "userUuid": "string",
    "username": "string",
    "displayName": "string"
  },
  "token": "string"  // JWT 토큰
}
```

#### 2. 사용자 프로필 조회
```
GET /api/user-profile?username={username}
```

**인증**: JWT 필수

**응답**:
```json
{
  "userUuid": "string",
  "username": "string",
  "displayName": "string",
  "isAdmin": boolean,
  "createdAt": "string",
  "email": "string"
}
```

#### 3. 닉네임 중복 확인
```
POST /api/check-nickname
```

**요청 본문**:
```json
{
  "nickname": "string"
}
```

**응답**:
```json
{
  "isAvailable": boolean
}
```

#### 4. 닉네임 업데이트
```
POST /api/update-nickname
```

**요청 본문**:
```json
{
  "userId": "string",
  "newNickname": "string"
}
```

#### 5. 표시 이름 설정
```
POST /api/set-display-name/:userId
```

**인증**: JWT 필수

**요청 본문**:
```json
{
  "displayName": "string"
}
```

#### 6. 사용자 설정 조회
```
GET /api/user-settings/:userId
```

**응답**:
```json
{
  "musicVolume": number,
  "soundVolume": number,
  "notifications": boolean
}
```

#### 7. 사용자 설정 업데이트
```
POST /api/user-settings/:userId
```

**인증**: JWT 필수

**요청 본문**:
```json
{
  "musicVolume": number,      // 0-100
  "soundVolume": number,      // 0-100
  "notifications": boolean
}
```

#### 8. 계정 삭제
```
DELETE /api/delete-account
POST /api/delete-account
```

**인증**: JWT 필수

**요청 본문**:
```json
{
  "userUuid": "string",
  "username": "string"
}
```

#### 9. 계정 초기화
```
POST /api/reset-account
```

**인증**: JWT 필수

**요청 본문**:
```json
{
  "userUuid": "string",
  "username": "string"
}
```

---

### 게임 데이터

#### 1. 물고기 데이터
```
GET /api/game-data/fish
```

**응답**:
```json
{
  "success": true,
  "data": {
    "물고기이름": {
      "name": "string",
      "health": number,
      "difficulty": number
    }
  }
}
```

#### 2. 물고기 체력 정보
```
GET /api/game-data/fish-health
```

#### 3. 물고기 속도 정보
```
GET /api/game-data/fish-speed
```

#### 4. 확률 정보
```
GET /api/game-data/probability
```

#### 5. 접두사 정보
```
GET /api/game-data/prefixes
```

#### 6. 상점 데이터
```
GET /api/game-data/shop
```

#### 7. 낚시 스킬에 따른 잡을 수 있는 물고기
```
GET /api/game-data/available-fish/:skill
```

**파라미터**:
- `skill`: 낚시 실력 수치

**응답**:
```json
{
  "success": true,
  "fish": ["물고기1", "물고기2", ...]
}
```

#### 8. 특정 물고기 정보
```
GET /api/game-data/fish/:name
```

#### 9. 상점 카테고리별 아이템
```
GET /api/game-data/shop/:category
```

---

### 낚시 시스템

#### 1. 낚시하기
```
POST /api/fishing
```

**인증**: JWT 필수

**요청 본문**:
```json
{
  "userUuid": "string",
  "username": "string"
}
```

**응답**:
```json
{
  "fish": "string",           // 잡은 물고기
  "weight": number,           // 무게
  "probability": number,      // 확률
  "isBossFish": boolean,      // 보스 물고기 여부
  "money": number,            // 현재 소지금
  "nextCooldown": number,     // 다음 쿨타임 (초)
  "cooldownEnd": "string"     // 쿨타임 종료 시각
}
```

#### 2. 낚시 실력 조회
```
GET /api/fishing-skill/:userId
```

**인증**: 선택적 JWT

**응답**:
```json
{
  "userUuid": "string",
  "skill": number,
  "totalCatches": number,
  "baseSkill": number,
  "achievementBonus": number
}
```

#### 3. 쿨타임 조회
```
GET /api/cooldown/:userId
```

**응답**:
```json
{
  "userUuid": "string",
  "fishingCooldown": number,
  "fishingCooldownEnd": "string",
  "raidAttackCooldownEnd": "string"
}
```

#### 4. 쿨타임 설정 (관리자)
```
POST /api/set-fishing-cooldown
```

**인증**: JWT 필수

#### 5. 쿨타임 재계산
```
POST /api/recalculate-fishing-cooldown
```

**인증**: JWT 필수

#### 6. 총 잡은 물고기 수 조회
```
GET /api/total-catches/:userId
```

**응답**:
```json
{
  "totalCatches": number
}
```

#### 7. 발견한 물고기 목록
```
GET /api/fish-discoveries/:userId
```

**인증**: 선택적 JWT

**응답**:
```json
{
  "discoveries": ["물고기1", "물고기2", ...]
}
```

---

### 인벤토리 및 자원

#### 1. 인벤토리 조회
```
GET /api/inventory/:userId
```

**인증**: 선택적 JWT

**응답**:
```json
[
  {
    "_id": "string",
    "userUuid": "string",
    "fish": "string",
    "weight": number,
    "probability": number,
    "caughtAt": "string"
  }
]
```

#### 2. 소지금 조회
```
GET /api/user-money/:userId
```

**인증**: JWT 필수

**응답**:
```json
{
  "userUuid": "string",
  "money": number
}
```

#### 3. 호박석 조회
```
GET /api/user-amber/:userId
```

**인증**: JWT 필수

**응답**:
```json
{
  "userUuid": "string",
  "amber": number
}
```

#### 4. 별조각 조회
```
GET /api/star-pieces/:userId
```

**인증**: JWT 필수

**응답**:
```json
{
  "userUuid": "string",
  "starPieces": number
}
```

#### 5. 에테르 열쇠 조회
```
GET /api/ether-keys/:userId
```

**인증**: JWT 필수

**응답**:
```json
{
  "userUuid": "string",
  "etherKeys": number
}
```

#### 6. 별조각 추가 (관리자)
```
POST /api/add-star-pieces
```

**인증**: JWT 필수 (관리자)

**요청 본문**:
```json
{
  "targetUsername": "string",
  "amount": number
}
```

#### 7. 에테르 열쇠 교환
```
POST /api/exchange-ether-keys
```

**인증**: JWT 필수

**요청 본문**:
```json
{
  "userUuid": "string",
  "username": "string",
  "amount": number
}
```

#### 8. 재료 조회
```
GET /api/materials/:userId
```

**인증**: 선택적 JWT

**응답**:
```json
{
  "userUuid": "string",
  "materials": {
    "비늘": number,
    "뼈": number,
    "이빨": number
  }
}
```

#### 9. 물고기 분해
```
POST /api/decompose-fish
```

**인증**: JWT 필수

**요청 본문**:
```json
{
  "userUuid": "string",
  "catchId": "string"
}
```

**응답**:
```json
{
  "materials": {
    "비늘": number,
    "뼈": number,
    "이빨": number
  }
}
```

#### 10. 재료 사용
```
POST /api/consume-material
```

**인증**: JWT 필수

**요청 본문**:
```json
{
  "userUuid": "string",
  "materialType": "string",
  "amount": number
}
```

---

### 동료 시스템

#### 1. 동료 통계 조회
```
GET /api/companion-stats/:userId
GET /api/companion-stats/user?userUuid={userUuid}
GET /api/companion-stats  (JWT 필수)
```

**응답**:
```json
[
  {
    "userUuid": "string",
    "companionName": "string",
    "level": number,
    "experience": number,
    "hp": number,
    "maxHp": number,
    "attack": number,
    "defense": number,
    "speed": number,
    "isInBattle": boolean,
    "skills": ["스킬1", "스킬2"]
  }
]
```

#### 2. 동료 통계 업데이트
```
POST /api/update-companion-stats
```

**인증**: JWT 필수

**요청 본문**:
```json
{
  "userUuid": "string",
  "companionName": "string",
  "updates": {
    "level": number,
    "experience": number,
    "hp": number,
    "isInBattle": boolean
  }
}
```

#### 3. 동료 모집
```
POST /api/recruit-companion
```

**인증**: JWT 필수

**요청 본문**:
```json
{
  "userUuid": "string",
  "companionId": "string"
}
```

**응답**:
```json
{
  "success": true,
  "companion": {
    "companionName": "string",
    "level": 1,
    "rarity": "string"
  }
}
```

#### 4. 동료 목록 조회 (구버전)
```
GET /api/companions/:userId
```

#### 5. 동료 롤백 로그 조회 (관리자)
```
GET /api/admin/companion-rollback-logs
```

**인증**: JWT 필수 (관리자)

---

### 퀘스트 시스템

#### 1. 일일 퀘스트 조회
```
GET /api/daily-quests/:userId
```

**응답**:
```json
{
  "quests": [
    {
      "id": "string",
      "type": "string",
      "description": "string",
      "target": number,
      "current": number,
      "reward": {
        "type": "string",
        "amount": number
      },
      "claimed": boolean,
      "completed": boolean
    }
  ],
  "nextReset": "string"
}
```

#### 2. 퀘스트 진행도 업데이트
```
POST /api/update-quest-progress
```

**인증**: JWT 필수

**요청 본문**:
```json
{
  "userUuid": "string",
  "questType": "string",
  "increment": number
}
```

#### 3. 퀘스트 보상 수령
```
POST /api/claim-quest-reward
```

**인증**: JWT 필수

**요청 본문**:
```json
{
  "userUuid": "string",
  "questId": "string"
}
```

**응답**:
```json
{
  "success": true,
  "reward": {
    "type": "string",
    "amount": number
  }
}
```

---

### 상점 및 거래

#### 1. 물고기 판매
```
POST /api/sell-fish
```

**인증**: JWT 필수

**요청 본문**:
```json
{
  "userUuid": "string",
  "catchId": "string"
}
```

**응답**:
```json
{
  "success": true,
  "price": number,
  "totalMoney": number
}
```

#### 2. 아이템 구매
```
POST /api/buy-item
```

**인증**: JWT 필수

**요청 본문**:
```json
{
  "userUuid": "string",
  "itemName": "string",
  "quantity": number
}
```

**응답**:
```json
{
  "success": true,
  "item": {
    "name": "string",
    "type": "string",
    "price": number
  },
  "totalMoney": number
}
```

#### 3. 호박석 추가 (관리자)
```
POST /api/add-amber
```

**인증**: JWT 필수 (관리자)

**요청 본문**:
```json
{
  "targetUsername": "string",
  "amount": number
}
```

---

### 장비 강화

#### 1. 장비 강화
```
POST /api/enhance-equipment
```

**인증**: JWT 필수

**요청 본문**:
```json
{
  "userUuid": "string",
  "equipmentType": "fishingRod" | "accessory"
}
```

**응답**:
```json
{
  "success": true,
  "newLevel": number,
  "bonus": number,
  "materials": {
    "비늘": number,
    "뼈": number,
    "이빨": number
  }
}
```

#### 2. 장비 조회
```
GET /api/user-equipment/:userId
```

**인증**: 선택적 JWT

**응답**:
```json
{
  "userUuid": "string",
  "fishingRod": "string",
  "fishingRodEnhancement": number,
  "accessory": "string",
  "accessoryEnhancement": number
}
```

---

### 레이드 시스템

#### 1. 레이드 보스 소환 (관리자)
```
POST /api/raid/summon
```

**인증**: JWT 필수 (관리자)

**응답**:
```json
{
  "success": true,
  "boss": {
    "id": "string",
    "name": "마르가글레슘",
    "hp": number,
    "maxHp": number,
    "killCount": number,
    "participants": {},
    "participantNames": {}
  }
}
```

#### 2. 레이드 보스 공격
```
POST /api/raid/attack
```

**인증**: JWT 필수

**응답**:
```json
{
  "success": true,
  "damage": number,
  "damageBreakdown": {
    "playerDamage": number,
    "companionDamage": number,
    "companionAttacks": [
      {
        "name": "string",
        "attack": number
      }
    ],
    "totalDamage": number
  }
}
```

**에러 응답 (쿨타임)**:
```json
{
  "error": "레이드 공격 쿨타임이 남아있습니다.",
  "remainingTime": number,
  "cooldownEnd": "string"
}
```

#### 3. 레이드 상태 조회
```
GET /api/raid/status
```

**인증**: JWT 필수

**응답**:
```json
{
  "success": true,
  "active": boolean,
  "boss": {
    "id": "string",
    "name": "string",
    "hp": number,
    "maxHp": number,
    "participants": {},
    "participantNames": {}
  },
  "logs": []
}
```

---

### 원정 시스템

#### 1. 원정 지역 목록 조회
```
GET /api/expedition/areas
```

**응답**:
```json
{
  "success": true,
  "areas": [
    {
      "id": "string",
      "name": "string",
      "difficulty": number,
      "description": "string",
      "requiredLevel": number,
      "rewards": []
    }
  ]
}
```

#### 2. 사용 가능한 방 목록 조회
```
GET /api/expedition/rooms
```

**응답**:
```json
{
  "success": true,
  "rooms": [
    {
      "id": "string",
      "areaId": "string",
      "hostId": "string",
      "hostName": "string",
      "players": [],
      "maxPlayers": number,
      "status": "waiting" | "in_progress" | "completed"
    }
  ]
}
```

#### 3. 방 생성
```
POST /api/expedition/rooms/create
```

**인증**: JWT 필수

**요청 본문**:
```json
{
  "areaId": "string"
}
```

**응답**:
```json
{
  "success": true,
  "room": {
    "id": "string",
    "areaId": "string",
    "hostId": "string",
    "hostName": "string",
    "players": [],
    "maxPlayers": 4,
    "status": "waiting"
  }
}
```

#### 4. 방 참가
```
POST /api/expedition/rooms/:roomId/join
```

**인증**: JWT 필수

#### 5. 방 나가기
```
POST /api/expedition/rooms/leave
```

**인증**: JWT 필수

#### 6. 준비 상태 토글
```
POST /api/expedition/rooms/ready
```

**인증**: JWT 필수

#### 7. 플레이어 강퇴 (방장만 가능)
```
POST /api/expedition/rooms/kick
```

**인증**: JWT 필수

**요청 본문**:
```json
{
  "targetPlayerId": "string"
}
```

#### 8. 원정 시작
```
POST /api/expedition/rooms/start
```

**인증**: JWT 필수

#### 9. 플레이어 공격
```
POST /api/expedition/attack
```

**인증**: JWT 필수

**요청 본문**:
```json
{
  "targetMonsterId": "string"
}
```

#### 10. 다음 턴 진행
```
POST /api/expedition/next-turn
```

**인증**: JWT 필수

#### 11. 보상 수령
```
POST /api/expedition/claim-rewards
```

**인증**: JWT 필수

**응답**:
```json
{
  "success": true,
  "rewards": [
    {
      "playerId": "string",
      "fishName": "string",
      "quantity": number
    }
  ],
  "message": "보상을 수령했습니다!"
}
```

#### 12. 현재 방 정보 조회
```
GET /api/expedition/rooms/current
```

**인증**: JWT 필수

#### 13. 특정 방 정보 조회
```
GET /api/expedition/rooms/:roomId
```

---

### 업적 시스템

#### 1. 업적 조회
```
GET /api/achievements?targetUsername={username}
```

**인증**: JWT 필수

**응답**:
```json
{
  "achievements": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "icon": "string",
      "unlocked": boolean,
      "unlockedAt": "string",
      "progress": number,
      "maxProgress": number,
      "bonus": {
        "type": "fishingSkill",
        "value": number
      }
    }
  ],
  "totalUnlocked": number,
  "totalBonus": number
}
```

#### 2. 관리자 업적 부여
```
POST /api/achievements/admin/grant
```

**인증**: JWT 필수 (관리자)

**요청 본문**:
```json
{
  "targetUsername": "string",
  "achievementId": "string"
}
```

#### 3. 관리자 업적 해제
```
POST /api/achievements/admin/revoke
```

**인증**: JWT 필수 (관리자)

**요청 본문**:
```json
{
  "targetUsername": "string",
  "achievementId": "string"
}
```

#### 4. 업적 자동 체크
```
POST /api/achievements/check
```

**인증**: JWT 필수

#### 5. 업적 보너스 조회
```
GET /api/achievements/bonus/:userUuid
```

**인증**: JWT 필수

**응답**:
```json
{
  "success": true,
  "totalBonus": number,
  "bonusBreakdown": [
    {
      "achievementId": "string",
      "achievementName": "string",
      "bonus": number
    }
  ]
}
```

#### 6. 레이드 데미지 확인 (디버깅용)
```
GET /api/achievements/debug/raid-damage/:userUuid
```

**인증**: JWT 필수

---

### 관리자 API

#### 1. 관리자 권한 토글
```
POST /api/toggle-admin
```

**인증**: JWT 필수 (관리자)

**요청 본문**:
```json
{
  "targetUsername": "string"
}
```

#### 2. 관리자 상태 확인
```
GET /api/admin-status/:userId
```

#### 3. 연결된 사용자 목록
```
GET /api/connected-users
```

**인증**: JWT 필수

#### 4. 사용자 계정 초기화 (관리자)
```
POST /api/admin/reset-user-account
```

**인증**: JWT 필수 (관리자)

**요청 본문**:
```json
{
  "targetUsername": "string"
}
```

#### 5. IP 차단
```
POST /api/admin/block-ip
```

**인증**: JWT 필수 (관리자)

**요청 본문**:
```json
{
  "ipAddress": "string",
  "reason": "string"
}
```

#### 6. IP 차단 해제
```
POST /api/admin/unblock-ip
```

**인증**: JWT 필수 (관리자)

**요청 본문**:
```json
{
  "ipAddress": "string"
}
```

#### 7. 계정 차단
```
POST /api/admin/block-account
```

**인증**: JWT 필수 (관리자)

**요청 본문**:
```json
{
  "targetUsername": "string",
  "reason": "string",
  "duration": number  // 시간 단위 (밀리초)
}
```

#### 8. 계정 차단 해제
```
POST /api/admin/unblock-account
```

**인증**: JWT 필수 (관리자)

**요청 본문**:
```json
{
  "targetUsername": "string"
}
```

#### 9. 차단된 계정 목록
```
GET /api/admin/blocked-accounts
```

#### 10. 사용자 IP 목록
```
GET /api/admin/user-ips
```

#### 11. 차단된 IP 목록
```
GET /api/admin/blocked-ips
```

#### 12. 사용자 계정 삭제 (관리자)
```
POST /api/admin/delete-user-account
```

**인증**: JWT 필수 (관리자)

**요청 본문**:
```json
{
  "targetUsername": "string"
}
```

---

### 기타 API

#### 1. 랭킹 조회
```
GET /api/ranking
```

**응답**:
```json
{
  "ranking": [
    {
      "username": "string",
      "displayName": "string",
      "totalCatches": number,
      "fishingSkill": number,
      "rank": number
    }
  ]
}
```

#### 2. 서버 정보 (디버깅)
```
GET /api/debug/server-info
```

**응답**:
```json
{
  "version": "v2024.12.19",
  "timestamp": "string",
  "nodeEnv": "string",
  "availableAPIs": [],
  "message": "string"
}
```

#### 3. 헬스 체크
```
GET /api/health
```

**응답**:
```json
{
  "status": "ok",
  "timestamp": "string",
  "database": "connected" | "disconnected"
}
```

#### 4. Ping
```
GET /api/ping
```

**응답**:
```json
{
  "message": "pong",
  "timestamp": "string"
}
```

#### 5. 보안 통계
```
GET /api/security/stats
```

**응답**:
```json
{
  "blockedIPs": number,
  "blockedAttempts": number,
  "recentBlocks": []
}
```

#### 6. 메모리 캐시 정보 (디버깅)
```
GET /api/debug/memory-cache
```

---

## Socket.IO 이벤트

### 클라이언트 → 서버

#### 1. 사용자 로그인
```javascript
socket.emit('user-login', {
  username: "string",
  userUuid: "string"
});
```

#### 2. 사용자 데이터 구독
```javascript
socket.emit('data:subscribe', {
  userUuid: "string",
  username: "string"
});
```

#### 3. 데이터 요청
```javascript
socket.emit('data:request', {
  type: "inventory" | "materials" | "money" | "amber" | "starPieces" | "cooldown" | "totalCatches",
  userUuid: "string",
  username: "string"
});
```

#### 4. 채팅 메시지
```javascript
socket.emit('chat:message', {
  username: "string",
  content: "string",
  timestamp: "string"
});
```

#### 5. 레이드 상태 요청
```javascript
socket.emit('raid:status:request');
```

#### 6. 원정 방 참가
```javascript
socket.emit('expedition-join-room', roomId);
```

#### 7. 원정 방 나가기
```javascript
socket.emit('expedition-leave-room', roomId);
```

#### 8. Ping (연결 유지)
```javascript
socket.emit('ping');
```

#### 9. Client Pong
```javascript
socket.emit('client-pong');
```

---

### 서버 → 클라이언트

#### 1. 사용자 데이터 업데이트
```javascript
socket.on('data:update', (data) => {
  // data: { inventory, materials, money, amber, starPieces, cooldown, totalCatches }
});
```

#### 2. 인벤토리 업데이트
```javascript
socket.on('inventoryUpdated', (data) => {
  // data: { userUuid, reason, rewards }
});
```

#### 3. 레이드 보스 업데이트
```javascript
socket.on('raid:boss:update', (data) => {
  // data: { boss }
});
```

#### 4. 레이드 로그 업데이트
```javascript
socket.on('raid:log:update', (data) => {
  // data: { log }
});
```

#### 5. 레이드 보스 처치
```javascript
socket.on('raid:boss:defeated', (data) => {
  // data: { reward, lastAttackBonus }
});
```

#### 6. 채팅 메시지
```javascript
socket.on('chat:message', (data) => {
  // data: { username, content, timestamp, system }
});
```

#### 7. 원정 방 생성
```javascript
socket.on('expeditionRoomCreated', (room) => {
  // room: 새로 생성된 방 정보
});
```

#### 8. 원정 방 업데이트
```javascript
socket.on('expeditionRoomUpdated', (room) => {
  // room: 업데이트된 방 정보
});
```

#### 9. 원정 방 삭제
```javascript
socket.on('expeditionRoomDeleted', (data) => {
  // data: { playerId }
});
```

#### 10. 원정 플레이어 참가
```javascript
socket.on('expeditionPlayerJoined', (data) => {
  // data: { roomId, player, room }
});
```

#### 11. 원정 플레이어 강퇴
```javascript
socket.on('expeditionPlayerKicked', (data) => {
  // data: { kickedPlayerId, roomId }
});
```

#### 12. 원정 시작
```javascript
socket.on('expeditionStarted', (room) => {
  // room: 시작된 원정 정보
});
```

#### 13. 원정 전투 업데이트
```javascript
socket.on('expeditionBattleUpdate', (data) => {
  // data: { type, room }
});
```

#### 14. 원정 방 목록 새로고침
```javascript
socket.on('expeditionRoomsRefresh');
```

#### 15. 원정 호스트 나감
```javascript
socket.on('expeditionHostLeft');
```

#### 16. 원정 플레이어 준비
```javascript
socket.on('expeditionPlayerReady', (data) => {
  // data: { roomId, playerId, room }
});
```

#### 17. Pong (연결 확인 응답)
```javascript
socket.on('pong');
```

#### 18. 서버 Ping
```javascript
socket.on('server-ping', () => {
  socket.emit('client-pong');
});
```

---

## 에러 코드

### HTTP 상태 코드

| 코드 | 설명 |
|------|------|
| 200 | 성공 |
| 400 | 잘못된 요청 |
| 401 | 인증 실패 |
| 403 | 권한 없음 |
| 404 | 리소스 없음 |
| 429 | 요청 제한 초과 (쿨타임) |
| 500 | 서버 오류 |

### 일반 에러 응답 형식
```json
{
  "error": "에러 메시지",
  "code": "ERROR_CODE",
  "details": "추가 정보"
}
```

### 주요 에러 메시지

- **인증 관련**
  - `"토큰이 제공되지 않았습니다."`
  - `"유효하지 않은 토큰입니다."`
  - `"권한이 없습니다."`

- **자원 관련**
  - `"소지금이 부족합니다."`
  - `"재료가 부족합니다."`
  - `"별조각이 부족합니다."`

- **쿨타임 관련**
  - `"낚시 쿨타임이 남아있습니다."`
  - `"레이드 공격 쿨타임이 남아있습니다."`

- **데이터 관련**
  - `"사용자를 찾을 수 없습니다."`
  - `"아이템을 찾을 수 없습니다."`
  - `"물고기를 찾을 수 없습니다."`

---

## 환경 변수

### 필수 환경 변수

```bash
# MongoDB
MONGO_URI=mongodb://...

# JWT
JWT_SECRET=your_jwt_secret_key

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id

# Kakao OAuth
KAKAO_CLIENT_ID=your_kakao_client_id
KAKAO_CLIENT_SECRET=your_kakao_client_secret
KAKAO_REDIRECT_URI=your_redirect_uri

# 서버
PORT=4000
NODE_ENV=production|development
CLIENT_URL=http://localhost:5173

# CORS
ALLOWED_ORIGINS=http://localhost:5173,https://your-domain.com
```

### 선택적 환경 변수

```bash
# 로깅
LOG_LEVEL=info|debug|error

# 레이트 리밋
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000

# 캐시
CACHE_TTL=3600000
```

---

## 데이터 모델

### User (UserUuid)
```javascript
{
  userUuid: String,           // 고유 ID
  username: String,           // 사용자명
  displayName: String,        // 표시 이름
  email: String,              // 이메일
  isAdmin: Boolean,           // 관리자 여부
  createdAt: Date,            // 생성 일시
  lastLogin: Date,            // 마지막 로그인
  raidAttackCooldownEnd: Date // 레이드 쿨타임
}
```

### Catch (인벤토리)
```javascript
{
  userUuid: String,     // 사용자 ID
  username: String,     // 사용자명
  fish: String,         // 물고기 이름
  weight: Number,       // 무게
  probability: Number,  // 확률
  caughtAt: Date        // 잡은 시간
}
```

### FishingSkill
```javascript
{
  userUuid: String,     // 사용자 ID
  skill: Number,        // 낚시 실력
  totalCatches: Number  // 총 잡은 수
}
```

### CompanionStats
```javascript
{
  userUuid: String,         // 사용자 ID
  companionName: String,    // 동료 이름
  level: Number,            // 레벨
  experience: Number,       // 경험치
  hp: Number,               // 체력
  maxHp: Number,            // 최대 체력
  attack: Number,           // 공격력
  defense: Number,          // 방어력
  speed: Number,            // 속도
  isInBattle: Boolean,      // 전투 참전 여부
  skills: [String]          // 스킬 목록
}
```

### DailyQuest
```javascript
{
  userUuid: String,     // 사용자 ID
  quests: [{
    id: String,         // 퀘스트 ID
    type: String,       // 퀘스트 타입
    target: Number,     // 목표
    current: Number,    // 현재 진행도
    claimed: Boolean    // 보상 수령 여부
  }],
  lastReset: Date       // 마지막 초기화 시간
}
```

### UserEquipment
```javascript
{
  userUuid: String,                 // 사용자 ID
  fishingRod: String,               // 낚시대
  fishingRodEnhancement: Number,    // 낚시대 강화 수치
  accessory: String,                // 악세사리
  accessoryEnhancement: Number      // 악세사리 강화 수치
}
```

### RaidDamage
```javascript
{
  userUuid: String,     // 사용자 ID
  username: String,     // 사용자명
  totalDamage: Number   // 총 데미지
}
```

### Achievement
```javascript
{
  userUuid: String,         // 사용자 ID
  achievementId: String,    // 업적 ID
  unlockedAt: Date,         // 해금 시간
  progress: Number          // 진행도
}
```

---

## 버전 히스토리

### v2024.12.19
- 초기 API 문서 작성
- 레이드 시스템 추가
- 원정 시스템 추가
- 업적 시스템 추가
- JWT 인증 강화

---

## 지원

### 문의
- GitHub Issues: [프로젝트 저장소]
- 이메일: [담당자 이메일]

### 라이선스
MIT License

---

**마지막 업데이트**: 2024.12.19

