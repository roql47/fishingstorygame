import React, { useState } from 'react';
import { Users, Sword, Shield, Heart, Star, Zap, X, Info, Plus, Sparkles, TrendingUp } from 'lucide-react';
import { 
  COMPANION_DATA, 
  calculateCompanionStats, 
  getRarityColor,
  TIER_INFO,
  GROWTH_COSTS,
  BREAKTHROUGH_COSTS,
  BREAKTHROUGH_BONUS,
  COMPANION_ESSENCE,
  ESSENCE_EMOJI,
  getTierColor,
  getTierBgColor
} from '../../data/companionData';
// 동료 이미지 import
import character1 from '../../assets/character1.jpg';
import character2 from '../../assets/character2.jpeg';
import character3 from '../../assets/character3.jpg';
import character4 from '../../assets/character4.jpeg';
import character5 from '../../assets/character5.jpg';
import character6 from '../../assets/character6.jpg';

const CompanionTab = ({
  // 상태
  isDarkMode,
  userStarPieces,
  companions,
  battleCompanions,
  companionStats,
  userGold,
  materials,
  
  // 함수
  recruitCompanion,
  toggleBattleCompanion,
  refreshAllData,
  onGrowth,
  onBreakthrough
}) => {
  // 탭 상태 추가 (recruit / enhance)
  const [activeTab, setActiveTab] = useState('recruit');
  
  // 동료 상세 모달 상태
  const [selectedCompanion, setSelectedCompanion] = useState(null);
  const [showCompanionModal, setShowCompanionModal] = useState(false);
  
  // 강화 탭 상태
  const [selectedEnhanceCompanion, setSelectedEnhanceCompanion] = useState(null);
  const [enhanceSubTab, setEnhanceSubTab] = useState('growth'); // 'growth' or 'breakthrough'
  const [loading, setLoading] = useState(false);
  
  // 동료 클릭 핸들러
  const handleCompanionClick = (companionName) => {
    setSelectedCompanion(companionName);
    setShowCompanionModal(true);
  };
  
  // 모달 닫기
  const closeCompanionModal = () => {
    setShowCompanionModal(false);
    setSelectedCompanion(null);
  };

  const allCompanions = ["실", "피에나", "애비게일", "림스&베리", "클로에", "나하트라"];
  const maxBattleCompanions = 3;

  // 동료 이미지 매핑
  const companionImages = {
    "실": character6,
    "피에나": character1,
    "애비게일": character5,
    "림스&베리": character3,
    "클로에": character2,
    "나하트라": character4
  };

  // 강화 헬퍼 함수들
  const getCompanionInfo = (companionName) => {
    const stats = companionStats[companionName] || {};
    const level = stats.level || 1;
    const tier = stats.tier || 0;
    const breakthrough = stats.breakthrough || 0;
    const breakthroughStats = stats.breakthroughStats || { bonusGrowthHp: 0, bonusGrowthAttack: 0, bonusGrowthSpeed: 0 };
    
    return calculateCompanionStats(companionName, level, tier, breakthrough, breakthroughStats);
  };

  const canGrow = (companionName) => {
    const stats = companionStats[companionName] || {};
    const currentTier = stats.tier || 0;
    
    if (currentTier >= 2) return { possible: false, reason: '이미 최고 등급입니다' };
    
    const cost = GROWTH_COSTS[currentTier];
    if (!cost) return { possible: false, reason: '비용 정보 없음' };
    
    if (userStarPieces < cost.starPieces) {
      return { possible: false, reason: `별조각 부족 (${cost.starPieces}개 필요)` };
    }
    
    if (userGold < cost.gold) {
      return { possible: false, reason: `골드 부족 (${cost.gold.toLocaleString()} 필요)` };
    }
    
    return { possible: true, reason: '' };
  };

  const canBreakthrough = (companionName) => {
    const stats = companionStats[companionName] || {};
    const currentBreakthrough = stats.breakthrough || 0;
    const currentLevel = stats.level || 1;
    
    if (currentBreakthrough >= 6) return { possible: false, reason: '이미 최대 돌파 단계입니다' };
    
    // 레벨 조건 확인 (각 돌파마다 10레벨씩 필요)
    const requiredLevel = (currentBreakthrough + 1) * 10;
    if (currentLevel < requiredLevel) {
      return { possible: false, reason: `레벨 ${requiredLevel} 필요 (현재: ${currentLevel})` };
    }
    
    const cost = BREAKTHROUGH_COSTS[currentBreakthrough];
    if (!cost) return { possible: false, reason: '비용 정보 없음' };
    
    // 동료별 정수 확인
    const essenceName = COMPANION_ESSENCE[companionName];
    const essenceCount = materials.find(m => m.material === essenceName)?.count || 0;
    
    // 1차 돌파는 골드만 필요
    if (currentBreakthrough === 0) {
      if (userGold < cost.gold) {
        return { possible: false, reason: `골드 부족 (${(cost.gold / 1000000).toFixed(0)}백만 필요)` };
      }
    } else {
      // 2차 이상은 정수 필요
      if (essenceCount < cost.essence) {
        return { possible: false, reason: `${essenceName} 부족 (${cost.essence}개 필요)` };
      }
    }
    
    return { possible: true, reason: '' };
  };

  const handleGrowth = async () => {
    if (!selectedEnhanceCompanion) return;
    
    const check = canGrow(selectedEnhanceCompanion);
    if (!check.possible) {
      alert(check.reason);
      return;
    }
    
    const stats = companionStats[selectedEnhanceCompanion] || {};
    const currentTier = stats.tier || 0;
    const tierNames = ['일반', '희귀', '전설'];
    
    if (!window.confirm(`${selectedEnhanceCompanion}을(를) ${tierNames[currentTier]}에서 ${tierNames[currentTier + 1]}로 성장시키시겠습니까?`)) {
      return;
    }
    
    setLoading(true);
    try {
      await onGrowth(selectedEnhanceCompanion);
      alert(`🌟 ${selectedEnhanceCompanion}이(가) ${tierNames[currentTier + 1]} 등급으로 성장했습니다!`);
    } catch (error) {
      console.error('성장 실패:', error);
      alert(error.response?.data?.error || '성장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleBreakthrough = async () => {
    if (!selectedEnhanceCompanion) return;
    
    const check = canBreakthrough(selectedEnhanceCompanion);
    if (!check.possible) {
      alert(check.reason);
      return;
    }
    
    const stats = companionStats[selectedEnhanceCompanion] || {};
    const currentBreakthrough = stats.breakthrough || 0;
    const essenceName = COMPANION_ESSENCE[selectedEnhanceCompanion];
    const bonus = BREAKTHROUGH_BONUS[currentBreakthrough];
    
    if (!window.confirm(`${selectedEnhanceCompanion}을(를) ${currentBreakthrough + 1}차 돌파하시겠습니까?\n레벨당 성장률이 증가합니다!`)) {
      return;
    }
    
    setLoading(true);
    try {
      await onBreakthrough(selectedEnhanceCompanion);
      alert(`💎 ${selectedEnhanceCompanion}이(가) ${currentBreakthrough + 1}차 돌파했습니다!\n레벨당 HP +${bonus.growthHp}, 공격력 +${bonus.growthAttack}, 속도 +${bonus.growthSpeed}`);
    } catch (error) {
      console.error('돌파 실패:', error);
      alert(error.response?.data?.error || '돌파에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`rounded-2xl board-shadow min-h-full flex flex-col ${
      isDarkMode ? "glass-card" : "bg-white/80 backdrop-blur-md border border-gray-300/30"
    }`}>
      {/* 헤더 */}
      <div className={`border-b p-4 ${
        isDarkMode ? "border-white/10" : "border-gray-300/20"
      }`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 border ${
              isDarkMode ? "border-white/10" : "border-purple-300/30"
            }`}>
              <Users className={`w-4 h-4 ${
                isDarkMode ? "text-purple-400" : "text-purple-600"
              }`} />
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${
                isDarkMode ? "text-white" : "text-gray-800"
              }`}>동료</h2>
              <p className={`text-xs ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}>모집 및 강화</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              isDarkMode ? "bg-purple-500/20 text-purple-400" : "bg-purple-500/10 text-purple-600"
            }`}>
              전투 참여: {battleCompanions.length}/{maxBattleCompanions}
            </div>
            <button
              onClick={() => {
                if (refreshAllData) {
                  refreshAllData();
                } else {
                  window.location.reload();
                }
              }}
              className={`p-1 rounded-full hover:scale-110 transition-all duration-300 ${
                isDarkMode 
                  ? "bg-gray-500/20 text-gray-400 hover:bg-gray-500/30" 
                  : "bg-gray-300/30 text-gray-600 hover:bg-gray-300/50"
              }`}
              title="데이터 새로고침"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* 탭 네비게이션 */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('recruit')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 ${
              activeTab === 'recruit'
                ? isDarkMode
                  ? "bg-purple-500/20 text-purple-400 border border-purple-400/30"
                  : "bg-purple-500/10 text-purple-600 border border-purple-500/30"
                : isDarkMode
                  ? "text-gray-400 hover:text-gray-300 hover:bg-white/5"
                  : "text-gray-600 hover:text-gray-800 hover:bg-gray-100/50"
            }`}
          >
            <Users className="w-4 h-4" />
            동료 모집
          </button>
          <button
            onClick={() => {
              setActiveTab('enhance');
              setSelectedEnhanceCompanion(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 ${
              activeTab === 'enhance'
                ? isDarkMode
                  ? "bg-orange-500/20 text-orange-400 border border-orange-400/30"
                  : "bg-orange-500/10 text-orange-600 border border-orange-500/30"
                : isDarkMode
                  ? "text-gray-400 hover:text-gray-300 hover:bg-white/5"
                  : "text-gray-600 hover:text-gray-800 hover:bg-gray-100/50"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            동료 강화
          </button>
        </div>
      </div>
      
      {/* 동료 모집 탭 컨텐츠 */}
      {activeTab === 'recruit' && (
      <div className="p-6">
        <div className="text-center mb-6">
          <button
            onClick={recruitCompanion}
            disabled={userStarPieces < 1 || companions.length >= 6}
            className={`px-8 py-4 rounded-xl font-bold text-lg transition-all duration-300 ${
              userStarPieces >= 1 && companions.length < 6
                ? isDarkMode
                  ? "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 hover:scale-105 glow-effect border border-purple-400/30"
                  : "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 hover:scale-105 border border-purple-500/30"
                : isDarkMode
                  ? "bg-gray-500/20 text-gray-500 cursor-not-allowed border border-gray-500/20"
                  : "bg-gray-300/30 text-gray-400 cursor-not-allowed border border-gray-300/30"
            }`}
          >
            {companions.length >= 6
              ? "모든 동료 보유 완료"
              : userStarPieces < 1
                ? `별조각 부족 (${userStarPieces}/1)`
                : "동료 모집 (별조각 1개)"
            }
          </button>
          <div className={`text-xs mt-2 ${
            isDarkMode ? "text-gray-400" : "text-gray-600"
          }`}>
            성공 확률: 15% | 남은 동료: {6 - companions.length}명
          </div>
        </div>
        
        {/* 보유 동료 목록 - 전투 참여 토글 기능 */}
        <div className={`p-4 rounded-xl mb-4 ${
          isDarkMode ? "glass-input" : "bg-white/60 backdrop-blur-sm border border-gray-300/40"
        }`}>
          <h3 className={`font-medium mb-3 flex items-center gap-2 ${
            isDarkMode ? "text-white" : "text-gray-800"
          }`}>
            <Sword className="w-4 h-4" />
            보유 동료 ({companions.length}/6)
          </h3>
          {companions.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {companions.map((companion, index) => {
                const isInBattle = battleCompanions.includes(companion);
                const canAddToBattle = battleCompanions.length < maxBattleCompanions;
                const companionStat = companionStats[companion] || { level: 1, exp: 0, expToNext: 100 };
                // NaN 방지를 위한 안전한 값 처리
                const safeExp = companionStat.exp || 0;
                const safeExpToNext = companionStat.expToNext || 100;
                const tier = companionStat.tier || 0;
                const breakthrough = companionStat.breakthrough || 0;
                const breakthroughStats = companionStat.breakthroughStats || { bonusGrowthHp: 0, bonusGrowthAttack: 0, bonusGrowthSpeed: 0 };
                const companionData = calculateCompanionStats(companion, companionStat.level, tier, breakthrough, breakthroughStats);
                const baseData = COMPANION_DATA[companion];
                
                return (
                  <div key={index} className={`p-4 rounded-lg transition-all duration-200 cursor-pointer hover:scale-105 ${
                    isInBattle
                      ? isDarkMode 
                        ? "bg-green-500/20 border-2 border-green-400/40 glow-effect-green hover:bg-green-500/30" 
                        : "bg-green-500/10 border-2 border-green-500/40 hover:bg-green-500/20"
                      : isDarkMode 
                        ? "bg-purple-500/10 border border-purple-400/20 hover:bg-purple-500/20" 
                        : "bg-purple-500/5 border border-purple-300/30 hover:bg-purple-500/15"
                  }`}
                  onClick={() => handleCompanionClick(companion)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isInBattle
                            ? isDarkMode ? "bg-green-500/30 text-green-400" : "bg-green-500/20 text-green-600"
                            : isDarkMode ? "bg-purple-500/30 text-purple-400" : "bg-purple-500/20 text-purple-600"
                        }`}>
                          {isInBattle ? <Sword className="w-5 h-5" /> : <Heart className="w-5 h-5" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`font-medium ${
                              isInBattle
                                ? isDarkMode ? "text-green-400" : "text-green-600"
                                : isDarkMode ? "text-purple-400" : "text-purple-600"
                            }`}>{companion}</div>
                            <div className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              isDarkMode ? "bg-yellow-500/20 text-yellow-400" : "bg-yellow-500/10 text-yellow-600"
                            }`}>
                              Lv.{companionStat.level}
                            </div>
                            <div className={`text-xs px-1.5 py-0.5 rounded font-medium ${getRarityColor(baseData?.rarity, isDarkMode)} ${
                              isDarkMode ? "bg-gray-700/30" : "bg-gray-200/50"
                            }`}>
                              {baseData?.rarity}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-1">
                              <Heart className="w-3 h-3 text-red-400" />
                              <span className={isDarkMode ? "text-gray-300" : "text-gray-700"}>
                                {companionData?.hp || 100}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Sword className="w-3 h-3 text-orange-400" />
                              <span className={isDarkMode ? "text-gray-300" : "text-gray-700"}>
                                {companionData?.attack || 25}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Zap className="w-3 h-3 text-blue-400" />
                              <span className={isDarkMode ? "text-gray-300" : "text-gray-700"}>
                                {companionData?.speed || 30}
                              </span>
                            </div>
                          </div>
                          <div className={`text-xs mt-1 ${
                            isDarkMode ? "text-gray-400" : "text-gray-600"
                          }`}>
                            {isInBattle ? "전투 참여 중" : "대기 중"} • EXP: {safeExp}/{safeExpToNext}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          await toggleBattleCompanion(companion);
                        }}
                        disabled={!isInBattle && !canAddToBattle}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 ${
                          isInBattle
                            ? isDarkMode
                              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-400/30"
                              : "bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/30"
                            : canAddToBattle
                              ? isDarkMode
                                ? "bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-400/30"
                                : "bg-green-500/10 text-green-600 hover:bg-green-500/20 border border-green-500/30"
                              : isDarkMode
                                ? "bg-gray-500/20 text-gray-500 cursor-not-allowed border border-gray-500/20"
                                : "bg-gray-300/30 text-gray-400 cursor-not-allowed border border-gray-300/30"
                        }`}
                      >
                        {isInBattle ? "해제" : canAddToBattle ? "참여" : "만원"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`text-center py-4 text-sm ${
              isDarkMode ? "text-gray-500" : "text-gray-600"
            }`}>
              아직 동료가 없습니다.
              <br />
              동료를 모집해서 전투에 참여시켜보세요!
            </div>
          )}
        </div>

        {/* 전투 참여 동료 현황 */}
        {battleCompanions.length > 0 && (
          <div className={`p-4 rounded-xl mb-4 ${
            isDarkMode ? "bg-green-500/10 border border-green-400/20" : "bg-green-500/5 border border-green-500/20"
          }`}>
            <h3 className={`font-medium mb-3 flex items-center gap-2 ${
              isDarkMode ? "text-green-400" : "text-green-600"
            }`}>
              <Shield className="w-4 h-4" />
              전투 참여 동료
            </h3>
            <div className="flex flex-wrap gap-2">
              {battleCompanions.map((companion, index) => (
                <div key={index} className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                  isDarkMode ? "bg-green-500/20 text-green-400" : "bg-green-500/10 text-green-600"
                }`}>
                  <Sword className="w-3 h-3" />
                  {companion}
                </div>
              ))}
            </div>
            <div className={`text-xs mt-2 ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}>
              탐사 전투에서 함께 싸워줍니다! ({battleCompanions.length}/{maxBattleCompanions})
            </div>
          </div>
        )}
        
        {/* 동료 소개 */}
        <div className={`p-4 rounded-xl ${
          isDarkMode ? "glass-input" : "bg-white/60 backdrop-blur-sm border border-gray-300/40"
        }`}>
          <h3 className={`font-medium mb-3 ${
            isDarkMode ? "text-white" : "text-gray-800"
          }`}>동료 소개</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            {allCompanions.map((name, index) => (
              <div 
                key={index} 
                className={`p-2 rounded text-center ${
                  companions.includes(name)
                    ? isDarkMode
                      ? "bg-green-500/20 text-green-400 border border-green-400/30"
                      : "bg-green-500/10 text-green-600 border border-green-500/30"
                    : isDarkMode
                      ? "bg-gray-500/10 text-gray-500 border border-gray-500/20"
                      : "bg-gray-300/20 text-gray-600 border border-gray-300/30"
                }`}
              >
                {name} {companions.includes(name) ? "✓" : ""}
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* 동료 강화 탭 컨텐츠 */}
      {activeTab === 'enhance' && (
        <div className="p-6 flex flex-col md:flex-row gap-4">
          {/* 왼쪽: 동료 목록 */}
          <div className="w-full md:w-1/3">
            <h3 className={`text-lg font-bold mb-3 ${
              isDarkMode ? "text-white" : "text-gray-800"
            }`}>
              보유 동료
            </h3>
            {companions && companions.length > 0 ? (
              <div className="space-y-2">
                {companions.map((companionName) => {
                  const companionInfo = getCompanionInfo(companionName);
                  const stats = companionStats[companionName] || {};
                  const tier = stats.tier || 0;
                  const breakthrough = stats.breakthrough || 0;
                  
                  return (
                    <button
                      key={companionName}
                      onClick={() => setSelectedEnhanceCompanion(companionName)}
                      className={`w-full p-3 rounded-lg border transition-all duration-300 text-left ${
                        selectedEnhanceCompanion === companionName
                          ? isDarkMode
                            ? "bg-orange-500/30 border-orange-400/50"
                            : "bg-orange-100 border-orange-400"
                          : isDarkMode
                            ? "bg-gray-800/50 border-gray-600/30 hover:bg-gray-700/50"
                            : "bg-gray-100 border-gray-300 hover:bg-gray-200"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className={`font-medium ${
                            isDarkMode ? "text-white" : "text-gray-800"
                          }`}>
                            {companionName}
                          </p>
                          <p className={`text-xs ${getTierColor(tier, isDarkMode)}`}>
                            {TIER_INFO[tier].name} • Lv.{companionInfo.level}
                          </p>
                        </div>
                        {breakthrough > 0 && (
                          <span className={`text-xs px-2 py-1 rounded ${
                            isDarkMode 
                              ? "bg-purple-500/20 text-purple-400" 
                              : "bg-purple-100 text-purple-700"
                          }`}>
                            {breakthrough}차 돌파
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className={`text-center py-12 ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}>
                <p className="text-sm">보유한 동료가 없습니다</p>
              </div>
            )}
          </div>

          {/* 오른쪽: 강화 정보 */}
          <div className="w-full md:w-2/3">
            {selectedEnhanceCompanion ? (
              <>
                {/* 하위 탭 */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setEnhanceSubTab('growth')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                      enhanceSubTab === 'growth'
                        ? isDarkMode
                          ? "bg-yellow-500/20 text-yellow-400 border border-yellow-400/30"
                          : "bg-yellow-100 text-yellow-700 border border-yellow-400"
                        : isDarkMode
                          ? "text-gray-400 hover:bg-white/5"
                          : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    성장
                  </button>
                  <button
                    onClick={() => setEnhanceSubTab('breakthrough')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                      enhanceSubTab === 'breakthrough'
                        ? isDarkMode
                          ? "bg-purple-500/20 text-purple-400 border border-purple-400/30"
                          : "bg-purple-100 text-purple-700 border border-purple-400"
                        : isDarkMode
                          ? "text-gray-400 hover:bg-white/5"
                          : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <TrendingUp className="w-4 h-4" />
                    돌파
                  </button>
                </div>

                {/* 동료 정보 */}
                {(() => {
                  const companionInfo = getCompanionInfo(selectedEnhanceCompanion);
                  const stats = companionStats[selectedEnhanceCompanion] || {};
                  const tier = stats.tier || 0;
                  const breakthrough = stats.breakthrough || 0;
                  const companionImage = companionImages[selectedEnhanceCompanion];
                  
                  return (
                    <>
                      {/* 동료 이미지 (큰 사이즈) */}
                      {companionImage && (
                        <div className="flex justify-center mb-4">
                          <div className={`overflow-hidden border-2 ${
                            isDarkMode ? "border-white/20" : "border-gray-300/50"
                          } shadow-2xl`}>
                            <img 
                              src={companionImage} 
                              alt={selectedEnhanceCompanion}
                              className="max-w-full h-auto"
                              style={{ maxHeight: '500px', objectFit: 'contain' }}
                            />
                          </div>
                        </div>
                      )}
                      
                      <div className={`p-4 rounded-lg mb-4 ${getTierBgColor(tier, isDarkMode)} border ${
                        isDarkMode ? "border-white/10" : "border-gray-300/30"
                      }`}>
                        <div className="mb-3">
                          <h3 className={`text-xl font-bold ${getTierColor(tier, isDarkMode)}`}>
                            {selectedEnhanceCompanion}
                          </h3>
                        </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>레벨:</span>{' '}
                          <span className={isDarkMode ? "text-white" : "text-gray-800"}>
                            Lv.{companionInfo.level}
                          </span>
                        </div>
                        <div>
                          <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>등급:</span>{' '}
                          <span className={getTierColor(tier, isDarkMode)}>{TIER_INFO[tier].name}</span>
                        </div>
                        <div>
                          <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>HP:</span>{' '}
                          <span className={isDarkMode ? "text-white" : "text-gray-800"}>{companionInfo.hp}</span>
                        </div>
                        <div>
                          <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>공격력:</span>{' '}
                          <span className={isDarkMode ? "text-white" : "text-gray-800"}>{companionInfo.attack}</span>
                        </div>
                        <div>
                          <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>속도:</span>{' '}
                          <span className={isDarkMode ? "text-white" : "text-gray-800"}>{companionInfo.speed}</span>
                        </div>
                        <div>
                          <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>돌파:</span>{' '}
                          <span className={isDarkMode ? "text-white" : "text-gray-800"}>{breakthrough}차</span>
                        </div>
                      </div>
                    </div>
                    </>
                  );
                })()}

                {/* 성장 탭 */}
                {enhanceSubTab === 'growth' && (() => {
                  const stats = companionStats[selectedEnhanceCompanion] || {};
                  const currentTier = stats.tier || 0;
                  const tierNames = ['일반', '희귀', '전설'];
                  const check = canGrow(selectedEnhanceCompanion);
                  
                  if (currentTier >= 2) {
                    return (
                      <div className={`p-6 rounded-lg text-center ${
                        isDarkMode ? "bg-gray-800/50" : "bg-gray-100"
                      }`}>
                        <p className={`text-lg ${
                          isDarkMode ? "text-gray-400" : "text-gray-600"
                        }`}>
                          이미 최고 등급입니다!
                        </p>
                      </div>
                    );
                  }
                  
                  const cost = GROWTH_COSTS[currentTier];
                  const nextTier = currentTier + 1;
                  const nextTierInfo = TIER_INFO[nextTier];
                  
                  return (
                    <div>
                      <div className={`p-4 rounded-lg mb-4 ${
                        isDarkMode ? "bg-gray-800/50" : "bg-gray-100"
                      }`}>
                        <h4 className={`font-bold mb-3 ${
                          isDarkMode ? "text-white" : "text-gray-800"
                        }`}>
                          성장 효과
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
                              등급
                            </span>
                            <span className={isDarkMode ? "text-white" : "text-gray-800"}>
                              {tierNames[currentTier]} → {tierNames[nextTier]}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
                              능력치 배율
                            </span>
                            <span className={isDarkMode ? "text-green-400" : "text-green-600"}>
                              ×{TIER_INFO[currentTier].statMultiplier} → ×{nextTierInfo.statMultiplier}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className={`p-4 rounded-lg mb-4 ${
                        isDarkMode ? "bg-gray-800/50" : "bg-gray-100"
                      }`}>
                        <h4 className={`font-bold mb-3 ${
                          isDarkMode ? "text-white" : "text-gray-800"
                        }`}>
                          필요 재화
                        </h4>
                        <div className="space-y-2">
                          <div className={`flex justify-between p-2 rounded ${
                            userStarPieces >= cost.starPieces
                              ? isDarkMode ? "bg-blue-500/10" : "bg-blue-50"
                              : isDarkMode ? "bg-red-500/10" : "bg-red-50"
                          }`}>
                            <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
                              ⭐ 별조각
                            </span>
                            <span className={
                              userStarPieces >= cost.starPieces
                                ? isDarkMode ? "text-blue-400" : "text-blue-600"
                                : isDarkMode ? "text-red-400" : "text-red-600"
                            }>
                              {cost.starPieces} ({userStarPieces} 보유)
                            </span>
                          </div>
                          <div className={`flex justify-between p-2 rounded ${
                            userGold >= cost.gold
                              ? isDarkMode ? "bg-yellow-500/10" : "bg-yellow-50"
                              : isDarkMode ? "bg-red-500/10" : "bg-red-50"
                          }`}>
                            <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
                              💰 골드
                            </span>
                            <span className={
                              userGold >= cost.gold
                                ? isDarkMode ? "text-yellow-400" : "text-yellow-600"
                                : isDarkMode ? "text-red-400" : "text-red-600"
                            }>
                              {cost.gold.toLocaleString()} ({userGold.toLocaleString()} 보유)
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={handleGrowth}
                        disabled={!check.possible || loading}
                        className={`w-full py-3 rounded-lg font-bold transition-all ${
                          check.possible && !loading
                            ? isDarkMode
                              ? "bg-yellow-500 hover:bg-yellow-600 text-black"
                              : "bg-yellow-400 hover:bg-yellow-500 text-black"
                            : isDarkMode
                              ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                              : "bg-gray-300 text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        {loading ? '처리중...' : check.possible ? '🌟 성장하기' : check.reason}
                      </button>
                    </div>
                  );
                })()}

                {/* 돌파 탭 */}
                {enhanceSubTab === 'breakthrough' && (() => {
                  const stats = companionStats[selectedEnhanceCompanion] || {};
                  const currentBreakthrough = stats.breakthrough || 0;
                  const check = canBreakthrough(selectedEnhanceCompanion);
                  const essenceName = COMPANION_ESSENCE[selectedEnhanceCompanion];
                  const essenceCount = materials.find(m => m.material === essenceName)?.count || 0;
                  
                  if (currentBreakthrough >= 6) {
                    return (
                      <div className={`p-6 rounded-lg text-center ${
                        isDarkMode ? "bg-gray-800/50" : "bg-gray-100"
                      }`}>
                        <p className={`text-lg ${
                          isDarkMode ? "text-gray-400" : "text-gray-600"
                        }`}>
                          이미 최대 돌파 단계입니다!
                        </p>
                      </div>
                    );
                  }
                  
                  const cost = BREAKTHROUGH_COSTS[currentBreakthrough];
                  const bonus = BREAKTHROUGH_BONUS[currentBreakthrough];
                  const essenceEmoji = ESSENCE_EMOJI[essenceName] || "🔮";
                  
                  return (
                    <div>
                      <div className={`p-4 rounded-lg mb-4 ${
                        isDarkMode ? "bg-gray-800/50" : "bg-gray-100"
                      }`}>
                        <h4 className={`font-bold mb-3 ${
                          isDarkMode ? "text-white" : "text-gray-800"
                        }`}>
                          돌파 효과 및 조건
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
                              필요 레벨
                            </span>
                            <span className={
                              (() => {
                                const stats = companionStats[selectedEnhanceCompanion] || {};
                                const currentLevel = stats.level || 1;
                                const currentBreakthrough = stats.breakthrough || 0;
                                const requiredLevel = (currentBreakthrough + 1) * 10;
                                return currentLevel >= requiredLevel
                                  ? isDarkMode ? "text-green-400" : "text-green-600"
                                  : isDarkMode ? "text-red-400" : "text-red-600";
                              })()
                            }>
                              Lv.{(() => {
                                const stats = companionStats[selectedEnhanceCompanion] || {};
                                const currentBreakthrough = stats.breakthrough || 0;
                                return (currentBreakthrough + 1) * 10;
                              })()} 이상
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
                              HP 성장률
                            </span>
                            <span className={isDarkMode ? "text-green-400" : "text-green-600"}>
                              +{bonus.growthHp}/Lv
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
                              공격력 성장률
                            </span>
                            <span className={isDarkMode ? "text-green-400" : "text-green-600"}>
                              +{bonus.growthAttack}/Lv
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
                              속도 성장률
                            </span>
                            <span className={isDarkMode ? "text-green-400" : "text-green-600"}>
                              +{bonus.growthSpeed}/Lv
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className={`p-4 rounded-lg mb-4 ${
                        isDarkMode ? "bg-gray-800/50" : "bg-gray-100"
                      }`}>
                        <h4 className={`font-bold mb-3 ${
                          isDarkMode ? "text-white" : "text-gray-800"
                        }`}>
                          필요 재화
                        </h4>
                        <div className="space-y-2">
                          {currentBreakthrough === 0 ? (
                            // 1차 돌파는 골드만
                            <div className={`flex justify-between p-2 rounded ${
                              userGold >= cost.gold
                                ? isDarkMode ? "bg-yellow-500/10" : "bg-yellow-50"
                                : isDarkMode ? "bg-red-500/10" : "bg-red-50"
                            }`}>
                              <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
                                💰 골드
                              </span>
                              <span className={
                                userGold >= cost.gold
                                  ? isDarkMode ? "text-yellow-400" : "text-yellow-600"
                                  : isDarkMode ? "text-red-400" : "text-red-600"
                              }>
                                {cost.gold.toLocaleString()} ({userGold.toLocaleString()} 보유)
                              </span>
                            </div>
                          ) : (
                            // 2차 이상은 정수만
                            <div className={`flex justify-between p-2 rounded ${
                              essenceCount >= cost.essence
                                ? isDarkMode ? "bg-cyan-500/10" : "bg-cyan-50"
                                : isDarkMode ? "bg-red-500/10" : "bg-red-50"
                            }`}>
                              <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
                                {essenceEmoji} {essenceName}
                              </span>
                              <span className={
                                essenceCount >= cost.essence
                                  ? isDarkMode ? "text-cyan-400" : "text-cyan-600"
                                  : isDarkMode ? "text-red-400" : "text-red-600"
                              }>
                                {cost.essence}개 ({essenceCount}개 보유)
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={handleBreakthrough}
                        disabled={!check.possible || loading}
                        className={`w-full py-3 rounded-lg font-bold transition-all ${
                          check.possible && !loading
                            ? isDarkMode
                              ? "bg-purple-500 hover:bg-purple-600 text-white"
                              : "bg-purple-400 hover:bg-purple-500 text-white"
                            : isDarkMode
                              ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                              : "bg-gray-300 text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        {loading ? '처리중...' : check.possible ? '돌파하기' : check.reason}
                      </button>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className={`flex items-center justify-center h-full ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}>
                <p className="text-lg">동료를 선택해주세요</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 동료 상세 모달 */}
      {showCompanionModal && selectedCompanion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl ${
            isDarkMode 
              ? "bg-gray-800/95 border-gray-700/50 backdrop-blur-md" 
              : "bg-white/95 border-gray-300/50 backdrop-blur-md"
          }`}>
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between p-6 border-b border-gray-300/20">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  isDarkMode ? "bg-blue-500/20 text-blue-400" : "bg-blue-500/10 text-blue-600"
                }`}>
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${
                    isDarkMode ? "text-white" : "text-gray-800"
                  }`}>{selectedCompanion}</h2>
                  <div className={`text-sm ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}>동료 상세 정보</div>
                </div>
              </div>
              <button
                onClick={closeCompanionModal}
                className={`p-2 rounded-full transition-colors ${
                  isDarkMode 
                    ? "hover:bg-gray-700/50 text-gray-400 hover:text-white" 
                    : "hover:bg-gray-200/50 text-gray-600 hover:text-gray-800"
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 모달 내용 */}
            <div className="p-6">
              {(() => {
                const baseData = COMPANION_DATA[selectedCompanion];
                const companionStat = companionStats[selectedCompanion];
                const level = companionStat?.level || 1;
                const exp = companionStat?.exp || 0;
                const expToNext = companionStat?.expToNext || 100;
                const tier = companionStat?.tier || 0;
                const breakthrough = companionStat?.breakthrough || 0;
                const breakthroughStats = companionStat?.breakthroughStats || { bonusGrowthHp: 0, bonusGrowthAttack: 0, bonusGrowthSpeed: 0 };
                
                // NaN 방지를 위한 추가 안전 처리
                const safeExp = isNaN(exp) ? 0 : exp;
                const safeExpToNext = isNaN(expToNext) ? 100 : expToNext;
                const companionData = calculateCompanionStats(selectedCompanion, level, tier, breakthrough, breakthroughStats);
                const isInBattle = battleCompanions.includes(selectedCompanion);

                if (!baseData) return <div>동료 정보를 불러올 수 없습니다.</div>;

                return (
                  <div className="space-y-6">
                    {/* 동료 이미지 */}
                    <div className="flex justify-center">
                      <div className={`overflow-hidden border-2 ${
                        isDarkMode ? "border-white/20" : "border-gray-300/50"
                      } shadow-2xl`}>
                        <img 
                          src={companionImages[selectedCompanion]} 
                          alt={selectedCompanion}
                          className="max-w-full h-auto"
                          style={{ maxHeight: '500px', objectFit: 'contain' }}
                        />
                      </div>
                    </div>

                    {/* 기본 정보 */}
                    <div className={`p-4 rounded-lg ${
                      isDarkMode ? "bg-gray-700/30" : "bg-gray-100/50"
                    }`}>
                      <h3 className={`font-semibold mb-3 ${
                        isDarkMode ? "text-white" : "text-gray-800"
                      }`}>기본 정보</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>레벨</span>
                          <span className={isDarkMode ? "text-white" : "text-gray-800"}>Lv.{level}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>희귀도</span>
                          <span className={"font-medium " + getRarityColor(baseData.rarity, isDarkMode)}>
                            {baseData.rarity}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>전투 상태</span>
                          <span className={
                            "font-medium " + (isInBattle 
                              ? isDarkMode ? "text-green-400" : "text-green-600"
                              : isDarkMode ? "text-gray-400" : "text-gray-600")
                          }>
                            {isInBattle ? "참여 중" : "대기 중"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 능력치 */}
                    <div className={`p-4 rounded-lg ${
                      isDarkMode ? "bg-gray-700/30" : "bg-gray-100/50"
                    }`}>
                      <h3 className={`font-semibold mb-3 ${
                        isDarkMode ? "text-white" : "text-gray-800"
                      }`}>능력치</h3>
                      <div className="space-y-3">
                        {/* 체력 */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Heart className="w-4 h-4 text-red-400" />
                            <span className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>체력</span>
                          </div>
                          <div className="text-right">
                            <div className={`font-semibold ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                              {companionData?.hp || baseData.baseHp}
                            </div>
                            <div className="text-xs text-gray-500">
                              기본 {baseData.baseHp} (+{baseData.growthHp}/Lv)
                            </div>
                          </div>
                        </div>

                        {/* 공격력 */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sword className="w-4 h-4 text-orange-400" />
                            <span className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>공격력</span>
                          </div>
                          <div className="text-right">
                            <div className={`font-semibold ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                              {companionData?.attack || baseData.baseAttack}
                            </div>
                            <div className="text-xs text-gray-500">
                              기본 {baseData.baseAttack} (+{baseData.growthAttack}/Lv)
                            </div>
                          </div>
                        </div>

                        {/* 속도 */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-blue-400" />
                            <span className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>속도</span>
                          </div>
                          <div className="text-right">
                            <div className={`font-semibold ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                              {companionData?.speed || baseData.baseSpeed}
                            </div>
                            <div className="text-xs text-gray-500">
                              기본 {baseData.baseSpeed} (+{baseData.growthSpeed}/Lv)
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 경험치 */}
                    <div className={`p-4 rounded-lg ${
                      isDarkMode ? "bg-gray-700/30" : "bg-gray-100/50"
                    }`}>
                      <h3 className={`font-semibold mb-3 ${
                        isDarkMode ? "text-white" : "text-gray-800"
                      }`}>경험치</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>현재 EXP</span>
                          <span className={isDarkMode ? "text-white" : "text-gray-800"}>{safeExp} / {safeExpToNext}</span>
                        </div>
                        <div className={`w-full h-2 rounded-full ${
                          isDarkMode ? "bg-gray-600" : "bg-gray-300"
                        }`}>
                          <div 
                            className="h-full bg-blue-500 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, (safeExp / safeExpToNext) * 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {/* 스킬 정보 */}
                    {baseData.skill && (
                      <div className={`p-4 rounded-lg ${
                        isDarkMode ? "bg-purple-500/10 border border-purple-500/20" : "bg-purple-500/5 border border-purple-500/20"
                      }`}>
                        <h3 className={`font-semibold mb-3 flex items-center gap-2 ${
                          isDarkMode ? "text-purple-400" : "text-purple-600"
                        }`}>
                          <Star className="w-4 h-4" />
                          보유 스킬
                        </h3>
                        <div className="space-y-3">
                          <div className={`p-3 rounded-lg ${
                            isDarkMode ? "bg-purple-500/10" : "bg-purple-500/5"
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className={`font-medium ${
                                isDarkMode ? "text-purple-400" : "text-purple-600"
                              }`}>{baseData.skill.name}</h4>
                            </div>
                            <p className={`text-sm mb-2 ${
                              isDarkMode ? "text-gray-300" : "text-gray-700"
                            }`}>
                              {baseData.skill.description}
                            </p>
                            <div className="grid grid-cols-1 gap-2 text-sm">
                              {baseData.skill.skillType === 'heal' ? (
                                // 힐링 스킬 (클로에의 에테르축복)
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1">
                                    <Plus className="w-3 h-3 text-green-400" />
                                    <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>힐링량:</span>
                                  </div>
                                  <span className={isDarkMode ? "font-semibold text-green-400" : "font-semibold text-green-600"}>
                                    {(() => {
                                      const currentAttack = companionData?.attack || baseData.baseAttack;
                                      const healAmount = Math.floor(currentAttack * (baseData.skill?.healMultiplier || 1));
                                      const percentage = Math.floor((baseData.skill?.healMultiplier || 1) * 100);
                                      return `${healAmount} (${percentage}%)`;
                                    })()}
                                  </span>
                                </div>
                              ) : baseData.skill.buffType ? (
                                // 버프 스킬 (피에나의 무의태세, 애비게일의 집중포화)
                                <>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1">
                                      {baseData.skill.buffType === 'attack' ? (
                                        <Shield className="w-3 h-3 text-blue-400" />
                                      ) : (
                                        <Star className="w-3 h-3 text-yellow-400" />
                                      )}
                                      <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>버프 효과:</span>
                                    </div>
                                    <span className={isDarkMode ? "font-semibold text-blue-400" : "font-semibold text-blue-600"}>
                                      {baseData.skill.buffType === 'attack' ? (
                                        `공격력 +${Math.floor((baseData.skill.buffMultiplier - 1) * 100)}%`
                                      ) : baseData.skill.buffType === 'critical' ? (
                                        `크리티컬 +${Math.floor(baseData.skill.buffMultiplier * 100)}%`
                                      ) : (
                                        '알 수 없는 효과'
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1">
                                      <Star className="w-3 h-3 text-purple-400" />
                                      <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>지속 시간:</span>
                                    </div>
                                    <span className={isDarkMode ? "font-semibold text-purple-400" : "font-semibold text-purple-600"}>
                                      {baseData.skill.buffDuration}턴
                                    </span>
                                  </div>
                                </>
                              ) : (
                                // 데미지 스킬 (실의 폭격)
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1">
                                    <Sword className="w-3 h-3 text-orange-400" />
                                    <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>스킬 데미지:</span>
                                  </div>
                                  <span className={isDarkMode ? "font-semibold text-orange-400" : "font-semibold text-orange-600"}>
                                    {(() => {
                                      const currentAttack = companionData?.attack || baseData.baseAttack;
                                      const skillDamage = Math.floor(currentAttack * (baseData.skill?.damageMultiplier || 1));
                                      const percentage = Math.floor((baseData.skill?.damageMultiplier || 1) * 100);
                                      return `${skillDamage} (${percentage}%)`;
                                    })()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })()}
            </div>

            {/* 모달 푸터 */}
            <div className="flex justify-end gap-3 p-6 border-t border-gray-300/20">
              <button
                onClick={closeCompanionModal}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  isDarkMode 
                    ? "bg-gray-700/50 text-gray-300 hover:bg-gray-700" 
                    : "bg-gray-200/50 text-gray-700 hover:bg-gray-200"
                }`}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanionTab;
