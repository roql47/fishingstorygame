// 조합 레시피 데이터
// 하위 재료 3개 → 상위 재료 1개
// 상위 재료 1개 → 하위 재료 3개 (분해)

const CRAFTING_RECIPES = [
  // rank 1 → rank 2
  { 
    id: 1,
    inputMaterial: "문어다리", 
    inputCount: 3, 
    outputMaterial: "고등어비늘", 
    outputCount: 1,
    tier: 1
  },
  // rank 2 → rank 3
  { 
    id: 2,
    inputMaterial: "고등어비늘", 
    inputCount: 3, 
    outputMaterial: "당고", 
    outputCount: 1,
    tier: 2
  },
  // rank 3 → rank 4
  { 
    id: 3,
    inputMaterial: "당고", 
    inputCount: 3, 
    outputMaterial: "버터조각", 
    outputCount: 1,
    tier: 3
  },
  // rank 4 → rank 5
  { 
    id: 4,
    inputMaterial: "버터조각", 
    inputCount: 3, 
    outputMaterial: "간장종지", 
    outputCount: 1,
    tier: 4
  },
  // rank 5 → rank 6
  { 
    id: 5,
    inputMaterial: "간장종지", 
    inputCount: 3, 
    outputMaterial: "옥수수콘", 
    outputCount: 1,
    tier: 5
  },
  // rank 6 → rank 7
  { 
    id: 6,
    inputMaterial: "옥수수콘", 
    inputCount: 3, 
    outputMaterial: "버터", 
    outputCount: 1,
    tier: 6
  },
  // rank 7 → rank 8
  { 
    id: 7,
    inputMaterial: "버터", 
    inputCount: 3, 
    outputMaterial: "얼음조각", 
    outputCount: 1,
    tier: 7
  },
  // rank 8 → rank 9
  { 
    id: 8,
    inputMaterial: "얼음조각", 
    inputCount: 3, 
    outputMaterial: "오징어먹물", 
    outputCount: 1,
    tier: 8
  },
  // rank 9 → rank 10
  { 
    id: 9,
    inputMaterial: "오징어먹물", 
    inputCount: 3, 
    outputMaterial: "백년송", 
    outputCount: 1,
    tier: 9
  },
  // rank 10 → rank 11
  { 
    id: 10,
    inputMaterial: "백년송", 
    inputCount: 3, 
    outputMaterial: "후춧가루", 
    outputCount: 1,
    tier: 10
  },
  // rank 11 → rank 12
  { 
    id: 11,
    inputMaterial: "후춧가루", 
    inputCount: 3, 
    outputMaterial: "석화", 
    outputCount: 1,
    tier: 11
  },
  // rank 12 → rank 13
  { 
    id: 12,
    inputMaterial: "석화", 
    inputCount: 3, 
    outputMaterial: "핫소스", 
    outputCount: 1,
    tier: 12
  },
  // rank 13 → rank 14
  { 
    id: 13,
    inputMaterial: "핫소스", 
    inputCount: 3, 
    outputMaterial: "펌킨조각", 
    outputCount: 1,
    tier: 13
  },
  // rank 14 → rank 15
  { 
    id: 14,
    inputMaterial: "펌킨조각", 
    inputCount: 3, 
    outputMaterial: "꽃술", 
    outputCount: 1,
    tier: 14
  },
  // rank 15 → rank 16
  { 
    id: 15,
    inputMaterial: "꽃술", 
    inputCount: 3, 
    outputMaterial: "프레첼", 
    outputCount: 1,
    tier: 15
  },
  // rank 16 → rank 17
  { 
    id: 16,
    inputMaterial: "프레첼", 
    inputCount: 3, 
    outputMaterial: "베놈", 
    outputCount: 1,
    tier: 16
  },
  // rank 17 → rank 18
  { 
    id: 17,
    inputMaterial: "베놈", 
    inputCount: 3, 
    outputMaterial: "장어꼬리", 
    outputCount: 1,
    tier: 17
  },
  // rank 18 → rank 19
  { 
    id: 18,
    inputMaterial: "장어꼬리", 
    inputCount: 3, 
    outputMaterial: "아인스바인", 
    outputCount: 1,
    tier: 18
  },
  // rank 19 → rank 20
  { 
    id: 19,
    inputMaterial: "아인스바인", 
    inputCount: 3, 
    outputMaterial: "헤븐즈서펀트", 
    outputCount: 1,
    tier: 19
  },
  // rank 20 → rank 21
  { 
    id: 20,
    inputMaterial: "헤븐즈서펀트", 
    inputCount: 3, 
    outputMaterial: "집게다리", 
    outputCount: 1,
    tier: 20
  },
  // rank 21 → rank 22
  { 
    id: 21,
    inputMaterial: "집게다리", 
    inputCount: 3, 
    outputMaterial: "이즈니버터", 
    outputCount: 1,
    tier: 21
  },
  // rank 22 → rank 23
  { 
    id: 22,
    inputMaterial: "이즈니버터", 
    inputCount: 3, 
    outputMaterial: "라벤더오일", 
    outputCount: 1,
    tier: 22
  },
  // rank 23 → rank 24
  { 
    id: 23,
    inputMaterial: "라벤더오일", 
    inputCount: 3, 
    outputMaterial: "샤베트", 
    outputCount: 1,
    tier: 23
  },
  // rank 24 → rank 25
  { 
    id: 24,
    inputMaterial: "샤베트", 
    inputCount: 3, 
    outputMaterial: "마법의정수", 
    outputCount: 1,
    tier: 24
  },
  // rank 25 → rank 26
  { 
    id: 25,
    inputMaterial: "마법의정수", 
    inputCount: 3, 
    outputMaterial: "휘핑크림", 
    outputCount: 1,
    tier: 25
  },
  // rank 26 → rank 27
  { 
    id: 26,
    inputMaterial: "휘핑크림", 
    inputCount: 3, 
    outputMaterial: "와플리머신", 
    outputCount: 1,
    tier: 26
  },
  // rank 27 → rank 28
  { 
    id: 27,
    inputMaterial: "와플리머신", 
    inputCount: 3, 
    outputMaterial: "베르쥬스", 
    outputCount: 1,
    tier: 27
  },
  // rank 28 → rank 29
  { 
    id: 28,
    inputMaterial: "베르쥬스", 
    inputCount: 3, 
    outputMaterial: "안쵸비", 
    outputCount: 1,
    tier: 28
  },
  // rank 29 → rank 30
  { 
    id: 29,
    inputMaterial: "안쵸비", 
    inputCount: 3, 
    outputMaterial: "핑크멜로우", 
    outputCount: 1,
    tier: 29
  },
  // rank 30 → rank 31
  { 
    id: 30,
    inputMaterial: "핑크멜로우", 
    inputCount: 3, 
    outputMaterial: "와일드갈릭", 
    outputCount: 1,
    tier: 30
  },
  // rank 31 → rank 32
  { 
    id: 31,
    inputMaterial: "와일드갈릭", 
    inputCount: 3, 
    outputMaterial: "그루누아", 
    outputCount: 1,
    tier: 31
  },
  // rank 32 → rank 33
  { 
    id: 32,
    inputMaterial: "그루누아", 
    inputCount: 3, 
    outputMaterial: "시더플랭크", 
    outputCount: 1,
    tier: 32
  },
  // rank 33 → rank 34
  { 
    id: 33,
    inputMaterial: "시더플랭크", 
    inputCount: 3, 
    outputMaterial: "세비체", 
    outputCount: 1,
    tier: 33
  },
  // rank 34 → rank 35
  { 
    id: 34,
    inputMaterial: "세비체", 
    inputCount: 3, 
    outputMaterial: "타파스", 
    outputCount: 1,
    tier: 34
  }
];

