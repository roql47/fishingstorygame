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
  const [discoveredFish, setDiscoveredFish] = useState([]);
  const [hoveredFish, setHoveredFish] = useState(null);

  // 발견한 물고기 목록 가져오기
  React.useEffect(() => {
    if (!showCollectionModal) return;
    
    const fetchDiscoveredFish = async () => {
      try {
        // 프로덕션 환경에서는 현재 도메인 사용 (렌더 배포 대응)
        const serverUrl = import.meta.env.VITE_SERVER_URL || 
          (typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
            ? window.location.origin 
            : 'http://localhost:4000');
        const username = localStorage.getItem('nickname');
        const userUuid = localStorage.getItem('userUuid');
        
        // userUuid가 없으면 username을 userId로 사용
        const userId = userUuid || username;
        
        // 로그인하지 않았거나 userId가 비어있으면 빈 배열 반환
        if (!userId || userId.trim() === '' || !username || username.trim() === '') {
          setDiscoveredFish([]);
          return;
        }
        
        // URL 생성 - userUuid가 있으면 사용, 없으면 username만 사용
        const queryParams = new URLSearchParams();
        queryParams.append('username', username);
        if (userUuid && userUuid.trim() !== '') {
          queryParams.append('userUuid', userUuid);
        }
        
        const url = `${serverUrl}/api/fish-discoveries/${encodeURIComponent(userId)}?${queryParams.toString()}`;
        
        const response = await fetch(url);
        
        if (response.ok) {
          const fishNames = await response.json();
          setDiscoveredFish(fishNames);
        } else {
          setDiscoveredFish([]);
        }
      } catch (error) {
        setDiscoveredFish([]);
      }
    };
    
    fetchDiscoveredFish();
  }, [showCollectionModal]);

  if (!showCollectionModal) return null;

  // 낚시대 목록 (실제 상점 가격과 동일하게 계산)
  const fishingRods = [
    { name: '나무낚시대', price: 0, description: '기본 낚시대', currency: 'gold' },
    { name: '낡은낚시대', price: 7500, description: '오래된 낚시대입니다', currency: 'gold' },
    { name: '기본낚시대', price: 25000, description: '기본적인 낚시대입니다', currency: 'gold' },
    { name: '단단한낚시대', price: 60000, description: '견고한 낚시대입니다', currency: 'gold' },
    { name: '은낚시대', price: 120000, description: '은으로 만든 고급 낚시대입니다', currency: 'gold' },
    { name: '금낚시대', price: 225000, description: '금으로 만든 최고급 낚시대입니다', currency: 'gold' },
    { name: '강철낚시대', price: 90000, description: '강철로 제련된 견고한 낚시대입니다', currency: 'gold' },
    { name: '사파이어낚시대', price: 164500, description: '사파이어가 박힌 신비로운 낚시대입니다', currency: 'gold' },
    { name: '루비낚시대', price: 288000, description: '루비의 힘이 깃든 화려한 낚시대입니다', currency: 'gold' },
    { name: '다이아몬드낚시대', price: 441000, description: '다이아몬드의 광채가 빛나는 낚시대입니다', currency: 'gold' },
    { name: '레드다이아몬드낚시대', price: 665000, description: '희귀한 레드다이아몬드로 만든 전설적인 낚시대입니다', currency: 'gold' },
    { name: '벚꽃낚시대', price: 968000, description: '벚꽃의 아름다움을 담은 환상적인 낚시대입니다', currency: 'gold' },
    { name: '꽃망울낚시대', price: 1434000, description: '꽃망울처럼 생긴 신비한 낚시대입니다', currency: 'gold' },
    { name: '호롱불낚시대', price: 1885000, description: '호롱불처럼 따뜻한 빛을 내는 낚시대입니다', currency: 'gold' },
    { name: '산호등낚시대', price: 2485000, description: '바다 깊은 곳의 산호로 만든 낚시대입니다', currency: 'gold' },
    { name: '피크닉', price: 3240000, description: '즐거운 피크닉 분위기의 특별한 낚시대입니다', currency: 'gold' },
    { name: '마녀빗자루', price: 4168000, description: '마녀의 마법이 깃든 신비로운 빗자루 낚시대입니다', currency: 'gold' },
    { name: '에테르낚시대', price: 6247500, description: '에테르의 힘으로 만들어진 초월적인 낚시대입니다', currency: 'gold' },
    { name: '별조각낚시대', price: 7740000, description: '별의 조각으로 만든 우주적인 낚시대입니다', currency: 'gold' },
    { name: '여우꼬리낚시대', price: 9471500, description: '여우의 꼬리처럼 유연한 신비한 낚시대입니다', currency: 'gold' },
    { name: '초콜릿롤낚시대', price: 11460000, description: '달콤한 초콜릿롤 모양의 귀여운 낚시대입니다', currency: 'gold' },
    { name: '호박유령낚시대', price: 13723500, description: '호박 속 유령의 힘이 깃든 무서운 낚시대입니다', currency: 'gold' },
    { name: '핑크버니낚시대', price: 16280000, description: '핑크빛 토끼의 귀여움이 담긴 낚시대입니다', currency: 'gold' },
    { name: '할로우낚시대', price: 19147500, description: '할로윈의 신비로운 힘이 깃든 낚시대입니다', currency: 'gold' },
    { name: '여우불낚시대', price: 22344000, description: '여우불의 환상적인 힘을 지닌 최고급 낚시대입니다', currency: 'gold' },
    { name: '네오더스트낚시대', price: 217455, description: '미래의 먼지로 만들어진 초현대적 낚시대입니다', currency: 'gold' },
    { name: '드림캐쳐', price: 251130, description: '꿈을 잡아내는 신비로운 힘을 지닌 낚시대입니다', currency: 'gold' },
    { name: '아포카토낚시대', price: 288305, description: '부드러운 아포카토의 힘이 담긴 낚시대입니다', currency: 'gold' },
    { name: '스윗슈터', price: 329160, description: '달콤한 슈팅의 정확성을 자랑하는 낚시대입니다', currency: 'gold' },
    { name: '인도하는별빛', price: 373875, description: '별빛의 인도를 받아 길을 밝히는 신성한 낚시대입니다', currency: 'gold' }
  ];

  // 악세사리 목록 (실제 상점 가격과 동일하게 계산 - 골드 단위)
  const accessories = [
    { name: '오래된반지', price: 15000, description: '낡았지만 의미있는 반지입니다', currency: 'gold' },
    { name: '은목걸이', price: 50000, description: '은으로 만든 아름다운 목걸이입니다', currency: 'gold' },
    { name: '금귀걸이', price: 120000, description: '금으로 만든 화려한 귀걸이입니다', currency: 'gold' },
    { name: '마법의펜던트', price: 240000, description: '마법의 힘이 깃든 신비한 펜던트입니다', currency: 'gold' },
    { name: '에메랄드브로치', price: 450000, description: '에메랄드가 박힌 고급스러운 브로치입니다', currency: 'gold' },
    { name: '토파즈이어링', price: 180000, description: '토파즈의 빛이 아름다운 이어링입니다', currency: 'gold' },
    { name: '자수정팔찌', price: 329000, description: '자수정으로 만든 우아한 팔찌입니다', currency: 'gold' },
    { name: '백금티아라', price: 576000, description: '백금으로 제작된 고귀한 티아라입니다', currency: 'gold' },
    { name: '만드라고라허브', price: 882000, description: '신비한 만드라고라 허브입니다', currency: 'gold' },
    { name: '에테르나무묘목', price: 1330000, description: '에테르 나무의 신비한 묘목입니다', currency: 'gold' },
    { name: '몽마의조각상', price: 1936000, description: '몽마의 힘이 깃든 신비한 조각상입니다', currency: 'gold' },
    { name: '마카롱훈장', price: 2868000, description: '달콤한 마카롱 모양의 특별한 훈장입니다', currency: 'gold' },
    { name: '빛나는마력순환체', price: 3770000, description: '마력이 순환하는 빛나는 신비한 구슬입니다', currency: 'gold' },
    { name: '갈라진백조인형', price: 666000, description: '갈라진 백조의 슬픈 전설이 담긴 인형입니다', currency: 'gold' },
    { name: '기계천사', price: 1035500, description: '기계로 만들어진 천사의 축복을 담은 악세사리입니다', currency: 'gold' },
    { name: '공명하는보석', price: 1255650, description: '천상의 공명으로 울려퍼지는 신비한 보석입니다', currency: 'gold' }
  ];

  // 보유 여부 확인 함수
  const hasItem = (itemName, type) => {
    if (type === 'fishingRod') {
      // 낚시대는 현재 장착된 것만 보유한 것으로 간주하지 않고,
      // 해당 낚시대의 인덱스까지의 모든 낚시대를 보유한 것으로 간주
      const rodIndex = fishingRods.findIndex(rod => rod.name === itemName);
      const currentRodIndex = fishingRods.findIndex(rod => rod.name === userEquipment?.fishingRod);
      
      // 현재 장착된 낚시대가 없거나 null이면 기본 낚시대(나무낚시대)만 보유한 것으로 간주
      if (currentRodIndex === -1 || !userEquipment?.fishingRod) {
        return rodIndex === 0; // 나무낚시대(인덱스 0)만 보유
      }
      
      return rodIndex <= currentRodIndex;
    } else if (type === 'accessory') {
      // 악세사리도 마찬가지로 현재 장착된 것의 인덱스까지 모든 악세사리를 보유한 것으로 간주
      const accessoryIndex = accessories.findIndex(acc => acc.name === itemName);
      const currentAccessoryIndex = accessories.findIndex(acc => acc.name === userEquipment?.accessory);
      
      // 현재 장착된 악세사리가 없으면 아무것도 보유하지 않은 것으로 간주
      if (currentAccessoryIndex === -1) {
        return false;
      }
      
      return accessoryIndex <= currentAccessoryIndex;
    } else if (type === 'fish') {
      // 물고기는 한번이라도 낚았으면 발견된 것으로 간주
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
      // 물고기는 발견 기록을 기준으로 계산
      collected = allFishTypes?.filter(fish => discoveredFish.includes(fish.name)).length || 0;
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
          <div className="flex gap-2 mt-4 flex-wrap">
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
                const everCaught = discoveredFish.includes(fish.name); // 발견 기록으로 확인
                const isHovered = hoveredFish === fish.name;
                
                return (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border transition-all duration-300 relative ${
                      everCaught
                        ? isDarkMode
                          ? "bg-blue-500/10 border-blue-400/30 hover:bg-blue-500/20"
                          : "bg-blue-50 border-blue-300/50 hover:bg-blue-100"
                        : isDarkMode
                          ? "bg-gray-800/50 border-gray-600/30 hover:bg-gray-700/50"
                          : "bg-gray-100/50 border-gray-300/30 hover:bg-gray-200/50"
                    }`}
                    onMouseEnter={() => setHoveredFish(fish.name)}
                    onMouseLeave={() => setHoveredFish(null)}
                  >
                    <div className="text-center">
                      <div className={`text-2xl mb-2 ${
                        everCaught ? "" : "filter grayscale brightness-50"
                      }`}>
                        🐟
                      </div>
                      <h3 className={`font-medium text-sm mb-1 ${
                        everCaught
                          ? isDarkMode ? "text-white" : "text-gray-800"
                          : isDarkMode ? "text-gray-500" : "text-gray-400"
                      }`}>
                        {everCaught ? fish.name : "???"}
                      </h3>
                      {everCaught && (
                        <>
                          <p className={`text-xs mb-1 ${
                            isDarkMode ? "text-blue-400" : "text-blue-600"
                          }`}>
                            Rank {fish.rank}
                          </p>
                          <p className={`text-xs mb-1 ${
                            isDarkMode ? "text-gray-400" : "text-gray-600"
                          }`}>
                            💰 {(fish.price || 0).toLocaleString()}골드
                          </p>
                          {fish.material && (
                            <p className={`text-xs ${
                              isDarkMode ? "text-green-400" : "text-green-600"
                            }`}>
                              재료아이템: {fish.material}
                            </p>
                          )}
                        </>
                      )}
                      {!everCaught && (
                        <p className={`text-xs ${
                          isDarkMode ? "text-gray-600" : "text-gray-500"
                        }`}>
                          미발견
                        </p>
                      )}
                    </div>
                    
                    {/* 호버 시 잡은 개수 표시 */}
                    {everCaught && isHovered && (
                      <div className={`absolute inset-0 flex items-center justify-center rounded-lg ${
                        isDarkMode 
                          ? "bg-blue-600/95 backdrop-blur-sm" 
                          : "bg-blue-500/95 backdrop-blur-sm"
                      }`}>
                        <div className="text-center">
                          <p className={`text-2xl font-bold mb-1 ${
                            isDarkMode ? "text-white" : "text-white"
                          }`}>
                            {count}마리
                          </p>
                          <p className={`text-xs ${
                            isDarkMode ? "text-blue-100" : "text-blue-50"
                          }`}>
                            총 획득 수
                          </p>
                        </div>
                      </div>
                    )}
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

