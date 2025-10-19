// 레이드 자동 소환 스케줄러 모듈
class RaidScheduler {
  constructor(raidSystem, io) {
    this.raidSystem = raidSystem;
    this.io = io;
    this.scheduledJobs = new Map();
    this.isRunning = false;
  }

  // 한국시간 기준으로 다음 오후 6시까지의 시간 계산
  getNext6PMKST() {
    const now = new Date();
    
    // 한국시간으로 변환 (UTC+9)
    const kstOffset = 9 * 60; // 9시간을 분으로 변환
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const kst = new Date(utc + (kstOffset * 60000));
    
    // 다음 오후 6시 계산
    const next6PM = new Date(kst);
    next6PM.setHours(18, 0, 0, 0);
    
    // 이미 오늘 오후 6시가 지났다면 내일 오후 6시로 설정
    if (kst >= next6PM) {
      next6PM.setDate(next6PM.getDate() + 1);
    }
    
    // UTC로 다시 변환하여 반환
    const utc6PM = new Date(next6PM.getTime() - (kstOffset * 60000));
    return utc6PM;
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
    console.log('🕛 [RaidScheduler] 레이드 자동 소환 스케줄러 시작');
    
    // 다음 오후 6시까지의 시간 계산
    const next6PM = this.getNext6PMKST();
    const timeUntil6PM = next6PM.getTime() - Date.now();
    
    console.log(`[RaidScheduler] 다음 자동 소환 시간: ${next6PM.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
    console.log(`[RaidScheduler] 남은 시간: ${Math.round(timeUntil6PM / 1000 / 60)}분`);
    
    // 첫 번째 오후 6시까지 타이머 설정
    const firstTimeout = setTimeout(() => {
      this.scheduleDailyRaids();
    }, timeUntil6PM);
    
    this.scheduledJobs.set('first6PM', firstTimeout);
  }

  // 매일 오후 6시에 레이드 소환하는 스케줄 설정
  scheduleDailyRaids() {
    // 즉시 한 번 실행
    this.summonAllRaids();
    
    // 매일 오후 6시(24시간마다)에 실행하는 인터벌 설정
    const dailyInterval = setInterval(() => {
      this.summonAllRaids();
    }, 24 * 60 * 60 * 1000); // 24시간 = 24 * 60 * 60 * 1000ms
    
    this.scheduledJobs.set('dailyRaids', dailyInterval);
    console.log('🕛 [RaidScheduler] 매일 오후 6시 레이드 소환 스케줄 설정 완료');
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
      next6PM: this.getNext6PMKST().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    };
  }

  // 수동으로 즉시 모든 레이드 소환 (테스트용)
  async triggerManualSummon() {
    console.log('🕛 [RaidScheduler] 수동 레이드 소환 실행');
    return await this.summonAllRaids();
  }
}

module.exports = RaidScheduler;
