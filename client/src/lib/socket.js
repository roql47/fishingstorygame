import { io } from "socket.io-client";

// 프로덕션 환경에서는 현재 도메인 사용 (렌더 배포 대응)
const serverUrl =
  import.meta.env.VITE_SERVER_URL ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost" 
    ? window.location.origin 
    : "http://localhost:4000");

let socket = null;
let isBackground = false;
let backgroundTimer = null;

// 백그라운드 감지 및 연결 유지
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // 백그라운드로 전환
    isBackground = true;
    console.log('📱 앱이 백그라운드로 전환됨');
    
    // 10초마다 keep-alive 전송하여 연결 유지 (더 빠른 감지)
    backgroundTimer = setInterval(() => {
      const socket = getSocket();
      if (socket && socket.connected) {
        socket.emit('keep-alive');
        console.log('📡 백그라운드 keep-alive 전송');
      }
    }, 10000);
  } else {
    // 포그라운드로 복귀
    isBackground = false;
    console.log('📱 앱이 포그라운드로 복귀');
    
    if (backgroundTimer) {
      clearInterval(backgroundTimer);
      backgroundTimer = null;
    }
    
    // 연결 상태 확인 및 재연결
    const socket = getSocket();
    if (!socket.connected) {
      console.log('🔄 포그라운드 복귀 시 재연결 시도');
      socket.connect();
    }
  }
});

