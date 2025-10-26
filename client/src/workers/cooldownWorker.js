// 🚀 Web Worker for Cooldown Management
// 백그라운드에서도 정확한 쿨타임 관리를 위한 Worker

let cooldowns = {
  fishing: { endTime: null, interval: null },
  exploration: { endTime: null, interval: null },
  raid: { endTime: null, interval: null }
};

// 남은 시간 계산 함수
function calculateRemainingTime(endTime) {
  if (!endTime) return 0;
  const now = Date.now();
  const end = new Date(endTime).getTime();
  return Math.max(0, end - now);
}

// 쿨타임 업데이트 전송
function sendCooldownUpdate(type) {
  const cooldown = cooldowns[type];
  const remainingTime = calculateRemainingTime(cooldown.endTime);
  
  self.postMessage({
    type: 'cooldown_update',
    cooldownType: type,
    remainingTime: remainingTime
  });
  
  // 쿨타임이 끝났으면 interval 정리
  if (remainingTime <= 0) {
    stopCooldown(type);
  }
}

// 쿨타임 시작
function startCooldown(type, endTime) {
  // 기존 interval 정리
  stopCooldown(type);
  
  cooldowns[type].endTime = endTime;
  
  // 초기 업데이트
  sendCooldownUpdate(type);
  
  // 1초마다 업데이트 (Worker는 백그라운드에서도 정확하게 실행됨)
  cooldowns[type].interval = setInterval(() => {
    sendCooldownUpdate(type);
  }, 1000);
}

// 쿨타임 중지
function stopCooldown(type) {
  if (cooldowns[type].interval) {
    clearInterval(cooldowns[type].interval);
    cooldowns[type].interval = null;
  }
  cooldowns[type].endTime = null;
}

// 메인 스레드로부터 메시지 수신
self.addEventListener('message', (event) => {
  const { action, cooldownType, endTime } = event.data;
  
  switch (action) {
    case 'start':
      // 쿨타임 시작
      if (cooldownType && endTime) {
        startCooldown(cooldownType, endTime);
      }
      break;
      
    case 'stop':
      // 쿨타임 중지
      if (cooldownType) {
        stopCooldown(cooldownType);
        self.postMessage({
          type: 'cooldown_stopped',
          cooldownType: cooldownType
        });
      }
      break;
      
    case 'get_status':
      // 현재 상태 요청
      if (cooldownType) {
        sendCooldownUpdate(cooldownType);
      } else {
        // 모든 쿨타임 상태 전송
        Object.keys(cooldowns).forEach(type => {
          if (cooldowns[type].endTime) {
            sendCooldownUpdate(type);
          }
        });
      }
      break;
      
    case 'ping':
      // Worker 생존 확인
      self.postMessage({ type: 'pong' });
      break;
      
    default:
      break;
  }
});

// Worker 초기화 완료
self.postMessage({ 
  type: 'worker_ready'
});

