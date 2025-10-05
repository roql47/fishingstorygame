# 🔒 API 보안 분석 보고서

## 📋 개요

API 엔드포인트들의 클라이언트 조작 방지 보안 상태를 분석한 문서입니다.

---

## ✅ 보안 강화 항목

### 1. JWT 인증 시스템 ✅

**구현 상태**: 완전히 구현됨

```javascript
// 인증 미들웨어
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
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
  
  req.user = decoded;
  next();
}
```

**장점**:
- 모든 민감한 API 엔드포인트에 적용
- 토큰 만료 시간 검증
- 사용자 정보를 서버에서 추출

---

### 2. 서버 사이드 쿨타임 검증 ✅

**구현 상태**: 완전히 구현됨

```javascript
// 낚시 API - 서버에서 쿨타임 검증
app.post("/api/fishing", authenticateJWT, async (req, res) => {
  // 서버에서 쿨타임 검증 (클라이언트 조작 방지)
  const now = new Date();
  if (user.fishingCooldownEnd && user.fishingCooldownEnd > now) {
    const remainingTime = user.fishingCooldownEnd.getTime() - now.getTime();
    console.log(`🚨 [SECURITY] Cooldown bypass attempt by ${username}`);
    return res.status(429).json({ 
      error: "낚시 쿨타임이 남아있습니다.",
      remainingTime
    });
  }
  
  // 서버에서 쿨타임 시간 계산 (클라이언트 신뢰하지 않음)
  const cooldownDuration = await calculateFishingCooldownTime({ userUuid });
  const cooldownEnd = new Date(now.getTime() + cooldownDuration);
  // 데이터베이스에 쿨타임 저장
});
```

**장점**:
- 클라이언트가 쿨타임 시간을 보내지 않음
- 서버에서 쿨타임 계산 및 검증
- 바이패스 시도 로깅

---

### 3. 레이드 쿨타임 검증 ✅

**구현 상태**: 완전히 구현됨

```javascript
// 레이드 공격 API
router.post("/attack", authenticateJWT, async (req, res) => {
  // 서버에서 레이드 공격 쿨타임 검증 (10초)
  const cooldownRecord = await CooldownModel.findOne({ userUuid }).lean();
  
  if (cooldownRecord && cooldownRecord.raidAttackCooldownEnd && 
      cooldownRecord.raidAttackCooldownEnd > now) {
    const remainingTime = Math.ceil(
      (cooldownRecord.raidAttackCooldownEnd.getTime() - now.getTime()) / 1000
    );
    console.log(`🚨 [RAID] Cooldown bypass attempt`);
    return res.status(429).json({ 
      error: "레이드 공격 쿨타임이 남아있습니다.",
      remainingTime
    });
  }
});
```

**장점**:
- 10초 쿨타임 서버 검증
- 바이패스 시도 로깅

---

### 4. 서버 사이드 가격 검증 ✅

**구현 상태**: 완전히 구현됨

#### 물고기 판매

```javascript
app.post("/api/sell-fish", authenticateJWT, async (req, res) => {
  const { fishName, quantity, totalPrice: clientTotalPrice } = req.body;
  
  // 서버에서 실제 물고기 가격 계산 (클라이언트 가격 무시)
  const serverFishPrice = await calculateServerFishPrice(fishName, query);
  const serverTotalPrice = serverFishPrice * quantity;
  
  // 클라이언트 가격과 서버 가격 비교 (보안 검증)
  if (Math.abs(clientTotalPrice - serverTotalPrice) > 1) {
    console.warn(`Fish price manipulation detected!`);
    return res.status(400).json({ error: "Invalid fish price" });
  }
  
  // 서버에서 계산된 가격 사용
  await UserMoneyModel.findOneAndUpdate(
    query,
    { $inc: { money: serverTotalPrice } }
  );
});
```

#### 아이템 구매

```javascript
app.post("/api/buy-item", authenticateJWT, async (req, res) => {
  const { itemName, price: clientPrice } = req.body;
  
  // 서버에서 실제 아이템 정보 가져오기
  const serverShopItems = getShopData();
  const serverItem = categoryItems.find(item => item.name === itemName);
  
  // 클라이언트 가격과 서버 가격 비교
  if (clientPrice !== serverItem.price) {
    console.warn(`Price manipulation detected!`);
    return res.status(400).json({ error: "Invalid item price" });
  }
  
  // 서버 가격 사용
  const actualPrice = serverItem.price;
});
```

**장점**:
- 모든 가격을 서버에서 계산
- 클라이언트 가격은 검증 용도로만 사용
- 가격 조작 시도 로깅

---

### 5. 강화 비용 검증 ✅

**구현 상태**: 완전히 구현됨

