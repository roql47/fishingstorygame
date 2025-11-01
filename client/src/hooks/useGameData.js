/**
 * 🎮 게임 데이터 관리 커스텀 훅
 * 변수 초기화 순서 문제를 근본적으로 해결
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  getFishData, 
  getFishHealthData, 
  getFishSpeedData,
  getProbabilityData, 
  getPrefixData, 
  getShopData 
} from '../data/gameData';

export const useGameData = () => {
  // 🔒 게임 데이터 상태
  const [gameData, setGameData] = useState({
    probabilityTemplate: [40, 24, 15, 8, 5, 3, 2, 1, 0.7, 0.3],
    allFishTypes: [],
    fishHealthMap: {},
    fishSpeedMap: {},
    fishPrefixes: [],
    shopData: { fishing_rod: [], accessories: [], items: [] }
  });
  
  // 🔧 로딩 상태
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // 🚀 게임 데이터 로드
  useEffect(() => {
    const loadGameData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const [fishData, fishHealthData, fishSpeedData, probabilityData, prefixData, shopData] = await Promise.all([
          getFishData(),
          getFishHealthData(),
          getFishSpeedData(),
          getProbabilityData(),
          getPrefixData(),
          getShopData()
        ]);
        
        setGameData({
          probabilityTemplate: probabilityData || [40, 24, 15, 8, 5, 3, 2, 1, 0.7, 0.3],
          allFishTypes: fishData || [],
          fishHealthMap: fishHealthData || {},
          fishSpeedMap: fishSpeedData || {},
          fishPrefixes: prefixData || [],
          shopData: shopData || { fishing_rod: [], accessories: [] }
        });
        
      } catch (err) {
        console.error("Failed to load game data:", err);
        setError(err);
        // 기본값 유지
      } finally {
        setIsLoading(false);
      }
    };
    
    loadGameData();
  }, []);
  
  // 🔧 안전한 파생 데이터들 (useMemo로 최적화)
  const probabilityTemplate = useMemo(() => 
    gameData.probabilityTemplate || [40, 24, 15, 8, 5, 3, 2, 1, 0.7, 0.3], 
    [gameData.probabilityTemplate]
  );
  
  const allFishTypes = useMemo(() => 
    gameData.allFishTypes || [], 
    [gameData.allFishTypes]
  );
  
  const fishHealthMap = useMemo(() => 
    gameData.fishHealthMap || {}, 
    [gameData.fishHealthMap]
  );
  
  const fishPrefixes = useMemo(() => 
    gameData.fishPrefixes || [], 
    [gameData.fishPrefixes]
  );
  
  const shopData = useMemo(() => 
    gameData.shopData || { fishing_rod: [], accessories: [] }, 
    [gameData.shopData]
  );
  
  // 🚀 낚시실력에 따른 물고기 배열 반환 함수
  const getAvailableFish = useCallback((skill) => {
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
  }, [allFishTypes, probabilityTemplate]);
  
  // 🚀 물고기 판매 가격 계산 함수
  const getFishPrice = useCallback((fishName, userEquipment = {}) => {
    if (!allFishTypes.length) return 0;
    
    const fishData = allFishTypes.find(fish => fish.name === fishName);
    if (!fishData) return 0;
    
    return fishData.price;
  }, [allFishTypes]);
  
  // 🚀 물고기 분해 시 얻는 재료 함수
  const getFishMaterial = useCallback((fishName) => {
    if (!allFishTypes.length) return null;
    
    const fishData = allFishTypes.find(fish => fish.name === fishName);
    return fishData ? fishData.material : null;
  }, [allFishTypes]);
  
  // 🚀 재료와 물고기 매핑 함수
  const getMaterialToFish = useCallback((materialName) => {
    if (!allFishTypes.length) return null;
    
    const fishData = allFishTypes.find(fish => fish.material === materialName);
    return fishData || null;  // 전체 객체 반환
  }, [allFishTypes]);
  
  // 🚀 접두어 선택 함수
  const selectFishPrefix = useCallback(() => {
    // 데이터가 로드되지 않았으면 기본 접두어 반환
    if (!fishPrefixes.length) {
      return { name: '일반', hpMultiplier: 1, amberMultiplier: 1, probability: 100 };
    }
    
    const random = Math.random() * 100;
    let cumulative = 0;
    
    for (const prefix of fishPrefixes) {
      cumulative += prefix.probability;
      if (random <= cumulative) {
        return prefix;
      }
    }
  }, [fishPrefixes]);

  // 🚀 접두어별 속도 배율 반환 함수
  const getPrefixSpeedMultiplier = useCallback((prefixName) => {
    switch (prefixName) {
      case '거대한': return 1.0;
      case '변종': return 1.1;
      case '심연의': return 1.2;
      case '깊은어둠의': return 1.3;
      default: return 1.0;
    }
  }, []);
  
  // 🚀 상점 아이템 조회 함수
  const getAllShopItems = useCallback((category) => {
    const allItems = shopData || { fishing_rod: [], accessories: [] };
    
    // category가 제공되지 않으면 전체 데이터 반환
    if (!category) {
      return allItems;
    }
    
    // 특정 카테고리의 아이템 반환 (category 정보 추가)
    const categoryItems = allItems[category] || [];
    return categoryItems.map(item => ({
      ...item,
      category: category
    }));
  }, [shopData]);
  
  // 🚀 재료 이모지 반환 함수
  const getMaterialEmoji = useCallback((materialName) => {
    // 정수 아이템 목록
    const essenceItems = [
      '물의정수',
      '자연의정수',
      '바람의정수',
      '땅의정수',
      '불의정수',
      '빛의정수',
      '어둠의정수',
      '영혼의정수'
    ];
    
    // 정수 아이템이면 수정구 이모지 반환
    if (essenceItems.includes(materialName)) {
      return '🔮';
    }
    
    // 기타 재료는 기본 이모지 반환
    return '💎';
  }, []);
  
  // 🚀 현재 구매 가능한 아이템 함수 (단일 아이템 반환)
  const getAvailableShopItem = useCallback((category, fishingSkill = 0, userEquipment = {}) => {
    const allItems = getAllShopItems()[category] || [];
    
    console.log(`=== getAvailableShopItem 디버깅 ===`);
    console.log(`Category: ${category}`);
    console.log(`Fishing Skill: ${fishingSkill}`);
    console.log(`User Equipment:`, userEquipment);
    console.log(`All Items:`, allItems);
    
    // 현재 장착된 아이템의 레벨 확인
    let currentItemLevel = -1;
    if (category === 'fishing_rod' && userEquipment.fishingRod) {
      const currentItem = allItems.find(item => item.name === userEquipment.fishingRod);
      if (currentItem) {
        currentItemLevel = currentItem.requiredSkill;
      }
    } else if (category === 'accessories' && userEquipment.accessory) {
      const currentItem = allItems.find(item => item.name === userEquipment.accessory);
      if (currentItem) {
        currentItemLevel = currentItem.requiredSkill;
      }
      console.log(`Current accessory: ${userEquipment.accessory}, level: ${currentItemLevel}`);
    }
    
    // 구매 가능한 아이템들 필터링
    const availableItems = allItems.filter(item => {
      // 낚시대와 악세사리 모두 순차 구매: 현재 아이템보다 바로 다음 레벨만 구매 가능
      const canBuy = item.requiredSkill === (currentItemLevel + 1);
      
      console.log(`${item.name}: requiredSkill=${item.requiredSkill}, currentLevel=${currentItemLevel}, canBuy=${canBuy}`);
      return canBuy;
    });
    
    console.log(`Available items:`, availableItems);
    
    // 가장 낮은 레벨의 아이템 반환 (다음 업그레이드 대상)
    const nextItem = availableItems.length > 0 ? availableItems[0] : null;
    
    console.log(`Next item:`, nextItem);
    
    // 🔧 category 정보 추가
    if (nextItem) {
      nextItem.category = category;
    }
    
    return nextItem;
  }, [getAllShopItems]);
  
  return {
    // 상태
    isLoading,
    error,
    
    // 기본 데이터
    probabilityTemplate: gameData.probabilityTemplate,
    allFishTypes: gameData.allFishTypes,
    fishHealthMap: gameData.fishHealthMap,
    fishSpeedMap: gameData.fishSpeedMap,
    fishPrefixes: gameData.fishPrefixes,
    shopData: gameData.shopData,
    
    // 유틸리티 함수들
    getAvailableFish,
    getFishPrice,
    getFishMaterial,
    getMaterialToFish,
    getMaterialEmoji,
    selectFishPrefix,
    getPrefixSpeedMultiplier,
    getAllShopItems,
    getAvailableShopItem
  };
};
