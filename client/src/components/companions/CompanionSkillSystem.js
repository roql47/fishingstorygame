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
  
  // 플레이어 체력 확인
  const playerHpPercentage = battleState.playerHp / battleState.playerMaxHp;
  if (playerHpPercentage < lowestHpPercentage) {
    lowestHpPercentage = playerHpPercentage;
    lowestHpTarget = 'player';
  }
  
  // 동료들 체력 확인
  if (battleState.companions) {
    battleState.companions.forEach(companion => {
      if (battleState.companionHp?.[companion] && battleState.companionHp[companion].hp > 0) {
        const companionHpPercentage = battleState.companionHp[companion].hp / battleState.companionHp[companion].maxHp;
        if (companionHpPercentage < lowestHpPercentage) {
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
    companionMorale,
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
  const companionData = calculateCompanionStats(companionName, companionLevel);
  const companionBaseData = COMPANION_DATA[companionName];
  
  if (!companionBaseData?.skill) {
    return null; // 스킬이 없는 동료
  }
  
  const baseAttack = companionData?.attack || 25;
  const skill = companionBaseData.skill;
  
  // 스킬 타입에 따른 처리
  if (skill.skillType === 'heal') {
    // 힐링 스킬 처리
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
