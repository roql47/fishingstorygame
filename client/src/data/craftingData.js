// 조합 레시피 데이터
// 하위 재료 3개 → 상위 재료 1개
// 상위 재료 1개 → 하위 재료 2개 (분해)

export const CRAFTING_RECIPES = [
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
  // rank 25 이상은 모두 마법의돌로 변환
  { 
    id: 25,
    inputMaterial: "마법의정수", 
    inputCount: 3, 
    outputMaterial: "마법의돌", 
    outputCount: 1,
    tier: 25
  }
];

// 재료 이름으로 레시피 찾기 (조합용)
export const getCraftingRecipe = (materialName) => {
  return CRAFTING_RECIPES.find(recipe => recipe.inputMaterial === materialName);
};

// 재료 이름으로 분해 레시피 찾기 (분해용)
export const getDecomposeRecipe = (materialName) => {
  return CRAFTING_RECIPES.find(recipe => recipe.outputMaterial === materialName);
};

// 모든 레시피 가져오기
export const getAllRecipes = () => {
  return CRAFTING_RECIPES;
};

// 재료 이름으로 tier 찾기 (정렬용)
export const getMaterialTier = (materialName) => {
  // inputMaterial로 찾기
  const inputRecipe = CRAFTING_RECIPES.find(recipe => recipe.inputMaterial === materialName);
  if (inputRecipe) return inputRecipe.tier;
  
  // outputMaterial로 찾기
  const outputRecipe = CRAFTING_RECIPES.find(recipe => recipe.outputMaterial === materialName);
  if (outputRecipe) return outputRecipe.tier + 1;
  
  // 찾지 못하면 999 반환 (맨 뒤로)
  return 999;
};

// 두 재료 간의 조합/분해 체인 계산
export const calculateCraftingChain = (sourceMaterial, targetMaterial, targetAmount) => {
  const sourceTier = getMaterialTier(sourceMaterial);
  const targetTier = getMaterialTier(targetMaterial);
  
  // 같은 tier면 변환 불가
  if (sourceTier === targetTier || sourceTier === 999 || targetTier === 999) {
    return null;
  }
  
  const isDecompose = sourceTier > targetTier; // 분해 (상위 → 하위)
  const steps = [];
  let currentAmount = targetAmount;
  let currentMaterial = targetMaterial;
  let currentTier = targetTier;
  
  if (isDecompose) {
    // 분해: 소스 재료(높은 tier)에서 시작해서 목표 재료(낮은 tier)까지 계산
    currentMaterial = sourceMaterial;
    currentTier = sourceTier;
    let accumulatedAmount = 1; // 시작은 소스 재료 1개
    
    while (currentTier > targetTier) {
      // 현재 재료를 분해할 때 사용할 레시피 (현재 재료를 만드는 레시피)
      const recipe = CRAFTING_RECIPES.find(r => r.outputMaterial === currentMaterial);
      if (!recipe) break;
      
      // 분해 시 1개당 2개 획득
      const outputAmount = accumulatedAmount * 2;
      
      steps.push({
        fromMaterial: currentMaterial,
        toMaterial: recipe.inputMaterial,
        fromAmount: accumulatedAmount,
        toAmount: outputAmount,
        action: 'decompose'
      });
      
      currentMaterial = recipe.inputMaterial;
      accumulatedAmount = outputAmount;
      currentTier--;
    }
    
    // 최종 필요한 소스 재료 개수 계산 (역으로 계산)
    // targetAmount를 얻기 위해 필요한 소스 재료 개수
    const finalOutputAmount = accumulatedAmount; // 소스 1개로 얻을 수 있는 타겟 재료 개수
    const requiredSourceAmount = Math.ceil(targetAmount / finalOutputAmount);
    
    // 단계별 수량 재조정
    steps.forEach((step, idx) => {
      step.fromAmount = step.fromAmount * requiredSourceAmount;
      step.toAmount = step.toAmount * requiredSourceAmount;
    });
    
    return {
      isDecompose,
      sourceMaterial,
      targetMaterial,
      targetAmount,
      requiredSourceAmount,
      steps,
      isValid: currentMaterial === targetMaterial
    };
  } else {
    // 조합: 목표 재료에서 시작해서 소스 재료까지 역으로 계산
    while (currentTier > sourceTier) {
      // 현재 재료를 만들기 위해 필요한 하위 재료
      const recipe = CRAFTING_RECIPES.find(r => r.outputMaterial === currentMaterial);
      if (!recipe) break;
      
      // 필요한 하위 재료 개수 계산
      const neededAmount = currentAmount * 3;
      
      steps.unshift({
        fromMaterial: recipe.inputMaterial,
        toMaterial: currentMaterial,
        fromAmount: neededAmount,
        toAmount: currentAmount,
        action: 'craft'
      });
      
      currentMaterial = recipe.inputMaterial;
      currentAmount = neededAmount;
      currentTier--;
    }
  }
  
  // 최종 필요한 소스 재료 개수
  const requiredSourceAmount = currentAmount;
  
  return {
    isDecompose,
    sourceMaterial,
    targetMaterial,
    targetAmount,
    requiredSourceAmount,
    steps,
    isValid: currentMaterial === sourceMaterial
  };
};

// 모든 재료 리스트 가져오기 (tier 순서대로)
export const getAllMaterials = () => {
  const materials = new Set();
  
  CRAFTING_RECIPES.forEach(recipe => {
    materials.add(recipe.inputMaterial);
    materials.add(recipe.outputMaterial);
  });
  
  return Array.from(materials).sort((a, b) => {
    return getMaterialTier(a) - getMaterialTier(b);
  });
};