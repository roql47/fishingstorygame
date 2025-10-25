// 🔒 서버 사이드 게임 데이터 (클라이언트에서 접근 불가)

// 물고기 데이터
const FISH_DATA = [
  { name: "타코문어", price: 300, material: "문어다리", rank: 1 },
  { name: "풀고등어", price: 700, material: "고등어비늘", rank: 2 },
  { name: "경단붕어", price: 1200, material: "당고", rank: 3 },
  { name: "버터오징어", price: 1800, material: "버터조각", rank: 4 },
  { name: "간장새우", price: 3000, material: "간장종지", rank: 5 },
  { name: "물수수", price: 5000, material: "옥수수콘", rank: 6 },
  { name: "정어리파이", price: 8000, material: "버터", rank: 7 },
  { name: "얼음상어", price: 12000, material: "얼음조각", rank: 8 },
  { name: "스퀄스퀴드", price: 18000, material: "오징어먹물", rank: 9 },
  { name: "백년송거북", price: 30000, material: "백년송", rank: 10 },
  { name: "고스피쉬", price: 47000, material: "후춧가루", rank: 11 },
  { name: "유령치", price: 72000, material: "석화", rank: 12 },
  { name: "바이트독", price: 98000, material: "핫소스", rank: 13 },
  { name: "호박고래", price: 133000, material: "펌킨조각", rank: 14 },
  { name: "바이킹조개", price: 176000, material: "꽃술", rank: 15 },
  { name: "천사해파리", price: 239000, material: "프레첼", rank: 16 },
  { name: "악마복어", price: 290000, material: "베놈", rank: 17 },
  { name: "칠성장어", price: 355000, material: "장어꼬리", rank: 18 },
  { name: "닥터블랙", price: 432000, material: "아인스바인", rank: 19 },
  { name: "해룡", price: 521000, material: "헤븐즈서펀트", rank: 20 },
  { name: "메카핫킹크랩", price: 735000, material: "집게다리", rank: 21 },
  { name: "램프리", price: 860000, material: "이즈니버터", rank: 22 },
  { name: "마지막잎새", price: 997000, material: "라벤더오일", rank: 23 },
  { name: "아이스브리더", price: 1146000, material: "샤베트", rank: 24 },
  { name: "해신", price: 1307000, material: "마법의정수", rank: 25 },
  { name: "핑키피쉬", price: 1480000, material: "휘핑크림", rank: 26 },
  { name: "콘토퍼스", price: 1665000, material: "와플리머신", rank: 27 },
  { name: "딥원", price: 1862000, material: "베르쥬스", rank: 28 },
  { name: "큐틀루", price: 2071000, material: "안쵸비", rank: 29 },
  { name: "꽃술나리", price: 2283000, material: "핑크멜로우", rank: 30 },
  { name: "다무스", price: 2507000, material: "와일드갈릭", rank: 31 },
  { name: "수호자", price: 2743000, material: "그루누아", rank: 32 },
  { name: "태양가사리", price: 2991000, material: "시더플랭크", rank: 33 },
  { name: "빅파더펭귄", price: 3251000, material: "세비체", rank: 34 },
  { name: "크레인터틀", price: 3523000, material: "타파스", rank: 35 },
  { name: "스타피쉬", price: 100, material: "별조각", rank: 0 }
];

// 물고기 체력 데이터
const FISH_HEALTH_DATA = {
  "타코문어": 15,
  "풀고등어": 25,
  "경단붕어": 35,
  "버터오징어": 55,
  "간장새우": 80,
  "물수수": 115,
  "정어리파이": 160,
  "얼음상어": 215,
  "스퀄스퀴드": 280,
  "백년송거북": 355,
  "고스피쉬": 440,
  "유령치": 525,
  "바이트독": 640,
  "호박고래": 755,
  "바이킹조개": 880,
  "천사해파리": 1015,
  "악마복어": 1160,
  "칠성장어": 1315,
  "닥터블랙": 1480,
  "해룡": 1655,
  "메카핫킹크랩": 1840,
  "램프리": 2035,
  "마지막잎새": 2240,
  "아이스브리더": 2455,
  "해신": 2680,
  "핑키피쉬": 2915,
  "콘토퍼스": 3160,
  "딥원": 3415,
  "큐틀루": 3680,
  "꽃술나리": 3955,
  "다무스": 4240,
  "수호자": 4535,
  "태양가사리": 4840,
  "빅파더펭귄": 5155,
  "크레인터틀": 5480
};

