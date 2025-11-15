// 동료 스킬 시스템
import { COMPANION_DATA, calculateCompanionStats } from '../../data/companionData';

/**
 * 체력이 가장 낮은 아군을 찾는 함수
 * @param {Object} battleState - 현재 전투 상태
 * @returns {string|null} - 대상 이름 ('player' 또는 동료 이름)
 */
export const findLowestHpTarget = (battleState) => {
  let lowestHpTarget = null;
  let lowestHpPercentage = 1.0;
  
  // 플레이어 체력 확인 (체력이 100%인 경우 제외)
  const playerHpPercentage = battleState.playerHp / battleState.playerMaxHp;
  if (playerHpPercentage < lowestHpPercentage && playerHpPercentage < 1.0) {
    lowestHpPercentage = playerHpPercentage;
    lowestHpTarget = 'player';
  }
  
  // 동료들 체력 확인 (체력이 100%인 경우 제외)
  if (battleState.companions) {
    battleState.companions.forEach(companion => {
      if (battleState.companionHp?.[companion] && battleState.companionHp[companion].hp > 0) {
        const companionHpPercentage = battleState.companionHp[companion].hp / battleState.companionHp[companion].maxHp;
        if (companionHpPercentage < lowestHpPercentage && companionHpPercentage < 1.0) {
          lowestHpPercentage = companionHpPercentage;
          lowestHpTarget = companion;
        }
      }
    });
  }
  
  return lowestHpTarget;
};

/**
 * 힐링 스킬을 처리하는 함수
 * @param {Object} params - 힐링 파라미터
 * @returns {Object} - 업데이트된 전투 상태
 */
export const processHealingSkill = ({
  battleState,
  companionName,
  companionLevel,
  baseAttack,
  skill,
  companionMorale,
  companionBuffs
}) => {
  const healAmount = Math.floor(baseAttack * skill.healMultiplier);
  let newPlayerHp = battleState.playerHp;
  const newCompanionHp = { ...battleState.companionHp };
  let newLog = [...battleState.log];
  
  // 스킬 사용 후 사기 초기화
  const newCompanionMorale = { ...companionMorale };
  newCompanionMorale[companionName].morale = 0;
  
  // 체력이 가장 낮은 아군 찾기
  const lowestHpTarget = findLowestHpTarget(battleState);
  
  // 힐링 적용
  if (lowestHpTarget === 'player') {
    const healedAmount = Math.min(healAmount, battleState.playerMaxHp - battleState.playerHp);
    newPlayerHp = Math.min(battleState.playerMaxHp, battleState.playerHp + healAmount);
    newLog.push(`${companionName}(Lv.${companionLevel})이(가) 스킬 '${skill.name}'을(를) 사용했습니다!`);
    newLog.push(`💚 플레이어가 ${healedAmount} 체력을 회복했습니다! (${newPlayerHp}/${battleState.playerMaxHp})`);
  } else if (lowestHpTarget && newCompanionHp[lowestHpTarget]) {
    const currentHp = newCompanionHp[lowestHpTarget].hp;
    const maxHp = newCompanionHp[lowestHpTarget].maxHp;
    const healedAmount = Math.min(healAmount, maxHp - currentHp);
    newCompanionHp[lowestHpTarget] = {
      ...newCompanionHp[lowestHpTarget],
      hp: Math.min(maxHp, currentHp + healAmount)
    };
    newLog.push(`${companionName}(Lv.${companionLevel})이(가) 스킬 '${skill.name}'을(를) 사용했습니다!`);
    newLog.push(`💚 ${lowestHpTarget}이(가) ${healedAmount} 체력을 회복했습니다! (${newCompanionHp[lowestHpTarget].hp}/${maxHp})`);
  } else {
    newLog.push(`${companionName}(Lv.${companionLevel})이(가) 스킬 '${skill.name}'을(를) 사용했습니다!`);
    newLog.push(`💚 모든 아군의 체력이 가득합니다!`);
  }
  
  return {
    playerHp: newPlayerHp,
    companionHp: newCompanionHp,
    log: newLog,
    companionMorale: newCompanionMorale,
    companionBuffs
  };
};

/**
 * 랜덤 힐링 스킬을 처리하는 함수 (다중 타겟 가능)
 * @param {Object} params - 힐링 파라미터
 * @returns {Object} - 업데이트된 전투 상태
 */
