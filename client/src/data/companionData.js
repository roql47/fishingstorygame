// 동료 기본 데이터
export const COMPANION_DATA = {
  "실": {
    name: "실",
    baseHp: 54,        // 27 * 2 = 54
    baseAttack: 9,     // 6 * 1.5 = 9
    baseSpeed: 45,     // 기본 속도
    growthHp: 10,      // 5 * 2 = 10
    growthAttack: 2,   // 1 * 1.5 = 1.5 → 2
    growthSpeed: 0.5,    // 레벨당 속도 증가량
    description: "민첩한 검사",
    rarity: "일반",
    skill: {
      name: "폭격",
      description: "강력한 폭격으로 적에게 큰 피해를 입힙니다",
      damageMultiplier: 1.5, // 기본 공격력의 150%
      moraleRequired: 100
    }
  },
  "피에나": {
    name: "피에나",
    baseHp: 66,        // 33 * 2 = 66
    baseAttack: 8,     // 5 * 1.5 = 7.5 → 8
    baseSpeed: 25,     // 기본 속도
    growthHp: 12,      // 6 * 2 = 12
    growthAttack: 2,   // 1 * 1.5 = 1.5 → 2
    growthSpeed: 0.5,    // 레벨당 속도 증가량
    description: "강인한 방패병",
    rarity: "일반",
    skill: {
      name: "무의태세",
      description: "3턴 동안 공격력이 25% 상승합니다",
      damageMultiplier: 1.0, // 즉시 데미지는 없음
      moraleRequired: 100,
      buffType: "attack",
      buffMultiplier: 1.25,
      buffDuration: 3
    }
  },
  "애비게일": {
    name: "애비게일",
    baseHp: 46,        // 23 * 2 = 46
    baseAttack: 12,    // 8 * 1.5 = 12
    baseSpeed: 40,     // 기본 속도
    growthHp: 8,       // 4 * 2 = 8
    growthAttack: 3,   // 2 * 1.5 = 3
    growthSpeed: 0.5,    // 레벨당 속도 증가량
    description: "화염 마법사",
    rarity: "일반",
    skill: {
      name: "집중포화",
      description: "3턴 동안 크리티컬 확률이 20% 상승합니다",
      damageMultiplier: 1.0, // 즉시 데미지는 없음
      moraleRequired: 100,
      buffType: "critical",
      buffMultiplier: 0.20, // 크리티컬 확률 +20%
      buffDuration: 3
    }
  },
  "림스&베리": {
    name: "림스&베리",
    baseHp: 60,        // 30 * 2 = 60
    baseAttack: 9,     // 6 * 1.5 = 9
    baseSpeed: 50,     // 기본 속도
    growthHp: 10,      // 5 * 2 = 10
    growthAttack: 2,   // 1 * 1.5 = 1.5 → 2
    growthSpeed: 0.5,    // 레벨당 속도 증가량
    description: "쌍둥이 궁수",
    rarity: "일반",
    skill: {
      name: "마탄 발사",
      description: "2명의 적에게 각각 100% 공격력으로 공격합니다",
      damageMultiplier: 1.0, // 기본 공격력의 100%
      moraleRequired: 100,
      targetCount: 2, // 다중 타겟
      skillType: "multi_target"
    }
  },
  "클로에": {
    name: "클로에",
    baseHp: 40,        // 20 * 2 = 40
    baseAttack: 14,    // 9 * 1.5 = 13.5 → 14
    baseSpeed: 65,     // 기본 속도 (암살자는 빠름)
    growthHp: 6,       // 3 * 2 = 6
    growthAttack: 3,   // 2 * 1.5 = 3
    growthSpeed: 0.5,    // 레벨당 속도 증가량
    description: "암살자",
    rarity: "일반",
    skill: {
      name: "에테르축복",
      description: "체력이 가장 낮은 아군의 체력을 회복시킵니다",
      damageMultiplier: 0, // 데미지 없음
      healMultiplier: 1.85, // 공격력의 185%
      moraleRequired: 100,
      skillType: "heal"
    }
  },
  "나하트라": {
    name: "나하트라",
    baseHp: 80,        // 40 * 2 = 80
    baseAttack: 11,    // 7 * 1.5 = 10.5 → 11
    baseSpeed: 30,     // 기본 속도 (용족은 느림)
    growthHp: 14,      // 7 * 2 = 14
    growthAttack: 3,   // 2 * 1.5 = 3
    growthSpeed: 0.5,    // 레벨당 속도 증가량
    description: "용족 전사",
    rarity: "일반",
    skill: {
      name: "악몽의 정원",
      description: "최대 5명의 적에게 전체공격 데미지를 입힙니다",
      damageMultiplier: 0.7, // 기본 공격력의 70% (전체공격이므로 조금 낮춤)
      moraleRequired: 100,
      targetCount: 5, // 최대 5명
      skillType: "aoe"
    }
  },
  "메이델": {
    name: "메이델",
    baseHp: 85,
    baseAttack: 12,
    baseSpeed: 50,
    growthHp: 13,
    growthAttack: 3,
    growthSpeed: 0.5,
    description: "별을 인도하는 자",
    rarity: "영웅",
    recruitmentCost: { ambers: 10000, requiredCompanions: 6 }, // 기본 6명 보유 + 호박 1만개
    skill: {
      name: "달빛의 그림자",
      description: "최대 3명의 적에게 50% 데미지를 주고 3초간 속도를 정지시킵니다",
      damageMultiplier: 0.5,
      moraleRequired: 100,
      targetCount: 3,
      skillType: "multi_target",
      debuffType: "speed_freeze", // 속도 정지 디버프
      debuffDuration: 3000 // 3초 (밀리초)
    }
  },
  "아이란": {
    name: "아이란",
    baseHp: 95,        // 방어형 - 높은 체력
    baseAttack: 10,    // 방어형 - 낮은 공격력
    baseSpeed: 40,     // 보통 속도
    growthHp: 15,      // 높은 체력 성장
    growthAttack: 2.5, // 낮은 공격력 성장
    growthSpeed: 0.5,
    description: "불굴의 수호자",
    rarity: "영웅",
    recruitmentCost: { ambers: 50000, requiredCompanions: 6 }, // 기본 6명 보유 + 호박 5만개
    skill: {
      name: "연의검무",
      description: "2턴 동안 아군 전체가 받는 데미지를 30% 감소시킵니다",
      damageMultiplier: 0, // 데미지 없음
      moraleRequired: 100,
      buffType: "damage_reduction",
      buffMultiplier: 0.7, // 받는 데미지의 70%만 받음 (30% 감소)
      buffDuration: 2,
      isPartyBuff: true // 아군 전체에 적용
    }
  },
  "리무": {
    name: "리무",
    baseHp: 90,        // 메이델보다 높음 (메이델 85)
    baseAttack: 13,    // 메이델보다 높음 (메이델 12)
    baseSpeed: 55,     // 메이델보다 높음 (메이델 50)
    growthHp: 14,      // 메이델보다 높음 (메이델 13)
    growthAttack: 3.2, // 메이델보다 높음 (메이델 3)
    growthSpeed: 0.5,
    description: "폭풍을 부르는 자",
    rarity: "영웅",
    recruitmentCost: { ambers: 100000, requiredCompanions: 6 }, // 기본 6명 보유 + 호박 10만개
    skill: {
      name: "폭풍해일",
      description: "랜덤한 적 3명에게 70% 데미지를 입히고 처치시 사기 30 증가",
      damageMultiplier: 0.7,
      moraleRequired: 100,
      targetCount: 3,
      skillType: "multi_target",
      onKillMoraleGain: 30 // 적 처치시 사기 증가량
    }
  },
  "셰리": {
    name: "셰리",
    baseHp: 88,        // 밸런스형
    baseAttack: 13,    // 밸런스형
    baseSpeed: 65,     // 속도 특화!
    growthHp: 13.5,
    growthAttack: 3.1,
    growthSpeed: 0.6,  // 속도 성장 높음
    description: "질풍의 무희",
    rarity: "영웅",
    recruitmentCost: { ambers: 180000, requiredCompanions: 6 }, // 기본 6명 보유 + 호박 18만개
    skill: {
      name: "계절풍",
      description: "적에게 120% 데미지를 주고 5초간 아군의 속도를 2배로 증가",
      damageMultiplier: 1.2,
      moraleRequired: 100,
      buffType: "speed_boost",
      buffMultiplier: 2.0, // 속도 2배
      buffDuration: 5000, // 5초 (밀리초)
      isPartyBuff: true, // 아군 전체 (자신 제외)
      excludeSelf: true // 자신은 제외
    }
  }
};

