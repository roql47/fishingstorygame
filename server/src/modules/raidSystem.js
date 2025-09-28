// 레이드 시스템 모듈
class RaidSystem {
  constructor() {
    this.raidBoss = null; // { name, hp, maxHp, isActive, participants: Map<userUuid, damage> }
    this.raidLogs = [];
  }

  // 레이드 보스 소환
  summonBoss() {
    if (this.raidBoss && this.raidBoss.isActive) {
      throw new Error("레이드 보스가 이미 활성화되어 있습니다.");
    }

    this.raidBoss = {
      name: "마르가글레슘",
      hp: 12000,
      maxHp: 12000,
      isActive: true,
      participants: new Map(),
      startTime: Date.now()
    };

    this.raidLogs = [];
    return this.raidBoss;
  }

  // 레이드 보스 공격
  attackBoss(userUuid, username, finalDamage = 1) {
    if (!this.raidBoss || !this.raidBoss.isActive) {
      throw new Error("활성화된 레이드 보스가 없습니다.");
    }

    // 이미 계산된 최종 데미지를 그대로 사용 (탐사 전투와 동일)
    const damage = Math.max(1, finalDamage);
    
    console.log(`[Raid] ${username} 최종 데미지:`, damage);

    // 참가자 데미지 누적
    const currentDamage = this.raidBoss.participants.get(userUuid) || 0;
    this.raidBoss.participants.set(userUuid, currentDamage + damage);

    // 참가자 닉네임 정보 저장 (Map으로 관리)
    if (!this.raidBoss.participantNames) {
      this.raidBoss.participantNames = new Map();
    }
    this.raidBoss.participantNames.set(userUuid, username);

    // 보스 체력 감소
    this.raidBoss.hp = Math.max(0, this.raidBoss.hp - damage);

    // 전투 로그 추가
    const log = {
      id: Date.now() + Math.random(), // 고유 ID
      username,
      userUuid,
      damage,
      timestamp: new Date().toISOString()
    };
    this.raidLogs.push(log);

    return { damage, log, isDefeated: this.raidBoss.hp <= 0 };
  }

  // 레이드 보스 처치 시 보상 계산
  calculateRewards() {
    if (!this.raidBoss || this.raidBoss.hp > 0) {
      return [];
    }

    // 데미지 순위 계산
    const participants = Array.from(this.raidBoss.participants.entries())
      .map(([userUuid, damage]) => ({ 
        userUuid, 
        damage,
        username: this.raidBoss.participantNames?.get(userUuid) || 'Unknown'
      }))
      .sort((a, b) => b.damage - a.damage);

    // 마지막 공격자 찾기
    const lastAttacker = this.raidLogs[this.raidLogs.length - 1]?.userUuid;

    // 보상 계산
    const rewards = [];
    for (let i = 0; i < participants.length; i++) {
      const { userUuid, damage, username } = participants[i];
      let rewardAmount = 0;

      // 순위별 호박석 보상
      if (i === 0) rewardAmount = 300; // 1위
      else if (i === 1) rewardAmount = 200; // 2위
      else if (i === 2) rewardAmount = 150; // 3위
      else if (i === 3) rewardAmount = 100; // 4위
      else if (i === 4) rewardAmount = 80; // 5위
      else rewardAmount = 50; // 6위 이하

      // 마지막 공격자는 별도로 별조각 보상 처리 (호박석 보상에는 추가하지 않음)

      rewards.push({ 
        userUuid, 
        username,
        damage, 
        rank: i + 1, 
        reward: rewardAmount,
        isLastAttacker: userUuid === lastAttacker
      });
    }

    return rewards;
  }

  // 레이드 상태 초기화
  resetRaid() {
    this.raidBoss = null;
    this.raidLogs = [];
  }

  // 현재 레이드 상태 반환
  getRaidStatus() {
    return {
      boss: this.raidBoss,
      logs: this.raidLogs.slice(-20) // 최근 20개 로그만
    };
  }

  // 레이드가 활성화되어 있는지 확인
  isRaidActive() {
    return this.raidBoss && this.raidBoss.isActive;
  }
}

module.exports = RaidSystem;
