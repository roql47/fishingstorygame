/**
 * 🎮 게임 데이터 관리 커스텀 훅
 * 변수 초기화 순서 문제를 근본적으로 해결
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  getFishData, 
  getFishHealthData, 
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
    fishPrefixes: [],
    shopData: { fishing_rod: [], accessories: [] }
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
        
        const [fishData, fishHealthData, probabilityData, prefixData, shopData] = await Promise.all([
          getFishData(),
          getFishHealthData(),
          getProbabilityData(),
          getPrefixData(),
          getShopData()
        ]);
        
        setGameData({
          probabilityTemplate: probabilityData || [40, 24, 15, 8, 5, 3, 2, 1, 0.7, 0.3],
          allFishTypes: fishData || [],
          fishHealthMap: fishHealthData || {},
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
    
    let basePrice = fishData.price;
    
    // 악세사리 효과: 각 악세사리마다 8% 증가
    if (userEquipment.accessory) {
      const accessoryItems = shopData.accessories || [];
      const equippedAccessory = accessoryItems.find(item => item.name === userEquipment.accessory);
      if (equippedAccessory) {
        // 악세사리 레벨에 따른 가격 증가 (레벨당 8%)
        const bonusMultiplier = 1 + (equippedAccessory.requiredSkill + 1) * 0.08;
        basePrice = Math.floor(basePrice * bonusMultiplier);
      }
    }
    
    return basePrice;
  }, [allFishTypes, shopData.accessories]);
  
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
    return fishData ? fishData.name : null;
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
    
    return fishPrefixes[0]; // 기본값
  }, [fishPrefixes]);
  
  // 🚀 상점 아이템 조회 함수
  const getAllShopItems = useCallback(() => {
    return shopData || { fishing_rod: [], accessories: [] };
  }, [shopData]);
  
  // 🚀 현재 구매 가능한 아이템 함수 (단일 아이템 반환)
  const getAvailableShopItem = useCallback((category, fishingSkill = 0, userEquipment = {}) => {
    const allItems = getAllShopItems()[category] || [];
    
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
    }
    
    // 구매 가능하고 현재 아이템보다 높은 레벨의 아이템들 필터링
    const availableItems = allItems.filter(item => 
      fishingSkill >= item.requiredSkill && item.requiredSkill > currentItemLevel
    );
    
    // 가장 낮은 레벨의 아이템 반환 (다음 업그레이드 대상)
    const nextItem = availableItems.length > 0 ? availableItems[0] : null;
    
    // 🔧 안전한 기본값 보장
    if (nextItem && nextItem.price === undefined) {
      nextItem.price = 0;
    }
    
    return nextItem;
  }, [getAllShopItems]);
  
  return {
    // 상태
    isLoading,
    error,
    
    // 기본 데이터
    probabilityTemplate,
    allFishTypes,
    fishHealthMap,
    fishPrefixes,
    shopData,
    
    // 유틸리티 함수들
    getAvailableFish,
    getFishPrice,
    getFishMaterial,
    getMaterialToFish,
    selectFishPrefix,
    getAllShopItems,
    getAvailableShopItem
  };
};