// 물고기 속도 데이터 (랭크 기반)
const FISH_SPEED_DATA = {
  "타코문어": 20,      // rank 1
  "풀고등어": 25,      // rank 2
  "경단붕어": 30,      // rank 3
  "버터오징어": 35,    // rank 4
  "간장새우": 40,      // rank 5
  "물수수": 45,        // rank 6
  "정어리파이": 50,    // rank 7
  "얼음상어": 55,      // rank 8
  "스퀄스퀴드": 60,    // rank 9
  "백년송거북": 65,    // rank 10 (거북이는 느림)
  "고스피쉬": 70,      // rank 11
  "유령치": 75,        // rank 12 (유령은 빠름)
  "바이트독": 80,      // rank 13
  "호박고래": 85,      // rank 14 (고래는 느림)
  "바이킹조개": 90,    // rank 15
  "천사해파리": 95,    // rank 16 (해파리는 빠름)
  "악마복어": 100,      // rank 17
  "칠성장어": 105,      // rank 18 (장어는 빠름)
  "닥터블랙": 110,      // rank 19
  "해룡": 115,         // rank 20 (용은 매우 빠름)
  "메카핫킹크랩": 120,  // rank 21 (기계 게는 보통)
  "램프리": 125,       // rank 22
  "마지막잎새": 130,   // rank 23
  "아이스브리더": 135, // rank 24
  "해신": 140,         // rank 25
  "핑키피쉬": 145,     // rank 26
  "콘토퍼스": 150,     // rank 27
  "딥원": 155,         // rank 28
  "큐틀루": 160,       // rank 29
  "꽃술나리": 165,     // rank 30
  "다무스": 170,       // rank 31
  "수호자": 175,       // rank 32
  "태양가사리": 180,   // rank 33
  "빅파더펭귄": 185,    // rank 34 (펭귄은 느림)
  "크레인터틀": 190     // rank 35 (거북이는 매우 느림)
};

// 확률 템플릿 데이터
const PROBABILITY_DATA = [40, 24, 15, 8, 5, 3, 2, 1, 0.7, 0.3];

// 접두어 데이터
const PREFIX_DATA = [
  { name: '거대한', probability: 70, hpMultiplier: 1.0, amberMultiplier: 1.0 },
  { name: '변종', probability: 20, hpMultiplier: 1.5, amberMultiplier: 1.2 },
  { name: '심연의', probability: 7, hpMultiplier: 2.4, amberMultiplier: 1.4 },
  { name: '깊은어둠의', probability: 3, hpMultiplier: 3.9, amberMultiplier: 1.8 }
];

