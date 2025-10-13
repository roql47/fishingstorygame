/**
 * 🛒 상점 탭 컴포넌트
 * 낚시대와 악세서리 구매 기능
 */

import React, { useState, useEffect } from 'react';
import { ShoppingCart, Coins, Gem, Star, Fish, Diamond, Package } from 'lucide-react';
import { getFishData } from '../data/gameData';

const ShopTab = ({
  // 상태
  isDarkMode,
  userMoney,
  userAmber,
  userStarPieces,
  materials,
  userEquipment,
  fishingSkill,
  
  // 함수
  getAllShopItems,
  buyItem,
  exchangeEtherKeys
}) => {
  const [activeShopTab, setActiveShopTab] = useState('equipment'); // equipment, items
  const [fishData, setFishData] = useState([]);
  
  // 물고기 데이터 가져오기
  useEffect(() => {
    const loadFishData = async () => {
      try {
        const data = await getFishData();
        setFishData(data);
      } catch (error) {
        console.error('Failed to load fish data:', error);
      }
    };
    loadFishData();
  }, []);
  
  // 재료 수량 가져오기 함수
  const getMaterialCount = (materialName) => {
    // 별조각인 경우 userStarPieces에서 가져오기
    if (materialName === '별조각') {
      return userStarPieces || 0;
    }
    // 일반 재료는 materials 배열에서 찾기
    const material = materials?.find(m => m.material === materialName);
    return material?.count || 0;
  };
  
  // 재료의 랭크 가져오기 함수
  const getMaterialRank = (materialName) => {
    const fish = fishData.find(f => f.material === materialName);
    return fish?.rank || 0;
  };
  
  // 💰 필요한 골드 계산 함수 (재료 물고기 판매가의 1/10)
  const calculateRequiredGold = (materialName, materialCount) => {
    const fish = fishData.find(f => f.material === materialName);
    if (!fish) return 0;
    return Math.floor((fish.price / 10) * materialCount);
  };
  
  // 구매 가능 여부 체크 함수
  const canPurchaseItem = (item, category) => {
    const allItems = getAllShopItems(category);
    
    // 현재 장착된 아이템의 레벨 확인
    let currentItemLevel = -1;
    if (category === 'fishing_rod' && userEquipment?.fishingRod) {
      const currentItem = allItems.find(i => i.name === userEquipment.fishingRod);
      if (currentItem) {
        currentItemLevel = currentItem.requiredSkill;
      }
    } else if (category === 'accessories' && userEquipment?.accessory) {
      const currentItem = allItems.find(i => i.name === userEquipment.accessory);
      if (currentItem) {
        currentItemLevel = currentItem.requiredSkill;
      }
    }
    
    // 순차 구매: 현재 아이템보다 바로 다음 레벨만 구매 가능
    return item.requiredSkill === (currentItemLevel + 1);
  };

  return (
    <div className={`rounded-2xl board-shadow min-h-full flex flex-col ${
      isDarkMode ? "glass-card" : "bg-white/80 backdrop-blur-md border border-gray-300/30"
    }`}>
      {/* 상점 헤더 */}
      <div className={`border-b p-4 ${
        isDarkMode ? "border-white/10" : "border-gray-300/20"
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20">
              <ShoppingCart className={`w-4 h-4 ${
                isDarkMode ? "text-purple-400" : "text-purple-600"
              }`} />
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${
                isDarkMode ? "text-white" : "text-gray-800"
              }`}>장비 상점</h2>
              <p className={`text-xs ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}>낚시 장비와 악세서리를 구매하세요</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border ${
              isDarkMode ? "border-yellow-400/20" : "border-yellow-500/30"
            }`}>
              <Coins className={`w-4 h-4 ${
                isDarkMode ? "text-yellow-400" : "text-yellow-600"
              }`} />
              <span className={`text-sm font-bold ${
                isDarkMode ? "text-yellow-400" : "text-yellow-600"
              }`}>{(userMoney || 0).toLocaleString()}</span>
              <span className={`text-xs ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}>골드</span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-orange-500/20 to-amber-500/20 border ${
              isDarkMode ? "border-orange-400/20" : "border-orange-500/30"
            }`}>
              <Gem className={`w-4 h-4 ${
                isDarkMode ? "text-orange-400" : "text-orange-600"
              }`} />
              <span className={`text-sm font-bold ${
                isDarkMode ? "text-orange-400" : "text-orange-600"
              }`}>{(userAmber || 0).toLocaleString()}</span>
              <span className={`text-xs ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}>호박석</span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 border ${
              isDarkMode ? "border-blue-400/20" : "border-blue-500/30"
            }`}>
              <Star className={`w-4 h-4 ${
                isDarkMode ? "text-blue-400" : "text-blue-600"
              }`} />
              <span className={`text-sm font-bold ${
                isDarkMode ? "text-blue-400" : "text-blue-600"
              }`}>{(userStarPieces || 0).toLocaleString()}</span>
              <span className={`text-xs ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}>별조각</span>
            </div>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className={`border-b px-4 ${
        isDarkMode ? "border-white/10" : "border-gray-300/20"
      }`}>
        <div className="flex gap-1">
          <button
            onClick={() => setActiveShopTab('equipment')}
            className={`flex items-center gap-2 px-4 py-3 rounded-t-lg transition-all duration-300 font-medium ${
              activeShopTab === 'equipment'
                ? isDarkMode
                  ? "bg-blue-500/20 text-blue-400 border-b-2 border-blue-400"
                  : "bg-blue-500/10 text-blue-600 border-b-2 border-blue-500"
                : isDarkMode
                  ? "text-gray-400 hover:text-gray-300 hover:bg-white/5"
                  : "text-gray-600 hover:text-gray-800 hover:bg-gray-100/50"
            }`}
          >
            <Fish className="w-4 h-4" />
            <span>장비</span>
          </button>
          <button
            onClick={() => setActiveShopTab('items')}
            className={`flex items-center gap-2 px-4 py-3 rounded-t-lg transition-all duration-300 font-medium ${
              activeShopTab === 'items'
                ? isDarkMode
                  ? "bg-purple-500/20 text-purple-400 border-b-2 border-purple-400"
                  : "bg-purple-500/10 text-purple-600 border-b-2 border-purple-500"
                : isDarkMode
                  ? "text-gray-400 hover:text-gray-300 hover:bg-white/5"
                  : "text-gray-600 hover:text-gray-800 hover:bg-gray-100/50"
            }`}
          >
            <Package className="w-4 h-4" />
            <span>기타</span>
          </button>
        </div>
      </div>
      
      {/* 상점 아이템 목록 */}
      <div className="flex-1 p-4">
        {/* 장비 탭 */}
        {activeShopTab === 'equipment' && (
          <div className="space-y-6">
            {/* 낚시대 섹션 */}
            <div>
              <div className={`flex items-center gap-2 mb-4 px-2 ${
                  isDarkMode ? "text-blue-400" : "text-blue-600"
              }`}>
                <Fish className="w-5 h-5" />
                <h3 className="font-semibold text-lg">낚시대</h3>
              </div>
              <div className="space-y-4">
                {getAllShopItems('fishing_rod')
                  .filter(item => canPurchaseItem(item, 'fishing_rod'))
                  .map((item, index) => {
                  const userMaterialCount = getMaterialCount(item.material);
                  const hasEnoughMaterial = userMaterialCount >= item.materialCount;
                  const requiredGold = calculateRequiredGold(item.material, item.materialCount);
                  const hasEnoughGold = userMoney >= requiredGold;
                  const canBuy = hasEnoughMaterial && hasEnoughGold;
                  // buyItem에 전달할 때 필요한 골드 정보 추가
                  const itemWithGold = { ...item, requiredGold, category: 'fishing_rod' };
                  const materialRank = getMaterialRank(item.material);
                  
                  return (
                    <div key={index} className={`group relative overflow-hidden rounded-2xl transition-all duration-300 ${
                      isDarkMode 
                        ? "bg-gradient-to-br from-blue-500/15 via-blue-500/10 to-transparent border border-blue-500/30 hover:border-blue-400/50" 
                        : "bg-gradient-to-br from-blue-50 via-white to-transparent border border-blue-200 hover:border-blue-300"
                    }`}>
                      {/* 배경 장식 효과 */}
                      <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 ${
                        isDarkMode ? "bg-blue-500" : "bg-blue-300"
                      }`}></div>
                      
                      <div className="relative p-5">
                        <div className="flex items-start gap-4 mb-4">
                          {/* 아이콘 */}
                          <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${
                            isDarkMode 
                              ? "bg-gradient-to-br from-blue-500/30 to-blue-600/20" 
                              : "bg-gradient-to-br from-blue-400/20 to-blue-500/10"
                          }`}>
                            <Fish className={`w-7 h-7 ${isDarkMode ? "text-blue-300" : "text-blue-600"}`} />
                          </div>
                          
                          {/* 아이템 정보 */}
                          <div className="flex-1 min-w-0">
                            <h4 className={`text-lg font-bold mb-1 ${
                              isDarkMode ? "text-white" : "text-gray-900"
                            }`}>{item.name}</h4>
                            <p className={`text-sm leading-relaxed ${
                              isDarkMode ? "text-gray-400" : "text-gray-600"
                            }`}>{item.description}</p>
                          </div>
                        </div>
                        
                        {/* 가격 정보와 버튼 */}
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex flex-col gap-3">
                            {/* 재료 */}
                            <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${
                              isDarkMode 
                                ? "bg-gradient-to-r from-purple-500/15 to-purple-600/10 border border-purple-500/20"
                                : "bg-gradient-to-r from-purple-50 to-purple-100/50 border border-purple-200/50"
                            }`}>
                              <Package className={`w-4 h-4 flex-shrink-0 ${
                                isDarkMode ? "text-purple-400" : "text-purple-600"
                              }`} />
                              <div className="flex items-center justify-between flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm font-bold ${
                                    isDarkMode ? "text-purple-200" : "text-purple-800"
                                  }`}>{item.material}</span>
                                  <div className="flex items-center gap-1">
                                    <Star className={`w-3 h-3 ${
                                      isDarkMode ? "text-amber-400 fill-amber-400" : "text-amber-500 fill-amber-500"
                                    }`} />
                                    <span className={`text-xs font-semibold ${
                                      isDarkMode ? "text-amber-400" : "text-amber-600"
                                    }`}>Lv.{materialRank}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs">
                                  <span className={hasEnoughMaterial 
                                    ? isDarkMode ? "text-emerald-400 font-semibold" : "text-emerald-600 font-semibold"
                                    : isDarkMode ? "text-red-400 font-semibold" : "text-red-500 font-semibold"
                                  }>
                                    {userMaterialCount}
                                  </span>
                                  <span className={isDarkMode ? "text-gray-500" : "text-gray-400"}>/</span>
                                  <span className={`font-semibold ${isDarkMode ? "text-purple-300" : "text-purple-600"}`}>
                                    {item.materialCount}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            {/* 골드 */}
                            <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${
                              isDarkMode 
                                ? "bg-gradient-to-r from-yellow-500/15 to-amber-600/10 border border-yellow-500/20"
                                : "bg-gradient-to-r from-yellow-50 to-amber-100/50 border border-yellow-200/50"
                            }`}>
                              <Coins className={`w-4 h-4 flex-shrink-0 ${
                                isDarkMode ? "text-yellow-400" : "text-yellow-600"
                              }`} />
                              <div className="flex items-center gap-1.5 flex-1">
                                <span className={`text-sm font-bold ${
                                  hasEnoughGold 
                                    ? isDarkMode ? "text-emerald-400" : "text-emerald-600"
                                    : isDarkMode ? "text-red-400" : "text-red-500"
                                }`}>
                                  {userMoney.toLocaleString()}
                                </span>
                                <span className={isDarkMode ? "text-gray-500" : "text-gray-400"}>/</span>
                                <span className={`text-sm font-bold ${
                                  isDarkMode ? "text-yellow-200" : "text-yellow-800"
                                }`}>{requiredGold.toLocaleString()}</span>
                                <span className={`text-sm font-semibold ${
                                  isDarkMode ? "text-yellow-300" : "text-yellow-700"
                                }`}>G</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* 구매 버튼 */}
                          <button
                            onClick={() => buyItem(itemWithGold)}
                            disabled={!canBuy}
                            className={`px-6 py-3 rounded-xl font-bold text-sm transition-all duration-200 ${
                              !canBuy
                                ? isDarkMode
                                  ? "bg-gray-700 text-gray-500 cursor-not-allowed opacity-50"
                                  : "bg-gray-200 text-gray-400 cursor-not-allowed opacity-50"
                                : isDarkMode
                                  ? "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white hover:scale-105 active:scale-95"
                                  : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white hover:scale-105 active:scale-95"
                            }`}
                          >
                            구매하기
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 악세서리 섹션 */}
            <div>
              <div className={`flex items-center gap-2 mb-4 px-2 ${
                  isDarkMode ? "text-orange-400" : "text-orange-600"
              }`}>
                <Diamond className="w-5 h-5" />
                <h3 className="font-semibold text-lg">악세서리</h3>
              </div>
              <div className="space-y-4">
                {getAllShopItems('accessories')
                  .filter(item => canPurchaseItem(item, 'accessories'))
                  .map((item, index) => {
                  const userMaterialCount = getMaterialCount(item.material);
                  const hasEnoughMaterial = userMaterialCount >= item.materialCount;
                  const requiredGold = calculateRequiredGold(item.material, item.materialCount);
                  const hasEnoughGold = userMoney >= requiredGold;
                  const canBuy = hasEnoughMaterial && hasEnoughGold;
                  // buyItem에 전달할 때 필요한 골드 정보 추가
                  const itemWithGold = { ...item, requiredGold, category: 'accessories' };
                  const materialRank = getMaterialRank(item.material);
                  
                  return (
                    <div key={index} className={`group relative overflow-hidden rounded-2xl transition-all duration-300 ${
                      isDarkMode 
                        ? "bg-gradient-to-br from-orange-500/15 via-orange-500/10 to-transparent border border-orange-500/30 hover:border-orange-400/50" 
                        : "bg-gradient-to-br from-orange-50 via-white to-transparent border border-orange-200 hover:border-orange-300"
                    }`}>
                      {/* 배경 장식 효과 */}
                      <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 ${
                        isDarkMode ? "bg-orange-500" : "bg-orange-300"
                      }`}></div>
                      
                      <div className="relative p-5">
                        <div className="flex items-start gap-4 mb-4">
                          {/* 아이콘 */}
                          <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${
                            isDarkMode 
                              ? "bg-gradient-to-br from-orange-500/30 to-orange-600/20" 
                              : "bg-gradient-to-br from-orange-400/20 to-orange-500/10"
                          }`}>
                            <Diamond className={`w-7 h-7 ${isDarkMode ? "text-orange-300" : "text-orange-600"}`} />
                          </div>
                          
                          {/* 아이템 정보 */}
                          <div className="flex-1 min-w-0">
                            <h4 className={`text-lg font-bold mb-1 ${
                              isDarkMode ? "text-white" : "text-gray-900"
                            }`}>{item.name}</h4>
                            <p className={`text-sm leading-relaxed ${
                              isDarkMode ? "text-gray-400" : "text-gray-600"
                            }`}>{item.description}</p>
                          </div>
                        </div>
                        
                        {/* 가격 정보와 버튼 */}
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex flex-col gap-3">
                            {/* 재료 */}
                            <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${
                              isDarkMode 
                                ? "bg-gradient-to-r from-purple-500/15 to-purple-600/10 border border-purple-500/20"
                                : "bg-gradient-to-r from-purple-50 to-purple-100/50 border border-purple-200/50"
                            }`}>
                              <Package className={`w-4 h-4 flex-shrink-0 ${
                                isDarkMode ? "text-purple-400" : "text-purple-600"
                              }`} />
                              <div className="flex items-center justify-between flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm font-bold ${
                                    isDarkMode ? "text-purple-200" : "text-purple-800"
                                  }`}>{item.material}</span>
                                  <div className="flex items-center gap-1">
                                    <Star className={`w-3 h-3 ${
                                      isDarkMode ? "text-amber-400 fill-amber-400" : "text-amber-500 fill-amber-500"
                                    }`} />
                                    <span className={`text-xs font-semibold ${
                                      isDarkMode ? "text-amber-400" : "text-amber-600"
                                    }`}>Lv.{materialRank}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs">
                                  <span className={hasEnoughMaterial 
                                    ? isDarkMode ? "text-emerald-400 font-semibold" : "text-emerald-600 font-semibold"
                                    : isDarkMode ? "text-red-400 font-semibold" : "text-red-500 font-semibold"
                                  }>
                                    {userMaterialCount}
                                  </span>
                                  <span className={isDarkMode ? "text-gray-500" : "text-gray-400"}>/</span>
                                  <span className={`font-semibold ${isDarkMode ? "text-purple-300" : "text-purple-600"}`}>
                                    {item.materialCount}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            {/* 골드 */}
                            <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${
                              isDarkMode 
                                ? "bg-gradient-to-r from-yellow-500/15 to-amber-600/10 border border-yellow-500/20"
                                : "bg-gradient-to-r from-yellow-50 to-amber-100/50 border border-yellow-200/50"
                            }`}>
                              <Coins className={`w-4 h-4 flex-shrink-0 ${
                                isDarkMode ? "text-yellow-400" : "text-yellow-600"
                              }`} />
                              <div className="flex items-center gap-1.5 flex-1">
                                <span className={`text-sm font-bold ${
                                  hasEnoughGold 
                                    ? isDarkMode ? "text-emerald-400" : "text-emerald-600"
                                    : isDarkMode ? "text-red-400" : "text-red-500"
                                }`}>
                                  {userMoney.toLocaleString()}
                                </span>
                                <span className={isDarkMode ? "text-gray-500" : "text-gray-400"}>/</span>
                                <span className={`text-sm font-bold ${
                                  isDarkMode ? "text-yellow-200" : "text-yellow-800"
                                }`}>{requiredGold.toLocaleString()}</span>
                                <span className={`text-sm font-semibold ${
                                  isDarkMode ? "text-yellow-300" : "text-yellow-700"
                                }`}>G</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* 구매 버튼 */}
                          <button
                            onClick={() => buyItem(itemWithGold)}
                            disabled={!canBuy}
                            className={`px-6 py-3 rounded-xl font-bold text-sm transition-all duration-200 ${
                              !canBuy
                                ? isDarkMode
                                  ? "bg-gray-700 text-gray-500 cursor-not-allowed opacity-50"
                                  : "bg-gray-200 text-gray-400 cursor-not-allowed opacity-50"
                                : isDarkMode
                                  ? "bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white hover:scale-105 active:scale-95"
                                  : "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white hover:scale-105 active:scale-95"
                            }`}
                          >
                            구매하기
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 기타 탭 */}
        {activeShopTab === 'items' && (
          <div className="space-y-6">
            {/* 에테르 열쇠 교환 섹션 */}
            <div>
              <div className={`flex items-center gap-2 mb-4 px-2 ${
                  isDarkMode ? "text-purple-400" : "text-purple-600"
              }`}>
                <Diamond className="w-5 h-5" />
                <h3 className="font-semibold">에테르 열쇠</h3>
              </div>
              <div className={`p-4 rounded-xl border ${
                isDarkMode 
                  ? "bg-purple-500/10 border-purple-500/30" 
                  : "bg-purple-500/5 border-purple-500/20"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${
                        isDarkMode ? "bg-purple-500/20" : "bg-purple-500/10"
                      }`}>
                        <Diamond className={`w-6 h-6 ${
                          isDarkMode ? "text-purple-400" : "text-purple-600"
                        }`} />
                      </div>
                      <div>
                        <h4 className={`font-bold ${
                          isDarkMode ? "text-white" : "text-gray-800"
                        }`}>에테르 열쇠 5개</h4>
                        <p className={`text-sm ${
                          isDarkMode ? "text-gray-400" : "text-gray-600"
                        }`}>파티던전 입장권</p>
                      </div>
                    </div>
                    <div className={`text-xs ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}>
                      파티던전을 생성하거나 참여할 때 필요한 특별한 열쇠입니다.
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                      isDarkMode 
                        ? "bg-blue-500/20 border border-blue-500/30" 
                        : "bg-blue-500/10 border border-blue-500/20"
                    }`}>
                      <Star className={`w-4 h-4 ${
                        isDarkMode ? "text-blue-400" : "text-blue-600"
                      }`} />
                      <span className={`text-sm font-bold ${
                        isDarkMode ? "text-blue-400" : "text-blue-600"
                      }`}>1</span>
                      <span className={`text-xs ${
                        isDarkMode ? "text-gray-400" : "text-gray-600"
                      }`}>별조각</span>
                    </div>
                    <button
                      onClick={() => exchangeEtherKeys()}
                      disabled={!userStarPieces || userStarPieces < 1}
                      className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                        !userStarPieces || userStarPieces < 1
                          ? isDarkMode
                            ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                            : "bg-gray-300 text-gray-500 cursor-not-allowed"
                          : isDarkMode
                            ? "bg-purple-600 hover:bg-purple-500 text-white"
                            : "bg-purple-500 hover:bg-purple-600 text-white"
                      } hover:scale-105 active:scale-95`}
                    >
                      교환하기
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 연금술포션 섹션 */}
            <div>
              <div className={`flex items-center gap-2 mb-4 px-2 ${
                  isDarkMode ? "text-green-400" : "text-green-600"
              }`}>
                <span className="text-xl">🧪</span>
                <h3 className="font-semibold">연금술포션</h3>
              </div>
              <div className="space-y-3">
                {getAllShopItems('items').map((item, index) => {
                  const userMaterialCount = getMaterialCount(item.material);
                  const hasEnoughMaterial = userMaterialCount >= item.materialCount;
                  const canBuy = hasEnoughMaterial;
                  // buyItem에 전달할 때 필요한 카테고리 정보 추가
                  const itemWithCategory = { ...item, category: 'items' };
                  
                  return (
                    <div key={index} className={`p-4 rounded-xl border ${
                      isDarkMode 
                        ? "bg-green-500/10 border-green-500/30" 
                        : "bg-green-500/5 border-green-500/20"
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className={`p-2 rounded-lg ${
                              isDarkMode ? "bg-green-500/20" : "bg-green-500/10"
                            }`}>
                              <span className="text-2xl">🧪</span>
                            </div>
                            <div>
                              <h4 className={`font-bold ${
                                isDarkMode ? "text-white" : "text-gray-800"
                              }`}>{item.name}</h4>
                              <p className={`text-sm ${
                                isDarkMode ? "text-gray-400" : "text-gray-600"
                              }`}>{item.description}</p>
                            </div>
                          </div>
                          <div className={`text-xs ${
                            isDarkMode ? "text-gray-400" : "text-gray-600"
                          }`}>
                            낚시 쿨타임을 10초로 줄여주는 신비한 포션입니다.
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                            isDarkMode 
                              ? hasEnoughMaterial
                                ? "bg-blue-500/20 border border-blue-500/30"
                                : "bg-red-500/20 border border-red-500/40"
                              : hasEnoughMaterial
                                ? "bg-blue-500/10 border border-blue-500/20"
                                : "bg-red-50 border border-red-200"
                          }`}>
                            <Star className={`w-4 h-4 ${
                              hasEnoughMaterial
                                ? isDarkMode ? "text-blue-400" : "text-blue-600"
                                : isDarkMode ? "text-red-400" : "text-red-500"
                            }`} />
                            <span className={`text-sm font-bold ${
                              hasEnoughMaterial
                                ? isDarkMode ? "text-blue-400" : "text-blue-600"
                                : isDarkMode ? "text-red-400" : "text-red-600"
                            }`}>{item.materialCount}</span>
                            <span className={`text-xs ${
                              hasEnoughMaterial
                                ? isDarkMode ? "text-gray-400" : "text-gray-600"
                                : isDarkMode ? "text-red-400" : "text-red-600"
                            }`}>{item.material}</span>
                          </div>
                          <button
                            onClick={() => buyItem(itemWithCategory)}
                            disabled={!canBuy}
                            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                              !canBuy
                                ? isDarkMode
                                  ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
                                : isDarkMode
                                  ? "bg-green-600 hover:bg-green-500 text-white"
                                  : "bg-green-500 hover:bg-green-600 text-white"
                            } hover:scale-105 active:scale-95`}
                          >
                            교환하기
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShopTab;