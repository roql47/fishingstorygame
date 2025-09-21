// 동료 기본 데이터
export const COMPANION_DATA = {
  "실": {
    name: "실",
    baseHp: 27,        // 80 / 3 = 26.67 → 27
    baseAttack: 6,     // 25 / 4 = 6.25 → 6
    baseSpeed: 45,     // 기본 속도
    growthHp: 5,       // 15 / 3 = 5
    growthAttack: 1,   // 5 / 4 = 1.25 → 1
    growthSpeed: 5,    // 레벨당 속도 증가량
    description: "민첩한 검사",
    element: "바람",
    rarity: "일반"
  },
  "피에나": {
    name: "피에나",
    baseHp: 33,        // 100 / 3 = 33.33 → 33
    baseAttack: 5,     // 20 / 4 = 5
    baseSpeed: 25,     // 기본 속도
    growthHp: 6,       // 18 / 3 = 6
    growthAttack: 1,   // 4 / 4 = 1
    growthSpeed: 5,    // 레벨당 속도 증가량
    description: "강인한 방패병",
    element: "땅",
    rarity: "일반"
  },
  "애비게일": {
    name: "애비게일",
    baseHp: 23,        // 70 / 3 = 23.33 → 23
    baseAttack: 8,     // 30 / 4 = 7.5 → 8
    baseSpeed: 40,     // 기본 속도
    growthHp: 4,       // 12 / 3 = 4
    growthAttack: 2,   // 6 / 4 = 1.5 → 2
    growthSpeed: 5,    // 레벨당 속도 증가량
    description: "화염 마법사",
    element: "불",
    rarity: "희귀"
  },
  "림스&베리": {
    name: "림스&베리",
    baseHp: 30,        // 90 / 3 = 30
    baseAttack: 6,     // 22 / 4 = 5.5 → 6
    baseSpeed: 50,     // 기본 속도
    growthHp: 5,       // 16 / 3 = 5.33 → 5
    growthAttack: 1,   // 5 / 4 = 1.25 → 1
    growthSpeed: 5,    // 레벨당 속도 증가량
    description: "쌍둥이 궁수",
    element: "바람",
    rarity: "희귀"
  },
  "클로에": {
    name: "클로에",
    baseHp: 20,        // 60 / 3 = 20
    baseAttack: 9,     // 35 / 4 = 8.75 → 9
    baseSpeed: 65,     // 기본 속도 (암살자는 빠름)
    growthHp: 3,       // 10 / 3 = 3.33 → 3
    growthAttack: 2,   // 7 / 4 = 1.75 → 2
    growthSpeed: 5,    // 레벨당 속도 증가량
    description: "암살자",
    element: "어둠",
    rarity: "전설"
  },
  "나하트라": {
    name: "나하트라",
    baseHp: 40,        // 120 / 3 = 40
    baseAttack: 7,     // 28 / 4 = 7
    baseSpeed: 30,     // 기본 속도 (용족은 느림)
    growthHp: 7,       // 20 / 3 = 6.67 → 7
    growthAttack: 2,   // 6 / 4 = 1.5 → 2
    growthSpeed: 5,    // 레벨당 속도 증가량
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
