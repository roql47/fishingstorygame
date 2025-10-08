// App.jsx의 수정된 부분만 표시

// 🔧 안전한 변수 초기화 (gameData가 로드되지 않았을 때를 대비)
const probabilityTemplate = gameData.probabilityTemplate || [];
const allFishTypes = gameData.allFishTypes || [];
const fishHealthMap = gameData.fishHealthMap || {};
const fishPrefixes = gameData.fishPrefixes || [];

// 🚀 현재 사용 가능한 물고기 배열을 useMemo로 최적화 (안전한 초기화)
const fishTypes = useMemo(() => {
  if (!allFishTypes.length || !probabilityTemplate.length) {
    return []; // 데이터가 로드되지 않았으면 빈 배열 반환
  }
  return getAvailableFish(fishingSkill);
}, [fishingSkill, allFishTypes, probabilityTemplate]);

// 낚시실력에 따른 물고기 배열 반환 (확률 배열 고정) - 안전한 처리
const getAvailableFish = (skill) => {
  // 데이터가 로드되지 않았으면 빈 배열 반환
  if (!allFishTypes.length || !probabilityTemplate.length) {
    return [];
  }
  
  // 스타피쉬 제외한 일반 물고기들
  const normalFish = allFishTypes.filter(f => f.name !== "스타피쉬");
  
  // 낚시실력에 따라 시작 인덱스만 1씩 증가 (최소 10개 유지)
  const startIndex = Math.min(skill, Math.max(0, normalFish.length - 10));
  const selectedFish = normalFish.slice(startIndex, startIndex + 10);
  
  // 고정된 확률 배열을 선택된 물고기에 적용
  const availableFish = selectedFish.map((fish, index) => ({
    ...fish,
    probability: probabilityTemplate[index] || 0.1 // 기본값 0.1%
  }));
  
  // 스타피쉬는 항상 포함 (특별한 물고기)
  const starFish = allFishTypes.find(f => f.name === "스타피쉬");
  if (starFish) {
    availableFish.push({
      ...starFish,
      probability: 1 // 스타피쉬는 항상 1%
    });
  }
  
  return availableFish;
};

// 🚀 물고기 판매 가격 정의 - useCallback으로 최적화
const getFishPrice = useCallback((fishName) => {
  if (!allFishTypes.length) return 0; // 데이터가 로드되지 않았으면 0 반환
  
  const fishData = allFishTypes.find(fish => fish.name === fishName);
  if (!fishData) return 0;
  
  return fishData.price;
}, [allFishTypes]);

// 🚀 물고기 분해 시 얻는 재료 - useCallback으로 최적화
const getFishMaterial = useCallback((fishName) => {
  if (!allFishTypes.length) return null; // 데이터가 로드되지 않았으면 null 반환
  
  const fishData = allFishTypes.find(fish => fish.name === fishName);
  return fishData ? fishData.material : null;
}, [allFishTypes]);

// 재료와 물고기 매핑 (분해 시 얻는 재료 -> 해당 물고기) - 안전한 처리
const getMaterialToFish = (materialName) => {
  if (!allFishTypes.length) return null; // 데이터가 로드되지 않았으면 null 반환
  
  const fishData = allFishTypes.find(fish => fish.material === materialName);
  return fishData ? fishData.name : null;
};