// 동료 능력치 계산 함수 (tier와 breakthrough 반영)
export const calculateCompanionStats = (companionName, level = 1, tier = 0, breakthrough = 0, breakthroughStats = null) => {
  const baseData = COMPANION_DATA[companionName];
  if (!baseData) return null;

  // 💎 돌파에 따른 성장률 증가 계산
  let bonusGrowthHp = 0;
  let bonusGrowthAttack = 0;
  let bonusGrowthSpeed = 0;
  
  if (breakthroughStats) {
    bonusGrowthHp = breakthroughStats.bonusGrowthHp || 0;
    bonusGrowthAttack = breakthroughStats.bonusGrowthAttack || 0;
    bonusGrowthSpeed = breakthroughStats.bonusGrowthSpeed || 0;
  }

  // 강화된 성장률 적용
  const enhancedGrowthHp = baseData.growthHp + bonusGrowthHp;
  const enhancedGrowthAttack = baseData.growthAttack + bonusGrowthAttack;
  const enhancedGrowthSpeed = baseData.growthSpeed + bonusGrowthSpeed;

  // 기본 능력치 계산 (강화된 성장률 적용)
  let hp = baseData.baseHp + (enhancedGrowthHp * (level - 1));
  let attack = baseData.baseAttack + (enhancedGrowthAttack * (level - 1));
  let speed = baseData.baseSpeed + (enhancedGrowthSpeed * (level - 1));

  // 🌟 성장 등급에 따른 배율 적용
  const tierInfo = TIER_INFO[tier] || TIER_INFO[0];
  hp = Math.floor(hp * tierInfo.statMultiplier);
  attack = Math.floor(attack * tierInfo.statMultiplier);
  speed = Math.floor(speed * tierInfo.statMultiplier);

  // 스킬 데이터에 등급 배율 적용
  const enhancedSkill = baseData.skill ? Object.assign({}, baseData.skill, {
    damageMultiplier: (baseData.skill.damageMultiplier || 1.0) * tierInfo.skillMultiplier,
    moraleRequired: tierInfo.moraleRequired
  }) : null;

  return {
    ...baseData,
    level,
    hp,
    attack,
    speed,
    maxHp: hp,
    tier,
    breakthrough,
    growthHp: enhancedGrowthHp,
    growthAttack: enhancedGrowthAttack,
    growthSpeed: enhancedGrowthSpeed,
    skill: enhancedSkill
  };
};