// 상점 데이터 (재료 기반 구매 시스템 - 인덱스별 3n개)
const SHOP_DATA = {
  fishing_rod: [
    { name: '낡은낚시대', material: '간장종지', materialCount: 5, description: '오래된 낚시대입니다', requiredSkill: 0 },
    { name: '기본낚시대', material: '옥수수콘', materialCount: 10, description: '기본적인 낚시대입니다', requiredSkill: 1 },
    { name: '단단한낚시대', material: '버터', materialCount: 15, description: '견고한 낚시대입니다', requiredSkill: 2 },
    { name: '은낚시대', material: '얼음조각', materialCount: 20, description: '은으로 만든 고급 낚시대입니다', requiredSkill: 3 },
    { name: '금낚시대', material: '오징어먹물', materialCount: 25, description: '금으로 만든 최고급 낚시대입니다', requiredSkill: 4 },
    { name: '강철낚시대', material: '백년송', materialCount: 30, description: '강철로 제련된 견고한 낚시대입니다', requiredSkill: 5 },
    { name: '사파이어낚시대', material: '후춧가루', materialCount: 35, description: '사파이어가 박힌 신비로운 낚시대입니다', requiredSkill: 6 },
    { name: '루비낚시대', material: '석화', materialCount: 40, description: '루비의 힘이 깃든 화려한 낚시대입니다', requiredSkill: 7 },
    { name: '다이아몬드낚시대', material: '핫소스', materialCount: 45, description: '다이아몬드의 광채가 빛나는 낚시대입니다', requiredSkill: 8 },
    { name: '레드다이아몬드낚시대', material: '펌킨조각', materialCount: 50, description: '희귀한 레드다이아몬드로 만든 전설적인 낚시대입니다', requiredSkill: 9 },
    { name: '벚꽃낚시대', material: '꽃술', materialCount: 55, description: '벚꽃의 아름다움을 담은 환상적인 낚시대입니다', requiredSkill: 10 },
    { name: '꽃망울낚시대', material: '프레첼', materialCount: 60, description: '꽃망울처럼 생긴 신비한 낚시대입니다', requiredSkill: 11 },
    { name: '호롱불낚시대', material: '베놈', materialCount: 65, description: '호롱불처럼 따뜻한 빛을 내는 낚시대입니다', requiredSkill: 12 },
    { name: '산호등낚시대', material: '장어꼬리', materialCount: 70, description: '바다 깊은 곳의 산호로 만든 낚시대입니다', requiredSkill: 13 },
    { name: '피크닉', material: '아인스바인', materialCount: 75, description: '즐거운 피크닉 분위기의 특별한 낚시대입니다', requiredSkill: 14 },
    { name: '마녀빗자루', material: '헤븐즈서펀트', materialCount: 80, description: '마녀의 마법이 깃든 신비로운 빗자루 낚시대입니다', requiredSkill: 15 },
    { name: '에테르낚시대', material: '집게다리', materialCount: 85, description: '에테르의 힘으로 만들어진 초월적인 낚시대입니다', requiredSkill: 16 },
    { name: '별조각낚시대', material: '이즈니버터', materialCount: 90, description: '별의 조각으로 만든 우주적인 낚시대입니다', requiredSkill: 17 },
    { name: '여우꼬리낚시대', material: '라벤더오일', materialCount: 95, description: '여우의 꼬리처럼 유연한 신비한 낚시대입니다', requiredSkill: 18 },
    { name: '초콜릿롤낚시대', material: '샤베트', materialCount: 100, description: '달콤한 초콜릿롤 모양의 귀여운 낚시대입니다', requiredSkill: 19 },
    { name: '호박유령낚시대', material: '마법의정수', materialCount: 105, description: '호박 속 유령의 힘이 깃든 무서운 낚시대입니다', requiredSkill: 20 },
    { name: '핑크버니낚시대', material: '휘핑크림', materialCount: 110, description: '핑크빛 토끼의 귀여움이 담긴 낚시대입니다', requiredSkill: 21 },
    { name: '할로우낚시대', material: '와플리머신', materialCount: 115, description: '할로윈의 신비로운 힘이 깃든 낚시대입니다', requiredSkill: 22 },
    { name: '여우불낚시대', material: '베르쥬스', materialCount: 120, description: '여우불의 환상적인 힘을 지닌 최고급 낚시대입니다', requiredSkill: 23 }
  ],
  accessories: [
    { name: '오래된반지', material: '간장종지', materialCount: 10, description: '낡았지만 의미있는 반지입니다', requiredSkill: 0 },
    { name: '은목걸이', material: '옥수수콘', materialCount: 20, description: '은으로 만든 아름다운 목걸이입니다', requiredSkill: 1 },
    { name: '금귀걸이', material: '버터', materialCount: 30, description: '금으로 만든 화려한 귀걸이입니다', requiredSkill: 2 },
    { name: '마법의펜던트', material: '얼음조각', materialCount: 40, description: '마법의 힘이 깃든 신비한 펜던트입니다', requiredSkill: 3 },
    { name: '에메랄드브로치', material: '오징어먹물', materialCount: 50, description: '에메랄드가 박힌 고급스러운 브로치입니다', requiredSkill: 4 },
    { name: '토파즈이어링', material: '백년송', materialCount: 60, description: '토파즈의 빛이 아름다운 이어링입니다', requiredSkill: 5 },
    { name: '자수정팔찌', material: '후춧가루', materialCount: 70, description: '자수정으로 만든 우아한 팔찌입니다', requiredSkill: 6 },
    { name: '백금티아라', material: '석화', materialCount: 80, description: '백금으로 제작된 고귀한 티아라입니다', requiredSkill: 7 },
    { name: '만드라고라허브', material: '핫소스', materialCount: 90, description: '신비한 만드라고라 허브입니다', requiredSkill: 8 },
    { name: '에테르나무묘목', material: '펌킨조각', materialCount: 100, description: '에테르 나무의 신비한 묘목입니다', requiredSkill: 9 },
    { name: '몽마의조각상', material: '꽃술', materialCount: 110, description: '몽마의 힘이 깃든 신비한 조각상입니다', requiredSkill: 10 },
    { name: '마카롱훈장', material: '프레첼', materialCount: 120, description: '달콤한 마카롱 모양의 특별한 훈장입니다', requiredSkill: 11 },
    { name: '빛나는마력순환체', material: '베놈', materialCount: 130, description: '마력이 순환하는 빛나는 신비한 구슬입니다', requiredSkill: 12 }
  ],
  items: [
    { name: '연금술포션', material: '별조각', materialCount: 1, count: 10, description: '낚시 쿨타임을 10초로 줄여주는 신비한 포션입니다 (10개 구매)', requiredSkill: 0 }
  ]
};

