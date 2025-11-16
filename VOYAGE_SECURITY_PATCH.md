# 🔐 항해(Voyage) 시스템 보안 패치

## 📅 패치 날짜
2025-11-16

## 🚨 발견된 보안 취약점

### 1️⃣ 클라이언트가 골드 금액 결정 (치명적)

**Before (취약점)**
```javascript
// 클라이언트 (VoyageTab.jsx)
const goldMultiplier = 2.5 + Math.random() * 2.5;
const finalGold = Math.floor(selectedFish.gold * goldMultiplier);

const requestData = {
  fishName: selectedFish.name,
  gold: finalGold, // ❌ 클라이언트에서 계산한 금액
  rank: selectedFish.rank
};
```

```javascript
// 서버 (voyageRoutes.js)
const { fishName, gold, rank } = req.body;
$inc: { money: gold } // ❌ 클라이언트 값을 검증 없이 그대로 사용
```

**문제점:**
- ❌ 클라이언트에서 `gold: 999999999` 전송 가능
- ❌ HTTP 요청 조작으로 무한 골드 획득 가능
- ❌ 서버에서 검증 로직 없음

---

### 2️⃣ 물고기 데이터 조작 가능 (높음)

**Before (취약점)**
```javascript
// 클라이언트가 전송
fishName: '존재하지_않는_물고기',
rank: 999
```

**문제점:**
- ❌ 존재하지 않는 물고기도 인벤토리에 추가됨
- ❌ rank 검증 없음
- ❌ 물고기 데이터가 클라이언트에만 존재

---

### 3️⃣ 전투 스킵 가능 (중간)

**문제점:**
- ❌ 실제 전투 없이 API만 호출해도 보상 지급
- ❌ 전투 완료 검증 없음
- ❌ 승리 조건 검증 없음

---

## ✅ 적용된 보안 수정

### 1. 서버 측 물고기 데이터 정의
**파일:** `server/src/data/voyageData.js`

```javascript
const VOYAGE_FISHES = [
  { rank: 1, name: '타코문어', hp: 35, attack: 4, speed: 50, baseGold: 500 },
  { rank: 2, name: '풀고등어', hp: 63, attack: 6, speed: 55, baseGold: 800 },
  // ... 총 28개 물고기
];

// 🔒 보안 함수들
function getVoyageFishByRank(rank) {
  const fish = VOYAGE_FISHES.find(f => f.rank === rank);
  if (!fish) throw new Error('유효하지 않은 rank');
  return fish;
}

function calculateVoyageReward(rank) {
  const fish = getVoyageFishByRank(rank);
  const multiplier = 2.5 + Math.random() * 2.5;
  const gold = Math.floor(fish.baseGold * multiplier);
  
  return {
    fishName: fish.name,
    gold: gold,
    minGold: Math.floor(fish.baseGold * 2.5),
    maxGold: Math.floor(fish.baseGold * 5.0)
  };
}

function isValidVoyageRank(rank) {
  return Number.isInteger(rank) && rank >= 1 && rank <= 28;
}
```

---

### 2. 서버 API 보안 강화
**파일:** `server/src/routes/voyageRoutes.js`

**After (보안 강화)**
```javascript
app.post('/api/voyage/reward', authenticateJWT, async (req, res) => {
  // ✅ JWT 인증 필수
  const { userUuid, username } = req.user;
  const { rank, autoVoyage } = req.body;

  // ✅ rank 유효성 검증
  if (!rank || !isValidVoyageRank(rank)) {
    console.log(`🚨 [SECURITY] Invalid voyage rank from ${username}: ${rank}`);
    return res.status(400).json({
      success: false,
      error: '유효하지 않은 랭크입니다.'
    });
  }

  // ✅ 서버에서 물고기 데이터 조회 (클라이언트 조작 불가)
  let fishData;
  try {
    fishData = getVoyageFishByRank(rank);
  } catch (error) {
    console.log(`🚨 [SECURITY] Failed to get fish data for rank ${rank}`);
    return res.status(400).json({
      success: false,
      error: '존재하지 않는 물고기입니다.'
    });
  }

  // ✅ 서버에서 골드 계산 (클라이언트 값 무시)
  const reward = calculateVoyageReward(rank);
  const fishName = reward.fishName;
  const gold = reward.gold;

  console.log(`[VOYAGE] 🎣 ${username} - Rank ${rank} (${fishName}) 보상: ${gold}G`);

  // 골드 및 물고기 지급...
  
  res.json({
    success: true,
    gold: moneyDoc.money,
    fishName,
    actualGold: gold // 서버에서 계산한 실제 보상
  });
});
```

---

### 3. 클라이언트 코드 수정
**파일:** `client/src/components/VoyageTab.jsx`

**Before (취약)**
```javascript
const requestData = {
  username,
  userUuid,
  fishName: selectedFish.name, // ❌ 조작 가능
  gold: rewardGold,             // ❌ 조작 가능
  rank: selectedFish.rank
};
```

**After (보안)**
```javascript
// 🔒 보안: 서버에서 골드 계산하므로 rank만 전송
const requestData = {
  rank: selectedFish.rank,      // ✅ rank만 전송
  autoVoyage: autoVoyageEnabled
};
```

```javascript
if (data.success) {
  // ✅ 서버에서 받은 실제 보상 사용
  if (data.actualGold) {
    setRewardGold(data.actualGold);
  }
  
  const displayGold = data.actualGold || rewardGold;
  const displayFishName = data.fishName || selectedFish.name;
  alert(`보상 획득!\n골드: +${displayGold.toLocaleString()}G`);
}
```

