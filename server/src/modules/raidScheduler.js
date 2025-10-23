// 레이드 자동 소환 스케줄러 모듈
class RaidScheduler {
  constructor(raidSystem, io) {
    this.raidSystem = raidSystem;
    this.io = io;
    this.scheduledJobs = new Map();
    this.isRunning = false;
  }

  // 한국시간 기준으로 다음 레이드 시간 계산 (오후 12시 또는 오후 6시)
  getNextRaidTimeKST() {
    const now = new Date();
    
    // 한국시간으로 변환 (UTC+9)
    const kstOffset = 9 * 60; // 9시간을 분으로 변환
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const kst = new Date(utc + (kstOffset * 60000));
    
    // 오후 12시와 오후 6시 시간 계산
    const noon = new Date(kst);
    noon.setHours(12, 0, 0, 0);
    
    const sixPM = new Date(kst);
    sixPM.setHours(18, 0, 0, 0);
    
    // 다음 레이드 시간 결정
    let nextRaidTime;
    
    if (kst < noon) {
      // 오전이면 오늘 오후 12시
      nextRaidTime = noon;
    } else if (kst < sixPM) {
      // 오후 12시~6시 사이면 오늘 오후 6시
      nextRaidTime = sixPM;
    } else {
      // 오후 6시 이후면 내일 오후 12시
      nextRaidTime = new Date(kst);
      nextRaidTime.setDate(nextRaidTime.getDate() + 1);
      nextRaidTime.setHours(12, 0, 0, 0);
    }
    
    // UTC로 다시 변환하여 반환
    const utcRaidTime = new Date(nextRaidTime.getTime() - (kstOffset * 60000));
    return utcRaidTime;
  }

  // 모든 레이드 보스 자동 소환
  async summonAllRaids() {
    try {
      console.log('🕛 [RaidScheduler] 자동 레이드 소환 시작...');
      
      const bossTypes = ['beginner', 'intermediate', 'advanced'];
      const results = [];
      
      for (const bossType of bossTypes) {
        try {
          // 이미 활성화된 보스가 있는지 확인
          if (this.raidSystem.isRaidActive(bossType)) {
            console.log(`[RaidScheduler] ${bossType} 보스가 이미 활성화되어 있습니다.`);
            continue;
          }
          
          // 보스 소환
          const boss = this.raidSystem.summonBoss(bossType);
          results.push({
            bossType,
            success: true,
            bossName: boss.name,
            hp: boss.hp
          });
          
          console.log(`[RaidScheduler] ${boss.name} 소환 완료 (체력: ${boss.hp})`);
          
        } catch (error) {
          console.error(`[RaidScheduler] ${bossType} 보스 소환 실패:`, error.message);
          results.push({
            bossType,
            success: false,
            error: error.message
          });
        }
      }
      
      // 클라이언트에 레이드 소환 알림 전송 (구독자에게만)
      this.io.to('raid-auto-summon').emit('raidAutoSummoned', {
        timestamp: new Date().toISOString(),
        results: results
      });
      
      console.log('🕛 [RaidScheduler] 자동 레이드 소환 완료');
      return results;
      
    } catch (error) {
      console.error('[RaidScheduler] 자동 레이드 소환 중 오류:', error);
      throw error;
    }
  }

  // 스케줄러 시작
  start() {
    if (this.isRunning) {
      console.log('[RaidScheduler] 스케줄러가 이미 실행 중입니다.');
      return;
    }
    
    this.isRunning = true;
    console.log('🕛 [RaidScheduler] 레이드 자동 소환 스케줄러 시작 (오후 12시, 오후 6시)');
    
    // 다음 레이드 시간 계산
    this.scheduleNextRaid();
  }

  // 다음 레이드 시간에 소환 스케줄 설정 (오후 12시 또는 오후 6시)
  scheduleNextRaid() {
    // 다음 레이드 시간 계산
    const nextRaidTime = this.getNextRaidTimeKST();
    const timeUntilRaid = nextRaidTime.getTime() - Date.now();
    
    console.log(`[RaidScheduler] 다음 자동 소환 시간: ${nextRaidTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
    console.log(`[RaidScheduler] 남은 시간: ${Math.round(timeUntilRaid / 1000 / 60)}분`);
    
    // 기존 타이머가 있다면 취소
    if (this.scheduledJobs.has('nextRaid')) {
      clearTimeout(this.scheduledJobs.get('nextRaid'));
    }
    
    // 다음 레이드 시간에 실행할 타이머 설정
    const raidTimeout = setTimeout(async () => {
      // 레이드 소환 실행
      await this.summonAllRaids();
      
      // 다음 레이드 스케줄 설정
      this.scheduleNextRaid();
    }, timeUntilRaid);
    
    this.scheduledJobs.set('nextRaid', raidTimeout);
  }

  // 스케줄러 중지
  stop() {
    if (!this.isRunning) {
      console.log('[RaidScheduler] 스케줄러가 실행 중이 아닙니다.');
      return;
    }
    
    this.isRunning = false;
    
    // 모든 예약된 작업 취소
    for (const [name, job] of this.scheduledJobs) {
      if (name.includes('timeout')) {
        clearTimeout(job);
      } else if (name.includes('interval')) {
        clearInterval(job);
      }
    }
    
    this.scheduledJobs.clear();
    console.log('🕛 [RaidScheduler] 레이드 자동 소환 스케줄러 중지');
  }

  // 스케줄러 상태 반환
  getStatus() {
    return {
      isRunning: this.isRunning,
      scheduledJobs: Array.from(this.scheduledJobs.keys()),
      nextRaidTime: this.getNextRaidTimeKST().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    };
  }

  // 수동으로 즉시 모든 레이드 소환 (테스트용)
  async triggerManualSummon() {
    console.log('🕛 [RaidScheduler] 수동 레이드 소환 실행');
    return await this.summonAllRaids();
  }
}

module.exports = RaidScheduler;