```javascript
app.post("/api/enhance-equipment", authenticateJWT, async (req, res) => {
  const { equipmentType, targetLevel, amberCost } = req.body;
  
  // 서버에서 실제 비용 계산
  const serverAmberCost = calculateRequiredAmber(
    actualTargetLevel, 
    equippedItem, 
    equipmentType
  );
  
  // 클라이언트 비용과 서버 비용 비교
  if (Math.abs(serverAmberCost - amberCost) > 5) {
    console.log("❌ Amber cost mismatch");
    return res.status(400).json({ 
      error: "Invalid amber cost calculation"
    });
  }
  
  // 서버 비용 사용
  if (userAmber.amber < serverAmberCost) {
    return res.status(400).json({ error: "Insufficient amber" });
  }
});
```

**장점**:
- 강화 비용을 서버에서 계산
- 조작 방지

---

### 6. 사용자 소유권 검증 ✅

**구현 상태**: 완전히 구현됨

```javascript
// 사용자 소유권 검증 함수
async function validateUserOwnership(
  requestedUserQuery, 
  requestingUserUuid, 
  requestingUsername
) {
  // 요청하는 사용자 확인
  const requestingUser = await UserUuidModel.findOne({ 
    userUuid: requestingUserUuid 
  });
  
  // 대상 사용자 확인
  const targetUser = await UserUuidModel.findOne(requestedUserQuery);
  
  // 본인의 데이터인지 확인
  const isSameUser = requestingUser.userUuid === targetUser.userUuid;
  
  if (!isSameUser) {
    console.warn("Unauthorized access attempt");
    return { 
      isValid: false, 
      reason: "Unauthorized access to other user's data" 
    };
  }
  
  return { isValid: true, user: targetUser };
}

// 적용 예시
app.get("/api/user-money/:userId", authenticateJWT, async (req, res) => {
  const { userUuid, username } = req.user;
  const query = await getUserQuery(userId, username, userUuid);
  
  // 본인 데이터만 조회 가능
  const ownershipValidation = await validateUserOwnership(
    query, 
    userUuid, 
    username
  );
  
  if (!ownershipValidation.isValid) {
    return res.status(403).json({ 
      error: "Access denied: You can only view your own data" 
    });
  }
});
```

**적용 API**:
- `/api/user-money/:userId`
- `/api/user-amber/:userId`
- `/api/star-pieces/:userId`
- `/api/ether-keys/:userId`

**장점**:
- 사용자가 다른 사용자의 데이터 접근 불가
- JWT 토큰의 userUuid와 요청 대상 비교

---

### 7. 관리자 권한 검증 ✅

**구현 상태**: 완전히 구현됨 (이중 보안)

```javascript
app.post("/api/toggle-admin", authenticateJWT, async (req, res) => {
  const { adminKey } = req.body;
  
  // 1. Rate Limiting (1시간 내 5회 제한)
  const attempts = adminAttempts.get(clientIP) || { count: 0 };
  if (now - attempts.lastAttempt < 3600000) {
    if (attempts.count >= 5) {
      return res.status(429).json({ 
        error: "너무 많은 시도입니다." 
      });
    }
  }
  
  // 2. 관리자 키 확인
  if (!adminKey || !ADMIN_SECRET_KEYS.includes(adminKey)) {
    console.log(`🚨 [SECURITY] Invalid admin key`);
    return res.status(403).json({ 
      error: "권한이 없습니다." 
    });
  }
  
  // 3. 차단된 IP 확인
  if (ddosBlockedIPs.has(clientIP)) {
    return res.status(403).json({ 
      error: "차단된 IP입니다." 
    });
  }
});
```

**관리자 전용 API 검증**:
```javascript
// 레이드 보스 소환
router.post("/summon", authenticateJWT, async (req, res) => {
  // JWT 토큰과 데이터베이스 양쪽 확인
  const jwtIsAdmin = req.user.isAdmin;
  const dbIsAdmin = user?.isAdmin || false;
  const hasAdminRights = jwtIsAdmin || dbIsAdmin;
  
  if (!hasAdminRights) {
    return res.status(403).json({ 
      error: "관리자만 레이드 보스를 소환할 수 있습니다." 
    });
  }
});

// IP 차단
app.post("/api/admin/block-ip", authenticateJWT, async (req, res) => {
  // 관리자 권한 확인
  const hasAdminRights = (adminUser?.isAdmin) || (adminRecord?.isAdmin);
  
  if (!hasAdminRights) {
    return res.status(403).json({ 
      error: "관리자 권한이 필요합니다." 
    });
  }
  
  // 관리자 키 검증
  if (adminKey !== validAdminKey) {
    return res.status(403).json({ 
      error: "잘못된 관리자 키입니다." 
    });
  }
});
```

**장점**:
- JWT + 관리자 키 이중 보안
- Rate Limiting 적용
- 시도 로깅

---

### 8. Rate Limiting ✅