// 재료 이름으로 레시피 찾기 (조합용)
const getCraftingRecipe = (materialName) => {
  return CRAFTING_RECIPES.find(recipe => recipe.inputMaterial === materialName);
};

// 재료 이름으로 분해 레시피 찾기 (분해용)
const getDecomposeRecipe = (materialName) => {
  return CRAFTING_RECIPES.find(recipe => recipe.outputMaterial === materialName);
};

// 모든 레시피 가져오기
const getAllRecipes = () => {
  return CRAFTING_RECIPES;
};

// 재료 이름으로 tier 찾기 (정렬용)
const getMaterialTier = (materialName) => {
  // inputMaterial로 찾기
  const inputRecipe = CRAFTING_RECIPES.find(recipe => recipe.inputMaterial === materialName);
  if (inputRecipe) return inputRecipe.tier;
  
  // outputMaterial로 찾기
  const outputRecipe = CRAFTING_RECIPES.find(recipe => recipe.outputMaterial === materialName);
  if (outputRecipe) return outputRecipe.tier + 1;
  
  // 찾지 못하면 999 반환 (맨 뒤로)
  return 999;
};

// 재료 이름으로 원형 물고기 찾기 (조합 비용 계산용)
const getSourceFishForMaterial = (materialName) => {
  const { getFishData } = require('./gameData');
  const fishData = getFishData();
  
  // 재료 이름으로 물고기 찾기
  const fish = fishData.find(f => f.material === materialName);
  return fish;
};

module.exports = {
  CRAFTING_RECIPES,
  getCraftingRecipe,
  getDecomposeRecipe,
  getAllRecipes,
  getMaterialTier,
  getSourceFishForMaterial
};
