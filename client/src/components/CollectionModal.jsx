import React, { useState } from 'react';
import { X, Fish, Zap, Package } from 'lucide-react';

const CollectionModal = ({ 
  showCollectionModal, 
  setShowCollectionModal, 
  isDarkMode,
  inventory,
  userEquipment,
  allFishTypes
}) => {
  const [activeCollectionTab, setActiveCollectionTab] = useState('fish');

  if (!showCollectionModal) return null;

  // 낚시대 목록 (상점에서 구매 가능한 순서)
  const fishingRods = [
    { name: '나무낚시대', price: 0, description: '기본 낚시대' },
    { name: '대나무낚시대', price: 500, description: '가벼운 대나무로 만든 낚시대' },
    { name: '철제낚시대', price: 2000, description: '튼튼한 철로 만든 낚시대' },
    { name: '강화낚시대', price: 8000, description: '특수 강화된 낚시대' },
    { name: '마법낚시대', price: 25000, description: '마법의 힘이 깃든 낚시대' },
    { name: '전설낚시대', price: 80000, description: '전설 속의 낚시대' },
    { name: '신화낚시대', price: 250000, description: '신화급 낚시대' },
    { name: '초월낚시대', price: 750000, description: '모든 것을 초월한 낚시대' },
    { name: '무한낚시대', price: 2000000, description: '무한한 가능성의 낚시대' },
    { name: '창조낚시대', price: 6000000, description: '창조의 힘을 가진 낚시대' }
  ];

  // 악세사리 목록 (순차적 구매 순서)
  const accessories = [
    { name: '오래된반지', price: 1000, description: '오래된 반지' },
    { name: '은목걸이', price: 3000, description: '은으로 만든 목걸이' },
    { name: '금귀걸이', price: 8000, description: '금으로 만든 귀걸이' },
    { name: '마법의펜던트', price: 20000, description: '마법의 힘이 깃든 펜던트' },
    { name: '에메랄드브로치', price: 50000, description: '에메랄드가 박힌 브로치' },
    { name: '토파즈이어링', price: 120000, description: '토파즈가 박힌 이어링' },
    { name: '자수정팔찌', price: 280000, description: '자수정으로 만든 팔찌' },
    { name: '백금티아라', price: 650000, description: '백금으로 만든 티아라' },
    { name: '만드라고라허브', price: 1500000, description: '신비한 만드라고라 허브' },
    { name: '에테르나무묘목', price: 3500000, description: '에테르 나무의 묘목' },
    { name: '몽마의조각상', price: 8000000, description: '몽마의 힘이 깃든 조각상' },
    { name: '마카롱훈장', price: 18000000, description: '달콤한 마카롱 훈장' },
    { name: '빛나는마력순환체', price: 40000000, description: '빛나는 마력 순환체' }
  ];

  // 보유 여부 확인 함수
  const hasItem = (itemName, type) => {
    if (type === 'fishingRod') {
      return userEquipment?.fishingRod === itemName;
    } else if (type === 'accessory') {
      return userEquipment?.accessory === itemName;
    } else if (type === 'fish') {
      return inventory?.some(item => item.fish === itemName) || false;
    }
    return false;
  };

  // 물고기 수집 개수 확인
  const getFishCount = (fishName) => {
    const fishItem = inventory?.find(item => item.fish === fishName);
    return fishItem ? fishItem.count : 0;
  };

  // 컬렉션 완성도 계산
  const getCompletionRate = (type) => {
    let total = 0;
    let collected = 0;

    if (type === 'fish') {
      total = allFishTypes?.length || 0;
      collected = allFishTypes?.filter(fish => hasItem(fish.name, 'fish')).length || 0;
    } else if (type === 'fishingRod') {
      total = fishingRods.length;
      collected = fishingRods.filter(rod => hasItem(rod.name, 'fishingRod')).length;
    } else if (type === 'accessory') {
      total = accessories.length;
      collected = accessories.filter(acc => hasItem(acc.name, 'accessory')).length;
    }

    return { total, collected, percentage: total > 0 ? Math.round((collected / total) * 100) : 0 };
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`max-w-4xl w-full max-h-[90vh] rounded-2xl overflow-hidden ${
        isDarkMode 
          ? "glass-card border border-white/10" 
          : "bg-white/95 backdrop-blur-md border border-gray-300/30"
      }`}>
        {/* 헤더 */}
        <div className={`p-6 border-b ${
          isDarkMode ? "border-white/10" : "border-gray-300/20"
        }`}>
          <div className="flex items-center justify-between">
            <h2 className={`text-2xl font-bold ${
              isDarkMode ? "text-white" : "text-gray-800"
            }`}>📚 수집 도감</h2>
            <button
              onClick={() => setShowCollectionModal(false)}
              className={`p-2 rounded-full transition-all duration-300 ${
                isDarkMode 
                  ? "hover:bg-white/10 text-gray-400 hover:text-white" 
                  : "hover:bg-gray-100 text-gray-600 hover:text-gray-800"
              }`}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* 탭 네비게이션 */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setActiveCollectionTab('fish')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 ${
                activeCollectionTab === 'fish'
                  ? isDarkMode
                    ? "bg-blue-500/20 text-blue-400 border border-blue-400/30"
                    : "bg-blue-500/10 text-blue-600 border border-blue-500/30"
                  : isDarkMode
                    ? "text-gray-400 hover:text-gray-300 hover:bg-white/5"
                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-100/50"
              }`}
            >
              <Fish className="w-4 h-4" />
              물고기 ({getCompletionRate('fish').collected}/{getCompletionRate('fish').total})
            </button>
            <button
              onClick={() => setActiveCollectionTab('fishingRod')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 ${
                activeCollectionTab === 'fishingRod'
                  ? isDarkMode
                    ? "bg-green-500/20 text-green-400 border border-green-400/30"
                    : "bg-green-500/10 text-green-600 border border-green-500/30"
                  : isDarkMode
                    ? "text-gray-400 hover:text-gray-300 hover:bg-white/5"
                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-100/50"
              }`}
            >
              <Zap className="w-4 h-4" />
              낚시대 ({getCompletionRate('fishingRod').collected}/{getCompletionRate('fishingRod').total})
            </button>
            <button
              onClick={() => setActiveCollectionTab('accessory')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 ${
                activeCollectionTab === 'accessory'
                  ? isDarkMode
                    ? "bg-purple-500/20 text-purple-400 border border-purple-400/30"
                    : "bg-purple-500/10 text-purple-600 border border-purple-500/30"
                  : isDarkMode
                    ? "text-gray-400 hover:text-gray-300 hover:bg-white/5"
                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-100/50"
              }`}
            >
              <Package className="w-4 h-4" />
              악세사리 ({getCompletionRate('accessory').collected}/{getCompletionRate('accessory').total})
            </button>
          </div>
        </div>

        {/* 컨텐츠 */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {/* 물고기 도감 */}
          {activeCollectionTab === 'fish' && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {allFishTypes?.map((fish, index) => {
                const collected = hasItem(fish.name, 'fish');
                const count = getFishCount(fish.name);
                
                return (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border transition-all duration-300 ${
                      collected
                        ? isDarkMode
                          ? "bg-blue-500/10 border-blue-400/30 hover:bg-blue-500/20"
                          : "bg-blue-50 border-blue-300/50 hover:bg-blue-100"
                        : isDarkMode
                          ? "bg-gray-800/50 border-gray-600/30 hover:bg-gray-700/50"
                          : "bg-gray-100/50 border-gray-300/30 hover:bg-gray-200/50"
                    }`}
                  >
                    <div className="text-center">
                      <div className={`text-2xl mb-2 ${
                        collected ? "" : "filter grayscale brightness-50"
                      }`}>
                        🐟
                      </div>
                      <h3 className={`font-medium text-sm mb-1 ${
                        collected
                          ? isDarkMode ? "text-white" : "text-gray-800"
                          : isDarkMode ? "text-gray-500" : "text-gray-400"
                      }`}>
                        {collected ? fish.name : "???"}
                      </h3>
                      {collected && (
                        <>
                          <p className={`text-xs mb-1 ${
                            isDarkMode ? "text-blue-400" : "text-blue-600"
                          }`}>
                            Rank {fish.rank} • {count}마리
                          </p>
                          <p className={`text-xs ${
                            isDarkMode ? "text-gray-400" : "text-gray-600"
                          }`}>
                            {(fish.price || 0).toLocaleString()}골드
                          </p>
                        </>
                      )}
                      {!collected && (
                        <p className={`text-xs ${
                          isDarkMode ? "text-gray-600" : "text-gray-500"
                        }`}>
                          미발견
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 낚시대 도감 */}
          {activeCollectionTab === 'fishingRod' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fishingRods.map((rod, index) => {
                const collected = hasItem(rod.name, 'fishingRod');
                
                return (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border transition-all duration-300 ${
                      collected
                        ? isDarkMode
                          ? "bg-green-500/10 border-green-400/30 hover:bg-green-500/20"
                          : "bg-green-50 border-green-300/50 hover:bg-green-100"
                        : isDarkMode
                          ? "bg-gray-800/50 border-gray-600/30 hover:bg-gray-700/50"
                          : "bg-gray-100/50 border-gray-300/30 hover:bg-gray-200/50"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`text-3xl ${
                        collected ? "" : "filter grayscale brightness-50"
                      }`}>
                        🎣
                      </div>
                      <div className="flex-1">
                        <h3 className={`font-medium mb-1 ${
                          collected
                            ? isDarkMode ? "text-white" : "text-gray-800"
                            : isDarkMode ? "text-gray-500" : "text-gray-400"
                        }`}>
                          {collected ? rod.name : "???"}
                        </h3>
                        {collected && (
                          <>
                            <p className={`text-sm mb-1 ${
                              isDarkMode ? "text-green-400" : "text-green-600"
                            }`}>
                              {rod.price.toLocaleString()}골드
                            </p>
                            <p className={`text-xs ${
                              isDarkMode ? "text-gray-400" : "text-gray-600"
                            }`}>
                              {rod.description}
                            </p>
                          </>
                        )}
                        {!collected && (
                          <p className={`text-xs ${
                            isDarkMode ? "text-gray-600" : "text-gray-500"
                          }`}>
                            미보유
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 악세사리 도감 */}
          {activeCollectionTab === 'accessory' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {accessories.map((accessory, index) => {
                const collected = hasItem(accessory.name, 'accessory');
                
                return (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border transition-all duration-300 ${
                      collected
                        ? isDarkMode
                          ? "bg-purple-500/10 border-purple-400/30 hover:bg-purple-500/20"
                          : "bg-purple-50 border-purple-300/50 hover:bg-purple-100"
                        : isDarkMode
                          ? "bg-gray-800/50 border-gray-600/30 hover:bg-gray-700/50"
                          : "bg-gray-100/50 border-gray-300/30 hover:bg-gray-200/50"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`text-3xl ${
                        collected ? "" : "filter grayscale brightness-50"
                      }`}>
                        💎
                      </div>
                      <div className="flex-1">
                        <h3 className={`font-medium mb-1 ${
                          collected
                            ? isDarkMode ? "text-white" : "text-gray-800"
                            : isDarkMode ? "text-gray-500" : "text-gray-400"
                        }`}>
                          {collected ? accessory.name : "???"}
                        </h3>
                        {collected && (
                          <>
                            <p className={`text-sm mb-1 ${
                              isDarkMode ? "text-purple-400" : "text-purple-600"
                            }`}>
                              Lv.{index + 1} • {accessory.price.toLocaleString()}골드
                            </p>
                            <p className={`text-xs ${
                              isDarkMode ? "text-gray-400" : "text-gray-600"
                            }`}>
                              {accessory.description}
                            </p>
                          </>
                        )}
                        {!collected && (
                          <p className={`text-xs ${
                            isDarkMode ? "text-gray-600" : "text-gray-500"
                          }`}>
                            미보유
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 푸터 - 완성도 표시 */}
        <div className={`p-4 border-t ${
          isDarkMode ? "border-white/10" : "border-gray-300/20"
        }`}>
          <div className="text-center">
            <p className={`text-sm ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}>
              {activeCollectionTab === 'fish' && `물고기 도감 완성도: ${getCompletionRate('fish').percentage}%`}
              {activeCollectionTab === 'fishingRod' && `낚시대 수집 완성도: ${getCompletionRate('fishingRod').percentage}%`}
              {activeCollectionTab === 'accessory' && `악세사리 수집 완성도: ${getCompletionRate('accessory').percentage}%`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollectionModal;
