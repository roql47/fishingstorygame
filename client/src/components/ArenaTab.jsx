import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Trophy, 
  Sword, 
  Shield, 
  Crown, 
  TrendingUp,
  TrendingDown,
  Zap,
  Heart,
  Target,
  ArrowLeft,
  Users,
  Star,
  ShoppingCart,
  Coins,
  Gift
} from 'lucide-react';
import axios from 'axios';
import { calculateCompanionStats } from '../data/companionData';

const ArenaTab = ({ 
  userData, 
  isDarkMode = true, 
  battleCompanions,
  companionStats,
  fishingSkill,
  userStats,
  serverUrl,
  userEquipment,
  calculateTotalEnhancementBonus,
  calculatePlayerAttack,
  calculatePlayerMaxHp,
  getAccessoryLevel,
  activeTab,
  onBattleEnd
}) => {
  const [subTab, setSubTab] = useState('battle'); // 'battle', 'ranking', or 'shop'
  const [currentView, setCurrentView] = useState('lobby'); // lobby, battle, result
  const [myStats, setMyStats] = useState(null);
  const [rankings, setRankings] = useState(null);
  const [allRankings, setAllRankings] = useState(null); // 전체 랭킹
  const [rankingPage, setRankingPage] = useState(1); // 랭킹 페이지
  const [loading, setLoading] = useState(false);
  const [selectedOpponent, setSelectedOpponent] = useState(null);
  const [battleState, setBattleState] = useState(null);
  const [battleLog, setBattleLog] = useState([]);
  const [battleResult, setBattleResult] = useState(null);
  const [dailyLimit, setDailyLimit] = useState(null);
  
  const battleLogRef = useRef(null);
  const battleIntervalRef = useRef(null);

  // 결투장 데이터 로드
  const loadArenaData = useCallback(async () => {
    try {
      setLoading(true);
      
      const token = localStorage.getItem('jwtToken');
      if (!token) {
        console.log('[Arena] JWT 토큰 없음');
        // 🔧 토큰이 없어도 빈 데이터로 초기화
        setMyStats({ elo: 1000, wins: 0, losses: 0, winStreak: 0, highestWinStreak: 0, rank: null });
        setRankings({ higher: [], lower: [], myRank: null });
        setDailyLimit({ used: 0, max: 10, remaining: 10, canBattle: true });
        return;
      }

      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };

      console.log('[Arena] 결투장 데이터 로드 시작...');

      const [statsRes, rankingsRes] = await Promise.all([
        axios.get(`${serverUrl}/api/arena/my-stats`, config),
        axios.get(`${serverUrl}/api/arena/rankings`, config)
      ]);

      console.log('[Arena] 스탯 응답:', statsRes.data);
      console.log('[Arena] 랭킹 응답:', rankingsRes.data);

      if (statsRes.data.success) {
        setMyStats(statsRes.data.stats);
        setDailyLimit(statsRes.data.dailyLimit);
        console.log('[Arena] 스탯 설정 완료');
      } else {
        // 🔧 실패 시에도 기본값 설정
        setMyStats({ elo: 1000, wins: 0, losses: 0, winStreak: 0, highestWinStreak: 0, rank: null });
        setDailyLimit({ used: 0, max: 10, remaining: 10, canBattle: true });
      }

      if (rankingsRes.data.success) {
        setRankings(rankingsRes.data.rankings);
        console.log('[Arena] 랭킹 설정 완료:', rankingsRes.data.rankings);
      } else {
        // 🔧 실패 시에도 빈 랭킹으로 설정
        setRankings({ higher: [], lower: [], myRank: null });
      }
    } catch (error) {
      console.error('[Arena] 결투장 데이터 로드 실패:', error);
      console.error('[Arena] 에러 상세:', error.response?.data);
      
      // 🔧 에러 발생 시에도 기본값 설정 (무한 로딩 방지)
      setMyStats({ elo: 1000, wins: 0, losses: 0, winStreak: 0, highestWinStreak: 0, rank: null });
      setRankings({ higher: [], lower: [], myRank: null });
      setDailyLimit({ used: 0, max: 10, remaining: 10, canBattle: true });
      
      // 사용자에게 에러 알림
      if (error.response?.status === 401) {
        alert('로그인이 필요합니다. 새로고침 후 다시 시도해주세요.');
      } else if (error.response?.status === 500) {
        alert('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      } else {
        alert('결투장 데이터를 불러오는데 실패했습니다. 새로고침 후 다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
    }
  }, [serverUrl]);

  // 전체 랭킹 로드
  const loadAllRankings = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('jwtToken');
      if (!token) {
        console.log('[Arena] JWT 토큰 없음');
        return;
      }

      const config = {
        headers: { Authorization: `Bearer ${token}` },
        params: { page }
      };

      const response = await axios.get(`${serverUrl}/api/arena/all-rankings`, config);
      
      if (response.data.success) {
        setAllRankings(response.data);
        setRankingPage(page);
      }
    } catch (error) {
      console.error('[Arena] 전체 랭킹 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [serverUrl]);

  // 초기 데이터 로드
  useEffect(() => {
    if (userData?.userUuid && userData?.username) {
      loadArenaData();
    }
  }, [userData?.userUuid, userData?.username, loadArenaData]);

  // 랭킹 탭 선택 시 전체 랭킹 로드
  useEffect(() => {
    if (subTab === 'ranking' && userData?.userUuid) {
      loadAllRankings(rankingPage);
    }
  }, [subTab, userData?.userUuid, rankingPage, loadAllRankings]);

  // 결투장 탭 클릭 시 자동 새로고침
  useEffect(() => {
    if (activeTab === 'arena' && userData?.userUuid && currentView === 'lobby') {
      loadArenaData();
    }
  }, [activeTab, currentView, userData?.userUuid, loadArenaData]);

  // 전투 로그 자동 스크롤
  useEffect(() => {
    if (battleLogRef.current) {
      battleLogRef.current.scrollTop = battleLogRef.current.scrollHeight;
    }
  }, [battleLog]);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (battleIntervalRef.current) {
        clearInterval(battleIntervalRef.current);
      }
    };
  }, []);

  // 전투 중 새로고침/탭 이동 시 자동 패배 처리
  useEffect(() => {
    const handleBeforeUnload = async (e) => {
      // 전투 중일 때만
      if (currentView === 'battle' && battleState?.status === 'fighting') {
        e.preventDefault();
        e.returnValue = ''; // Chrome에서 확인 창 표시
        
        // 패배 처리
        try {
          const token = localStorage.getItem('jwtToken');
          await axios.post(
            `${serverUrl}/api/arena/battle-result`,
            {
              battleId: battleState.battleId,
              isWin: false, // 자동 패배
              opponentUuid: selectedOpponent?.userUuid,
              opponentRank: battleState.opponentRank
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (error) {
          console.error('[Arena] 자동 패배 처리 실패:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentView, battleState?.status, battleState?.battleId, selectedOpponent, serverUrl]);

  // 다른 탭으로 이동 시 자동 패배 처리
  useEffect(() => {
    if (activeTab !== 'arena' && currentView === 'battle' && battleState?.status === 'fighting') {
      console.log('[Arena] 다른 탭으로 이동 - 자동 패배 처리');
      
      // 즉시 패배 처리
      const performAutoDefeat = async () => {
        try {
          const token = localStorage.getItem('jwtToken');
          const response = await axios.post(
            `${serverUrl}/api/arena/battle-result`,
            {
              battleId: battleState.battleId,
              isWin: false, // 자동 패배
              opponentUuid: selectedOpponent?.userUuid,
              opponentRank: battleState.opponentRank
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          console.log('[Arena] 자동 패배 처리 완료');
        } catch (error) {
          console.error('[Arena] 자동 패배 처리 실패:', error);
        }
      };
      
      performAutoDefeat();
      
      // UI 초기화
      if (battleIntervalRef.current) {
        clearInterval(battleIntervalRef.current);
      }
      setCurrentView('lobby');
      setBattleState(null);
      setBattleLog([]);
      setBattleResult(null);
      setSelectedOpponent(null);
    }
  }, [activeTab, currentView, battleState?.status, battleState?.battleId, selectedOpponent, serverUrl]);

  // 전투 시작
  const startBattle = async (opponent) => {
    if (!dailyLimit?.canBattle) {
      alert('오늘의 전투 횟수를 모두 소진했습니다!');
      return;
    }

    try {
      setLoading(true);
      setSelectedOpponent(opponent);

      const token = localStorage.getItem('jwtToken');
      const response = await axios.post(
        `${serverUrl}/api/arena/start-battle`,
        { opponentUuid: opponent.userUuid },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        const { battle, battleId, opponentRank } = response.data;
        initBattle(battle.player, battle.opponent, battleId, opponentRank);
        setCurrentView('battle');
      }
    } catch (error) {
      console.error('전투 시작 실패:', error);
      alert(error.response?.data?.error || '전투 시작에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 낚시대 레벨 계산
  const getFishingRodIndex = (fishingRodName) => {
    const fishingRods = [
      '나무낚시대', '낡은낚시대', '기본낚시대', '단단한낚시대', '은낚시대', '금낚시대',
      '강철낚시대', '사파이어낚시대', '루비낚시대', '다이아몬드낚시대', '레드다이아몬드낚시대',
      '벚꽃낚시대', '꽃망울낚시대', '호롱불낚시대', '산호등낚시대', '피크닉', '마녀빗자루',
      '에테르낚시대', '별조각낚시대', '여우꼬리낚시대', '초콜릿롤낚시대', '호박유령낚시대',
      '핑크버니낚시대', '할로우낚시대', '여우불낚시대'
    ];
    return fishingRods.indexOf(fishingRodName) >= 0 ? fishingRods.indexOf(fishingRodName) : 0;
  };

  // 전투 초기화 (항해 전투 시스템 기반)
  const initBattle = (playerData, opponentData, battleId, opponentRank) => {
    // 플레이어 능력치 계산
    const accessoryLevel = getAccessoryLevel(userEquipment.accessory);
    const accessoryEnhancementBonus = calculateTotalEnhancementBonus(userEquipment.accessoryEnhancement || 0);
    const baseMaxHP = calculatePlayerMaxHp(accessoryLevel, accessoryEnhancementBonus);
    const healthStatBonus = accessoryLevel * (userStats?.health || 0) * 5;
    const playerMaxHP = baseMaxHP + healthStatBonus;

    const rodEnhancementBonus = calculateTotalEnhancementBonus(userEquipment.fishingRodEnhancement || 0);
    const attackRange = calculatePlayerAttack(fishingSkill, rodEnhancementBonus);
    const baseAttack = attackRange.base || attackRange; // base 값 사용
    const fishingRodIndex = getFishingRodIndex(userEquipment.fishingRod);
    const attackStatBonus = fishingRodIndex * (userStats?.attack || 0);
    const playerAttack = baseAttack + attackStatBonus;

    // 플레이어 동료들
    const playerCompanions = battleCompanions.map(companionName => {
      const stats = companionStats[companionName];
      const level = stats?.level || 1;
      const tier = stats?.tier || 0;
      const breakthrough = stats?.breakthrough || 0;
      const breakthroughStats = stats?.breakthroughStats || { bonusGrowthHp: 0, bonusGrowthAttack: 0, bonusGrowthSpeed: 0 };
      const companionData = calculateCompanionStats(companionName, level, tier, breakthrough, breakthroughStats);
      
      const maxCooldown = Math.max(500, 5000 - companionData.speed * 20);
      return {
        name: companionName,
        hp: companionData.hp,
        maxHp: companionData.hp,
        attack: companionData.attack,
        speed: companionData.speed,
        cooldown: maxCooldown,
        maxCooldown: maxCooldown,
        morale: 50,
        maxMorale: 100,
        skill: companionData.skill,
        side: 'player'
      };
    });

    // 상대 동료들 (서버 데이터 기반)
    const opponentCompanions = (opponentData.companions || []).map(c => {
      // 스탯 우선순위: c.stats > c 직접 값
      const health = c.stats?.health || c.health || 100;
      const attack = c.stats?.attack || c.attack || 10;
      const speed = c.stats?.speed || c.speed || 50;
      const maxCooldown = Math.max(500, 5000 - speed * 20);
      
      return {
        name: c.name || c.companionName,
        hp: health,
        maxHp: health,
        attack: attack,
        speed: speed,
        cooldown: maxCooldown,
        maxCooldown: maxCooldown,
        morale: 50,
        maxMorale: 100,
        skill: c.skill || null,
        side: 'opponent'
      };
    });

    // 플레이어 속도 (항해 전투와 동일)
    const speedStatBonus = (userStats?.speed || 0) * 2;
    const playerSpeed = 100 + fishingSkill * 10 + speedStatBonus;
    const playerMaxCooldown = Math.max(500, 5000 - playerSpeed * 6);
    
    console.log(`[Arena] Player Speed: ${playerSpeed} → maxCooldown: ${playerMaxCooldown}`);

    // 상대 능력치 계산 (서버에서 받은 장비 정보 사용)
    const opponentAccessoryLevel = getAccessoryLevel(opponentData.userStats?.accessory);
    const opponentAccessoryBonus = calculateTotalEnhancementBonus(opponentData.userStats?.accessoryEnhancement || 0);
    const opponentBaseHP = calculatePlayerMaxHp(opponentAccessoryLevel, opponentAccessoryBonus);
    const opponentHealthBonus = opponentAccessoryLevel * (opponentData.userStats?.health || 0) * 5;
    const opponentMaxHP = opponentBaseHP + opponentHealthBonus;

    const opponentRodBonus = calculateTotalEnhancementBonus(opponentData.userStats?.fishingRodEnhancement || 0);
    const opponentAttackRange = calculatePlayerAttack(opponentData.fishingSkill, opponentRodBonus);
    const opponentBaseAttack = opponentAttackRange.base || opponentAttackRange;
    const opponentRodIndex = getFishingRodIndex(opponentData.userStats?.fishingRod);
    const opponentAttackBonus = opponentRodIndex * (opponentData.userStats?.attack || 0);
    const opponentAttack = opponentBaseAttack + opponentAttackBonus;

    // 상대 속도 (항해 전투와 동일)
    const opponentSpeedStatBonus = (opponentData.userStats?.speed || 0) * 2;
    const opponentSpeed = 100 + (opponentData.fishingSkill || 1) * 10 + opponentSpeedStatBonus;
    const opponentMaxCooldown = Math.max(500, 5000 - opponentSpeed * 6);

    const initialState = {
      battleId,
      opponentRank,
      player: {
        username: playerData.username,
        hp: playerMaxHP,
        maxHp: playerMaxHP,
        attack: playerAttack,
        speed: playerSpeed,
        cooldown: playerMaxCooldown,
        maxCooldown: playerMaxCooldown,
        companions: playerCompanions
      },
      opponent: {
        username: opponentData.username,
        hp: opponentMaxHP,
        maxHp: opponentMaxHP,
        attack: opponentAttack,
        speed: opponentSpeed,
        cooldown: opponentMaxCooldown,
        maxCooldown: opponentMaxCooldown,
        companions: opponentCompanions
      },
      status: 'fighting'
    };

    setBattleState(initialState);
    setBattleLog([
      `⚔️ ${playerData.username} vs ${opponentData.username} 결투 시작!`
    ]);
  };

  // 실시간 전투 로직 (항해 시스템 기반)
  useEffect(() => {
    if (currentView !== 'battle' || !battleState || battleState.status !== 'fighting') {
      if (battleIntervalRef.current) {
        clearInterval(battleIntervalRef.current);
        battleIntervalRef.current = null;
      }
      return;
    }

    // 50ms마다 업데이트
    battleIntervalRef.current = setInterval(() => {
      setBattleState(prev => {
        if (!prev || prev.status !== 'fighting') return prev;

        const newState = { ...prev };
        const newLog = [];

        // 공격 가능한 상대 타겟 계산 (상대 플레이어 + 상대 동료)
        const opponentTargets = [
          newState.opponent.hp > 0 ? { type: 'player', data: newState.opponent } : null,
          ...newState.opponent.companions.map((c, idx) => c.hp > 0 ? { type: 'companion', data: c, index: idx } : null).filter(t => t !== null)
        ].filter(t => t !== null);

        // 플레이어 공격 (상대 타겟이 있을 때만)
        if (newState.player.hp > 0 && opponentTargets.length > 0) {
          newState.player.cooldown -= 25;
          if (newState.player.cooldown <= 0) {
            const target = opponentTargets[Math.floor(Math.random() * opponentTargets.length)];
            const damage = Math.floor(newState.player.attack * (0.9 + Math.random() * 0.2));
            
            if (target.type === 'player') {
              newState.opponent.hp = Math.max(0, newState.opponent.hp - damage);
              newLog.push(`⚔️ ${newState.player.username}의 공격! ${damage} 데미지`);
            } else {
              newState.opponent.companions[target.index].hp = Math.max(0, newState.opponent.companions[target.index].hp - damage);
              newLog.push(`⚔️ ${newState.player.username}이(가) ${target.data.name}에게 ${damage} 데미지`);
            }
            
            newState.player.cooldown = newState.player.maxCooldown;
          }
        }

        // 플레이어 동료 공격 (상대 타겟이 있을 때만)
        newState.player.companions = newState.player.companions.map(companion => {
          if (companion.hp <= 0 || opponentTargets.length === 0) return companion;
          
          const updated = { ...companion };
          updated.cooldown -= 25;
          
          if (updated.cooldown <= 0) {
            updated.morale = Math.min(updated.maxMorale, updated.morale + 15);
            
            const canUseSkill = updated.skill && updated.morale >= 100;
            let damage;
            let isSkill = false;
            
            if (canUseSkill) {
              isSkill = true;
              updated.morale = 0;
              
              if (updated.skill.skillType === 'heal') {
                // 힐 스킬
                const healTargets = newState.player.companions.filter(c => c.hp > 0 && c.hp < c.maxHp);
                if (healTargets.length > 0) {
                  const target = healTargets.reduce((min, c) => c.hp < min.hp ? c : min);
                  const healAmount = Math.floor(updated.attack * (updated.skill.healMultiplier || 1.5));
                  const actualHeal = Math.min(healAmount, target.maxHp - target.hp);
                  target.hp = Math.min(target.maxHp, target.hp + healAmount);
                  newLog.push(`✨ ${updated.name}의 ${updated.skill.name}! ${target.name} +${actualHeal} HP`);
                }
                damage = 0;
              } else {
                // 공격 스킬
                damage = Math.floor(updated.attack * updated.skill.damageMultiplier * (0.9 + Math.random() * 0.2));
                newLog.push(`✨ ${updated.name}의 ${updated.skill.name}! ${damage} 데미지!`);
              }
            } else {
              damage = Math.floor(updated.attack * (0.9 + Math.random() * 0.2));
              newLog.push(`${updated.name}의 공격! ${damage} 데미지`);
            }
            
            // 상대 타겟 공격
            if (damage > 0 && opponentTargets.length > 0) {
              const target = opponentTargets[Math.floor(Math.random() * opponentTargets.length)];
              
              if (target.type === 'player') {
                newState.opponent.hp = Math.max(0, newState.opponent.hp - damage);
              } else {
                newState.opponent.companions[target.index].hp = Math.max(0, newState.opponent.companions[target.index].hp - damage);
              }
            }
            
            updated.cooldown = updated.maxCooldown;
          }
          
          return updated;
        });

        // 상대 플레이어 공격 (공격할 타겟이 있을 때만 쿨다운 감소)
        const playerTargets = [
          newState.player.hp > 0 ? { type: 'player', data: newState.player } : null,
          ...newState.player.companions.map((c, idx) => c.hp > 0 ? { type: 'companion', data: c, index: idx } : null).filter(t => t !== null)
        ].filter(t => t !== null);
        
        if (newState.opponent.hp > 0 && playerTargets.length > 0) {
          newState.opponent.cooldown -= 25;
          if (newState.opponent.cooldown <= 0) {
            const target = playerTargets[Math.floor(Math.random() * playerTargets.length)];
            const damage = Math.floor(newState.opponent.attack * (0.8 + Math.random() * 0.4));
            
            if (target.type === 'player') {
              newState.player.hp = Math.max(0, newState.player.hp - damage);
              newLog.push(`⚔️ ${newState.opponent.username}의 공격! ${damage} 데미지`);
            } else {
              newState.player.companions[target.index].hp = Math.max(0, newState.player.companions[target.index].hp - damage);
              newLog.push(`⚔️ ${newState.opponent.username}이(가) ${target.data.name}에게 ${damage} 데미지`);
            }
            
            newState.opponent.cooldown = newState.opponent.maxCooldown;
          }
        }

        // 상대 동료 공격 (공격할 타겟이 있을 때만 쿨다운 감소)
        newState.opponent.companions = newState.opponent.companions.map(companion => {
          if (companion.hp <= 0 || playerTargets.length === 0) return companion;
          
          const updated = { ...companion };
          updated.cooldown -= 25;
          
          if (updated.cooldown <= 0 && playerTargets.length > 0) {
            updated.morale = Math.min(updated.maxMorale, updated.morale + 15);
            
            const canUseSkill = updated.skill && updated.morale >= 100;
            let damage;
            let isSkill = false;
            
            if (canUseSkill) {
              isSkill = true;
              updated.morale = 0;
              
              if (updated.skill.skillType === 'heal') {
                // 상대 힐 스킬
                const healTargets = newState.opponent.companions.filter(c => c.hp > 0 && c.hp < c.maxHp);
                if (healTargets.length > 0) {
                  const target = healTargets.reduce((min, c) => c.hp < min.hp ? c : min);
                  const healAmount = Math.floor(updated.attack * (updated.skill.healMultiplier || 1.5));
                  const actualHeal = Math.min(healAmount, target.maxHp - target.hp);
                  target.hp = Math.min(target.maxHp, target.hp + healAmount);
                  newLog.push(`✨ ${updated.name}의 ${updated.skill.name}! ${target.name} +${actualHeal} HP`);
                }
                damage = 0;
              } else {
                damage = Math.floor(updated.attack * updated.skill.damageMultiplier * (0.9 + Math.random() * 0.2));
                newLog.push(`✨ ${updated.name}의 ${updated.skill.name}! ${damage} 데미지!`);
              }
            } else {
              damage = Math.floor(updated.attack * (0.9 + Math.random() * 0.2));
              newLog.push(`${updated.name}의 공격! ${damage} 데미지`);
            }
            
            if (damage > 0) {
              const target = playerTargets[Math.floor(Math.random() * playerTargets.length)];
              
              if (target.type === 'player') {
                newState.player.hp = Math.max(0, newState.player.hp - damage);
              } else {
                newState.player.companions[target.index].hp = Math.max(0, newState.player.companions[target.index].hp - damage);
              }
            }
            
            updated.cooldown = updated.maxCooldown;
          }
          
          return updated;
        });

        // 전투 종료 확인
        const playerAlive = newState.player.hp > 0 || newState.player.companions.some(c => c.hp > 0);
        const opponentAlive = newState.opponent.hp > 0 || newState.opponent.companions.some(c => c.hp > 0);
        
        if (!playerAlive) {
          newState.status = 'defeat';
          newLog.push('', '😢 패배했습니다...');
          finishBattle(false, newState);
        } else if (!opponentAlive) {
          newState.status = 'victory';
          newLog.push('', '🎉 승리했습니다!');
          finishBattle(true, newState);
        }

        if (newLog.length > 0) {
          setBattleLog(prev => [...prev, ...newLog]);
        }

        return newState;
      });
    }, 50);

    return () => {
      if (battleIntervalRef.current) {
        clearInterval(battleIntervalRef.current);
      }
    };
  }, [currentView, battleState?.status]);

  // 전투 종료
  const finishBattle = async (isWin, finalState) => {
    try {
      if (battleIntervalRef.current) {
        clearInterval(battleIntervalRef.current);
      }

      const token = localStorage.getItem('jwtToken');
      
      console.log('[Arena] 전투 종료 요청:', {
        battleId: finalState.battleId,
        isWin,
        opponentUuid: selectedOpponent.userUuid,
        opponentRank: finalState.opponentRank
      });
      
      const response = await axios.post(
        `${serverUrl}/api/arena/finish-battle`,
        {
          battleId: finalState.battleId,
          isWin,
          opponentUuid: selectedOpponent.userUuid,
          opponentUsername: finalState.opponent.username,
          opponentRank: finalState.opponentRank || 1
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setBattleResult({
          ...response.data.result,
          opponentName: finalState.opponent.username
        });
        
        // 전투 종료 콜백 (낚시실력 새로고침)
        if (onBattleEnd) {
          await onBattleEnd();
        }
        
        setTimeout(() => {
          setCurrentView('result');
          loadArenaData();
        }, 2000);
      }
    } catch (error) {
      console.error('전투 결과 처리 실패:', error);
      alert('전투 결과 처리에 실패했습니다.');
      returnToLobby();
    }
  };

  // 로비로 돌아가기
  const returnToLobby = () => {
    if (battleIntervalRef.current) {
      clearInterval(battleIntervalRef.current);
    }
    setCurrentView('lobby');
    setBattleState(null);
    setBattleLog([]);
    setBattleResult(null);
    setSelectedOpponent(null);
    loadArenaData();
  };

  // ELO 변화 색상
  const getEloChangeColor = (change) => {
    if (change > 0) return 'text-green-400';
    if (change < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  // 로그인 확인
  if (!userData?.userUuid || !userData?.username) {
    return (
      <div className={`flex items-center justify-center min-h-[400px] rounded-2xl ${
        isDarkMode ? 'glass-card' : 'bg-white/80 backdrop-blur-md border border-gray-300/30'
      }`}>
        <div className="text-center">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <p className={`text-lg font-bold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            결투장 입장 불가
          </p>
          <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
            로그인이 필요합니다.
          </p>
        </div>
      </div>
    );
  }

  // 로딩 중
  if (loading && currentView === 'lobby') {
    return (
      <div className={`flex items-center justify-center min-h-[400px] rounded-2xl ${
        isDarkMode ? 'glass-card' : 'bg-white/80 backdrop-blur-md border border-gray-300/30'
      }`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>로딩 중...</p>
        </div>
      </div>
    );
  }

  // 결과 화면
  if (currentView === 'result' && battleResult) {
    return (
      <div className={`rounded-2xl board-shadow min-h-full flex flex-col ${
        isDarkMode ? "glass-card" : "bg-white/80 backdrop-blur-md border border-gray-300/30"
      }`}>
        {/* 헤더 */}
        <div className={`border-b p-4 ${
          isDarkMode ? "border-white/10" : "border-gray-300/20"
        }`}>
          <div className="flex items-center justify-center">
            <div className={`px-4 py-2 rounded-lg font-bold ${
              battleResult.isWin
                ? isDarkMode ? "bg-yellow-500/20 text-yellow-400 border border-yellow-400/30" : "bg-yellow-500/10 text-yellow-600 border border-yellow-500/30"
                : isDarkMode ? "bg-gray-500/20 text-gray-400 border border-gray-400/30" : "bg-gray-500/10 text-gray-600 border border-gray-500/30"
            }`}>
              {battleResult.isWin ? '🎉 승리!' : '😢 패배'}
            </div>
          </div>
        </div>

        {/* 결과 콘텐츠 */}
        <div className="flex-1 p-6">
        <div className="text-center">
          <div className="mb-6">
            {battleResult.isWin ? (
              <div className="text-6xl mb-4">🎉</div>
            ) : (
              <div className="text-6xl mb-4">😢</div>
            )}
            <h2 className={`text-3xl font-bold mb-2 ${
              battleResult.isWin ? 'text-yellow-400' : 'text-gray-400'
            }`}>
              {battleResult.isWin ? '승리!' : '패배'}
            </h2>
            <p className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
              vs {battleResult.opponentName}
            </p>
          </div>

          <div className={`p-6 rounded-xl mb-6 ${
            isDarkMode ? 'bg-white/5' : 'bg-gray-100'
          }`}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                  ELO 변화
                </span>
                <span className={`text-2xl font-bold ${getEloChangeColor(battleResult.eloChange)}`}>
                  {battleResult.eloChange > 0 ? '+' : ''}{battleResult.eloChange}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                  새 ELO
                </span>
                <span className={`text-xl font-bold ${
                  isDarkMode ? 'text-blue-400' : 'text-blue-600'
                }`}>
                  {battleResult.newElo}
                </span>
              </div>

              {battleResult.isWin && (
                <>
                  <div className="flex items-center justify-between">
                    <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                      승점 획득
                    </span>
                    <span className="text-xl font-bold text-yellow-400">
                      +{battleResult.victorPoints}
                    </span>
                  </div>

                  {battleResult.winStreak > 1 && (
                    <div className="flex items-center justify-center gap-2 text-orange-400 text-lg font-bold">
                      <Zap className="w-5 h-5" />
                      {battleResult.winStreak}연승!
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <button
            onClick={returnToLobby}
            className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
              isDarkMode
                ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-400/30'
                : 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border border-blue-500/30'
            }`}
          >
            로비로 돌아가기
          </button>
        </div>
        </div>
      </div>
    );
  }

  // 전투 화면
  if (currentView === 'battle' && battleState) {
    return (
      <div className={`rounded-2xl board-shadow min-h-full flex flex-col ${
        isDarkMode ? "glass-card" : "bg-white/80 backdrop-blur-md border border-gray-300/30"
      }`}>
        {/* 헤더 */}
        <div className={`border-b p-4 ${
          isDarkMode ? "border-white/10" : "border-gray-300/20"
        }`}>
          <div className="flex items-center justify-center">
            <div className={`px-4 py-2 rounded-lg font-bold ${
              isDarkMode ? "bg-red-500/20 text-red-400 border border-red-400/30" : "bg-red-500/10 text-red-600 border border-red-500/30"
            }`}>
              ⚔️ 전투 중
            </div>
          </div>
        </div>

        {/* 전투 콘텐츠 */}
        <div className="flex-1 p-6 overflow-y-auto">
        {/* 전투 정보 */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* 플레이어 */}
          <CharacterPanel
            character={battleState.player}
            companions={battleState.player.companions}
            isDarkMode={isDarkMode}
            isPlayer={true}
          />

          {/* 상대 */}
          <CharacterPanel
            character={battleState.opponent}
            companions={battleState.opponent.companions}
            isDarkMode={isDarkMode}
            isPlayer={false}
          />
        </div>

        {/* 전투 로그 */}
        <div className={`p-4 rounded-xl h-64 overflow-y-auto ${
          isDarkMode ? 'bg-black/20' : 'bg-gray-100'
        }`} ref={battleLogRef}>
          {battleLog.map((log, idx) => (
            <div key={idx} className={`text-sm mb-1 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              {log}
            </div>
          ))}
        </div>
        </div>
      </div>
    );
  }

  // 결투랭킹 화면
  if (subTab === 'ranking') {
    return (
      <div className={`rounded-2xl board-shadow min-h-full flex flex-col ${
        isDarkMode ? "glass-card" : "bg-white/80 backdrop-blur-md border border-gray-300/30"
      }`}>
        {/* 헤더 (기존과 동일) */}
        <div className={`border-b p-4 ${isDarkMode ? "border-white/10" : "border-gray-300/20"}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 border ${
                isDarkMode ? "border-white/10" : "border-purple-300/30"
              }`}>
                <Shield className={`w-4 h-4 ${isDarkMode ? "text-purple-400" : "text-purple-600"}`} />
              </div>
              <div>
                <h2 className={`text-lg font-semibold ${isDarkMode ? "text-white" : "text-gray-800"}`}>결투장</h2>
                <p className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>PVP 전투 시스템</p>
              </div>
            </div>
            {myStats && (
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                isDarkMode ? "bg-yellow-500/20 text-yellow-400" : "bg-yellow-500/10 text-yellow-600"
              }`}>
                승점: {myStats.victorPoints}
              </div>
            )}
          </div>

          {/* 하위 탭 버튼 */}
          <div className="flex gap-2">
            <button
              onClick={() => setSubTab('battle')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-300 ${
                subTab === 'battle'
                  ? isDarkMode ? "bg-purple-500/20 text-purple-400 border border-purple-400/30" : "bg-purple-500/10 text-purple-600 border border-purple-500/30"
                  : isDarkMode ? "bg-white/5 text-gray-400 hover:bg-white/10" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
              <div className="flex items-center justify-center gap-2">
                <Sword className="w-4 h-4" />
                결투장
              </div>
            </button>
            <button
              onClick={() => setSubTab('shop')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-300 ${
                subTab === 'shop'
                  ? isDarkMode ? "bg-purple-500/20 text-purple-400 border border-purple-400/30" : "bg-purple-500/10 text-purple-600 border border-purple-500/30"
                  : isDarkMode ? "bg-white/5 text-gray-400 hover:bg-white/10" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
              <div className="flex items-center justify-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                결투상점
              </div>
            </button>
            <button
              onClick={() => setSubTab('ranking')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-300 ${
                subTab === 'ranking'
                  ? isDarkMode ? "bg-purple-500/20 text-purple-400 border border-purple-400/30" : "bg-purple-500/10 text-purple-600 border border-purple-500/30"
                  : isDarkMode ? "bg-white/5 text-gray-400 hover:bg-white/10" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
              <div className="flex items-center justify-center gap-2">
                <Trophy className="w-4 h-4" />
                결투랭킹
              </div>
            </button>
          </div>
        </div>

        {/* 결투랭킹 콘텐츠 */}
        <div className="flex-1 p-4 overflow-y-auto">
          {/* 랭킹 보너스 설명 */}
          <div className={`p-4 rounded-xl mb-4 ${
            isDarkMode ? 'bg-purple-500/10 border border-purple-400/30' : 'bg-purple-500/5 border border-purple-500/30'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-5 h-5 text-yellow-400" />
              <h3 className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                결투장 순위 보너스
              </h3>
            </div>
            <div className={`text-sm space-y-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-yellow-400" />
                <span><strong className="text-yellow-400">1위:</strong> 낚시실력 <span className="text-green-400 font-bold">+2</span></span>
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-blue-400" />
                <span><strong className="text-blue-400">2~10위:</strong> 낚시실력 <span className="text-green-400 font-bold">+1</span></span>
              </div>
            </div>
          </div>

          {/* 랭킹 목록 */}
          {loading ? (
            <div className="text-center py-8">
              <div className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                랭킹 로딩 중...
              </div>
            </div>
          ) : allRankings && allRankings.rankings ? (
            <div className="space-y-2">
              {allRankings.rankings.map((player) => (
                <div key={player.userUuid} className={`p-4 rounded-xl flex items-center justify-between ${
                  player.rank <= 3 
                    ? isDarkMode ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-2 border-yellow-400/50' : 'bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-2 border-yellow-500/50'
                    : player.rank <= 10
                      ? isDarkMode ? 'bg-blue-500/10 border border-blue-400/30' : 'bg-blue-500/5 border border-blue-500/30'
                      : isDarkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'
                } transition-all duration-300`}>
                  <div className="flex items-center gap-4">
                    <div className={`text-2xl font-bold w-12 text-center ${
                      player.rank === 1 ? 'text-yellow-400' : player.rank === 2 ? 'text-gray-400' : player.rank === 3 ? 'text-orange-400' : player.rank <= 10 ? 'text-blue-400' : isDarkMode ? 'text-gray-500' : 'text-gray-600'
                    }`}>
                      {player.rank <= 3 ? (player.rank === 1 ? '🥇' : player.rank === 2 ? '🥈' : '🥉') : `#${player.rank}`}
                    </div>
                    <div>
                      <div className={`font-bold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {player.username}
                        {player.rank === 1 && <Crown className="w-4 h-4 text-yellow-400" />}
                        {player.rank >= 2 && player.rank <= 10 && <Star className="w-4 h-4 text-blue-400" />}
                      </div>
                      <div className="text-sm text-gray-400">
                        {player.totalWins || 0}승 {player.totalLosses || 0}패
                        {player.winStreak > 0 && (<span className="ml-2 text-green-400">🔥 {player.winStreak}연승</span>)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-400">{player.elo}</div>
                    <div className={`text-xs px-2 py-1 rounded ${
                      player.rank === 1 ? 'bg-yellow-500/20 text-yellow-400' : player.rank <= 10 ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {player.rank === 1 ? '+2 낚시실력' : player.rank <= 10 ? '+1 낚시실력' : '보너스 없음'}
                    </div>
                  </div>
                </div>
              ))}

              {/* 페이지네이션 */}
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => loadAllRankings(rankingPage - 1)}
                  disabled={!allRankings.hasPrevPage}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    allRankings.hasPrevPage
                      ? isDarkMode ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30' : 'bg-purple-500/10 text-purple-600 hover:bg-purple-500/20'
                      : 'bg-gray-500/20 text-gray-500 cursor-not-allowed'
                  }`}>
                  이전
                </button>
                <div className={`px-4 py-2 rounded-lg font-medium ${
                  isDarkMode ? 'bg-white/5 text-white' : 'bg-gray-100 text-gray-900'
                }`}>
                  {allRankings.currentPage} / {allRankings.totalPages}
                </div>
                <button
                  onClick={() => loadAllRankings(rankingPage + 1)}
                  disabled={!allRankings.hasNextPage}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    allRankings.hasNextPage
                      ? isDarkMode ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30' : 'bg-purple-500/10 text-purple-600 hover:bg-purple-500/20'
                      : 'bg-gray-500/20 text-gray-500 cursor-not-allowed'
                  }`}>
                  다음
                </button>
              </div>

              <div className={`text-center text-sm mt-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                총 {allRankings.totalUsers}명의 플레이어
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Trophy className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
              <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                랭킹 정보를 불러올 수 없습니다
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 결투상점 화면
  if (subTab === 'shop') {
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
                <Shield className={`w-4 h-4 ${
                  isDarkMode ? "text-purple-400" : "text-purple-600"
                }`} />
              </div>
              <div>
                <h2 className={`text-lg font-semibold ${
                  isDarkMode ? "text-white" : "text-gray-800"
                }`}>결투장</h2>
                <p className={`text-xs ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}>PVP 전투 시스템</p>
              </div>
            </div>
            {myStats && (
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                isDarkMode ? "bg-yellow-500/20 text-yellow-400" : "bg-yellow-500/10 text-yellow-600"
              }`}>
                승점: {myStats.victorPoints}
              </div>
            )}
          </div>

          {/* 하위 탭 버튼 */}
          <div className="flex gap-2">
            <button
              onClick={() => setSubTab('battle')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-300 ${
                subTab === 'battle'
                  ? isDarkMode
                    ? "bg-purple-500/20 text-purple-400 border border-purple-400/30"
                    : "bg-purple-500/10 text-purple-600 border border-purple-500/30"
                  : isDarkMode
                    ? "bg-white/5 text-gray-400 hover:bg-white/10"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Sword className="w-4 h-4" />
                결투장
              </div>
            </button>
            <button
              onClick={() => setSubTab('shop')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-300 ${
                subTab === 'shop'
                  ? isDarkMode
                    ? "bg-purple-500/20 text-purple-400 border border-purple-400/30"
                    : "bg-purple-500/10 text-purple-600 border border-purple-500/30"
                  : isDarkMode
                    ? "bg-white/5 text-gray-400 hover:bg-white/10"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                결투상점
              </div>
            </button>
            <button
              onClick={() => setSubTab('ranking')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-300 ${
                subTab === 'ranking'
                  ? isDarkMode
                    ? "bg-purple-500/20 text-purple-400 border border-purple-400/30"
                    : "bg-purple-500/10 text-purple-600 border border-purple-500/30"
                  : isDarkMode
                    ? "bg-white/5 text-gray-400 hover:bg-white/10"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Trophy className="w-4 h-4" />
                결투랭킹
              </div>
            </button>
          </div>
        </div>

        {/* 결투상점 콘텐츠 */}
        <div className="flex-1 p-4">
          <div className={`p-6 rounded-xl text-center ${
            isDarkMode ? 'bg-white/5' : 'bg-gray-100'
          }`}>
            <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-purple-400" />
            <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              결투상점
            </h3>
            <p className={`mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              승점으로 특별한 아이템을 구매할 수 있습니다
            </p>
            <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
              준비 중...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 결투장 로비 화면
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
              <Shield className={`w-4 h-4 ${
                isDarkMode ? "text-purple-400" : "text-purple-600"
              }`} />
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${
                isDarkMode ? "text-white" : "text-gray-800"
              }`}>결투장</h2>
              <p className={`text-xs ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}>PVP 전투 시스템</p>
            </div>
          </div>
          <div className="flex gap-2">
            {dailyLimit && (
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                dailyLimit.canBattle
                  ? isDarkMode
                    ? 'bg-green-500/20 text-green-400 border border-green-400/30'
                    : 'bg-green-500/10 text-green-600 border border-green-500/30'
                  : isDarkMode
                    ? 'bg-red-500/20 text-red-400 border border-red-400/30'
                    : 'bg-red-500/10 text-red-600 border border-red-500/30'
              }`}>
                오늘 전투: {dailyLimit.remaining}/10
              </div>
            )}
            {myStats && (
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                isDarkMode ? "bg-yellow-500/20 text-yellow-400" : "bg-yellow-500/10 text-yellow-600"
              }`}>
                승점: {myStats.victorPoints}
              </div>
            )}
          </div>
        </div>

        {/* 하위 탭 버튼 */}
        <div className="flex gap-2">
          <button
            onClick={() => setSubTab('battle')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-300 ${
              subTab === 'battle'
                ? isDarkMode
                  ? "bg-purple-500/20 text-purple-400 border border-purple-400/30"
                  : "bg-purple-500/10 text-purple-600 border border-purple-500/30"
                : isDarkMode
                  ? "bg-white/5 text-gray-400 hover:bg-white/10"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Sword className="w-4 h-4" />
              결투장
            </div>
          </button>
          <button
            onClick={() => setSubTab('shop')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-300 ${
              subTab === 'shop'
                ? isDarkMode
                  ? "bg-purple-500/20 text-purple-400 border border-purple-400/30"
                  : "bg-purple-500/10 text-purple-600 border border-purple-500/30"
                : isDarkMode
                  ? "bg-white/5 text-gray-400 hover:bg-white/10"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              결투상점
            </div>
          </button>
          <button
            onClick={() => setSubTab('ranking')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-300 ${
              subTab === 'ranking'
                ? isDarkMode
                  ? "bg-purple-500/20 text-purple-400 border border-purple-400/30"
                  : "bg-purple-500/10 text-purple-600 border border-purple-500/30"
                : isDarkMode
                  ? "bg-white/5 text-gray-400 hover:bg-white/10"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Trophy className="w-4 h-4" />
              결투랭킹
            </div>
          </button>
        </div>
      </div>

      {/* 결투장 콘텐츠 */}
      <div className="flex-1 p-4 overflow-y-auto">

      {myStats && (
        <div className={`p-4 rounded-xl mb-6 ${
          isDarkMode ? 'bg-blue-500/10 border border-blue-400/30' : 'bg-blue-500/5 border border-blue-500/30'
        }`}>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-400 mb-1">ELO</div>
              <div className="text-2xl font-bold text-blue-400">{myStats.elo}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">승점</div>
              <div className="text-2xl font-bold text-yellow-400">{myStats.victorPoints}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">전적</div>
              <div className={`text-lg font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {myStats.totalWins}승 {myStats.totalLosses}패
              </div>
            </div>
          </div>
        </div>
      )}

      {!rankings ? (
        <div className={`p-6 rounded-xl text-center ${
          isDarkMode ? 'bg-white/5' : 'bg-gray-100'
        }`}>
          <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
            랭킹 데이터를 불러오는 중...
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {rankings.higher.length > 0 && (
            <div>
              <h3 className={`text-lg font-bold mb-3 flex items-center gap-2 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                <TrendingUp className="w-5 h-5 text-green-400" />
                상위 랭커
              </h3>
              <div className="space-y-2">
                {rankings.higher.map((player, idx) => (
                  <PlayerCard
                    key={player.userUuid}
                    player={player}
                    rank={idx + 1}
                    isDarkMode={isDarkMode}
                    onBattle={startBattle}
                    canBattle={dailyLimit?.canBattle}
                    myElo={myStats?.elo}
                    isHigher={true}
                  />
                ))}
              </div>
            </div>
          )}

          {rankings.myData && (
            <div className={`p-4 rounded-xl border-2 ${
              isDarkMode 
                ? 'bg-yellow-500/10 border-yellow-400' 
                : 'bg-yellow-500/5 border-yellow-500'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Crown className="w-6 h-6 text-yellow-400" />
                  <div>
                    <div className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {userData?.username} (나)
                    </div>
                    <div className="text-sm text-gray-400">
                      {rankings.myData.rank}위
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-400">{rankings.myData.elo}</div>
                  <div className="text-sm text-gray-400">
                    {rankings.myData.totalWins}승 {rankings.myData.totalLosses}패
                  </div>
                </div>
              </div>
            </div>
          )}

          {rankings.lower.length > 0 && (
            <div>
              <h3 className={`text-lg font-bold mb-3 flex items-center gap-2 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                <TrendingDown className="w-5 h-5 text-orange-400" />
                하위 유저
              </h3>
              <div className="space-y-2">
                {rankings.lower.map((player, idx) => (
                  <PlayerCard
                    key={player.userUuid}
                    player={player}
                    rank={idx + 1}
                    isDarkMode={isDarkMode}
                    onBattle={startBattle}
                    canBattle={dailyLimit?.canBattle}
                    myElo={myStats?.elo}
                    isHigher={false}
                  />
                ))}
              </div>
            </div>
          )}
          
          {rankings.higher.length === 0 && rankings.lower.length === 0 && (
            <div className={`p-6 rounded-xl text-center ${
              isDarkMode ? 'bg-white/5' : 'bg-gray-100'
            }`}>
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className={`font-bold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                대결 가능한 상대가 없습니다
              </p>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                다른 유저가 결투장에 참여할 때까지 기다려주세요!
              </p>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
};

// 캐릭터 패널 컴포넌트
const CharacterPanel = ({ character, companions, isDarkMode, isPlayer }) => {
  const bgColor = isPlayer 
    ? isDarkMode ? 'bg-blue-500/10 border border-blue-400/30' : 'bg-blue-500/5 border border-blue-500/30'
    : isDarkMode ? 'bg-red-500/10 border border-red-400/30' : 'bg-red-500/5 border border-red-500/30';
  
  const textColor = isPlayer ? 'text-blue-400' : 'text-red-400';

  return (
    <div className={`p-4 rounded-xl ${bgColor}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className={`font-bold ${textColor}`}>{character.username}</h3>
      </div>
      
      {/* HP 바 */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>HP</span>
          <span className="text-red-400 font-bold">
            {character.hp}/{character.maxHp}
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-300 ${
              isPlayer ? 'bg-gradient-to-r from-green-500 to-blue-500' : 'bg-gradient-to-r from-red-500 to-orange-500'
            }`}
            style={{ width: `${(character.hp / character.maxHp) * 100}%` }}
          />
        </div>
      </div>

      {/* 속도바 (살아있을 때만 표시) */}
      {character.hp > 0 && (
        <div className="mb-3">
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                isPlayer ? 'bg-blue-400' : 'bg-red-400'
              }`}
              style={{ 
                width: `${100 - (character.cooldown / character.maxCooldown) * 100}%`,
                transition: 'width 0.05s linear'
              }}
            />
          </div>
        </div>
      )}
      
      <div className="text-xs text-gray-400 mb-3">
        <div>⚔️ 공격력: {character.attack}</div>
        <div>⚡ 속도: {character.speed}</div>
        {character.hp <= 0 && (
          <div className="text-gray-600 font-bold mt-1">💀 전투불능</div>
        )}
      </div>
      
      {/* 동료 목록 */}
      <div className="space-y-1 max-h-48 overflow-y-auto">
        <div className="text-xs font-bold text-gray-400 mb-1">
          동료 ({companions.length}명)
        </div>
        {companions.length === 0 ? (
          <div className="text-xs text-gray-500">참여 중인 동료 없음</div>
        ) : (
          companions.map((companion, idx) => (
            <div key={idx} className="space-y-1 mb-2">
              <div className="flex items-center justify-between text-xs">
                <span className={companion.hp > 0 ? 'text-gray-300' : 'text-gray-600 line-through'}>
                  {companion.name}
                </span>
                <span className={companion.hp > 0 ? 'text-green-400' : 'text-gray-600'}>
                  {companion.hp > 0 ? `${companion.hp}/${companion.maxHp}` : '전투불능'}
                </span>
              </div>
              {companion.hp > 0 && (
                <>
                  {/* 체력바 */}
                  <div className="w-full bg-gray-700 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-gradient-to-r from-green-500 to-green-400"
                      style={{ 
                        width: `${(companion.hp / companion.maxHp) * 100}%`,
                        transition: 'width 0.3s ease-out'
                      }}
                    />
                  </div>
                  {/* 속도바 (통일된 색상) */}
                  <div className="w-full bg-gray-700 rounded-full h-1">
                    <div
                      className="h-1 rounded-full bg-cyan-400"
                      style={{ 
                        width: `${100 - (companion.cooldown / companion.maxCooldown) * 100}%`,
                        transition: 'width 0.05s linear'
                      }}
                    />
                  </div>
                  {/* Morale 바 (모든 동료에게 노란색으로 표시) */}
                  <div className="w-full bg-gray-700 rounded-full h-1">
                    <div
                      className="h-1 rounded-full bg-yellow-400"
                      style={{ 
                        width: `${(companion.morale / companion.maxMorale) * 100}%`,
                        transition: 'width 0.1s ease-out'
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// 플레이어 카드 컴포넌트
const PlayerCard = ({ player, rank, isDarkMode, onBattle, canBattle, myElo, isHigher }) => {
  const expectedEloChange = 60 - (rank - 1) * 3;
  const expectedLoseChange = -3 - (rank - 1) * 3;

  return (
    <div className={`p-4 rounded-xl flex items-center justify-between ${
      isDarkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'
    } transition-all duration-300`}>
      <div className="flex items-center gap-4">
        <div className={`text-lg font-bold ${
          rank <= 3 ? 'text-yellow-400' : 'text-gray-400'
        }`}>
          #{rank}
        </div>
        <div>
          <div className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {player.username}
          </div>
          <div className="text-sm text-gray-400">
            {player.totalWins}승 {player.totalLosses}패
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-xl font-bold text-blue-400">{player.elo}</div>
          <div className="text-xs text-gray-400">
            <span className="text-green-400">+{expectedEloChange}</span>
            {' / '}
            <span className="text-red-400">{expectedLoseChange}</span>
          </div>
        </div>
        
        <button
          onClick={() => onBattle(player)}
          disabled={!canBattle}
          className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 flex items-center gap-2 ${
            canBattle
              ? isDarkMode
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-400/30'
                : 'bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/30'
              : 'bg-gray-500/20 text-gray-500 cursor-not-allowed'
          }`}
        >
          <Sword className="w-4 h-4" />
          전투
        </button>
      </div>
    </div>
  );
};

export default ArenaTab;