export const processRandomHealingSkill = ({
  battleState,
  companionName,
  companionLevel,
  baseAttack,
  skill,
  companionMorale,
  companionBuffs
}) => {
  const healAmount = Math.floor(baseAttack * skill.healMultiplier);
  let newPlayerHp = battleState.playerHp;
  const newCompanionHp = { ...battleState.companionHp };
  let newLog = [...battleState.log];
  
  // 스킬 사용 후 사기 초기화
  const newCompanionMorale = { ...companionMorale };
  newCompanionMorale[companionName].morale = 0;
  
  // 회복 가능한 타겟 목록 생성 (플레이어 포함)
  const healableTargets = [];
  
  // 플레이어가 회복 가능하면 추가
  if (battleState.playerHp < battleState.playerMaxHp) {
    healableTargets.push({ type: 'player', key: 'player' });
  }
  
  // 동료들 중 회복 가능한 대상 추가
  Object.keys(newCompanionHp).forEach(key => {
    const companion = newCompanionHp[key];
    if (companion.hp > 0 && companion.hp < companion.maxHp) {
      healableTargets.push({ type: 'companion', key: key });
    }
  });
  
  newLog.push(`${companionName}(Lv.${companionLevel})이(가) 스킬 '${skill.name}'을(를) 사용했습니다!`);
  
  // 랜덤 타겟 선택 (다중 타겟 지원)
  const targetCount = skill.targetCount || 1;
  if (healableTargets.length > 0) {
    const actualTargetCount = Math.min(targetCount, healableTargets.length);
    const selectedTargets = [];
    
    // 중복 없이 랜덤 타겟 선택
    for (let i = 0; i < actualTargetCount; i++) {
      const availableTargets = healableTargets.filter(t => !selectedTargets.includes(t));
      if (availableTargets.length > 0) {
        const randomTarget = availableTargets[Math.floor(Math.random() * availableTargets.length)];
        selectedTargets.push(randomTarget);
      }
    }
    
    // 각 타겟에 힐링 적용
    selectedTargets.forEach(randomTarget => {
      if (randomTarget.type === 'player') {
        const healedAmount = Math.min(healAmount, battleState.playerMaxHp - newPlayerHp);
        newPlayerHp = Math.min(battleState.playerMaxHp, newPlayerHp + healAmount);
        newLog.push(`💚 플레이어가 ${healedAmount} 체력을 회복했습니다! (${newPlayerHp}/${battleState.playerMaxHp})`);
      } else {
        const targetKey = randomTarget.key;
        const currentHp = newCompanionHp[targetKey].hp;
        const maxHp = newCompanionHp[targetKey].maxHp;
        const healedAmount = Math.min(healAmount, maxHp - currentHp);
        newCompanionHp[targetKey] = {
          ...newCompanionHp[targetKey],
          hp: Math.min(maxHp, currentHp + healAmount)
        };
        newLog.push(`💚 ${targetKey}이(가) ${healedAmount} 체력을 회복했습니다! (${newCompanionHp[targetKey].hp}/${maxHp})`);
      }
    });
  } else {
    newLog.push(`💚 모든 아군의 체력이 가득합니다!`);
  }
  
  return {
    playerHp: newPlayerHp,
    companionHp: newCompanionHp,
    log: newLog,
    companionMorale: newCompanionMorale,
    companionBuffs
  };
};

/**
 * 버프 스킬을 처리하는 함수
 * @param {Object} params - 버프 파라미터
 * @returns {Object} - 업데이트된 전투 상태와 데미지 정보
 */
