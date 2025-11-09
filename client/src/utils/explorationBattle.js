// 탐사전투(재료 탐험) 관련 유틸리티
import { calculateCompanionStats } from '../data/companionData';

/**
 * 동료 스킬 처리 (속도바 기반 전투용)
 * @param {Object} params - 스킬 처리 파라미터
 * @returns {Object} - 업데이트된 전투 상태
 */
export const processExplorationCompanionSkill = ({
  companionName,
  companionData,
  skill,
  currentState,
  newEnemies,
  aliveEnemies,
  newLog,
  newCompanionBuffs,
  speedBarIntervalsRef
}) => {
  let damage = 0;

  // 힐 스킬
  if (skill.skillType === 'heal') {
    const healAmount = Math.floor(companionData.attack * skill.healMultiplier);
    let lowestHpTarget = null;
    let lowestHpRatio = 1;
    
    // 플레이어 체크 (살아있을 때만)
    if (currentState?.playerHp > 0) {
      const playerHpRatio = currentState.playerHp / currentState.playerMaxHp;
      if (playerHpRatio < lowestHpRatio) {
        lowestHpRatio = playerHpRatio;
        lowestHpTarget = { type: 'player', currentHp: currentState.playerHp, maxHp: currentState.playerMaxHp };
      }
    }
    
    // 동료들 체크 (살아있을 때만)
    if (currentState.companions) {
      currentState.companions.forEach(c => {
        const hp = currentState.companionHp?.[c];
        if (hp && hp.hp > 0) {
          const hpRatio = hp.hp / hp.maxHp;
          if (hpRatio < lowestHpRatio) {
            lowestHpRatio = hpRatio;
            lowestHpTarget = { type: 'companion', name: c, currentHp: hp.hp, maxHp: hp.maxHp };
          }
        }
      });
    }
    
    if (lowestHpTarget) {
      if (lowestHpTarget.type === 'player') {
        const newHp = Math.min(currentState.playerMaxHp, (currentState?.playerHp || 0) + healAmount);
        currentState.playerHp = newHp;
        newLog.push(`✨ ${companionName}이(가) ${skill.name}을(를) 사용!`);
        newLog.push(`💚 플레이어의 체력이 ${healAmount} 회복! (${newHp}/${currentState.playerMaxHp})`);
      } else {
        const newHp = Math.min(lowestHpTarget.maxHp, lowestHpTarget.currentHp + healAmount);
        currentState.companionHp[lowestHpTarget.name].hp = newHp;
        newLog.push(`✨ ${companionName}이(가) ${skill.name}을(를) 사용!`);
        newLog.push(`💚 ${lowestHpTarget.name}의 체력이 ${healAmount} 회복! (${newHp}/${lowestHpTarget.maxHp})`);
      }
    }
  }
  // 버프 스킬
  else if (skill.buffType) {
    const baseDamage = Math.floor(companionData.attack * (skill.damageMultiplier || 1.0));
    damage = Math.floor(baseDamage * (0.8 + Math.random() * 0.4));
    
    // 버프 적용
    if (!newCompanionBuffs[companionName]) {
      newCompanionBuffs[companionName] = {};
    }
    
    newCompanionBuffs[companionName][skill.buffType] = {
      multiplier: skill.buffMultiplier,
      duration: skill.buffDuration,
      turnsLeft: skill.buffDuration
    };
    
    newLog.push(`✨ ${companionName}이(가) ${skill.name}을(를) 사용!`);
    
    if (skill.buffType === 'attack') {
      newLog.push(`🔥 3턴 동안 공격력이 25% 상승!`);
    } else if (skill.buffType === 'critical') {
      newLog.push(`🎯 3턴 동안 크리티컬 확률이 20% 상승!`);
    } else if (skill.buffType === 'damage_reduction') {
      newLog.push(`🛡️ 2턴 동안 아군 전체가 받는 데미지가 30% 감소!`);
    } else if (skill.buffType === 'speed_boost') {
      newLog.push(`💨 5초 동안 아군의 속도가 2배로 증가!`);
    }
    
    // 데미지 처리
    if (damage > 0) {
      const targetEnemy = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
      const enemyIndex = newEnemies.findIndex(e => e.id === targetEnemy.id);
      if (enemyIndex >= 0) {
        const enemy = newEnemies[enemyIndex];
        const newHp = Math.max(0, enemy.hp - damage);
        
        // 깊은 복사
        newEnemies[enemyIndex] = {
          ...enemy,
          hp: newHp,
          isAlive: newHp > 0
        };
        
        newLog.push(`${enemy.name}에게 ${damage} 데미지! (${newHp}/${enemy.maxHp})`);
        
        if (newHp <= 0) {
          newLog.push(`${enemy.name}을(를) 물리쳤습니다!`);
          if (speedBarIntervalsRef.current[`enemy_${enemy.id}`]) {
            clearInterval(speedBarIntervalsRef.current[`enemy_${enemy.id}`]);
            delete speedBarIntervalsRef.current[`enemy_${enemy.id}`];
          }
        }
      }
    }
  }
  // AOE/다중 타겟 스킬
  else if (skill.skillType === 'aoe' || skill.skillType === 'multi_target') {
    newLog.push(`🌿 ${companionName}이(가) ${skill.name}을(를) 사용!`);
    
    if (skill.skillType === 'aoe') {
      newLog.push(`🌪️ 전체공격! 모든 적에게 데미지를 입힙니다!`);
    } else {
      newLog.push(`🎯 최대 ${skill.targetCount}명의 적을 동시에 공격합니다!`);
    }
    
    // 디버프 효과 안내
    if (skill.debuffType === 'speed_freeze') {
      newLog.push(`⭐ 공격받은 적은 ${(skill.debuffDuration || 3000) / 1000}초간 속도가 정지됩니다!`);
    }
    
    // 타겟 수 결정
    const targetCount = skill.skillType === 'aoe' ? aliveEnemies.length : Math.min(skill.targetCount || 2, aliveEnemies.length);
    
    // 타겟 선택
    const targets = [];
    const availableTargets = [...aliveEnemies];
    for (let i = 0; i < targetCount && availableTargets.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * availableTargets.length);
      targets.push(availableTargets[randomIndex]);
      availableTargets.splice(randomIndex, 1);
    }
    
    let killCount = 0; // 처치한 적 수 추적
    
    // 각 타겟에게 데미지 및 디버프 적용
    targets.forEach(target => {
      const baseDamage = Math.floor(companionData.attack * skill.damageMultiplier);
      damage = Math.floor(baseDamage * (0.8 + Math.random() * 0.4));
      
      const enemyIndex = newEnemies.findIndex(e => e.id === target.id);
      if (enemyIndex >= 0) {
        const enemy = newEnemies[enemyIndex];
        const newHp = Math.max(0, enemy.hp - damage);
        
        // 🔥 깊은 복사: 새 enemy 객체 생성
        newEnemies[enemyIndex] = {
          ...enemy,
          hp: newHp,
          isAlive: newHp > 0
        };
        
        newLog.push(`${enemy.name}에게 ${damage} 데미지! (${newHp}/${enemy.maxHp})`);
        
        // 속도 디버프 적용 - speedMultiplier를 0으로
        if (skill.debuffType === 'speed_freeze' && newHp > 0) {
          newLog.push(`❄️ ${enemy.name}의 속도가 정지되었습니다!`);
          
          newEnemies[enemyIndex].speedMultiplier = 0;
          newEnemies[enemyIndex].freezeTimerId = enemy.id;
          newEnemies[enemyIndex].freezeDuration = skill.debuffDuration || 3000;
        }
        
        if (newHp <= 0) {
          newLog.push(`${enemy.name}을(를) 물리쳤습니다!`);
          killCount++; // 처치 카운트 증가
          if (speedBarIntervalsRef.current[`enemy_${enemy.id}`]) {
            clearInterval(speedBarIntervalsRef.current[`enemy_${enemy.id}`]);
            delete speedBarIntervalsRef.current[`enemy_${enemy.id}`];
          }
        }
      }
    });
    
    // 적 처치 시 사기 증가 (onKillMoraleGain 스킬 속성)
    if (killCount > 0 && skill.onKillMoraleGain) {
      const moraleGain = skill.onKillMoraleGain * killCount;
      newCompanionMorale[companionName] = Math.min(100, newCompanionMorale[companionName] + moraleGain);
      newLog.push(`⚡ ${companionName}의 사기가 ${moraleGain} 증가했습니다! (${newCompanionMorale[companionName]}/100)`);
    }
  }
  // 단일 타겟 데미지 스킬
  else {
    const baseDamage = Math.floor(companionData.attack * skill.damageMultiplier);
    damage = Math.floor(baseDamage * (0.8 + Math.random() * 0.4));
    
    const targetEnemy = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
    const enemyIndex = newEnemies.findIndex(e => e.id === targetEnemy.id);
    if (enemyIndex >= 0) {
      const enemy = newEnemies[enemyIndex];
      const newHp = Math.max(0, enemy.hp - damage);
      
      // 깊은 복사
      newEnemies[enemyIndex] = {
        ...enemy,
        hp: newHp,
        isAlive: newHp > 0
      };
      
      newLog.push(`✨ ${companionName}이(가) ${skill.name}을(를) 사용!`);
      newLog.push(`${enemy.name}에게 ${damage} 데미지! (${newHp}/${enemy.maxHp})`);
      
      if (newHp <= 0) {
        newLog.push(`${enemy.name}을(를) 물리쳤습니다!`);
        if (speedBarIntervalsRef.current[`enemy_${enemy.id}`]) {
          clearInterval(speedBarIntervalsRef.current[`enemy_${enemy.id}`]);
          delete speedBarIntervalsRef.current[`enemy_${enemy.id}`];
        }
      }
    }
  }

  return { damage, enemies: newEnemies };
};

