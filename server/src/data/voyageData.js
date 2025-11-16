// 🐟 항해 시스템 물고기 데이터 (서버 측 원본)
// 클라이언트에서 조작 불가능하도록 서버에서만 관리

const VOYAGE_FISHES = [
  { rank: 1, name: '타코문어', hp: 35, attack: 4, speed: 50, baseGold: 500 },
  { rank: 2, name: '풀고등어', hp: 63, attack: 6, speed: 55, baseGold: 800 },
  { rank: 3, name: '경단붕어', hp: 98, attack: 8, speed: 60, baseGold: 1200 },
  { rank: 4, name: '버터오징어', hp: 140, attack: 11, speed: 65, baseGold: 1800 },
  { rank: 5, name: '간장새우', hp: 193, attack: 14, speed: 70, baseGold: 2500 },
  { rank: 6, name: '물수수', hp: 263, attack: 20, speed: 75, baseGold: 3500 },
  { rank: 7, name: '정어리파이', hp: 350, attack: 25, speed: 80, baseGold: 4500 },
  { rank: 8, name: '얼음상어', hp: 455, attack: 32, speed: 85, baseGold: 6000 },
  { rank: 9, name: '스퀄스퀴드', hp: 595, attack: 41, speed: 90, baseGold: 8000 },
  { rank: 10, name: '백년송거북', hp: 770, attack: 51, speed: 95, baseGold: 10500 },
  { rank: 11, name: '고스피쉬', hp: 1015, attack: 67, speed: 100, baseGold: 13500 },
  { rank: 12, name: '유령치', hp: 1295, attack: 84, speed: 105, baseGold: 17000 },
  { rank: 13, name: '바이트독', hp: 1645, attack: 109, speed: 110, baseGold: 21500 },
  { rank: 14, name: '호박고래', hp: 2100, attack: 140, speed: 115, baseGold: 27000 },
  { rank: 15, name: '바이킹조개', hp: 2660, attack: 175, speed: 120, baseGold: 34000 },
  { rank: 16, name: '천사해파리', hp: 3360, attack: 224, speed: 125, baseGold: 43000 },
  { rank: 17, name: '악마복어', hp: 4270, attack: 287, speed: 130, baseGold: 54000 },
  { rank: 18, name: '칠성장어', hp: 5390, attack: 364, speed: 135, baseGold: 68000 },
  { rank: 19, name: '닥터블랙', hp: 6790, attack: 462, speed: 140, baseGold: 86000 },
  { rank: 20, name: '해룡', hp: 8540, attack: 588, speed: 145, baseGold: 108000 },
  { rank: 21, name: '메카핫킹크랩', hp: 10780, attack: 749, speed: 150, baseGold: 136000 },
  { rank: 22, name: '램프리', hp: 13580, attack: 952, speed: 155, baseGold: 172000 },
  { rank: 23, name: '마지막잎새', hp: 17150, attack: 1211, speed: 160, baseGold: 217000 },
  { rank: 24, name: '아이스브리더', hp: 21630, attack: 1540, speed: 165, baseGold: 274000 },
  { rank: 25, name: '해신', hp: 27300, attack: 1960, speed: 170, baseGold: 345000 },
  { rank: 26, name: '핑키피쉬', hp: 34400, attack: 2490, speed: 175, baseGold: 435000 },
  { rank: 27, name: '콘토퍼스', hp: 43400, attack: 3160, speed: 180, baseGold: 548000 },
  { rank: 28, name: '딥원', hp: 54700, attack: 4010, speed: 185, baseGold: 690000 }
];

// 🔒 보안: rank로 물고기 데이터 조회
function getVoyageFishByRank(rank) {
  const fish = VOYAGE_FISHES.find(f => f.rank === rank);
  if (!fish) {
    throw new Error(`유효하지 않은 rank: ${rank}`);
  }
  return fish;
}

// 🔒 보안: 물고기 이름으로 데이터 조회 (검증용)
function getVoyageFishByName(name) {
  return VOYAGE_FISHES.find(f => f.name === name);
}

// 🔒 보안: 골드 계산 (2.5배 ~ 5배 랜덤)
function calculateVoyageReward(rank) {
  const fish = getVoyageFishByRank(rank);
  const multiplier = 2.5 + Math.random() * 2.5; // 2.5 ~ 5.0
  const gold = Math.floor(fish.baseGold * multiplier);
  
  return {
    fishName: fish.name,
    gold: gold,
    minGold: Math.floor(fish.baseGold * 2.5),
    maxGold: Math.floor(fish.baseGold * 5.0)
  };
}

// 🔒 보안: 골드가 유효한 범위인지 검증
function validateVoyageGold(rank, gold) {
  const fish = getVoyageFishByRank(rank);
  const minGold = Math.floor(fish.baseGold * 2.5);
  const maxGold = Math.floor(fish.baseGold * 5.0);
  
  // 약간의 여유를 둠 (부동소수점 오차 고려)
  return gold >= minGold - 1 && gold <= maxGold + 1;
}

// 🔒 보안: rank 유효성 검증
function isValidVoyageRank(rank) {
  return Number.isInteger(rank) && rank >= 1 && rank <= 28;
}

module.exports = {
  VOYAGE_FISHES,
  getVoyageFishByRank,
  getVoyageFishByName,
  calculateVoyageReward,
  validateVoyageGold,
  isValidVoyageRank
};

