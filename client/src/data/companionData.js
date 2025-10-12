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
    rarity: "희귀",
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

// 동료 능력치 계산 함수
export const calculateCompanionStats = (companionName, level = 1) => {
  const baseData = COMPANION_DATA[companionName];
  if (!baseData) return null;

  const hp = baseData.baseHp + (baseData.growthHp * (level - 1));
  const attack = baseData.baseAttack + (baseData.growthAttack * (level - 1));
  const speed = baseData.baseSpeed + (baseData.growthSpeed * (level - 1));

  return {
    ...baseData,
    level,
    hp,
    attack,
    speed,
    maxHp: hp
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