export function getSocket() {
  if (!socket) {
    // 🔐 JWT 토큰 가져오기
    const token = localStorage.getItem('jwtToken');
    
    socket = io(serverUrl, {
      // 🔐 JWT 인증 추가 (보안 강화)
      auth: {
        token: token || 'temp' // 토큰이 없어도 연결 허용 (재연결을 위해)
      },
      transports: ["websocket", "polling"], // websocket 우선 시도
      timeout: 20000, // 20초 연결 타임아웃
      forceNew: false, // 기존 연결 재사용
      reconnection: true, // 자동 재연결
      reconnectionAttempts: 5, // 최대 5번 재연결 시도
      reconnectionDelay: 1000, // 1초 후 재연결 시도
      reconnectionDelayMax: 5000, // 최대 5초 지연
      maxReconnectionAttempts: 5,
      randomizationFactor: 0.5,
      // 성능 최적화
      upgrade: true, // 자동 업그레이드
      rememberUpgrade: true, // 업그레이드 기억
      // 압축 설정
      compression: true,
      // 버퍼 크기
      perMessageDeflate: {
        threshold: 1024,
        concurrencyLimit: 10,
        windowBits: 13,
        memLevel: 8,
      }
    });

    // 연결 상태 로깅 (디버깅용)
    let isFirstConnection = true; // 최초 연결 여부 추적
    
    socket.on('connect', () => {
      console.log('🔌 Socket connected:', socket.id);
      
      // 🔄 재연결 시 자동으로 인증 복구 (최초 연결 제외)
      const nickname = localStorage.getItem("nickname");
      const userUuid = localStorage.getItem("userUuid");
      const idToken = localStorage.getItem("idToken");
      
      if (nickname && userUuid && !isFirstConnection) {
        console.log('🔄 Reconnected - Restoring session...');
        
        // 🔐 JWT 토큰 갱신 요청
        socket.emit("auth:refresh-token", { 
          userUuid, 
          username: nickname 
        });
        
        // 1. chat:join으로 사용자 정보 복구 (재연결 시에만)
        socket.emit("chat:join", { 
          username: nickname, 
          idToken, 
          userUuid,
          isReconnection: true // 재연결 플래그 추가
        });
        
        // 2. user-login으로 heartbeat 재시작
        socket.emit('user-login', { 
          username: nickname, 
          userUuid 
        });
      }
      
      // 최초 연결 이후에는 false로 설정
      isFirstConnection = false;
    });
    
    // 토큰 만료 에러 처리 (재연결 시 발생 가능)
    socket.on('join:error', (data) => {
      if (data.type === 'TOKEN_EXPIRED') {
        console.log('⚠️ 토큰 만료 감지 - 자동 로그아웃 처리');
        
        // 로컬스토리지 토큰 정보 삭제
        localStorage.removeItem("idToken");
        localStorage.removeItem("nickname");
        localStorage.removeItem("userUuid");
        localStorage.removeItem("jwtToken");
        
        // 페이지 리로드하여 로그인 화면으로 이동
        alert('🔐 로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
        window.location.reload();
      }
    });
    
    // 🔐 JWT 토큰 갱신 응답 처리
    socket.on("auth:token", (data) => {
      if (data.token) {
        localStorage.setItem("jwtToken", data.token);
        // Socket의 auth 정보도 업데이트
        if (socket.auth) {
          socket.auth.token = data.token;
        }
        console.log("🔐 JWT 토큰 갱신 완료");
      }
    });
    
    socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      
      // 백그라운드 탭에서 끊긴 경우 (모든 브라우저 공통)
      if (reason === 'transport close' || reason === 'ping timeout' || reason === 'client namespace disconnect') {
        console.log('⚠️ 백그라운드에서 연결이 끊겼습니다. 자동 재연결 시도 중...');
      }
    });
    
    socket.on('connect_error', (error) => {
      console.error('🚨 Socket connection error:', error);
    });
    
    socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
    });
    
    // 연결 상태 주기적 체크 (30초마다)
    setInterval(() => {
      const socket = getSocket();
      const nickname = localStorage.getItem("nickname");
      const userUuid = localStorage.getItem("userUuid");
      
      if (socket && socket.connected && nickname && userUuid) {
        // 서버에 연결 상태 확인 요청
        socket.emit('check:connection-status', { userUuid });
      }
    }, 30000);
    
    // 서버 응답에서 명단에 없다고 하면 자동 재가입
    socket.on('connection:not-registered', () => {
      const nickname = localStorage.getItem("nickname");
      const userUuid = localStorage.getItem("userUuid");
      const idToken = localStorage.getItem("idToken");
      
      console.log('⚠️ 명단에서 사라짐 감지 - 자동 재가입');
      socket.emit("chat:join", { 
        username: nickname, 
        idToken, 
        userUuid,
        isReconnection: true 
      });
    });
    
    // 서버에서 보낸 ping에 응답
    socket.on('server-ping', () => {
      socket.emit('client-pong');
    });

    // 🕛 레이드 자동 소환 알림 구독 요청
    socket.emit('raid:auto-summon:subscribe');

    // 🕛 레이드 자동 소환 알림 구독
    socket.on('raidAutoSummoned', (data) => {
      console.log('🕛 레이드 자동 소환 알림:', data);
      
      // 브라우저 알림 표시
      if (Notification.permission === 'granted') {
        const notification = new Notification('🎣 레이드 보스 소환!', {
          body: '새로운 레이드 보스가 소환되었습니다!',
          icon: '/vite.svg',
          tag: 'raid-summon'
        });
        
        // 5초 후 자동 닫기
        setTimeout(() => notification.close(), 5000);
      }
      
      // 페이지에 토스트 메시지 표시 (선택사항)
      if (window.showToast) {
        window.showToast('🎣 레이드 보스가 자동으로 소환되었습니다!', 'success');
      }
    });

    // 🕛 브라우저 알림 권한 요청
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          console.log('🕛 레이드 알림 권한이 허용되었습니다.');
        }
      });
    }
  }
  return socket;
}

// 사용자 로그인 정보를 서버로 전송 (IP 수집용)
export function notifyUserLogin(username, userUuid) {
  const socket = getSocket();
  if (socket && username && userUuid) {
    socket.emit('user-login', { username, userUuid });
    console.log(`📡 Sent user login info to server: ${username} (${userUuid})`);
  }
}