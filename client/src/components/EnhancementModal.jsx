import React, { useState, useEffect } from 'react';
import { X, Zap, Gem, AlertTriangle, TrendingUp } from 'lucide-react';

const EnhancementModal = ({ 
  showModal, 
  setShowModal, 
  isDarkMode,
  equipment,
  equipmentType, // 'fishingRod' or 'accessory'
  userAmber,
  onEnhance,
  currentEnhancementLevel = 0,
  currentFailCount = 0
}) => {
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [enhancementResult, setEnhancementResult] = useState(null);
  
  // 한 번에 한 레벨씩만 강화
  const targetLevel = currentEnhancementLevel + 1;

  // 강화 보너스 공식: f(x) = 0.0015x³ + 0.07x² + 1.6x (퍼센트로 표시)
  const calculateEnhancementBonus = (level) => {
    if (level <= 0) return 0;
    return 0.0015 * Math.pow(level, 3) + 0.07 * Math.pow(level, 2) + 1.6 * level;
  };

  // 호박석 비용 계산용 공식: f(x) = 0.35x³ - 0.65x² + 1.3x
  const calculateAmberCostBonus = (level) => {
    if (level <= 0) return 0;
    return 0.35 * Math.pow(level, 3) - 0.65 * Math.pow(level, 2) + 1.3 * level;
  };

  // 장비 등급별 강화 비용 배율 (3차방정식: f(x) = 0.1x³ - 0.5x² + 2x + 0.4)
  const getEquipmentGradeMultiplier = (equipmentName, equipmentType) => {
    if (equipmentType === 'fishingRod') {
      const fishingRodOrder = [
        '나무낚시대', '낡은낚시대', '기본낚시대', '단단한낚시대', '은낚시대', '금낚시대',
        '강철낚시대', '사파이어낚시대', '루비낚시대', '다이아몬드낚시대', '레드다이아몬드낚시대',
        '벚꽃낚시대', '꽃망울낚시대', '호롱불낚시대', '산호등낚시대', '피크닉', '마녀빗자루',
        '에테르낚시대', '별조각낚시대', '여우꼬리낚시대', '초콜릿롤낚시대', '호박유령낚시대',
        '핑크버니낚시대', '할로우낚시대', '여우불낚시대', '네오더스트낚시대', '드림캐쳐',
        '아포카토낚시대', '스윗슈터', '인도하는별빛'
      ];
      const grade = fishingRodOrder.indexOf(equipmentName);
      if (grade === -1) return 1.0;
      // 1차방정식: f(x) = 1.75x + 1.1
      return Math.max(1.0, 1.75 * grade + 1.1);
    } else if (equipmentType === 'accessory') {
      const accessoryOrder = [
        '오래된반지', '은목걸이', '금귀걸이', '마법의펜던트', '에메랄드브로치',
        '토파즈이어링', '자수정팔찌', '백금티아라', '만드라고라허브', '에테르나무묘목',
        '몽마의조각상', '마카롱훈장', '빛나는마력순환체', '갈라진백조인형', '기계천사', '공명하는보석'
      ];
      const grade = accessoryOrder.indexOf(equipmentName);
      if (grade === -1) return 1.0;
      // 1차방정식: f(x) = 1.75x + 1.1
      return Math.max(1.0, 1.75 * grade + 1.1);
    }
    return 1.0;
  };

  // 강화에 필요한 호박석 계산: 공식 * 1 * 장비등급배율 (90% 할인)
  const calculateRequiredAmber = (level, equipmentName, equipmentType) => {
    if (level <= 0) return 0;
    const baseCost = calculateAmberCostBonus(level) * 1; // 호박석 비용은 원래 공식 사용
    const gradeMultiplier = getEquipmentGradeMultiplier(equipmentName, equipmentType);
    return Math.ceil(baseCost * gradeMultiplier);
  };

  // 강화 성공 확률 계산
  const calculateEnhancementSuccessRate = (currentLevel, failCount = 0) => {
    let baseRate;
    
    if (currentLevel === 0) {
      baseRate = 100; // 0강 → 1강: 100%
    } else if (currentLevel <= 20) {
      // 1강~20강: 95%, 90%, 85%, 80%, ... (최소 5%)
      baseRate = Math.max(5, 100 - (currentLevel * 5));
    } else {
      // 21강부터: 4.5%, 4.0%, 3.5%, 3.0%, ... (최소 1%)
      baseRate = Math.max(1, 5 - (currentLevel - 20) * 0.5);
    }
    
    // 실패 횟수에 따른 확률 증가: 원래확률 + (기본확률 * 0.01 * 실패횟수)
    const bonusRate = baseRate * 0.01 * failCount;
    const finalRate = Math.min(100, baseRate + bonusRate);
    
    return {
      baseRate,
      bonusRate,
      finalRate
    };
  };

  // 누적 보너스 계산 (%)
  const calculateTotalBonus = (level) => {
    let totalBonus = 0;
    for (let i = 1; i <= level; i++) {
      totalBonus += calculateEnhancementBonus(i);
    }
    return totalBonus; // %이므로 소수점 유지
  };

  // 장비 기본 스탯 계산
  const getEquipmentBaseStat = () => {
    if (equipmentType === 'fishingRod') {
      // 낚시대 기본 공격력 계산 (실전 공식 사용 - 낚시실력 기반)
      const fishingRodOrder = [
        '나무낚시대', '낡은낚시대', '기본낚시대', '단단한낚시대', '은낚시대', '금낚시대',
        '강철낚시대', '사파이어낚시대', '루비낚시대', '다이아몬드낚시대', '레드다이아몬드낚시대',
        '벚꽃낚시대', '꽃망울낚시대', '호롱불낚시대', '산호등낚시대', '피크닉', '마녀빗자루',
        '에테르낚시대', '별조각낚시대', '여우꼬리낚시대', '초콜릿롤낚시대', '호박유령낚시대',
        '핑크버니낚시대', '할로우낚시대', '여우불낚시대'
      ];
      const fishingRodLevel = fishingRodOrder.indexOf(equipment);
      if (fishingRodLevel === -1) return 3;
      // 낚시실력 기반 공격력: 3차방정식
      const fishingSkillValue = fishingRodLevel; // EnhancementModal에서는 업적 정보가 없으므로 레벨만 사용
      const baseAttack = 0.00225 * Math.pow(fishingSkillValue, 3) + 0.165 * Math.pow(fishingSkillValue, 2) + 2 * fishingSkillValue + 3;
      return Math.floor(baseAttack);
    } else if (equipmentType === 'accessory') {
      // 악세사리 기본 체력 계산
      const accessoryOrder = [
        '오래된반지', '은목걸이', '금귀걸이', '마법의펜던트', '에메랄드브로치',
        '토파즈이어링', '자수정팔찌', '백금티아라', '만드라고라허브', '에테르나무묘목',
        '몽마의조각상', '마카롱훈장', '빛나는마력순환체', '갈라진백조인형', '기계천사', '공명하는보석'
      ];
      const accessoryLevel = accessoryOrder.indexOf(equipment) + 1;
      if (accessoryLevel === 0) return 50;
      return Math.floor(Math.pow(accessoryLevel, 1.525) + 65 * accessoryLevel);
    }
    return 0;
  };

  const amberCost = calculateRequiredAmber(targetLevel, equipment, equipmentType);
  
  const currentTotalBonus = calculateTotalBonus(currentEnhancementLevel);
  const targetTotalBonus = calculateTotalBonus(targetLevel);
  const bonusIncrease = targetTotalBonus - currentTotalBonus;
  
  // 장비 기본 스탯
  const baseStat = getEquipmentBaseStat();
  
  // 실제 추가 스탯 계산
  const currentActualBonus = (baseStat * currentTotalBonus / 100);
  const targetActualBonus = (baseStat * targetTotalBonus / 100);
  const actualBonusIncrease = targetActualBonus - currentActualBonus;
  
  // 강화 성공 확률 정보
  const successRateInfo = calculateEnhancementSuccessRate(currentEnhancementLevel, currentFailCount);
  const { baseRate, bonusRate, finalRate } = successRateInfo;

  const canAfford = userAmber >= amberCost;

  const handleEnhance = async () => {
    // 강화 시작 전에 호박석 부족 체크
    if (!canAfford) {
      alert(`호박석이 부족합니다!\n필요: ${amberCost.toLocaleString()}개\n보유: ${userAmber.toLocaleString()}개`);
      return;
    }
    
    if (isEnhancing) return;

    setIsEnhancing(true);
    setProgress(0);
    setEnhancementResult(null);
    
    try {
      console.log(`🔨 강화 시도: ${equipmentType} ${currentEnhancementLevel} → ${targetLevel}, 비용: ${amberCost}`);
      console.log(`📊 전송 데이터:`, { 
        equipmentType, 
        targetLevel, 
        amberCost, 
        currentEnhancementLevel,
        equipmentName: equipment,
        gradeMultiplier: getEquipmentGradeMultiplier(equipment, equipmentType)
      });
      console.log(`💎 호박석 체크: 보유=${userAmber}, 필요=${amberCost}, 충분=${canAfford}`);
      
      // 5초 프로그레스바 애니메이션
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            return 100;
          }
          return prev + 2; // 50단계로 나누어 5초 (100ms * 50 = 5초)
        });
      }, 100);
      
      // 5초 후 서버에 강화 요청 보내고 결과 처리
      setTimeout(async () => {
        try {
          const result = await onEnhance(equipmentType, targetLevel, amberCost);
          setEnhancementResult(result);
          
          // 결과 표시 후 2초 뒤에 모달 처리
          setTimeout(() => {
            if (result === true) {
              setShowModal(false);
            }
            setIsEnhancing(false);
            setProgress(0);
            setEnhancementResult(null);
          }, 2000);
          
        } catch (error) {
          console.error('강화 실패:', error);
          setEnhancementResult(false);
          setTimeout(() => {
            setIsEnhancing(false);
            setProgress(0);
            setEnhancementResult(null);
          }, 2000);
        }
      }, 5000);
      
    } catch (error) {
      console.error('강화 실패:', error);
      setIsEnhancing(false);
      setProgress(0);
      setEnhancementResult(null);
    }
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`max-w-md w-full rounded-2xl overflow-hidden ${
        isDarkMode 
          ? "glass-card border border-white/10" 
          : "bg-white/95 backdrop-blur-md border border-gray-300/30"
      }`}>
        {/* 헤더 */}
        <div className={`p-6 border-b ${
          isDarkMode ? "border-white/10" : "border-gray-300/20"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                equipmentType === 'fishingRod' 
                  ? "bg-gradient-to-br from-blue-500/20 to-cyan-500/20"
                  : "bg-gradient-to-br from-purple-500/20 to-pink-500/20"
              }`}>
                {equipmentType === 'fishingRod' ? (
                  <Zap className={`w-5 h-5 ${
                    isDarkMode ? "text-blue-400" : "text-blue-600"
                  }`} />
                ) : (
                  <Gem className={`w-5 h-5 ${
                    isDarkMode ? "text-purple-400" : "text-purple-600"
                  }`} />
                )}
              </div>
              <div>
                <h2 className={`text-lg font-bold ${
                  isDarkMode ? "text-white" : "text-gray-800"
                }`}>장비 강화</h2>
                <p className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}>{equipment}</p>
              </div>
            </div>
            <button
              onClick={() => setShowModal(false)}
              className={`p-2 rounded-full transition-all duration-300 ${
                isDarkMode 
                  ? "hover:bg-white/10 text-gray-400 hover:text-white" 
                  : "hover:bg-gray-100 text-gray-600 hover:text-gray-800"
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 컨텐츠 */}
        <div className="p-6 space-y-6">
          {/* 현재 상태 */}
          <div className={`p-4 rounded-lg ${
            isDarkMode ? "bg-gray-800/50 border border-gray-700/30" : "bg-gray-100/80 border border-gray-300/30"
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}>현재 강화 레벨</span>
              <span className={`text-lg font-bold ${
                isDarkMode ? "text-white" : "text-gray-800"
              }`}>+{currentEnhancementLevel}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className={`text-sm font-medium ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}>
                현재 추가 {equipmentType === 'fishingRod' ? '공격력' : '체력'}
              </span>
              <span className={`text-sm font-bold ${
                equipmentType === 'fishingRod' 
                  ? isDarkMode ? "text-blue-400" : "text-blue-600"
                  : isDarkMode ? "text-purple-400" : "text-purple-600"
              }`}>
                +{currentActualBonus.toFixed(1)} ({currentTotalBonus.toFixed(1)}%)
              </span>
            </div>
          </div>

          {/* 강화 성공 확률 */}
          <div className={`p-4 rounded-lg ${
            isDarkMode ? "bg-blue-500/10 border border-blue-400/30" : "bg-blue-50 border border-blue-300/50"
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`text-2xl ${finalRate >= 50 ? '🎯' : finalRate >= 20 ? '🎲' : '🔥'}`}></div>
              <div>
                <div className={`text-lg font-bold ${
                  isDarkMode ? "text-blue-400" : "text-blue-600"
                }`}>
                  성공 확률: {finalRate.toFixed(1)}%
                </div>
                <div className={`text-xs ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}>
                  +{currentEnhancementLevel} → +{targetLevel}
                </div>
              </div>
            </div>
            
            {/* 확률 세부 정보 */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className={`${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
                  기본 확률
                </span>
                <span className={`font-medium ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                  {baseRate}%
                </span>
              </div>
              {bonusRate > 0 && (
                <div className="flex justify-between">
                  <span className={`${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
                    실패 보너스 ({currentFailCount}회)
                  </span>
                  <span className={`font-medium ${isDarkMode ? "text-green-400" : "text-green-600"}`}>
                    +{bonusRate.toFixed(1)}%
                  </span>
                </div>
              )}
              <div className={`border-t pt-1 mt-2 ${
                isDarkMode ? "border-gray-600" : "border-gray-300"
              }`}>
                <div className="flex justify-between">
                  <span className={`font-medium ${isDarkMode ? "text-gray-200" : "text-gray-800"}`}>
                    최종 확률
                  </span>
                  <span className={`font-bold text-lg ${
                    isDarkMode ? "text-blue-400" : "text-blue-600"
                  }`}>
                    {finalRate.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 강화 결과 미리보기 */}
          <div className={`p-4 rounded-lg border-2 ${
            isDarkMode 
              ? "bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-400/30" 
              : "bg-gradient-to-r from-green-50 to-emerald-50 border-green-300/50"
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className={`w-4 h-4 ${
                isDarkMode ? "text-green-400" : "text-green-600"
              }`} />
              <span className={`text-sm font-medium ${
                isDarkMode ? "text-green-400" : "text-green-600"
              }`}>강화 후 효과</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={`text-sm ${
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                }`}>
                  추가 {equipmentType === 'fishingRod' ? '공격력' : '체력'}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}>
                    +{currentActualBonus.toFixed(1)} ({currentTotalBonus.toFixed(1)}%)
                  </span>
                  <span className={`text-sm ${
                    isDarkMode ? "text-gray-500" : "text-gray-400"
                  }`}>→</span>
                  <span className={`text-sm font-bold ${
                    isDarkMode ? "text-green-400" : "text-green-600"
                  }`}>
                    +{targetActualBonus.toFixed(1)} ({targetTotalBonus.toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 비용 */}
          <div className={`p-4 rounded-lg ${
            isDarkMode ? "bg-gray-800/50 border border-gray-700/30" : "bg-gray-100/80 border border-gray-300/30"
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}>필요한 호박석 {getEquipmentGradeMultiplier(equipment, equipmentType) > 1.0 ? `(등급배율: ${getEquipmentGradeMultiplier(equipment, equipmentType).toFixed(1)}x)` : ''}</span>
              <div className="flex items-center gap-2">
                <Gem className={`w-4 h-4 ${
                  isDarkMode ? "text-orange-400" : "text-orange-600"
                }`} />
                <span className={`text-sm font-bold ${
                  canAfford 
                    ? isDarkMode ? "text-white" : "text-gray-800"
                    : isDarkMode ? "text-red-400" : "text-red-600"
                }`}>
                  {amberCost.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className={`text-sm font-medium ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}>보유 호박석</span>
              <span className={`text-sm font-bold ${
                isDarkMode ? "text-orange-400" : "text-orange-600"
              }`}>
                {userAmber.toLocaleString()}
              </span>
            </div>
          </div>

          {/* 경고 메시지 */}
          {!canAfford && (
            <div className={`p-3 rounded-lg flex items-center gap-2 ${
              isDarkMode 
                ? "bg-red-500/10 border border-red-400/30" 
                : "bg-red-50 border border-red-300/50"
            }`}>
              <AlertTriangle className={`w-4 h-4 ${
                isDarkMode ? "text-red-400" : "text-red-600"
              }`} />
              <span className={`text-sm ${
                isDarkMode ? "text-red-400" : "text-red-600"
              }`}>
                호박석이 부족합니다
              </span>
            </div>
          )}

          {/* 프로그레스바 (강화 중일 때만 표시) */}
          {isEnhancing && (
            <div className={`p-4 rounded-lg ${
              isDarkMode ? "bg-gray-800/50 border border-gray-700/30" : "bg-gray-100/80 border border-gray-300/30"
            }`}>
              <div className="flex items-center justify-center mb-2">
                <span className={`text-sm font-medium ${
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                }`}>강화 진행 중...</span>
              </div>
              
              {/* 프로그레스바 */}
              <div className={`w-full h-4 rounded-full overflow-hidden ${
                isDarkMode ? "bg-gray-700" : "bg-gray-200"
              }`}>
                <div
                  className={`h-full transition-all duration-100 ease-out ${
                    progress < 100 
                      ? "bg-gradient-to-r from-blue-500 to-cyan-500"
                      : enhancementResult === true
                        ? "bg-gradient-to-r from-green-500 to-emerald-500"
                        : enhancementResult === false
                          ? "bg-gradient-to-r from-red-500 to-red-600"
                          : "bg-gradient-to-r from-yellow-500 to-orange-500"
                  }`}
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              
              {/* 결과 표시 */}
              {progress >= 100 && enhancementResult !== null && (
                <div className={`mt-3 text-center text-sm font-bold ${
                  enhancementResult === true
                    ? isDarkMode ? "text-green-400" : "text-green-600"
                    : isDarkMode ? "text-red-400" : "text-red-600"
                }`}>
                  {enhancementResult === true ? '🎉 강화 성공!' : '💥 강화 실패...'}
                </div>
              )}
            </div>
          )}

          {/* 강화 버튼 */}
          <button
            onClick={handleEnhance}
            disabled={!canAfford || isEnhancing}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-300 ${
              canAfford && !isEnhancing
                ? isDarkMode
                  ? "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                  : "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                : isDarkMode
                  ? "bg-gray-700/50 text-gray-500 cursor-not-allowed"
                  : "bg-gray-300/50 text-gray-500 cursor-not-allowed"
            }`}
          >
            {isEnhancing ? '강화 중...' : `+${targetLevel} 강화 시도 (${finalRate.toFixed(1)}%)`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnhancementModal;