export const processBuffSkill = ({
  battleState,
  companionName,
  companionLevel,
  baseAttack,
  skill,
  companionMorale,
  companionBuffs,
  calculateCriticalHit
}) => {
  const baseDamage = Math.floor(baseAttack * (skill.damageMultiplier || 1.0) * (0.9 + Math.random() * 0.2));
  const criticalResult = calculateCriticalHit(baseDamage, 0.05, companionName, companionBuffs);
  const damage = criticalResult.damage;
  const isCritical = criticalResult.isCritical;
  
  // 버프 적용
  const newCompanionBuffs = { ...companionBuffs };
  if (!newCompanionBuffs[companionName]) {
    newCompanionBuffs[companionName] = {};
  }
  newCompanionBuffs[companionName][skill.buffType] = {
    multiplier: skill.buffMultiplier,
    duration: skill.buffDuration,
    turnsLeft: skill.buffDuration
  };
  
  // 스킬 사용 후 사기 초기화
  const newCompanionMorale = { ...companionMorale };
  newCompanionMorale[companionName].morale = 0;
  
  const newEnemyHp = Math.max(0, battleState.enemyHp - damage);
  let newLog = [...battleState.log];
  
  const skillMessage = isCritical ? 
    `💥 크리티컬! ${companionName}(Lv.${companionLevel})이(가) 스킬 '${skill.name}'을(를) 사용했습니다!` : 
    `${companionName}(Lv.${companionLevel})이(가) 스킬 '${skill.name}'을(를) 사용했습니다!`;
  newLog.push(skillMessage);
  
  // 스킬 타입에 따른 버프 메시지
  if (skill.buffType === 'attack') {
    newLog.push(`🔥 3턴 동안 공격력이 25% 상승합니다!`);
  } else if (skill.buffType === 'critical') {
    newLog.push(`🎯 3턴 동안 크리티컬 확률이 20% 상승합니다!`);
  } else if (skill.buffType === 'damage_reduction') {
    newLog.push(`🛡️ 2턴 동안 아군 전체가 받는 데미지가 30% 감소합니다!`);
  } else if (skill.buffType === 'speed_boost') {
    newLog.push(`💨 5초 동안 아군의 속도가 2배로 증가합니다!`);
  }
  
  if (damage > 0) {
    newLog.push(`💥 ${damage} 데미지! (${battleState.enemy}: ${newEnemyHp}/${battleState.enemyMaxHp})`);
  }
  
  return {
    damage,
    isCritical,
    enemyHp: newEnemyHp,
    log: newLog,
    companionMorale: newCompanionMorale,
    companionBuffs: newCompanionBuffs
  };
};

/**
 * 데미지 스킬을 처리하는 함수
 * @param {Object} params - 데미지 파라미터
 * @returns {Object} - 업데이트된 전투 상태와 데미지 정보
 */
export const processDamageSkill = ({
  battleState,
  companionName,
  companionLevel,
  baseAttack,
  skill,
  companionMorale,
  companionBuffs,
  calculateCriticalHit
}) => {
  const baseDamage = Math.floor(baseAttack * skill.damageMultiplier * (0.9 + Math.random() * 0.2));
  const criticalResult = calculateCriticalHit(baseDamage, 0.05, companionName, companionBuffs);
  const damage = criticalResult.damage;
  const isCritical = criticalResult.isCritical;
  
  // 스킬 사용 후 사기 초기화
  const newCompanionMorale = { ...companionMorale };
  newCompanionMorale[companionName].morale = 0;
  
  const newEnemyHp = Math.max(0, battleState.enemyHp - damage);
  let newLog = [...battleState.log];
  
  const skillMessage = isCritical ? 
    `💥 크리티컬! ${companionName}(Lv.${companionLevel})이(가) 스킬 '${skill.name}'을(를) 사용했습니다!` : 
    `${companionName}(Lv.${companionLevel})이(가) 스킬 '${skill.name}'을(를) 사용했습니다!`;
  newLog.push(skillMessage);
  newLog.push(`💥 ${damage} 데미지! (${battleState.enemy}: ${newEnemyHp}/${battleState.enemyMaxHp})`);
  
  return {
    damage,
    isCritical,
    enemyHp: newEnemyHp,
    log: newLog,
    companionMorale: newCompanionMorale,
    companionBuffs
  };
};

/**
 * 다중 타겟/AOE 스킬을 처리하는 함수 (탐사 전투용)
 * @param {Object} params - 스킬 파라미터
 * @returns {Object} - 업데이트된 전투 상태와 데미지 정보
 */