// 데이터 접근 함수들
const getFishData = () => FISH_DATA;
const getFishHealthData = () => FISH_HEALTH_DATA;
const getFishSpeedData = () => FISH_SPEED_DATA;
const getProbabilityData = () => PROBABILITY_DATA;
const getPrefixData = () => PREFIX_DATA;
const getShopData = () => SHOP_DATA;

// 특정 물고기 정보 조회
const getFishByName = (name) => {
  return FISH_DATA.find(fish => fish.name === name);
};

// 재료명으로 물고기 정보 조회
const getFishByMaterial = (material) => {
  return FISH_DATA.find(fish => fish.material === material);
};

// 낚시 스킬에 따른 사용 가능한 물고기 조회
const getAvailableFishBySkill = (skill) => {
  const normalFish = FISH_DATA.filter(f => f.name !== "스타피쉬");
  const startIndex = Math.min(skill, Math.max(0, normalFish.length - 10));
  const selectedFish = normalFish.slice(startIndex, startIndex + 10);
  
  const probabilityTemplate = getProbabilityData();
  const availableFish = selectedFish.map((fish, index) => ({
    ...fish,
    probability: probabilityTemplate[index] || 0.1
  }));
  
  // 스타피쉬는 항상 포함
  const starFish = FISH_DATA.find(f => f.name === "스타피쉬");
  if (starFish) {
    availableFish.push({
      ...starFish,
      probability: 1
    });
  }
  
  return availableFish;
};

// 상점 아이템 조회 (카테고리별)
const getShopItemsByCategory = (category) => {
  return SHOP_DATA[category] || [];
};

module.exports = {
  getFishData,
  getFishHealthData,
  getFishSpeedData,
  getProbabilityData,
  getPrefixData,
  getShopData,
  getFishByName,
  getFishByMaterial,
  getAvailableFishBySkill,
  getShopItemsByCategory
};
