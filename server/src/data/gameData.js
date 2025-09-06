// 🔒 서버 사이드 게임 데이터 (클라이언트에서 접근 불가)

// 물고기 데이터
const FISH_DATA = [
  { name: "타코문어", price: 300, material: "문어다리", rank: 1 },
  { name: "풀고등어", price: 700, material: "고등어비늘", rank: 2 },
  { name: "경단붕어", price: 1500, material: "당고", rank: 3 },
  { name: "버터오징어", price: 8000, material: "버터조각", rank: 4 },
  { name: "간장새우", price: 15000, material: "간장종지", rank: 5 },
  { name: "물수수", price: 30000, material: "옥수수콘", rank: 6 },
  { name: "정어리파이", price: 40000, material: "버터", rank: 7 },
  { name: "얼음상어", price: 50000, material: "얼음조각", rank: 8 },
  { name: "스퀄스퀴드", price: 60000, material: "오징어먹물", rank: 9 },
  { name: "백년송거북", price: 100000, material: "백년송", rank: 10 },
  { name: "고스피쉬", price: 150000, material: "후춧가루", rank: 11 },
  { name: "유령치", price: 230000, material: "석화", rank: 12 },
  { name: "바이트독", price: 470000, material: "핫소스", rank: 13 },
  { name: "호박고래", price: 700000, material: "펌킨조각", rank: 14 },
  { name: "바이킹조개", price: 1250000, material: "꽃술", rank: 15 },
  { name: "천사해파리", price: 2440000, material: "프레첼", rank: 16 },
  { name: "악마복어", price: 4100000, material: "베놈", rank: 17 },
  { name: "칠성장어", price: 6600000, material: "장어꼬리", rank: 18 },
  { name: "닥터블랙", price: 9320000, material: "아인스바인", rank: 19 },
  { name: "해룡", price: 14400000, material: "헤븐즈서펀트", rank: 20 },
  { name: "메카핫킹크랩", price: 27950000, material: "집게다리", rank: 21 },
  { name: "램프리", price: 46400000, material: "이즈니버터", rank: 22 },
  { name: "마지막잎새", price: 76500000, material: "라벤더오일", rank: 23 },
  { name: "아이스브리더", price: 131200000, material: "샤베트", rank: 24 },
  { name: "해신", price: 288000000, material: "마법의정수", rank: 25 },
  { name: "핑키피쉬", price: 418600000, material: "마법의돌", rank: 26 },
  { name: "콘토퍼스", price: 931560000, material: "마법의돌", rank: 27 },
  { name: "딥원", price: 1326400000, material: "마법의돌", rank: 28 },
  { name: "큐틀루", price: 2088000000, material: "마법의돌", rank: 29 },
  { name: "꽃술나리", price: 3292000000, material: "마법의돌", rank: 30 },
  { name: "다무스", price: 7133200000, material: "마법의돌", rank: 31 },
  { name: "수호자", price: 15512000000, material: "마법의돌", rank: 32 },
  { name: "태양가사리", price: 29360000000, material: "마법의돌", rank: 33 },
  { name: "빅파더펭귄", price: 48876000000, material: "마법의돌", rank: 34 },
  { name: "크레인터틀", price: 87124000000, material: "마법의돌", rank: 35 },
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

// 확률 템플릿 데이터
const PROBABILITY_DATA = [40, 24, 15, 8, 5, 3, 2, 1, 0.7, 0.3];

// 접두어 데이터
const PREFIX_DATA = [
  { name: '거대한', probability: 70, hpMultiplier: 1.0, amberMultiplier: 1.0 },
  { name: '변종', probability: 20, hpMultiplier: 1.5, amberMultiplier: 1.5 },
  { name: '심연의', probability: 7, hpMultiplier: 2.4, amberMultiplier: 3.0 },
  { name: '깊은어둠의', probability: 3, hpMultiplier: 3.9, amberMultiplier: 5.0 }
];

// 상점 데이터
const SHOP_DATA = {
  fishing_rod: [
    { name: '낡은낚시대', price: 10000, description: '오래된 낚시대입니다', requiredSkill: 0 },
    { name: '기본낚시대', price: 50000, description: '기본적인 낚시대입니다', requiredSkill: 1 },
    { name: '단단한낚시대', price: 140000, description: '견고한 낚시대입니다', requiredSkill: 2 },
    { name: '은낚시대', price: 370000, description: '은으로 만든 고급 낚시대입니다', requiredSkill: 3 },
    { name: '금낚시대', price: 820000, description: '금으로 만든 최고급 낚시대입니다', requiredSkill: 4 },
    { name: '강철낚시대', price: 2390000, description: '강철로 제련된 견고한 낚시대입니다', requiredSkill: 5 },
    { name: '사파이어낚시대', price: 6100000, description: '사파이어가 박힌 신비로운 낚시대입니다', requiredSkill: 6 },
    { name: '루비낚시대', price: 15000000, description: '루비의 힘이 깃든 화려한 낚시대입니다', requiredSkill: 7 },
    { name: '다이아몬드낚시대', price: 45000000, description: '다이아몬드의 광채가 빛나는 낚시대입니다', requiredSkill: 8 },
    { name: '레드다이아몬드낚시대', price: 100000000, description: '희귀한 레드다이아몬드로 만든 전설적인 낚시대입니다', requiredSkill: 9 },
    { name: '벚꽃낚시대', price: 300000000, description: '벚꽃의 아름다움을 담은 환상적인 낚시대입니다', requiredSkill: 10 },
    { name: '꽃망울낚시대', price: 732000000, description: '꽃망울처럼 생긴 신비한 낚시대입니다', requiredSkill: 11 },
    { name: '호롱불낚시대', price: 1980000000, description: '호롱불처럼 따뜻한 빛을 내는 낚시대입니다', requiredSkill: 12 },
    { name: '산고등낚시대', price: 4300000000, description: '바다 깊은 곳의 산고로 만든 낚시대입니다', requiredSkill: 13 },
    { name: '피크닉', price: 8800000000, description: '즐거운 피크닉 분위기의 특별한 낚시대입니다', requiredSkill: 14 },
    { name: '마녀빗자루', price: 25000000000, description: '마녀의 마법이 깃든 신비로운 빗자루 낚시대입니다', requiredSkill: 15 },
    { name: '에테르낚시대', price: 64800000000, description: '에테르의 힘으로 만들어진 초월적인 낚시대입니다', requiredSkill: 16 },
    { name: '별조각낚시대', price: 147600000000, description: '별의 조각으로 만든 우주적인 낚시대입니다', requiredSkill: 17 },
    { name: '여우꼬리낚시대', price: 320000000000, description: '여우의 꼬리처럼 유연한 신비한 낚시대입니다', requiredSkill: 18 },
    { name: '초콜릿롤낚시대', price: 780000000000, description: '달콤한 초콜릿롤 모양의 귀여운 낚시대입니다', requiredSkill: 19 },
    { name: '호박유령낚시대', price: 2800000000000, description: '호박 속 유령의 힘이 깃든 무서운 낚시대입니다', requiredSkill: 20 },
    { name: '핑크버니낚시대', price: 6100000000000, description: '핑크빛 토끼의 귀여움이 담긴 낚시대입니다', requiredSkill: 21 },
    { name: '할로우낚시대', price: 15100000000000, description: '할로윈의 신비로운 힘이 깃든 낚시대입니다', requiredSkill: 22 },
    { name: '여우불낚시대', price: 40400000000000, description: '여우불의 환상적인 힘을 지닌 최고급 낚시대입니다', requiredSkill: 23 }
  ],
  accessories: [
    { name: '오래된반지', price: 10, currency: 'amber', description: '낡았지만 의미있는 반지입니다', requiredSkill: 0 },
    { name: '은목걸이', price: 25, currency: 'amber', description: '은으로 만든 아름다운 목걸이입니다', requiredSkill: 1 },
    { name: '금귀걸이', price: 50, currency: 'amber', description: '금으로 만든 화려한 귀걸이입니다', requiredSkill: 2 },
    { name: '마법의펜던트', price: 80, currency: 'amber', description: '마법의 힘이 깃든 신비한 펜던트입니다', requiredSkill: 3 },
    { name: '에메랄드브로치', price: 120, currency: 'amber', description: '에메랄드가 박힌 고급스러운 브로치입니다', requiredSkill: 4 },
    { name: '토파즈이어링', price: 180, currency: 'amber', description: '토파즈의 빛이 아름다운 이어링입니다', requiredSkill: 5 },
    { name: '자수정팔찌', price: 250, currency: 'amber', description: '자수정으로 만든 우아한 팔찌입니다', requiredSkill: 6 },
    { name: '백금티아라', price: 350, currency: 'amber', description: '백금으로 제작된 고귀한 티아라입니다', requiredSkill: 7 },
    { name: '만드라고라허브', price: 500, currency: 'amber', description: '신비한 만드라고라 허브입니다', requiredSkill: 8 },
    { name: '에테르나무묘목', price: 700, currency: 'amber', description: '에테르 나무의 신비한 묘목입니다', requiredSkill: 9 },
    { name: '몽마의조각상', price: 1000, currency: 'amber', description: '몽마의 힘이 깃든 신비한 조각상입니다', requiredSkill: 10 },
    { name: '마카롱훈장', price: 1500, currency: 'amber', description: '달콤한 마카롱 모양의 특별한 훈장입니다', requiredSkill: 11 },
    { name: '빛나는마력순환체', price: 2000, currency: 'amber', description: '마력이 순환하는 빛나는 신비한 구슬입니다', requiredSkill: 12 }
  ]
};

// 데이터 접근 함수들
const getFishData = () => FISH_DATA;
const getFishHealthData = () => FISH_HEALTH_DATA;
const getProbabilityData = () => PROBABILITY_DATA;
const getPrefixData = () => PREFIX_DATA;
const getShopData = () => SHOP_DATA;

// 특정 물고기 정보 조회
const getFishByName = (name) => {
  return FISH_DATA.find(fish => fish.name === name);
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
  getProbabilityData,
  getPrefixData,
  getShopData,
  getFishByName,
  getAvailableFishBySkill,
  getShopItemsByCategory
};