export const processMultiTargetSkill = ({
  battleState,
  companionName,
  companionLevel,
  baseAttack,
  skill,
  companionMorale,
  companionBuffs,
  calculateCriticalHit
}) => {
  // 스킬 사용 후 사기 초기화
  const newCompanionMorale = { ...companionMorale };
  newCompanionMorale[companionName].morale = 0;
  
  let newLog = [...battleState.log];
  
  const skillMessage = `🌿 ${companionName}이(가) ${skill.name}을(를) 사용!`;
  newLog.push(skillMessage);
  
  // 다중 타겟 스킬 설명 추가
  if (skill.skillType === 'aoe') {
    newLog.push(`🌪️ 전체공격! 모든 적에게 데미지를 입힙니다!`);
  } else if (skill.skillType === 'multi_target') {
    newLog.push(`🎯 최대 ${skill.targetCount}명의 적을 동시에 공격합니다!`);
  }
  
  // 살아있는 적들 찾기
  const aliveEnemies = battleState.enemies.filter(e => e.isAlive);
  
  // 타겟 수 결정 (AOE는 모든 적, multi_target은 지정된 수만큼)
  const targetCount = skill.skillType === 'aoe' ? aliveEnemies.length : Math.min(skill.targetCount || 2, aliveEnemies.length);
  
  // 타겟 선택 (랜덤으로 선택)
  const targets = [];
  const availableTargets = [...aliveEnemies];
  for (let i = 0; i < targetCount && availableTargets.length > 0; i++) {
    const randomIndex = Math.floor(Math.random() * availableTargets.length);
    targets.push(availableTargets[randomIndex]);
    availableTargets.splice(randomIndex, 1);
  }
  
  // 새로운 enemies 배열 생성
  const newEnemies = [...battleState.enemies];
  let killCount = 0; // 처치한 적 수 추적
  
  // 각 타겟에게 데미지 적용
  targets.forEach(target => {
    const baseDamage = Math.floor(baseAttack * skill.damageMultiplier * (0.9 + Math.random() * 0.2));
    const criticalResult = calculateCriticalHit(baseDamage, 0.05, companionName, companionBuffs);
    const damage = criticalResult.damage;
    const isCritical = criticalResult.isCritical;
    
    // 적의 체력 감소
    const enemyIndex = newEnemies.findIndex(e => e.id === target.id);
    if (enemyIndex !== -1) {
      newEnemies[enemyIndex] = {
        ...newEnemies[enemyIndex],
        hp: Math.max(0, newEnemies[enemyIndex].hp - damage)
      };
      
      const criticalText = isCritical ? '💥 크리티컬! ' : '';
      newLog.push(`${criticalText}${target.name}에게 ${damage} 데미지! (${newEnemies[enemyIndex].hp}/${newEnemies[enemyIndex].maxHp})`);
      
      // 적이 죽었는지 확인
      if (newEnemies[enemyIndex].hp <= 0) {
        newEnemies[enemyIndex].isAlive = false;
        newLog.push(`${target.name}을(를) 물리쳤습니다!`);
        killCount++; // 처치 카운트 증가
      }
    }
  });
  
  // 적 처치 시 사기 증가 (onKillMoraleGain 스킬 속성)
  if (killCount > 0 && skill.onKillMoraleGain) {
    const moraleGain = skill.onKillMoraleGain * killCount;
    newCompanionMorale[companionName].morale = Math.min(100, newCompanionMorale[companionName].morale + moraleGain);
    newLog.push(`⚡ ${companionName}의 사기가 ${moraleGain} 증가했습니다! (${newCompanionMorale[companionName].morale}/100)`);
  }
  
  return {
    enemies: newEnemies,
    log: newLog,
    companionMorale: newCompanionMorale,
    companionBuffs
  };
};

/**
 * 동료의 스킬 사용을 처리하는 메인 함수
 * @param {Object} params - 스킬 처리 파라미터
 * @returns {Object} - 업데이트된 전투 상태
 */
