// 동료 기본 데이터
export const COMPANION_DATA = {
  "실": {
    name: "실",
    baseHp: 80,
    baseAttack: 25,
    growthHp: 15,      // 레벨당 HP 증가량
    growthAttack: 5,   // 레벨당 공격력 증가량
    description: "민첩한 검사",
    element: "바람",
    rarity: "일반"
  },
  "피에나": {
    name: "피에나",
    baseHp: 100,
    baseAttack: 20,
    growthHp: 18,
    growthAttack: 4,
    description: "강인한 방패병",
    element: "땅",
    rarity: "일반"
  },
  "애비게일": {
    name: "애비게일",
    baseHp: 70,
    baseAttack: 30,
    growthHp: 12,
    growthAttack: 6,
    description: "화염 마법사",
    element: "불",
    rarity: "희귀"
  },
  "림스&베리": {
    name: "림스&베리",
    baseHp: 90,
    baseAttack: 22,
    growthHp: 16,
    growthAttack: 5,
    description: "쌍둥이 궁수",
    element: "바람",
    rarity: "희귀"
  },
  "클로에": {
    name: "클로에",
    baseHp: 60,
    baseAttack: 35,
    growthHp: 10,
    growthAttack: 7,
    description: "암살자",
    element: "어둠",
    rarity: "전설"
  },
  "나하트라": {
    name: "나하트라",
    baseHp: 120,
    baseAttack: 28,
    growthHp: 20,
    growthAttack: 6,
    description: "용족 전사",
    element: "불",
    rarity: "전설"
  }
};

// 동료 능력치 계산 함수
export const calculateCompanionStats = (companionName, level = 1) => {
  const baseData = COMPANION_DATA[companionName];
  if (!baseData) return null;

  const hp = baseData.baseHp + (baseData.growthHp * (level - 1));
  const attack = baseData.baseAttack + (baseData.growthAttack * (level - 1));

  return {
    ...baseData,
    level,
    hp,
    attack,
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

// 원소별 색상
export const getElementColor = (element, isDark = true) => {
  switch (element) {
    case "불":
      return isDark ? "text-red-400" : "text-red-600";
    case "물":
      return isDark ? "text-blue-400" : "text-blue-600";
    case "바람":
      return isDark ? "text-green-400" : "text-green-600";
    case "땅":
      return isDark ? "text-yellow-400" : "text-yellow-600";
    case "어둠":
      return isDark ? "text-purple-400" : "text-purple-600";
    default:
      return isDark ? "text-gray-400" : "text-gray-600";
  }
};