// 희귀도별 색상
export const getRarityColor = (rarity, isDark = true) => {
  switch (rarity) {
    case "일반":
      return isDark ? "text-gray-400" : "text-gray-600";
    case "희귀":
      return isDark ? "text-blue-400" : "text-blue-600";
    case "전설":
      return isDark ? "text-purple-400" : "text-purple-600";
    default:
      return isDark ? "text-gray-400" : "text-gray-600";
  }
};

// 🌟 성장 등급별 정보
export const TIER_INFO = {
  0: { name: "일반", color: "gray", statMultiplier: 1.0, skillMultiplier: 1.0, moraleRequired: 100 },
  1: { name: "희귀", color: "blue", statMultiplier: 1.3, skillMultiplier: 1.3, moraleRequired: 100 },
  2: { name: "전설", color: "purple", statMultiplier: 1.6, skillMultiplier: 1.5, moraleRequired: 100 }
};

// 성장 비용 (등급별)
export const GROWTH_COSTS = {
  0: { starPieces: 10, gold: 500000 }, // 일반 → 희귀
  1: { starPieces: 25, gold: 2000000 } // 희귀 → 전설
};

// 동료별 전용 정수 아이템
export const COMPANION_ESSENCE = {
  "실": "물의정수",
  "피에나": "불의정수",
  "애비게일": "바람의정수",
  "림스&베리": "어둠의정수",
  "클로에": "빛의정수",
  "나하트라": "자연의정수",
  "메이델": "영혼의정수",
  "아이란": "땅의정수",
  "리무": "물의정수",
  "셰리": "바람의정수"
};

// 정수별 이모지
export const ESSENCE_EMOJI = {
  "물의정수": "💧",
  "불의정수": "🔥",
  "바람의정수": "💨",
  "어둠의정수": "🌑",
  "빛의정수": "✨",
  "자연의정수": "🌿",
  "땅의정수": "🪨",
  "영혼의정수": "👻"
};

// 돌파 비용 (단계별)
export const BREAKTHROUGH_COSTS = {
  0: { essence: 0, gold: 5000000 }, // 1차 돌파 (500만 골드)
  1: { essence: 1, gold: 0 }, // 2차 돌파 (정수 1개)
  2: { essence: 3, gold: 0 }, // 3차 돌파 (정수 3개)
  3: { essence: 5, gold: 0 }, // 4차 돌파 (정수 5개)
  4: { essence: 7, gold: 0 }, // 5차 돌파 (정수 7개)
  5: { essence: 10, gold: 0 } // 6차 돌파 (정수 10개)
};

// 돌파 보너스 성장률 (레벨당 증가량)
export const BREAKTHROUGH_BONUS = {
  0: { growthHp: 2, growthAttack: 0.5, growthSpeed: 0.1 }, // 1차 돌파
  1: { growthHp: 3, growthAttack: 0.7, growthSpeed: 0.15 }, // 2차 돌파
  2: { growthHp: 4, growthAttack: 1, growthSpeed: 0.2 }, // 3차 돌파
  3: { growthHp: 5, growthAttack: 1.5, growthSpeed: 0.25 }, // 4차 돌파
  4: { growthHp: 7, growthAttack: 2, growthSpeed: 0.3 }, // 5차 돌파
  5: { growthHp: 10, growthAttack: 3, growthSpeed: 0.5 } // 6차 돌파
};

