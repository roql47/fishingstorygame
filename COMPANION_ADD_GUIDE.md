# 동료 추가 가이드

이 문서는 게임에 새로운 동료를 추가하는 전체 프로세스를 설명합니다.

## 📋 목차
1. [사전 준비](#1-사전-준비)
2. [클라이언트 데이터 추가](#2-클라이언트-데이터-추가)
3. [스킬 시스템 구현](#3-스킬-시스템-구현)
4. [전투 시스템 적용](#4-전투-시스템-적용)
5. [서버 로직 추가](#5-서버-로직-추가)
6. [UI 구현](#6-ui-구현)
7. [테스트 체크리스트](#7-테스트-체크리스트)

---

## 1. 사전 준비

### 필요한 정보 결정
- **동료 이름**: 예) "아이란"
- **등급**: 일반 / 영웅 / 전설
- **타입**: 공격형 / 방어형 / 밸런스형
- **구매 비용**: 
  - 일반 동료: 가챠 (15%)
  - 영웅 동료: 호박석 N개
- **스탯 설정**:
  - baseHp, baseAttack, baseSpeed
  - growthHp, growthAttack, growthSpeed
- **스킬 정보**:
  - 스킬명
  - 스킬 타입 (damage / heal / buff / aoe / multi_target)
  - 효과 설명
- **전용 정수**: 물/불/바람/어둠/빛/자연/영혼/땅의정수
- **캐릭터 이미지**: character#.jpg 준비

### 이미지 준비
```bash
# 이미지를 다음 경로에 배치
fishing_version1/assets/images/character#.jpg
fishing_version1/client/public/assets/images/character#.jpg
fishing_version1/client/src/assets/character#.jpg
```

---

## 2. 클라이언트 데이터 추가

### 2.1 companionData.js - 동료 기본 데이터

**파일**: `fishing_version1/client/src/data/companionData.js`

#### 2.1.1 COMPANION_DATA에 동료 추가

```javascript
export const COMPANION_DATA = {
  // ... 기존 동료들
  
  "동료이름": {
    name: "동료이름",
    baseHp: 95,        // 기본 체력
    baseAttack: 10,    // 기본 공격력
    baseSpeed: 40,     // 기본 속도
    growthHp: 15,      // 레벨당 체력 증가
    growthAttack: 2.5, // 레벨당 공격력 증가
    growthSpeed: 0.5,  // 레벨당 속도 증가
    description: "동료 설명",
    rarity: "영웅",    // "일반" / "영웅" / "전설"
    recruitmentCost: { ambers: 50000 }, // 영웅 동료의 경우
    skill: {
      name: "스킬명",
      description: "스킬 설명",
      damageMultiplier: 0,     // 데미지 배율 (0 = 데미지 없음)
      moraleRequired: 100,
      buffType: "skill_type",  // "attack" / "critical" / "damage_reduction"
      buffMultiplier: 0.7,     // 효과 배율
      buffDuration: 2,         // 지속 턴
      isPartyBuff: true        // 아군 전체 버프 여부
    }
  }
};
```

#### 스킬 타입별 설정

**데미지 스킬**:
```javascript
skill: {
  name: "폭격",
  description: "강력한 데미지",
  damageMultiplier: 1.5,
  moraleRequired: 100
}
```

**힐 스킬**:
```javascript
skill: {
  name: "치유",
  description: "체력 회복",
  damageMultiplier: 0,
  healMultiplier: 1.85,
  moraleRequired: 100,
  skillType: "heal"
}
```

**버프 스킬** (공격력 증가):
```javascript
skill: {
  name: "무의태세",
  description: "3턴 동안 공격력 25% 증가",
  damageMultiplier: 1.0,
  moraleRequired: 100,
  buffType: "attack",
  buffMultiplier: 1.25,
  buffDuration: 3
}
```

**버프 스킬** (크리티컬 증가):
```javascript
skill: {
  name: "집중포화",
  description: "3턴 동안 크리티컬 확률 20% 증가",
  damageMultiplier: 1.0,
  moraleRequired: 100,
  buffType: "critical",
  buffMultiplier: 0.20,
  buffDuration: 3
}
```

**버프 스킬** (데미지 감소):
```javascript
skill: {
  name: "연의검무",
  description: "2턴 동안 아군 전체 받는 데미지 30% 감소",
  damageMultiplier: 0,
  moraleRequired: 100,
  buffType: "damage_reduction",
  buffMultiplier: 0.7,    // 받는 데미지의 70%만 받음
  buffDuration: 2,
  isPartyBuff: true
}
```

**AOE 스킬** (전체 공격):
```javascript
skill: {
  name: "악몽의 정원",
  description: "전체 공격",
  damageMultiplier: 0.7,
  moraleRequired: 100,
  targetCount: 5,
  skillType: "aoe"
}
```

**다중 타겟 스킬**:
```javascript
skill: {
  name: "마탄 발사",
  description: "2명 공격",
  damageMultiplier: 1.0,
  moraleRequired: 100,
  targetCount: 2,
  skillType: "multi_target"
}
```

#### 2.1.2 COMPANION_ESSENCE에 정수 추가

```javascript
export const COMPANION_ESSENCE = {
  // ... 기존 동료들
  "동료이름": "땅의정수"  // 전용 정수
};
```

#### 2.1.3 ESSENCE_EMOJI (필요시 추가)

```javascript
export const ESSENCE_EMOJI = {
  // ... 기존 정수들
  "땅의정수": "🪨"
};
```

#### 2.1.4 돌파 보너스 추가 (영웅 동료의 경우)

```javascript
// 동료 전용 돌파 보너스 성장률 (영웅 등급)
export const BREAKTHROUGH_BONUS_동료이름 = {
  0: { growthHp: 3, growthAttack: 0.5, growthSpeed: 0.1 },
  1: { growthHp: 4, growthAttack: 0.7, growthSpeed: 0.15 },
  2: { growthHp: 5, growthAttack: 1, growthSpeed: 0.2 },
  3: { growthHp: 6.5, growthAttack: 1.5, growthSpeed: 0.25 },
  4: { growthHp: 9, growthAttack: 2, growthSpeed: 0.3 },
  5: { growthHp: 13, growthAttack: 3, growthSpeed: 0.5 }
};
```

---

## 3. 스킬 시스템 구현

### 3.1 CompanionSkillSystem.js - 버프 메시지 추가

**파일**: `fishing_version1/client/src/components/companions/CompanionSkillSystem.js`

#### processBuffSkill 함수의 메시지 부분

```javascript
// 스킬 타입에 따른 버프 메시지
if (skill.buffType === 'attack') {
  newLog.push(`🔥 3턴 동안 공격력이 25% 상승합니다!`);
} else if (skill.buffType === 'critical') {
  newLog.push(`🎯 3턴 동안 크리티컬 확률이 20% 상승합니다!`);
} else if (skill.buffType === 'damage_reduction') {
  newLog.push(`🛡️ 2턴 동안 아군 전체가 받는 데미지가 30% 감소합니다!`);
}
// 새 버프 타입 추가 시 여기에 추가
```

### 3.2 explorationBattle.js - 탐사 전투용 버프 메시지

**파일**: `fishing_version1/client/src/utils/explorationBattle.js`

동일한 버프 메시지 로직 추가

---

## 4. 전투 시스템 적용

새로운 버프/디버프를 추가한 경우, 모든 전투 시스템에 적용해야 합니다.

### 4.1 일반 탐사 전투 (App.jsx)

**파일**: `fishing_version1/client/src/App.jsx`

#### 적 공격 시 버프 체크 (예: damage_reduction)

```javascript
// 적 공격 로직 내부
let damage = calculateEnemyAttack(fishData?.rank || 1);

// 🛡️ damage_reduction 버프 확인
let damageReduction = 1.0;
if (currentState.companionBuffs) {
  Object.keys(currentState.companionBuffs).forEach(companionName => {
    if (currentState.companionBuffs[companionName]?.damage_reduction) {
      damageReduction = currentState.companionBuffs[companionName].damage_reduction.multiplier;
    }
  });
}
damage = Math.floor(damage * damageReduction);

// 로그 메시지
if (damageReduction < 1.0) {
  newLog.push(`🛡️ 데미지 감소 효과 적용!`);
}
```

### 4.2 아레나 PvP 전투 (ArenaTab.jsx)

**파일**: `fishing_version1/client/src/components/ArenaTab.jsx`

#### 4.2.1 동료 버프 스킬 사용 시 저장

```javascript
// 플레이어 동료 스킬 사용
if (updatedCompanion.skill.buffType) {
  if (!updatedCompanion.buffs) updatedCompanion.buffs = {};
  updatedCompanion.buffs[updatedCompanion.skill.buffType] = {
    multiplier: updatedCompanion.skill.buffMultiplier,
    duration: updatedCompanion.skill.buffDuration || 2
  };
  
  newLog.push(`✨ ${updatedCompanion.name}이(가) ${updatedCompanion.skill.name}!`);
  // 버프 타입별 메시지
}
```

#### 4.2.2 공격 시 상대 버프 체크

```javascript
// 공격 로직 내부
let damageReduction = 1.0;
if (newState.opponent.companions) {
  newState.opponent.companions.forEach(companion => {
    if (companion.buffs?.damage_reduction) {
      damageReduction = companion.buffs.damage_reduction.multiplier;
    }
  });
}
damage = Math.floor(damage * damageReduction);
```

### 4.3 항해 전투 (VoyageTab.jsx)

**파일**: `fishing_version1/client/src/components/VoyageTab.jsx`

동일한 버프 체크 로직 적용

### 4.4 탐사 멀티플레이 전투

#### 4.4.1 클라이언트 (explorationBattle.js)

**파일**: `fishing_version1/client/src/utils/explorationBattle.js`

버프 스킬 처리 로직 추가

#### 4.4.2 서버 (expeditionSystem.js)

**파일**: `fishing_version1/server/src/modules/expeditionSystem.js`

##### autoMonsterAttack 함수에 버프 체크

```javascript
// 몬스터 공격 시
let damage = Math.floor(monster.attackPower * (0.8 + Math.random() * 0.4));

// 🛡️ damage_reduction 버프 확인
let damageReduction = 1.0;
if (battleState.companionBuffs) {
  Object.keys(battleState.companionBuffs).forEach(companionKey => {
    if (battleState.companionBuffs[companionKey]?.damage_reduction) {
      damageReduction = battleState.companionBuffs[companionKey].damage_reduction.multiplier;
    }
  });
}
damage = Math.floor(damage * damageReduction);

if (damageReduction < 1.0) {
  battleState.battleLog.push(`🛡️ 데미지 감소 효과 적용!`);
}
```

##### decreaseBuffDuration 함수에 버프명 추가

```javascript
// 버프 만료 시
let buffName = '알 수 없는 효과';
if (buffType === 'attack') buffName = '무의태세';
else if (buffType === 'critical') buffName = '집중포화';
else if (buffType === 'damage_reduction') buffName = '연의검무';
// 새 버프 추가 시 여기에 추가
```

---

## 5. 서버 로직 추가

### 5.1 index.js - 영웅 동료 목록

**파일**: `fishing_version1/server/src/index.js`

#### HERO_COMPANION_LIST에 추가 (영웅 동료의 경우)

```javascript
const HERO_COMPANION_LIST = [
  "메이델",
  "아이란"  // 새 영웅 동료
];
```

### 5.2 영웅 동료 구매 로직 추가

#### /api/recruit-hero-companion 엔드포인트에 로직 추가

```javascript
// 동료명 구매 조건 확인
if (companionName === "아이란") {
  // 호박 5만개 확인
  const requiredAmbers = 50000;
  if (!userAmbers || userAmbers.amber < requiredAmbers) {
    return res.status(400).json({ 
      error: `호박이 부족합니다. (필요: ${requiredAmbers.toLocaleString()}개)`,
      required: requiredAmbers,
      current: userAmbers?.amber || 0
    });
  }
  
  // 호박 차감
  userAmbers.amber -= requiredAmbers;
  await userAmbers.save();
  
  // 동료 추가
  if (!userCompanions) {
    const createData = {
      userId: query.userId || 'user',
      username: query.username || username,
      userUuid: query.userUuid || userUuid,
      companions: [companionName]
    };
    await CompanionModel.create(createData);
  } else {
    userCompanions.companions.push(companionName);
    await userCompanions.save();
  }
  
  // 실시간 브로드캐스트
  broadcastUserDataUpdate(userUuid, username, 'companions', { 
    companions: userCompanions?.companions || [companionName]
  });
  broadcastUserDataUpdate(userUuid, username, 'amber', { 
    amber: userAmbers.amber 
  });
  
  console.log(`✨ ${username}이(가) ${companionName}을(를) 영입했습니다!`);
  
  return res.json({
    success: true,
    companion: companionName,
    remainingAmbers: userAmbers.amber,
    totalCompanions: (userCompanions?.companions.length || 0) + 1
  });
}
```

### 5.3 COMPANION_ESSENCE 매핑 추가

```javascript
// 동료별 전용 정수 매핑 (2곳에 추가해야 함)
const COMPANION_ESSENCE = {
  "실": "물의정수",
  "피에나": "불의정수",
  "애비게일": "바람의정수",
  "림스&베리": "어둠의정수",
  "클로에": "빛의정수",
  "나하트라": "자연의정수",
  "메이델": "영혼의정수",
  "아이란": "땅의정수"  // 새 동료
};
```

**추가 위치**:
1. `/api/companion/breakthrough` 엔드포인트 내부
2. `/api/companion/breakthrough-cost/:companionName` 엔드포인트 내부

### 5.4 돌파 보너스 추가 (영웅 동료의 경우)

#### /api/companion/breakthrough 엔드포인트 내부

```javascript
// 메이델 전용 돌파 보너스
const BREAKTHROUGH_BONUS_MEIDEL = { /* ... */ };

// 아이란 전용 돌파 보너스
const BREAKTHROUGH_BONUS_AIRAN = {
  0: { growthHp: 3, growthAttack: 0.5, growthSpeed: 0.1 },
  1: { growthHp: 4, growthAttack: 0.7, growthSpeed: 0.15 },
  2: { growthHp: 5, growthAttack: 1, growthSpeed: 0.2 },
  3: { growthHp: 6.5, growthAttack: 1.5, growthSpeed: 0.25 },
  4: { growthHp: 9, growthAttack: 2, growthSpeed: 0.3 },
  5: { growthHp: 13, growthAttack: 3, growthSpeed: 0.5 }
};

const cost = BREAKTHROUGH_COSTS[currentBreakthrough];
// 영웅 동료별 전용 보너스 사용
let bonusTable = BREAKTHROUGH_BONUS;
if (companionName === "메이델") {
  bonusTable = BREAKTHROUGH_BONUS_MEIDEL;
} else if (companionName === "아이란") {
  bonusTable = BREAKTHROUGH_BONUS_AIRAN;
}
const bonus = bonusTable[currentBreakthrough];
```

---

## 6. UI 구현

### 6.1 CompanionTab.jsx - 동료 탭 UI

**파일**: `fishing_version1/client/src/components/companions/CompanionTab.jsx`

#### 6.1.1 이미지 import

```javascript
import character1 from '../../assets/character1.jpg';
import character2 from '../../assets/character2.jpeg';
// ... 기존 이미지들
import character8 from '../../assets/character8.jpg';  // 새 동료
```

#### 6.1.2 allCompanions 배열에 추가

```javascript
const allCompanions = [
  "실", "피에나", "애비게일", 
  "림스&베리", "클로에", "나하트라", 
  "메이델", "아이란"  // 새 동료
];
```

#### 6.1.3 companionImages 매핑에 추가

```javascript
const companionImages = {
  "실": character6,
  "피에나": character1,
  // ... 기존 매핑들
  "아이란": character8  // 새 동료
};
```

#### 6.1.4 영웅 동료 구매 UI 추가

```javascript
{/* 영웅 동료 구매 섹션 - 동료명 */}
{!companions.includes("동료명") && (
  <div className={`p-4 rounded-xl mb-4 border ${
    isDarkMode 
      ? "glass-input border-orange-500/30" 
      : "bg-white/60 backdrop-blur-sm border-orange-500/40"
  }`}>
    <h3 className={`text-lg font-bold mb-3 ${
      isDarkMode ? "text-orange-300" : "text-orange-700"
    }`}>
      영웅 동료: 동료명
    </h3>
    <button
      onClick={() => recruitHeroCompanion("동료명")}
      disabled={(userAmber || 0) < 50000}
      className={`w-full px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
        (userAmber || 0) >= 50000
          ? isDarkMode
            ? "bg-orange-500/20 text-orange-300 hover:bg-orange-500/30 border border-orange-400/40"
            : "bg-orange-500/10 text-orange-700 hover:bg-orange-500/20 border border-orange-500/40"
          : isDarkMode
            ? "bg-gray-500/20 text-gray-500 cursor-not-allowed border border-gray-500/20"
            : "bg-gray-300/30 text-gray-400 cursor-not-allowed border border-gray-300/30"
      }`}
    >
      {(userAmber || 0) < 50000
        ? `호박 부족 (${(userAmber || 0).toLocaleString()}/50,000)`
        : "동료명 영입 (호박 50,000개)"
      }
    </button>
  </div>
)}
```

#### 6.1.5 돌파 보너스 import 추가 (영웅의 경우)

```javascript
import { 
  COMPANION_DATA, 
  calculateCompanionStats, 
  getRarityColor,
  TIER_INFO,
  GROWTH_COSTS,
  BREAKTHROUGH_COSTS,
  BREAKTHROUGH_BONUS,
  BREAKTHROUGH_BONUS_MEIDEL,
  BREAKTHROUGH_BONUS_AIRAN,  // 새 동료
  COMPANION_ESSENCE,
  ESSENCE_EMOJI,
  getTierColor,
  getTierBgColor
} from '../../data/companionData';
```

#### 6.1.6 돌파 로직에 보너스 적용

```javascript
// handleBreakthrough 함수 내부
const stats = companionStats[selectedEnhanceCompanion] || {};
const currentBreakthrough = stats.breakthrough || 0;
const essenceName = COMPANION_ESSENCE[selectedEnhanceCompanion];

// 영웅 동료별 전용 보너스 사용
let bonusTable = BREAKTHROUGH_BONUS;
if (selectedEnhanceCompanion === "메이델") {
  bonusTable = BREAKTHROUGH_BONUS_MEIDEL;
} else if (selectedEnhanceCompanion === "아이란") {
  bonusTable = BREAKTHROUGH_BONUS_AIRAN;
}
const bonus = bonusTable[currentBreakthrough];
```

#### 6.1.7 버프 스킬 표시 수정

```javascript
// 스킬 상세 정보 표시 부분
{baseData.skill.buffType === 'attack' ? (
  <Sword className="w-3 h-3 text-red-400" />
) : baseData.skill.buffType === 'critical' ? (
  <Star className="w-3 h-3 text-yellow-400" />
) : baseData.skill.buffType === 'damage_reduction' ? (
  <Shield className="w-3 h-3 text-blue-400" />
) : (
  <Star className="w-3 h-3 text-gray-400" />
)}

// 버프 효과 텍스트
{baseData.skill.buffType === 'attack' ? (
  `공격력 +${Math.floor((baseData.skill.buffMultiplier - 1) * 100)}%`
) : baseData.skill.buffType === 'critical' ? (
  `크리티컬 +${Math.floor(baseData.skill.buffMultiplier * 100)}%`
) : baseData.skill.buffType === 'damage_reduction' ? (
  `받는 데미지 -${Math.floor((1 - baseData.skill.buffMultiplier) * 100)}%`
) : (
  '알 수 없는 효과'
)}
```

---

## 7. 테스트 체크리스트

### 7.1 기본 기능
- [ ] 동료 구매 가능 (일반/영웅)
- [ ] 동료 이미지 정상 표시
- [ ] 스킬 설명 정확하게 표시
- [ ] 레벨업 가능
- [ ] 성장(등급 상승) 가능
- [ ] 돌파 가능
- [ ] 전투 참여 토글 가능

### 7.2 전투 시스템
- [ ] 일반 탐사 전투에서 스킬 발동
- [ ] 아레나 PvP 전투에서 스킬 발동
- [ ] 항해 전투에서 스킬 발동
- [ ] 탐사 멀티플레이에서 스킬 발동
- [ ] 버프/디버프 정상 적용
- [ ] 버프 지속시간 정상 감소
- [ ] 버프 만료 메시지 표시

### 7.3 스킬별 테스트

#### 데미지 스킬
- [ ] 스킬 데미지 정상 적용
- [ ] 사기 100 도달 시 자동 발동
- [ ] 스킬 사용 후 사기 0으로 초기화

#### 힐 스킬
- [ ] 체력이 가장 낮은 아군 자동 선택
- [ ] 회복량 정확
- [ ] 최대 체력 초과 불가

#### 버프 스킬
- [ ] 버프 효과 정상 적용
- [ ] 지속 턴 정확
- [ ] 만료 시 효과 제거
- [ ] 로그 메시지 표시

#### AOE/다중 타겟 스킬
- [ ] 여러 적 동시 공격
- [ ] 타겟 수 정확
- [ ] 각 타겟별 데미지 표시

### 7.4 서버 동기화
- [ ] 동료 구매 시 실시간 반영
- [ ] 레벨업/성장/돌파 서버 저장
- [ ] 새로고침 후에도 데이터 유지

### 7.5 UI/UX
- [ ] 다크/라이트 모드 모두 정상 표시
- [ ] 버튼 활성화/비활성화 정상
- [ ] 호버 효과 정상 작동
- [ ] 모달 열기/닫기 정상

---

## 8. 참고사항

### 버프 타입 정리

| buffType | 효과 | buffMultiplier | 적용 대상 |
|----------|------|----------------|-----------|
| attack | 공격력 증가 | 1.25 = 25% 증가 | 자신 |
| critical | 크리티컬 확률 증가 | 0.20 = 20% 증가 | 자신 |
| damage_reduction | 받는 데미지 감소 | 0.7 = 30% 감소 | 아군 전체 |

### 스킬 타입 정리

| skillType | 설명 | 필요 필드 |
|-----------|------|-----------|
| (없음) | 단일 데미지 | damageMultiplier |
| heal | 회복 | healMultiplier |
| aoe | 전체 공격 | damageMultiplier, targetCount |
| multi_target | 다중 타겟 | damageMultiplier, targetCount |

### 등급별 스탯 배율

| 등급 | statMultiplier | skillMultiplier |
|------|----------------|-----------------|
| 일반 (0) | 1.0 | 1.0 |
| 희귀 (1) | 1.3 | 1.3 |
| 전설 (2) | 1.6 | 1.5 |

---

## 9. 자주 발생하는 오류

### "알 수 없는 동료입니다" (400 Bad Request)
- **원인**: 서버의 COMPANION_ESSENCE에 동료 추가 누락
- **해결**: index.js의 2곳에 모두 추가

### 이미지 표시 안됨
- **원인**: 이미지 import 또는 매핑 누락
- **해결**: CompanionTab.jsx에서 import 및 매핑 확인

### 돌파 불가
- **원인**: 돌파 보너스 테이블 설정 누락
- **해결**: 서버와 클라이언트 모두에 보너스 테이블 추가

### 버프 효과 적용 안됨
- **원인**: 전투 시스템에 버프 체크 로직 누락
- **해결**: 모든 전투 파일(5곳)에 버프 체크 로직 추가

### "알 수 없는 효과" 표시
- **원인**: UI에 새 버프 타입 표시 로직 누락
- **해결**: CompanionTab.jsx의 버프 표시 부분에 조건 추가

---

## 10. 체크리스트 요약

### 필수 수정 파일 (10개)

#### 클라이언트 (6개)
1. `client/src/data/companionData.js` - 동료 데이터
2. `client/src/components/companions/CompanionTab.jsx` - UI
3. `client/src/components/companions/CompanionSkillSystem.js` - 스킬 시스템
4. `client/src/App.jsx` - 일반 전투
5. `client/src/components/ArenaTab.jsx` - 아레나 전투
6. `client/src/components/VoyageTab.jsx` - 항해 전투

#### 서버 (2개)
7. `server/src/index.js` - 메인 서버 로직
8. `server/src/modules/expeditionSystem.js` - 탐사 멀티 서버

#### 선택적 (2개)
9. `client/src/utils/explorationBattle.js` - 탐사 전투 (버프 스킬의 경우)
10. 이미지 파일 3곳 배치

---

## 11. 실제 추가 사례: 엘리시아

최근 추가된 **엘리시아** 동료를 예시로 전체 프로세스를 정리합니다.

### 📌 기본 설정
- **이름**: 엘리시아
- **등급**: 영웅
- **타입**: 강한 공격형
- **설명**: 화염의 파괴자
- **구매 비용**: 호박 32만개 + 기본 동료 6명 보유
- **돌파 재료**: 불의정수 🔥

### 📊 스탯 설정
```javascript
baseHp: 80,        // 공격형 - 낮은 체력
baseAttack: 15,    // 강한 공격형 - 높은 공격력
baseSpeed: 55,     // 중간 속도
growthHp: 12,      // 낮은 체력 성장
growthAttack: 3.5, // 높은 공격력 성장
growthSpeed: 0.5
```

### ⚔️ 스킬 설정
```javascript
skill: {
  name: "화염 유린",
  description: "랜덤한 적 1명에게 강력한 260% 데미지를 가합니다",
  damageMultiplier: 2.6, // 기본 공격력의 260%
  moraleRequired: 100
}
```

### 💎 돌파 보너스 (공격형 특화)
```javascript
export const BREAKTHROUGH_BONUS_ELISIA = {
  0: { growthHp: 2.5, growthAttack: 0.8, growthSpeed: 0.1 },
  1: { growthHp: 3.5, growthAttack: 1.0, growthSpeed: 0.15 },
  2: { growthHp: 4.5, growthAttack: 1.5, growthSpeed: 0.2 },
  3: { growthHp: 5.5, growthAttack: 2.0, growthSpeed: 0.25 },
  4: { growthHp: 8, growthAttack: 3.0, growthSpeed: 0.3 },
  5: { growthHp: 12, growthAttack: 4.0, growthSpeed: 0.5 } // 6차 돌파 - 공격력 높음
};
```

### 🔧 수정한 파일 목록

#### 1. `client/src/data/companionData.js`
- ✅ COMPANION_DATA에 엘리시아 추가
- ✅ COMPANION_ESSENCE에 "엘리시아": "불의정수" 추가
- ✅ BREAKTHROUGH_BONUS_ELISIA 테이블 추가

#### 2. `client/src/components/companions/CompanionTab.jsx`
- ✅ BREAKTHROUGH_BONUS_ELISIA import 추가
- ✅ character11 이미지 import 추가
- ✅ allCompanions 배열에 "엘리시아" 추가
- ✅ companionImages에 "엘리시아": character11 추가
- ✅ 영웅 구매 UI 섹션 추가 (호박 32만개)
- ✅ 돌파 로직에 엘리시아 보너스 테이블 적용

#### 3. `server/src/index.js`
- ✅ HERO_COMPANION_LIST에 "엘리시아" 추가
- ✅ `/api/recruit-hero-companion` 엔드포인트에 구매 로직 추가
- ✅ COMPANION_ESSENCE 매핑 2곳에 추가
- ✅ BREAKTHROUGH_BONUS_ELISIA 테이블 추가
- ✅ 돌파 로직에 엘리시아 보너스 테이블 적용

#### 4. `server/src/modules/arenaSystem.js`
- ✅ companionSkills 객체에 엘리시아 스킬 추가

#### 5. 이미지 파일
- ✅ `character11.jpg` 3곳에 배치
  - `fishing_version1/assets/images/`
  - `fishing_version1/client/public/assets/images/`
  - `fishing_version1/client/src/assets/`

### ⚠️ 특이사항
- 엘리시아는 **단일 타겟 고데미지** 스킬이므로 별도의 버프/디버프 로직 불필요
- 레이드는 동료 공격력만 합산하므로 **자동 적용됨** (별도 수정 불필요)
- 탐사/항해 전투는 companionData.js 기반이므로 **자동 적용됨**
- 아레나만 스킬 하드코딩되어 있어서 수동 추가 필요

### ✅ 테스트 완료 항목
- [x] 동료 구매 (호박 32만개)
- [x] 레벨업 / 성장 / 돌파
- [x] 레이드 전투 참여
- [x] 아레나 PvP 전투
- [x] 일반 탐사 전투
- [x] 항해 전투
- [x] 스킬 "화염 유린" 발동 (260% 데미지)

---

**작성일**: 2025-11-09  
**최종 수정**: 엘리시아 동료 추가 (2025-11-10)  
**다음 업데이트**: 새로운 스킬 타입 추가 시

