import React, { useState, useEffect, useRef } from 'react';
import { 
  MapPin, 
  Users, 
  Sword, 
  Shield, 
  Crown, 
  Clock,
  Star,
  Zap,
  Heart,
  ArrowLeft,
  Play,
  UserCheck,
  UserX,
  Target,
  ChevronDown,
  Plus,
  MessageCircle
} from 'lucide-react';
import { calculateCompanionStats } from '../data/companionData';

const ExpeditionTab = ({ userData, socket, isDarkMode = true, refreshInventory, refreshCompanions, syncBattleCompanionsToServer, battleCompanions, companionStats, userEquipment, fishingSkill, calculateTotalEnhancementBonus, sendExpeditionInviteToChat, pendingExpeditionInvite, setPendingExpeditionInvite }) => {
  // 접두어에 따른 색상 반환 (탐사와 동일)
  const getPrefixColor = (prefixName, isDark) => {
    switch (prefixName) {
      case '거대한':
        return isDark ? 'text-gray-300' : 'text-gray-700'; // 일반 (회색)
      case '변종':
        return isDark ? 'text-green-400' : 'text-green-600'; // 변종 (초록)
      case '심연의':
        return isDark ? 'text-purple-400' : 'text-purple-600'; // 심연 (보라)
      case '깊은어둠의':
        return isDark ? 'text-red-400' : 'text-red-600'; // 깊은어둠 (빨강)
      case '파멸의':
        return isDark ? 'text-orange-400' : 'text-orange-600'; // 파멸 (주황)
      case '종말의':
        return isDark ? 'text-yellow-400' : 'text-yellow-600'; // 종말 (금색)
      default:
        return isDark ? 'text-gray-300' : 'text-gray-700';
    }
  };

  // 접두어에 따른 배경 그라데이션 색상
  const getPrefixGradient = (prefixName, isDark) => {
    switch (prefixName) {
      case '거대한':
        return isDark 
          ? 'from-gray-500/10 to-gray-600/10 border-gray-500/30'
          : 'from-gray-500/5 to-gray-600/5 border-gray-500/30';
      case '변종':
        return isDark 
          ? 'from-green-500/10 to-emerald-500/10 border-green-500/30'
          : 'from-green-500/5 to-emerald-500/5 border-green-500/30';
      case '심연의':
        return isDark 
          ? 'from-purple-500/10 to-violet-500/10 border-purple-500/30'
          : 'from-purple-500/5 to-violet-500/5 border-purple-500/30';
      case '깊은어둠의':
        return isDark 
          ? 'from-red-500/10 to-pink-500/10 border-red-500/30'
          : 'from-red-500/5 to-pink-500/5 border-red-500/30';
      case '파멸의':
        return isDark 
          ? 'from-orange-500/10 to-amber-500/10 border-orange-500/30'
          : 'from-orange-500/5 to-amber-500/5 border-orange-500/30';
      case '종말의':
        return isDark 
          ? 'from-yellow-500/10 to-amber-400/10 border-yellow-500/30'
          : 'from-yellow-500/5 to-amber-400/5 border-yellow-500/30';
      default:
        return isDark 
          ? 'from-gray-500/10 to-gray-600/10 border-gray-500/30'
          : 'from-gray-500/5 to-gray-600/5 border-gray-500/30';
    }
  };
  const [currentView, setCurrentView] = useState('lobby'); // lobby, room, battle
  const [expeditionAreas, setExpeditionAreas] = useState([]);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [selectedArea, setSelectedArea] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAreaDropdown, setShowAreaDropdown] = useState(false);
  const [turnProgress, setTurnProgress] = useState(0); // 턴 진행률 (0-100)
  const [isProcessingTurn, setIsProcessingTurn] = useState(false); // 턴 처리 중 여부
  const [forceUpdateCounter, setForceUpdateCounter] = useState(0); // 강제 리렌더링용
  const [speedBars, setSpeedBars] = useState({}); // 각 캐릭터의 속도바 상태
  const [showDefeatModal, setShowDefeatModal] = useState(false); // 패배 모달 표시 상태
  const [playersCompanions, setPlayersCompanions] = useState({}); // 각 플레이어의 동료 정보
  const [isClaimingRewards, setIsClaimingRewards] = useState(false); // 보상 수령 중 여부 (중복 방지)
  const isClaimingRewardsRef = useRef(false); // 🔒 추가 중복 방지 (Ref는 즉시 업데이트됨)
  const progressIntervalRef = useRef(null);
  const speedBarIntervalsRef = useRef({});
  const battleLogRef = useRef(null);
  const dropdownRef = useRef(null);
  const currentRoomRef = useRef(null); // currentRoom ref (속도바에서 접근용)

  // 🧹 컴포넌트 언마운트 시 모든 interval 정리
  useEffect(() => {
    return () => {
      // 프로그레스바 interval 정리
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
        console.log('[EXPEDITION] 프로그레스바 interval 정리');
      }
      
      // 모든 속도바 interval 정리
      if (speedBarIntervalsRef.current) {
        Object.values(speedBarIntervalsRef.current).forEach(interval => {
          if (interval) clearInterval(interval);
        });
        speedBarIntervalsRef.current = {};
        console.log('[EXPEDITION] 모든 속도바 interval 정리');
      }
    };
  }, []);

  // 3초 프로그레스바 시작 함수
  const startTurnProgress = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    
    setTurnProgress(0);
    setIsProcessingTurn(true);
    
    const duration = 3000; // 3초
    const interval = 50; // 50ms마다 업데이트
    const increment = (100 * interval) / duration;
    
    progressIntervalRef.current = setInterval(() => {
      setTurnProgress(prev => {
        const newProgress = prev + increment;
        if (newProgress >= 100) {
          clearInterval(progressIntervalRef.current);
          setIsProcessingTurn(false);
          return 100;
        }
        return newProgress;
      });
    }, interval);
  };

  // 프로그레스바 정리 함수
  const clearTurnProgress = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setTurnProgress(0);
    setIsProcessingTurn(false);
  };

  // 속도 저장용 ref (재시작 시 사용)
  const speedsRef = useRef({});
  
  // currentRoom이 변경될 때마다 ref 업데이트
  useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);

   // 속도바 시작 함수 (항해 전투와 동일한 쿨다운 방식)
   const startSpeedBar = (characterId, speed) => {
     // 🔥 속도 저장 (재시작 시 사용) - 최초 1회만 저장
     if (!speedsRef.current[characterId]) {
       speedsRef.current[characterId] = speed;
       console.log(`[EXPEDITION-SPEED] ${characterId} 속도 최초 저장: ${speed}`);
     } else {
       console.log(`[EXPEDITION-SPEED] ${characterId} 속도 재사용: ${speedsRef.current[characterId]} (요청: ${speed})`);
     }
     
     // 저장된 속도 사용 (일관성 유지)
     const actualSpeed = speedsRef.current[characterId];
     
     // 기존 타이머가 있으면 정리
     if (speedBarIntervalsRef.current[characterId]) {
       clearInterval(speedBarIntervalsRef.current[characterId]);
     }

     // 🔥 원정 전투 전용: 캐릭터별 개별 속도 조정
     let maxCooldown;
     if (characterId.startsWith('player_')) {
       // 플레이어: × 5 (항해 전투와 동일)
       maxCooldown = Math.max(500, 5000 - actualSpeed * 10);
     } else if (characterId.startsWith('companion_')) {
       // 동료: × 5 (항해 전투와 동일)
       maxCooldown = Math.max(500, 5000 - actualSpeed * 50);
     } else {
       // 몬스터: × 50 (매우 빠름)
       maxCooldown = Math.max(500, 5000 - actualSpeed * 50);
     }
     
     const interval = 50; // 50ms마다 업데이트
    
    let cooldown = maxCooldown; // maxCooldown에서 시작 (속도바 0%부터)
    setSpeedBars(prev => ({ ...prev, [characterId]: { current: maxCooldown, max: maxCooldown } }));
    
    console.log(`[EXPEDITION] ${characterId}: actualSpeed=${actualSpeed}, maxCooldown=${maxCooldown}, 도달시간=${(maxCooldown/1000).toFixed(2)}초`);

    speedBarIntervalsRef.current[characterId] = setInterval(() => {
      // 🔥 ref를 통해 최신 room 상태 확인
      const room = currentRoomRef.current;
      
      // 전투 종료 체크 (패배/승리 시 속도바 중단)
      if (!room) {
        clearInterval(speedBarIntervalsRef.current[characterId]);
        delete speedBarIntervalsRef.current[characterId];
        return;
      }
      
      // 🔥 전투 종료 상태 체크 (completed, failed 등)
      if (room.status !== 'in_progress') {
        clearInterval(speedBarIntervalsRef.current[characterId]);
        delete speedBarIntervalsRef.current[characterId];
        console.log(`[EXPEDITION-SPEED] ${characterId} 속도바 중단 (전투 종료: ${room.status})`);
        return;
      }
      
      // 아군 전멸 체크
      if (checkAllAlliesDead(room)) {
        clearInterval(speedBarIntervalsRef.current[characterId]);
        delete speedBarIntervalsRef.current[characterId];
        console.log(`[EXPEDITION-SPEED] ${characterId} 속도바 중단 (아군 전멸)`);
        return;
      }
      
      // 승리 체크 (모든 몬스터 사망)
      const allMonstersDead = room.monsters?.every(m => !m.isAlive);
      if (allMonstersDead) {
        clearInterval(speedBarIntervalsRef.current[characterId]);
        delete speedBarIntervalsRef.current[characterId];
        console.log(`[EXPEDITION-SPEED] ${characterId} 속도바 중단 (승리)`);
        return;
      }
      
      // 🔥 몬스터의 speedMultiplier 확인 (frozen 효과)
      let speedMultiplier = 1; // 기본값
      if (characterId.startsWith('monster_')) {
        const monsterId = characterId.replace('monster_', '');
        const monster = room.monsters?.find(m => m.id == monsterId);
        if (monster && monster.speedMultiplier !== undefined) {
          speedMultiplier = monster.speedMultiplier;
          if (speedMultiplier === 0) {
            // frozen 상태면 속도바가 증가하지 않음
            return;
          }
        }
      }
      
      // speedMultiplier 적용
      cooldown -= 25 * speedMultiplier;
      const newCooldown = Math.max(0, cooldown);
      setSpeedBars(prev => ({ ...prev, [characterId]: { current: newCooldown, max: maxCooldown } }));
      
      if (cooldown <= 0) {
        // 쿨다운이 0이 되면 공격 실행 (항해 전투와 동일)
        clearInterval(speedBarIntervalsRef.current[characterId]);
        delete speedBarIntervalsRef.current[characterId];
        setSpeedBars(prev => ({ ...prev, [characterId]: { current: 0, max: maxCooldown } }));
        
        console.log(`[EXPEDITION-SPEED] ${characterId} 쿨다운 완료 - 공격 실행`);
        
        // 100ms 후 공격 실행 및 리셋 (항해 전투와 동일한 타이밍)
        setTimeout(() => {
          console.log(`[EXPEDITION-SPEED] ${characterId} 공격 실행 시작`);
          
          // 🔥 항해 전투와 동일: 쿨다운을 maxCooldown으로 리셋 (속도바 0%로)
          setSpeedBars(prev => ({ ...prev, [characterId]: { current: maxCooldown, max: maxCooldown } }));
          
          // 🎯 서버에 공격 요청 보내기 (탐사전투와 동일하게 즉시 처리)
          if (characterId.startsWith('player_')) {
            const playerId = characterId.replace('player_', '');
            socket.emit('expeditionPlayerAttack', { playerId });
            // 탐사전투와 동일: 즉시 UI 반영
            setForceUpdateCounter(prev => prev + 1);
          } else if (characterId.startsWith('companion_')) {
            const companionKey = characterId.replace('companion_', '');
            // companionKey는 "playerId_companionName" 형식
            const firstUnderscoreIndex = companionKey.indexOf('_');
            const playerId = companionKey.substring(0, firstUnderscoreIndex);
            const companionName = companionKey.substring(firstUnderscoreIndex + 1);
            socket.emit('expeditionCompanionAttack', { playerId, companionName });
            // 탐사전투와 동일: 즉시 UI 반영
            setForceUpdateCounter(prev => prev + 1);
          } else if (characterId.startsWith('monster_')) {
            const monsterId = characterId.replace('monster_', '');
            
            // 🔥 서버에 요청 보내기
            socket.emit('expeditionMonsterAttack', { monsterId });
            
            // 🎯 탐사전투와 동일: 낙관적 업데이트 (즉시 UI 반영)
            // 서버 응답이 오면 최종 결과로 덮어씀
            setForceUpdateCounter(prev => prev + 1);
          }
          
          // 100ms 후 속도바 재시작 (탐사전투와 동일 - 최신 상태 확인)
          setTimeout(() => {
            // setCurrentRoom의 콜백으로 최신 상태 확인 (탐사전투의 setBattleState와 동일)
            setCurrentRoom(room => {
              if (!room) return room;
              
              // 🔥 전투 종료 상태면 재시작 안 함
              if (room.status !== 'in_progress') {
                console.log(`[EXPEDITION-SPEED] ${characterId} 속도바 재시작 취소 (전투 종료)`);
                return room;
              }
              
              let shouldRestart = true;
              
              if (characterId.startsWith('monster_')) {
                const monsterId = characterId.replace('monster_', '');
                const monster = room.monsters?.find(m => m.id == monsterId);
                if (!monster || !monster.isAlive) {
                  shouldRestart = false;
                }
                
                // 🔥 모든 아군이 죽었으면 몬스터 속도바 중단
                if (checkAllAlliesDead(room)) {
                  shouldRestart = false;
                  console.log(`[EXPEDITION-SPEED] ${characterId} 속도바 재시작 취소 (아군 전멸)`);
                }
              } else if (characterId.startsWith('player_')) {
                const playerId = characterId.replace('player_', '');
                const playerHp = room.battleState?.playerHp?.[playerId] || 0;
                if (playerHp <= 0) {
                  shouldRestart = false;
                }
              } else if (characterId.startsWith('companion_')) {
                const companionKey = characterId.replace('companion_', '');
                const companionHp = room.battleState?.companionHp?.[companionKey] || 0;
                if (companionHp <= 0) {
                  shouldRestart = false;
                }
              }
              
              if (shouldRestart) {
                // 🔥 항해 전투와 동일: 저장된 속도만 사용 (클로저 문제 방지)
                const savedSpeed = speedsRef.current[characterId];
                if (savedSpeed) {
                  console.log(`[EXPEDITION-SPEED] ${characterId} 쿨다운 재시작 (speed: ${savedSpeed})`);
                  startSpeedBar(characterId, savedSpeed);
                } else {
                  console.warn(`[EXPEDITION-SPEED] ${characterId} 저장된 속도 없음 - 재시작 취소`);
                }
              }
              
              return room; // 상태 변경 없이 반환
            });
          }, 100);
        }, 100);
        
        return;
      }
    }, interval);
  };

  // 모든 속도바 정리 함수
  const clearAllSpeedBars = () => {
    Object.values(speedBarIntervalsRef.current).forEach(interval => {
      clearInterval(interval);
    });
    speedBarIntervalsRef.current = {};
    speedsRef.current = {}; // 🔥 속도 ref도 초기화
    setSpeedBars({});
    console.log('[EXPEDITION] 모든 속도바 및 속도 ref 초기화');
  };

  // 아군 전멸 체크 함수
  const checkAllAlliesDead = (room) => {
    if (!room?.battleState) return false;
    
    // 모든 플레이어가 죽었는지 확인
    const allPlayersDead = room.players.every(player => {
      const playerHp = room.battleState.playerHp?.[player.id] || 0;
      return playerHp <= 0;
    });
    
    // 모든 동료가 죽었는지 확인
    let allCompanionsDead = true;
    Object.entries(room.playerData || {}).forEach(([playerId, playerData]) => {
      playerData.companions?.forEach(companion => {
        const companionKey = `${playerId}_${companion.companionName}`;
        const companionHp = room.battleState.companionHp?.[companionKey] || 0;
        if (companionHp > 0) {
          allCompanionsDead = false;
        }
      });
    });
    
    return allPlayersDead && allCompanionsDead;
  };

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      clearTurnProgress();
      clearAllSpeedBars();
    };
  }, []);

  // 방에 있을 때 주기적으로 방 정보 새로고침
  useEffect(() => {
    let intervalId;
    
    if (currentView === 'room' && currentRoom) {
      intervalId = setInterval(async () => {
        try {
          const token = localStorage.getItem('jwtToken');
          const response = await fetch('/api/expedition/rooms/current', {
            headers: { 
              'Authorization': `Bearer ${token}`
            }
          });
          
          const data = await response.json();
          if (data.success && data.room && data.room.id === currentRoom.id) {
            console.log('[EXPEDITION] Refreshing room data:', data.room);
            setCurrentRoom(data.room);
            setForceUpdateCounter(prev => prev + 1);
          }
        } catch (error) {
          console.error('방 정보 새로고침 실패:', error);
        }
      }, 2000); // 2초마다 새로고침
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [currentView, currentRoom?.id]);

  // 원정 지역 및 방 목록 로드
  useEffect(() => {
    loadExpeditionAreas();
    loadAvailableRooms();
    // 현재 참가 중인 방이 있는지 확인
    checkCurrentRoom();
  }, []);

  // 🎣 원정 초대 자동 입장 처리
  useEffect(() => {
    if (pendingExpeditionInvite && currentView === 'lobby') {
      const { roomId } = pendingExpeditionInvite;
      console.log('🎣 원정 초대로 자동 입장 시도:', roomId);
      
      // 자동으로 방 입장
      joinRoom(roomId);
      
      // 초대 정보 초기화
      setPendingExpeditionInvite(null);
    }
  }, [pendingExpeditionInvite, currentView]);

  // 현재 참가 중인 방 확인
  const checkCurrentRoom = async () => {
    if (!userData?.userUuid) return;
    
    try {
      const token = localStorage.getItem('jwtToken');
      const response = await fetch('/api/expedition/rooms/current', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      if (data.success && data.room) {
        // 보상을 이미 수령한 경우 로비로 이동
        const playerRewards = data.room.rewards?.filter(reward => reward.playerId === userData.userUuid) || [];
        if (data.room.status === 'completed' && playerRewards.length === 0) {
          // 보상이 없으면 이미 수령한 것으로 간주하고 로비로 이동
          setCurrentView('lobby');
          setCurrentRoom(null);
          return;
        }
        
        setCurrentRoom(data.room);
        if (data.room.status === 'waiting') {
          setCurrentView('room');
        } else if (data.room.status === 'in_progress') {
          setCurrentView('battle');
        } else if (data.room.status === 'completed' && playerRewards.length > 0) {
          setCurrentView('battle'); // 보상 수령 화면
        } else {
          // 기타 경우 로비로 이동
          setCurrentView('lobby');
          setCurrentRoom(null);
        }
      } else {
        // 방이 없으면 로비로 이동
        setCurrentView('lobby');
        setCurrentRoom(null);
      }
    } catch (error) {
      console.error('현재 방 확인 실패:', error);
      // 오류 발생 시 로비로 이동
      setCurrentView('lobby');
      setCurrentRoom(null);
    }
  };

  // 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showAreaDropdown && !event.target.closest('.dropdown-container')) {
        setShowAreaDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAreaDropdown]);

  // 소켓 이벤트 리스너
  useEffect(() => {
    if (!socket) return;

    socket.on('expeditionRoomCreated', handleRoomCreated);
    socket.on('expeditionRoomUpdated', handleRoomUpdated);
    socket.on('expeditionRoomDeleted', handleRoomDeleted);
    socket.on('expeditionStarted', handleExpeditionStarted);
    socket.on('expeditionBattleUpdate', handleBattleUpdate);
    socket.on('expeditionCompleted', handleExpeditionCompleted);
    socket.on('expeditionPlayerJoined', handlePlayerJoined);
    socket.on('expeditionPlayerReady', handlePlayerReady);
    socket.on('expeditionRoomsRefresh', handleRoomsRefresh);
    socket.on('expeditionHostLeft', handleHostLeft);
    socket.on('expeditionSpeedBarReset', handleSpeedBarReset);
    socket.on('expeditionPlayerKicked', handlePlayerKicked);

    return () => {
      socket.off('expeditionRoomCreated', handleRoomCreated);
      socket.off('expeditionRoomUpdated', handleRoomUpdated);
      socket.off('expeditionRoomDeleted', handleRoomDeleted);
      socket.off('expeditionStarted', handleExpeditionStarted);
      socket.off('expeditionBattleUpdate', handleBattleUpdate);
      socket.off('expeditionCompleted', handleExpeditionCompleted);
      socket.off('expeditionPlayerJoined', handlePlayerJoined);
      socket.off('expeditionPlayerReady', handlePlayerReady);
      socket.off('expeditionRoomsRefresh', handleRoomsRefresh);
      socket.off('expeditionHostLeft', handleHostLeft);
      socket.off('expeditionSpeedBarReset', handleSpeedBarReset);
      socket.off('expeditionPlayerKicked', handlePlayerKicked);
    };
  }, [socket]);

  // 몬스터 상태 변경 감지 및 속도바 정리
  useEffect(() => {
    if (!currentRoom?.monsters || currentView !== 'battle') return;

    const monsterStates = currentRoom.monsters.map(m => ({ id: m.id, isAlive: m.isAlive, name: m.name }));
    
    monsterStates.forEach(monster => {
      const monsterId = `monster_${monster.id}`;
      
      // 몬스터가 죽었는데 속도바가 아직 활성화되어 있으면 정리
      if (!monster.isAlive && speedBarIntervalsRef.current[monsterId]) {
        clearInterval(speedBarIntervalsRef.current[monsterId]);
        delete speedBarIntervalsRef.current[monsterId];
        setSpeedBars(prev => ({ ...prev, [monsterId]: 0 }));
      }
    });
  }, [currentRoom?.monsters?.map(m => `${m.id}-${m.isAlive}`).join(','), currentView]);

  // 전투로그 자동 스크롤
  useEffect(() => {
    if (battleLogRef.current && currentRoom?.battleState?.battleLog) {
      battleLogRef.current.scrollTop = battleLogRef.current.scrollHeight;
    }
  }, [currentRoom?.battleState?.battleLog]);

  // API 호출 함수들
  const loadExpeditionAreas = async () => {
    try {
      const response = await fetch('/api/expedition/areas');
      const data = await response.json();
      if (data.success) {
        setExpeditionAreas(data.areas);
      }
    } catch (error) {
      console.error('원정 지역 로드 실패:', error);
    }
  };

  const loadAvailableRooms = async () => {
    try {
      const response = await fetch('/api/expedition/rooms');
      const data = await response.json();
      if (data.success) {
        setAvailableRooms(data.rooms);
      }
    } catch (error) {
      console.error('방 목록 로드 실패:', error);
    }
  };

  const createRoom = async (areaId) => {
    if (!userData?.userUuid || !userData?.username) return;
    
    setLoading(true);
    try {
      // 🔥 이전 방 상태 완전히 정리 (항해 전투와 동일)
      console.log('[EXPEDITION] 이전 방 상태 정리 중...');
      clearAllSpeedBars(); // speedsRef도 여기서 초기화됨
      clearTurnProgress();
      
      // 🔥 이전 소켓 룸에서 나가기
      if (currentRoom?.id && socket) {
        socket.emit('expedition-leave-room', currentRoom.id);
        console.log('[EXPEDITION] 이전 소켓 룸에서 나가기:', currentRoom.id);
      }
      
      setCurrentRoom(null);
      setCurrentView('lobby');
      
      // 🔧 원정 방 생성 전에 동료 전투 상태를 서버와 동기화
      console.log('[EXPEDITION] Syncing companion battle status before creating room...');
      if (syncBattleCompanionsToServer) {
        await syncBattleCompanionsToServer();
      }
      
      const token = localStorage.getItem('jwtToken');
      const response = await fetch('/api/expedition/rooms/create', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          areaId: areaId
        })
      });
      
      const data = await response.json();
      if (data.success) {
        console.log('[EXPEDITION] 새 방 생성 완료:', data.room.id);
        
        // 🔥 새 방 소켓 룸 조인
        if (socket) {
          socket.emit('expedition-join-room', data.room.id);
          console.log('[EXPEDITION] 새 소켓 룸 조인:', data.room.id);
        }
        
        setCurrentRoom(data.room);
        setCurrentView('room');
        
        // 🔧 방 생성 후 동료 정보 즉시 새로고침 (동기화 확인)
        setTimeout(async () => {
          console.log('[EXPEDITION] Reloading companions after creating room...');
          await loadAllPlayersCompanions();
        }, 1000);
      } else {
        alert(data.error || '방 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('방 생성 실패:', error);
      alert('방 생성 중 오류가 발생했습니다.');
    }
    setLoading(false);
  };

  const joinRoom = async (roomId) => {
    if (!userData?.userUuid || !userData?.username) return;
    
    setLoading(true);
    try {
      // 🔧 원정 방 참여 전에 동료 전투 상태를 서버와 동기화
      console.log('[EXPEDITION] Syncing companion battle status before joining room...');
      if (syncBattleCompanionsToServer) {
        await syncBattleCompanionsToServer();
      }
      
      const token = localStorage.getItem('jwtToken');
      const response = await fetch(`/api/expedition/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({})
      });
      
      const data = await response.json();
      if (data.success) {
        console.log('[EXPEDITION] Successfully joined room:', data.room);
        setCurrentRoom(data.room);
        setCurrentView('room');
        
        // 소켓 룸에 참가
        if (socket) {
          socket.emit('expedition-join-room', data.room.id);
        }
        
        // 강제 리렌더링
        setForceUpdateCounter(prev => prev + 1);
        
        // 🔧 방 참여 후 동료 정보 즉시 새로고침 (동기화 확인)
        setTimeout(async () => {
          console.log('[EXPEDITION] Reloading companions after joining room...');
          await loadAllPlayersCompanions();
        }, 1000);
        
        // 즉시 최신 방 정보 가져오기
        setTimeout(async () => {
          try {
            const token = localStorage.getItem('jwtToken');
            const response = await fetch('/api/expedition/rooms/current', {
              headers: { 
                'Authorization': `Bearer ${token}`
              }
            });
            
            const roomData = await response.json();
            if (roomData.success && roomData.room) {
              console.log('[EXPEDITION] Updated room after join:', roomData.room);
              setCurrentRoom(roomData.room);
              setForceUpdateCounter(prev => prev + 1);
            }
          } catch (error) {
            console.error('방 정보 업데이트 실패:', error);
          }
        }, 500);
        
        loadAvailableRooms();
      } else {
        alert(data.error || '방 참가에 실패했습니다.');
      }
    } catch (error) {
      console.error('방 참가 실패:', error);
      alert('방 참가 중 오류가 발생했습니다.');
    }
    setLoading(false);
  };

  const leaveRoom = async () => {
    if (!userData?.userUuid) return;
    
    try {
      const token = localStorage.getItem('jwtToken');
      const response = await fetch('/api/expedition/rooms/leave', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({})
      });
      
      const data = await response.json();
      if (data.success) {
        // 소켓 룸에서 나가기
        if (socket && currentRoom) {
          socket.emit('expedition-leave-room', currentRoom.id);
        }
        
        setCurrentRoom(null);
        setCurrentView('lobby');
        setPlayersCompanions({}); // 동료 정보 초기화
        loadAvailableRooms();
      }
    } catch (error) {
      console.error('방 나가기 실패:', error);
    }
  };

  const toggleReady = async () => {
    if (!userData?.userUuid) return;
    
    try {
      const token = localStorage.getItem('jwtToken');
      const response = await fetch('/api/expedition/rooms/ready', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({})
      });
      
      const data = await response.json();
      if (data.success) {
        setCurrentRoom(data.room);
      }
    } catch (error) {
      console.error('준비 상태 변경 실패:', error);
    }
  };

  const startExpedition = async () => {
    if (!userData?.userUuid) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('jwtToken');
      const response = await fetch('/api/expedition/rooms/start', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({})
      });
      
      const data = await response.json();
      if (data.success) {
        console.log('[EXPEDITION] Start request successful, waiting for socket event');
        // 소켓 이벤트(expeditionStarted)가 상태를 업데이트하도록 대기
        // 중복 업데이트 방지: 소켓 이벤트에서만 setCurrentRoom, setCurrentView 호출
      } else {
        alert(data.error || '원정 시작에 실패했습니다.');
      }
    } catch (error) {
      console.error('원정 시작 실패:', error);
      alert('원정 시작에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 플레이어의 전투 참전 동료 정보 가져오기 (전투 참여 중인 동료만)
  const fetchPlayerCompanions = async (playerUuid, playerName) => {
    try {
      console.log(`[EXPEDITION] Fetching companions for ${playerName} (${playerUuid})`);
      
      // 올바른 API 엔드포인트 사용 - 서버의 실제 API 구조에 맞춤
      const response = await fetch(`/api/companion-stats/user?userUuid=${playerUuid}&username=${playerName}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`[EXPEDITION] Companion data for ${playerName}:`, data);
        
        // 🔧 서버 응답에서 isInBattle: true인 동료들만 엄격하게 필터링 (최대 3명)
        const battleCompanions = [];
        if (data.companionStats) {
          Object.entries(data.companionStats).forEach(([companionName, stats]) => {
            // isInBattle이 명시적으로 true인 경우만 포함
            if (stats.isInBattle === true) {
              battleCompanions.push({
                companionName: companionName,
                level: stats.level,
                experience: stats.experience,
                isInBattle: stats.isInBattle
              });
            }
          });
        }
        
        // ⚠️ 전투 참여 동료는 최대 3명까지만 허용
        const limitedBattleCompanions = battleCompanions.slice(0, 3);
        
        if (battleCompanions.length > 3) {
          console.warn(`[EXPEDITION] ${playerName}의 전투 참여 동료가 ${battleCompanions.length}명입니다. 최대 3명으로 제한합니다.`);
        }
        
        console.log(`[EXPEDITION] Filtered battle companions for ${playerName}:`, limitedBattleCompanions);
        return limitedBattleCompanions;
      } else {
        console.error(`[EXPEDITION] Failed to fetch companions for ${playerName}:`, response.status);
      }
    } catch (error) {
      console.error(`Failed to fetch companions for ${playerName}:`, error);
    }
    return [];
  };

  // 모든 파티 멤버의 동료 정보 로드
  const loadAllPlayersCompanions = async (players = null) => {
    const playersToLoad = players || currentRoom?.players;
    if (!playersToLoad) return;
    
    console.log(`[EXPEDITION] Loading companions for ${playersToLoad.length} players`);
    const companionsData = {};
    
    for (const player of playersToLoad) {
      const companions = await fetchPlayerCompanions(player.id, player.name);
      companionsData[player.id] = companions;
    }
    
    console.log(`[EXPEDITION] All players companions loaded:`, companionsData);
    setPlayersCompanions(companionsData);
  };

  // 방 정보가 변경될 때마다 동료 정보 로드
  useEffect(() => {
    if (currentRoom && currentView === 'room') {
      loadAllPlayersCompanions();
    }
  }, [currentRoom?.players?.length, currentView]);

  // 자동 전투이므로 공격 함수 제거됨

  const claimRewards = async () => {
    if (!userData?.userUuid) return;
    
    // 🔒 이중 중복 클릭 방지 (Ref는 즉시 업데이트되어 더 강력함)
    if (isClaimingRewards || isClaimingRewardsRef.current) {
      console.log('[EXPEDITION] 이미 보상 수령 중입니다. 중복 요청 차단.');
      return;
    }
    
    try {
      // 🔒 두 가지 모두 업데이트 (Ref는 즉시, State는 렌더링용)
      isClaimingRewardsRef.current = true;
      setIsClaimingRewards(true); // 보상 수령 시작
      
      const token = localStorage.getItem('jwtToken');
      const response = await fetch('/api/expedition/claim-rewards', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({})
      });
      
      const data = await response.json();
      
      console.log('[EXPEDITION DEBUG] Response status:', response.status);
      console.log('[EXPEDITION DEBUG] Response data:', data);
      console.log('[EXPEDITION DEBUG] Current room state:', {
        status: currentRoom?.status,
        hasRewards: !!currentRoom?.rewards,
        rewardsCount: currentRoom?.rewards?.length,
        myRewards: currentRoom?.rewards?.filter(r => r.playerId === userData.userUuid)
      });
      
      if (data.success) {
        alert(`${data.message}\n보상: ${data.rewards.map(r => `${r.fishName} x${r.quantity}`).join(', ')}`);
        
        // 인벤토리 즉시 새로고침 (보상 물고기 반영)
        if (refreshInventory) {
          await refreshInventory();
        }
        
        // 동료 데이터 새로고침 (탐사 전투에서 획득한 경험치 반영)
        if (refreshCompanions) {
          await refreshCompanions();
        }
        
        // 🎉 보상 수령 완료 후 자동으로 로비로 이동
        console.log('[EXPEDITION] 보상 수령 완료! 로비로 이동합니다.');
        
        // 소켓 방 나가기 이벤트 전송
        if (socket && currentRoom) {
          socket.emit('expedition-leave-room', currentRoom.id);
        }
        
        // UI 업데이트
        setCurrentView('lobby');
        setCurrentRoom(null);
        loadAvailableRooms();
      } else {
        alert(`보상 수령 실패: ${data.error || '알 수 없는 오류'}`);
        
        // 보상이 없다는 오류인 경우 로비로 이동
        if (data.error && data.error.includes('수령할 보상이 없습니다') || data.error && data.error.includes('이미 보상을 수령하였습니다')) {
          setCurrentView('lobby');
          setCurrentRoom(null);
          loadAvailableRooms();
        }
      }
    } catch (error) {
      console.error('보상 수령 실패:', error);
      alert('보상 수령 중 오류가 발생했습니다.');
      
      // 오류 발생 시도 로비로 이동
      setCurrentView('lobby');
      setCurrentRoom(null);
      loadAvailableRooms();
    } finally {
      // 🔒 두 가지 모두 초기화
      isClaimingRewardsRef.current = false;
      setIsClaimingRewards(false); // 보상 수령 완료
    }
  };

  // 소켓 이벤트 핸들러들
  const handleRoomCreated = (room) => {
    loadAvailableRooms();
  };

  const handleRoomUpdated = async (room) => {
    console.log('[EXPEDITION] Room updated event received:', room);
    if (currentRoom && currentRoom.id === room.id) {
      console.log('[EXPEDITION] Updating current room state');
      setCurrentRoom(room);
      setForceUpdateCounter(prev => prev + 1); // 강제 리렌더링
      
      // 🔄 동료 정보 다시 로드 (대기실에서만)
      if (currentView === 'room') {
        await loadAllPlayersCompanions(room.players);
      }
    }
    loadAvailableRooms();
    setForceUpdateCounter(prev => prev + 1); // 전체 강제 리렌더링
  };

  const handleRoomDeleted = () => {
    loadAvailableRooms();
  };

  const handleExpeditionStarted = (room) => {
    // 현재 사용자가 해당 방에 속해있는지 확인
    const isUserInRoom = room?.players?.some(p => p.id === userData?.userUuid);
    
    if (isUserInRoom) {
      console.log('[EXPEDITION] User is in the started room, updating state');
      setCurrentRoom(room);
      setCurrentView('battle');
      
      // 소켓 룸 참가 확실히 하기
      if (socket) {
        socket.emit('expedition-join-room', room.id);
      }
    }
  };

  const handleBattleUpdate = (updateData) => {
    const shouldUpdate = !currentRoom || 
                        (currentRoom && currentRoom.id === updateData.room?.id) ||
                        (updateData.type === 'battleStarted');
    
    if (shouldUpdate && updateData.room) {
      // 🔥 탐사전투와 동일: 즉시 상태 업데이트 (강제 리렌더링)
      setCurrentRoom(updateData.room);
      
      // 공격 타입일 때도 강제 업데이트 (탐사전투처럼 즉시 반영)
      if (updateData.type === 'playerAttack' || updateData.type === 'monsterAttack' || updateData.type === 'companionAttack') {
        setForceUpdateCounter(prev => prev + 1);
      }
      
      // 죽은 몬스터의 속도바 정리
      updateData.room.monsters?.forEach(monster => {
        const monsterId = `monster_${monster.id}`;
        if (!monster.isAlive && speedBarIntervalsRef.current[monsterId]) {
          clearInterval(speedBarIntervalsRef.current[monsterId]);
          delete speedBarIntervalsRef.current[monsterId];
          setSpeedBars(prev => ({ ...prev, [monsterId]: { current: 0, max: 250 } }));
        }
      });
      
      // 아군 전멸 체크
      if (checkAllAlliesDead(updateData.room)) {
        clearAllSpeedBars();
      }
      
      if (updateData.type === 'battleStarted') {
        setForceUpdateCounter(prev => prev + 1);
        setCurrentView('battle');
        
        // 🔥 전투 시작 시 속도 ref 초기화 (항해 전투와 동일)
        speedsRef.current = {};
        console.log('[EXPEDITION] battleStarted - 속도 ref 초기화 및 속도바 시작 준비');
        
        // 100ms 후 속도바 시작 (UI 렌더링 완료 대기)
        setTimeout(() => {
          // 플레이어 속도바 시작 (🌟 항해 전투와 동일한 공식)
          updateData.room?.players?.forEach(player => {
            if (updateData.room.battleState?.playerHp?.[player.id] > 0) {
              const playerData = updateData.room?.playerData?.[player.id];
              const fishingSkill = playerData?.fishingSkill || 1;
              const speedStatBonus = (playerData?.speedStat || 0) * 2;
              // 항해 전투와 동일: 100 + 낚시실력 * 10 + 속도스탯 * 2
              const playerSpeed = 100 + fishingSkill * 10 + speedStatBonus;
              console.log(`[EXPEDITION] Player ${player.name} speed: ${playerSpeed} (100 + fishingSkill ${fishingSkill} * 10 + speedStat ${playerData?.speedStat || 0} * 2)`);
              startSpeedBar(`player_${player.id}`, playerSpeed);
            }
          });
          
          // 동료 속도바 시작 (항해 전투와 동일)
          Object.entries(updateData.room?.playerData || {}).forEach(([playerId, playerData]) => {
            playerData.companions?.forEach(companion => {
              const companionKey = `${playerId}_${companion.companionName}`;
              if (updateData.room.battleState?.companionHp?.[companionKey] > 0) {
                // 동료 속도 계산 (tier, breakthrough 반영)
                const level = companion.level || 1;
                const tier = companion.tier || 0;
                const breakthrough = companion.breakthrough || 0;
                const breakthroughStats = companion.breakthroughStats || { bonusGrowthHp: 0, bonusGrowthAttack: 0, bonusGrowthSpeed: 0 };
                const companionData = calculateCompanionStats(companion.companionName, level, tier, breakthrough, breakthroughStats);
                const speed = companionData?.speed || 50;
                
                console.log(`[EXPEDITION] Companion ${companion.companionName} speed: ${speed} (Lv.${level}, tier ${tier}, breakthrough ${breakthrough})`);
                startSpeedBar(`companion_${companionKey}`, speed);
              }
            });
          });
          
          // 몬스터 속도바 시작
          updateData.room?.monsters?.forEach(monster => {
            if (monster.isAlive) {
              console.log(`[EXPEDITION] Monster ${monster.id} speed: ${monster.speed || 30}`);
              startSpeedBar(`monster_${monster.id}`, monster.speed || 30);
            }
          });
          
          startTurnProgress();
        }, 100); // 탐사전투와 동일한 100ms 지연
      }
      
      // 탐사전투와 동일: 공격 타입은 속도바가 자동으로 재시작되므로 별도 처리 불필요
      
      // 전투 종료 처리 (탐사전투와 동일)
      if (updateData.type === 'victory' || updateData.type === 'defeat' || updateData.type === 'battleEnd') {
        console.log('[EXPEDITION] Battle ended:', updateData.type);
        
        // 🔥 탐사전투와 동일: 즉시 모든 속도바 정리
        clearTurnProgress();
        clearAllSpeedBars();
        
        // 강제 리렌더링
        setForceUpdateCounter(prev => prev + 1);
        
        // 승리 시 즉시 방 상태 업데이트
        if (updateData.type === 'victory') {
          setCurrentRoom(updateData.room);
          console.log('[EXPEDITION] 승리! 모든 속도바 중단');
          
          // 🔥 탐사전투와 동일: 즉시 속도바 완전 정리
          setTimeout(() => {
            clearAllSpeedBars();
            console.log('[EXPEDITION] 승리 후 속도바 재정리');
          }, 100);
          
          // 승리 시 보상 화면을 보여주지만 자동 수령은 제거
          // 사용자가 수동으로 보상 수령 버튼을 눌러야 함
        }
        
        // 패배 시 패배 모달 표시
        if (updateData.type === 'defeat') {
          setCurrentRoom(updateData.room);
          console.log('[EXPEDITION] 패배! 모든 속도바 중단');
          
          // 🔥 탐사전투와 동일: 즉시 속도바 완전 정리
          setTimeout(() => {
            clearAllSpeedBars();
            console.log('[EXPEDITION] 패배 후 속도바 재정리');
          }, 100);
          
          setTimeout(() => {
            setShowDefeatModal(true);
          }, 1000);
        }
      }
    }
  };

  const handleExpeditionCompleted = async (room) => {
    console.log('[EXPEDITION] Expedition completed event received:', room);
    if (currentRoom && currentRoom.id === room.id) {
      console.log('[EXPEDITION] Updating room to completed state');
      setCurrentRoom(room);
      setForceUpdateCounter(prev => prev + 1);
      clearAllSpeedBars(); // 속도바 중단
      
      // 🔧 동료 데이터 새로고침 (서버에서 업데이트된 레벨 가져오기)
      if (refreshCompanions) {
        console.log('[EXPEDITION] Refreshing companion data...');
        await refreshCompanions();
      }
      
      setTimeout(() => {
        alert('원정이 완료되었습니다!');
        setCurrentView('lobby');
        setCurrentRoom(null);
        loadAvailableRooms();
      }, 2000);
    }
  };

  const handlePlayerJoined = async (data) => {
    console.log('[EXPEDITION] Player joined event received:', data);
    // 현재 방에 있는 경우 실시간으로 업데이트
    if (currentRoom && currentRoom.id === data.roomId) {
      console.log('[EXPEDITION] Updating current room with new player data');
      console.log('[EXPEDITION] Old players:', currentRoom.players);
      console.log('[EXPEDITION] New players:', data.room.players);
      setCurrentRoom(data.room);
      setForceUpdateCounter(prev => prev + 1);
      
      // 🔄 동료 정보 다시 로드 (새 플레이어 포함)
      if (currentView === 'room') {
        await loadAllPlayersCompanions(data.room.players);
      }
    }
    // 방 목록도 업데이트
    loadAvailableRooms();
  };

  const handlePlayerReady = async (data) => {
    // 현재 방에 있는 경우 실시간으로 업데이트
    if (currentRoom && currentRoom.id === data.roomId) {
      setCurrentRoom(data.room);
      setForceUpdateCounter(prev => prev + 1);
      
      // 🔄 동료 정보 다시 로드 (대기실에서만)
      if (currentView === 'room') {
        await loadAllPlayersCompanions(data.room.players);
      }
    }
    // 방 목록도 업데이트
    loadAvailableRooms();
  };

  const handleRoomsRefresh = () => {
    // 강제로 방 목록 새로고침
    loadAvailableRooms();
    setForceUpdateCounter(prev => prev + 1);
  };

  const handleHostLeft = () => {
    // 방장이 나가서 방이 삭제됨 - 원정대기실로 이동
    setCurrentRoom(null);
    setCurrentView('lobby');
    loadAvailableRooms();
    alert('방장이 방을 나가서 원정이 종료되었습니다.');
  };

  // 플레이어 강퇴 처리
  const handlePlayerKicked = (data) => {
    const { kickedPlayerId, roomId } = data;
    
    // 강퇴당한 플레이어가 본인인지 확인
    if (kickedPlayerId === userData?.userUuid) {
      alert('방장에 의해 강퇴되었습니다.');
      setCurrentView('lobby');
      setCurrentRoom(null);
      loadAvailableRooms();
    }
  };

  const handleSpeedBarReset = (data) => {
    // 🔇 서버 신호 무시 - 클라이언트가 자체적으로 속도바 관리
    // 탐사전투와 동일하게 클라이언트 독립 실행 방식 사용
  };

  // 현재 플레이어 정보 가져오기
  const getCurrentPlayer = () => {
    if (!currentRoom || !userData?.userUuid) return null;
    return currentRoom.players.find(p => p.id === userData.userUuid);
  };

  const isHost = () => {
    const player = getCurrentPlayer();
    return player?.isHost || false;
  };

  // 현재 턴 표시 함수
  const getCurrentTurnDisplay = () => {
    if (!currentRoom?.battleState?.currentTurn) return '';
    
    const turn = currentRoom.battleState.currentTurn;
    if (turn === 'player') return '플레이어';
    if (turn.startsWith('monster_')) return '몬스터';
    if (turn.startsWith('companion_')) {
      const companionName = turn.split('_')[2];
      return `동료 ${companionName}`;
    }
    return turn;
  };

  // 몬스터 공격 함수
  const attackMonster = async (monsterId) => {
    if (!userData?.userUuid || !currentRoom) return;
    
    try {
      const token = localStorage.getItem('jwtToken');
      const response = await fetch('/api/expedition/attack', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ targetMonsterId: monsterId })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // 공격 성공 후 1.5초 뒤에 다음 턴 진행
        setTimeout(() => {
          nextTurn();
        }, 1500);
      } else {
        alert(data.error || '공격에 실패했습니다.');
      }
    } catch (error) {
      console.error('공격 실패:', error);
      alert('공격 중 오류가 발생했습니다.');
    }
  };

  // 다음 턴 진행 함수
  const nextTurn = async () => {
    if (!userData?.userUuid) return;
    
    try {
      const token = localStorage.getItem('jwtToken');
      const response = await fetch('/api/expedition/next-turn', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      if (!data.success) {
        console.error('다음 턴 진행 실패:', data.error);
      }
    } catch (error) {
      console.error('다음 턴 진행 중 오류:', error);
    }
  };

  // 로비 화면 렌더링
  const renderLobby = () => (
    <div className="h-full flex flex-col">
      {/* 헤더 */}
      <div className={`border-b p-6 ${
        isDarkMode ? "border-white/10" : "border-gray-300/20"
      }`}>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20 border border-teal-500/30">
            <MapPin className="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <h2 className={`text-2xl font-bold ${
              isDarkMode ? "text-white" : "text-gray-800"
            }`}>원정 대기실</h2>
            <p className={`text-sm ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}>파티를 구성하여 위험한 원정지를 탐험하세요</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        {/* 방 생성 드롭다운 */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Plus className={`w-5 h-5 ${
              isDarkMode ? "text-green-400" : "text-green-500"
            }`} />
            <h3 className={`text-lg font-bold ${
              isDarkMode ? "text-white" : "text-gray-800"
            }`}>새 원정 방 만들기</h3>
          </div>
          
          <div className="relative dropdown-container">
            <button
              onClick={() => setShowAreaDropdown(!showAreaDropdown)}
              disabled={loading}
              className={`w-full p-4 rounded-2xl border transition-all duration-200 flex items-center justify-between ${
                isDarkMode
                  ? "bg-white/5 border-white/10 hover:bg-white/10 text-white"
                  : "bg-white/80 border-gray-300/30 hover:bg-white text-gray-800"
              } ${loading ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02]"}`}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30">
                  <MapPin className="w-5 h-5 text-green-400" />
                </div>
                <div className="text-left">
                  <div className="font-medium">
                    {selectedArea ? selectedArea.name : "원정 지역을 선택하세요"}
                  </div>
                   {selectedArea && (
                     <div className={`text-sm ${
                       isDarkMode ? "text-gray-400" : "text-gray-600"
                     }`}>
                       레벨 {selectedArea.fishRankRange[0]}-{selectedArea.fishRankRange[1]} • {selectedArea.minMonsters}-{selectedArea.maxMonsters}마리 • 🗝️ {selectedArea.id}개 필요
                     </div>
                   )}
                </div>
              </div>
              <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${
                showAreaDropdown ? "rotate-180" : ""
              } ${isDarkMode ? "text-gray-400" : "text-gray-500"}`} />
            </button>

            {/* 드롭다운 메뉴 */}
            {showAreaDropdown && (
              <div className={`absolute top-full left-0 right-0 mt-2 rounded-2xl border shadow-xl z-50 overflow-hidden ${
                isDarkMode 
                  ? "bg-gray-800/95 backdrop-blur-md border-white/10" 
                  : "bg-white/95 backdrop-blur-md border-gray-300/30"
              }`}>
                {expeditionAreas.map(area => {
                  const difficultyColors = {
                    1: "from-green-500/10 to-emerald-500/10 border-l-green-500",
                    2: "from-yellow-500/10 to-orange-500/10 border-l-yellow-500", 
                    3: "from-red-500/10 to-pink-500/10 border-l-red-500",
                    4: "from-purple-500/10 to-violet-500/10 border-l-purple-500"
                  };
                  
                  const difficultyText = {
                    1: "초급", 2: "중급", 3: "고급", 4: "전설"
                  };

                  const difficultyTextColors = {
                    1: "text-green-400", 
                    2: "text-yellow-400", 
                    3: "text-red-400", 
                    4: "text-purple-400"
                  };
                  
                  // 지역별 필요 낚시 실력
                  const requiredSkills = {
                    1: 1,   // 쓸쓸한 부두
                    2: 6,   // 노스트라
                    3: 11,  // 가을초입길
                    4: 16,  // 폭풍이 치는 곳
                    5: 21,  // 비문의잔해
                    6: 26   // 트루키다토르
                  };
                  const requiredSkill = requiredSkills[area.id] || 1;
                  const meetsRequirement = fishingSkill >= requiredSkill;

                   return (
                     <button
                       key={area.id}
                       onClick={() => {
                         setSelectedArea(area);
                         setShowAreaDropdown(false);
                       }}
                       disabled={!meetsRequirement}
                       className={`w-full p-4 text-left border-l-4 transition-all duration-200 ${
                         meetsRequirement
                           ? isDarkMode
                             ? `hover:bg-white/10 ${difficultyColors[area.id]}`
                             : `hover:bg-gray-50 ${difficultyColors[area.id]}`
                           : `opacity-50 cursor-not-allowed ${difficultyColors[area.id]}`
                       }`}
                     >
                       <div className="flex items-center justify-between">
                         <div>
                           <div className="flex items-center gap-2 mb-1">
                             <h4 className={`font-bold ${
                               isDarkMode ? "text-white" : "text-gray-800"
                             }`}>{area.name}</h4>
                             <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                               isDarkMode 
                                 ? `bg-white/10 ${difficultyTextColors[area.id]}` 
                                 : `bg-gray-100 ${difficultyTextColors[area.id]}`
                             }`}>
                               {difficultyText[area.id]}
                             </span>
                             <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                               isDarkMode 
                                 ? "bg-blue-500/20 text-blue-400" 
                                 : "bg-blue-500/10 text-blue-600"
                             }`}>
                               🗝️ {area.id}개
                             </span>
                             {/* 필요 낚시 실력 표시 */}
                             <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                               meetsRequirement
                                 ? (isDarkMode ? "bg-green-500/20 text-green-400" : "bg-green-500/10 text-green-600")
                                 : (isDarkMode ? "bg-red-500/20 text-red-400" : "bg-red-500/10 text-red-600")
                             }`}>
                               🎣 {requiredSkill} 이상
                             </span>
                           </div>
                           <p className={`text-sm ${
                             isDarkMode ? "text-gray-300" : "text-gray-600"
                           }`}>{area.description}</p>
                         </div>
                         <div className="text-right">
                           <div className={`text-xs ${
                             isDarkMode ? "text-gray-400" : "text-gray-500"
                           }`}>레벨 {area.fishRankRange[0]}-{area.fishRankRange[1]}</div>
                           <div className={`text-sm font-medium ${
                             isDarkMode ? "text-gray-300" : "text-gray-700"
                           }`}>{area.minMonsters}-{area.maxMonsters}마리</div>
                         </div>
                       </div>
                     </button>
                   );
                })}
              </div>
            )}
          </div>

          {/* 방 생성 버튼 */}
          {selectedArea && (
            <div className="mt-4">
              <button
                onClick={() => createRoom(selectedArea.id)}
                disabled={loading}
                className={`w-full py-4 px-6 rounded-2xl font-medium transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 ${
                  isDarkMode
                    ? "bg-gradient-to-r from-green-500/80 to-emerald-500/80 hover:from-green-500 hover:to-emerald-500 text-white"
                    : "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                }`}
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    방 생성 중...
                  </div>
                 ) : (
                   <div className="flex items-center justify-center gap-2">
                     <Plus className="w-5 h-5" />
                     {selectedArea.name} 원정 방 생성하기 (🗝️ {selectedArea.id}개 소모)
                   </div>
                 )}
              </button>
            </div>
          )}
        </div>

        {/* 참가 가능한 방 목록 */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Users className={`w-5 h-5 ${
              isDarkMode ? "text-blue-400" : "text-blue-500"
            }`} />
            <h3 className={`text-lg font-bold ${
              isDarkMode ? "text-white" : "text-gray-800"
            }`}>참가 가능한 방</h3>
            <span className={`ml-auto text-sm ${
              isDarkMode ? "text-gray-400" : "text-gray-500"
            }`}>
              {availableRooms.length}개의 방
            </span>
          </div>
          
          {availableRooms.length === 0 ? (
            <div className={`text-center py-12 rounded-2xl border-2 border-dashed ${
              isDarkMode 
                ? "border-gray-600 text-gray-400" 
                : "border-gray-300 text-gray-500"
            }`}>
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium mb-1">참가 가능한 방이 없습니다</p>
              <p className="text-sm">새로운 방을 만들어 모험을 시작해보세요!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {availableRooms.map(room => {
                // 지역별 필요 낚시 실력 매핑
                const areaRequirements = {
                  '쓸쓸한 부두': 1,
                  '노스트라': 6,
                  '가을초입길': 11,
                  '폭풍이 치는 곳': 16
                };
                const requiredSkill = areaRequirements[room.areaName] || 1;
                const canJoin = fishingSkill >= requiredSkill;
                
                return (
                <div key={room.id} className={`rounded-2xl border p-4 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg ${
                  isDarkMode 
                    ? "bg-white/5 border-white/10 hover:bg-white/10" 
                    : "bg-white/80 border-gray-300/30 hover:bg-white"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30">
                        <Crown className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <h4 className={`font-bold ${
                          isDarkMode ? "text-white" : "text-gray-800"
                        }`}>{room.hostName}님의 방</h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`text-sm ${
                            isDarkMode ? "text-gray-300" : "text-gray-600"
                          }`}>{room.areaName}</span>
                          {/* 필요 낚시 실력 표시 */}
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            canJoin 
                              ? (isDarkMode ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-green-500/10 text-green-600 border border-green-500/30")
                              : (isDarkMode ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-red-500/10 text-red-600 border border-red-500/30")
                          }`}>
                            필요 실력: {requiredSkill}
                          </span>
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4 text-blue-400" />
                            <span className={`text-sm font-medium ${
                              isDarkMode ? "text-blue-400" : "text-blue-600"
                            }`}>
                              {room.currentPlayers}/{room.maxPlayers}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => joinRoom(room.id)}
                      disabled={loading || !canJoin}
                      className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                        canJoin
                          ? isDarkMode
                            ? "bg-gradient-to-r from-green-500/80 to-emerald-500/80 hover:from-green-500 hover:to-emerald-500 text-white"
                            : "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                          : isDarkMode
                            ? "bg-gray-500/30 text-gray-500"
                            : "bg-gray-400/30 text-gray-600"
                      }`}
                      title={!canJoin ? `낚시 실력 ${requiredSkill} 이상 필요 (현재: ${fishingSkill})` : ''}
                    >
                      {canJoin ? '참가하기' : '조건 미달'}
                    </button>
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // 방 화면 렌더링
  const renderRoom = () => (
    <div className="h-full flex flex-col">
      {/* 헤더 */}
      <div className={`border-b p-6 ${
        isDarkMode ? "border-white/10" : "border-gray-300/20"
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={leaveRoom}
              className={`p-2 rounded-xl transition-all duration-200 hover:scale-105 ${
                isDarkMode 
                  ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
                  : "bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/30"
              }`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="p-2 rounded-xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20 border border-teal-500/30">
              <Shield className="w-6 h-6 text-teal-400" />
            </div>
            <div>
              <h2 className={`text-2xl font-bold ${
                isDarkMode ? "text-white" : "text-gray-800"
              }`}>{currentRoom?.area?.name}</h2>
              <p className={`text-sm ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}>{currentRoom?.area?.description}</p>
            </div>
          </div>
          
          <div className="text-right">
            <div className={`text-xs ${
              isDarkMode ? "text-gray-400" : "text-gray-500"
            }`}>난이도</div>
            <div className={`text-lg font-bold ${
              isDarkMode ? "text-teal-400" : "text-teal-600"
            }`}>
              Lv.{currentRoom?.area?.fishRankRange[0]}-{currentRoom?.area?.fishRankRange[1]}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        {/* 플레이어 목록 */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Users className={`w-5 h-5 ${
              isDarkMode ? "text-blue-400" : "text-blue-500"
            }`} />
            <h3 className={`text-lg font-bold ${
              isDarkMode ? "text-white" : "text-gray-800"
            }`}>파티 멤버</h3>
            <span className={`ml-auto px-3 py-1 rounded-full text-sm font-medium ${
              isDarkMode 
                ? "bg-blue-500/20 text-blue-400" 
                : "bg-blue-500/10 text-blue-600"
            }`}>
              {currentRoom?.players?.length || 0}/4
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentRoom?.players?.map(player => (
              <div key={player.id} className={`rounded-2xl border p-4 transition-all duration-200 ${
                isDarkMode 
                  ? "bg-white/5 border-white/10" 
                  : "bg-white/80 border-gray-300/30"
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${
                    player.isHost 
                      ? "bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30"
                      : "bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30"
                  }`}>
                    {player.isHost ? (
                      <Crown className="w-5 h-5 text-yellow-400" />
                    ) : (
                      <Users className="w-5 h-5 text-blue-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className={`font-bold ${
                          isDarkMode ? "text-white" : "text-gray-800"
                        }`}>{player.name}</h4>
                        {player.isHost && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            isDarkMode 
                              ? "bg-yellow-500/20 text-yellow-400" 
                              : "bg-yellow-500/10 text-yellow-600"
                          }`}>
                            방장
                          </span>
                        )}
                      </div>
                      
                      {/* 강퇴 버튼 (방장만 표시, 자기 자신 제외) */}
                      {currentRoom?.players?.find(p => p.id === userData?.userUuid)?.isHost && 
                       !player.isHost && 
                       player.id !== userData?.userUuid && (
                        <button
                          onClick={() => kickPlayer(player.id)}
                          className={`p-1.5 rounded-lg transition-all duration-200 hover:scale-110 ${
                            isDarkMode
                              ? "bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
                              : "bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/30"
                          }`}
                          title="플레이어 강퇴"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {player.isReady || player.isHost ? (
                        <div className="flex items-center gap-1">
                          <UserCheck className="w-4 h-4 text-green-400" />
                          <span className={`text-sm font-medium ${
                            isDarkMode ? "text-green-400" : "text-green-600"
                          }`}>
                            {player.isHost ? '준비완료' : '준비완료'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4 text-yellow-400" />
                          <span className={`text-sm ${
                            isDarkMode ? "text-yellow-400" : "text-yellow-600"
                          }`}>
                            준비중...
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* 전투 참전 동료 정보 - 컴팩트 버전 */}
                    <div className="mt-2 pt-2 border-t border-gray-300/20">
                      {(() => {
                        // 본인인 경우 클라이언트의 실제 battleCompanions 사용
                        if (player.id === userData?.userUuid && battleCompanions && companionStats) {
                          const myBattleCompanions = battleCompanions.map(companionName => ({
                            companionName,
                            level: companionStats[companionName]?.level || 1
                          }));
                          
                          if (myBattleCompanions.length > 0) {
                            return (
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className={`text-xs ${
                                  isDarkMode ? "text-gray-400" : "text-gray-500"
                                }`}>
                                  ⚔️
                                </span>
                                {myBattleCompanions.map((companion, idx) => (
                                  <span key={idx} className={`text-xs px-1.5 py-0.5 rounded-full ${
                                    isDarkMode 
                                      ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" 
                                      : "bg-blue-500/10 text-blue-600 border border-blue-500/30"
                                  }`}>
                                    {companion.companionName} Lv.{companion.level}
                                  </span>
                                ))}
                              </div>
                            );
                          } else {
                            return (
                              <div className={`text-xs flex items-center gap-1 ${
                                isDarkMode ? "text-gray-500" : "text-gray-400"
                              }`}>
                                <span>⚔️</span>
                                <span>참전 동료 없음</span>
                              </div>
                            );
                          }
                        }
                        
                        // 다른 플레이어인 경우 서버에서 가져온 데이터 사용
                        const companions = playersCompanions[player.id] || [];
                        if (companions.length > 0) {
                          return (
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className={`text-xs ${
                                isDarkMode ? "text-gray-400" : "text-gray-500"
                              }`}>
                                ⚔️
                              </span>
                              {companions.map((companion, idx) => (
                                <span key={idx} className={`text-xs px-1.5 py-0.5 rounded-full ${
                                  isDarkMode 
                                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" 
                                    : "bg-blue-500/10 text-blue-600 border border-blue-500/30"
                                }`}>
                                  {companion.companionName} Lv.{companion.level}
                                </span>
                              ))}
                            </div>
                          );
                        } else {
                          return (
                            <div className={`text-xs flex items-center gap-1 ${
                              isDarkMode ? "text-gray-500" : "text-gray-400"
                            }`}>
                              <span>⚔️</span>
                              <span>참전 동료 없음</span>
                            </div>
                          );
                        }
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {/* 빈 슬롯 */}
            {Array.from({ length: 4 - (currentRoom?.players?.length || 0) }, (_, i) => (
              <div key={`empty-${i}`} className={`rounded-2xl border-2 border-dashed p-4 text-center ${
                isDarkMode 
                  ? "border-gray-600 text-gray-500" 
                  : "border-gray-300 text-gray-400"
              }`}>
                <div className="p-3 rounded-xl bg-gray-500/10 inline-flex mb-2">
                  <UserX className="w-5 h-5 opacity-50" />
                </div>
                <p className="text-sm font-medium">빈 슬롯</p>
                <p className="text-xs opacity-75">플레이어를 기다리는 중...</p>
              </div>
            ))}
          </div>
        </div>

        {/* 원정 정보 - 리모델링 */}
        <div className="mb-8">
          <div className={`relative overflow-hidden rounded-2xl p-6 ${
            isDarkMode 
              ? "bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-white/10" 
              : "bg-gradient-to-br from-white/90 to-gray-50/90 border border-gray-200/50"
          } backdrop-blur-sm shadow-xl`}>
            
            {/* 헤더 */}
            <div className="flex items-center gap-3 mb-6">
              <div className={`p-2 rounded-xl ${
                isDarkMode 
                  ? "bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-400/30" 
                  : "bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-400/30"
              }`}>
                <Target className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className={`text-xl font-bold ${
                  isDarkMode ? "text-white" : "text-gray-800"
                }`}>원정 정보</h3>
                <p className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}>{currentRoom?.area?.name || "지역 정보"}</p>
              </div>
            </div>

            {/* 정보 카드들 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* 몬스터 정보 */}
              <div className={`relative group rounded-xl p-5 transition-all duration-300 hover:scale-105 ${
                isDarkMode 
                  ? "bg-gradient-to-br from-red-500/15 to-pink-500/15 border border-red-500/25 hover:border-red-400/40" 
                  : "bg-gradient-to-br from-red-500/8 to-pink-500/8 border border-red-500/20 hover:border-red-400/30"
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${
                    isDarkMode ? "bg-red-500/20" : "bg-red-500/10"
                  }`}>
                    <span className="text-xl">🐟</span>
                  </div>
                  <div>
                    <h4 className={`font-semibold ${
                      isDarkMode ? "text-red-300" : "text-red-700"
                    }`}>적 몬스터</h4>
                    <p className={`text-xs ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}>
                      {currentRoom?.monsters?.length > 0 ? "출현 수량" : "예상 수량"}
                    </p>
                  </div>
                </div>
                <div className={`text-2xl font-bold ${
                  isDarkMode ? "text-white" : "text-gray-800"
                }`}>
                  {currentRoom?.monsters?.length > 0 
                    ? currentRoom.monsters.length 
                    : `${currentRoom?.area?.minMonsters || 0}-${currentRoom?.area?.maxMonsters || 0}`
                  }
                  <span className={`text-sm font-normal ml-1 ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}>마리</span>
                </div>
                
                {/* 호버 효과 */}
                <div className={`absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
                  isDarkMode ? "bg-red-500/5" : "bg-red-500/3"
                }`}></div>
              </div>

              {/* 레벨 정보 */}
              <div className={`relative group rounded-xl p-5 transition-all duration-300 hover:scale-105 ${
                isDarkMode 
                  ? "bg-gradient-to-br from-yellow-500/15 to-orange-500/15 border border-yellow-500/25 hover:border-yellow-400/40" 
                  : "bg-gradient-to-br from-yellow-500/8 to-orange-500/8 border border-yellow-500/20 hover:border-yellow-400/30"
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${
                    isDarkMode ? "bg-yellow-500/20" : "bg-yellow-500/10"
                  }`}>
                    <Star className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <h4 className={`font-semibold ${
                      isDarkMode ? "text-yellow-300" : "text-yellow-700"
                    }`}>레벨 범위</h4>
                    <p className={`text-xs ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}>몬스터 강도</p>
                  </div>
                </div>
                <div className={`text-2xl font-bold ${
                  isDarkMode ? "text-white" : "text-gray-800"
                }`}>
                  {currentRoom?.area?.fishRankRange[0]}-{currentRoom?.area?.fishRankRange[1]}
                  <span className={`text-sm font-normal ml-1 ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}>레벨</span>
                </div>
                
                {/* 호버 효과 */}
                <div className={`absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
                  isDarkMode ? "bg-yellow-500/5" : "bg-yellow-500/3"
                }`}></div>
              </div>

              {/* 파티 정보 */}
              <div className={`relative group rounded-xl p-5 transition-all duration-300 hover:scale-105 ${
                isDarkMode 
                  ? "bg-gradient-to-br from-blue-500/15 to-cyan-500/15 border border-blue-500/25 hover:border-blue-400/40" 
                  : "bg-gradient-to-br from-blue-500/8 to-cyan-500/8 border border-blue-500/20 hover:border-blue-400/30"
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${
                    isDarkMode ? "bg-blue-500/20" : "bg-blue-500/10"
                  }`}>
                    <Users className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h4 className={`font-semibold ${
                      isDarkMode ? "text-blue-300" : "text-blue-700"
                    }`}>파티 구성</h4>
                    <p className={`text-xs ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}>최대 인원</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className={`text-2xl font-bold ${
                    isDarkMode ? "text-white" : "text-gray-800"
                  }`}>
                    {currentRoom?.players?.length || 0}/4
                    <span className={`text-sm font-normal ml-1 ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}>명</span>
                  </div>
                  <div className="flex -space-x-2">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-medium ${
                        i < (currentRoom?.players?.length || 0)
                          ? isDarkMode 
                            ? "bg-blue-500 border-blue-400 text-white" 
                            : "bg-blue-500 border-blue-400 text-white"
                          : isDarkMode 
                            ? "bg-gray-700 border-gray-600 text-gray-400" 
                            : "bg-gray-200 border-gray-300 text-gray-500"
                      }`}>
                        {i < (currentRoom?.players?.length || 0) ? "👤" : "?"}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* 호버 효과 */}
                <div className={`absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
                  isDarkMode ? "bg-blue-500/5" : "bg-blue-500/3"
                }`}></div>
              </div>
            </div>


            {/* 배경 장식 */}
            <div className={`absolute top-0 right-0 w-32 h-32 opacity-5 ${
              isDarkMode ? "text-white" : "text-gray-800"
            }`}>
              <Target className="w-full h-full" />
            </div>
          </div>
        </div>
      </div>

      {/* 하단 컨트롤 */}
      <div className={`border-t p-6 ${
        isDarkMode ? "border-white/10" : "border-gray-300/20"
      }`}>
        <div className="flex gap-3">
          {!isHost() && (
            <button
              onClick={toggleReady}
              className={`flex-1 py-4 px-6 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 ${
                getCurrentPlayer()?.isReady
                  ? isDarkMode
                    ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30"
                    : "bg-yellow-500/10 text-yellow-600 border border-yellow-500/30 hover:bg-yellow-500/20"
                  : isDarkMode
                    ? "bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30"
                    : "bg-green-500/10 text-green-600 border border-green-500/30 hover:bg-green-500/20"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                {getCurrentPlayer()?.isReady ? (
                  <>
                    <UserX className="w-5 h-5" />
                    준비 취소
                  </>
                ) : (
                  <>
                    <UserCheck className="w-5 h-5" />
                    준비 완료
                  </>
                )}
              </div>
            </button>
          )}
          
          {isHost() && currentRoom?.players?.length === 1 && sendExpeditionInviteToChat && (
            <button
              onClick={() => {
                sendExpeditionInviteToChat(currentRoom.id, currentRoom.area.name);
                alert('채팅창에 초대 메시지를 보냈습니다!');
              }}
              className={`flex-1 py-4 px-6 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 ${
                isDarkMode
                  ? "bg-gradient-to-r from-teal-500/80 to-cyan-500/80 hover:from-teal-500 hover:to-cyan-500 text-white"
                  : "bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <MessageCircle className="w-5 h-5" />
                채팅에 초대장 보내기
              </div>
            </button>
          )}
          
          {isHost() && (
            <button
              onClick={startExpedition}
              disabled={!currentRoom?.players?.every(p => p.isReady || p.isHost)}
              className={`flex-1 py-4 px-6 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 ${
                isDarkMode
                  ? "bg-gradient-to-r from-blue-500/80 to-purple-500/80 hover:from-blue-500 hover:to-purple-500 text-white"
                  : "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Play className="w-5 h-5" />
                원정 시작
              </div>
            </button>
          )}
        </div>
        
        {isHost() && !currentRoom?.players?.every(p => p.isReady || p.isHost) && (
          <p className={`text-center text-sm mt-3 ${
            isDarkMode ? "text-gray-400" : "text-gray-500"
          }`}>
            모든 플레이어가 준비를 완료해야 시작할 수 있습니다
          </p>
        )}
      </div>
    </div>
  );

  // 전투 화면 렌더링
  const renderBattle = () => (
    <div className="h-full flex flex-col">
      {/* 헤더 */}
      <div className={`border-b p-6 ${
        isDarkMode ? "border-white/10" : "border-gray-300/20"
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30">
              <Sword className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h2 className={`text-2xl font-bold ${
                isDarkMode ? "text-white" : "text-gray-800"
              }`}>⚔️ {currentRoom?.area?.name}</h2>
              <p className={`text-sm ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}>전투가 진행 중입니다</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className={`text-xs ${
                isDarkMode ? "text-gray-400" : "text-gray-500"
              }`}>참가자</div>
              <div className={`text-lg font-bold ${
                isDarkMode ? "text-blue-400" : "text-blue-600"
              }`}>{currentRoom?.players?.length}명</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        {/* 플레이어 체력 정보만 표시 */}
        {currentRoom?.battleState && (
          <div className="mb-6">
            <div className="grid grid-cols-1 gap-4 mb-4">

              {/* 플레이어 및 동료 체력 */}
              <div className="mb-4">
                <h4 className={`font-bold mb-3 ${
                  isDarkMode ? "text-green-400" : "text-green-600"
                }`}>참가자 상태</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {currentRoom.players.map(player => {
                    const currentHp = currentRoom.battleState?.playerHp?.[player.id] || 0;
                    const maxHp = currentRoom.battleState?.playerMaxHp?.[player.id] || 100;
                    const hpPercentage = maxHp > 0 ? (currentHp / maxHp) * 100 : 0;
                    const isLowHp = hpPercentage < 30;
                    const isDead = currentHp <= 0;
                    
                    // 해당 플레이어의 동료들 찾기
                    const playerData = currentRoom.playerData?.[player.id];
                    const companions = playerData?.companions || [];
                    
                    return (
                      <div key={player.id} className={`p-4 rounded-xl border transition-all duration-300 ${
                        isDarkMode 
                          ? "bg-gray-800/50 border-gray-600/50 hover:bg-gray-800/70" 
                          : "bg-white/50 border-gray-300/50 hover:bg-white/70"
                      }`}>
                        {/* 플레이어 체력 */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className={`text-sm font-medium flex items-center gap-2 ${
                              isDead 
                                ? isDarkMode ? "text-red-400" : "text-red-600"
                                : isDarkMode ? "text-gray-300" : "text-gray-700"
                            }`}>
                              👤 {player.name}
                              {player.isHost && <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded">방장</span>}
                            </span>
                          </div>
                          
                          {/* 플레이어 상태치 정보 */}
                          <div className={`text-xs ${
                            isDarkMode ? "text-gray-400" : "text-gray-500"
                          }`}>
                            🎣 낚시실력: {playerData?.fishingSkill || 1} | 
                            ⚔️ 공격력: {(() => {
                              const playerFishingSkill = playerData?.fishingSkill || 1;
                              const fishingRodEnhancement = playerData?.fishingRodEnhancement || 0;
                              
                              // 강화 보너스 계산 (3차방정식 - 강화 모달과 동일)
                              let enhancementBonus = 0;
                              if (calculateTotalEnhancementBonus) {
                                enhancementBonus = calculateTotalEnhancementBonus(fishingRodEnhancement);
                              } else {
                                // calculateTotalEnhancementBonus가 없는 경우 직접 계산 (3차방정식)
                                const calculateEnhancementBonus = (level) => {
                                  if (level <= 0) return 0;
                                  return 0.1 * Math.pow(level, 3) - 0.2 * Math.pow(level, 2) + 0.8 * level;
                                };
                                for (let i = 1; i <= fishingRodEnhancement; i++) {
                                  enhancementBonus += calculateEnhancementBonus(i);
                                }
                              }
                              
                              // 공격력 계산 (내 정보탭과 동일한 공식)
                              const baseAttack = 0.00225 * Math.pow(playerFishingSkill, 3) + 0.165 * Math.pow(playerFishingSkill, 2) + 2 * playerFishingSkill + 3;
                              const totalAttack = baseAttack + (baseAttack * enhancementBonus / 100);
                              return Math.floor(totalAttack);
                            })()} | 
                            💚 체력: {(() => {
                              const accessoryLevel = playerData?.accessoryLevel || 0;
                              const accessoryEnhancement = playerData?.accessoryEnhancement || 0;
                              
                              // 강화 보너스 계산 (내 정보탭과 동일)
                              let enhancementBonus = 0;
                              if (calculateTotalEnhancementBonus) {
                                enhancementBonus = calculateTotalEnhancementBonus(accessoryEnhancement);
                              } else {
                                // calculateTotalEnhancementBonus가 없는 경우 직접 계산
                                for (let i = 1; i <= accessoryEnhancement; i++) {
                                  enhancementBonus += 2 + Math.floor(i / 10);
                                }
                              }
                              
                              // 체력 계산 (내 정보탭과 동일한 공식)
                              const baseHp = accessoryLevel === 0 ? 50 : Math.floor(Math.pow(accessoryLevel, 1.525) + 65 * accessoryLevel);
                              const totalHp = baseHp + (baseHp * enhancementBonus / 100);
                              return Math.floor(totalHp);
                            })()} | 
                            🛡️ 악세사리: {(() => {
                              const accessoryLevel = playerData?.accessoryLevel || 0;
                              const accessories = [
                                '없음', '오래된반지', '은목걸이', '금귀걸이', '마법의펜던트', '에메랄드브로치',
                                '토파즈이어링', '자수정팔찌', '백금티아라', '만드라고라허브', '에테르나무묘목',
                                '몽마의조각상', '마카롱훈장', '빛나는마력순환체', '갈라진백조인형', '기계천사', '공명하는보석'
                              ];
                              const accessoryName = accessories[accessoryLevel] || '없음';
                              return accessoryLevel === 0 ? '없음' : `Lv.${accessoryLevel} ${accessoryName}`;
                            })()}
                          </div>
                          
                          {/* HP 바 */}
                          <div className={`w-full rounded-full h-4 relative ${
                            isDarkMode ? "bg-gray-700" : "bg-gray-200"
                          }`}>
                            <div
                              className={`h-4 rounded-full transition-all duration-500 ${
                                isDead
                                  ? "bg-gradient-to-r from-gray-600 to-gray-500"
                                  : isLowHp 
                                    ? "bg-gradient-to-r from-yellow-500 to-orange-500 animate-pulse"
                                    : "bg-gradient-to-r from-green-500 to-emerald-500"
                              }`}
                              style={{ width: `${Math.max(0, hpPercentage)}%` }}
                            ></div>
                            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                              {Math.floor(currentHp).toLocaleString()} / {Math.floor(maxHp).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        
                        {/* 플레이어 속도바 (항해 전투와 동일 - 쿨다운 방식) */}
                        <div className="mt-3">
                          <div className={`w-full rounded-full h-1.5 ${
                            isDarkMode ? "bg-gray-700" : "bg-gray-200"
                          }`}>
                            <div
                              className={`h-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-100`}
                              style={{ 
                                width: `${speedBars[`player_${player.id}`] ? ((speedBars[`player_${player.id}`].max - speedBars[`player_${player.id}`].current) / speedBars[`player_${player.id}`].max) * 100 : 0}%` 
                              }}
                            ></div>
                          </div>
                        </div>

                        {/* 동료들 체력 */}
                        {companions.length > 0 && (
                          <div className={`space-y-2 pl-4 border-l-2 ${
                            isDarkMode ? "border-gray-600" : "border-gray-400"
                          }`}>
                            <span className={`text-xs font-medium ${
                              isDarkMode ? "text-gray-400" : "text-gray-500"
                            }`}>동료들</span>
                            {companions.map(companion => {
                              const companionKey = `${player.id}_${companion.companionName}`;
                              const companionHp = currentRoom.battleState?.companionHp?.[companionKey] || 0;
                              const companionMaxHp = currentRoom.battleState?.companionMaxHp?.[companionKey] || 100;
                              const companionHpPercentage = companionMaxHp > 0 ? (companionHp / companionMaxHp) * 100 : 0;
                              const isCompanionLowHp = companionHpPercentage < 30;
                              const isCompanionDead = companionHp <= 0;
                              
                              return (
                                <div key={companionKey} className="space-y-1">
                                  <div className="flex justify-between items-center">
                                    <span className={`text-xs font-medium flex items-center gap-1 ${
                                      isCompanionDead 
                                        ? isDarkMode ? "text-red-400" : "text-red-600"
                                        : isDarkMode ? "text-blue-300" : "text-blue-600"
                                    }`}>
                                      ⚔️ {companion.companionName} (Lv.{companion.level})
                                    </span>
                                  </div>
                                  
                                  {/* 동료 HP 바 */}
                                  <div className="mt-2">
                                    <div className={`w-full rounded-full h-3 relative ${
                                      isDarkMode ? "bg-gray-700" : "bg-gray-200"
                                    }`}>
                                      <div
                                        className={`h-3 rounded-full transition-all duration-500 ${
                                          isCompanionDead
                                            ? "bg-gradient-to-r from-gray-600 to-gray-500"
                                            : isCompanionLowHp 
                                              ? "bg-gradient-to-r from-yellow-500 to-orange-500 animate-pulse"
                                              : "bg-gradient-to-r from-green-500 to-emerald-500"
                                        }`}
                                        style={{ width: `${Math.max(0, companionHpPercentage)}%` }}
                                      ></div>
                                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                                        {Math.floor(companionHp)}/{Math.floor(companionMaxHp)}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  {/* 동료 사기 바 */}
                                  <div className="mt-2">
                                    <div className={`w-full rounded-full h-3 relative ${
                                      isDarkMode ? "bg-gray-700" : "bg-gray-200"
                                    }`}>
                                      <div
                                        className="h-3 rounded-full transition-all duration-500 bg-gradient-to-r from-yellow-400 to-yellow-500"
                                        style={{ width: `${Math.max(0, (currentRoom.battleState?.companionMorale?.[companionKey] || 50))}%` }}
                                      ></div>
                                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                                        {currentRoom.battleState?.companionMorale?.[companionKey] || 50}/100
                                      </span>
                                    </div>
                                  </div>
                                  
                                  {/* 동료 속도바 (항해 전투와 동일 - 쿨다운 방식) */}
                                  <div className="mt-2">
                                    <div className={`w-full rounded-full h-1.5 ${
                                      isDarkMode ? "bg-gray-700" : "bg-gray-200"
                                    }`}>
                                      <div
                                        className={`h-1.5 rounded-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all duration-100`}
                                        style={{ 
                                          width: `${speedBars[`companion_${companionKey}`] ? ((speedBars[`companion_${companionKey}`].max - speedBars[`companion_${companionKey}`].current) / speedBars[`companion_${companionKey}`].max) * 100 : 0}%` 
                                        }}
                                      ></div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 몬스터 목록 */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-6">
            <Target className={`w-5 h-5 ${
              isDarkMode ? "text-red-400" : "text-red-500"
            }`} />
            <h3 className={`text-lg font-bold ${
              isDarkMode ? "text-white" : "text-gray-800"
            }`}>적 몬스터</h3>
            <span className={`ml-auto px-3 py-1 rounded-full text-sm font-medium ${
              isDarkMode 
                ? "bg-red-500/20 text-red-400" 
                : "bg-red-500/10 text-red-600"
            }`}>
              {currentRoom?.monsters?.filter(m => m.isAlive).length}/5마리 생존
            </span>
          </div>
          
          {currentRoom?.monsters?.every(monster => !monster.isAlive) ? (
            <div className={`text-center py-16 rounded-2xl ${
              isDarkMode 
                ? "bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30"
                : "bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30"
            }`}>
              <div className="p-4 rounded-full bg-green-500/20 inline-flex mb-4">
                <Star className="w-12 h-12 text-green-400" />
              </div>
              <h3 className={`text-3xl font-bold mb-2 ${
                isDarkMode ? "text-green-400" : "text-green-600"
              }`}>🎉 승리!</h3>
              <p className={`text-lg ${
                isDarkMode ? "text-green-300" : "text-green-700"
              }`}>모든 몬스터를 물리쳤습니다!</p>
              <p className={`text-sm mt-2 ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}>잠시 후 로비로 돌아갑니다...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              
              
               {/* 몬스터 카드들 */}
               {currentRoom?.monsters?.map(monster => {
                 const isAlive = monster.isAlive;
                 const hpPercentage = (monster.currentHp / monster.maxHp) * 100;
                 const isLowHp = hpPercentage < 30;
                 const prefixGradient = getPrefixGradient(monster.prefix?.name || '거대한', isDarkMode);
                 
                 return (
                   <div key={monster.id} className={`rounded-lg border p-2 transition-all duration-300 hover:scale-105 bg-gradient-to-br ${prefixGradient} ${
                     isDarkMode 
                       ? "hover:brightness-110"
                       : "hover:brightness-95"
                   }`}>
                     <div className="flex items-center gap-1.5 mb-2">
                       <div className={`p-1 rounded ${
                         isAlive
                           ? "bg-gradient-to-br from-red-500/20 to-pink-500/20 border border-red-500/30"
                           : "bg-gradient-to-br from-gray-500/20 to-gray-600/20 border border-gray-500/30"
                       }`}>
                         <span className="text-sm">🐟</span>
                       </div>
                       <div className="flex-1 min-w-0">
                         <h4 className={`font-bold text-sm leading-tight truncate ${
                           getPrefixColor(monster.prefix?.name || '거대한', isDarkMode)
                         }`}>{monster.name}</h4>
                         <p className={`text-xs ${
                           isDarkMode ? "text-gray-400" : "text-gray-600"
                         }`}>Lv.{monster.rank}</p>
                       </div>
                     </div>
                     
                     {/* HP 바 */}
                     <div className="mb-2">
                       <div className={`w-full rounded-full h-4 relative ${
                         isDarkMode ? "bg-gray-700" : "bg-gray-200"
                       }`}>
                         <div
                           className={`h-4 rounded-full transition-all duration-500 ${
                             !isAlive
                               ? "bg-gradient-to-r from-gray-600 to-gray-500"
                               : isLowHp 
                                 ? "bg-gradient-to-r from-red-600 to-red-500"
                                 : (() => {
                                     switch (monster.prefix?.name) {
                                       case '변종':
                                         return "bg-gradient-to-r from-green-500 to-emerald-500";
                                       case '심연의':
                                         return "bg-gradient-to-r from-purple-500 to-violet-500";
                                       case '깊은어둠의':
                                         return "bg-gradient-to-r from-red-500 to-pink-500";
                                       default:
                                         return "bg-gradient-to-r from-gray-500 to-gray-400";
                                     }
                                   })()
                           } ${isLowHp ? "animate-pulse" : ""}`}
                           style={{ width: `${hpPercentage}%` }}
                         ></div>
                         <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-lg">
                           {Math.floor(monster.currentHp).toLocaleString()} / {Math.floor(monster.maxHp).toLocaleString()}
                         </span>
                       </div>
                     </div>
                     
                     {/* 몬스터 속도바 (항해 전투와 동일 - 쿨다운 방식) */}
                    <div className="mb-1.5">
                      <div className={`w-full rounded-full h-1.5 ${
                        isDarkMode ? "bg-gray-700" : "bg-gray-200"
                      }`}>
                        <div
                          className={`h-1.5 rounded-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full transition-all duration-100`}
                          style={{ 
                            width: `${speedBars[`monster_${monster.id}`] ? ((speedBars[`monster_${monster.id}`].max - speedBars[`monster_${monster.id}`].current) / speedBars[`monster_${monster.id}`].max) * 100 : 0}%` 
                          }}
                        ></div>
                      </div>
                    </div>
                     
                     {/* 스탯 표시 */}
                     <div className={`w-full py-2 px-3 rounded-lg text-center ${
                       isAlive 
                         ? isDarkMode 
                           ? "bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30"
                           : "bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30"
                         : isDarkMode
                           ? "bg-gradient-to-r from-gray-600/20 to-gray-700/20 border border-gray-600/30"
                           : "bg-gradient-to-r from-gray-500/10 to-gray-600/10 border border-gray-500/30"
                     }`}>
                       <div className={`text-xs ${
                         isDarkMode ? "text-gray-400" : "text-gray-500"
                       }`}>
                         <div>⚔️ {monster.attackPower}</div>
                         <div className="mt-1">⚡ {(monster.speed || 80).toFixed(1)}</div>
                       </div>
                     </div>
                   </div>
                 );
               })}
            </div>
          )}
        </div>


        {/* 전투 로그 */}
        {currentRoom?.battleState?.battleLog && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className={`text-lg font-bold ${
                isDarkMode ? "text-white" : "text-gray-800"
              }`}>전투 로그</h3>
            </div>
            
            <div 
              ref={battleLogRef}
              className={`rounded-2xl border p-4 max-h-48 overflow-y-auto ${
                isDarkMode 
                  ? "bg-gray-800/50 border-white/10" 
                  : "bg-gray-50 border-gray-300/30"
              }`}>
              <div className="space-y-2">
                {currentRoom.battleState.battleLog.slice(-20).map((log, index) => {
                  // 로그 타입에 따른 스타일링
                  let logStyle = isDarkMode ? "text-gray-300" : "text-gray-700";
                  let bgStyle = "";
                  
                  // 크리티컬 히트 (최우선 - 주황색)
                  if (log.includes('💥 크리티컬') || log.includes('(치명타!)')) {
                    logStyle = isDarkMode ? "text-orange-300 font-medium" : "text-orange-700 font-medium";
                    bgStyle = isDarkMode ? "bg-orange-500/10 border-l-4 border-orange-500/50 pl-3" : "bg-orange-100/50 border-l-4 border-orange-500/50 pl-3";
                  } else if (log.includes('스킬을') || log.includes('스킬 \'') || 
                      log.includes('회복시켰습니다') || log.includes('회복했습니다') ||
                      log.includes('🔥 3턴 동안') || log.includes('🎯 3턴 동안') ||
                      log.includes('💚') || 
                      (log.includes('이(가)') && log.includes('에게') && log.includes('데미지') &&
                       (log.includes('플레이어') || log.includes('실') || log.includes('피에나') || 
                        log.includes('애비게일') || log.includes('클로에') || log.includes('림스&베리') || 
                        log.includes('나하트라')))) {
                    logStyle = isDarkMode ? "text-blue-300 font-medium" : "text-blue-700 font-medium";
                    bgStyle = isDarkMode ? "bg-blue-500/15 border-l-4 border-blue-400/60 pl-3" : "bg-blue-100/60 border-l-4 border-blue-500/60 pl-3";
                  } else if (log.includes('데미지')) {
                    logStyle = isDarkMode ? "text-red-300" : "text-red-700";
                    bgStyle = isDarkMode ? "bg-red-500/10" : "bg-red-100/30";
                  } else if (log.includes('쓰러졌습니다')) {
                    logStyle = isDarkMode ? "text-gray-400 font-medium" : "text-gray-600 font-medium";
                    bgStyle = isDarkMode ? "bg-gray-600/10 border-l-4 border-gray-500/50 pl-3" : "bg-gray-200/50 border-l-4 border-gray-400/50 pl-3";
                  } else if (log.includes('참여합니다') || log.includes('시작')) {
                    logStyle = isDarkMode ? "text-blue-300 font-medium" : "text-blue-700 font-medium";
                    bgStyle = isDarkMode ? "bg-blue-500/10" : "bg-blue-100/30";
                  }
                  
                  return (
                    <div key={index} className={`text-sm p-2 rounded transition-all duration-200 ${bgStyle} ${logStyle}`}>
                      {log}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 승리 시 보상 수령 버튼 */}
        {currentRoom?.status === 'completed' && currentRoom?.rewards && 
         currentRoom.rewards.some(reward => reward.playerId === userData?.userUuid) && (
          <div className="mb-8">
            <div className={`rounded-2xl border p-6 text-center ${
              isDarkMode 
                ? "bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500/30"
                : "bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30"
            }`}>
              <h3 className={`text-2xl font-bold mb-4 ${
                isDarkMode ? "text-green-400" : "text-green-600"
              }`}>🎉 원정 성공!</h3>
              <div className={`mb-4 ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}>
                <p className="mb-2">획득 보상:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {currentRoom.rewards
                    .filter(reward => reward.playerId === userData?.userUuid) // 내 보상만 필터링
                    .map((reward, index) => (
                    <span key={index} className={`px-3 py-1 rounded-full text-sm font-medium ${
                      isDarkMode 
                        ? "bg-white/10 text-white" 
                        : "bg-gray-100 text-gray-800"
                    }`}>
                      {reward.fishName} x{reward.quantity}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={claimRewards}
                  disabled={isClaimingRewards}
                  className={`px-8 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 ${
                    isClaimingRewards
                      ? "bg-gray-400 cursor-not-allowed opacity-50"
                      : isDarkMode
                        ? "bg-gradient-to-r from-green-500/80 to-emerald-500/80 hover:from-green-500 hover:to-emerald-500 text-white"
                        : "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                  }`}
                >
                  {isClaimingRewards ? "수령 중..." : "보상 수령하기"}
                </button>
                <button
                  onClick={() => {
                    if (socket && currentRoom) {
                      socket.emit('expedition-leave-room', currentRoom.id);
                    }
                    setCurrentView('lobby');
                    setCurrentRoom(null);
                    loadAvailableRooms();
                  }}
                  className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                    isDarkMode
                      ? "bg-gray-600/80 hover:bg-gray-600 text-white"
                      : "bg-gray-500 hover:bg-gray-600 text-white"
                  }`}
                >
                  방 나가기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 참가자 정보 */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Users className={`w-5 h-5 ${
              isDarkMode ? "text-blue-400" : "text-blue-500"
            }`} />
            <h3 className={`text-lg font-bold ${
              isDarkMode ? "text-white" : "text-gray-800"
            }`}>전투 참가자</h3>
          </div>
          
          <div className="flex flex-wrap gap-3">
            {currentRoom?.players?.map(player => (
              <div key={player.id} className={`rounded-xl px-4 py-2 border transition-all duration-200 ${
                player.isHost
                  ? isDarkMode
                    ? "bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/30 text-yellow-400"
                    : "bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/30 text-yellow-600"
                  : isDarkMode
                    ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-blue-500/30 text-blue-400"
                    : "bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/30 text-blue-600"
              }`}>
                <div className="flex items-center gap-2">
                  {player.isHost && <Crown className="w-4 h-4" />}
                  <span className="font-medium">{player.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // 플레이어 강퇴 함수
  const kickPlayer = async (targetPlayerId) => {
    if (!userData?.userUuid) return;
    
    try {
      const token = localStorage.getItem('jwtToken');
      const response = await fetch('/api/expedition/rooms/kick', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ targetPlayerId })
      });
      
      const data = await response.json();
      if (data.success) {
        console.log('[EXPEDITION] Player kicked successfully:', targetPlayerId);
        setCurrentRoom(data.room);
      } else {
        alert(data.error || '플레이어 강퇴에 실패했습니다.');
      }
    } catch (error) {
      console.error('플레이어 강퇴 실패:', error);
      alert('플레이어 강퇴 중 오류가 발생했습니다.');
    }
  };

  // 패배 모달 핸들러
  const handleDefeatModalClose = () => {
    setShowDefeatModal(false);
    
    // 🔥 탐사전투와 동일: 완전히 정리
    clearAllSpeedBars();
    clearTurnProgress();
    setCurrentRoom(null);
    setCurrentView('lobby');
    
    console.log('[EXPEDITION] 패배 모달 닫힘 - 상태 완전 초기화');
    loadAvailableRooms();
  };

  return (
    <>
      {currentView === 'lobby' && renderLobby()}
      {currentView === 'room' && renderRoom()}
      {currentView === 'battle' && renderBattle()}
      
      {/* 패배 모달 */}
      {showDefeatModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`relative max-w-md w-full mx-4 rounded-2xl p-8 text-center ${
            isDarkMode 
              ? "bg-gradient-to-br from-gray-800/95 to-gray-900/95 border border-red-500/30" 
              : "bg-gradient-to-br from-white/95 to-gray-50/95 border border-red-500/30"
          } shadow-2xl animate-pulse`}>
            
            {/* 패배 아이콘 */}
            <div className="mb-6">
              <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${
                isDarkMode 
                  ? "bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/40" 
                  : "bg-gradient-to-br from-red-500/10 to-red-600/10 border border-red-500/40"
              }`}>
                <span className="text-4xl">💀</span>
              </div>
            </div>
            
            {/* 패배 메시지 */}
            <div className="mb-8">
              <h2 className={`text-2xl font-bold mb-3 ${
                isDarkMode ? "text-red-400" : "text-red-600"
              }`}>패배했습니다!</h2>
              <p className={`text-lg ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}>모든 플레이어가 쓰러졌습니다.</p>
              <p className={`text-sm mt-2 ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}>다시 도전해보세요!</p>
            </div>
            
            {/* 확인 버튼 */}
            <button
              onClick={handleDefeatModalClose}
              className={`w-full py-3 px-6 rounded-xl font-medium transition-all duration-200 ${
                isDarkMode 
                  ? "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white border border-red-500/50" 
                  : "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white border border-red-400/50"
              } hover:scale-105 active:scale-95`}
            >
              원정 대기실로 돌아가기
            </button>
            
            {/* 배경 장식 */}
            <div className={`absolute top-4 right-4 opacity-10 ${
              isDarkMode ? "text-red-400" : "text-red-600"
            }`}>
              <span className="text-6xl">⚔️</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ExpeditionTab;
