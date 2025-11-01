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
  const enhancedSkill = baseData.skill ? {
    ...baseData.skill,
    damageMultiplier: (baseData.skill.damageMultiplier || 1.0) * tierInfo.skillMultiplier,
    moraleRequired: tierInfo.moraleRequired
  } : null;

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
  "나하트라": "자연의정수"
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

