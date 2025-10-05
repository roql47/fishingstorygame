import { io } from "socket.io-client";

const serverUrl =
  import.meta.env.VITE_SERVER_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:4000");

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(serverUrl, {
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
    socket.on('connect', () => {
      console.log('🔌 Socket connected:', socket.id);
      
      // 🔄 재연결 시 자동으로 인증 복구 (모든 브라우저 대응)
      const nickname = localStorage.getItem("nickname");
      const userUuid = localStorage.getItem("userUuid");
      const idToken = localStorage.getItem("idToken");
      
      if (nickname && userUuid) {
        console.log('🔄 Reconnected - Restoring session...');
        
        // 1. chat:join으로 사용자 정보 복구
        socket.emit("chat:join", { 
          username: nickname, 
          idToken, 
          userUuid 
        });
        
        // 2. user-login으로 heartbeat 재시작
        socket.emit('user-login', { 
          username: nickname, 
          userUuid 
        });
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
    
    // 서버에서 보낸 ping에 응답
    socket.on('server-ping', () => {
      socket.emit('client-pong');
    });
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