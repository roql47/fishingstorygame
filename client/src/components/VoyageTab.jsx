import React, { useState, useEffect, useRef } from 'react';
import { Anchor, Heart, Sword, Zap, Trophy, Coins, ArrowLeft, Users } from 'lucide-react';
import { calculateCompanionStats } from '../data/companionData';

const VoyageTab = ({ 
  isDarkMode, 
  battleCompanions, 
  companionStats, 
  userEquipment,
  fishingSkill,
  calculateTotalEnhancementBonus,
  calculatePlayerAttack,
  calculatePlayerMaxHp,
  getAccessoryLevel,
  socket,
  username,
  userUuid,
  userStats,
  updateQuestProgress,
  setUserMoney
}) => {
  const [currentView, setCurrentView] = useState('select'); // 'select', 'battle', 'result'
  const [selectedFish, setSelectedFish] = useState(null);
  const [battleState, setBattleState] = useState(null);
  const [combatLog, setCombatLog] = useState([]);
  const [isAutoAttack, setIsAutoAttack] = useState(true);
  const [attackAnimations, setAttackAnimations] = useState({}); // 공격 애니메이션 상태
  const [damageNumbers, setDamageNumbers] = useState([]); // 데미지 숫자 애니메이션
  const [currentPage, setCurrentPage] = useState(1); // 페이지네이션
  const [rewardGold, setRewardGold] = useState(0); // 실제 보상 골드 (5~10배 랜덤)
  
  const combatIntervalRef = useRef(null);
  const logRef = useRef(null);

  // 물고기 데이터 (rank 1-25)
  const voyageFishes = [
    { rank: 1, name: '타코문어', image: '/assets/images/monster1.jpeg', hp: 50, attack: 5, speed: 50, gold: 500 },
    { rank: 2, name: '풀고등어', image: '/assets/images/monster2.jpeg', hp: 90, attack: 8, speed: 60, gold: 800 },
    { rank: 3, name: '경단붕어', image: '/assets/images/monster3.jpeg', hp: 140, attack: 11, speed: 70, gold: 1200, imagePosition: 'center 80%' },
    { rank: 4, name: '버터오징어', image: '/assets/images/monster4.jpeg', hp: 200, attack: 15, speed: 80, gold: 1800 },
    { rank: 5, name: '간장새우', image: '/assets/images/monster5.jpeg', hp: 275, attack: 20, speed: 90, gold: 2500 },
    { rank: 6, name: '물수수', image: '/assets/images/monster6.jpeg', hp: 375, attack: 28, speed: 100, gold: 3500 },
    { rank: 7, name: '정어리파이', image: '/assets/images/monster7.jpeg', hp: 500, attack: 35, speed: 110, gold: 4500 },
    { rank: 8, name: '얼음상어', image: '/assets/images/monster8.jpeg', hp: 650, attack: 45, speed: 120, gold: 6000, imagePosition: 'center 35%' },
    { rank: 9, name: '스퀄스퀴드', image: '/assets/images/monster9.jpeg', hp: 850, attack: 58, speed: 130, gold: 8000, imagePosition: 'center 60%' },
    { rank: 10, name: '백년송거북', image: '/assets/images/monster10.jpeg', hp: 1100, attack: 73, speed: 140, gold: 10500, imagePosition: 'center 80%' },
    { rank: 11, name: '고스피쉬', image: '/assets/images/monster11.jpeg', hp: 1450, attack: 95, speed: 150, gold: 13500, imagePosition: 'center 37%' },
    { rank: 12, name: '유령치', image: '/assets/images/monster12.jpeg', hp: 1850, attack: 120, speed: 160, gold: 17000 },
    { rank: 13, name: '바이트독', image: '/assets/images/monster13.jpeg', hp: 2350, attack: 155, speed: 170, gold: 21500 },
    { rank: 14, name: '호박고래', image: '/assets/images/monster14.jpeg', hp: 3000, attack: 200, speed: 180, gold: 27000, imagePosition: 'center 40%' },
    { rank: 15, name: '바이킹조개', image: '/assets/images/monster15-1.jpeg', hp: 3800, attack: 250, speed: 190, gold: 34000, imagePosition: 'center 50%' },
    { rank: 16, name: '천사해파리', image: '/assets/images/monster16.jpeg', hp: 4800, attack: 320, speed: 200, gold: 43000, imagePosition: 'center 38%' },
    { rank: 17, name: '악마복어', image: '/assets/images/monster17.jpeg', hp: 6100, attack: 410, speed: 210, gold: 54000, imagePosition: 'center 45%' },
    { rank: 18, name: '칠성장어', image: '/assets/images/monster18.jpeg', hp: 7700, attack: 520, speed: 220, gold: 68000 },
    { rank: 19, name: '닥터블랙', image: '/assets/images/monster19.jpeg', hp: 9700, attack: 660, speed: 230, gold: 86000, imagePosition: 'center 65%' },
    { rank: 20, name: '해룡', image: '/assets/images/monster20.jpeg', hp: 12200, attack: 840, speed: 240, gold: 108000, imagePosition: 'center 12%' },
    { rank: 21, name: '메카핫킹크랩', image: '/assets/images/monster21.jpeg', hp: 15400, attack: 1070, speed: 250, gold: 136000, imagePosition: 'center 55%' },
    { rank: 22, name: '램프리', image: '/assets/images/monster22.jpeg', hp: 19400, attack: 1360, speed: 260, gold: 172000 },
    { rank: 23, name: '마지막잎새', image: '/assets/images/monster23.jpeg', hp: 24500, attack: 1730, speed: 270, gold: 217000, imagePosition: 'center 48%' },
    { rank: 24, name: '아이스브리더', image: '/assets/images/monster24.jpeg', hp: 30900, attack: 2200, speed: 280, gold: 274000, imagePosition: 'center 40%' },
    { rank: 25, name: '해신', image: '/assets/images/monster25.jpeg', hp: 39000, attack: 2800, speed: 290, gold: 345000, imagePosition: 'center 35%'  }
  ];
  
  // 페이지네이션 설정
  const itemsPerPage = 10;
  const totalPages = Math.ceil(voyageFishes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentFishes = voyageFishes.slice(startIndex, endIndex);

  // 전투 시작
  const startBattle = (fish) => {
    setSelectedFish(fish);
    setRewardGold(0); // 보상 골드 초기화
    
    // 실제 플레이어 스탯 계산
    // 1. 체력: 악세사리 레벨 + 강화 보너스 + 🌟 유저 스탯
    const accessoryLevel = getAccessoryLevel(userEquipment.accessory);
    const accessoryEnhancementBonus = calculateTotalEnhancementBonus(userEquipment.accessoryEnhancement || 0);
    const baseMaxHP = calculatePlayerMaxHp(accessoryLevel, accessoryEnhancementBonus);
    const healthStatBonus = accessoryLevel * (userStats?.health || 0) * 5; // 🌟 악세사리 index × 성장 레벨 × 5
    const playerMaxHP = baseMaxHP + healthStatBonus;
    
    // 2. 공격력: 낚시실력 3차방정식 + 낚시대 강화 보너스 + 🌟 유저 스탯
    const rodEnhancementBonus = calculateTotalEnhancementBonus(userEquipment.fishingRodEnhancement || 0);
    const baseAttack = calculatePlayerAttack(fishingSkill, rodEnhancementBonus);
    
    // 🌟 낚시대 인덱스 계산
    const fishingRods = [
      '나무낚시대', '낡은낚시대', '기본낚시대', '단단한낚시대', '은낚시대', '금낚시대',
      '강철낚시대', '사파이어낚시대', '루비낚시대', '다이아몬드낚시대', '레드다이아몬드낚시대',
      '벚꽃낚시대', '꽃망울낚시대', '호롱불낚시대', '산호등낚시대', '피크닉', '마녀빗자루',
      '에테르낚시대', '별조각낚시대', '여우꼬리낚시대', '초콜릿롤낚시대', '호박유령낚시대',
      '핑크버니낚시대', '할로우낚시대', '여우불낚시대'
    ];
    const fishingRodIndex = fishingRods.indexOf(userEquipment.fishingRod) >= 0 ? fishingRods.indexOf(userEquipment.fishingRod) : 0;
    const attackStatBonus = fishingRodIndex * (userStats?.attack || 0); // 🌟 낚시대 index × 성장 레벨
    const playerAttack = baseAttack + attackStatBonus;
    
    // 동료 능력치 계산
    const companions = battleCompanions.map(companionName => {
      const stats = companionStats[companionName];
      const level = stats?.level || 1;
      const companionData = calculateCompanionStats(companionName, level);
      
      const maxCooldown = Math.max(500, 5000 - companionData.speed * 20); // 속도가 높을수록 빠름
      return {
        name: companionName,
        hp: companionData.hp,
        maxHp: companionData.hp,
        attack: companionData.attack,
        speed: companionData.speed,
        cooldown: maxCooldown, // maxCooldown에서 시작 (속도바 0%부터)
        maxCooldown: maxCooldown,
        morale: 50, // 스킬 게이지 (사기) - 50으로 시작
        maxMorale: 100,
        skill: companionData.skill // 스킬 정보
      };
    });

    // 플레이어 속도 계산: 100 + 낚시실력 * 10 + 🌟 속도 스탯 (레벨 × 2)
    const speedStatBonus = (userStats?.speed || 0) * 2;
    const playerSpeed = 100 + fishingSkill * 10 + speedStatBonus;
    const playerMaxCooldown = 3000;
    
    // 적 속도에 따른 쿨다운 계산
    const enemyMaxCooldown = Math.max(500, 5000 - fish.speed * 20);
    
    const initialState = {
      player: {
        hp: playerMaxHP,
        maxHp: playerMaxHP,
        attack: playerAttack,
        speed: playerSpeed,
        cooldown: playerMaxCooldown, // maxCooldown에서 시작 (속도바 0%부터)
        maxCooldown: playerMaxCooldown
      },
      companions: companions,
      enemy: {
        name: fish.name,
        hp: fish.hp,
        maxHp: fish.hp,
        attack: fish.attack,
        speed: fish.speed,
        cooldown: enemyMaxCooldown, // maxCooldown에서 시작 (속도바 0%부터)
        maxCooldown: enemyMaxCooldown
      },
      status: 'fighting' // 'fighting', 'victory', 'defeat'
    };

    setBattleState(initialState);
    setCombatLog([`${fish.name}와(과)의 전투가 시작되었습니다!`]);
    setCurrentView('battle');
  };

  // 전투 로직 (실시간)
  useEffect(() => {
    if (currentView !== 'battle' || !battleState || battleState.status !== 'fighting') {
      if (combatIntervalRef.current) {
        clearInterval(combatIntervalRef.current);
        combatIntervalRef.current = null;
      }
      return;
    }

    // 50ms마다 업데이트 (부드러운 애니메이션, 2배 느린 속도)
    combatIntervalRef.current = setInterval(() => {
      setBattleState(prev => {
        if (!prev || prev.status !== 'fighting') return prev;

        const newState = { ...prev };
        const newLog = [];

        // 플레이어 공격 (2배 느린 속도)
        if (newState.player.hp > 0) {
          newState.player.cooldown -= 25;
          if (newState.player.cooldown <= 0 && newState.enemy.hp > 0) {
            const damage = Math.floor(newState.player.attack * (0.9 + Math.random() * 0.2));
            newState.enemy.hp = Math.max(0, newState.enemy.hp - damage);
            newState.player.cooldown = newState.player.maxCooldown;
            newLog.push(`플레이어가 ${damage} 데미지를 입혔습니다!`);
            
            // 공격 애니메이션 트리거
            setAttackAnimations(prev => ({ ...prev, player: Date.now() }));
            
            // 데미지 숫자 표시 (랜덤 위치, 플레이어는 파란색)
            const damageId = Date.now() + Math.random();
            const randomX = 30 + Math.random() * 40; // 30-70% 사이
            const randomY = 30 + Math.random() * 40; // 30-70% 사이
            setDamageNumbers(prev => [...prev, { 
              id: damageId, 
              damage, 
              target: 'enemy', 
              timestamp: Date.now(),
              x: randomX,
              y: randomY,
              isSkill: false,
              type: 'player'
            }]);
            setTimeout(() => {
              setDamageNumbers(prev => prev.filter(d => d.id !== damageId));
            }, 1000);
          }
        }

        // 동료 공격 (2배 느린 속도)
        newState.companions = newState.companions.map(companion => {
          if (companion.hp <= 0) return companion;
          
          const updatedCompanion = { ...companion };
          updatedCompanion.cooldown -= 25;
          
          if (updatedCompanion.cooldown <= 0 && newState.enemy.hp > 0) {
            // 사기 증가 (매 공격마다 +15)
            updatedCompanion.morale = Math.min(updatedCompanion.maxMorale, updatedCompanion.morale + 15);
            
            // 스킬 사용 가능 체크
            const canUseSkill = updatedCompanion.skill && updatedCompanion.morale >= 100;
            let damage;
            let isSkill = false;
            
            if (canUseSkill) {
              // 스킬 사용
              isSkill = true;
              updatedCompanion.morale = 0; // 스킬 사용 시 사기 초기화
              
              if (updatedCompanion.skill.skillType === 'heal') {
                // 힐 스킬 (항해에서는 단순화)
                damage = 0;
                newLog.push(`✨ ${updatedCompanion.name}이(가) ${updatedCompanion.skill.name} 스킬을 사용했습니다!`);
              } else {
                // 공격 스킬
                damage = Math.floor(updatedCompanion.attack * updatedCompanion.skill.damageMultiplier * (0.9 + Math.random() * 0.2));
                newLog.push(`✨ ${updatedCompanion.name}이(가) ${updatedCompanion.skill.name}! ${damage} 데미지!`);
              }
            } else {
              // 일반 공격
              damage = Math.floor(updatedCompanion.attack * (0.9 + Math.random() * 0.2));
              newLog.push(`${updatedCompanion.name}이(가) ${damage} 데미지를 입혔습니다!`);
            }
            
            newState.enemy.hp = Math.max(0, newState.enemy.hp - damage);
            updatedCompanion.cooldown = updatedCompanion.maxCooldown;
            
            // 공격 애니메이션 트리거 (스킬은 다르게)
            setAttackAnimations(prev => ({ 
              ...prev, 
              [updatedCompanion.name]: Date.now(),
              [`${updatedCompanion.name}_skill`]: isSkill 
            }));
            
            // 데미지 숫자 표시 (랜덤 위치, 스킬은 다른 색상)
            if (damage > 0) {
              const damageId = Date.now() + Math.random();
              const randomX = 30 + Math.random() * 40;
              const randomY = 30 + Math.random() * 40;
              setDamageNumbers(prev => [...prev, { 
                id: damageId, 
                damage, 
                target: 'enemy', 
                timestamp: Date.now(),
                x: randomX,
                y: randomY,
                isSkill: isSkill,
                type: 'companion'
              }]);
              setTimeout(() => {
                setDamageNumbers(prev => prev.filter(d => d.id !== damageId));
              }, 1000);
            }
          }
          
          return updatedCompanion;
        });

        // 적 공격 (2배 느린 속도)
        if (newState.enemy.hp > 0) {
          newState.enemy.cooldown -= 25;
          if (newState.enemy.cooldown <= 0) {
            const targets = [
              { type: 'player', data: newState.player },
              ...newState.companions.map((c, idx) => ({ type: 'companion', data: c, index: idx })).filter(t => t.data.hp > 0)
            ].filter(t => t.data.hp > 0);

            if (targets.length > 0) {
              const target = targets[Math.floor(Math.random() * targets.length)];
              const damage = Math.floor(newState.enemy.attack * (0.8 + Math.random() * 0.4));
              
              if (target.type === 'player') {
                newState.player.hp = Math.max(0, newState.player.hp - damage);
                newLog.push(`${newState.enemy.name}이(가) 플레이어에게 ${damage} 데미지를 입혔습니다!`);
              } else {
                newState.companions[target.index].hp = Math.max(0, newState.companions[target.index].hp - damage);
                newLog.push(`${newState.enemy.name}이(가) ${target.data.name}에게 ${damage} 데미지를 입혔습니다!`);
              }
              
              newState.enemy.cooldown = newState.enemy.maxCooldown;
            }
          }
        }

        // 승패 판정
        if (newState.enemy.hp <= 0) {
          newState.status = 'victory';
          newLog.push(`🎉 승리했습니다!`);
          
          // 랜덤 골드 보상 계산 (2.5배 ~ 5배)
          const goldMultiplier = 2.5 + Math.random() * 2.5;
          const finalGold = Math.floor(selectedFish.gold * goldMultiplier);
          setRewardGold(finalGold);
          
          setTimeout(() => setCurrentView('result'), 1000);
        } else {
          const allDead = newState.player.hp <= 0 && newState.companions.every(c => c.hp <= 0);
          if (allDead) {
            newState.status = 'defeat';
            newLog.push(`💀 패배했습니다...`);
            setTimeout(() => setCurrentView('result'), 1000);
          }
        }

        // 로그 업데이트
        if (newLog.length > 0) {
          setCombatLog(prev => [...prev, ...newLog].slice(-50)); // 최근 50개만 유지
        }

        return newState;
      });
    }, 50);

    return () => {
      if (combatIntervalRef.current) {
        clearInterval(combatIntervalRef.current);
        combatIntervalRef.current = null;
      }
    };
  }, [currentView, battleState?.status]);

  // 로그 자동 스크롤
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [combatLog]);

  // 보상 수령
  const claimReward = async () => {
    if (battleState?.status !== 'victory') return;

    try {
      const response = await fetch(`${import.meta.env.VITE_SERVER_URL || window.location.origin}/api/voyage/reward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          userUuid,
          fishName: selectedFish.name,
          gold: rewardGold, // 랜덤 골드 사용 (5~10배)
          rank: selectedFish.rank
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // 🎯 항해 승리 퀘스트 진행도 업데이트
        if (updateQuestProgress) {
          updateQuestProgress('voyage_win', 1);
        }
        
        // 💰 골드 즉시 업데이트
        if (setUserMoney && data.gold !== undefined) {
          setUserMoney(data.gold);
          console.log(`✅ 항해 보상: 골드 ${data.gold}, 물고기 ${selectedFish.name}`);
        }
        
        // 소켓으로 인벤토리 업데이트 알림
        if (socket) {
          socket.emit('inventoryUpdated', {
            userUuid,
            reason: 'voyage_reward'
          });
        }

        alert(`보상 획득!\n골드: +${rewardGold.toLocaleString()}G\n물고기: ${selectedFish.name} +1마리`);
        setCurrentView('select');
        setBattleState(null);
        setSelectedFish(null);
        setCombatLog([]);
        setRewardGold(0);
      } else {
        alert('보상 수령에 실패했습니다: ' + data.error);
      }
    } catch (error) {
      console.error('보상 수령 오류:', error);
      alert('보상 수령 중 오류가 발생했습니다.');
    }
  };

  // HP 바 색상
  const getHPBarColor = (hp, maxHp) => {
    const percentage = (hp / maxHp) * 100;
    if (percentage > 50) return 'bg-green-500';
    if (percentage > 20) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // 쿨다운 바 렌더링
  const renderCooldownBar = (cooldown, maxCooldown) => {
    const percentage = Math.max(0, (cooldown / maxCooldown) * 100);
    const filled = 100 - percentage;
    return (
      <div className={`w-full h-2 rounded-full overflow-hidden ${
        isDarkMode ? 'bg-gray-700' : 'bg-gray-300'
      }`}>
        <div 
          className={`h-full ${
            filled >= 100
              ? 'bg-green-500'
              : 'bg-blue-500'
          }`}
          style={{ 
            width: `${filled}%`,
            transition: 'width 50ms linear' // 정확한 50ms linear 트랜지션
          }}
        />
      </div>
    );
  };

  return (
    <div className={`rounded-2xl board-shadow min-h-full flex flex-col ${
      isDarkMode ? "glass-card" : "bg-white/80 backdrop-blur-md border border-gray-300/30"
    }`}>
      {/* 헤더 */}
      <div className={`border-b p-4 ${
        isDarkMode ? "border-white/10" : "border-gray-300/20"
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Anchor className={`w-6 h-6 ${isDarkMode ? "text-blue-400" : "text-blue-600"}`} />
            <div>
              <h2 className={`text-lg font-semibold ${
                isDarkMode ? "text-white" : "text-gray-800"
              }`}>항해</h2>
              <p className={`text-xs ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}>물고기를 선택하여 전투를 시작하세요</p>
            </div>
          </div>
          {currentView !== 'select' && (
            <button
              onClick={() => {
                setCurrentView('select');
                setBattleState(null);
                setSelectedFish(null);
                setCombatLog([]);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isDarkMode
                  ? "bg-gray-700/50 hover:bg-gray-700 text-gray-300"
                  : "bg-gray-200 hover:bg-gray-300 text-gray-700"
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>돌아가기</span>
            </button>
          )}
        </div>
      </div>

      {/* 물고기 선택 화면 */}
      {currentView === 'select' && (
        <div className="flex-1 p-6">
          {/* 동료 정보 (있을 경우에만 표시) */}
          {battleCompanions.length > 0 && (
            <div className={`mb-6 p-4 rounded-xl ${
              isDarkMode ? "bg-blue-500/10 border border-blue-400/30" : "bg-blue-50 border border-blue-200"
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5" />
                <span className="font-medium">참여 동료 ({battleCompanions.length}명)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {battleCompanions.map(name => (
                  <span 
                    key={name}
                    className={`px-3 py-1 rounded-full text-sm ${
                      isDarkMode 
                        ? "bg-blue-500/20 text-blue-300"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {name} Lv.{companionStats[name]?.level || 1}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 동료 없을 때 안내 메시지 */}
          {battleCompanions.length === 0 && (
            <div className={`mb-6 p-4 rounded-xl ${
              isDarkMode ? "bg-yellow-500/10 border border-yellow-400/30" : "bg-yellow-50 border border-yellow-200"
            }`}>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                <span className={`text-sm ${isDarkMode ? "text-yellow-300" : "text-yellow-700"}`}>
                  💡 동료 없이 단독으로 전투합니다. 동료를 배치하면 더 쉽게 승리할 수 있습니다!
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentFishes.map(fish => (
                  <button
                    key={fish.rank}
                    onClick={() => startBattle(fish)}
                    className={`p-4 rounded-xl border-2 transition-all hover:scale-105 ${
                      isDarkMode
                        ? "bg-gray-800/50 border-blue-500/30 hover:border-blue-400/50 hover:bg-blue-900/20"
                        : "bg-white border-blue-300 hover:border-blue-400 hover:bg-blue-50"
                    }`}
                  >
                    <div className="relative mb-3 bg-gradient-to-br from-blue-900/10 to-blue-800/10 rounded-lg overflow-hidden">
                      <img 
                        src={fish.image} 
                        alt={fish.name}
                        className="w-full h-32 object-cover rounded-lg"
                        style={{ objectPosition: fish.imagePosition || 'center' }}
                      />
                      <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-bold ${
                        isDarkMode ? "bg-black/70 text-yellow-400" : "bg-white/90 text-yellow-600"
                      }`}>
                        Rank {fish.rank}
                      </div>
                    </div>
                    
                    <h3 className={`text-lg font-bold mb-2 ${
                      isDarkMode ? "text-white" : "text-gray-800"
                    }`}>{fish.name}</h3>
                    
                    <div className={`space-y-1 text-sm ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Heart className="w-4 h-4" />
                          HP
                        </span>
                        <span className="font-medium">{fish.hp}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Sword className="w-4 h-4" />
                          공격력
                        </span>
                        <span className="font-medium">{fish.attack}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Coins className="w-4 h-4 text-yellow-500" />
                          보상
                        </span>
                        <span className="font-medium text-yellow-500">
                          {Math.floor(fish.gold * 2.5).toLocaleString()}~{Math.floor(fish.gold * 5).toLocaleString()}G
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  currentPage === 1
                    ? (isDarkMode ? "bg-gray-700/50 text-gray-500 cursor-not-allowed" : "bg-gray-200 text-gray-400 cursor-not-allowed")
                    : (isDarkMode ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-blue-500 hover:bg-blue-600 text-white")
                }`}
              >
                이전
              </button>
              
              <div className="flex gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-10 h-10 rounded-lg font-medium transition-all ${
                      currentPage === page
                        ? (isDarkMode 
                            ? "bg-blue-600 text-white" 
                            : "bg-blue-500 text-white")
                        : (isDarkMode 
                            ? "bg-gray-700/50 hover:bg-gray-700 text-gray-300" 
                            : "bg-gray-200 hover:bg-gray-300 text-gray-700")
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  currentPage === totalPages
                    ? (isDarkMode ? "bg-gray-700/50 text-gray-500 cursor-not-allowed" : "bg-gray-200 text-gray-400 cursor-not-allowed")
                    : (isDarkMode ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-blue-500 hover:bg-blue-600 text-white")
                }`}
              >
                다음
              </button>
            </div>
          )}
        </div>
      )}

      {/* 전투 화면 */}
      {currentView === 'battle' && battleState && selectedFish && (
        <div className="flex-1 p-6 space-y-6">
          {/* 적 이미지 및 정보 */}
          <div className={`p-6 rounded-xl border-2 ${
            isDarkMode 
              ? "bg-red-900/20 border-red-500/30" 
              : "bg-red-50 border-red-200"
          }`}>
            {/* 적 이미지 */}
            <div className="flex justify-center mb-4">
              <div className="relative">
                <img 
                  src={selectedFish.image} 
                  alt={battleState.enemy.name}
                  className="w-80 h-80 object-contain rounded-xl border-4 border-red-500/50 shadow-lg bg-gradient-to-br from-red-900/20 to-red-800/20"
                />
                {/* 피격 애니메이션 - 플레이어나 동료가 공격할 때 */}
                {((attackAnimations.player && Date.now() - attackAnimations.player < 300) ||
                  (battleState.companions.some(c => attackAnimations[c.name] && Date.now() - attackAnimations[c.name] < 300))) && (
                  <div className="absolute inset-0 bg-white/40 rounded-xl animate-pulse" />
                )}
                
                {/* 데미지 숫자 애니메이션 */}
                {damageNumbers.filter(d => d.target === 'enemy').map((dmg) => {
                  // 색상 결정: 플레이어=파란색, 스킬=금색, 동료=초록색
                  const getColor = () => {
                    if (dmg.isSkill) return '#FFD700'; // 스킬 = 금색
                    if (dmg.type === 'player') return '#3B82F6'; // 플레이어 = 파란색
                    return '#10B981'; // 동료 = 초록색
                  };
                  
                  return (
                    <div
                      key={dmg.id}
                      className="absolute text-5xl font-black pointer-events-none"
                      style={{
                        left: `${dmg.x}%`,
                        top: `${dmg.y}%`,
                        transform: 'translate(-50%, -50%)',
                        animation: 'damageFloat 1s ease-out forwards',
                        color: getColor(),
                        textShadow: `0 0 10px #000, 0 0 20px ${getColor()}, 2px 2px 4px #000`,
                        WebkitTextStroke: '2px #000'
                      }}
                    >
                      -{dmg.damage}
                      {dmg.isSkill && '✨'}
                    </div>
                  );
                })}
              </div>
            </div>
            
            <style>
              {`
                @keyframes damageFloat {
                  0% {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(0.5);
                  }
                  50% {
                    opacity: 1;
                    transform: translate(-50%, -70%) scale(1.2);
                  }
                  100% {
                    opacity: 0;
                    transform: translate(-50%, -100%) scale(0.8);
                  }
                }
              `}
            </style>
            
            {/* 적 정보 */}
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-xl font-bold ${
                isDarkMode ? "text-red-300" : "text-red-700"
              }`}>{battleState.enemy.name}</h3>
              <span className={`text-base font-medium ${
                isDarkMode ? "text-gray-200" : "text-gray-800"
              }`}>
                {Math.max(0, battleState.enemy.hp)} / {battleState.enemy.maxHp}
              </span>
            </div>
            
            {/* 적 체력바 */}
            <div className={`w-full h-5 rounded-full overflow-hidden mb-3 ${
              isDarkMode ? "bg-gray-700" : "bg-gray-300"
            }`}>
              <div 
                className={`h-full ${getHPBarColor(battleState.enemy.hp, battleState.enemy.maxHp)} transition-all duration-200`}
                style={{ width: `${(battleState.enemy.hp / battleState.enemy.maxHp) * 100}%` }}
              />
            </div>
            
            {/* 적 속도바 */}
            {renderCooldownBar(battleState.enemy.cooldown, battleState.enemy.maxCooldown)}
          </div>

          {/* 아군 정보 */}
          <div className="space-y-3">
            <h3 className={`text-lg font-bold ${
              isDarkMode ? "text-blue-300" : "text-blue-700"
            }`}>아군</h3>
            
            {/* 플레이어 */}
            <div className={`p-4 rounded-xl border-2 transition-all ${
              attackAnimations.player && Date.now() - attackAnimations.player < 300
                ? "scale-105 shadow-lg shadow-red-500/50"
                : ""
            } ${
              isDarkMode 
                ? "bg-blue-900/20 border-blue-500/30" 
                : "bg-blue-50 border-blue-200"
            }`}>
              <div className="flex items-center justify-between mb-3">
                <span className={`font-bold text-lg ${
                  isDarkMode ? "text-blue-300" : "text-blue-700"
                }`}>⚔️ 플레이어</span>
                <span className={`text-base font-medium ${
                  isDarkMode ? "text-gray-200" : "text-gray-800"
                }`}>
                  {Math.max(0, battleState.player.hp)} / {battleState.player.maxHp}
                </span>
              </div>
              
              {/* 플레이어 체력바 */}
              <div className={`w-full h-4 rounded-full overflow-hidden mb-3 ${
                isDarkMode ? "bg-gray-700" : "bg-gray-300"
              }`}>
                <div 
                  className={`h-full ${getHPBarColor(battleState.player.hp, battleState.player.maxHp)} transition-all duration-200`}
                  style={{ width: `${(battleState.player.hp / battleState.player.maxHp) * 100}%` }}
                />
              </div>
              
              {/* 플레이어 속도바 */}
              {renderCooldownBar(battleState.player.cooldown, battleState.player.maxCooldown)}
            </div>

            {/* 동료들 */}
            {battleState.companions.map((companion, idx) => {
              const isSkillActive = attackAnimations[`${companion.name}_skill`];
              return (
                <div 
                  key={idx}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    attackAnimations[companion.name] && Date.now() - attackAnimations[companion.name] < 300
                      ? isSkillActive 
                        ? "scale-105 shadow-lg shadow-yellow-500/50"
                        : "scale-105 shadow-lg shadow-blue-500/50"
                      : ""
                  } ${
                    companion.hp <= 0
                      ? (isDarkMode ? "bg-gray-800/30 border-gray-600/30 opacity-60" : "bg-gray-100 border-gray-300 opacity-60")
                      : (isDarkMode ? "bg-green-900/20 border-green-500/30" : "bg-green-50 border-green-200")
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-lg ${
                        companion.hp <= 0
                          ? (isDarkMode ? "text-gray-500" : "text-gray-400")
                          : (isDarkMode ? "text-green-300" : "text-green-700")
                      }`}>🛡️ {companion.name}</span>
                      {companion.skill && companion.morale >= 100 && (
                        <span className="text-yellow-500 text-sm animate-pulse">✨</span>
                      )}
                    </div>
                    <span className={`text-base font-medium ${
                      isDarkMode ? "text-gray-200" : "text-gray-800"
                    }`}>
                      {Math.max(0, companion.hp)} / {companion.maxHp}
                    </span>
                  </div>
                  
                  {/* 동료 체력바 */}
                  <div className={`w-full h-4 rounded-full overflow-hidden mb-2 ${
                    isDarkMode ? "bg-gray-700" : "bg-gray-300"
                  }`}>
                    <div 
                      className={`h-full ${getHPBarColor(companion.hp, companion.maxHp)} transition-all duration-200`}
                      style={{ width: `${(companion.hp / companion.maxHp) * 100}%` }}
                    />
                  </div>
                  
                  {/* 스킬 게이지 (노란색) */}
                  {companion.hp > 0 && companion.skill && (
                    <div className="mb-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                          ⚡ {companion.skill.name}
                        </span>
                        <span className={`text-xs font-medium ${
                          companion.morale >= 100
                            ? (isDarkMode ? 'text-yellow-400' : 'text-yellow-600')
                            : (isDarkMode ? 'text-gray-400' : 'text-gray-600')
                        }`}>
                          {companion.morale}%
                        </span>
                      </div>
                      <div className={`w-full h-2 rounded-full overflow-hidden ${
                        isDarkMode ? 'bg-gray-700' : 'bg-gray-300'
                      }`}>
                        <div 
                          className={`h-full transition-all duration-200 ${
                            companion.morale >= 100
                              ? 'bg-yellow-500 animate-pulse'
                              : 'bg-yellow-600'
                          }`}
                          style={{ width: `${companion.morale}%` }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* 동료 속도바 */}
                  {companion.hp > 0 && renderCooldownBar(companion.cooldown, companion.maxCooldown)}
                </div>
              );
            })}
          </div>

          {/* 전투 로그 */}
          <div className={`p-4 rounded-xl border-2 max-h-40 overflow-y-auto ${
            isDarkMode 
              ? "bg-gray-800/50 border-gray-700" 
              : "bg-gray-50 border-gray-200"
          }`} ref={logRef}>
            <h4 className={`text-sm font-bold mb-2 flex items-center gap-2 ${
              isDarkMode ? "text-gray-300" : "text-gray-700"
            }`}>
              📜 전투 로그
            </h4>
            <div className={`space-y-1 text-xs ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}>
              {combatLog.map((log, idx) => (
                <div key={idx} className="py-0.5">{log}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 결과 화면 */}
      {currentView === 'result' && battleState && (
        <div className="flex-1 p-6 flex items-center justify-center">
          <div className={`max-w-md w-full p-8 rounded-2xl border-2 text-center ${
            battleState.status === 'victory'
              ? (isDarkMode 
                  ? "bg-green-900/20 border-green-500/50" 
                  : "bg-green-50 border-green-300")
              : (isDarkMode 
                  ? "bg-red-900/20 border-red-500/50" 
                  : "bg-red-50 border-red-300")
          }`}>
            <div className="text-6xl mb-4">
              {battleState.status === 'victory' ? '🎉' : '💀'}
            </div>
            
            <h2 className={`text-2xl font-bold mb-4 ${
              battleState.status === 'victory'
                ? (isDarkMode ? "text-green-300" : "text-green-700")
                : (isDarkMode ? "text-red-300" : "text-red-700")
            }`}>
              {battleState.status === 'victory' ? '승리!' : '패배...'}
            </h2>

            {battleState.status === 'victory' && selectedFish && (
              <div className={`mb-6 space-y-3 ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}>
                <div className="flex items-center justify-center gap-2 text-lg">
                  <Coins className="w-6 h-6 text-yellow-500" />
                  <span className="font-bold text-yellow-500">+{rewardGold.toLocaleString()}G</span>
                </div>
                <div className="flex items-center justify-center gap-2 text-lg">
                  <Trophy className="w-6 h-6 text-blue-500" />
                  <span className="font-bold">{selectedFish.name} 1마리</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {battleState.status === 'victory' ? (
                <button
                  onClick={claimReward}
                  className={`w-full py-3 rounded-xl font-bold transition-all ${
                    isDarkMode
                      ? "bg-green-600 hover:bg-green-700 text-white"
                      : "bg-green-500 hover:bg-green-600 text-white"
                  }`}
                >
                  보상 받기
                </button>
              ) : (
                <button
                  onClick={() => {
                    setCurrentView('select');
                    setBattleState(null);
                    setSelectedFish(null);
                    setCombatLog([]);
                  }}
                  className={`w-full py-3 rounded-xl font-bold transition-all ${
                    isDarkMode
                      ? "bg-gray-600 hover:bg-gray-700 text-white"
                      : "bg-gray-500 hover:bg-gray-600 text-white"
                  }`}
                >
                  다시 도전하기
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoyageTab;