**구현 상태**: 완전히 구현됨

```javascript
// 낚시 Rate Limiting (1초 제한)
const fishingRateLimit = new Map();

app.post("/api/fishing", authenticateJWT, async (req, res) => {
  const userKey = `fishing_${userUuid}`;
  const lastFishingTime = fishingRateLimit.get(userKey);
  
  if (lastFishingTime && (Date.now() - lastFishingTime) < 1000) {
    return res.status(429).json({ 
      error: "너무 빠르게 요청하고 있습니다." 
    });
  }
  
  fishingRateLimit.set(userKey, Date.now());
});
```

**장점**:
- DDoS 공격 방지
- 비정상적인 요청 차단

---

### 9. 서버 사이드 데미지 계산 ✅

**구현 상태**: 완전히 구현됨

```javascript
// 레이드 공격 데미지 계산
router.post("/attack", authenticateJWT, async (req, res) => {
  // 클라이언트는 공격 요청만 보냄, 데미지는 서버에서 계산
  
  // 낚시 실력 + 업적 보너스
  const fishingSkill = baseSkill + achievementBonus;
  
  // 강화 보너스
  const enhancementBonus = calculateTotalEnhancementBonus(
    userEquipment?.fishingRodEnhancement || 0
  );
  
  // 플레이어 데미지 계산
  const playerDamage = calculatePlayerAttack(fishingSkill, enhancementBonus);
  
  // 동료 데미지 계산
  for (const companion of companions) {
    const companionAttack = Math.floor(
      companion.level * 2 + Math.random() * 5
    );
    companionDamage += companionAttack;
  }
  
  const finalDamage = playerDamage + companionDamage;
  
  // 계산된 데미지로 공격
  const attackResult = raidSystem.attackBoss(userUuid, username, finalDamage);
});
```

**장점**:
- 모든 공격력 계산을 서버에서 처리
- 클라이언트는 데미지 값을 보낼 수 없음

---

### 10. 인벤토리 소유권 검증 ✅

**구현 상태**: 완전히 구현됨

```javascript
// 물고기 판매 시 소유권 확인
app.post("/api/sell-fish", authenticateJWT, async (req, res) => {
  // 사용자가 해당 물고기를 가지고 있는지 확인
  const userFish = await CatchModel.find({ 
    userUuid: query.userUuid, 
    fish: fishName 
  }).limit(quantity);
  
  if (userFish.length < quantity) {
    return res.status(400).json({ 
      error: "Not enough fish in inventory" 
    });
  }
  
  // 물고기 삭제 (실제 보유한 것만 판매)
  await CatchModel.deleteMany({ 
    _id: { $in: userFish.map(f => f._id) } 
  });
});
```

**장점**:
- 실제 보유한 아이템만 거래 가능
- 데이터베이스에서 검증

---

## ⚠️ 보안 주의 사항

### 1. 선택적 JWT 인증 (optionalJWT) ⚠️

일부 조회 API에서 `optionalJWT` 미들웨어를 사용하여 토큰 없이도 접근 가능합니다.

**영향받는 API**:
- `GET /api/inventory/:userId` (optionalJWT)
- `GET /api/fish-discoveries/:userId` (optionalJWT)
- `GET /api/user-equipment/:userId` (optionalJWT)
- `GET /api/materials/:userId` (optionalJWT)
- `GET /api/fishing-skill/:userId` (optionalJWT)

**리스크**:
- 다른 사용자의 공개 정보를 볼 수 있음
- 민감한 정보는 포함되지 않지만, 프라이버시 이슈 가능

**권장 사항**:
- 민감하지 않은 정보만 공개
- 필요하다면 `authenticateJWT`로 변경 고려
- 또는 프로필 공개/비공개 설정 추가

---

### 2. 관리자 키 하드코딩 ⚠️

```javascript
const ADMIN_SECRET_KEYS = [
  'ttm2033_secure_admin_key_2024', // ⚠️ 하드코딩
  process.env.ADMIN_SECRET_KEY,
  'dev_master_key_fishing_game'    // ⚠️ 하드코딩
].filter(Boolean);
```

**리스크**:
- 소스 코드 노출 시 관리자 키 유출
- GitHub에 커밋된 경우 영구적으로 공개됨

**권장 사항**:
✅ **즉시 조치 필요**
1. 환경 변수만 사용:
```javascript
const ADMIN_SECRET_KEYS = [
  process.env.ADMIN_SECRET_KEY,
  process.env.ADMIN_SECRET_KEY_BACKUP
].filter(Boolean);
```

2. 기존 키 무효화
3. 새로운 강력한 키 생성 (최소 32자)
4. `.env` 파일을 `.gitignore`에 추가 확인

---

### 3. 에러 메시지 정보 노출 ⚠️

일부 에러 메시지에서 과도한 정보를 제공합니다.