// 메이델 전용 돌파 보너스 성장률 (영웅 등급)
export const BREAKTHROUGH_BONUS_MEIDEL = {
  0: { growthHp: 2.5, growthAttack: 0.6, growthSpeed: 0.1 }, // 1차 돌파
  1: { growthHp: 3.5, growthAttack: 0.8, growthSpeed: 0.15 }, // 2차 돌파
  2: { growthHp: 4.5, growthAttack: 1.2, growthSpeed: 0.2 }, // 3차 돌파
  3: { growthHp: 5.5, growthAttack: 1.8, growthSpeed: 0.25 }, // 4차 돌파
  4: { growthHp: 8, growthAttack: 2.5, growthSpeed: 0.3 }, // 5차 돌파
  5: { growthHp: 12, growthAttack: 3.5, growthSpeed: 0.5 } // 6차 돌파
};

// 아이란 전용 돌파 보너스 성장률 (영웅 등급 - 방어형)
export const BREAKTHROUGH_BONUS_AIRAN = {
  0: { growthHp: 3, growthAttack: 0.5, growthSpeed: 0.1 }, // 1차 돌파
  1: { growthHp: 4, growthAttack: 0.7, growthSpeed: 0.15 }, // 2차 돌파
  2: { growthHp: 5, growthAttack: 1, growthSpeed: 0.2 }, // 3차 돌파
  3: { growthHp: 6.5, growthAttack: 1.5, growthSpeed: 0.25 }, // 4차 돌파
  4: { growthHp: 9, growthAttack: 2, growthSpeed: 0.3 }, // 5차 돌파
  5: { growthHp: 13, growthAttack: 3, growthSpeed: 0.5 } // 6차 돌파
};

// 리무 전용 돌파 보너스 성장률 (영웅 등급 - 밸런스형)
export const BREAKTHROUGH_BONUS_RIMU = {
  0: { growthHp: 2.8, growthAttack: 0.7, growthSpeed: 0.1 }, // 1차 돌파
  1: { growthHp: 3.8, growthAttack: 0.9, growthSpeed: 0.15 }, // 2차 돌파
  2: { growthHp: 4.8, growthAttack: 1.3, growthSpeed: 0.2 }, // 3차 돌파
  3: { growthHp: 6, growthAttack: 1.9, growthSpeed: 0.25 }, // 4차 돌파
  4: { growthHp: 8.5, growthAttack: 2.6, growthSpeed: 0.3 }, // 5차 돌파
  5: { growthHp: 12.5, growthAttack: 3.7, growthSpeed: 0.5 } // 6차 돌파
};

// 셰리 전용 돌파 보너스 성장률 (영웅 등급 - 속도 특화)
export const BREAKTHROUGH_BONUS_SHERRY = {
  0: { growthHp: 2.7, growthAttack: 0.6, growthSpeed: 0.15 }, // 1차 돌파
  1: { growthHp: 3.7, growthAttack: 0.8, growthSpeed: 0.2 }, // 2차 돌파
  2: { growthHp: 4.7, growthAttack: 1.2, growthSpeed: 0.25 }, // 3차 돌파
  3: { growthHp: 5.9, growthAttack: 1.7, growthSpeed: 0.3 }, // 4차 돌파
  4: { growthHp: 8.4, growthAttack: 2.4, growthSpeed: 0.4 }, // 5차 돌파
  5: { growthHp: 12.4, growthAttack: 3.2, growthSpeed: 0.6 } // 6차 돌파 - 속도 높음
};

// 등급별 색상 가져오기 (tier 기반)
export const getTierColor = (tier, isDark = true) => {
  const tierInfo = TIER_INFO[tier] || TIER_INFO[0];
  const color = tierInfo.color;
  
  switch (color) {
    case "gray":
      return isDark ? "text-gray-400" : "text-gray-600";
    case "blue":
      return isDark ? "text-blue-400" : "text-blue-600";
    case "purple":
      return isDark ? "text-purple-400" : "text-purple-600";
    default:
      return isDark ? "text-gray-400" : "text-gray-600";
  }
};

// 등급별 배경 색상
export const getTierBgColor = (tier, isDark = true) => {
  const tierInfo = TIER_INFO[tier] || TIER_INFO[0];
  const color = tierInfo.color;
  
  switch (color) {
    case "gray":
      return isDark ? "bg-gray-500/20" : "bg-gray-100";
    case "blue":
      return isDark ? "bg-blue-500/20" : "bg-blue-100";
    case "purple":
      return isDark ? "bg-purple-500/20" : "bg-purple-100";
    default:
      return isDark ? "bg-gray-500/20" : "bg-gray-100";
  }
};

