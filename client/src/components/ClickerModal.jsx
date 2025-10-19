import React, { useState, useEffect, useRef } from 'react';
import { X, Sword, Heart, Trophy } from 'lucide-react';

const ClickerModal = ({
  onClose,
  isDarkMode,
  fishingSkill,
  userEquipment,
  getAttackRange,
  calculateTotalEnhancementBonus,
  setInventory,
  materials,
  setMaterials,
  serverUrl,
  authenticatedRequest,
  username,
  userUuid,
  setMessages
}) => {
  // 스테이지 및 난이도
  const [currentStage, setCurrentStage] = useState(1);
  const [difficulty, setDifficulty] = useState(1);
  const [completedDifficulties, setCompletedDifficulties] = useState({});
  const [gameStarted, setGameStarted] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
  // 몬스터 상태
  const [monsterHp, setMonsterHp] = useState(0);
  const [maxMonsterHp, setMaxMonsterHp] = useState(0);
  
  // 애니메이션 상태
  const [damageNumbers, setDamageNumbers] = useState([]);
  const [isShaking, setIsShaking] = useState(false);
  
  // 자동 회복 타이머
  const healTimerRef = useRef(null);
  
  // 보상 상태
  const [showReward, setShowReward] = useState(false);
  const [rewards, setRewards] = useState([]);
  
  // 클릭 처리 중 상태
  const [isProcessing, setIsProcessing] = useState(false);

  // 스테이지 정보 로드
  useEffect(() => {
    const loadStage = async () => {
      try {
        const response = await authenticatedRequest.get(`${serverUrl}/api/clicker/stage`);
        if (response.data.success) {
          setCurrentStage(response.data.currentStage);
          setCompletedDifficulties(response.data.completedDifficulties || {});
        }
      } catch (error) {
        console.error('스테이지 로드 실패:', error);
      }
    };
    loadStage();
  }, [serverUrl, authenticatedRequest]);

  // 플레이어 공격력 계산 (내정보와 완전히 동일)
  const getPlayerAttack = () => {
    // 강화 보너스 계산
    const fishingRodEnhancement = userEquipment?.fishingRodEnhancement || 0;
    const enhancementBonus = calculateTotalEnhancementBonus ? calculateTotalEnhancementBonus(fishingRodEnhancement) : 0;
    
    // getAttackRange 함수 사용 (내정보와 완전히 동일)
    if (getAttackRange) {
      const attackRange = getAttackRange(fishingSkill, enhancementBonus);
      return attackRange.base;
    }
    
    // fallback: 직접 계산
    const baseAttack = 0.00225 * Math.pow(fishingSkill, 3) + 0.165 * Math.pow(fishingSkill, 2) + 2 * fishingSkill + 3;
    const totalAttack = baseAttack + (baseAttack * enhancementBonus / 100);
    return Math.floor(totalAttack);
  };

  // 난이도별 몬스터 체력 계산 (고정값, 공격력 무관, 20%로 감소)
  const getMonsterHp = (stageLevel, difficultyLevel) => {
    // 3차방정식 계수: 0.1 × d³ + 1 × d² + 10 × d
    const multiplier = 0.1 * Math.pow(difficultyLevel, 3) + 
                      1 * Math.pow(difficultyLevel, 2) + 
                      10 * difficultyLevel;
    // 기본 체력 (공격력 10 기준으로 고정, 20%로 감소)
    const baseHp = Math.floor(10 * multiplier * 0.2);
    
    // 스테이지별 배수 계산
    if (stageLevel === 1) {
      return baseHp;
    }
    
    // 각 스테이지의 1난이도는 이전 스테이지의 3난이도 × 1.13
    // 예: 2-1 = 1-3 × 1.13, 3-1 = 2-3 × 1.13
    const stage3Multiplier = 0.1 * Math.pow(3, 3) + 1 * Math.pow(3, 2) + 10 * 3; // 42.7
    const stage3Hp = Math.floor(10 * stage3Multiplier * 0.2);
    
    // 스테이지 증가에 따른 누적 배수 (1.13씩 누적)
    const cumulativeStageMultiplier = Math.pow(1.13, stageLevel - 1);
    const stage1BaseHp = Math.floor(stage3Hp * cumulativeStageMultiplier);
    
    // 현재 난이도에 맞게 조정
    // 1난이도를 기준으로 현재 난이도의 비율만큼 증가
    const stage1Multiplier = 0.1 * Math.pow(1, 3) + 1 * Math.pow(1, 2) + 10 * 1; // 11.1
    const difficultyRatio = multiplier / stage1Multiplier;
    
    return Math.floor(stage1BaseHp * difficultyRatio);
  };

  // 게임 시작
  const startGame = () => {
    if (difficulty < 1) {
      alert('난이도는 최소 1 이상이어야 합니다.');
      return;
    }
    if (difficulty > 10) {
      alert('난이도는 최대 10까지 가능합니다.');
      return;
    }
    const hp = getMonsterHp(currentStage, difficulty);
    setMonsterHp(hp);
    setMaxMonsterHp(hp);
    setGameStarted(true);
    setShowReward(false);
    setRewards([]);
    
    // 스테이지 2 이상에서 자동 회복 시작
    if (currentStage >= 2) {
      startAutoHeal(hp);
    }
  };
  
  // 스테이지별 회복량 계산 (해당 스테이지 1난이도 체력의 10%)
  const getHealAmount = (stageLevel) => {
    if (stageLevel < 2) return 0;
    // 해당 스테이지의 1난이도 체력 계산
    const stage1Hp = getMonsterHp(stageLevel, 1);
    return Math.floor(stage1Hp * 0.1);
  };

  // 자동 회복 시작 (스테이지 2+)
  const startAutoHeal = (maxHp) => {
    if (healTimerRef.current) {
      clearInterval(healTimerRef.current);
    }
    
    healTimerRef.current = setInterval(() => {
      setMonsterHp(prev => {
        if (prev >= maxHp) return prev;
        if (prev <= 0) return prev;
        // 해당 스테이지 1난이도 체력의 1% 회복
        const healAmount = getHealAmount(currentStage);
        
        // 회복 애니메이션 표시
        const healId = Date.now() + Math.random();
        setDamageNumbers(prevDmg => [...prevDmg, {
          id: healId,
          damage: `+${healAmount}`,
          x: Math.random() * 200 + 100,
          y: Math.random() * 100 + 150,
          isCritical: false,
          isHeal: true
        }]);
        
        setTimeout(() => {
          setDamageNumbers(prevDmg => prevDmg.filter(d => d.id !== healId));
        }, 1000);
        
        return Math.min(maxHp, prev + healAmount);
      });
    }, 1000); // 1초마다 회복
  };
  
  // 자동 회복 정지
  const stopAutoHeal = () => {
    if (healTimerRef.current) {
      clearInterval(healTimerRef.current);
      healTimerRef.current = null;
    }
  };
  
  // 게임 종료 시 타이머 정리
  useEffect(() => {
    return () => {
      stopAutoHeal();
    };
  }, []);
  
  // 몬스터 처치 시 타이머 정지
  useEffect(() => {
    if (monsterHp <= 0) {
      stopAutoHeal();
    }
  }, [monsterHp]);

  // 몬스터 클릭 핸들러
  const handleMonsterClick = (e) => {
    if (!gameStarted || monsterHp <= 0 || isProcessing) return;

    // 데미지 범위 ±20% 적용
    const baseAttack = getPlayerAttack();
    const minDamage = Math.floor(baseAttack * 0.8);
    const maxDamage = Math.floor(baseAttack * 1.2);
    const damage = Math.floor(Math.random() * (maxDamage - minDamage + 1)) + minDamage;
    
    const newHp = Math.max(0, monsterHp - damage);
    setMonsterHp(newHp);

    // 데미지 숫자 애니메이션
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const damageId = Date.now() + Math.random();
    setDamageNumbers(prev => [...prev, {
      id: damageId,
      damage,
      x,
      y,
      isCritical: false
    }]);

    // 흔들림 효과
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 100);

    // 데미지 숫자 제거
    setTimeout(() => {
      setDamageNumbers(prev => prev.filter(d => d.id !== damageId));
    }, 1000);

    // 몬스터 처치 확인
    if (newHp === 0) {
      handleMonsterDefeated();
    }
  };

  // 몬스터 처치 처리
  const handleMonsterDefeated = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const response = await authenticatedRequest.post(`${serverUrl}/api/clicker/reward`, {
        difficulty,
        stage: currentStage,
        username,
        userUuid
      });

      if (response.data.success) {
        setRewards(response.data.rewards);
        setShowReward(true);
        
        // 난이도 완료 기록 업데이트
        setCompletedDifficulties(prev => {
          const current = prev[currentStage] || 0;
          if (difficulty > current) {
            return { ...prev, [currentStage]: difficulty };
          }
          return prev;
        });
        
        // 인벤토리 갱신 (다른 곳과 동일한 방식)
        try {
          const inventoryResponse = await authenticatedRequest.get(`${serverUrl}/api/inventory/user`, {
            params: { username, userUuid }
          });
          
          const safeInventory = Array.isArray(inventoryResponse.data) ? inventoryResponse.data : [];
          setInventory(safeInventory);
        } catch (invError) {
          console.error('Failed to refresh inventory:', invError);
        }

        // 채팅에 시스템 메시지 추가
        if (setMessages) {
          setMessages(prev => [...prev, {
            system: true,
            content: `에테르 던전 ${currentStage}-${difficulty}: ${response.data.rewards.map(r => `${r.name} x${r.count}`).join(', ')} 획득!`,
            timestamp: new Date().toISOString()
          }]);
        }
      }
    } catch (error) {
      console.error('클리커 보상 처리 실패:', error);
      const errorMsg = error.response?.data?.details || error.response?.data?.error || '보상 처리에 실패했습니다.';
      alert(`보상 처리 실패: ${errorMsg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 난이도 색상 (1-10 기준)
  const getDifficultyColor = () => {
    if (difficulty <= 3) {
      return isDarkMode ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-green-500/10 border-green-500/50 text-green-600';
    } else if (difficulty <= 6) {
      return isDarkMode ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400' : 'bg-yellow-500/10 border-yellow-500/50 text-yellow-600';
    } else {
      return isDarkMode ? 'bg-red-500/20 border-red-500/50 text-red-400' : 'bg-red-500/10 border-red-500/50 text-red-600';
    }
  };

  // 스테이지 업그레이드 처리
  const handleUpgradeStage = async () => {
    try {
      const response = await authenticatedRequest.post(`${serverUrl}/api/clicker/upgrade-stage`);
      if (response.data.success) {
        alert(response.data.message);
        setCurrentStage(response.data.newStage);
        setShowUpgradeModal(false);
        setDifficulty(1); // 난이도 초기화
        
        // 재료 갱신
        try {
          const materialsResponse = await authenticatedRequest.get(`${serverUrl}/api/materials/user`, {
            params: { username, userUuid }
          });
          if (Array.isArray(materialsResponse.data)) {
            setMaterials(materialsResponse.data);
          }
        } catch (matError) {
          console.error('Failed to refresh materials:', matError);
        }
      }
    } catch (error) {
      console.error('스테이지 업그레이드 실패:', error);
      const errorMsg = error.response?.data?.error || '스테이지 업그레이드에 실패했습니다.';
      alert(errorMsg);
    }
  };
  
  // 재료 개수 확인
  const getMaterialCount = (materialName) => {
    const material = materials.find(m => m.material === materialName);
    return material?.count || 0;
  };

  // 필요한 재료 정보
  const getRequiredMaterial = () => {
    const fishData = [
      { rank: 1, name: '타코문어', material: '문어다리' },
      { rank: 2, name: '풀고등어', material: '고등어비늘' },
      { rank: 3, name: '경단붕어', material: '당고' },
      { rank: 4, name: '버터오징어', material: '버터조각' },
      { rank: 5, name: '간장새우', material: '간장종지' },
      { rank: 6, name: '물수수', material: '옥수수콘' },
      { rank: 7, name: '정어리파이', material: '버터' },
      { rank: 8, name: '얼음상어', material: '얼음조각' },
      { rank: 9, name: '스퀄스퀴드', material: '오징어먹물' },
      { rank: 10, name: '백년송거북', material: '백년송' }
    ];
    return fishData.find(f => f.rank === currentStage);
  };

  return (
    <>
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`max-w-2xl w-full rounded-2xl border-2 ${
        isDarkMode 
          ? "bg-gray-900/95 border-purple-500/30" 
          : "bg-white/95 border-purple-300/50"
      } backdrop-blur-md overflow-hidden`}>
        {/* 헤더 */}
        <div className={`p-6 border-b ${
          isDarkMode ? "border-white/10" : "border-gray-300/20"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h3 className={`text-xl font-bold ${
                  isDarkMode ? "text-purple-300" : "text-purple-700"
                }`}>
                  에테르 던전
                </h3>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    isDarkMode ? "bg-purple-500/20 text-purple-300" : "bg-purple-500/10 text-purple-700"
                  }`}>
                    Stage {currentStage}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    isDarkMode ? "bg-blue-500/20 text-blue-300" : "bg-blue-500/10 text-blue-700"
                  }`}>
                    Best: {completedDifficulties[currentStage] || 0}/10
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                stopAutoHeal();
                onClose();
              }}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode 
                  ? "hover:bg-white/10 text-gray-400 hover:text-white" 
                  : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="p-6">
          {!gameStarted ? (
            // 난이도 선택 화면 - Elegant Minimal Design
            <div className="space-y-8">
              {/* 메인 선택 영역 */}
              <div className={`relative p-10 rounded-3xl ${
                isDarkMode 
                  ? "bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90" 
                  : "bg-gradient-to-br from-white via-slate-50 to-white"
              } shadow-2xl border ${
                isDarkMode ? "border-slate-700/50" : "border-slate-200/50"
              }`}>
                {/* 난이도 대형 디스플레이 */}
                <div className="text-center mb-8">
                  <div className={`text-9xl font-black ${
                    isDarkMode ? "text-white" : "text-slate-900"
                  } mb-3`}>
                    {currentStage}
                    <span className={`text-5xl mx-2 ${
                      isDarkMode ? "text-slate-600" : "text-slate-400"
                    }`}>-</span>
                    {difficulty}
                  </div>
                  {/* 난이도 뱃지 */}
                  <div className={`inline-block px-6 py-2 rounded-full font-bold ${
                    difficulty <= 3
                      ? "bg-green-500/20 text-green-500 border border-green-500/50"
                      : difficulty <= 6
                      ? "bg-yellow-500/20 text-yellow-500 border border-yellow-500/50"
                      : "bg-red-500/20 text-red-500 border border-red-500/50"
                  }`}>
                    {difficulty <= 3 ? '초급' : difficulty <= 6 ? '중급' : '고급'}
                  </div>
                </div>

                {/* 정보 테이블 */}
                <div className={`space-y-3 mb-8 ${
                  isDarkMode ? "text-slate-300" : "text-slate-700"
                }`}>
                  <div className="flex items-center justify-between py-3 border-b border-dashed border-slate-600/30">
                    <span className="text-sm font-medium opacity-70">몬스터 체력</span>
                    <span className="text-2xl font-bold">{getMonsterHp(currentStage, difficulty).toLocaleString()}</span>
                  </div>
                  
                  {currentStage >= 2 && (
                    <div className="flex items-center justify-between py-3 border-b border-dashed border-slate-600/30">
                      <span className="text-sm font-medium opacity-70">초당 회복</span>
                      <span className="text-2xl font-bold text-red-500">+{getHealAmount(currentStage)}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between py-3">
                    <span className="text-sm font-medium opacity-70">보상 물고기</span>
                    <span className="text-2xl font-bold text-blue-500">×{difficulty === 1 ? '1' : `${difficulty - 1}~${difficulty}`}</span>
                  </div>
                </div>

                {/* 난이도 그리드 선택 */}
                <div className="grid grid-cols-10 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(level => (
                    <button
                      key={level}
                      onClick={() => setDifficulty(level)}
                      className={`aspect-square rounded-xl font-bold text-lg transition-all duration-300 ${
                        difficulty === level
                          ? (isDarkMode 
                            ? "bg-white text-slate-900 shadow-lg shadow-white/30 scale-110" 
                            : "bg-slate-900 text-white shadow-lg shadow-slate-900/30 scale-110")
                          : level < difficulty
                            ? (isDarkMode ? "bg-slate-700/50 text-slate-500" : "bg-slate-200 text-slate-400")
                            : (isDarkMode 
                              ? "bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-white hover:scale-105" 
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 hover:scale-105")
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* 공격력 정보 - 미니멀 */}
              <div className={`p-5 rounded-2xl ${
                isDarkMode ? "bg-slate-800/30" : "bg-slate-100/50"
              } border-l-4 ${
                isDarkMode ? "border-orange-500" : "border-orange-600"
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`text-xs font-medium mb-1 ${
                      isDarkMode ? "text-slate-400" : "text-slate-600"
                    }`}>
                      공격력
                    </div>
                    <div className={`text-3xl font-black ${
                      isDarkMode ? "text-white" : "text-slate-900"
                    }`}>
                      {getPlayerAttack()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-medium mb-1 ${
                      isDarkMode ? "text-slate-500" : "text-slate-600"
                    }`}>
                      범위
                    </div>
                    <div className={`text-lg font-bold ${
                      isDarkMode ? "text-slate-300" : "text-slate-700"
                    }`}>
                      {Math.floor(getPlayerAttack() * 0.8)} ~ {Math.floor(getPlayerAttack() * 1.2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* 시작 버튼 */}
              <button
                onClick={startGame}
                className={`w-full py-6 rounded-2xl font-black text-2xl transition-all duration-300 hover:scale-[1.02] ${
                  isDarkMode 
                    ? "bg-white text-slate-900 hover:shadow-2xl hover:shadow-white/20" 
                    : "bg-slate-900 text-white hover:shadow-2xl hover:shadow-slate-900/30"
                }`}
              >
                전투 시작
              </button>

              {/* 스테이지 업그레이드 버튼 */}
              {(completedDifficulties[currentStage] >= 10) && (
                <button
                  onClick={() => {
                    if (currentStage + 1 > fishingSkill) {
                      alert(`낚시실력이 부족합니다.\n\n필요 낚시실력: ${currentStage + 1}\n현재 낚시실력: ${fishingSkill}`);
                      return;
                    }
                    setShowUpgradeModal(true);
                  }}
                  disabled={currentStage + 1 > fishingSkill}
                  className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 ${
                    currentStage + 1 > fishingSkill
                      ? (isDarkMode 
                        ? "bg-gray-700/50 text-gray-500 border-2 border-gray-600/50 cursor-not-allowed" 
                        : "bg-gray-300/50 text-gray-500 border-2 border-gray-400/50 cursor-not-allowed")
                      : (isDarkMode 
                        ? "bg-green-500/20 text-green-400 border-2 border-green-500/50 hover:bg-green-500/30 hover:scale-[1.02]" 
                        : "bg-green-500/10 text-green-700 border-2 border-green-500/50 hover:bg-green-500/20 hover:scale-[1.02]")
                  }`}
                >
                  {currentStage + 1 > fishingSkill 
                    ? `스테이지 ${currentStage + 1} (낚시실력 ${currentStage + 1} 필요)` 
                    : `스테이지 ${currentStage + 1} 잠금해제`
                  }
                </button>
              )}
            </div>
          ) : showReward ? (
            // 보상 화면 - Premium Design
            <div className="space-y-6">
              {/* 승리 애니메이션 */}
              <div className={`relative overflow-hidden rounded-3xl p-8 text-center ${
                isDarkMode 
                  ? "bg-gradient-to-br from-yellow-900/30 via-orange-900/30 to-yellow-900/30" 
                  : "bg-gradient-to-br from-yellow-50 via-orange-50 to-yellow-50"
              } border-2 ${
                isDarkMode ? "border-yellow-500/30" : "border-yellow-400/50"
              }`}>
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 via-orange-500/10 to-yellow-500/5 animate-pulse" />
                
                <div className="relative z-10">
                  <div className={`text-6xl font-black mb-3 bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-400 bg-clip-text text-transparent`}>
                    승리
                  </div>
                  <div className={`text-lg font-semibold ${
                    isDarkMode ? "text-yellow-300" : "text-yellow-700"
                  }`}>
                    {currentStage}-{difficulty} 클리어!
                  </div>
                </div>
              </div>

              {/* 보상 카드 */}
              <div className={`rounded-2xl overflow-hidden ${
                isDarkMode ? "bg-gray-800/50" : "bg-white/80"
              } border ${
                isDarkMode ? "border-gray-700" : "border-gray-200"
              }`}>
                <div className={`px-5 py-3 border-b ${
                  isDarkMode ? "bg-blue-500/10 border-gray-700" : "bg-blue-50/50 border-gray-200"
                }`}>
                  <h5 className={`font-bold text-sm ${
                    isDarkMode ? "text-blue-300" : "text-blue-700"
                  }`}>
                    획득한 보상
                  </h5>
                </div>
                <div className="p-4 space-y-2">
                  {rewards.map((reward, index) => (
                    <div key={index} className={`flex items-center justify-between p-4 rounded-xl ${
                      isDarkMode 
                        ? "bg-gradient-to-r from-gray-700/50 to-gray-800/50 border border-gray-600/30" 
                        : "bg-gradient-to-r from-white to-gray-50 border border-gray-200"
                    } shadow-sm`}>
                      <span className={`text-lg font-bold ${
                        isDarkMode ? "text-white" : "text-gray-900"
                      }`}>
                        {reward.name}
                      </span>
                      <span className={`px-4 py-1 rounded-full font-bold ${
                        isDarkMode 
                          ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" 
                          : "bg-blue-100 text-blue-700 border border-blue-300"
                      }`}>
                        ×{reward.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 다시 하기 버튼 */}
              <button
                onClick={() => {
                  setGameStarted(false);
                  setShowReward(false);
                }}
                className={`relative w-full py-4 rounded-2xl font-bold text-lg overflow-hidden group transition-all duration-300 hover:scale-[1.02] shadow-xl ${
                  isDarkMode 
                    ? "bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600 hover:shadow-purple-500/50 text-white" 
                    : "bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 hover:shadow-purple-400/50 text-white"
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <span className="relative">다시 도전하기</span>
              </button>
            </div>
          ) : (
            // 게임 화면 - Premium Design
            <div className="space-y-5">
              {/* HP 바 카드 */}
              <div className={`rounded-2xl overflow-hidden ${
                isDarkMode ? "bg-gray-800/50 border border-gray-700" : "bg-white/80 border border-gray-200"
              } shadow-xl`}>
                <div className={`px-5 py-3 flex items-center justify-between ${
                  isDarkMode ? "bg-gradient-to-r from-purple-900/30 to-blue-900/30" : "bg-gradient-to-r from-purple-50 to-blue-50"
                }`}>
                  <div className={`font-black text-lg tracking-tight ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}>
                    {currentStage}-{difficulty}
                  </div>
                  <div className={`text-sm font-bold ${
                    isDarkMode ? "text-gray-300" : "text-gray-700"
                  }`}>
                    {monsterHp.toLocaleString()} <span className="opacity-50">/</span> {maxMonsterHp.toLocaleString()}
                  </div>
                </div>
                
                {/* HP 바 */}
                <div className="p-4">
                  <div className="relative h-6 rounded-full overflow-hidden bg-gradient-to-r from-gray-800 to-gray-700">
                    <div 
                      className="absolute inset-0 bg-gradient-to-r from-red-500 via-pink-500 to-red-500 transition-all duration-300 shadow-lg"
                      style={{ width: `${(monsterHp / maxMonsterHp) * 100}%` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent" />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-bold text-white drop-shadow-lg">
                        {Math.round((monsterHp / maxMonsterHp) * 100)}%
                      </span>
                    </div>
                  </div>
                  
                  {/* 회복 경고 */}
                  {currentStage >= 2 && (
                    <div className={`mt-3 text-center text-xs font-semibold ${
                      isDarkMode ? "text-red-400" : "text-red-600"
                    }`}>
                      1초마다 +{getHealAmount(currentStage)} HP 회복 중
                    </div>
                  )}
                </div>
              </div>

              {/* 몬스터 */}
              <div className="relative">
                <button
                  onClick={handleMonsterClick}
                  disabled={monsterHp <= 0 || isProcessing}
                  className={`w-full aspect-square relative overflow-hidden rounded-2xl border-4 transition-all duration-100 ${
                    monsterHp <= 0 
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'cursor-pointer'
                  } ${
                    isShaking ? 'animate-shake' : ''
                  } ${
                    isDarkMode 
                      ? "border-purple-500/30 bg-gradient-to-br from-purple-900/30 via-blue-900/20 to-pink-900/30" 
                      : "border-purple-300/50 bg-gradient-to-br from-purple-100/50 via-blue-100/30 to-pink-100/50"
                  }`}
                >
                  <img 
                    src="/assets/images/a466886577be4425b8b222800ed472.png"
                    alt="Monster"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      // 이미지 로드 실패 시 대체 텍스트 표시
                      e.target.style.display = 'none';
                      e.target.parentElement.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 3rem; font-weight: bold; color: #888;">Monster</div>';
                    }}
                  />
                  
                  {/* 데미지/회복 숫자들 */}
                  {damageNumbers.map(dmg => (
                    <div
                      key={dmg.id}
                      className={`absolute font-bold text-3xl animate-float-up pointer-events-none ${
                        dmg.isHeal ? 'text-green-500' : 'text-red-500'
                      }`}
                      style={{
                        left: `${dmg.x}px`,
                        top: `${dmg.y}px`,
                        textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
                      }}
                    >
                      {dmg.isHeal ? dmg.damage : `-${dmg.damage}`}
                    </div>
                  ))}
                </button>

                {monsterHp > 0 && (
                  <p className={`text-center mt-4 text-sm ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}>
                    몬스터를 클릭하여 공격하세요!
                  </p>
                )}
              </div>

              {/* 포기 버튼 */}
              <button
                onClick={() => {
                  setGameStarted(false);
                  setDifficulty(1);
                  stopAutoHeal();
                }}
                className={`w-full py-3 rounded-xl text-sm font-semibold transition-all duration-300 hover:scale-[1.02] ${
                  isDarkMode 
                    ? "bg-gray-800/50 hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 border border-gray-700" 
                    : "bg-white/50 hover:bg-white/80 text-gray-600 hover:text-gray-900 border border-gray-300"
                }`}
              >
                포기하기
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 애니메이션 및 슬라이더 스타일 */}
      <style jsx>{`
        @keyframes float-up {
          0% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(-100px);
          }
        }
        .animate-float-up {
          animation: float-up 1s ease-out forwards;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.1s ease-in-out;
        }
        
      `}</style>
    </div>

    {/* 스테이지 업그레이드 모달 - Premium Design */}
    {showUpgradeModal && (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[60] p-4">
        <div className={`max-w-lg w-full rounded-3xl overflow-hidden ${
          isDarkMode 
            ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-2 border-green-500/30" 
            : "bg-gradient-to-br from-white via-gray-50 to-white border-2 border-green-400/50"
        } shadow-2xl`}>
          {/* 헤더 */}
          <div className={`px-6 py-5 ${
            isDarkMode 
              ? "bg-gradient-to-r from-green-900/40 to-emerald-900/40" 
              : "bg-gradient-to-r from-green-100 to-emerald-100"
          } border-b ${
            isDarkMode ? "border-gray-700" : "border-gray-200"
          }`}>
            <h3 className={`text-2xl font-black text-center bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent`}>
              스테이지 업그레이드
            </h3>
          </div>
          
          <div className="p-6 space-y-5">
            {/* 스테이지 비교 */}
            <div className="flex items-center justify-center gap-4">
              <div className={`px-6 py-4 rounded-2xl ${
                isDarkMode ? "bg-gray-800/50" : "bg-gray-100"
              } border ${
                isDarkMode ? "border-gray-700" : "border-gray-200"
              }`}>
                <div className={`text-xs font-medium mb-1 text-center ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}>현재</div>
                <div className={`text-4xl font-black ${
                  isDarkMode ? "text-white" : "text-gray-900"
                }`}>{currentStage}</div>
              </div>
              
              <div className={`text-3xl font-bold ${
                isDarkMode ? "text-green-400" : "text-green-600"
              }`}>→</div>
              
              <div className={`px-6 py-4 rounded-2xl ${
                isDarkMode 
                  ? "bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-2 border-green-500/50" 
                  : "bg-gradient-to-br from-green-100 to-emerald-100 border-2 border-green-400/50"
              } shadow-lg`}>
                <div className={`text-xs font-medium mb-1 text-center ${
                  isDarkMode ? "text-green-400" : "text-green-700"
                }`}>다음</div>
                <div className={`text-4xl font-black ${
                  isDarkMode ? "text-green-300" : "text-green-700"
                }`}>{currentStage + 1}</div>
              </div>
            </div>

            {/* 낚시실력 요구 조건 */}
            <div className={`p-5 rounded-2xl ${
              currentStage + 1 > fishingSkill
                ? (isDarkMode 
                  ? "bg-gradient-to-br from-red-900/20 to-pink-900/20 border border-red-500/30" 
                  : "bg-gradient-to-br from-red-50 to-pink-50 border border-red-400/50")
                : (isDarkMode 
                  ? "bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/30" 
                  : "bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-400/50")
            }`}>
              <div className={`text-sm font-bold mb-3 ${
                currentStage + 1 > fishingSkill
                  ? (isDarkMode ? "text-red-300" : "text-red-700")
                  : (isDarkMode ? "text-blue-300" : "text-blue-700")
              }`}>
                필요 낚시실력
              </div>
              <div className="flex items-center justify-between">
                <div className={`text-xl font-bold ${
                  isDarkMode ? "text-white" : "text-gray-900"
                }`}>
                  낚시실력 {currentStage + 1}
                </div>
                <div className={`text-2xl font-black ${
                  currentStage + 1 > fishingSkill
                    ? (isDarkMode ? "text-red-400" : "text-red-600")
                    : (isDarkMode ? "text-green-400" : "text-green-600")
                }`}>
                  {currentStage + 1 > fishingSkill ? '✗' : '✓'}
                </div>
              </div>
              <div className="mt-2">
                <div className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}>
                  현재 낚시실력: <span className={`font-bold ${
                    currentStage + 1 > fishingSkill
                      ? (isDarkMode ? "text-red-400" : "text-red-600")
                      : (isDarkMode ? "text-green-400" : "text-green-600")
                  }`}>{fishingSkill}</span>
                </div>
              </div>
            </div>

            {/* 재료 정보 */}
            <div className={`p-5 rounded-2xl ${
              isDarkMode 
                ? "bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border border-yellow-500/30" 
                : "bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-400/50"
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className={`text-sm font-bold ${
                  isDarkMode ? "text-yellow-300" : "text-yellow-700"
                }`}>
                  필요한 재료
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className={`text-xl font-bold ${
                  isDarkMode ? "text-white" : "text-gray-900"
                }`}>
                  {getRequiredMaterial()?.material}
                </div>
                <div className={`text-2xl font-black ${
                  isDarkMode ? "text-yellow-400" : "text-yellow-600"
                }`}>
                  100
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-yellow-500/30">
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}>보유량</span>
                  <span className={`text-lg font-bold ${
                    getMaterialCount(getRequiredMaterial()?.material) >= 100
                      ? (isDarkMode ? "text-green-400" : "text-green-600")
                      : (isDarkMode ? "text-red-400" : "text-red-600")
                  }`}>
                    {getMaterialCount(getRequiredMaterial()?.material)}
                  </span>
                </div>
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowUpgradeModal(false)}
                className={`flex-1 py-3 rounded-xl font-bold transition-all duration-300 hover:scale-[1.02] ${
                  isDarkMode 
                    ? "bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700" 
                    : "bg-gray-200 hover:bg-gray-300 text-gray-700 border border-gray-300"
                }`}
              >
                취소
              </button>
              <button
                onClick={handleUpgradeStage}
                disabled={currentStage + 1 > fishingSkill || getMaterialCount(getRequiredMaterial()?.material) < 100}
                className={`flex-1 py-3 rounded-xl font-bold transition-all duration-300 ${
                  currentStage + 1 > fishingSkill || getMaterialCount(getRequiredMaterial()?.material) < 100
                    ? (isDarkMode 
                      ? "bg-gray-700 text-gray-500 cursor-not-allowed" 
                      : "bg-gray-300 text-gray-500 cursor-not-allowed")
                    : (isDarkMode 
                      ? "bg-gradient-to-r from-green-600 to-emerald-600 hover:shadow-green-500/50 hover:scale-[1.02] shadow-lg text-white" 
                      : "bg-gradient-to-r from-green-500 to-emerald-500 hover:shadow-green-400/50 hover:scale-[1.02] shadow-lg text-white")
                }`}
              >
                업그레이드
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default ClickerModal;

