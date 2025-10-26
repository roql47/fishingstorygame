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
    
    // 현재 시간을 한국 시간으로 변환
    const kstTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    
    // 오늘 오후 12시 (KST)
    const noon = new Date(kstTime);
    noon.setHours(12, 0, 0, 0);
    
    // 오늘 오후 6시 (KST)
    const sixPM = new Date(kstTime);
    sixPM.setHours(18, 0, 0, 0);
    
    // 내일 오후 12시 (KST)
    const tomorrowNoon = new Date(kstTime);
    tomorrowNoon.setDate(tomorrowNoon.getDate() + 1);
    tomorrowNoon.setHours(12, 0, 0, 0);
    
    // 다음 레이드 시간 결정
    let nextRaidTimeKST;
    
    if (kstTime < noon) {
      // 오전이면 오늘 오후 12시
      nextRaidTimeKST = noon;
    } else if (kstTime < sixPM) {
      // 오후 12시~6시 사이면 오늘 오후 6시
      nextRaidTimeKST = sixPM;
    } else {
      // 오후 6시 이후면 내일 오후 12시
      nextRaidTimeKST = tomorrowNoon;
    }
    
    // 현재 시간과의 차이를 계산해서 실제 실행 시간 반환
    const kstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const timeDiff = nextRaidTimeKST.getTime() - kstNow.getTime();
    return new Date(Date.now() + timeDiff);
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
    let timeUntilRaid = nextRaidTime.getTime() - Date.now();
    
    // 음수 시간이면 즉시 실행 (1초 후)
    if (timeUntilRaid < 0) {
      console.log('[RaidScheduler] ⚠️ 계산된 시간이 과거입니다. 즉시 레이드를 소환합니다.');
      timeUntilRaid = 1000; // 1초 후 실행
    }
    
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
