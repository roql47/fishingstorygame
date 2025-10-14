// 레이드 시스템 모듈
class RaidSystem {
  constructor() {
    // 3개의 독립적인 레이드 보스 인스턴스
    this.raidBosses = {
      'beginner': null,
      'intermediate': null,
      'advanced': null
    };
    
    // 보스 타입별 로그
    this.raidLogs = {
      'beginner': [],
      'intermediate': [],
      'advanced': []
    };
    
    // 보스 타입별 설정
    this.bossTypes = {
      'beginner': {
        name: '마르가글레숨',
        hp: 8000,
        requiredSkill: { min: 1, max: 10 },
        rewards: {
          rank1: 300,
          rank2: 200,
          rank3: 150,
          rank4: 100,
          rank5: 80,
          others: 50
        }
      },
      'intermediate': {
        name: '운다발레나',
        hp: 15000,
        requiredSkill: { min: 11, max: 20 },
        rewards: {
          rank1: 500,
          rank2: 350,
          rank3: 250,
          rank4: 180,
          rank5: 130,
          others: 80
        }
      },
      'advanced': {
        name: '폭주하는 해신',
        hp: 30000,
        requiredSkill: { min: 21, max: 999 },
        rewards: {
          rank1: 800,
          rank2: 600,
          rank3: 450,
          rank4: 320,
          rank5: 230,
          others: 150
        }
      }
    };
  }

  // 레이드 보스 소환 (보스 타입별 독립적인 인스턴스)
  summonBoss(bossType = 'beginner') {
    const bossConfig = this.bossTypes[bossType];
    if (!bossConfig) {
      throw new Error(`알 수 없는 보스 타입: ${bossType}`);
    }

    // 이미 해당 타입의 보스가 활성화되어 있는지 확인
    if (this.raidBosses[bossType] && this.raidBosses[bossType].isActive) {
      throw new Error(`${bossConfig.name} 레이드가 이미 활성화되어 있습니다.`);
    }

    // 고정된 체력 사용 (체력 증가율 제거)
    const hp = bossConfig.hp;

    this.raidBosses[bossType] = {
      name: bossConfig.name,
      bossType: bossType,
      hp: hp,
      maxHp: hp,
      isActive: true,
      participants: new Map(),
      startTime: Date.now(),
      requiredSkill: bossConfig.requiredSkill
    };

    this.raidLogs[bossType] = [];
    console.log(`[Raid] 레이드 보스 소환 - ${bossConfig.name} (타입: ${bossType}) 체력: ${hp}`);
    return this.raidBosses[bossType];
  }

  // 레이드 보스 공격 (보스 타입별)
  attackBoss(bossType, userUuid, username, finalDamage = 1) {
    const raidBoss = this.raidBosses[bossType];
    
    if (!raidBoss || !raidBoss.isActive) {
      throw new Error(`활성화된 ${this.bossTypes[bossType]?.name || '레이드 보스'}가 없습니다.`);
    }

    // 이미 계산된 최종 데미지를 그대로 사용 (탐사 전투와 동일)
    const damage = Math.max(1, finalDamage);
    
    console.log(`[Raid][${bossType}] ${username} 최종 데미지:`, damage);

    // 참가자 데미지 누적
    const currentDamage = raidBoss.participants.get(userUuid) || 0;
    raidBoss.participants.set(userUuid, currentDamage + damage);

    // 참가자 닉네임 정보 저장 (Map으로 관리)
    if (!raidBoss.participantNames) {
      raidBoss.participantNames = new Map();
    }
    raidBoss.participantNames.set(userUuid, username);

    // 보스 체력 감소
    raidBoss.hp = Math.max(0, raidBoss.hp - damage);

    // 전투 로그 추가
    const log = {
      id: Date.now() + Math.random(), // 고유 ID
      username,
      userUuid,
      damage,
      timestamp: new Date().toISOString()
    };
    this.raidLogs[bossType].push(log);

    return { damage, log, isDefeated: raidBoss.hp <= 0 };
  }

  // 레이드 보스 처치 시 보상 계산 (보스 타입별)
  calculateRewards(bossType) {
    const raidBoss = this.raidBosses[bossType];
    
    if (!raidBoss || raidBoss.hp > 0) {
      return [];
    }

    // 데미지 순위 계산
    const participants = Array.from(raidBoss.participants.entries())
      .map(([userUuid, damage]) => ({ 
        userUuid, 
        damage,
        username: raidBoss.participantNames?.get(userUuid) || 'Unknown'
      }))
      .sort((a, b) => b.damage - a.damage);

    // 마지막 공격자 찾기
    const logs = this.raidLogs[bossType];
    const lastAttacker = logs[logs.length - 1]?.userUuid;

    // 보스 타입별 보상 설정 가져오기
    const bossConfig = this.bossTypes[bossType];
    const rewardConfig = bossConfig.rewards;

    // 보상 계산
    const rewards = [];
    for (let i = 0; i < participants.length; i++) {
      const { userUuid, damage, username } = participants[i];
      let rewardAmount = 0;

      // 순위별 호박석 보상 (난이도별 차등 지급)
      if (i === 0) rewardAmount = rewardConfig.rank1; // 1위
      else if (i === 1) rewardAmount = rewardConfig.rank2; // 2위
      else if (i === 2) rewardAmount = rewardConfig.rank3; // 3위
      else if (i === 3) rewardAmount = rewardConfig.rank4; // 4위
      else if (i === 4) rewardAmount = rewardConfig.rank5; // 5위
      else rewardAmount = rewardConfig.others; // 6위 이하

      rewards.push({ 
        userUuid, 
        username,
        damage, 
        rank: i + 1, 
        reward: rewardAmount,
        isLastAttacker: userUuid === lastAttacker,
        bossType: bossType
      });
    }

    return rewards;
  }

  // 레이드 상태 초기화 (보스 타입별)
  resetRaid(bossType) {
    this.raidBosses[bossType] = null;
    this.raidLogs[bossType] = [];
  }

  // 현재 레이드 상태 반환 (보스 타입별)
  getRaidStatus(bossType) {
    return {
      boss: this.raidBosses[bossType],
      logs: (this.raidLogs[bossType] || []).slice(-20) // 최근 20개 로그만
    };
  }
  
  // 모든 레이드 상태 반환
  getAllRaidStatus() {
    return {
      beginner: this.getRaidStatus('beginner'),
      intermediate: this.getRaidStatus('intermediate'),
      advanced: this.getRaidStatus('advanced')
    };
  }

  // 레이드가 활성화되어 있는지 확인 (보스 타입별)
  isRaidActive(bossType) {
    return this.raidBosses[bossType] && this.raidBosses[bossType].isActive;
  }
  
  // 특정 보스 가져오기
  getBoss(bossType) {
    return this.raidBosses[bossType];
  }
}

module.exports = RaidSystem;