```javascript
res.status(400).json({ 
  error: "Invalid amber cost calculation",
  details: {
    clientCost: amberCost,
    serverCost: serverAmberCost,
    equippedItem,
    equipmentType,
    targetLevel
  }
});
```

**리스크**:
- 공격자가 서버 로직 파악 가능
- 디버그 정보 노출

**권장 사항**:
```javascript
// 프로덕션에서는 상세 정보 제거
if (process.env.NODE_ENV === 'production') {
  res.status(400).json({ error: "Invalid request" });
} else {
  res.status(400).json({ 
    error: "Invalid amber cost calculation",
    details: { ... }
  });
}
```

---

### 4. 로그에 민감한 정보 포함 검토 ⚠️

일부 로그에 사용자 정보가 포함됩니다.

```javascript
console.log(`🔐 JWT User money request: ${username} (${userUuid})`);
```

**권장 사항**:
- 프로덕션에서는 최소한의 로그만 출력
- 민감한 정보(비밀번호, 토큰 등) 로깅 금지
- 로그 레벨 구분 (info, warn, error)

---

## 🔐 보안 점수 평가

| 항목 | 점수 | 평가 |
|------|------|------|
| JWT 인증 | ⭐⭐⭐⭐⭐ | 완벽 |
| 서버 검증 | ⭐⭐⭐⭐⭐ | 완벽 |
| 가격 검증 | ⭐⭐⭐⭐⭐ | 완벽 |
| 쿨타임 검증 | ⭐⭐⭐⭐⭐ | 완벽 |
| 소유권 검증 | ⭐⭐⭐⭐⭐ | 완벽 |
| 관리자 보안 | ⭐⭐⭐⭐ | 양호 (키 관리 개선 필요) |
| Rate Limiting | ⭐⭐⭐⭐⭐ | 완벽 |
| 에러 처리 | ⭐⭐⭐⭐ | 양호 (정보 노출 최소화 필요) |

**종합 평가**: ⭐⭐⭐⭐½ (4.5/5)

---

## ✅ 결론

### 클라이언트 조작 방지 여부

**대부분의 API가 클라이언트 조작으로부터 안전하게 보호되고 있습니다.**

#### ✅ 보호되는 항목:
1. ✅ **낚시 쿨타임** - 서버에서 완전히 검증
2. ✅ **레이드 쿨타임** - 서버에서 완전히 검증
3. ✅ **물고기/아이템 가격** - 서버에서 계산 및 검증
4. ✅ **강화 비용** - 서버에서 계산 및 검증
5. ✅ **공격 데미지** - 서버에서 계산
6. ✅ **재화 (골드, 호박석)** - 서버에서 관리
7. ✅ **인벤토리 소유권** - 데이터베이스 검증
8. ✅ **사용자 데이터 접근** - JWT + 소유권 검증
9. ✅ **관리자 기능** - JWT + 관리자 키 이중 보안

#### ⚠️ 개선이 필요한 항목:
1. ⚠️ 관리자 키 하드코딩 (환경 변수로 이동 필요)
2. ⚠️ 일부 API의 optionalJWT (프라이버시 정책 확립 필요)
3. ⚠️ 에러 메시지 정보 노출 최소화

---

## 🛡️ 권장 보안 조치

### 즉시 조치 (High Priority)

1. **관리자 키 환경 변수화**
```javascript
// ❌ 현재
const ADMIN_SECRET_KEYS = [
  'ttm2033_secure_admin_key_2024',
  'dev_master_key_fishing_game'
];

// ✅ 권장
const ADMIN_SECRET_KEYS = [
  process.env.ADMIN_SECRET_KEY
].filter(Boolean);
```

2. **GitHub에서 키 제거**
- 새로운 키 생성
- 기존 커밋 히스토리에서 키 제거 (git filter-branch)
- `.env.example` 파일 생성

### 중기 조치 (Medium Priority)

3. **에러 메시지 정리**
```javascript
const isDevelopment = process.env.NODE_ENV !== 'production';

if (isDevelopment) {
  res.status(400).json({ error: "...", details: {...} });
} else {
  res.status(400).json({ error: "Invalid request" });
}
```

4. **로그 레벨 구분**
```javascript
// 민감한 정보는 debug 레벨로
debugLog(`User details: ${userUuid}`);
// 중요한 정보는 info 레벨로
infoLog(`User logged in: ${username}`);
```

### 장기 조치 (Low Priority)

5. **API Rate Limiting 강화**
- express-rate-limit 패키지 사용 고려
- IP별 요청 제한 강화

6. **프라이버시 설정 추가**
- 사용자별 프로필 공개/비공개 설정
- optionalJWT API 접근 제어

---

**분석 일자**: 2024-12-19  
**분석자**: AI Security Analyst  
**문서 버전**: 1.0