/**
 * 동료 일반 공격 처리
 */
export const processExplorationCompanionNormalAttack = ({
  companionName,
  companionData,
  aliveEnemies,
  newEnemies,
  newLog,
  speedBarIntervalsRef
}) => {
  const targetEnemy = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
  const damage = Math.floor(companionData.attack * (0.8 + Math.random() * 0.4));
  
  const enemyIndex = newEnemies.findIndex(e => e.id === targetEnemy.id);
  if (enemyIndex >= 0) {
    const enemy = newEnemies[enemyIndex];
    const newHp = Math.max(0, enemy.hp - damage);
    
    // 깊은 복사
    newEnemies[enemyIndex] = {
      ...enemy,
      hp: newHp,
      isAlive: newHp > 0
    };
    
    newLog.push(`${companionName}이(가) ${enemy.name}에게 ${damage} 데미지! (${newHp}/${enemy.maxHp})`);
    
    if (newHp <= 0) {
      newLog.push(`${enemy.name}을(를) 물리쳤습니다!`);
      if (speedBarIntervalsRef.current[`enemy_${enemy.id}`]) {
        clearInterval(speedBarIntervalsRef.current[`enemy_${enemy.id}`]);
        delete speedBarIntervalsRef.current[`enemy_${enemy.id}`];
      }
    }
  }

  return { damage, enemies: newEnemies };
};

