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
    });
    
    socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
    });
    
    socket.on('connect_error', (error) => {
      console.error('🚨 Socket connection error:', error);
    });
    
    socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
    });
  }
  return socket;
}