export const processCompanionSkill = ({
  battleState,
  companionName,
  companionStats,
  companionMorale,
  companionBuffs,
  calculateCriticalHit,
  nextTurn
}) => {
  const companionStat = companionStats[companionName];
  const companionLevel = companionStat?.level || 1;
  const tier = companionStat?.tier || 0;
  const breakthrough = companionStat?.breakthrough || 0;
  const breakthroughStats = companionStat?.breakthroughStats || { bonusGrowthHp: 0, bonusGrowthAttack: 0, bonusGrowthSpeed: 0 };
  const companionData = calculateCompanionStats(companionName, companionLevel, tier, breakthrough, breakthroughStats);
  const companionBaseData = COMPANION_DATA[companionName];
  
  if (!companionBaseData?.skill) {
    return null; // 스킬이 없는 동료
  }
  
  const baseAttack = companionData?.attack || 25;
  const skill = companionData?.skill || companionBaseData.skill; // 강화된 스킬 사용
  
  // 스킬 타입에 따른 처리
  if (skill.skillType === 'heal') {
    // 힐링 스킬 처리 (체력이 가장 낮은 아군)
    const result = processHealingSkill({
      battleState,
      companionName,
      companionLevel,
      baseAttack,
      skill,
      companionMorale,
      companionBuffs
    });
    
    return nextTurn({
      ...battleState,
      playerHp: result.playerHp,
      companionHp: result.companionHp,
      log: result.log,
      companionMorale: result.companionMorale,
      companionBuffs: result.companionBuffs
    });
  } else if (skill.skillType === 'heal_random') {
    // 랜덤 힐링 스킬 처리
    const result = processRandomHealingSkill({
      battleState,
      companionName,
      companionLevel,
      baseAttack,
      skill,
      companionMorale,
      companionBuffs
    });
    
    return nextTurn({
      ...battleState,
      playerHp: result.playerHp,
      companionHp: result.companionHp,
      log: result.log,
      companionMorale: result.companionMorale,
      companionBuffs: result.companionBuffs
    });
  } else if (skill.skillType === 'multi_target' || skill.skillType === 'aoe') {
    // 다중 타겟/AOE 스킬 처리
    const result = processMultiTargetSkill({
      battleState,
      companionName,
      companionLevel,
      baseAttack,
      skill,
      companionMorale,
      companionBuffs,
      calculateCriticalHit
    });
    
    // result가 없거나 enemies가 없으면 null 반환 (폴백 로직 사용)
    if (!result || !result.enemies) {
      return null;
    }
    
    // 모든 적이 죽었는지 확인
    const allEnemiesDead = result.enemies.every(e => !e.isAlive);
    
    if (allEnemiesDead) {
      // 승리 처리는 기존 로직 사용
      return null; // App.jsx의 승리 처리 로직으로 돌아감
    } else {
      return nextTurn({
        ...battleState,
        enemies: result.enemies,
        log: result.log,
        companionMorale: result.companionMorale,
        companionBuffs: result.companionBuffs
      });
    }
  } else if (skill.buffType) {
    // 버프 스킬 처리
    const result = processBuffSkill({
      battleState,
      companionName,
      companionLevel,
      baseAttack,
      skill,
      companionMorale,
      companionBuffs,
      calculateCriticalHit
    });
    
    if (result.enemyHp <= 0) {
      // 승리 처리는 기존 로직 사용
      return null; // App.jsx의 승리 처리 로직으로 돌아감
    } else {
      return nextTurn({
        ...battleState,
        enemyHp: result.enemyHp,
        log: result.log,
        companionMorale: result.companionMorale,
        companionBuffs: result.companionBuffs
      });
    }
  } else {
    // 데미지 스킬 처리
    const result = processDamageSkill({
      battleState,
      companionName,
      companionLevel,
      baseAttack,
      skill,
      companionMorale,
      companionBuffs,
      calculateCriticalHit
    });
    
    if (result.enemyHp <= 0) {
      // 승리 처리는 기존 로직 사용
      return null; // App.jsx의 승리 처리 로직으로 돌아감
    } else {
      return nextTurn({
        ...battleState,
        enemyHp: result.enemyHp,
        log: result.log,
        companionMorale: result.companionMorale,
        companionBuffs: result.companionBuffs
      });
    }
  }
};

/**
 * 동료가 스킬을 사용할 수 있는지 확인하는 함수
 * @param {string} companionName - 동료 이름
 * @param {Object} companionMorale - 동료 사기 상태
 * @returns {boolean} - 스킬 사용 가능 여부
 */
export const canUseCompanionSkill = (companionName, companionMorale) => {
  const companionBaseData = COMPANION_DATA[companionName];
  if (!companionBaseData?.skill) return false;
  
  const currentMorale = companionMorale[companionName]?.morale || 0;
  return currentMorale >= (companionBaseData.skill.moraleRequired || 100);
};