---

## 🔒 보안 개선 효과

### Before vs After

| 항목 | Before | After |
|------|--------|-------|
| **골드 계산** | ❌ 클라이언트 | ✅ 서버 |
| **물고기 데이터** | ❌ 클라이언트만 | ✅ 서버 원본 |
| **rank 검증** | ❌ 없음 | ✅ 1~28 범위 검증 |
| **물고기 존재 검증** | ❌ 없음 | ✅ 서버에서 확인 |
| **골드 범위 검증** | ❌ 없음 | ✅ 2.5~5배 범위 |
| **JWT 인증** | ✅ 있음 | ✅ 있음 |
| **조작 가능성** | ❌ 높음 | ✅ 거의 불가능 |

---

## 🛡️ 보안 검증 흐름

### 1. 클라이언트 요청
```
사용자가 Rank 5 물고기 처치
↓
클라이언트: { rank: 5, autoVoyage: false }
```

### 2. 서버 검증
```
✅ JWT 인증 확인
✅ rank가 1~28 범위인지 검증
✅ 서버 데이터에서 Rank 5 물고기 조회
   → { name: '간장새우', baseGold: 2500 }
✅ 골드 계산: 2500 × (2.5~5.0)
   → 결과: 7320G (예시)
✅ DB에 저장 및 응답
```

### 3. 클라이언트 응답 처리
```
서버 응답: {
  success: true,
  fishName: '간장새우',
  actualGold: 7320,
  gold: 총골드
}
↓
UI에 서버 값 표시
```

---

## 🚨 여전히 남은 보안 고려사항

### ⚠️ 전투 완료 검증 부재
**현재 상황:**
- 클라이언트에서만 전투 진행
- 서버는 전투 결과를 검증하지 않음
- API만 호출하면 보상 지급

**권장 사항:**
1. 서버 측 전투 시뮬레이션
2. 전투 세션 토큰 발급
3. 승리 조건 서버 검증
4. 비정상적인 클리어 시간 감지

---

## 📊 공격 시나리오 차단

### ❌ 시나리오 1: 골드 조작
```javascript
// 공격 시도
fetch('/api/voyage/reward', {
  body: JSON.stringify({ 
    rank: 1, 
    gold: 999999999 // ❌ 무시됨
  })
});

// 결과: 서버가 rank 1 기준으로 계산 (1250~2500G)
```

### ❌ 시나리오 2: 존재하지 않는 물고기
```javascript
// 공격 시도
fetch('/api/voyage/reward', {
  body: JSON.stringify({ 
    rank: 999,
    fishName: '해킹물고기'
  })
});

// 결과: 400 Bad Request - "유효하지 않은 랭크입니다."
```

### ❌ 시나리오 3: rank 조작
```javascript
// 공격 시도
fetch('/api/voyage/reward', {
  body: JSON.stringify({ 
    rank: 28, // 최고 랭크
    // 하지만 실제 전투는 Rank 1
  })
});

// 결과: Rank 28 보상 지급 (전투 검증 부재로 가능)
// ⚠️ 향후 전투 검증 추가 필요
```

---

## 🔧 배포 시 주의사항

### 1. 서버 재시작 필수
- `voyageData.js` 추가
- `voyageRoutes.js` 변경

### 2. 클라이언트 캐시 클리어
- `VoyageTab.jsx` 변경
- 사용자에게 새로고침 안내

### 3. 기존 사용자 영향
- 보상 금액 계산 방식 동일 (2.5~5배)
- 사용자 경험 변화 없음
- 단, 조작 시도는 차단됨

---

## 🧪 테스트 체크리스트

- [✅] 정상 전투 후 보상 수령
- [✅] JWT 없이 API 호출 → 401 Unauthorized
- [✅] 잘못된 rank (0, 29, -1 등) → 400 Bad Request
- [✅] 골드 값을 조작하여 전송 → 무시되고 서버 계산값 사용
- [✅] 존재하지 않는 물고기 이름 → 서버에서 차단
- [✅] 자동항해 모드 작동
- [✅] 일반 모드 작동
- [✅] 다크모드 지원
- [✅] Linter 에러 없음

---

## 📝 로그 모니터링

### 보안 위반 시도 시 로그
```
🚨 [SECURITY] Invalid voyage rank from username: 999
🚨 [SECURITY] Failed to get fish data for rank 999 from username
```

### 정상 요청 시 로그
```
[VOYAGE] 🎣 username - Rank 5 (간장새우) 보상: 7320G (범위: 6250~12500)
```

---

## 🔗 관련 파일

### 서버
- ✅ `server/src/data/voyageData.js` - 물고기 데이터 정의 (신규)
- ✅ `server/src/routes/voyageRoutes.js` - API 보안 강화

### 클라이언트
- ✅ `client/src/components/VoyageTab.jsx` - rank만 전송

---

## 📌 다음 단계 권장사항

### 1. 전투 검증 추가 (우선순위: 높음)
- 서버 측 전투 시뮬레이션
- 전투 세션 관리
- 비정상적인 클리어 감지

### 2. 레이트 리미팅 (우선순위: 중간)
- 짧은 시간 내 반복 요청 차단
- IP 기반 제한

### 3. 로그 분석 (우선순위: 낮음)
- 보안 위반 시도 통계
- 의심스러운 패턴 감지

---

## 👨‍💻 작성자
AI Assistant

## 📌 버전
v1.4 Security Patch - Voyage System

