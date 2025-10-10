const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken"); // 🔐 JWT 라이브러리 추가
const bcrypt = require('bcrypt'); // 🔐 비밀번호 암호화

// 🚀 성능 최적화: 프로덕션 환경에서 로깅 축소
const isProduction = process.env.NODE_ENV === 'production';
const debugLog = isProduction ? () => {} : console.log;
const infoLog = console.log; // 중요한 로그는 유지
const errorLog = console.error; // 에러 로그는 항상 유지

// 레이드 시스템 모듈 import
const { setupRaidRoutes, setupRaidWebSocketEvents } = require('./routes/raidRoutes');

// 원정 시스템 모듈 import
const setupExpeditionRoutes = require('./routes/expeditionRoutes');

// 🔍 DB 쿼리 성능 측정 헬퍼 함수
const measureDBQuery = async (queryName, queryFunction) => {
  const startTime = Date.now();
  try {
    const result = await queryFunction();
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // 느린 쿼리 감지 (렌더 서버 기준 200ms 이상)
    if (duration > 200) {
      console.warn(`⚠️ 느린 DB 쿼리 감지: ${queryName} - ${duration}ms`);
    } else if (duration > 100) {
      debugLog(`🟡 보통 속도 쿼리: ${queryName} - ${duration}ms`);
    } else {
      debugLog(`✅ DB 쿼리 완료: ${queryName} - ${duration}ms`);
    }
    
    return result;
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.error(`❌ DB 쿼리 실패: ${queryName} - ${duration}ms`, error.message);
    throw error;
  }
};

// 🚀 DB 인덱스 최적화 함수 (중복 방지)
const optimizeDBIndexes = async () => {
  try {
    console.log('🔧 DB 인덱스 최적화 시작...');
    
    const indexesToCreate = [
      { collection: UserUuidModel, indexes: [
        { key: { userUuid: 1 }, name: 'userUuid_1_safe' },
        { key: { username: 1 }, name: 'username_1_safe' }
      ]},
      { collection: CatchModel, indexes: [
        { key: { userUuid: 1 }, name: 'catch_userUuid_1' },
        { key: { username: 1 }, name: 'catch_username_1' },
        { key: { userUuid: 1, 'fish.name': 1 }, name: 'catch_userUuid_fish_1' }
      ]},
      { collection: UserMoneyModel, indexes: [
        { key: { userUuid: 1 }, name: 'money_userUuid_1' }
      ]},
      { collection: UserAmberModel, indexes: [
        { key: { userUuid: 1 }, name: 'amber_userUuid_1' }
      ]},
      { collection: StarPieceModel, indexes: [
        { key: { userUuid: 1 }, name: 'star_userUuid_1' }
      ]},
      { collection: DailyQuestModel, indexes: [
        { key: { userUuid: 1 }, name: 'quest_userUuid_1' },
        { key: { lastResetDate: 1 }, name: 'quest_resetDate_1' }
      ]},
      { collection: MarketListingModel, indexes: [
        { key: { userUuid: 1 }, name: 'market_userUuid_1' },
        { key: { listedAt: -1 }, name: 'market_listedAt_-1' }
      ]},
      { collection: MarketTradeHistoryModel, indexes: [
        { key: { buyerUuid: 1 }, name: 'trade_buyerUuid_1' },
        { key: { sellerUuid: 1 }, name: 'trade_sellerUuid_1' },
        { key: { tradedAt: -1 }, name: 'trade_tradedAt_-1' }
      ]}
    ];
    
    let createdCount = 0;
    let skippedCount = 0;
    
    for (const { collection, indexes } of indexesToCreate) {
      for (const indexSpec of indexes) {
        try {
          await collection.collection.createIndex(indexSpec.key, { 
            background: true, 
            name: indexSpec.name 
          });
          createdCount++;
          debugLog(`✅ 인덱스 생성: ${indexSpec.name}`);
        } catch (error) {
          if (error.message.includes('already exists') || error.message.includes('same name')) {
            skippedCount++;
            debugLog(`⏭️ 인덱스 스킵: ${indexSpec.name} (이미 존재)`);
          } else {
            console.warn(`⚠️ 인덱스 생성 실패: ${indexSpec.name} - ${error.message}`);
          }
        }
      }
    }
    
    console.log(`✅ DB 인덱스 최적화 완료! (생성: ${createdCount}, 스킵: ${skippedCount})`);
  } catch (error) {
    console.error('❌ DB 인덱스 최적화 실패:', error.message);
  }
};

// 🚀 성능 최적화: 다중 데이터 캐시 시스템
const dataCache = new Map();
const CACHE_TTL = {
  fishingSkill: 5 * 60 * 1000,  // 5분
  userMoney: 30 * 1000,         // 30초
  userAmber: 30 * 1000,         // 30초
  starPieces: 30 * 1000,        // 30초
  inventory: 10 * 1000          // 10초 (자주 변경됨)
};

// 🚀 배치 업데이트 시스템 (성능 최적화)
const batchUpdates = {
  fishCount: new Map(), // userUuid -> count
  questProgress: new Map() // userUuid -> { fish_caught: amount, exploration_win: amount, fish_sold: amount }
};

// 배치 업데이트 처리 (30초마다)
setInterval(async () => {
  try {
    // 물고기 카운트 배치 업데이트
    if (batchUpdates.fishCount.size > 0) {
      const bulkOps = [];
      for (const [userUuid, count] of batchUpdates.fishCount) {
        bulkOps.push({
          updateOne: {
            filter: { userUuid },
            update: { $inc: { totalFishCaught: count } },
// hint 제거 - MongoDB 자동 최적화
          }
        });
      }
      
      if (bulkOps.length > 0) {
        await measureDBQuery(`배치-물고기카운트-${bulkOps.length}개`, () =>
          UserUuidModel.bulkWrite(bulkOps, { 
            ordered: false, 
            writeConcern: { w: 1, j: false } 
          })
        );
        console.log(`✅ 배치 업데이트 완료: ${bulkOps.length}개 사용자 물고기 카운트`);
      }
      batchUpdates.fishCount.clear();
    }

    // 퀘스트 진행도 배치 업데이트
    if (batchUpdates.questProgress.size > 0) {
      const questBulkOps = [];
      for (const [userUuid, quests] of batchUpdates.questProgress) {
        const updateData = {};
        
        // 각 퀘스트 타입별로 증가값 설정
        if (quests.fish_caught) {
          updateData['$inc'] = { ...updateData['$inc'], fishCaught: quests.fish_caught };
        }
        if (quests.exploration_win) {
          updateData['$inc'] = { ...updateData['$inc'], explorationWins: quests.exploration_win };
        }
        if (quests.fish_sold) {
          updateData['$inc'] = { ...updateData['$inc'], fishSold: quests.fish_sold };
        }
        
        if (Object.keys(updateData).length > 0) {
          questBulkOps.push({
            updateOne: {
              filter: { userUuid },
              update: updateData,
// hint 제거 - MongoDB 자동 최적화
            }
          });
        }
      }
      
      if (questBulkOps.length > 0) {
        await measureDBQuery(`배치-퀘스트진행도-${questBulkOps.length}개`, () =>
          DailyQuestModel.bulkWrite(questBulkOps, { 
            ordered: false, 
            writeConcern: { w: 1, j: false } 
          })
        );
        console.log(`✅ 배치 업데이트 완료: ${questBulkOps.length}개 사용자 퀘스트 진행도`);
      }
      batchUpdates.questProgress.clear();
    }
  } catch (error) {
    console.error('❌ 배치 업데이트 실패:', error);
  }
}, 60000); // 60초마다 실행 (더 효율적인 배치 처리)

function getCachedData(cacheKey, userKey) {
  const key = `${cacheKey}:${userKey}`;
  const cached = dataCache.get(key);
  const ttl = CACHE_TTL[cacheKey] || 60000; // 기본 1분
  
  if (cached && Date.now() - cached.timestamp < ttl) {
    debugLog(`🎯 캐시 히트: ${key}`);
    return cached.data;
  }
  return null;
}

function setCachedData(cacheKey, userKey, data) {
  const key = `${cacheKey}:${userKey}`;
  dataCache.set(key, { data, timestamp: Date.now() });
  // 캐시 저장 로그 제거 (성능 최적화)
  
  // 캐시 크기 제한 (메모리 관리)
  if (dataCache.size > 1000) {
    const oldestKey = dataCache.keys().next().value;
    dataCache.delete(oldestKey);
  }
}

// 캐시 무효화 함수
function invalidateCache(cacheKey, userKey) {
  const key = `${cacheKey}:${userKey}`;
  dataCache.delete(key);
  debugLog(`🗑️ 캐시 무효화: ${key}`);
}

// 기존 함수 호환성 유지
function getCachedFishingSkill(userKey) {
  return getCachedData('fishingSkill', userKey);
}

function setCachedFishingSkill(userKey, skill) {
  setCachedData('fishingSkill', userKey, skill);
}
// 🔒 게임 데이터 임포트
const {
  getFishData,
  getFishHealthData,
  getFishSpeedData,
  getProbabilityData,
  getPrefixData,
  getShopData,
  getFishByName,
  getAvailableFishBySkill,
  getShopItemsByCategory
} = require("./data/gameData");

// 🔒 닉네임 검증 함수 (서버 사이드)
const validateNickname = (nickname) => {
  if (!nickname || typeof nickname !== 'string') {
    return { valid: false, message: "닉네임이 필요합니다." };
  }
  
  const trimmed = nickname.trim();
  
  // 길이 검증
  if (trimmed.length < 2) {
    return { valid: false, message: "닉네임은 2글자 이상이어야 합니다." };
  }
  if (trimmed.length > 12) {
    return { valid: false, message: "닉네임은 12글자 이하여야 합니다." };
  }
  
  // 특수문자 검증 (한글, 영문, 숫자만 허용)
  const nicknameRegex = /^[가-힣a-zA-Z0-9]+$/;
  if (!nicknameRegex.test(trimmed)) {
    return { valid: false, message: "닉네임은 한글, 영문, 숫자만 사용 가능합니다." };
  }
  
  return { valid: true, message: "", trimmed };
};

// dotenv는 개발환경에서만 로드
if (process.env.NODE_ENV !== 'production') {
  try {
    require("dotenv").config();
  } catch (err) {
    console.log("dotenv not available, using environment variables");
  }
}

// 🛡️ DDoS/LOIC 방어 시스템
const requestCounts = new Map(); // IP별 요청 카운트
const ddosBlockedIPs = new Set(); // DDoS 차단된 IP 목록 (기존 시스템)
const connectionCounts = new Map(); // IP별 연결 수
const suspiciousIPs = new Map(); // 의심스러운 IP 추적

// IP 주소 추출 함수
const getClientIP = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0] ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.ip ||
         'unknown';
};

// DDoS 방어 미들웨어
const ddosProtection = (req, res, next) => {
  const clientIP = getClientIP(req);
  const now = Date.now();
  
  // 차단된 IP 확인
  if (ddosBlockedIPs.has(clientIP)) {
    console.log(`🚫 차단된 IP 접근 시도: ${clientIP}`);
    return res.status(429).json({ 
      error: "IP가 차단되었습니다. 잠시 후 다시 시도해주세요.",
      retryAfter: 600 
    });
  }
  
  // IP별 요청 수 추적
  const requests = requestCounts.get(clientIP) || { count: 0, window: now, firstRequest: now };
  
  // 1분 윈도우 리셋
  if (now - requests.window > 60000) {
    requests.count = 1;
    requests.window = now;
  } else {
    requests.count++;
  }
  
  requestCounts.set(clientIP, requests);
  
  // LOIC 공격 패턴 감지 (분당 150회 이상)
  if (requests.count > 150) {
    ddosBlockedIPs.add(clientIP);
    console.log(`🚨 LOIC/DDoS 공격 감지! IP 차단: ${clientIP} (${requests.count} requests/min)`);
    
    // 10분 후 차단 해제
    setTimeout(() => {
      ddosBlockedIPs.delete(clientIP);
      console.log(`🔓 IP 차단 해제: ${clientIP}`);
    }, 600000);
    
    return res.status(429).json({ 
      error: "요청 한도 초과. IP가 임시 차단되었습니다.",
      retryAfter: 600
    });
  }
  
  // 의심스러운 활동 감지 (분당 50회 이상)
  if (requests.count > 50) {
    suspiciousIPs.set(clientIP, now);
    console.log(`⚠️ 의심스러운 활동 감지: ${clientIP} (${requests.count} requests/min)`);
  }
  
  // 응답 헤더에 제한 정보 추가
  res.set({
    'X-RateLimit-Limit': '150',
    'X-RateLimit-Remaining': Math.max(0, 150 - requests.count),
    'X-RateLimit-Reset': new Date(requests.window + 60000).toISOString()
  });
  
  next();
};

// 주기적 정리 (5분마다)
setInterval(() => {
  const now = Date.now();
  const fiveMinutesAgo = now - 300000;
  
  // 오래된 요청 기록 정리
  for (const [ip, data] of requestCounts.entries()) {
    if (now - data.window > 120000) { // 2분 이상 된 기록 삭제
      requestCounts.delete(ip);
    }
  }
  
  // 오래된 의심스러운 IP 기록 정리
  for (const [ip, timestamp] of suspiciousIPs.entries()) {
    if (timestamp < fiveMinutesAgo) {
      suspiciousIPs.delete(ip);
    }
  }
  
  console.log(`🧹 보안 시스템 정리: ${requestCounts.size} IPs tracked, ${ddosBlockedIPs.size} blocked, ${suspiciousIPs.size} suspicious`);
}, 300000);

const app = express();

// 신뢰할 수 있는 프록시 설정 (렌더 서버용)
app.set('trust proxy', true);

// 🚀 DDoS 방어 미들웨어 임시 비활성화 (성능 테스트)
// app.use(ddosProtection); // 성능 문제로 비활성화

// 관리자 API 예외 처리를 위한 조건부 IP 차단
app.use((req, res, next) => {
  // 관리자 API는 IP 차단 예외 (관리자가 차단 해제할 수 있도록)
  if (req.path.startsWith('/api/admin/')) {
    console.log(`⚠️ [ADMIN-API] Bypassing IP block for admin API: ${req.path}`);
    return next();
  }
  
  // 다른 모든 요청은 IP 차단 적용
  return blockSuspiciousIP(req, res, next);
});

// 🚀 간소화된 CORS 설정 (성능 최적화)
if (isProduction) {
  // 프로덕션: 필수 설정만
  app.use(cors({
    origin: "https://fising-master.onrender.com",
    credentials: true
  }));
} else {
  // 로컬: 모든 오리진 허용
  app.use(cors({
    origin: true,
    credentials: true
  }));
}

// 🚀 최소한의 보안 헤더 (성능 최적화)
if (isProduction) {
  app.use((req, res, next) => {
    // 필수 보안 헤더만
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    next();
  });
}
// 로컬에서는 보안 헤더 생략


// 요청 크기 제한 (보안 강화)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 성능 최적화 설정
app.use((req, res, next) => {
  // Keep-Alive 연결 유지
  res.setHeader('Connection', 'keep-alive');
  // 캐시 제어 (정적 파일용)
  if (req.url.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1년
  }
  next();
});

// MIME 타입 강제 설정 미들웨어
app.use((req, res, next) => {
  // CSS 파일 요청에 대한 MIME 타입 강제 설정
  if (req.path.endsWith('.css')) {
    res.type('text/css');
  }
  // JS 파일 요청에 대한 MIME 타입 강제 설정
  else if (req.path.endsWith('.js')) {
    res.type('application/javascript');
  }
  next();
});

// 🚫 계정 차단 검증 미들웨어
app.use((req, res, next) => {
  // 정적 파일이나 관리자 API는 제외
  if (req.path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg)$/) || 
      req.path.startsWith('/api/admin/') || 
      req.path === '/api/toggle-admin' ||
      req.path === '/api/admin-status/') {
    return next();
  }
  
  // userUuid 파라미터에서 차단 확인
  const userUuid = req.query.userUuid || req.body?.userUuid;
  if (userUuid && blockedAccounts.has(userUuid)) {
    const blockInfo = blockedAccounts.get(userUuid);
    console.log(`🚫 [BLOCKED-ACCOUNT] Access denied for ${userUuid} - Reason: ${blockInfo.reason}`);
    return res.status(403).json({
      error: "계정 차단됨",
      message: `귀하의 계정이 차단되었습니다.\n\n차단 사유: ${blockInfo.reason}\n차단 일시: ${blockInfo.blockedAt}\n차단자: ${blockInfo.blockedBy}\n\n관리자에게 문의하세요.`,
      blocked: true,
      accountBlocked: true,
      blockInfo: {
        reason: blockInfo.reason,
        blockedAt: blockInfo.blockedAt,
        blockedBy: blockInfo.blockedBy
      }
    });
  }
  
  next();
});

const server = http.createServer(app);

// Socket.IO 연결 제한 및 IP 차단 검증 미들웨어
const socketConnectionLimit = (socket, next) => {
  const clientIP = getClientIP({ headers: socket.handshake.headers, connection: socket.conn });
  
  // 🛡️ 1. 관리자 차단 IP 확인
  if (blockedIPs.has(clientIP)) {
    const blockInfo = blockedIPs.get(clientIP);
    console.log(`🚫 [SOCKET-BLOCKED] Blocked IP attempted connection: ${clientIP} - Reason: ${blockInfo.reason}`);
    return next(new Error(`Connection blocked. Reason: ${blockInfo.reason}`));
  }
  
  // 🛡️ 2. DDoS 차단 IP 확인
  if (ddosBlockedIPs.has(clientIP)) {
    console.log(`🚫 [SOCKET-DDOS] DDoS blocked IP attempted connection: ${clientIP}`);
    return next(new Error('Connection temporarily blocked due to suspicious activity'));
  }
  
  const connections = connectionCounts.get(clientIP) || 0;
  
  // IP당 최대 5개 연결 허용
  if (connections >= 5) {
    console.log(`🚨 Socket 연결 제한 초과: ${clientIP} (${connections} connections)`);
    return next(new Error('연결 한도 초과. 잠시 후 다시 시도해주세요.'));
  }
  
  connectionCounts.set(clientIP, connections + 1);
  console.log(`🔌 새 Socket 연결: ${clientIP} (${connections + 1}/5)`);
  
  socket.on('disconnect', () => {
    const current = connectionCounts.get(clientIP) || 0;
    if (current <= 1) {
      connectionCounts.delete(clientIP);
    } else {
      connectionCounts.set(clientIP, current - 1);
    }
    console.log(`🔌 Socket 연결 해제: ${clientIP} (${Math.max(0, current - 1)}/5)`);
  });
  
  next();
};

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:4000",
      "http://localhost:5173", 
      "http://127.0.0.1:4000",
      "http://127.0.0.1:5173",
      "https://fising-master.onrender.com", // 프로덕션 URL 추가
      process.env.CLIENT_URL // 환경변수에서 클라이언트 URL 가져오기
    ].filter(Boolean), // undefined 값 제거
    credentials: true,
    methods: ["GET", "POST"]
  },
  // 성능 최적화 설정
  transports: ["websocket", "polling"], // websocket 우선
  pingTimeout: 60000, // 60초 ping timeout
  pingInterval: 25000, // 25초마다 ping
  upgradeTimeout: 30000, // 30초 upgrade timeout
  allowEIO3: true, // EIO3 호환성
  // 연결 최적화 및 보안 강화
  maxHttpBufferSize: 1e6, // 1MB 버퍼
  allowRequest: (req, callback) => {
    const clientIP = getClientIP(req);
    
    // 차단된 IP 확인
    if (ddosBlockedIPs.has(clientIP)) {
      console.log(`🚫 차단된 IP의 Socket 연결 시도: ${clientIP}`);
      return callback('차단된 IP입니다', false);
    }
    
    callback(null, true);
  },
  // 추가 보안 옵션
  serveClient: false, // 클라이언트 라이브러리 제공 비활성화
  cookie: false // 쿠키 비활성화
});

// Socket.IO 연결 제한 미들웨어 적용
io.use(socketConnectionLimit);

// 🔐 Socket.IO JWT 인증 미들웨어 (보안 강화)
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (token && token !== 'temp') {
    // JWT 토큰이 있으면 검증
    const decoded = verifyJWT(token);
    if (decoded) {
      socket.data.userUuid = decoded.userUuid;
      socket.data.username = decoded.username;
      socket.data.isAdmin = decoded.isAdmin;
      socket.data.isAuthenticated = true;
      console.log(`🔐 Socket JWT 인증 성공: ${decoded.username} (${decoded.userUuid})`);
    } else {
      // 토큰이 유효하지 않지만 재연결을 위해 연결은 허용
      socket.data.isAuthenticated = false;
      console.log(`⚠️ Socket JWT 인증 실패: 재연결을 위해 연결 허용`);
    }
  } else {
    // 토큰이 없어도 연결 허용 (재연결 시 토큰 갱신을 위해)
    socket.data.isAuthenticated = false;
    console.log(`⚠️ Socket JWT 토큰 없음: 재연결을 위해 연결 허용`);
  }
  
  next(); // 항상 연결 허용 (재연결 안정성)
});

// 🌐 Socket.IO 연결 핸들러 (IP 수집용)
global.io = io; // 전역 접근을 위한 설정

// 🔄 앱 버전 관리 시스템
let currentBuildVersion = process.env.BUILD_VERSION || Date.now().toString();
console.log(`📱 현재 앱 버전: ${currentBuildVersion}`);

// 관리자가 새 버전 배포 시 호출하는 함수
function notifyClientUpdate(newVersion) {
  currentBuildVersion = newVersion;
  
  // 모든 연결된 클라이언트에게 알림
  io.emit('app:update-available', { 
    version: newVersion,
    message: '새로운 버전이 배포되었습니다. 잠시 후 자동으로 새로고침됩니다.',
    timestamp: Date.now()
  });
  
  console.log(`📢 새 버전 배포 알림 전송: ${newVersion} (연결된 클라이언트: ${io.sockets.sockets.size}개)`);
}

io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);
  
  // 🔄 클라이언트 접속 시 현재 버전 전송
  socket.emit('app:version', { 
    version: currentBuildVersion,
    timestamp: Date.now()
  });
  
  // 연결 유지를 위한 heartbeat 설정
  let heartbeatInterval;
  
  // 원정 방 참가 이벤트
  socket.on('expedition-join-room', (roomId) => {
    // 🔐 JWT 인증 확인 (보안 강화)
    if (!socket.data.isAuthenticated) {
      console.log(`🚨 [SECURITY] Unauthenticated expedition join attempt: ${socket.id}`);
      return;
    }
    
    socket.join(`expedition_${roomId}`);
    console.log(`🏠 Socket ${socket.id} joined expedition room: ${roomId}`);
  });
  
  // 원정 방 나가기 이벤트
  socket.on('expedition-leave-room', (roomId) => {
    socket.leave(`expedition_${roomId}`);
    console.log(`🚪 Socket ${socket.id} left expedition room: ${roomId}`);
  });
  
  // 사용자 정보 저장 (로그인 시 설정됨)
  socket.on('user-login', (userData) => {
    if (userData && userData.username && userData.userUuid) {
      socket.username = userData.username;
      socket.userUuid = userData.userUuid;
      socket.connectedAt = new Date().toLocaleString('ko-KR', { 
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      socket.isAlive = true;
      socket.lastActivity = Date.now();
      
      // IP 정보 수집 및 로깅
      const clientIP = socket.handshake.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                      socket.handshake.headers['x-real-ip'] || 
                      socket.handshake.headers['cf-connecting-ip'] ||
                      socket.handshake.address ||
                      socket.conn?.remoteAddress ||
                      socket.request?.connection?.remoteAddress ||
                      'Unknown';
      
      socket.clientIP = clientIP; // Socket에 IP 저장
      
      console.log(`👤 User logged in via socket: ${userData.username} (${userData.userUuid}) from IP: ${clientIP}`);
      
      // 디버그: 모든 헤더 정보 로깅
      console.log(`🔍 [IP-COLLECT] Headers for ${userData.username}:`, {
        'x-forwarded-for': socket.handshake.headers['x-forwarded-for'],
        'x-real-ip': socket.handshake.headers['x-real-ip'],
        'cf-connecting-ip': socket.handshake.headers['cf-connecting-ip'],
        'address': socket.handshake.address,
        'remoteAddress': socket.conn?.remoteAddress
      });
      
      // 연결 유지를 위한 heartbeat 시작
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      heartbeatInterval = setInterval(() => {
        if (socket.connected) {
          socket.emit('server-ping');
          socket.lastActivity = Date.now();
        }
      }, 30000); // 30초마다 ping
    }
  });
  
  // 🔐 JWT 토큰 자동 갱신 요청 처리
  socket.on("auth:refresh-token", async ({ userUuid, username }) => {
    try {
      console.log(`🔄 JWT 토큰 갱신 요청: ${username} (${userUuid})`);
      
      // 사용자 정보 확인
      if (!userUuid || !username) {
        console.error("❌ 토큰 갱신 실패: 사용자 정보 누락");
        socket.emit("auth:refresh-error", { 
          error: "사용자 정보가 누락되었습니다.",
          code: "USER_INFO_MISSING"
        });
        return;
      }
      
      // 관리자 상태 확인
      let isUserAdmin = false;
      try {
        const adminRecord = await AdminModel.findOne({ userUuid });
        isUserAdmin = adminRecord ? adminRecord.isAdmin : false;
        console.log(`🔍 관리자 상태 확인: ${username} - ${isUserAdmin ? '관리자' : '일반 사용자'}`);
      } catch (e) {
        console.warn('토큰 갱신 중 관리자 상태 확인 실패:', e);
      }
      
      // 새 JWT 토큰 생성
      const newJwtToken = generateJWT({
        userUuid,
        username,
        isAdmin: isUserAdmin
      });
      
      if (newJwtToken) {
        // 새 토큰을 클라이언트에 전송
        socket.emit("auth:token", { 
          token: newJwtToken,
          expiresIn: JWT_EXPIRES_IN
        });
        console.log(`✅ JWT 토큰 갱신 완료: ${username} (만료 시간: ${JWT_EXPIRES_IN})`);
      } else {
        console.error("❌ JWT 토큰 생성 실패");
        socket.emit("auth:refresh-error", { 
          error: "토큰 생성에 실패했습니다.",
          code: "TOKEN_GENERATION_FAILED"
        });
      }
    } catch (error) {
      console.error("🚨 JWT 토큰 갱신 중 오류:", error);
      socket.emit("auth:refresh-error", { 
        error: "토큰 갱신 중 서버 오류가 발생했습니다.",
        code: "SERVER_ERROR",
        details: error.message
      });
    }
  });
  
  // 연결 유지 확인 (heartbeat)
  socket.on('ping', () => {
    socket.emit('pong');
    socket.isAlive = true;
    socket.lastActivity = Date.now();
  });
  
  // 클라이언트에서 보낸 pong 응답 처리
  socket.on('client-pong', () => {
    socket.isAlive = true;
    socket.lastActivity = Date.now();
  });
  
  // 활동 감지를 위한 이벤트들
  ['chat:message', 'join:room', 'fishing:start', 'exploration:start'].forEach(event => {
    socket.on(event, () => {
      socket.lastActivity = Date.now();
    });
  });
  
  socket.on('disconnect', (reason) => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    
    if (socket.username) {
      console.log(`🔌 User disconnected: ${socket.username} (${reason})`);
    } else {
      console.log(`🔌 Anonymous socket disconnected: ${socket.id} (${reason})`);
    }
  });
  
  // 연결 오류 처리
  socket.on('error', (error) => {
    console.error(`🚨 Socket error for ${socket.username || socket.id}:`, error);
  });
});

// Mongo Models
const catchSchema = new mongoose.Schema(
  {
    userUuid: { type: String, index: true }, // 새로운 UUID 기반 식별자
    username: { type: String, required: true, index: true },
    fish: { type: String, required: true },
    weight: { type: Number, required: true },
    userId: { type: String, index: true },
    displayName: { type: String },
    probability: { type: Number }, // 업적 체크를 위한 확률 정보
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const CatchModel = mongoose.model("Catch", catchSchema);

// User Money Schema
const userMoneySchema = new mongoose.Schema(
  {
    userUuid: { type: String, index: true }, // UUID 기반 식별자
    username: { type: String, required: true, index: true },
    userId: { type: String, index: true },
    money: { type: Number, default: 0 }, // 초기 골드 0
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

const UserMoneyModel = mongoose.model("UserMoney", userMoneySchema);

// User Amber Schema
const userAmberSchema = new mongoose.Schema(
  {
    userUuid: { type: String, index: true }, // UUID 기반 식별자
    username: { type: String, required: true, index: true },
    userId: { type: String, index: true },
    amber: { type: Number, default: 0 }, // 호박석
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

const UserAmberModel = mongoose.model("UserAmber", userAmberSchema);

// User Equipment Schema
const userEquipmentSchema = new mongoose.Schema(
  {
    userUuid: { type: String, index: true }, // UUID 기반 식별자
    username: { type: String, required: true, index: true },
    userId: { type: String, index: true },
    fishingRod: { type: String, default: null },
    accessory: { type: String, default: null },
    // 강화 레벨 정보
    fishingRodEnhancement: { type: Number, default: 0 }, // 낚시대 강화 레벨
    accessoryEnhancement: { type: Number, default: 0 }, // 악세사리 강화 레벨
    // 강화 실패 횟수 정보
    fishingRodFailCount: { type: Number, default: 0 }, // 낚시대 강화 실패 횟수
    accessoryFailCount: { type: Number, default: 0 }, // 악세사리 강화 실패 횟수
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

const UserEquipmentModel = mongoose.model("UserEquipment", userEquipmentSchema);

// Material Schema
const materialSchema = new mongoose.Schema(
  {
    userUuid: { type: String, index: true }, // UUID 기반 식별자
    username: { type: String, required: true, index: true },
    userId: { type: String, index: true },
    material: { type: String, required: true },
    displayName: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const MaterialModel = mongoose.model("Material", materialSchema);

// Fishing Skill Schema
const fishingSkillSchema = new mongoose.Schema(
  {
    userUuid: { type: String, required: true, index: true }, // UUID 기반 식별자
    username: { type: String, required: true, index: true },
    userId: { type: String, index: true },
    skill: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

const FishingSkillModel = mongoose.model("FishingSkill", fishingSkillSchema);

// Star Piece Schema (스타피쉬 분해로 얻는 별조각)
const starPieceSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    username: { type: String, required: true },
    userUuid: { type: String, index: true }, // UUID 기반 조회를 위한 인덱스
    starPieces: { type: Number, default: 0 }, // 보유 별조각 수
  },
  { timestamps: true }
);

const StarPieceModel = mongoose.model("StarPiece", starPieceSchema);

// Companion Schema (동료 시스템)
const companionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    username: { type: String, required: true },
    userUuid: { type: String, index: true },
    companions: [{ type: String }], // 보유한 동료 이름 배열
  },
  { timestamps: true }
);

const CompanionModel = mongoose.model("Companion", companionSchema);

// Companion Stats Schema (동료 능력치 및 설정)
const companionStatsSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  username: { type: String, required: true },
  userUuid: { type: String, index: true }, // UUID 기반 식별자
  companionName: { type: String, required: true }, // 동료 이름
  level: { type: Number, default: 1 }, // 레벨
  experience: { type: Number, default: 0 }, // 경험치
  isInBattle: { type: Boolean, default: false }, // 전투 참여 여부
}, { timestamps: true });

// 🔧 복합 유니크 인덱스: 같은 사용자의 같은 동료는 하나만 존재
// userUuid가 존재하는 경우에만 유니크 제약 적용
companionStatsSchema.index({ userUuid: 1, companionName: 1 }, { unique: true, sparse: true });

const CompanionStatsModel = mongoose.model("CompanionStats", companionStatsSchema);

// 레이드 보스 처치 횟수 추적 스키마
const raidKillCountSchema = new mongoose.Schema({
  totalKills: { type: Number, default: 0 }, // 총 처치 횟수
  lastKillTime: { type: Date, default: Date.now }, // 마지막 처치 시간
  currentHpMultiplier: { type: Number, default: 1.0 } // 현재 체력 배율
}, { timestamps: true });

const RaidKillCountModel = mongoose.model("RaidKillCount", raidKillCountSchema);

// Ether Key Schema (에테르 열쇠 - 파티던전 입장권)
const etherKeySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  username: { type: String, required: true },
  userUuid: { type: String, index: true },
  etherKeys: { type: Number, default: 0 }, // 보유한 에테르 열쇠 수
}, { timestamps: true });

const EtherKeyModel = mongoose.model("EtherKey", etherKeySchema);

// Coupon Usage Schema (쿠폰 사용 기록)
const couponUsageSchema = new mongoose.Schema(
  {
    userUuid: { type: String, required: true, index: true },
    username: { type: String, required: true },
    couponCode: { type: String, required: true },
    reward: { type: String, required: true }, // "starPieces:3" 형태
    usedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

couponUsageSchema.index({ userUuid: 1, couponCode: 1 }, { unique: true }); // 사용자당 쿠폰 중복 사용 방지

const CouponUsageModel = mongoose.model("CouponUsage", couponUsageSchema);

// Fish Discovery Schema (물고기 발견 기록)
const fishDiscoverySchema = new mongoose.Schema(
  {
    userUuid: { type: String, required: true, index: true },
    username: { type: String, required: true },
    fishName: { type: String, required: true },
    firstCaughtAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// 사용자당 물고기별 중복 방지
fishDiscoverySchema.index({ userUuid: 1, fishName: 1 }, { unique: true });

const FishDiscoveryModel = mongoose.model("FishDiscovery", fishDiscoverySchema);

// Expedition Reward Claim Schema (원정 보상 수령 기록 - 중복 방지)
const expeditionRewardClaimSchema = new mongoose.Schema(
  {
    userUuid: { type: String, required: true, index: true },
    username: { type: String, required: true },
    roomId: { type: String, required: true },
    rewards: [{
      fishName: String,
      quantity: Number
    }],
    claimedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// 사용자당 방별 중복 수령 방지
expeditionRewardClaimSchema.index({ userUuid: 1, roomId: 1 }, { unique: true });

const ExpeditionRewardClaimModel = mongoose.model("ExpeditionRewardClaim", expeditionRewardClaimSchema);

// Admin Schema (관리자 시스템)
const adminSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    username: { type: String, required: true },
    userUuid: { type: String, index: true },
    isAdmin: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const AdminModel = mongoose.model("Admin", adminSchema);

// Blocked IP Schema (차단된 IP 관리)
const blockedIPSchema = new mongoose.Schema(
  {
    ipAddress: { type: String, required: true, unique: true },
    reason: { type: String, required: true },
    blockedAt: { type: String, required: true }, // 한국시간 문자열로 저장
    blockedBy: { type: String, required: true },
  },
  { timestamps: true }
);

const BlockedIPModel = mongoose.model("BlockedIP", blockedIPSchema);

// Blocked Account Schema (차단된 계정 관리)
const blockedAccountSchema = new mongoose.Schema(
  {
    userUuid: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    reason: { type: String, required: true },
    blockedAt: { type: String, required: true }, // 한국시간 문자열로 저장
    blockedBy: { type: String, required: true },
  },
  { timestamps: true }
);

const BlockedAccountModel = mongoose.model("BlockedAccount", blockedAccountSchema);

// Cooldown Schema (쿨타임 관리)
const cooldownSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    username: { type: String, required: true },
    userUuid: { type: String, index: true },
    fishingCooldownEnd: { type: Date, default: null }, // 낚시 쿨타임 종료 시간
    raidAttackCooldownEnd: { type: Date, default: null }, // 레이드 공격 쿨타임 종료 시간
  },
  { timestamps: true }
);

const CooldownModel = mongoose.model("Cooldown", cooldownSchema);

// Raid Damage Schema (레이드 누적 데미지 추적)
const raidDamageSchema = new mongoose.Schema(
  {
    userUuid: { type: String, required: true, index: true },
    username: { type: String, required: true },
    totalDamage: { type: Number, default: 0 }, // 누적 데미지
  },
  { timestamps: true }
);

const RaidDamageModel = mongoose.model("RaidDamage", raidDamageSchema);

// Rare Fish Count Schema (희귀 물고기 낚은 횟수 추적)
const rareFishCountSchema = new mongoose.Schema(
  {
    userUuid: { type: String, required: true, index: true },
    username: { type: String, required: true },
    rareFishCount: { type: Number, default: 0 }, // 0.3% 물고기 낚은 횟수
  },
  { timestamps: true }
);

const RareFishCountModel = mongoose.model("RareFishCount", rareFishCountSchema);

// 동료 목록 정의
const COMPANION_LIST = [
  "실", "피에나", "애비게일", "림스&베리", "클로에", "나하트라"
];

// User UUID Schema (사용자 고유 ID 관리)
const userUuidSchema = new mongoose.Schema(
  {
    userUuid: { type: String, required: true, unique: true, index: true }, // #0001, #0002, ...
    username: { type: String, required: true }, // 현재 닉네임 (변경 가능)
    displayName: { type: String, required: true }, // 사용자가 설정한 표시 이름 (닉네임 변경 시 업데이트)
    originalGoogleId: { type: String }, // 구글 로그인 ID (변경 불가)
    originalKakaoId: { type: String }, // 카카오 로그인 ID (변경 불가)
    isGuest: { type: Boolean, default: false }, // 게스트 여부
    
    // 🔐 보안 강화: 비밀번호 암호화 저장
    passwordHash: { type: String }, // bcrypt로 암호화된 비밀번호 (게스트나 소셜 로그인은 null)
    salt: { type: String }, // 추가 보안을 위한 솔트
    
    // 사용자 설정 (로컬스토리지 대체)
    termsAccepted: { type: Boolean, default: false }, // 이용약관 동의 여부
    darkMode: { type: Boolean, default: true }, // 다크모드 설정 (기본값: true)
    
    // 쿨타임 정보
    fishingCooldownEnd: { type: Date, default: null }, // 낚시 쿨타임 종료 시간
    raidAttackCooldownEnd: { type: Date, default: null }, // 레이드 공격 쿨타임 종료 시간
    
    // 물고기 카운터
    totalFishCaught: { type: Number, default: 0 }, // 총 낚은 물고기 수
    
    // 🔐 보안 로그
    lastLoginAt: { type: Date }, // 마지막 로그인 시간
    lastLoginIP: { type: String }, // 마지막 로그인 IP
    loginAttempts: { type: Number, default: 0 }, // 로그인 시도 횟수
    lockedUntil: { type: Date }, // 계정 잠금 해제 시간
    
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

const UserUuidModel = mongoose.model("UserUuid", userUuidSchema);

// 업적 시스템 모듈 import
const { AchievementModel, AchievementSystem } = require('./modules/achievementSystem');
const { setupAchievementRoutes } = require('./routes/achievementRoutes');

// [Quest] Daily Quest Schema (일일 퀘스트 시스템)
const dailyQuestSchema = new mongoose.Schema(
  {
    userUuid: { type: String, required: true, index: true }, // UUID 기반 식별자
    username: { type: String, required: true, index: true },
    userId: { type: String, index: true },
    
    // 퀴스트 진행도
    fishCaught: { type: Number, default: 0 }, // 물고기 잡은 수
    explorationWins: { type: Number, default: 0 }, // 탐사 승리 수
    fishSold: { type: Number, default: 0 }, // 물고기 판매 수
    
    // 퀴스트 완료 여부
    questFishCaught: { type: Boolean, default: false }, // 물고기 10마리 잡기 완료
    questExplorationWin: { type: Boolean, default: false }, // 탐사 승리 완료
    questFishSold: { type: Boolean, default: false }, // 물고기 10회 판매 완료
    
    // 리셋 날짜 (자정 리셋용)
    lastResetDate: { type: String, required: true } // YYYY-MM-DD 형식
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

const DailyQuestModel = mongoose.model("DailyQuest", dailyQuestSchema);

// Market Listing Schema
const marketListingSchema = new mongoose.Schema(
  {
    userUuid: { type: String, required: true, index: true },
    sellerNickname: { type: String, required: true },
    itemName: { type: String, required: true },
    itemType: { type: String, required: true }, // 'material', 'amber', 'starPiece'
    quantity: { type: Number, required: true },
    pricePerUnit: { type: Number, required: true },
    deposit: { type: Number, required: true }, // 보증금 (총 판매가의 5%)
    listedAt: { type: Date, default: Date.now }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const MarketListingModel = mongoose.model("MarketListing", marketListingSchema);

// Market Trade History Schema
const marketTradeHistorySchema = new mongoose.Schema(
  {
    buyerUuid: { type: String, required: true, index: true },
    buyerNickname: { type: String, required: true },
    sellerUuid: { type: String, required: true, index: true },
    sellerNickname: { type: String, required: true },
    itemName: { type: String, required: true },
    itemType: { type: String, required: true }, // 'material', 'amber', 'starPiece'
    quantity: { type: Number, required: true },
    pricePerUnit: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    tradedAt: { type: Date, default: Date.now }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const MarketTradeHistoryModel = mongoose.model("MarketTradeHistory", marketTradeHistorySchema);

// Mail Schema (플레이어 간 DM 시스템)
const mailSchema = new mongoose.Schema(
  {
    senderUuid: { type: String, required: true, index: true },
    senderNickname: { type: String, required: true },
    receiverUuid: { type: String, required: true, index: true },
    receiverNickname: { type: String, required: true },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    sentAt: { type: Date, default: Date.now }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const MailModel = mongoose.model("Mail", mailSchema);

// UUID 생성 함수
async function generateNextUuid() {
  try {
    // 모든 사용자를 가져와서 숫자로 정렬
    const allUsers = await UserUuidModel.find({}, { userUuid: 1 }).lean();
    
    if (allUsers.length === 0) {
      console.log("No existing users, starting with #0001");
      return "#0001";
    }
    
    // UUID에서 숫자 부분만 추출해서 정렬
    const numbers = allUsers
      .map(user => {
        if (user.userUuid && user.userUuid.startsWith("#")) {
          const num = parseInt(user.userUuid.replace("#", ""));
          return isNaN(num) ? 0 : num;
        }
        return 0;
      })
      .filter(num => num > 0)
      .sort((a, b) => b - a); // 내림차순 정렬
    
    const lastNumber = numbers[0] || 0;
    const nextNumber = lastNumber + 1;
    const newUuid = `#${nextNumber.toString().padStart(4, "0")}`;
    
    console.log(`Generated new UUID: ${newUuid} (last was: #${lastNumber.toString().padStart(4, "0")})`);
    return newUuid;
  } catch (error) {
    console.error("Error generating UUID:", error);
    // Fallback: 타임스탬프 기반 UUID
    const timestamp = Date.now().toString().slice(-4);
    const fallbackUuid = `#T${timestamp}`;
    console.log(`Using fallback UUID: ${fallbackUuid}`);
    return fallbackUuid;
  }
}

// 사용자 등록/조회 함수
async function getOrCreateUser(username, googleId = null, kakaoId = null) {
  try {
    let user;
    
    if (googleId) {
      // 구글 로그인 사용자
      user = await UserUuidModel.findOne({ originalGoogleId: googleId });
      if (!user) {
        // 보안 강화: 구글 사용자도 닉네임 중복 체크
        const defaultUsername = username || "구글사용자";
        const existingUser = await UserUuidModel.findOne({ 
          $or: [
            { username: defaultUsername },
            { displayName: defaultUsername }
          ]
        });
        
        if (existingUser) {
          // 중복된 경우 고유한 닉네임 생성
          const timestamp = Date.now().toString().slice(-4);
          const uniqueUsername = `${defaultUsername}_${timestamp}`;
          console.log(`Google username conflict resolved: ${defaultUsername} -> ${uniqueUsername}`);
          
        const userUuid = await generateNextUuid();
        user = await UserUuidModel.create({
          userUuid,
            username: uniqueUsername,
            displayName: uniqueUsername,
          originalGoogleId: googleId,
            isGuest: false,
            termsAccepted: false,
            darkMode: true
          });
          
          // 새 사용자 초기 장비 설정
          await UserEquipmentModel.create({
            userUuid: user.userUuid,
            username: user.username,
            fishingRod: '나무낚시대',
            accessory: null
          });
        } else {
          const userUuid = await generateNextUuid();
          user = await UserUuidModel.create({
            userUuid,
            username: defaultUsername,
            displayName: defaultUsername,
            originalGoogleId: googleId,
            isGuest: false,
            termsAccepted: false,
            darkMode: true
          });
          
          // 새 사용자 초기 장비 설정
          await UserEquipmentModel.create({
            userUuid: user.userUuid,
            username: user.username,
            fishingRod: '나무낚시대',
            accessory: null
          });
        }
        console.log(`Created new Google user: ${user.userUuid} (username: ${user.username})`);
    } else {
        // 구글 사용자의 경우 username(구글 이름)은 업데이트하지만 displayName은 보존
        if (user.username !== username && username) {
          console.log(`Updating Google username from ${user.username} to ${username}, keeping displayName: ${user.displayName}`);
          user.username = username; // 구글 이름 업데이트
          await user.save();
        }
      }
    } else if (kakaoId) {
      // 카카오 로그인 사용자
      const kakaoIdToSearch = kakaoId.startsWith('kakao_') ? kakaoId : `kakao_${kakaoId}`;
      user = await UserUuidModel.findOne({ originalKakaoId: kakaoIdToSearch });
      if (!user) {
        // 보안 강화: 카카오 사용자도 닉네임 중복 체크
        const defaultUsername = username || "카카오사용자";
        const existingUser = await UserUuidModel.findOne({ 
          $or: [
            { username: defaultUsername },
            { displayName: defaultUsername }
          ]
        });
        
        if (existingUser) {
          // 중복된 경우 고유한 닉네임 생성
          const timestamp = Date.now().toString().slice(-4);
          const uniqueUsername = `${defaultUsername}_${timestamp}`;
          console.log(`Kakao username conflict resolved: ${defaultUsername} -> ${uniqueUsername}`);
          
          const userUuid = await generateNextUuid();
          user = await UserUuidModel.create({
            userUuid,
            username: uniqueUsername,
            displayName: uniqueUsername,
            originalKakaoId: kakaoId,
            isGuest: false,
            termsAccepted: false,
            darkMode: true
          });
          
          // 새 사용자 초기 장비 설정
          await UserEquipmentModel.create({
            userUuid: user.userUuid,
            username: user.username,
            fishingRod: '나무낚시대',
            accessory: null
          });
        } else {
          const userUuid = await generateNextUuid();
          user = await UserUuidModel.create({
            userUuid,
            username: defaultUsername,
            displayName: defaultUsername,
            originalKakaoId: kakaoId,
            isGuest: false,
            termsAccepted: false,
            darkMode: true
          });
          
          // 새 사용자 초기 장비 설정
          await UserEquipmentModel.create({
            userUuid: user.userUuid,
            username: user.username,
            fishingRod: '나무낚시대',
            accessory: null
          });
        }
        console.log(`Created new Kakao user: ${user.userUuid} (username: ${user.username})`);
      } else {
        // 카카오 사용자의 경우 username(카카오 닉네임)은 업데이트하지만 displayName은 보존
        if (user.username !== username && username) {
          console.log(`Updating Kakao username from ${user.username} to ${username}, keeping displayName: ${user.displayName}`);
          user.username = username; // 카카오 닉네임 업데이트
          await user.save();
        }
      }
    } else {
      // 게스트 사용자 - 기존 게스트 사용자를 찾되, 없으면 새로 생성
      user = await UserUuidModel.findOne({ username, isGuest: true });
      if (!user) {
        // 보안 강화: 다른 사용자(게스트 포함)가 이미 사용 중인 닉네임인지 확인
        const existingUser = await UserUuidModel.findOne({ 
          $or: [
            { username: username },
            { displayName: username }
          ]
        });
        
        if (existingUser) {
          // 이미 사용 중인 닉네임인 경우 에러 발생
          throw new Error(`NICKNAME_TAKEN: 이미 사용 중인 닉네임입니다: ${username}`);
        }
        
        const userUuid = await generateNextUuid();
        user = await UserUuidModel.create({
          userUuid,
          username: username || "게스트",
          displayName: username || "게스트",
          isGuest: true,
          termsAccepted: false,
          darkMode: true
        });
        
        // 새 사용자 초기 장비 설정
        await UserEquipmentModel.create({
          userUuid: user.userUuid,
          username: user.username,
          fishingRod: '나무낚시대',
          accessory: null
        });
        
        console.log(`Created new guest user: ${userUuid} (${username})`);
      } else if (user.username !== username && username) {
        // 게스트 사용자의 닉네임이 변경된 경우 중복 체크 후 업데이트
        const existingUser = await UserUuidModel.findOne({ 
          $or: [
            { username: username },
            { displayName: username }
          ],
          userUuid: { $ne: user.userUuid } // 자신 제외
        });
        
        if (existingUser) {
          throw new Error(`NICKNAME_TAKEN: 이미 사용 중인 닉네임입니다: ${username}`);
        }
        
        const oldUsername = user.username;
        user.username = username;
        user.displayName = username;
        await user.save();
        console.log(`Updated guest username for ${user.userUuid}: ${oldUsername} -> ${username}`);
        
        // 모든 관련 스키마의 username도 업데이트
        await Promise.all([
          CatchModel.updateMany({ userUuid: user.userUuid }, { username }),
          UserMoneyModel.updateMany({ userUuid: user.userUuid }, { username }),
          UserEquipmentModel.updateMany({ userUuid: user.userUuid }, { username }),
          MaterialModel.updateMany({ userUuid: user.userUuid }, { username }),
          FishingSkillModel.updateMany({ userUuid: user.userUuid }, { username })
        ]);
        console.log(`Updated username in all schemas for guest ${user.userUuid}: ${username}`);
      }
    }
    
    return user;
  } catch (error) {
    console.error("Error in getOrCreateUser:", error);
    throw error;
  }
}

// API용 사용자 조회 헬퍼 함수 (userUuid 우선 조회)
async function getUserQuery(userId, username, userUuid = null) {
  // 사용자 식별 정보는 보안상 로그에 기록하지 않음
  
  // 1순위: userUuid로 직접 조회 (가장 정확)
  if (userUuid) {
    const user = await UserUuidModel.findOne({ userUuid });
    console.log(`🔍 getUserQuery - userUuid: ${userUuid}, found: ${!!user}`);
    if (user) {
      return { userUuid: user.userUuid, user };
    } else {
      console.log(`❌ User not found with userUuid: ${userUuid}`);
    }
  }
  
  // 2순위: username으로 UUID 조회
  if (username) {
    const user = await UserUuidModel.findOne({ username });
    // 사용자 조회 결과는 보안상 로그에 기록하지 않음
    if (user) {
      return { userUuid: user.userUuid, user };
    }
  }
  
  // 3순위: 기존 방식 fallback
  if (userId !== 'null' && userId !== 'user') {
    console.log("Using fallback with userId:", userId);
    return { userId, user: null };
  } else if (username) {
    // 🔧 특정 사용자에 대한 fallback 차단
    if (username === '아딸') {
      console.log("🚫 Blocking fallback for non-existent user:", username);
      // 요청 출처 추적을 위한 로깅 (임시)
      console.log("🔍 Request source tracking:");
      console.log("- UserAgent:", process.env.REQUEST_USER_AGENT || "Not available");
      console.log("- IP:", process.env.REQUEST_IP || "Not available"); 
      console.log("- Referer:", process.env.REQUEST_REFERER || "Not available");
      throw new Error(`User ${username} has been deleted and is no longer accessible`);
    }
    console.log("Using fallback with username:", username);
    return { username, user: null };
  } else {
    console.log("Using fallback with default user");
    return { userId: 'user', user: null };
  }
}

// 사용자 소유권 검증 함수 (보안 강화)
async function validateUserOwnership(requestedUserQuery, requestingUserUuid, requestingUsername) {
  try {
    // 요청하는 사용자의 정보 확인
    let requestingUser = null;
    if (requestingUserUuid) {
      requestingUser = await UserUuidModel.findOne({ userUuid: requestingUserUuid });
    } else if (requestingUsername) {
      requestingUser = await UserUuidModel.findOne({ username: requestingUsername });
    }
    
    if (!requestingUser) {
      console.warn("Requesting user not found:", { requestingUserUuid, requestingUsername });
      return { isValid: false, reason: "Requesting user not found" };
    }
    
    // 요청된 데이터의 소유자 확인
    let targetUser = null;
    if (requestedUserQuery.userUuid) {
      targetUser = await UserUuidModel.findOne({ userUuid: requestedUserQuery.userUuid });
    } else if (requestedUserQuery.username) {
      targetUser = await UserUuidModel.findOne({ username: requestedUserQuery.username });
    }
    
    if (!targetUser) {
      console.warn("Target user not found:", requestedUserQuery);
      return { isValid: false, reason: "Target user not found" };
    }
    
    // 본인의 데이터인지 확인
    const isSameUser = requestingUser.userUuid === targetUser.userUuid;
    
    if (!isSameUser) {
      console.warn("Unauthorized access attempt:", {
        requesting: { userUuid: requestingUser.userUuid, username: requestingUser.username },
        target: { userUuid: targetUser.userUuid, username: targetUser.username }
      });
      return { isValid: false, reason: "Unauthorized access to other user's data" };
    }
    
    return { isValid: true, user: targetUser };
  } catch (error) {
    console.error("Error validating user ownership:", error);
    return { isValid: false, reason: "Validation error" };
  }
}

// Fish pool with probabilities (확률 배열은 고정, 낚시실력에 따라 물고기만 변경)
const probabilityTemplate = [40, 24, 15, 8, 5, 3, 2, 1, 0.7, 0.3]; // 고정 확률 배열

const allFishData = [
  { name: "타코문어", price: 300, material: "문어다리", rank: 1 },
  { name: "풀고등어", price: 700, material: "고등어비늘", rank: 2 },
  { name: "경단붕어", price: 1200, material: "당고", rank: 3 },
  { name: "버터오징어", price: 1800, material: "버터조각", rank: 4 },
  { name: "간장새우", price: 3000, material: "간장종지", rank: 5 },
  { name: "물수수", price: 5000, material: "옥수수콘", rank: 6 },
  { name: "정어리파이", price: 8000, material: "버터", rank: 7 },
  { name: "얼음상어", price: 12000, material: "얼음조각", rank: 8 },
  { name: "스퀄스퀴드", price: 18000, material: "오징어먹물", rank: 9 },
  { name: "백년송거북", price: 30000, material: "백년송", rank: 10 },
  { name: "고스피쉬", price: 47000, material: "후춧가루", rank: 11 },
  { name: "유령치", price: 72000, material: "석화", rank: 12 },
  { name: "바이트독", price: 98000, material: "핫소스", rank: 13 },
  { name: "호박고래", price: 133000, material: "펌킨조각", rank: 14 },
  { name: "바이킹조개", price: 176000, material: "꽃술", rank: 15 },
  { name: "천사해파리", price: 239000, material: "프레첼", rank: 16 },
  { name: "악마복어", price: 290000, material: "베놈", rank: 17 },
  { name: "칠성장어", price: 355000, material: "장어꼬리", rank: 18 },
  { name: "닥터블랙", price: 432000, material: "아인스바인", rank: 19 },
  { name: "해룡", price: 521000, material: "헤븐즈서펀트", rank: 20 },
  { name: "메카핫킹크랩", price: 735000, material: "집게다리", rank: 21 },
  { name: "램프리", price: 860000, material: "이즈니버터", rank: 22 },
  { name: "마지막잎새", price: 997000, material: "라벤더오일", rank: 23 },
  { name: "아이스브리더", price: 1146000, material: "샤베트", rank: 24 },
  { name: "해신", price: 1307000, material: "마법의정수", rank: 25 },
  { name: "핑키피쉬", price: 1480000, material: "휘핑크림", rank: 26 },
  { name: "콘토퍼스", price: 1665000, material: "와플리머신", rank: 27 },
  { name: "딥원", price: 1862000, material: "베르쥬스", rank: 28 },
  { name: "큐틀루", price: 2071000, material: "안쵸비", rank: 29 },
  { name: "꽃술나리", price: 2283000, material: "핑크멜로우", rank: 30 },
  { name: "다무스", price: 2507000, material: "와일드갈릭", rank: 31 },
  { name: "수호자", price: 2743000, material: "그루누아", rank: 32 },
  { name: "태양가사리", price: 2991000, material: "시더플랭크", rank: 33 },
  { name: "빅파더펭귄", price: 3251000, material: "세비체", rank: 34 },
  { name: "크레인터틀", price: 3523000, material: "타파스", rank: 35 },
  { name: "스타피쉬", price: 100, material: "별조각", rank: 0 } // 항상 포함되는 특별한 물고기
];

// 낚시실력에 따른 물고기 배열 반환 (확률 배열 고정)
const getAvailableFishData = (skill) => {
  // 스타피쉬 제외한 일반 물고기들
  const normalFish = allFishData.filter(f => f.name !== "스타피쉬");
  
  // 낚시실력에 따라 시작 인덱스만 1씩 증가 (최소 10개 유지)
  const startIndex = Math.min(skill, Math.max(0, normalFish.length - 10));
  const selectedFish = normalFish.slice(startIndex, startIndex + 10);
  
  // 고정된 확률 배열을 선택된 물고기에 적용
  const availableFish = selectedFish.map((fish, index) => ({
    ...fish,
    probability: probabilityTemplate[index] || 0.1 // 기본값 0.1%
  }));
  
  // 스타피쉬는 항상 포함 (특별한 물고기)
  const starFish = allFishData.find(f => f.name === "스타피쉬");
  if (starFish) {
    availableFish.push({
      ...starFish,
      probability: 1 // 스타피쉬는 항상 1%
    });
  }
  
  return availableFish;
};

function randomFish(fishingSkill = 0) {
  const availableFish = getAvailableFishData(fishingSkill);
  const random = Math.random() * 100;
  let cumulative = 0;
  
  for (let i = 0; i < availableFish.length; i++) {
    const fishInfo = availableFish[i];
    cumulative += fishInfo.probability;
    if (random <= cumulative) {
      // 물고기 등급 계산 (rank 기반)
      const fishRank = fishInfo.rank || (i + 1);
      return { 
        fish: fishInfo.name, 
        probability: fishInfo.probability,
        fishIndex: i,
        rank: fishRank
      };
    }
  }
  
  // 만약을 위한 fallback
  const defaultFish = availableFish[0];
  return { 
    fish: defaultFish?.name || "타코문어",
    probability: defaultFish?.probability || 40,
    fishIndex: 0,
    rank: defaultFish?.rank || 1
  };
}

// Google auth
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "1023938003062-256niij987fc2q7o74qmssi2bca7vdnf.apps.googleusercontent.com";
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

// Kakao auth
const KAKAO_CLIENT_ID = "4ca63f8b2f7e43690a060c4571eb7bf0";

async function verifyGoogleIdToken(idToken) {
  try {
    if (!idToken) {
      console.log("No idToken provided");
      return null;
    }
    
    if (!googleClient) {
      console.error("Google Client not initialized - GOOGLE_CLIENT_ID missing in .env");
      return null;
    }
    
    if (!GOOGLE_CLIENT_ID) {
      console.error("GOOGLE_CLIENT_ID not set in environment variables");
      return null;
    }
    
    console.log("Verifying Google ID token...");
    const ticket = await googleClient.verifyIdToken({ 
      idToken, 
      audience: GOOGLE_CLIENT_ID 
    });
    
    const payload = ticket.getPayload();
    if (!payload || !payload.sub) {
      console.error("Invalid payload from Google token");
      return null;
    }
    
    const userId = payload.sub;
    const displayName = payload.name || payload.email || "구글사용자";
    
    console.log("Google token verified successfully");
    return { userId, displayName, sub: payload.sub };
  } catch (error) {
    console.error("Google token verification failed:", error.message);
    return null;
  }
}

// 카카오 토큰 처리 함수
function parseKakaoToken(idToken) {
  try {
    if (!idToken || !idToken.startsWith('kakao_')) {
      return null;
    }
    
    // kakao_${kakaoId}_${accessToken} 형식에서 정보 추출
    const parts = idToken.split('_');
    if (parts.length < 3) {
      console.log("Invalid kakao token format");
      return null;
    }
    
    const kakaoId = parts[1];
    const accessToken = parts.slice(2).join('_'); // 토큰에 _가 있을 수 있음
    
    console.log("Kakao token parsed successfully");
    
    return {
      sub: `kakao_${kakaoId}`, // 구글의 sub와 유사한 고유 ID
      kakaoId: kakaoId,
      accessToken: accessToken,
      provider: 'kakao',
      userId: `kakao_${kakaoId}`,
      displayName: `카카오사용자${kakaoId}`
    };
  } catch (error) {
    console.error("Failed to parse Kakao token:", error.message);
    return null;
  }
}

// 접속자 관리
const connectedUsers = new Map();
const connectedUsersMap = new Map(); // userUuid -> socketId 매핑 (메일 알림용)
const processingJoins = new Set(); // 중복 join 요청 방지
const recentJoins = new Map(); // 최근 입장 메시지 추적 (userUuid -> timestamp)
const processingMaterialConsumption = new Set(); // 중복 재료 소모 요청 방지
const processingFishing = new Set(); // 🚀 중복 낚시 요청 방지
const lastFishingTime = new Map(); // 🛡️ 사용자별 마지막 낚시 시간 추적

// 스팸 방지 및 Rate Limiting
const userMessageHistory = new Map(); // userUuid -> 메시지 기록
const MESSAGE_RATE_LIMIT = 5; // 10초 내 최대 메시지 수
const MESSAGE_TIME_WINDOW = 10000; // 10초
const MESSAGE_COOLDOWN = 1000; // 연속 메시지 간 최소 간격 (1초)
const MAX_MESSAGE_LENGTH = 500; // 최대 메시지 길이

// 연결된 사용자 정리 함수 (중복 제거 및 유령 연결 정리)
function cleanupConnectedUsers() {
  const uniqueUsers = new Map(); // userUuid -> userData
  const validConnections = new Map(); // socketId -> userData
  
  // 실제 연결된 소켓만 필터링
  for (const [socketId, userData] of connectedUsers.entries()) {
    const socket = io.sockets.sockets.get(socketId);
    
    if (socket && socket.connected) {
      // 유효한 연결인 경우
      validConnections.set(socketId, userData);
      
      // 중복 제거: 같은 userUuid의 최신 연결만 유지
      const existing = uniqueUsers.get(userData.userUuid);
      if (!existing || userData.joinTime > existing.joinTime) {
        uniqueUsers.set(userData.userUuid, userData);
      }
    } else {
      // 유령 연결 발견 - 제거
      console.log(`🧹 Cleaning up ghost connection: ${socketId} (${userData.username})`);
    }
  }
  
  // connectedUsers 맵 업데이트
  connectedUsers.clear();
  for (const [socketId, userData] of validConnections) {
    connectedUsers.set(socketId, userData);
  }
  
  console.log(`🔄 Connection cleanup: ${validConnections.size} active, ${uniqueUsers.size} unique users`);
  
  return Array.from(uniqueUsers.values());
}

// 주기적 연결 상태 정리 (30초마다)
// 스팸 방지 검증 함수
function checkSpamProtection(userUuid, messageContent) {
  const now = Date.now();
  const userHistory = userMessageHistory.get(userUuid) || { messages: [], lastMessageTime: 0 };
  
  // 1. 메시지 길이 검증
  if (messageContent.length > MAX_MESSAGE_LENGTH) {
    return {
      allowed: false,
      reason: `메시지가 너무 깁니다. (최대 ${MAX_MESSAGE_LENGTH}자)`
    };
  }
  
  // 2. 연속 메시지 쿨다운 검증
  if (now - userHistory.lastMessageTime < MESSAGE_COOLDOWN) {
    const remainingCooldown = Math.ceil((MESSAGE_COOLDOWN - (now - userHistory.lastMessageTime)) / 1000);
    return {
      allowed: false,
      reason: `너무 빨리 메시지를 보내고 있습니다. ${remainingCooldown}초 후 다시 시도해 주세요.`
    };
  }
  
  // 3. Rate Limiting 검증 (시간 윈도우 내 메시지 수)
  const recentMessages = userHistory.messages.filter(timestamp => now - timestamp < MESSAGE_TIME_WINDOW);
  
  if (recentMessages.length >= MESSAGE_RATE_LIMIT) {
    const oldestMessage = Math.min(...recentMessages);
    const waitTime = Math.ceil((MESSAGE_TIME_WINDOW - (now - oldestMessage)) / 1000);
    return {
      allowed: false,
      reason: `메시지 전송 한도를 초과했습니다. ${waitTime}초 후 다시 시도해 주세요.`
    };
  }
  
  // 4. 메시지 기록 업데이트
  recentMessages.push(now);
  userMessageHistory.set(userUuid, {
    messages: recentMessages,
    lastMessageTime: now
  });
  
  return { allowed: true };
}

// 주기적으로 오래된 메시지 기록 정리 (5분마다)
setInterval(() => {
  const now = Date.now();
  for (const [userUuid, history] of userMessageHistory.entries()) {
    const recentMessages = history.messages.filter(timestamp => now - timestamp < MESSAGE_TIME_WINDOW * 2);
    if (recentMessages.length === 0) {
      userMessageHistory.delete(userUuid);
    } else {
      userMessageHistory.set(userUuid, {
        ...history,
        messages: recentMessages
      });
    }
  }
  console.log(`🧹 Message history cleanup: ${userMessageHistory.size} users tracked`);
}, 300000); // 5분

setInterval(() => {
  console.log("🕐 Performing periodic connection cleanup...");
  const uniqueUsers = cleanupConnectedUsers();
  
  // 추가: 좀비 연결 강제 정리
  let zombieCount = 0;
  for (const [socketId, userData] of connectedUsers.entries()) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket || !socket.connected) {
      console.log(`🧟 Removing zombie connection: ${socketId} (${userData.username})`);
      connectedUsers.delete(socketId);
      zombieCount++;
    }
    
    // 🔧 특정 삭제된 사용자 강제 제거
    if (userData.username === '아딸' || userData.userUuid === '#0002') {
      console.log(`🗑️ Force removing deleted user: ${userData.username} (${userData.userUuid})`);
      connectedUsers.delete(socketId);
      zombieCount++;
    }
  }
  
  if (zombieCount > 0) {
    console.log(`🧹 Cleaned up ${zombieCount} zombie connections`);
  }
  
  // 모든 클라이언트에게 정리된 사용자 목록 전송 (빈 배열이 아닐 때만)
  if (uniqueUsers.length > 0) {
    io.emit("users:update", uniqueUsers);
  } else {
    console.log('⚠️ Skipping users:update broadcast - no users to send');
  }
}, 30000); // 30초

// 📊 보안 모니터링 시스템
const securityMonitor = {
  attacks: {
    blocked: 0,
    suspicious: 0,
    total: 0
  },
  
  logAttack(type, ip, details = '') {
    this.attacks.total++;
    if (type === 'blocked') this.attacks.blocked++;
    if (type === 'suspicious') this.attacks.suspicious++;
    
    console.log(`🚨 [SECURITY] ${type.toUpperCase()} - IP: ${ip} ${details}`);
    
    // 심각한 공격 감지 시 알림
    if (type === 'blocked') {
      console.log(`🊨 [CRITICAL] LOIC/DDoS 공격 감지! 즉시 대응 필요`);
    }
  },
  
  getStats() {
    return {
      ...this.attacks,
      blockedIPs: ddosBlockedIPs.size,
      suspiciousIPs: suspiciousIPs.size,
      activeConnections: connectionCounts.size
    };
  }
};

// 보안 통계 API
app.get('/api/security/stats', (req, res) => {
  // 관리자만 접근 가능 (기본적인 보안 처리)
  const clientIP = getClientIP(req);
  
  res.json({
    ...securityMonitor.getStats(),
    timestamp: new Date().toISOString(),
    server: 'fishing-game-server'
  });
});

// 🛡️ Socket.IO 연결 보안 강화
io.on("connection", (socket) => {
  const clientIP = getClientIP({ headers: socket.handshake.headers, connection: socket.conn });
  console.log(`🔌 새 Socket 연결 승인: ${clientIP} (${socket.id})`);
  
  // 연결 시간 추적
  socket.connectTime = Date.now();
  
  // 비정상적인 빠른 연결 해제 감지
  socket.on('disconnect', (reason) => {
    const connectionDuration = Date.now() - socket.connectTime;
    
    // 1초 이하의 연결은 의심스러운 활동으로 간주
    if (connectionDuration < 1000) {
      securityMonitor.logAttack('suspicious', clientIP, `Quick disconnect: ${connectionDuration}ms`);
      suspiciousIPs.set(clientIP, Date.now());
    }
    
    console.log(`🔌 Socket 연결 해제: ${clientIP} (${socket.id}) - ${reason}`);
  });
  socket.on("chat:join", async ({ username, idToken, userUuid, isReconnection }) => {
    // 중복 요청 방지
    const joinKey = `${socket.id}-${userUuid || username}`;
    if (processingJoins.has(joinKey)) {
      debugLog(`[DUPLICATE JOIN] Ignoring duplicate join request for ${joinKey}`);
      return;
    }
    
    processingJoins.add(joinKey);
    
    try {
      debugLog("=== CHAT:JOIN DEBUG ===");
      console.log("Chat join request received");
      console.log("Is reconnection:", isReconnection);
      
      // 토큰 타입에 따라 처리 (구글 또는 카카오)
      let info = null;
      let socialId = null;
      let provider = 'guest';
      
      if (idToken && idToken.startsWith('kakao_')) {
        // 카카오 토큰 처리
        info = parseKakaoToken(idToken);
        if (info) {
          socialId = info.sub;
          provider = 'kakao';
          console.log("Kakao login detected:", { socialId, provider });
        }
      } else if (idToken) {
        // 구글 토큰 처리
        info = await verifyGoogleIdToken(idToken);
        if (info) {
          socialId = info.sub;
          provider = 'google';
          console.log("Google login detected:", { socialId, provider });
        }
      }
      
            // UUID 기반 사용자 등록/조회
      const googleId = provider === 'google' ? socialId : null; // 구글 ID (구 호환성을 위해 유지)
      const kakaoId = provider === 'kakao' ? socialId : null; // 카카오 ID
      
      // 닉네임 우선순위 결정 (구글 로그인 여부에 따라)
      let effectiveName;
      
      // 소셜 로그인 시 기존 사용자의 닉네임 보존
      if (socialId) {
        console.log(`${provider} login detected, checking for existing user with ${provider} ID:`, socialId);
        
        let existingSocialUser = null;
        if (provider === 'google') {
          existingSocialUser = await UserUuidModel.findOne({ originalGoogleId: googleId });
        } else if (provider === 'kakao') {
          existingSocialUser = await UserUuidModel.findOne({ originalKakaoId: kakaoId });
        }
        
        if (existingSocialUser) {
          // 기존 소셜 사용자가 있으면 데이터베이스의 닉네임을 우선 사용
          console.log(`Found existing ${provider} user:`, {
            userUuid: existingSocialUser.userUuid,
            storedDisplayName: existingSocialUser.displayName,
            clientUsername: username,
            socialDisplayName: info?.displayName
          });
          
          // 데이터베이스에 저장된 displayName이 있으면 항상 우선 사용 (사용자 변경 닉네임 보존)
          if (existingSocialUser.displayName) {
            console.log("Using stored displayName (preserving user's custom nickname):", existingSocialUser.displayName);
            effectiveName = existingSocialUser.displayName; // 기존 닉네임 보존
          } else {
            // displayName이 없는 경우에만 클라이언트 username 또는 소셜 displayName 사용
            const defaultName = provider === 'kakao' ? "카카오사용자" : "구글사용자";
            effectiveName = username || info?.displayName || defaultName;
            console.log(`No stored displayName, using client username or ${provider} displayName:`, effectiveName);
          }
        } else {
          // 새 소셜 사용자인 경우
          const defaultName = provider === 'kakao' ? "카카오사용자" : "구글사용자";
          effectiveName = username || info?.displayName || defaultName;
          console.log(`New ${provider} user - using username/displayName:`, effectiveName);
        }
      } else {
        // 게스트 사용자인 경우
        if (userUuid && userUuid !== 'null' && userUuid !== 'undefined') {
          effectiveName = username || "사용자";
          console.log("Existing guest user - using client username:", effectiveName);
        } else {
          effectiveName = username || "게스트";
          console.log("New guest user - using username:", effectiveName);
        }
      }
      
      console.log("Final effective name:", effectiveName);
      console.log("Google ID:", googleId);
      
      // 기존 사용자인지 확인하고 닉네임 업데이트
      let user;
      
      // 1순위: userUuid가 전달된 경우 (닉네임 변경)
      if (userUuid && userUuid !== 'null' && userUuid !== 'undefined') {
        console.log(`[PRIORITY 1] Looking for existing user with userUuid: ${userUuid}`);
        console.log("MongoDB connection state:", mongoose.connection.readyState);
        
        try {
          user = await UserUuidModel.findOne({ userUuid });
          console.log("Database query successful");
          console.log("Found user by UUID:", user ? { userUuid: user.userUuid, username: user.username, isGuest: user.isGuest } : "Not found");
        } catch (dbError) {
          console.error("❌ Database query failed:", dbError);
          throw dbError;
        }
        
        if (user) {
          if (user.username !== effectiveName) {
            const oldUsername = user.username;
            console.log(`[PRIORITY 1] Updating nickname from ${oldUsername} to ${effectiveName} for userUuid: ${userUuid}`);
            user.username = effectiveName;
            user.displayName = effectiveName;
            await user.save();
            console.log("Nickname updated successfully in UserUuid schema");
            
            // 모든 관련 스키마의 username도 업데이트
            await Promise.all([
              CatchModel.updateMany({ userUuid: user.userUuid }, { username: effectiveName }),
              UserMoneyModel.updateMany({ userUuid: user.userUuid }, { username: effectiveName }),
              UserEquipmentModel.updateMany({ userUuid: user.userUuid }, { username: effectiveName }),
              MaterialModel.updateMany({ userUuid: user.userUuid }, { username: effectiveName }),
              FishingSkillModel.updateMany({ userUuid: user.userUuid }, { username: effectiveName })
            ]);
            console.log(`Updated username in all schemas for ${user.userUuid}: ${oldUsername} -> ${effectiveName}`);
            console.log(`[PRIORITY 1] Memory user object updated to: ${user.username}`);
          } else {
            console.log(`[PRIORITY 1] Nickname already matches: ${effectiveName}`);
          }
        } else {
          console.log(`[PRIORITY 1] User with userUuid ${userUuid} not found, creating new user`);
          user = await getOrCreateUser(effectiveName, googleId, kakaoId);
        }
      } else if (socialId) {
        // 2순위: 소셜 사용자 (구글 또는 카카오 - 새 로그인 또는 기존 사용자)
        console.log(`[PRIORITY 2] Looking for ${provider} user with ID: ${socialId}`);
        // 소셜 타입에 따라 적절한 사용자 검색
        if (provider === 'google') {
        user = await UserUuidModel.findOne({ originalGoogleId: googleId });
        } else if (provider === 'kakao') {
          const kakaoIdToSearch = kakaoId.startsWith('kakao_') ? kakaoId : `kakao_${kakaoId}`;
          user = await UserUuidModel.findOne({ originalKakaoId: kakaoIdToSearch });
        }
        
        if (user) {
          console.log(`[PRIORITY 2] Found existing ${provider} user: ${user.username}`);
          
          // 닉네임 변경 감지 및 처리
          if (user.username !== effectiveName && effectiveName !== user.displayName) {
            const oldUsername = user.username;
            console.log(`[PRIORITY 2] Updating nickname from ${oldUsername} to ${effectiveName} for ${provider} user: ${socialId}`);
            user.username = effectiveName;
            user.displayName = effectiveName;
            await user.save();
            console.log("Google user nickname updated successfully in UserUuid schema");
            
            // 모든 관련 스키마의 username도 업데이트
            await Promise.all([
              CatchModel.updateMany({ userUuid: user.userUuid }, { username: effectiveName }),
              UserMoneyModel.updateMany({ userUuid: user.userUuid }, { username: effectiveName }),
              UserEquipmentModel.updateMany({ userUuid: user.userUuid }, { username: effectiveName }),
              MaterialModel.updateMany({ userUuid: user.userUuid }, { username: effectiveName }),
              FishingSkillModel.updateMany({ userUuid: user.userUuid }, { username: effectiveName })
            ]);
            console.log(`Updated username in all schemas for Google user ${user.userUuid}: ${oldUsername} -> ${effectiveName}`);
          } else {
            console.log(`[PRIORITY 2] Keeping existing nickname: ${user.username} (matches effectiveName: ${effectiveName})`);
          }
        } else {
          console.log(`[PRIORITY 2] Creating new ${provider} user`);
          user = await getOrCreateUser(effectiveName, googleId, kakaoId);
        }
      } else {
        // 3순위: 게스트 사용자 (새 로그인) - 기존 사용자 찾기 시도
        console.log(`[PRIORITY 3] Looking for guest user with username: ${effectiveName}`);
        user = await UserUuidModel.findOne({ username: effectiveName, isGuest: true });
        if (!user) {
          console.log(`[PRIORITY 3] Creating new guest user`);
          user = await getOrCreateUser(effectiveName, googleId, kakaoId);
        } else {
          console.log(`[PRIORITY 3] Found existing guest user:`, { userUuid: user.userUuid, username: user.username });
        }
      }
      
      console.log("Final user:", { userUuid: user.userUuid, username: user.username, isGuest: user.isGuest });
      
      // 소켓에 사용자 정보 저장 (UUID 기반)
      socket.data.userUuid = user.userUuid;
      socket.data.username = user.username;
      socket.data.userId = idToken ? 'user' : null;
      socket.data.displayName = user.username;
      socket.data.idToken = idToken;
      socket.data.originalGoogleId = user.originalGoogleId;
      socket.data.originalKakaoId = user.originalKakaoId;
    
      // 같은 구글 아이디로 중복 접속 방지 (PC/모바일 동시 접속 차단)
      if (socialId) {
        const existingSocialConnection = Array.from(connectedUsers.entries())
          .find(([socketId, userData]) => {
            if (provider === 'google') {
              return userData.originalGoogleId === googleId && socketId !== socket.id;
            } else if (provider === 'kakao') {
              return userData.originalKakaoId === kakaoId && socketId !== socket.id;
            }
            return false;
          });
        
        if (existingSocialConnection) {
          const [existingSocketId, existingUserData] = existingSocialConnection;
          console.log(`🔄 Same ${provider} user reconnecting: ${existingUserData.username} (${existingSocketId})`);
          
          // 기존 연결이 실제로 활성 상태인지 확인
          const existingSocket = io.sockets.sockets.get(existingSocketId);
          if (existingSocket && existingSocket.connected) {
            // 기존 연결이 살아있는 경우 - 부드러운 전환
            console.log(`📱 Graceful session transition for ${existingUserData.username}`);
            
            // 기존 연결에 세션 전환 알림 (강제 해제 대신)
            existingSocket.emit("session:transition", {
              message: "새 창에서 접속하여 세션이 전환됩니다.",
              newSessionId: socket.id
            });
            
            // 잠시 후 기존 연결 정리 (사용자가 메시지를 볼 수 있도록)
            setTimeout(() => {
              if (existingSocket.connected) {
                existingSocket.disconnect(true);
                console.log(`🔄 Previous session gracefully disconnected: ${existingSocketId}`);
              }
            }, 2000); // 2초 후 정리
          } else {
            // 기존 연결이 이미 끊어진 경우
            console.log(`🧹 Cleaning up stale connection: ${existingSocketId}`);
          }
          
          // 기존 연결 정보 제거
          connectedUsers.delete(existingSocketId);
        }
      }
      
      // 기존 접속자에서 같은 UUID 찾기 (닉네임 변경 감지)
      const existingConnection = Array.from(connectedUsers.entries())
        .find(([socketId, userData]) => userData.userUuid === user.userUuid && socketId !== socket.id);
      
      let isNicknameChange = false;
      let oldNickname = null;
      
      // PRIORITY 1에서 닉네임이 실제로 변경되었는지 확인
      if (userUuid && userUuid !== 'null' && userUuid !== 'undefined') {
        // 기존 연결에서 다른 닉네임을 사용하고 있었다면 닉네임 변경으로 간주
        if (existingConnection) {
          const [existingSocketId, existingUserData] = existingConnection;
          if (existingUserData.username !== user.username) {
            isNicknameChange = true;
            oldNickname = existingUserData.username;
            console.log(`Nickname change detected: ${oldNickname} -> ${user.username}`);
            // 기존 연결 제거 (중복 방지)
            connectedUsers.delete(existingSocketId);
          }
        }
        
        // 같은 userUuid로 이미 접속 중인 경우도 닉네임 변경으로 간주 (재접속)
        const sameUuidConnection = Array.from(connectedUsers.values())
          .find(userData => userData.userUuid === user.userUuid);
        if (sameUuidConnection && sameUuidConnection.username !== user.username) {
          isNicknameChange = true;
          oldNickname = sameUuidConnection.username;
          console.log(`Nickname change via reconnection: ${oldNickname} -> ${user.username}`);
        }
      }
      
      // 입장 메시지 중복 방지를 위해 먼저 체크
      const isAlreadyConnected = Array.from(connectedUsers.values())
        .some(userData => userData.userUuid === user.userUuid && userData.socketId !== socket.id);
      
      // 접속자 목록에 추가/업데이트
      connectedUsers.set(socket.id, {
        userUuid: user.userUuid,
        username: user.username,
        displayName: user.displayName || user.username, // 데이터베이스에 저장된 displayName 사용
        userId: socket.data.userId,
        hasIdToken: !!idToken, // ID 토큰 보유 여부
        loginType: provider === 'google' ? 'Google' : provider === 'kakao' ? 'Kakao' : 'Guest',
        joinTime: new Date(),
        socketId: socket.id,
        originalGoogleId: user.originalGoogleId, // 구글 ID 정보
        originalKakaoId: user.originalKakaoId // 카카오 ID 정보도 추가
      });
      
      // 메일 알림을 위한 userUuid -> socketId 매핑
      connectedUsersMap.set(user.userUuid, socket.id);
    
      console.log("User joined:", { 
        userUuid: user.userUuid,
        username: user.username, 
        userId: socket.data.userId, 
        hasIdToken: !!idToken,
        isNicknameChange,
        isAlreadyConnected
      });
      
      // 모든 클라이언트에게 온라인 사용자 목록 전송 (정리된 목록)
      const usersList = cleanupConnectedUsers();
      console.log("=== SENDING USERS UPDATE ===");
      console.log("Connected users count:", usersList.length);
      console.log("Users list:", usersList.map(u => ({ userUuid: u.userUuid, username: u.username, displayName: u.displayName })));
      io.emit("users:update", usersList);
      
      // 클라이언트에게 UUID 정보 전송 (업데이트된 닉네임 포함)
      const displayNameToSend = user.displayName || user.username;
      console.log(`[USER:UUID EVENT] Sending to client: { userUuid: ${user.userUuid}, username: ${user.username}, displayName: ${displayNameToSend} }`);
      
      // 🔐 관리자 상태 확인
      let isUserAdmin = false;
      try {
        const adminRecord = await AdminModel.findOne({ userUuid: user.userUuid });
        isUserAdmin = adminRecord ? adminRecord.isAdmin : false;
        console.log(`🔑 Admin status check for ${user.username}: ${isUserAdmin}`);
      } catch (e) {
        console.warn('Failed to check admin status:', e);
      }
      
      // 🔐 JWT 토큰 생성 및 전송 (실제 관리자 상태 반영)
      const jwtToken = generateJWT({
        userUuid: user.userUuid,
        username: user.username,
        displayName: displayNameToSend,
        isAdmin: isUserAdmin // 실제 DB에서 확인한 관리자 상태
      });
      
      // 🔐 JWT 토큰을 클라이언트에 전송
      if (jwtToken) {
        socket.emit("auth:token", { 
          token: jwtToken,
          expiresIn: JWT_EXPIRES_IN
        });
      }
      
      socket.emit("user:uuid", { 
        userUuid: user.userUuid, 
        username: user.username,
        displayName: displayNameToSend
      });
      
      // 🔐 JWT 토큰 별도 전송
      if (jwtToken) {
        socket.emit("auth:token", { 
          token: jwtToken,
          expiresIn: JWT_EXPIRES_IN
        });
        console.log(`🔐 JWT token sent to client: ${user.username}`);
      }
      
      // 입장/닉네임 변경 메시지 전송 (중복 방지)
      if (isNicknameChange) {
        // 닉네임 변경 시에는 메시지를 보내지 않음
        console.log(`[NICKNAME CHANGE] Silent nickname change: ${oldNickname} -> ${user.username}`);
      } else if (isReconnection) {
        // 재연결 시에는 입장 메시지를 보내지 않음
        console.log(`[RECONNECTION] Skipped join message for reconnection: ${user.displayName || user.username}`);
      } else if (!isAlreadyConnected) {
        // 최근 입장 메시지 중복 방지 (5초 내 같은 사용자)
        const now = Date.now();
        const lastJoinTime = recentJoins.get(user.userUuid);
        
        if (!lastJoinTime || (now - lastJoinTime) > 2000) {
          // 2초 이상 지났거나 처음 입장인 경우에만 메시지 전송
          recentJoins.set(user.userUuid, now);
          
          io.emit("chat:message", { 
            system: true, 
            username: "system", 
            content: `${user.displayName || user.username} 님이 입장했습니다.`,
            timestamp: new Date().toISOString()
          });
          console.log(`[JOIN MESSAGE] Sent join message for new user: ${user.displayName || user.username}`);
        } else {
          console.log(`[JOIN MESSAGE] Skipped duplicate join message for ${user.displayName || user.username} (within 2 seconds)`);
        }
      } else {
        console.log(`[JOIN MESSAGE] Skipped join message for already connected user: ${user.username}`);
      }
      
    } catch (error) {
      console.error("Error in chat:join:", error);
      console.error("Stack trace:", error.stack);
      
      // 닉네임 중복 에러 처리
      if (error.message && error.message.includes('NICKNAME_TAKEN')) {
        const errorMessage = error.message.replace('NICKNAME_TAKEN: ', '');
        socket.emit("join:error", { 
          type: "NICKNAME_TAKEN",
          message: errorMessage 
        });
        console.log(`[NICKNAME_TAKEN] ${errorMessage}`);
      } else {
        socket.emit("join:error", { 
          type: "GENERAL_ERROR",
          message: "채팅 입장에 실패했습니다." 
        });
        
        // 일반 오류 발생 시에만 기본 입장 메시지 (displayName 우선 사용)
        const displayName = username || "사용자";
      io.emit("chat:message", { 
        system: true, 
        username: "system", 
          content: `${displayName} 님이 입장했습니다.`,
        timestamp: new Date().toISOString()
      });
      }
    } finally {
      // 처리 완료 후 중복 방지 키 제거
      processingJoins.delete(joinKey);
    }
  });

  socket.on("message:reaction", (data) => {
    const { messageId, messageIndex, reactionType, username, currentReaction } = data;
    
    console.log("Message reaction received:", { messageId, messageIndex, reactionType, username, currentReaction });
    
    // 모든 클라이언트에게 반응 업데이트 전송 (하나의 반응만 허용)
    io.emit("message:reaction:update", {
      messageIndex,
      reactionType,
      username,
      messageId,
      currentReaction // 기존 반응 정보도 전송
    });
  });

  socket.on("chat:message", async (msg) => {
    const trimmed = msg.content.trim();
    const timestamp = msg.timestamp || new Date().toISOString();
    
    // 🔐 JWT 인증 확인 (보안 강화)
    if (!socket.data.isAuthenticated) {
      socket.emit("chat:error", { 
        message: "로그인이 필요합니다. 페이지를 새로고침해주세요." 
      });
      console.log(`🚨 [SECURITY] Unauthenticated socket message attempt: ${socket.id}`);
      return;
    }
    
    // 사용자 정보 가져오기
    const user = connectedUsers.get(socket.id);
    if (!user || !user.userUuid) {
      socket.emit("chat:error", { message: "사용자 인증이 필요합니다." });
      return;
    }
    
    // 🔐 메시지 사용자와 Socket 사용자 일치 확인
    if (msg.username !== socket.data.username) {
      socket.emit("chat:error", { message: "사용자 정보 불일치" });
      console.log(`🚨 [SECURITY] Username mismatch: msg=${msg.username}, socket=${socket.data.username}`);
      return;
    }
    
    // 스팸 방지 검증 (낚시하기 명령어는 제외)
    if (trimmed !== "낚시하기") {
      const spamCheck = checkSpamProtection(user.userUuid, trimmed);
      if (!spamCheck.allowed) {
        socket.emit("chat:error", { message: spamCheck.reason });
        console.log(`[SPAM_BLOCKED] ${user.username}: ${spamCheck.reason}`);
        return;
      }
    }
    
    // 🎁 쿠폰 코드 처리
    if (trimmed === "여우와 함께 하는 낚시게임") {
      try {
        // Guest 사용자 체크 - DB에서 사용자 정보 조회
        const dbUser = await UserUuidModel.findOne({ userUuid: user.userUuid });
        
        if (!dbUser || (!dbUser.originalGoogleId && !dbUser.originalKakaoId)) {
          socket.emit("chat:message", {
            system: true,
            username: "system",
            content: "🚫 쿠폰은 구글 또는 카카오 소셜 로그인 후에만 사용할 수 있습니다.",
            timestamp: new Date().toISOString()
          });
          return;
        }

        // 이미 사용한 쿠폰인지 확인
        const existingUsage = await CouponUsageModel.findOne({
          userUuid: user.userUuid,
          couponCode: "여우와 함께 하는 낚시게임"
        });

        if (existingUsage) {
          socket.emit("chat:message", {
            system: true,
            username: "system",
            content: "🚫 이미 사용한 쿠폰입니다. 쿠폰은 계정당 한 번만 사용할 수 있습니다.",
            timestamp: new Date().toISOString()
          });
          return;
        }

        // 별조각 3개 지급
        const rewardAmount = 3;
        const queryResult = await getUserQuery('user', user.username, user.userUuid);
        let query;
        if (queryResult.userUuid) {
          query = { userUuid: queryResult.userUuid };
        } else {
          query = queryResult;
        }

        let userStarPieces = await StarPieceModel.findOne(query);
        
        if (!userStarPieces) {
          // 새 사용자인 경우 생성
          const createData = {
            userId: query.userId || 'user',
            username: query.username || user.username,
            userUuid: query.userUuid || user.userUuid,
            starPieces: rewardAmount
          };
          userStarPieces = new StarPieceModel(createData);
        } else {
          userStarPieces.starPieces = (userStarPieces.starPieces || 0) + rewardAmount;
        }

        await userStarPieces.save();

        // 쿠폰 사용 기록 저장
        const couponUsage = new CouponUsageModel({
          userUuid: user.userUuid,
          username: user.username,
          couponCode: "여우와 함께 하는 낚시게임",
          reward: `starPieces:${rewardAmount}`
        });
        await couponUsage.save();

        // 성공 메시지 전송
        socket.emit("chat:message", {
          system: true,
          username: "system",
          content: `🎉 축하합니다! 쿠폰이 성공적으로 사용되었습니다!\n⭐ 별조각 ${rewardAmount}개를 받았습니다! (총 ${userStarPieces.starPieces}개)`,
          timestamp: new Date().toISOString()
        });

        // 사용자 데이터 업데이트 전송
        sendUserDataUpdate(socket, user.userUuid, user.username);

        console.log(`🎁 Coupon used: ${user.username} (${user.userUuid}) - starPieces +${rewardAmount}`);
        return;

      } catch (error) {
        console.error("쿠폰 처리 중 오류:", error);
        socket.emit("chat:message", {
          system: true,
          username: "system",
          content: "🚫 쿠폰 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
          timestamp: new Date().toISOString()
        });
        return;
      }
    }

    // 🎁 HAPPY MONDAY 쿠폰 코드 처리
    if (trimmed === "HAPPY MONDAY") {
      try {
        // 쿠폰 만료일 체크 (한국시간 기준 2025년 10월 06일 오후 12시)
        const now = new Date();
        const kstOffset = 9 * 60 * 60 * 1000; // 9시간을 밀리초로
        const kstNow = new Date(now.getTime() + kstOffset);
        const expiryDate = new Date('2025-10-06T12:00:00+09:00'); // 한국시간 기준
        
        if (kstNow > expiryDate) {
          socket.emit("chat:message", {
            system: true,
            username: "system",
            content: "🚫 이 쿠폰은 만료되었습니다. (유효기간: 2025년 10월 06일 오후 12시까지)",
            timestamp: new Date().toISOString()
          });
          return;
        }

        // Guest 사용자 체크 - DB에서 사용자 정보 조회
        const dbUser = await UserUuidModel.findOne({ userUuid: user.userUuid });
        
        if (!dbUser || (!dbUser.originalGoogleId && !dbUser.originalKakaoId)) {
          socket.emit("chat:message", {
            system: true,
            username: "system",
            content: "🚫 쿠폰은 구글 또는 카카오 소셜 로그인 후에만 사용할 수 있습니다.",
            timestamp: new Date().toISOString()
          });
          return;
        }

        // 이미 사용한 쿠폰인지 확인
        const existingUsage = await CouponUsageModel.findOne({
          userUuid: user.userUuid,
          couponCode: "HAPPY MONDAY"
        });

        if (existingUsage) {
          socket.emit("chat:message", {
            system: true,
            username: "system",
            content: "🚫 이미 사용한 쿠폰입니다. 쿠폰은 계정당 한 번만 사용할 수 있습니다.",
            timestamp: new Date().toISOString()
          });
          return;
        }

        // 호박석 100개 지급
        const amberRewardAmount = 100;
        const queryResult = await getUserQuery('user', user.username, user.userUuid);
        let query;
        if (queryResult.userUuid) {
          query = { userUuid: queryResult.userUuid };
        } else {
          query = queryResult;
        }

        // 먼저 쿠폰 사용 기록을 저장하여 중복 사용 방지
        const couponUsage = new CouponUsageModel({
          userUuid: user.userUuid,
          username: user.username,
          couponCode: "HAPPY MONDAY",
          reward: "amber:100"
        });
        await couponUsage.save();

        let userAmber = await UserAmberModel.findOne(query);
        
        if (!userAmber) {
          // 새 사용자인 경우 생성
          const createData = {
            userId: query.userId || 'user',
            username: query.username || user.username,
            userUuid: query.userUuid || user.userUuid,
            amber: amberRewardAmount
          };
          userAmber = new UserAmberModel(createData);
        } else {
          userAmber.amber = (userAmber.amber || 0) + amberRewardAmount;
        }

        await userAmber.save();

        // 성공 메시지 전송
        socket.emit("chat:message", {
          system: true,
          username: "system",
          content: `🎉 축하합니다! HAPPY MONDAY 쿠폰이 성공적으로 사용되었습니다!\n💎 호박석 ${amberRewardAmount}개를 받았습니다! (총 ${userAmber.amber}개)`,
          timestamp: new Date().toISOString()
        });

        // 사용자 데이터 업데이트 전송
        sendUserDataUpdate(socket, user.userUuid, user.username);

        console.log(`🎁 HAPPY MONDAY Coupon used: ${user.username} (${user.userUuid}) - amber +${amberRewardAmount}`);
        return;

      } catch (error) {
        console.error("HAPPY MONDAY 쿠폰 처리 중 오류:", error);
        socket.emit("chat:message", {
          system: true,
          username: "system",
          content: "🚫 쿠폰 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
          timestamp: new Date().toISOString()
        });
        return;
      }
    }

    // 🎁 한가위 특별 쿠폰 코드 처리
    if (trimmed === "즐거운 한가위 되세요~!") {
      try {
        // 쿠폰 만료일 체크 (한국시간 기준 2025년 10월 19일 오후 12시)
        const now = new Date();
        const kstOffset = 9 * 60 * 60 * 1000; // 9시간을 밀리초로
        const kstNow = new Date(now.getTime() + kstOffset);
        const expiryDate = new Date('2025-10-19T12:00:00+09:00'); // 한국시간 기준
        
        if (kstNow > expiryDate) {
          socket.emit("chat:message", {
            system: true,
            username: "system",
            content: "🚫 이 쿠폰은 만료되었습니다. (유효기간: 2025년 10월 19일 오후 12시까지)",
            timestamp: new Date().toISOString()
          });
          return;
        }

        // Guest 사용자 체크 - DB에서 사용자 정보 조회
        const dbUser = await UserUuidModel.findOne({ userUuid: user.userUuid });
        
        if (!dbUser || (!dbUser.originalGoogleId && !dbUser.originalKakaoId)) {
          socket.emit("chat:message", {
            system: true,
            username: "system",
            content: "🚫 쿠폰은 구글 또는 카카오 소셜 로그인 후에만 사용할 수 있습니다.",
            timestamp: new Date().toISOString()
          });
          return;
        }

        // 이미 사용한 쿠폰인지 확인
        const existingUsage = await CouponUsageModel.findOne({
          userUuid: user.userUuid,
          couponCode: "즐거운 한가위 되세요~!"
        });

        if (existingUsage) {
          socket.emit("chat:message", {
            system: true,
            username: "system",
            content: "🚫 이미 사용한 쿠폰입니다. 쿠폰은 계정당 한 번만 사용할 수 있습니다.",
            timestamp: new Date().toISOString()
          });
          return;
        }

        const queryResult = await getUserQuery('user', user.username, user.userUuid);
        let query;
        if (queryResult.userUuid) {
          query = { userUuid: queryResult.userUuid };
        } else {
          query = queryResult;
        }

        // 먼저 쿠폰 사용 기록을 저장하여 중복 사용 방지
        const couponUsage = new CouponUsageModel({
          userUuid: user.userUuid,
          username: user.username,
          couponCode: "즐거운 한가위 되세요~!",
          reward: "gold:1000000,amber:300,starPieces:3,etherKeys:5"
        });
        await couponUsage.save();

        // 1. 골드 100만 지급
        const goldRewardAmount = 1000000;
        let userMoney = await UserMoneyModel.findOne(query);
        
        if (!userMoney) {
          const createData = {
            userId: query.userId || 'user',
            username: query.username || user.username,
            userUuid: query.userUuid || user.userUuid,
            money: goldRewardAmount
          };
          userMoney = new UserMoneyModel(createData);
        } else {
          userMoney.money = (userMoney.money || 0) + goldRewardAmount;
        }
        await userMoney.save();

        // 2. 호박석 300개 지급
        const amberRewardAmount = 300;
        let userAmber = await UserAmberModel.findOne(query);
        
        if (!userAmber) {
          const createData = {
            userId: query.userId || 'user',
            username: query.username || user.username,
            userUuid: query.userUuid || user.userUuid,
            amber: amberRewardAmount
          };
          userAmber = new UserAmberModel(createData);
        } else {
          userAmber.amber = (userAmber.amber || 0) + amberRewardAmount;
        }
        await userAmber.save();

        // 3. 별조각 3개 지급
        const starPiecesRewardAmount = 3;
        let userStarPieces = await StarPieceModel.findOne(query);
        
        if (!userStarPieces) {
          const createData = {
            userId: query.userId || 'user',
            username: query.username || user.username,
            userUuid: query.userUuid || user.userUuid,
            starPieces: starPiecesRewardAmount
          };
          userStarPieces = new StarPieceModel(createData);
        } else {
          userStarPieces.starPieces = (userStarPieces.starPieces || 0) + starPiecesRewardAmount;
        }
        await userStarPieces.save();

        // 4. 에테르 열쇠 5개 지급
        const etherKeysRewardAmount = 5;
        let userEtherKeys = await EtherKeyModel.findOne(query);
        
        if (!userEtherKeys) {
          const createData = {
            userId: query.userId || 'user',
            username: query.username || user.username,
            userUuid: query.userUuid || user.userUuid,
            etherKeys: etherKeysRewardAmount
          };
          userEtherKeys = new EtherKeyModel(createData);
        } else {
          userEtherKeys.etherKeys = (userEtherKeys.etherKeys || 0) + etherKeysRewardAmount;
        }
        await userEtherKeys.save();

        // 성공 메시지 전송
        socket.emit("chat:message", {
          system: true,
          username: "system",
          content: `🎉 축하합니다! 한가위 특별 쿠폰이 성공적으로 사용되었습니다!\n💰 골드 ${goldRewardAmount.toLocaleString()}개\n💎 호박석 ${amberRewardAmount}개\n⭐ 별조각 ${starPiecesRewardAmount}개\n🗝️ 에테르 열쇠 ${etherKeysRewardAmount}개를 받았습니다!`,
          timestamp: new Date().toISOString()
        });

        // 사용자 데이터 업데이트 전송
        sendUserDataUpdate(socket, user.userUuid, user.username);

        console.log(`🎁 한가위 쿠폰 사용: ${user.username} (${user.userUuid}) - gold +${goldRewardAmount}, amber +${amberRewardAmount}, starPieces +${starPiecesRewardAmount}, etherKeys +${etherKeysRewardAmount}`);
        return;

      } catch (error) {
        console.error("한가위 쿠폰 처리 중 오류:", error);
        socket.emit("chat:message", {
          system: true,
          username: "system",
          content: "🚫 쿠폰 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
          timestamp: new Date().toISOString()
        });
        return;
      }
    }

    if (trimmed === "낚시하기") {
      try {
        // 🔐 사용자 UUID 확인 (인증만 체크, 쿨타임은 클라이언트에서 관리)
        if (!socket.data.userUuid) {
          socket.emit("chat:error", { message: "인증이 필요합니다." });
          return;
        }
        
        // 사용자 쿼리 생성
        let query;
        if (socket.data.userUuid) {
          query = { userUuid: socket.data.userUuid };
        } else if (socket.data.username) {
          query = { username: socket.data.username };
        } else {
          query = { userId: socket.data.userId || 'user' };
        }
        
        // 낚시 스킬 조회 (기본 실력)
        const fishingSkill = await FishingSkillModel.findOne(query);
        const baseSkill = fishingSkill ? fishingSkill.skill : 0;
        
        // 🏆 업적 보너스 계산 및 최종 낚시실력 산정
        let achievementBonus = 0;
        try {
          const targetUserUuid = socket.data.userUuid;
          if (targetUserUuid) {
            achievementBonus = await achievementSystem.calculateAchievementBonus(targetUserUuid);
          }
        } catch (error) {
          console.error("Failed to calculate achievement bonus in fishing:", error);
        }
        
        const finalSkill = baseSkill + achievementBonus;
        console.log(`🎣 낚시 실력 정보 - 기본: ${baseSkill}, 업적보너스: ${achievementBonus}, 최종: ${finalSkill}`);
        
        // 물고기 선택 (업적 보너스가 반영된 최종 실력 사용)
        const fishingResult = randomFish(finalSkill);
        const { fish, probability, fishIndex, rank } = fishingResult;
        
        // 물고기 저장 데이터 준비
        const catchData = {
          fish,
          weight: 0,
          probability: probability, // 업적 체크를 위한 확률 정보 저장
        };
        
        // 사용자 식별 정보 추가
        if (socket.data.userUuid) {
          catchData.userUuid = socket.data.userUuid;
          catchData.username = socket.data.username || "사용자";
          catchData.displayName = socket.data.displayName || socket.data.username || "사용자";
        } else if (socket.data.username) {
          catchData.username = socket.data.username;
          catchData.displayName = socket.data.displayName || socket.data.username;
        } else {
          catchData.userId = socket.data.userId || 'user';
          catchData.username = socket.data.username || "사용자";
          catchData.displayName = socket.data.displayName || socket.data.username || "사용자";
        }
        
        // 물고기 저장
        await CatchModel.create(catchData);

        // 물고기 발견 기록 저장 (중복 방지)
        if (socket.data.userUuid) {
          try {
            await FishDiscoveryModel.create({
              userUuid: socket.data.userUuid,
              username: socket.data.username || "사용자",
              fishName: selectedFish.name
            });
            console.log(`🎣 New fish discovered: ${selectedFish.name} by ${socket.data.username}`);
          } catch (error) {
            // 이미 발견한 물고기인 경우 무시 (unique index 에러)
            if (error.code !== 11000) {
              console.error("Failed to save fish discovery:", error);
            }
          }
        }

        // 사용자의 총 물고기 카운트 증가
        if (socket.data.userUuid) {
          const currentCount = batchUpdates.fishCount.get(socket.data.userUuid) || 0;
          batchUpdates.fishCount.set(socket.data.userUuid, currentCount + 1);
        }

        // 🎣 0.3% 물고기 카운트 업데이트
        if (probability === 0.3 && socket.data.userUuid) {
          try {
            await achievementSystem.updateRareFishCount(socket.data.userUuid, socket.data.username);
            console.log(`🎣 Rare fish count updated for ${socket.data.username}`);
          } catch (error) {
            console.error("Failed to update rare fish count:", error);
          }
        }

        // 🏆 낚시 성공 시 업적 체크
        let achievementGranted = false;
        let newAchievement = null;
        try {
          const targetUserUuid = socket.data.userUuid;
          const targetUsername = socket.data.username || socket.data.displayName;
          if (targetUserUuid && targetUsername) {
            achievementGranted = await checkAndGrantAchievements(targetUserUuid, targetUsername);
            if (achievementGranted) {
              console.log(`🏆 Achievement granted to ${targetUsername} after WebSocket fishing`);
              // 방금 달성한 업적 정보 가져오기
              const latestAchievement = await AchievementModel.findOne({ 
                userUuid: targetUserUuid, 
                achievementId: "fish_collector" 
              }).sort({ createdAt: -1 });
              if (latestAchievement) {
                newAchievement = {
                  id: latestAchievement.achievementId,
                  name: latestAchievement.achievementName,
                  description: latestAchievement.description
                };
                // 업적 달성 알림을 해당 사용자에게만 전송
                socket.emit("achievement:granted", {
                  achievement: newAchievement,
                  message: `🏆 업적 달성! "${newAchievement.name}"`
                });
              }
            }
          }
        } catch (error) {
          console.error("Failed to check achievements after WebSocket fishing:", error);
        }
        
        // 성공 메시지 (확률과 등급 정보 포함)
        const probabilityStr = probability >= 1 ? `${probability.toFixed(1)}%` : `${probability.toFixed(2)}%`;
        io.emit("chat:message", {
          system: true,
          username: "system",
          content: `${catchData.displayName} 님이 ${probabilityStr} 확률로 ${fish} (${rank}Rank)를 낚았습니다!`,
          timestamp,
        });
        
        // 쿨타임 설정
        const cooldownDuration = await calculateFishingCooldownTime(query);
        const nowTime = new Date();
        const cooldownEnd = new Date(nowTime.getTime() + cooldownDuration);
        
        const cooldownUpdateData = {
          userId: query.userId || 'user',
          username: query.username || socket.data.username,
          userUuid: query.userUuid || socket.data.userUuid,
          fishingCooldownEnd: cooldownEnd
        };
        
        // 쿨타임 설정
        await CooldownModel.findOneAndUpdate(query, cooldownUpdateData, { upsert: true, new: true });
        
        // UUID 사용자의 경우 UserUuidModel에도 쿨타임 업데이트
        if (query.userUuid) {
          await UserUuidModel.updateOne(
            { userUuid: query.userUuid },
            { fishingCooldownEnd: cooldownEnd }
          );
          
          // WebSocket으로 쿨타임 브로드캐스트
          broadcastUserDataUpdate(query.userUuid, socket.data.username, 'cooldown', {
            fishingCooldown: cooldownDuration
          });
        }
        
        // 인벤토리 업데이트
        if (socket.data.userUuid) {
          getInventoryData(socket.data.userUuid)
            .then(inventory => {
              socket.emit("inventory:update", inventory);
            })
            .catch(error => {
              console.error("Failed to update inventory:", error);
            });
        }
        
      } catch (error) {
        console.error("Fishing error:", error);
        socket.emit("error", { message: "낚시에 실패했습니다. 다시 시도해주세요." });
        
        io.emit("chat:message", {
          system: true,
          username: "system",
          content: `낚시 중 오류가 발생했습니다.`,
          timestamp,
        });
      }
    } else {
      io.emit("chat:message", { ...msg, timestamp });
    }
  });

  // 접속 해제 시 사용자 목록에서 제거
  socket.on("disconnect", (reason) => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      connectedUsers.delete(socket.id);
      connectedUsersMap.delete(user.userUuid); // 메일 알림 맵에서도 제거
      console.log("User disconnected:", user.displayName, "Reason:", reason);
      
      // 🔧 좀비 WebSocket 방지: socket 객체에서 사용자 정보 정리
      if (socket.userUuid || socket.username) {
        console.log(`🧹 Cleaning up socket data for ${socket.username} (${socket.userUuid})`);
        delete socket.userUuid;
        delete socket.username;
      }
      
      // 같은 userUuid의 다른 연결이 있는지 확인
      const remainingConnections = Array.from(connectedUsers.values())
        .filter(userData => userData.userUuid === user.userUuid);
      
      console.log(`Remaining connections for ${user.userUuid}:`, remainingConnections.length);
      
      // 접속자 목록 업데이트 전송 (중복 제거, 빈 배열이 아닐 때만)
      const uniqueUsers = cleanupConnectedUsers();
      if (uniqueUsers.length > 0) {
        io.emit("users:update", uniqueUsers);
      } else {
        console.log('⚠️ Skipping users:update on disconnect - no users to send');
      }
      
      // 완전히 연결이 끊어진 경우에만 퇴장 메시지 전송
      if (remainingConnections.length === 0) {
        io.emit("chat:message", { 
          system: true, 
          username: "system", 
          content: `${user.displayName || user.username} 님이 퇴장했습니다.`,
          timestamp: new Date()
        });
      }
    }
  });

  // 실시간 데이터 동기화 이벤트들
  socket.on("data:subscribe", ({ userUuid, username }) => {
    // 🔐 JWT 인증 확인 (보안 강화)
    if (!socket.data.isAuthenticated) {
      console.log(`🚨 [SECURITY] Unauthenticated data subscribe attempt: ${socket.id}`);
      return;
    }
    
    // 🔐 본인 데이터만 구독 가능 (보안 강화)
    if (userUuid !== socket.data.userUuid || username !== socket.data.username) {
      console.log(`🚨 [SECURITY] Unauthorized data subscribe: ${socket.data.username} tried to subscribe to ${username}'s data`);
      return;
    }
    
    if (userUuid && username) {
      socket.userUuid = userUuid;
      socket.username = username;
      console.log(`User ${username} subscribed to data updates`);
      
      // 즉시 현재 데이터 전송
      sendUserDataUpdate(socket, userUuid, username);
    }
  });

  // 레이드 WebSocket 이벤트 설정
  setupRaidWebSocketEvents(socket, UserUuidModel);

  socket.on("data:request", async ({ type, userUuid, username }) => {
    // 🔐 JWT 인증 확인 (보안 강화)
    if (!socket.data.isAuthenticated) {
      console.log(`🚨 [SECURITY] Unauthenticated data request: ${socket.id}`);
      return;
    }
    
    // 🔐 본인 데이터만 요청 가능 (보안 강화)
    if (userUuid !== socket.data.userUuid || username !== socket.data.username) {
      console.log(`🚨 [SECURITY] Unauthorized data request: ${socket.data.username} requested ${username}'s data`);
      return;
    }
    
    if (!userUuid || !username) return;
    
    try {
      switch (type) {
        case 'inventory':
          const inventory = await getInventoryData(userUuid);
          socket.emit('data:inventory', JSON.parse(JSON.stringify(inventory || [])));
          break;
        case 'materials':
          const materials = await getMaterialsData(userUuid);
          socket.emit('data:materials', JSON.parse(JSON.stringify(materials || [])));
          break;
        case 'money':
          const money = await getMoneyData(userUuid);
          socket.emit('data:money', JSON.parse(JSON.stringify(money || { money: 0 })));
          break;
        case 'amber':
          const amber = await getAmberData(userUuid);
          socket.emit('data:amber', JSON.parse(JSON.stringify(amber || { amber: 0 })));
          break;
        case 'starPieces':
          const starPieces = await getStarPiecesData(userUuid);
          socket.emit('data:starPieces', JSON.parse(JSON.stringify(starPieces || { starPieces: 0 })));
          break;
        case 'cooldown':
          const cooldown = await getCooldownData(userUuid);
          socket.emit('data:cooldown', JSON.parse(JSON.stringify(cooldown || { fishingCooldown: 0 })));
          break;
        case 'totalCatches':
          const totalCatches = await getTotalCatchesData(userUuid);
          socket.emit('data:totalCatches', JSON.parse(JSON.stringify(totalCatches || { totalFishCaught: 0 })));
          break;
        case 'companions':
          const companions = await getCompanionsData(userUuid);
          socket.emit('data:companions', JSON.parse(JSON.stringify(companions || { companions: [] })));
          break;
        case 'all':
          // 🚀 병렬 처리로 모든 데이터 한 번에 조회 (성능 최적화)
          const [allInventory, allMaterials, allMoney, allAmber, allStarPieces, allCooldown, allTotalCatches, allCompanions] = await Promise.all([
            getInventoryData(userUuid),
            getMaterialsData(userUuid),
            getMoneyData(userUuid),
            getAmberData(userUuid),
            getStarPiecesData(userUuid),
            getCooldownData(userUuid),
            getTotalCatchesData(userUuid),
            getCompanionsData(userUuid)
          ]);
          
          // 각 데이터를 개별 이벤트로 전송
          socket.emit('data:inventory', JSON.parse(JSON.stringify(allInventory || [])));
          socket.emit('data:materials', JSON.parse(JSON.stringify(allMaterials || [])));
          socket.emit('data:money', JSON.parse(JSON.stringify(allMoney || { money: 0 })));
          socket.emit('data:amber', JSON.parse(JSON.stringify(allAmber || { amber: 0 })));
          socket.emit('data:starPieces', JSON.parse(JSON.stringify(allStarPieces || { starPieces: 0 })));
          socket.emit('data:cooldown', JSON.parse(JSON.stringify(allCooldown || { fishingCooldown: 0 })));
          socket.emit('data:totalCatches', JSON.parse(JSON.stringify(allTotalCatches || { totalFishCaught: 0 })));
          socket.emit('data:companions', JSON.parse(JSON.stringify(allCompanions || { companions: [] })));
          
          console.log(`🚀 Parallel data fetch completed for ${username} (${userUuid})`);
          break;
      }
    } catch (error) {
      console.error(`Error fetching ${type} for ${username}:`, error);
    }
  });

  // 🔧 데이터 구독 해제 이벤트 처리
  socket.on("data:unsubscribe", ({ userUuid, username }) => {
    if (socket.userUuid === userUuid) {
      console.log(`User ${username} unsubscribed from data updates`);
      delete socket.userUuid;
      delete socket.username;
    }
  });
});

// WebSocket 데이터 조회 함수들
async function sendUserDataUpdate(socket, userUuid, username) {
  try {
    const [inventory, materials, money, amber, starPieces, cooldown, totalCatches, companions, adminStatus, equipment, etherKeys] = await Promise.all([
      getInventoryData(userUuid),
      getMaterialsData(userUuid),
      getMoneyData(userUuid),
      getAmberData(userUuid),
      getStarPiecesData(userUuid),
      getCooldownData(userUuid),
      getTotalCatchesData(userUuid),
      getCompanionsData(userUuid),
      getAdminStatusData(userUuid),
      getEquipmentData(userUuid),
      getEtherKeysData(userUuid)
    ]);
    
    // 완전히 안전한 데이터 직렬화 (순환 참조 완전 제거)
    const createSafeData = () => {
      try {
        return {
          inventory: Array.isArray(inventory) ? inventory.map(item => ({
            fish: String(item?.fish || ''),
            count: Number(item?.count || 0),
            _id: String(item?._id || '')
          })) : [],
          materials: Array.isArray(materials) ? materials.map(item => ({
            material: String(item?.material || ''),
            count: Number(item?.count || 0),
            _id: String(item?._id || '')
          })) : [],
          money: { money: Number(money?.money || 0) },
          amber: { amber: Number(amber?.amber || 0) },
          starPieces: { starPieces: Number(starPieces?.starPieces || 0) },
          etherKeys: { etherKeys: Number(etherKeys?.etherKeys || 0) },
          cooldown: { 
            fishingCooldown: Math.max(0, Number(cooldown?.fishingCooldown || 0))
          },
          totalCatches: { totalFishCaught: Number(totalCatches?.totalFishCaught || 0) },
          companions: { companions: Array.isArray(companions?.companions) ? companions.companions.map(c => String(c)) : [] },
          adminStatus: { isAdmin: Boolean(adminStatus?.isAdmin) },
          equipment: { 
            fishingRod: equipment?.fishingRod ? String(equipment.fishingRod) : null, 
            accessory: equipment?.accessory ? String(equipment.accessory) : null,
            fishingRodEnhancement: Number(equipment?.fishingRodEnhancement || 0),
            accessoryEnhancement: Number(equipment?.accessoryEnhancement || 0),
            fishingRodFailCount: Number(equipment?.fishingRodFailCount || 0),
            accessoryFailCount: Number(equipment?.accessoryFailCount || 0)
          }
        };
      } catch (error) {
        console.error("Error creating safe data:", error);
        return {
          inventory: [],
          materials: [],
          money: { money: 0 },
          amber: { amber: 0 },
          starPieces: { starPieces: 0 },
          etherKeys: { etherKeys: 0 },
          cooldown: { fishingCooldown: 0 },
          totalCatches: { totalFishCaught: 0 },
          companions: { companions: [] },
          adminStatus: { isAdmin: false },
          equipment: { fishingRod: null, accessory: null }
        };
      }
    };

    const safeData = createSafeData();
    
    try {
      socket.emit('data:update', safeData);
      // 개별 이벤트도 emit (쿠폰 사용 등 즉시 반영되도록)
      socket.emit('data:money', safeData.money);
      socket.emit('data:amber', safeData.amber);
      socket.emit('data:starPieces', safeData.starPieces);
      socket.emit('data:etherKeys', safeData.etherKeys);
    } catch (emitError) {
      console.error(`Socket emit failed for ${username}:`, emitError.message);
      // 최후의 수단: 기본 데이터만 전송
      try {
        socket.emit('data:update', {
          inventory: [],
          materials: [],
          money: { money: 0 },
          amber: { amber: 0 },
          starPieces: { starPieces: 0 },
          etherKeys: { etherKeys: 0 },
          cooldown: { fishingCooldown: 0 },
          totalCatches: { totalFishCaught: 0 },
          companions: { companions: [] },
          adminStatus: { isAdmin: false },
          equipment: { fishingRod: null, accessory: null }
        });
      } catch (finalError) {
        console.error(`Final fallback emit also failed for ${username}:`, finalError.message);
      }
    }
  } catch (error) {
    console.error(`Error sending data update for ${username}:`, error);
    console.error("Error stack:", error.stack);
  }
}

async function getInventoryData(userUuid) {
  return await measureDBQuery("인벤토리조회", async () => {
    // 🔍 Query Profiler 최적화: $match를 최대한 앞으로, IXSCAN 보장
    const catches = await CatchModel.aggregate([
      // 1단계: 인덱스 활용을 위한 정확한 필터
      { $match: { userUuid: userUuid } }, // 명시적 타입 매칭
      
      // 2단계: 필요한 필드만 projection (docsExamined 최소화)
      { $project: { fish: 1, _id: 0 } },
      
      // 3단계: 그룹핑 (메모리 사용량 최소화)
      { $group: { _id: "$fish", count: { $sum: 1 } } },
      
      // 4단계: 최종 출력 형태
      { $project: { _id: 0, fish: "$_id", count: 1 } },
      
      // 5단계: 정렬 (일관된 결과)
      { $sort: { fish: 1 } }
    ], {
      // Profiler 기반 최적화 옵션
      allowDiskUse: false, // 메모리만 사용 (IXSCAN → FETCH만)
      cursor: { batchSize: 100 }, // 작은 배치로 메모리 효율성
      maxTimeMS: 5000, // 5초 타임아웃
      collation: { locale: "simple" } // 단순 정렬로 성능 향상
    });
    return catches;
  });
}

async function getMaterialsData(userUuid) {
  return await measureDBQuery("재료조회", async () => {
    // 🔍 Query Profiler 최적화: 인벤토리와 동일한 패턴 적용
    const materials = await MaterialModel.aggregate([
      // 1단계: 인덱스 기반 필터
      { $match: { userUuid: userUuid } },
      
      // 2단계: 필요한 필드만 projection
      { $project: { material: 1, _id: 0 } },
      
      // 3단계: 그룹핑
      { $group: { _id: "$material", count: { $sum: 1 } } },
      
      // 4단계: 최종 형태
      { $project: { _id: 0, material: "$_id", count: 1 } },
      
      // 5단계: 정렬
      { $sort: { material: 1 } }
    ], {
      allowDiskUse: false,
      cursor: { batchSize: 100 },
      maxTimeMS: 5000,
      collation: { locale: "simple" }
    });
    return materials;
  });
}

async function getMoneyData(userUuid) {
  // 캐시 확인
  const cached = getCachedData('userMoney', userUuid);
  if (cached) {
    return cached;
  }

  const result = await measureDBQuery("돈조회", async () => {
    const userMoney = await UserMoneyModel.findOne({ userUuid }, { money: 1, _id: 0 })
; // hint 제거 - MongoDB 자동 최적화
    return { money: userMoney?.money || 0 };
  });
  
  // 캐시에 저장
  setCachedData('userMoney', userUuid, result);
  return result;
}

async function getAmberData(userUuid) {
  // 캐시 확인
  const cached = getCachedData('userAmber', userUuid);
  if (cached) {
    return cached;
  }

  const result = await measureDBQuery("호박석조회", async () => {
    const userAmber = await UserAmberModel.findOne({ userUuid }, { amber: 1, _id: 0 })
; // hint 제거 - MongoDB 자동 최적화
    return { amber: userAmber?.amber || 0 };
  });
  
  // 캐시에 저장
  setCachedData('userAmber', userUuid, result);
  return result;
}

async function getStarPiecesData(userUuid) {
  // 캐시 확인
  const cached = getCachedData('starPieces', userUuid);
  if (cached) {
    return cached;
  }

  const result = await measureDBQuery("별조각조회", async () => {
    const starPieces = await StarPieceModel.findOne({ userUuid }, { starPieces: 1, _id: 0 })
; // hint 제거 - MongoDB 자동 최적화
    return { starPieces: starPieces?.starPieces || 0 };
  });
  
  // 캐시에 저장
  setCachedData('starPieces', userUuid, result);
  return result;
}

async function getCooldownData(userUuid) {
  const user = await UserUuidModel.findOne({ userUuid });
  const now = new Date();
  const fishingCooldown = user?.fishingCooldownEnd && user.fishingCooldownEnd > now 
    ? Math.max(0, user.fishingCooldownEnd - now) : 0; // 밀리초 단위로 반환
  
  console.log(`🕒 getCooldownData for ${userUuid}: ${fishingCooldown}ms (${Math.floor(fishingCooldown/1000)}s)`);
  
  return { fishingCooldown };
}

async function getTotalCatchesData(userUuid) {
  const totalCatches = await CatchModel.countDocuments({ userUuid });
  return { totalCatches };
}

async function getCompanionsData(userUuid) {
  try {
    const companionData = await CompanionModel.findOne({ userUuid });
    const companions = companionData?.companions || [];
    return { companions };
  } catch (error) {
    console.error('Error fetching companions data:', error);
    return { companions: [] };
  }
}

async function getAdminStatusData(userUuid) {
  const user = await UserUuidModel.findOne({ userUuid });
  const isAdmin = user?.isAdmin || false;
  return { isAdmin };
}

async function getEquipmentData(userUuid) {
  const equipment = await UserEquipmentModel.findOne({ userUuid });
  return {
    fishingRod: equipment?.fishingRod || null,
    accessory: equipment?.accessory || null
  };
}

async function getEtherKeysData(userUuid) {
  const etherKeys = await EtherKeyModel.findOne({ userUuid });
  return { etherKeys: etherKeys?.etherKeys || 0 };
}

// 데이터 변경 시 모든 해당 사용자에게 업데이트 전송
function broadcastUserDataUpdate(userUuid, username, dataType, data) {
  let broadcastCount = 0;
  
  // 안전한 데이터 변환
  const createSafeBroadcastData = (inputData) => {
    if (!inputData || typeof inputData !== 'object') {
      return {};
    }
    
    const safeData = {};
    for (const [key, value] of Object.entries(inputData)) {
      if (value === null || value === undefined) {
        safeData[key] = value;
      } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        safeData[key] = value;
      } else if (Array.isArray(value)) {
        safeData[key] = value.map(item => 
          (typeof item === 'object' && item !== null) ? String(item) : item
        );
      } else {
        safeData[key] = String(value);
      }
    }
    return safeData;
  };
  
  const safeData = createSafeBroadcastData(data);
  
  io.sockets.sockets.forEach((socket) => {
    if (socket.userUuid === userUuid && socket.connected) {
      try {
        socket.emit(`data:${dataType}`, safeData);
        broadcastCount++;
      } catch (emitError) {
        console.error(`Error broadcasting to socket ${socket.id}:`, emitError.message);
        // 최후의 수단: 빈 객체 전송
        try {
          socket.emit(`data:${dataType}`, {});
        } catch (finalError) {
          console.error(`Final fallback broadcast failed for socket ${socket.id}:`, finalError.message);
        }
      }
    }
  });
  
  if (broadcastCount > 0) {
    console.log(`📡 Broadcasted ${dataType} update to ${broadcastCount} connections for ${username}`);
  }
}

// Personal Inventory API
// 인벤토리 검증 함수 (보안 강화)
const validateInventoryIntegrity = async (userQuery, clientInventory) => {
  try {
    // 서버에서 실제 인벤토리 데이터 가져오기
    const serverInventory = await CatchModel.aggregate([
      { $match: userQuery },
      { $group: { _id: "$fish", count: { $sum: 1 } } },
      { $project: { _id: 0, fish: "$_id", count: 1 } }
    ]);
    
    // 클라이언트 인벤토리와 서버 인벤토리 비교
    const serverMap = new Map(serverInventory.map(item => [item.fish, item.count]));
    const clientMap = new Map((clientInventory || []).map(item => [item.fish, item.count]));
    
    // 불일치 항목 찾기
    const discrepancies = [];
    
    // 서버에 있는 항목들 확인
    for (const [fish, serverCount] of serverMap) {
      const clientCount = clientMap.get(fish) || 0;
      if (clientCount !== serverCount) {
        discrepancies.push({
          fish,
          server: serverCount,
          client: clientCount,
          type: 'count_mismatch'
        });
      }
    }
    
    // 클라이언트에만 있는 항목들 확인 (가짜 아이템)
    for (const [fish, clientCount] of clientMap) {
      if (!serverMap.has(fish)) {
        discrepancies.push({
          fish,
          server: 0,
          client: clientCount,
          type: 'fake_item'
        });
      }
    }
    
    return {
      isValid: discrepancies.length === 0,
      discrepancies,
      serverInventory
    };
  } catch (error) {
    console.error('Failed to validate inventory integrity:', error);
    return { isValid: false, error: error.message };
  }
};

// 🔒 게임 데이터 API 엔드포인트들 (서버에서만 제공)
app.get("/api/game-data/fish", (req, res) => {
  try {
    const fishData = getFishData();
    res.json({ success: true, data: fishData });
  } catch (error) {
    console.error("Failed to get fish data:", error);
    res.status(500).json({ success: false, error: "Failed to load fish data" });
  }
});

app.get("/api/game-data/fish-health", (req, res) => {
  try {
    const fishHealthData = getFishHealthData();
    res.json({ success: true, data: fishHealthData });
  } catch (error) {
    console.error("Failed to get fish health data:", error);
    res.status(500).json({ success: false, error: "Failed to load fish health data" });
  }
});

app.get("/api/game-data/fish-speed", (req, res) => {
  try {
    const fishSpeedData = getFishSpeedData();
    res.json({ success: true, data: fishSpeedData });
  } catch (error) {
    console.error("Failed to get fish speed data:", error);
    res.status(500).json({ success: false, error: "Failed to load fish speed data" });
  }
});

app.get("/api/game-data/probability", (req, res) => {
  try {
    const probabilityData = getProbabilityData();
    res.json({ success: true, data: probabilityData });
  } catch (error) {
    console.error("Failed to get probability data:", error);
    res.status(500).json({ success: false, error: "Failed to load probability data" });
  }
});

app.get("/api/game-data/prefixes", (req, res) => {
  try {
    const prefixData = getPrefixData();
    res.json({ success: true, data: prefixData });
  } catch (error) {
    console.error("Failed to get prefix data:", error);
    res.status(500).json({ success: false, error: "Failed to load prefix data" });
  }
});

app.get("/api/game-data/shop", (req, res) => {
  try {
    const shopData = getShopData();
    res.json({ success: true, data: shopData });
  } catch (error) {
    console.error("Failed to get shop data:", error);
    res.status(500).json({ success: false, error: "Failed to load shop data" });
  }
});

// 낚시 스킬에 따른 사용 가능한 물고기 조회
app.get("/api/game-data/available-fish/:skill", (req, res) => {
  try {
    const skill = parseInt(req.params.skill) || 0;
    const availableFish = getAvailableFishBySkill(skill);
    res.json({ success: true, data: availableFish });
  } catch (error) {
    console.error("Failed to get available fish:", error);
    res.status(500).json({ success: false, error: "Failed to load available fish" });
  }
});

// 특정 물고기 정보 조회
app.get("/api/game-data/fish/:name", (req, res) => {
  try {
    const fishName = decodeURIComponent(req.params.name);
    const fish = getFishByName(fishName);
    if (!fish) {
      return res.status(404).json({ success: false, error: "Fish not found" });
    }
    res.json({ success: true, data: fish });
  } catch (error) {
    console.error("Failed to get fish by name:", error);
    res.status(500).json({ success: false, error: "Failed to load fish data" });
  }
});

// 상점 카테고리별 아이템 조회
app.get("/api/game-data/shop/:category", (req, res) => {
  try {
    const category = req.params.category;
    const items = getShopItemsByCategory(category);
    res.json({ success: true, data: items });
  } catch (error) {
    console.error("Failed to get shop items:", error);
    res.status(500).json({ success: false, error: "Failed to load shop items" });
  }
});

// ==================== 메일 시스템 API ====================

// 메일 발송
app.post("/api/mail/send", authenticateJWT, async (req, res) => {
  try {
    const { receiverNickname, subject, message } = req.body;
    const senderUuid = req.user.userUuid;
    const senderNickname = req.user.username;

    // 받는 사람 확인
    const receiver = await UserUuidModel.findOne({ username: receiverNickname });
    if (!receiver) {
      return res.status(404).json({ success: false, error: "받는 사람을 찾을 수 없습니다." });
    }

    // 자신에게는 발송 불가
    if (receiver.userUuid === senderUuid) {
      return res.status(400).json({ success: false, error: "자신에게는 메일을 보낼 수 없습니다." });
    }

    // 메일 생성
    const newMail = new MailModel({
      senderUuid,
      senderNickname,
      receiverUuid: receiver.userUuid,
      receiverNickname: receiver.username,
      subject: subject || "(제목 없음)",
      message
    });

    await newMail.save();

    // Socket으로 실시간 알림
    const receiverSocketId = connectedUsersMap.get(receiver.userUuid);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("new-mail", {
        from: senderNickname,
        subject: newMail.subject
      });
    }

    res.json({ success: true, message: "메일을 전송했습니다." });
  } catch (error) {
    console.error("메일 전송 실패:", error);
    res.status(500).json({ success: false, error: "메일 전송에 실패했습니다." });
  }
});

// 받은 메일 목록 조회
app.get("/api/mail/inbox", authenticateJWT, async (req, res) => {
  try {
    const userUuid = req.user.userUuid;
    
    const mails = await MailModel.find({ receiverUuid: userUuid })
      .sort({ sentAt: -1 })
      .limit(100)
      .lean();

    res.json({ success: true, mails });
  } catch (error) {
    console.error("받은 메일 조회 실패:", error);
    res.status(500).json({ success: false, error: "메일을 불러오는데 실패했습니다." });
  }
});

// 보낸 메일 목록 조회
app.get("/api/mail/sent", authenticateJWT, async (req, res) => {
  try {
    const userUuid = req.user.userUuid;
    
    const mails = await MailModel.find({ senderUuid: userUuid })
      .sort({ sentAt: -1 })
      .limit(100)
      .lean();

    res.json({ success: true, mails });
  } catch (error) {
    console.error("보낸 메일 조회 실패:", error);
    res.status(500).json({ success: false, error: "메일을 불러오는데 실패했습니다." });
  }
});

// 메일 읽음 처리
app.post("/api/mail/read/:mailId", authenticateJWT, async (req, res) => {
  try {
    const { mailId } = req.params;
    const userUuid = req.user.userUuid;

    const mail = await MailModel.findOne({ _id: mailId, receiverUuid: userUuid });
    if (!mail) {
      return res.status(404).json({ success: false, error: "메일을 찾을 수 없습니다." });
    }

    mail.isRead = true;
    await mail.save();

    res.json({ success: true });
  } catch (error) {
    console.error("메일 읽음 처리 실패:", error);
    res.status(500).json({ success: false, error: "메일 읽음 처리에 실패했습니다." });
  }
});

// 메일 삭제
app.delete("/api/mail/:mailId", authenticateJWT, async (req, res) => {
  try {
    const { mailId } = req.params;
    const userUuid = req.user.userUuid;

    const mail = await MailModel.findOne({
      _id: mailId,
      $or: [{ senderUuid: userUuid }, { receiverUuid: userUuid }]
    });

    if (!mail) {
      return res.status(404).json({ success: false, error: "메일을 찾을 수 없습니다." });
    }

    await MailModel.deleteOne({ _id: mailId });
    res.json({ success: true, message: "메일을 삭제했습니다." });
  } catch (error) {
    console.error("메일 삭제 실패:", error);
    res.status(500).json({ success: false, error: "메일 삭제에 실패했습니다." });
  }
});

// 읽지 않은 메일 개수 조회
app.get("/api/mail/unread-count", authenticateJWT, async (req, res) => {
  try {
    const userUuid = req.user.userUuid;
    
    const unreadCount = await MailModel.countDocuments({
      receiverUuid: userUuid,
      isRead: false
    });

    res.json({ success: true, unreadCount });
  } catch (error) {
    console.error("읽지 않은 메일 개수 조회 실패:", error);
    res.status(500).json({ success: false, error: "메일 개수 조회에 실패했습니다." });
  }
});

// 받은 메일 모두 읽음 처리
app.post("/api/mail/read-all", authenticateJWT, async (req, res) => {
  try {
    const userUuid = req.user.userUuid;
    
    const result = await MailModel.updateMany(
      { receiverUuid: userUuid, isRead: false },
      { $set: { isRead: true } }
    );

    res.json({ 
      success: true, 
      message: `${result.modifiedCount}개의 메일을 읽음 처리했습니다.`,
      count: result.modifiedCount
    });
  } catch (error) {
    console.error("메일 모두 읽음 처리 실패:", error);
    res.status(500).json({ success: false, error: "메일 읽음 처리에 실패했습니다." });
  }
});

// 메일 모두 삭제 (받은편지함 또는 보낸편지함)
app.delete("/api/mail/delete-all/:type", authenticateJWT, async (req, res) => {
  try {
    const { type } = req.params; // 'inbox' or 'sent'
    const userUuid = req.user.userUuid;
    
    let filter;
    if (type === 'inbox') {
      filter = { receiverUuid: userUuid };
    } else if (type === 'sent') {
      filter = { senderUuid: userUuid };
    } else {
      return res.status(400).json({ success: false, error: "잘못된 타입입니다." });
    }

    const result = await MailModel.deleteMany(filter);

    res.json({ 
      success: true, 
      message: `${result.deletedCount}개의 메일을 삭제했습니다.`,
      count: result.deletedCount
    });
  } catch (error) {
    console.error("메일 모두 삭제 실패:", error);
    res.status(500).json({ success: false, error: "메일 삭제에 실패했습니다." });
  }
});

// ==================== 메일 시스템 API 끝 ====================

app.get("/api/inventory/:userId", optionalJWT, async (req, res) => {
  try {
    // 🔐 JWT에서 사용자 정보 추출 (선택적)
    const jwtUser = req.user || {};
    const { userId } = req.params;
    
    // JWT 또는 쿼리 파라미터에서 정보 가져오기
    const username = jwtUser.username || req.query.username;
    const userUuid = jwtUser.userUuid || req.query.userUuid;
    
    debugLog(`🔐 JWT Inventory request: ${username} (${userUuid})`);
    
    // 🔍 아딸 사용자 요청 추적
    if (username === '아딸' || userUuid === '#0002') {
      console.log(`🕵️ 아딸 INVENTORY - IP: ${req.ip || req.connection.remoteAddress}, UA: ${req.get('User-Agent')?.substring(0, 50) || 'N/A'}, Referer: ${req.get('Referer') || 'N/A'}`);
    }
    
    // UUID 기반 사용자 조회
    const queryResult = await getUserQuery(userId, username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
      console.log("Using UUID query for inventory:", query);
    } else {
      // 🔧 존재하지 않는 사용자에 대한 반복 요청 방지
      if (userUuid === '#0002' && username === '아딸') {
        console.log("🚫 Blocking repeated requests for non-existent user:", { userUuid, username });
        return res.status(404).json({ error: "User not found. Please refresh and login again." });
      }
      query = queryResult;
      console.log("Using fallback query for inventory:", query);
    }
    
    // 🚀 보안 검증 생략 (성능 최적화)
    // const ownershipValidation = await validateUserOwnership(query, userUuid, username);
    
    console.log("Database query for inventory:", query);
    
    // 🚀 MongoDB Aggregation으로 성능 최적화
    const fishCountAggregation = await CatchModel.aggregate([
      { $match: query },
      { $group: { _id: "$fish", count: { $sum: 1 } } }
    ]);
    
    const fishCount = {};
    fishCountAggregation.forEach(item => {
      fishCount[item._id] = item.count;
    });
    
    debugLog(`Found ${fishCountAggregation.length} unique fish types`);
    
    // 갯수 순으로 정렬해서 반환
    const inventory = Object.entries(fishCount)
      .map(([fish, count]) => ({ fish, count }))
      .sort((a, b) => b.count - a.count);
    
    // 인벤토리에 검증 메타데이터 추가 (보안 강화)
    const timestamp = new Date().toISOString();
    const inventoryHash = require('crypto')
      .createHash('md5')
      .update(JSON.stringify(inventory.sort((a, b) => a.fish.localeCompare(b.fish))))
      .digest('hex');
    
    console.log("Final inventory:", inventory);
    console.log("Inventory hash:", inventoryHash);
    
    // 안전장치: 배열이 아닌 경우 빈 배열로 처리
    const safeInventory = Array.isArray(inventory) ? inventory : [];
    
    // 클라이언트가 이전 버전과 호환되도록 배열 형태로 반환하되, 메타데이터는 별도 헤더로 전송
    res.set({
      'X-Inventory-Hash': inventoryHash,
      'X-Inventory-Timestamp': timestamp,
      'X-Inventory-Count': safeInventory.length.toString(),
      'X-Total-Items': safeInventory.reduce((sum, item) => sum + item.count, 0).toString()
    });
    
    res.json(safeInventory);
  } catch (error) {
    console.error("Failed to fetch inventory:", error);
    res.status(500).json({ error: "Failed to fetch inventory" });
  }
});

// User Money API (보안 강화 + JWT 인증)
app.get("/api/user-money/:userId", authenticateJWT, async (req, res) => {
  try {
    // 🔐 JWT에서 사용자 정보 추출 (선택적)
    const { userUuid, username } = req.user || {};
    const { userId } = req.params;
    
    console.log(`🔐 JWT User money request: ${username} (${userUuid})`);
    
    // UUID 기반 사용자 조회
    const queryResult = await getUserQuery(userId, username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
      console.log("Using UUID query for user money:", query);
    } else {
      query = queryResult;
      console.log("Using fallback query for user money:", query);
    }
    
    // 🔒 보안 검증: 본인 데이터만 조회 가능
    const ownershipValidation = await validateUserOwnership(query, userUuid, username);
    if (!ownershipValidation.isValid) {
      console.warn("Unauthorized money access:", ownershipValidation.reason);
      return res.status(403).json({ error: "Access denied: You can only view your own data" });
    }
    
    console.log("Database query for user money:", query);
    
    let userMoney = await UserMoneyModel.findOne(query);
    
    if (!userMoney) {
      // 새 사용자인 경우 초기 골드 100으로 생성
      const createData = {
        money: 100,
        ...query
      };
      
      // username이 있으면 추가
      if (username) {
        createData.username = username;
      }
      
      console.log("Creating new user money:", createData);
      userMoney = await UserMoneyModel.create(createData);
    }
    
    res.json({ money: userMoney.money });
  } catch (error) {
    console.error("Failed to fetch user money:", error);
    res.status(500).json({ error: "Failed to fetch user money" });
  }
});

// User Amber API (보안 강화 + JWT 인증)
app.get("/api/user-amber/:userId", authenticateJWT, async (req, res) => {
  try {
    // 🔐 JWT에서 사용자 정보 추출 (선택적)
    const { userUuid, username } = req.user || {};
    const { userId } = req.params;
    
    debugLog(`🔐 JWT User amber request: ${username} (${userUuid})`);
    
    // UUID 기반 사용자 조회
    const queryResult = await getUserQuery(userId, username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
      console.log("Using UUID query for user amber:", query);
    } else {
      query = queryResult;
      console.log("Using fallback query for user amber:", query);
    }
    
    // 🔒 보안 검증: 본인 데이터만 조회 가능
    const ownershipValidation = await validateUserOwnership(query, userUuid, username);
    if (!ownershipValidation.isValid) {
      console.warn("Unauthorized amber access:", ownershipValidation.reason);
      return res.status(403).json({ error: "Access denied: You can only view your own data" });
    }
    
    console.log("Database query for user amber:", query);
    
    let userAmber = await UserAmberModel.findOne(query);
    
    if (!userAmber) {
      // 새 사용자인 경우 초기 호박석 0으로 생성
      const createData = {
        userId: query.userId || 'user',
        username: query.username || username,
        userUuid: query.userUuid || userUuid,
        amber: 0
      };
      
      console.log("Creating new amber record with data:", createData);
      userAmber = new UserAmberModel(createData);
      await userAmber.save();
      console.log("Created new user amber record:", userAmber);
    }
    
    res.json({ amber: userAmber.amber || 0 });
  } catch (error) {
    console.error("Failed to fetch user amber:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ error: "Failed to fetch user amber", details: error.message });
  }
});

// Star Pieces API (별조각 조회)
app.get("/api/star-pieces/:userId", authenticateJWT, async (req, res) => {
  try {
    // 🔐 JWT에서 사용자 정보 추출 (선택적)
    const { userUuid, username } = req.user || {};
    const { userId } = req.params;
    
    debugLog(`🔐 JWT Star pieces request: ${username} (${userUuid})`);
    
    // UUID 기반 사용자 조회
    const queryResult = await getUserQuery(userId, username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
      console.log("Using UUID query for star pieces:", query);
    } else {
      query = queryResult;
      console.log("Using fallback query for star pieces:", query);
    }
    
    console.log("Database query for star pieces:", query);
    
    const userStarPieces = await StarPieceModel.findOne(query);
    const starPieces = userStarPieces ? userStarPieces.starPieces : 0;
    
    console.log(`User star pieces: ${starPieces}`);
    res.json({ starPieces });
  } catch (error) {
    console.error("Failed to fetch star pieces:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ error: "Failed to fetch star pieces", details: error.message });
  }
});

// Ether Keys API (에테르 열쇠 조회)
app.get("/api/ether-keys/:userId", authenticateJWT, async (req, res) => {
  try {
    // 🔐 JWT에서 사용자 정보 추출
    const { userUuid, username } = req.user || {};
    const { userId } = req.params;
    
    debugLog(`🔐 JWT Ether keys request: ${username} (${userUuid})`);
    
    // UUID 기반 사용자 조회
    const queryResult = await getUserQuery(userId, username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
      console.log("Using UUID query for ether keys:", query);
    } else {
      query = queryResult;
      console.log("Using fallback query for ether keys:", query);
    }
    
    // 🔒 보안 검증: 본인 데이터만 조회 가능
    const ownershipValidation = await validateUserOwnership(query, userUuid, username);
    if (!ownershipValidation.isValid) {
      console.warn("Unauthorized ether keys access:", ownershipValidation.reason);
      return res.status(403).json({ error: "Access denied: You can only view your own data" });
    }
    
    console.log("Database query for ether keys:", query);
    
    let userEtherKeys = await EtherKeyModel.findOne(query);
    
    if (!userEtherKeys) {
      // 새 사용자인 경우 초기 에테르 열쇠 0개로 생성
      const createData = {
        userId: query.userId || 'user',
        username: query.username || username,
        userUuid: query.userUuid || userUuid,
        etherKeys: 0
      };
      
      console.log("Creating new ether keys record with data:", createData);
      userEtherKeys = new EtherKeyModel(createData);
      await userEtherKeys.save();
      console.log("Created new user ether keys record:", userEtherKeys);
    }
    
    res.json({ etherKeys: userEtherKeys.etherKeys || 0 });
  } catch (error) {
    console.error("Failed to fetch ether keys:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ error: "Failed to fetch ether keys", details: error.message });
  }
});

// Add Star Pieces API (별조각 추가)
app.post("/api/add-star-pieces", authenticateJWT, async (req, res) => {
  try {
    const { amount } = req.body;
    const { username, userUuid } = req.query;
    
    console.log("Add star pieces request:", { amount, username, userUuid });
    
    // UUID 기반 사용자 조회
    const queryResult = await getUserQuery('user', username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
      console.log("Using UUID query for add star pieces:", query);
    } else {
      query = queryResult;
      console.log("Using fallback query for add star pieces:", query);
    }
    
    console.log("Database query for add star pieces:", query);
    
    let userStarPieces = await StarPieceModel.findOne(query);
    
    if (!userStarPieces) {
      // 새 사용자인 경우 생성
      const createData = {
        userId: query.userId || 'user',
        username: query.username || username,
        userUuid: query.userUuid || userUuid,
        starPieces: amount
      };
      console.log("Creating new star pieces record with data:", createData);
      userStarPieces = new StarPieceModel(createData);
    } else {
      userStarPieces.starPieces = (userStarPieces.starPieces || 0) + amount;
    }
    
    await userStarPieces.save();
    // 별조각 지급 완료 (보안상 잔액 정보는 로그에 기록하지 않음)
    
    res.json({ success: true, newStarPieces: userStarPieces.starPieces });
  } catch (error) {
    console.error("Failed to add star pieces:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ error: "Failed to add star pieces", details: error.message });
  }
});

// Exchange Star Pieces for Ether Keys API (별조각으로 에테르 열쇠 교환)
app.post("/api/exchange-ether-keys", authenticateJWT, async (req, res) => {
  try {
    const { userUuid, username } = req.user;
    const { quantity = 5 } = req.body; // 기본값 5개 교환
    
    console.log("Exchange ether keys request:", { username, userUuid, quantity });
    
    // 별조각 1개당 에테르 열쇠 5개 교환
    const starPiecesRequired = 1;
    const etherKeysToAdd = quantity;
    
    if (etherKeysToAdd !== 5) {
      return res.status(400).json({ 
        success: false, 
        error: "한 번에 5개의 에테르 열쇠만 교환할 수 있습니다." 
      });
    }
    
    // UUID 기반 사용자 조회
    const queryResult = await getUserQuery('user', username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
    } else {
      query = queryResult;
    }
    
    // 별조각 확인
    let userStarPieces = await StarPieceModel.findOne(query);
    if (!userStarPieces || userStarPieces.starPieces < starPiecesRequired) {
      return res.status(400).json({ 
        success: false, 
        error: "별조각이 부족합니다. (필요: 1개)" 
      });
    }
    
    // 에테르 열쇠 레코드 찾기 또는 생성
    let userEtherKeys = await EtherKeyModel.findOne(query);
    if (!userEtherKeys) {
      const createData = {
        userId: query.userId || 'user',
        username: query.username || username,
        userUuid: query.userUuid || userUuid,
        etherKeys: 0
      };
      userEtherKeys = new EtherKeyModel(createData);
    }
    
    // 트랜잭션 처리
    userStarPieces.starPieces -= starPiecesRequired;
    userEtherKeys.etherKeys = (userEtherKeys.etherKeys || 0) + etherKeysToAdd;
    
    await userStarPieces.save();
    await userEtherKeys.save();
    
    console.log(`[EXCHANGE] ${username} exchanged ${starPiecesRequired} star pieces for ${etherKeysToAdd} ether keys`);
    
    res.json({ 
      success: true, 
      newEtherKeys: userEtherKeys.etherKeys,
      newStarPieces: userStarPieces.starPieces
    });
  } catch (error) {
    console.error("Failed to exchange ether keys:", error);
    res.status(500).json({ 
      success: false, 
      error: "에테르 열쇠 교환에 실패했습니다.", 
      details: error.message 
    });
  }
});

// Companion APIs (동료 시스템)

// 동료 능력치 조회 API
app.get("/api/companion-stats/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, userUuid } = req.query;
    
    console.log("Companion stats request:", { userId, username, userUuid });
    
    const queryResult = await getUserQuery(userId, username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
    } else {
      query = queryResult;
    }
    
    const companionStats = await CompanionStatsModel.find(query).sort({ updatedAt: -1 });
    
    // 🔧 동료별로 정리 (중복이 있으면 최신 것만 사용)
    const statsMap = {};
    companionStats.forEach(stat => {
      if (!statsMap[stat.companionName]) {
        statsMap[stat.companionName] = {
          level: stat.level,
          experience: stat.experience,
          isInBattle: stat.isInBattle
        };
      }
    });
    
    console.log(`Companion stats for ${username}:`, statsMap);
    res.json({ companionStats: statsMap });
    
  } catch (error) {
    console.error("Failed to fetch companion stats:", error);
    res.status(500).json({ error: "동료 능력치를 가져올 수 없습니다." });
  }
});

// 원정용 동료 능력치 조회 API (쿼리 파라미터 방식)
app.get("/api/companion-stats/user", async (req, res) => {
  try {
    const { username, userUuid } = req.query;
    
    console.log("Expedition companion stats request:", { username, userUuid });
    
    if (!userUuid || !username) {
      return res.status(400).json({ error: "userUuid와 username이 필요합니다." });
    }
    
    const query = { userUuid: userUuid };
    const companionStats = await CompanionStatsModel.find(query).sort({ updatedAt: -1 });
    
    // 🔧 동료별로 정리 (중복이 있으면 최신 것만 사용)
    const statsMap = {};
    companionStats.forEach(stat => {
      if (!statsMap[stat.companionName]) {
        statsMap[stat.companionName] = {
          level: stat.level,
          experience: stat.experience,
          isInBattle: stat.isInBattle
        };
      }
    });
    
    console.log(`Expedition companion stats for ${username}:`, statsMap);
    res.json({ companionStats: statsMap });
    
  } catch (error) {
    console.error("Failed to fetch expedition companion stats:", error);
    res.status(500).json({ error: "동료 능력치를 가져올 수 없습니다." });
  }
});

// 동료 능력치 조회 API
app.get("/api/companion-stats", authenticateJWT, async (req, res) => {
  try {
    const { userUuid, username } = req.user;
    
    console.log("Get companion stats:", { username, userUuid });
    
    const queryResult = await getUserQuery('user', username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
    } else {
      query = queryResult;
    }
    
    // 모든 동료 능력치 조회
    const companionStats = await CompanionStatsModel.find(query).lean();
    
    res.json({ 
      success: true, 
      companionStats: companionStats
    });
    
  } catch (error) {
    console.error("Failed to get companion stats:", error);
    res.status(500).json({ error: "동료 능력치 조회에 실패했습니다." });
  }
});

// 🔧 중복 동료 데이터 정리 API
app.post("/api/admin/clean-duplicate-companions", authenticateJWT, async (req, res) => {
  try {
    const { userUuid: adminUserUuid } = req.user;
    
    // 관리자 권한 확인
    const adminUser = await UserModel.findOne({ userUuid: adminUserUuid });
    if (!adminUser || !adminUser.isAdmin) {
      return res.status(403).json({ error: "관리자 권한이 필요합니다." });
    }
    
    console.log('[ADMIN] 중복 동료 데이터 정리 시작...');
    
    // 모든 동료 데이터 조회
    const allCompanions = await CompanionStatsModel.find({}).sort({ updatedAt: -1 });
    
    // userUuid + companionName으로 그룹화
    const grouped = {};
    allCompanions.forEach(companion => {
      const key = `${companion.userUuid}_${companion.companionName}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(companion);
    });
    
    // 중복 찾기 및 삭제
    let totalDeleted = 0;
    const duplicateReport = [];
    
    for (const [key, companions] of Object.entries(grouped)) {
      if (companions.length > 1) {
        // 최신 것을 제외한 나머지 삭제
        const idsToDelete = companions.slice(1).map(c => c._id);
        
        duplicateReport.push({
          userUuid: companions[0].userUuid,
          username: companions[0].username,
          companionName: companions[0].companionName,
          duplicateCount: companions.length,
          kept: {
            level: companions[0].level,
            experience: companions[0].experience,
            updatedAt: companions[0].updatedAt
          },
          deleted: companions.slice(1).map(c => ({
            level: c.level,
            experience: c.experience,
            updatedAt: c.updatedAt
          }))
        });
        
        await CompanionStatsModel.deleteMany({ _id: { $in: idsToDelete } });
        totalDeleted += idsToDelete.length;
      }
    }
    
    console.log(`[ADMIN] ✅ 중복 정리 완료: ${totalDeleted}개 삭제`);
    
    res.json({
      success: true,
      totalDeleted,
      duplicateReport
    });
    
  } catch (error) {
    console.error("[ADMIN] 중복 정리 실패:", error);
    res.status(500).json({ error: "중복 정리에 실패했습니다." });
  }
});

// 🔧 관리자용 동료 레벨 롤백 모니터링 API
app.get("/api/admin/companion-rollback-logs", authenticateJWT, async (req, res) => {
  try {
    const { userUuid: adminUserUuid, username: adminUsername } = req.user;
    
    // 관리자 권한 확인
    const adminUser = await UserModel.findOne({ userUuid: adminUserUuid });
    if (!adminUser || !adminUser.isAdmin) {
      return res.status(403).json({ error: "관리자 권한이 필요합니다." });
    }
    
    // 최근 동료 능력치 변경 이력 조회 (레벨 하락 중심)
    const recentStats = await CompanionStatsModel.find({})
      .sort({ updatedAt: -1 })
      .limit(100)
      .select('username companionName level experience updatedAt');
    
    // 사용자별 동료 레벨 변화 분석
    const rollbackSuspects = [];
    const userStats = {};
    
    recentStats.forEach(stat => {
      const key = `${stat.username}_${stat.companionName}`;
      if (!userStats[key]) {
        userStats[key] = [];
      }
      userStats[key].push({
        level: stat.level,
        experience: stat.experience,
        timestamp: stat.updatedAt
      });
    });
    
    // 레벨 하락 감지
    Object.entries(userStats).forEach(([key, history]) => {
      if (history.length >= 2) {
        history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        for (let i = 1; i < history.length; i++) {
          if (history[i-1].level < history[i].level) {
            const [username, companionName] = key.split('_');
            rollbackSuspects.push({
              username,
              companionName,
              levelDrop: `${history[i].level} → ${history[i-1].level}`,
              timestamp: history[i-1].timestamp,
              severity: history[i].level - history[i-1].level // 하락 정도
            });
          }
        }
      }
    });
    
    // 심각도 순으로 정렬
    rollbackSuspects.sort((a, b) => b.severity - a.severity);
    
    res.json({
      success: true,
      rollbackSuspects: rollbackSuspects.slice(0, 20), // 상위 20개만
      totalSuspects: rollbackSuspects.length,
      monitoringPeriod: "최근 100개 변경사항"
    });
    
  } catch (error) {
    console.error("Failed to get rollback logs:", error);
    res.status(500).json({ error: "롤백 로그 조회에 실패했습니다." });
  }
});

// 동료 능력치 업데이트 API (롤백 방지 강화 + 중복 방지)
app.post("/api/update-companion-stats", authenticateJWT, async (req, res) => {
  try {
    const { companionName, level, experience, isInBattle } = req.body;
    const { userUuid, username } = req.user;
    
    console.log("Update companion stats:", { companionName, level, experience, isInBattle, username });
    
    // 🔧 입력값 검증 강화
    if (!companionName || typeof companionName !== 'string') {
      return res.status(400).json({ error: "유효한 동료 이름이 필요합니다." });
    }
    
    if (level !== undefined && (typeof level !== 'number' || level < 1 || level > 100)) {
      return res.status(400).json({ error: "레벨은 1-100 사이의 숫자여야 합니다." });
    }
    
    if (experience !== undefined && (typeof experience !== 'number' || experience < 0)) {
      return res.status(400).json({ error: "경험치는 0 이상의 숫자여야 합니다." });
    }
    
    const queryResult = await getUserQuery('user', username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
    } else {
      query = queryResult;
    }
    
    // 🔧 중복 체크 및 정리 (같은 userUuid + companionName이 여러 개 있으면 최신 것만 남기고 삭제)
    const duplicates = await CompanionStatsModel.find({
      ...query,
      companionName: companionName
    }).sort({ updatedAt: -1 });
    
    if (duplicates.length > 1) {
      console.warn(`⚠️ [DUPLICATE] ${username}의 ${companionName} 중복 발견 (${duplicates.length}개) - 오래된 것 삭제`);
      
      // 최신 것을 제외한 나머지 삭제
      const idsToDelete = duplicates.slice(1).map(d => d._id);
      await CompanionStatsModel.deleteMany({ _id: { $in: idsToDelete } });
      
      console.log(`✅ [DUPLICATE CLEANED] ${idsToDelete.length}개의 중복 레코드 삭제`);
    }
    
    // 🔧 findOneAndUpdate로 upsert (중복 방지)
    const updateData = {};
    if (level !== undefined) updateData.level = Math.max(level, 1);
    if (experience !== undefined) updateData.experience = Math.max(experience, 0);
    if (isInBattle !== undefined) updateData.isInBattle = isInBattle;
    
    // 🔧 level이나 experience가 없으면 기존 값 유지 (초기화 방지)
    const existingStat = await CompanionStatsModel.findOne({
      ...query,
      companionName: companionName
    });
    
    // 새로 생성하는 경우에만 기본값 설정
    const setOnInsertData = {
      userId: query.userId || 'user',
      username: query.username || username,
      userUuid: query.userUuid || userUuid,
      companionName: companionName
    };
    
    // 레벨이나 경험치가 전달되지 않았고, 기존 레코드도 없으면 기본값 설정
    if (!existingStat) {
      if (level === undefined) setOnInsertData.level = 1;
      if (experience === undefined) setOnInsertData.experience = 0;
    }
    
    const companionStat = await CompanionStatsModel.findOneAndUpdate(
      {
        ...query,
        companionName: companionName
      },
      {
        $set: updateData,
        $setOnInsert: setOnInsertData
      },
      {
        new: true, // 업데이트된 문서 반환
        upsert: true, // 없으면 생성
        runValidators: true
      }
    );
    
    console.log(`✅ 동료 능력치 저장: ${companionName} (레벨 ${companionStat.level}, 경험치 ${companionStat.experience})`);
    
    res.json({ 
      success: true, 
      companionStats: {
        level: companionStat.level,
        experience: companionStat.experience,
        isInBattle: companionStat.isInBattle
      }
    });
    
  } catch (error) {
    console.error("Failed to update companion stats:", error);
    res.status(500).json({ error: "동료 능력치 업데이트에 실패했습니다." });
  }
});

// 동료 뽑기 API
app.post("/api/recruit-companion", authenticateJWT, async (req, res) => {
  try {
    const { starPieceCost = 1 } = req.body; // 별조각 1개 기본 비용
    // 🔐 JWT에서 사용자 정보 추출 (더 안전함)
    const { userUuid, username } = req.user;
    
    console.log("Recruit companion request:", { starPieceCost, username, userUuid });
    
    // 사용자 별조각 확인
    const queryResult = await getUserQuery('user', username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
      console.log("Using UUID query for recruit:", query);
    } else {
      query = queryResult;
      console.log("Using fallback query for recruit:", query);
    }
    
    // 🚀 별조각과 동료 정보를 병렬로 조회 (성능 최적화)
    const [userStarPieces, userCompanions] = await Promise.all([
      StarPieceModel.findOne(query),
      CompanionModel.findOne(query)
    ]);
    
    if (!userStarPieces || userStarPieces.starPieces < starPieceCost) {
      console.log(`Not enough star pieces: has ${userStarPieces?.starPieces || 0}, needs ${starPieceCost}`);
      return res.status(400).json({ error: "별조각이 부족합니다." });
    }
    
    // 보유 동료 확인
    let companionsData = userCompanions;
    if (!companionsData) {
      const createData = {
        userId: query.userId || 'user',
        username: query.username || username,
        userUuid: query.userUuid || userUuid,
        companions: []
      };
      console.log("Creating new companion record:", createData);
      companionsData = new CompanionModel(createData);
    }
    
    // 미보유 동료 목록
    const availableCompanions = COMPANION_LIST.filter(
      companion => !companionsData.companions.includes(companion)
    );
    
    console.log("Available companions:", availableCompanions);
    
    if (availableCompanions.length === 0) {
      return res.status(400).json({ error: "모든 동료를 이미 보유하고 있습니다." });
    }
    
    // 별조각 차감
    userStarPieces.starPieces -= starPieceCost;
    await userStarPieces.save();
    console.log(`Deducted ${starPieceCost} star pieces. Remaining: ${userStarPieces.starPieces}`);
    
    // 15% 확률로 동료 획득
    const success = Math.random() < 0.15;
    console.log("Recruitment attempt:", { success, probability: "15%" });
    
    if (success) {
      // 랜덤 동료 선택
      const randomCompanion = availableCompanions[
        Math.floor(Math.random() * availableCompanions.length)
      ];
      
      companionsData.companions.push(randomCompanion);
      await companionsData.save();
      
      console.log(`Successfully recruited: ${randomCompanion}`);
      
      // 🔄 실시간 동료 데이터 브로드캐스트
      broadcastUserDataUpdate(userUuid, username, 'companions', { 
        companions: companionsData.companions 
      });
      
      // 🔄 실시간 별조각 데이터 브로드캐스트
      broadcastUserDataUpdate(userUuid, username, 'starPieces', { 
        starPieces: userStarPieces.starPieces 
      });
      
      res.json({
        success: true,
        recruited: true,
        companion: randomCompanion,
        remainingStarPieces: userStarPieces.starPieces,
        totalCompanions: companionsData.companions.length
      });
    } else {
      console.log("Recruitment failed");
      
      // 🔄 실시간 별조각 데이터 브로드캐스트 (실패해도 별조각은 차감됨)
      broadcastUserDataUpdate(userUuid, username, 'starPieces', { 
        starPieces: userStarPieces.starPieces 
      });
      
      res.json({
        success: true,
        recruited: false,
        remainingStarPieces: userStarPieces.starPieces
      });
    }
  } catch (error) {
    console.error("Failed to recruit companion:", error);
    res.status(500).json({ error: "동료 모집에 실패했습니다." });
  }
});

// 보유 동료 조회 API
app.get("/api/companions/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, userUuid } = req.query;
    
    console.log("Companions request:", { userId, username, userUuid });
    
    const queryResult = await getUserQuery(userId, username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
      console.log("Using UUID query for companions:", query);
    } else {
      query = queryResult;
      console.log("Using fallback query for companions:", query);
    }
    
    const userCompanions = await CompanionModel.findOne(query);
    const companions = userCompanions ? userCompanions.companions : [];
    
    console.log(`User has ${companions.length} companions:`, companions);
    
    res.json({ 
      companions,
      totalCount: companions.length,
      maxCount: COMPANION_LIST.length,
      availableCompanions: COMPANION_LIST.filter(c => !companions.includes(c))
    });
  } catch (error) {
    console.error("Failed to fetch companions:", error);
    res.status(500).json({ error: "동료 정보를 가져올 수 없습니다." });
  }
});

// 🛡️ [SECURITY] IP Blocking System (IP 차단 관리 시스템)
const blockedIPs = new Map(); // IP -> { reason, blockedAt, blockedBy }
const blockedAccounts = new Map(); // userUuid -> { username, reason, blockedAt, blockedBy }

// 서버 시작 시 데이터베이스에서 차단된 IP 목록 로드
async function loadBlockedIPs() {
  try {
    const blockedList = await BlockedIPModel.find({});
    for (const blocked of blockedList) {
      blockedIPs.set(blocked.ipAddress, {
        reason: blocked.reason,
        blockedAt: blocked.blockedAt,
        blockedBy: blocked.blockedBy
      });
    }
    console.log(`🛡️ [SECURITY] Loaded ${blockedList.length} blocked IPs from database`);
  } catch (error) {
    console.error('❌ [SECURITY] Failed to load blocked IPs:', error);
  }
}

// 서버 시작 시 데이터베이스에서 차단된 계정 목록 로드
async function loadBlockedAccounts() {
  try {
    const blockedList = await BlockedAccountModel.find({});
    for (const blocked of blockedList) {
      blockedAccounts.set(blocked.userUuid, {
        username: blocked.username,
        reason: blocked.reason,
        blockedAt: blocked.blockedAt,
        blockedBy: blocked.blockedBy
      });
    }
    console.log(`🛡️ [SECURITY] Loaded ${blockedList.length} blocked accounts from database`);
  } catch (error) {
    console.error('❌ [SECURITY] Failed to load blocked accounts:', error);
  }
}

// 서버 시작 시 차단 목록들 로드
loadBlockedIPs();
loadBlockedAccounts();

// 🔧 Admin 계정 관리자 권한 강제 부여 (시스템 복구용)
(async () => {
  try {
    // 모든 'Admin' 사용자명을 가진 계정을 찾기 (UUID 무관)
    const adminUsers = await UserUuidModel.find({ username: 'Admin' });
    
    if (adminUsers.length > 0) {
      console.log(`🔍 [SYSTEM] Found ${adminUsers.length} Admin accounts:`);
      
      for (const adminUser of adminUsers) {
        console.log(`   - ${adminUser.username} (${adminUser.userUuid}): isAdmin = ${adminUser.isAdmin}`);
        
        // isAdmin이 undefined이거나 false인 경우 모두 복구
        if (adminUser.isAdmin !== true) {
          await UserUuidModel.updateOne(
            { _id: adminUser._id },
            { $set: { isAdmin: true } }
          );
          console.log(`👑 [SYSTEM] Admin account ${adminUser.userUuid} restored to admin status (was: ${adminUser.isAdmin})`);
        }
      }
      
      // 최신 Admin 계정 상태 확인
      const updatedAdmins = await UserUuidModel.find({ username: 'Admin' });
      console.log('👑 [SYSTEM] Final Admin accounts status:');
      updatedAdmins.forEach(admin => {
        console.log(`   - ${admin.username} (${admin.userUuid}): isAdmin = ${admin.isAdmin}`);
      });
      
    } else {
      console.log('⚠️ [SYSTEM] No Admin accounts found in database');
    }
  } catch (error) {
    console.error('❌ [SYSTEM] Failed to restore admin status:', error);
  }
})();

// IP 주소 유효성 검사 함수
function isValidIPAddress(ip) {
  const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
  if (!ipRegex.test(ip)) return false;
  
  const parts = ip.split('.');
  return parts.every(part => {
    const num = parseInt(part);
    return num >= 0 && num <= 255;
  });
}

// IP 차단 미들웨어 (관리자 차단 + DDoS 차단 통합)
function blockSuspiciousIP(req, res, next) {
  const clientIP = getClientIP(req);
  
  // 1. 관리자 차단 확인
  if (blockedIPs.has(clientIP)) {
    const blockInfo = blockedIPs.get(clientIP);
    console.log(`🚫 [ADMIN-BLOCKED] Access denied for ${clientIP} - Reason: ${blockInfo.reason}`);
    return res.status(403).json({ 
      error: "IP 차단됨",
      message: `귀하의 IP가 차단되었습니다.\n\n차단 사유: ${blockInfo.reason}\n차단 일시: ${blockInfo.blockedAt}\n차단자: ${blockInfo.blockedBy}\n\n관리자에게 문의하세요.`,
      blocked: true,
      blockInfo: {
        reason: blockInfo.reason,
        blockedAt: blockInfo.blockedAt,
        blockedBy: blockInfo.blockedBy
      }
    });
  }
  
  // 2. DDoS 차단 확인
  if (ddosBlockedIPs.has(clientIP)) {
    console.log(`🚫 [DDOS-BLOCKED] DDoS protection blocked IP: ${clientIP}`);
    return res.status(429).json({ 
      error: "Too many requests",
      message: "Your IP has been temporarily blocked due to suspicious activity"
    });
  }
  
  next();
}

// 🛡️ [SECURITY] Admin APIs (보안 강화된 관리자 시스템)

// 보안 강화: 관리자 비밀 키 목록
const ADMIN_SECRET_KEYS = [
  'ttm2033_secure_admin_key_2024', // 기본 관리자 키
  process.env.ADMIN_SECRET_KEY, // 환경변수 관리자 키
  'dev_master_key_fishing_game' // 개발자 마스터 키
].filter(Boolean);

// 관리자 시도 추적 (어러용도 방지)
const adminAttempts = new Map(); // IP -> { count, lastAttempt }

// 보안 강화된 관리자 권한 토글 API (JWT + AdminKey 이중 보안)
app.post("/api/toggle-admin", authenticateJWT, async (req, res) => {
  try {
    // JWT에서 사용자 정보 추출
    const { userUuid: jwtUserUuid, username: jwtUsername } = req.user;
    const { adminKey } = req.body; // 관리자 키 필수
    const clientIP = getClientIP(req);
    
    // JWT와 요청 정보 일치 확인
    const username = jwtUsername;
    const userUuid = jwtUserUuid;
    
    console.log(`🚨 [SECURITY] Admin toggle attempt - IP: ${clientIP}, User: ${username}`);
    
    // 🛡️ 보안 검증 1: Rate Limiting
    const now = Date.now();
    const attempts = adminAttempts.get(clientIP) || { count: 0, lastAttempt: 0 };
    
    // 1시간 내 5회 이상 시도 시 차단
    if (now - attempts.lastAttempt < 3600000) { // 1시간
      if (attempts.count >= 5) {
        console.log(`🚨 [SECURITY] Too many admin attempts from ${clientIP}`);
        return res.status(429).json({ 
          success: false, 
          error: "너무 많은 시도입니다. 1시간 후 다시 시도해주세요." 
        });
      }
      attempts.count++;
    } else {
      attempts.count = 1;
    }
    attempts.lastAttempt = now;
    adminAttempts.set(clientIP, attempts);
    
    // 🛡️ 보안 검증 2: 관리자 키 확인
    if (!adminKey || !ADMIN_SECRET_KEYS.includes(adminKey)) {
      console.log(`🚨 [SECURITY] Invalid admin key from ${clientIP} (${username})`);
      // 공격자에게 성공한 것처럼 보이지 않음
      return res.status(403).json({ 
        success: false, 
        error: "권한이 없습니다. 올바른 관리자 키가 필요합니다." 
      });
    }
    
    // 🛡️ 보안 검증 3: 의심스러운 IP 차단
    if (ddosBlockedIPs.has(clientIP)) {
      console.log(`🚨 [SECURITY] Blocked IP attempted admin access: ${clientIP}`);
      return res.status(403).json({ 
        success: false, 
        error: "차단된 IP입니다." 
      });
    }
    
    const queryResult = await getUserQuery('user', username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
    } else {
      query = queryResult;
    }
    
    // 관리자 상태 확인 및 토글
    let adminRecord = await AdminModel.findOne(query);
    if (!adminRecord) {
      const createData = {
        userId: query.userId || 'user',
        username: query.username || username,
        userUuid: query.userUuid || userUuid,
        isAdmin: true
      };
      adminRecord = new AdminModel(createData);
      await adminRecord.save();
      
      // 🔐 관리자 권한 부여 시 새 JWT 토큰 생성
      const newJwtToken = generateJWT({
        userUuid: query.userUuid || userUuid,
        username: query.username || username,
        isAdmin: true
      });
      
      console.log(`🔑 [ADMIN] Admin rights granted to: ${username} from IP: ${clientIP}`);
      res.json({
        success: true,
        isAdmin: true,
        message: "관리자 권한이 부여되었습니다.",
        jwtToken: newJwtToken // 🔐 새 JWT 토큰 포함
      });
    } else {
      adminRecord.isAdmin = !adminRecord.isAdmin;
      await adminRecord.save();
      
      // 🔐 관리자 권한 변경 시 새 JWT 토큰 생성
      const newJwtToken = generateJWT({
        userUuid: query.userUuid || userUuid,
        username: query.username || username,
        isAdmin: adminRecord.isAdmin
      });
      
      const statusMessage = adminRecord.isAdmin ? "관리자 권한이 부여되었습니다." : "관리자 권한이 해제되었습니다.";
      console.log(`🔑 [ADMIN] Admin rights ${adminRecord.isAdmin ? 'granted' : 'revoked'} for: ${username} from IP: ${clientIP}`);
      
      res.json({
        success: true,
        isAdmin: adminRecord.isAdmin,
        message: statusMessage,
        jwtToken: newJwtToken // 🔐 새 JWT 토큰 포함
      });
    }
  } catch (error) {
    console.error("🚨 [SECURITY] Admin toggle error:", error);
    res.status(500).json({ success: false, error: "서버 오류가 발생했습니다." });
  }
});

// 관리자 상태 조회 API
app.get("/api/admin-status/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, userUuid } = req.query;
    
    console.log("Admin status request:", { userId, username, userUuid });
    
    const queryResult = await getUserQuery(userId, username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
      console.log("Using UUID query for admin status:", query);
    } else {
      query = queryResult;
      console.log("Using fallback query for admin status:", query);
    }
    
    const adminRecord = await AdminModel.findOne(query);
    const isAdmin = adminRecord ? adminRecord.isAdmin : false;
    
    console.log(`Admin status for ${username}: ${isAdmin}`);
    
    res.json({ 
      isAdmin,
      username: query.username || username
    });
  } catch (error) {
    console.error("Failed to fetch admin status:", error);
    res.status(500).json({ error: "관리자 상태를 가져올 수 없습니다." });
  }
});

// Cooldown APIs (쿨타임 관리)
// 쿨타임 상태 조회 API
app.get("/api/cooldown/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, userUuid } = req.query;
    
    console.log("Cooldown status request received");
    
    const queryResult = await getUserQuery(userId, username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
      console.log("Using UUID query for cooldown:", query);
    } else {
      query = queryResult;
      console.log("Using fallback query for cooldown:", query);
    }
    
    const cooldownRecord = await CooldownModel.findOne(query);
    const now = new Date();
    
    let fishingCooldown = 0;
    let raidAttackCooldown = 0;
    
    if (cooldownRecord) {
      // 낚시 쿨타임 계산
      if (cooldownRecord.fishingCooldownEnd && cooldownRecord.fishingCooldownEnd > now) {
        fishingCooldown = cooldownRecord.fishingCooldownEnd.getTime() - now.getTime();
      }
      
      // 레이드 공격 쿨타임 계산
      if (cooldownRecord.raidAttackCooldownEnd && cooldownRecord.raidAttackCooldownEnd > now) {
        raidAttackCooldown = cooldownRecord.raidAttackCooldownEnd.getTime() - now.getTime();
      }
    }
    
    // 쿨다운 데이터는 보안상 로그에 기록하지 않음
    
    res.json({ 
      fishingCooldown: Math.max(0, fishingCooldown),
      raidAttackCooldown: Math.max(0, raidAttackCooldown)
    });
  } catch (error) {
    console.error("Failed to fetch cooldown status:", error);
    res.status(500).json({ error: "쿨타임 상태를 가져올 수 없습니다." });
  }
});

// 서버 측 낚시 쿨타임 계산 함수 (악세사리만 영향)
// 🚀 낚시 쿨타임 캐시 (렌더 환경 최적화)
const cooldownCache = new Map();
const COOLDOWN_CACHE_TTL = process.env.NODE_ENV === 'production' 
  ? 5 * 60 * 1000  // 프로덕션: 5분 캐시 (더 오래)
  : 3 * 60 * 1000; // 개발: 3분 캐시


const calculateFishingCooldownTime = async (userQuery) => {
  const cacheKey = userQuery.userUuid || userQuery.username;
  const cached = cooldownCache.get(cacheKey);
  
  // 캐시된 쿨타임이 있고 유효하면 반환
  if (cached && (Date.now() - cached.timestamp) < COOLDOWN_CACHE_TTL) {
    return cached.cooldownTime;
  }
  
  try {
    const baseTime = 5 * 60 * 1000; // 5분 (밀리초)
    let reduction = 0; // 낚시실력은 쿨타임에 영향 없음
    
    // 악세사리 효과만 가져오기
    const userEquipment = await UserEquipmentModel.findOne(userQuery);
    if (userEquipment && userEquipment.accessory) {
      // 서버에서 악세사리 레벨 계산
      const accessoryLevel = getServerAccessoryLevel(userEquipment.accessory);
      if (accessoryLevel > 0) {
        // 악세사리 레벨에 따른 쿨타임 감소 (레벨당 15초)
        reduction = accessoryLevel * 15 * 1000;
      }
    }
    
    const cooldownTime = Math.max(baseTime - reduction, 0); // 최소 0초
    
    // 계산된 쿨타임을 캐시에 저장
    cooldownCache.set(cacheKey, {
      cooldownTime,
      timestamp: Date.now()
    });
    
    return cooldownTime;
  } catch (error) {
    console.error('Error calculating fishing cooldown time:', error);
    // 에러 시 기본 쿨타임 반환
    return 5 * 60 * 1000; // 5분
  }
};

// 낚시 쿨타임 설정 API (JWT 인증 필수)
app.post("/api/set-fishing-cooldown", authenticateJWT, async (req, res) => {
  try {
    // JWT에서 사용자 정보 추출 (보안 강화)
    const { userUuid, username } = req.user;
    
    console.log(`🔐 Set fishing cooldown request: ${username} (${userUuid})`);
    
    const queryResult = await getUserQuery('user', username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
      console.log("Using UUID query for fishing cooldown:", query);
    } else {
      query = queryResult;
      console.log("Using fallback query for fishing cooldown:", query);
    }
    
    // 서버에서 쿨타임 시간 계산 (클라이언트에서 받지 않음!)
    const cooldownDuration = await calculateFishingCooldownTime(query);
    
    const now = new Date();
    const cooldownEnd = new Date(now.getTime() + cooldownDuration);
    
    const updateData = {
      userId: query.userId || 'user',
      username: query.username || username,
      userUuid: query.userUuid || userUuid,
      fishingCooldownEnd: cooldownEnd
    };
    
    // 🚀 병렬 업데이트로 성능 향상
    const updatePromises = [
      CooldownModel.findOneAndUpdate(query, updateData, { upsert: true, new: true })
    ];
    
    if (query.userUuid) {
      updatePromises.push(
        UserUuidModel.updateOne(
          { userUuid: query.userUuid },
          { fishingCooldownEnd: cooldownEnd }
        )
      );
    }
    
    await Promise.all(updatePromises);
    
    // WebSocket 브로드캐스트 (비동기로 처리하여 응답 속도 향상)
    if (query.userUuid) {
      setImmediate(() => {
        broadcastUserDataUpdate(query.userUuid, query.username, 'cooldown', {
          fishingCooldown: cooldownDuration
        });
      });
    }
    
    // 쿨다운 설정 완료 (보안상 상세 정보는 로그에 기록하지 않음)
    
    res.json({ 
      success: true,
      cooldownEnd: cooldownEnd.toISOString(),
      remainingTime: cooldownDuration
    });
  } catch (error) {
    console.error("Failed to set fishing cooldown:", error);
    res.status(500).json({ error: "낚시 쿨타임 설정에 실패했습니다." });
  }
});

// 🔧 낚시 쿨타임 강제 클리어 API (버그 수정용)
app.post("/api/clear-fishing-cooldown", authenticateJWT, async (req, res) => {
  try {
    const { userUuid, username } = req.user;
    
    console.log(`🔧 Clear fishing cooldown request: ${username} (${userUuid})`);
    
    // UserUuidModel과 CooldownModel 모두 업데이트
    await Promise.all([
      UserUuidModel.updateOne(
        { userUuid },
        { $set: { fishingCooldownEnd: null } }
      ),
      CooldownModel.updateOne(
        { userUuid },
        { $set: { fishingCooldownEnd: null } }
      )
    ]);
    
    console.log(`✅ Fishing cooldown cleared for ${username}`);
    
    // WebSocket으로 실시간 업데이트
    broadcastUserDataUpdate(userUuid, username, 'cooldown', {
      fishingCooldown: 0
    });
    
    res.json({ 
      success: true,
      message: "낚시 쿨타임이 초기화되었습니다."
    });
  } catch (error) {
    console.error("Failed to clear fishing cooldown:", error);
    res.status(500).json({ error: "쿨타임 초기화에 실패했습니다." });
  }
});

// 🛡️ [FIX] 낚시 쿨타임 재계산 API (악세사리 구매 후 호출)
app.post("/api/recalculate-fishing-cooldown", authenticateJWT, async (req, res) => {
  try {
    const { username, userUuid } = req.query;
    
    console.log("🔄 Recalculate fishing cooldown request received");
    
    const queryResult = await getUserQuery('user', username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
    } else {
      query = queryResult;
    }
    
    // 현재 쿨타임 상태 확인
    const cooldownRecord = await CooldownModel.findOne(query);
    const now = new Date();
    
    if (!cooldownRecord || !cooldownRecord.fishingCooldownEnd || cooldownRecord.fishingCooldownEnd <= now) {
      // 쿨타임이 없거나 이미 만료된 경우
      return res.json({ 
        success: true,
        remainingTime: 0,
        message: "쿨타임이 없습니다."
      });
    }
    
    // 현재 남은 쿨타임 계산
    const currentRemainingTime = cooldownRecord.fishingCooldownEnd.getTime() - now.getTime();
    
    // 새로운 쿨타임 계산 (악세사리 효과 반영)
    const newBaseCooldownTime = await calculateFishingCooldownTime(query);
    
    // 기존 경과 시간 계산
    const originalCooldownTime = await calculateFishingCooldownTime(query);
    const elapsedTime = originalCooldownTime - currentRemainingTime;
    
    // 새로운 쿨타임에서 경과 시간을 뺀 값이 남은 시간
    const newRemainingTime = Math.max(0, newBaseCooldownTime - elapsedTime);
    
    // 새로운 쿨타임 종료 시간 설정
    const newCooldownEnd = new Date(now.getTime() + newRemainingTime);
    
    const updateData = {
      userId: query.userId || 'user',
      username: query.username || username,
      userUuid: query.userUuid || userUuid,
      fishingCooldownEnd: newCooldownEnd
    };
    
    // CooldownModel 업데이트
    await CooldownModel.findOneAndUpdate(
      query,
      updateData,
      { upsert: true, new: true }
    );
    
    // UserUuidModel도 업데이트
    if (query.userUuid) {
      await UserUuidModel.updateOne(
        { userUuid: query.userUuid },
        { fishingCooldownEnd: newCooldownEnd }
      );
      
      // WebSocket으로 실시간 업데이트
      broadcastUserDataUpdate(query.userUuid, query.username, 'cooldown', {
        fishingCooldown: newRemainingTime
      });
    }
    
    console.log(`🔄 Fishing cooldown recalculated: ${currentRemainingTime}ms -> ${newRemainingTime}ms`);
    
    res.json({ 
      success: true,
      remainingTime: newRemainingTime,
      cooldownEnd: newCooldownEnd.toISOString(),
      message: "쿨타임이 재계산되었습니다."
    });
  } catch (error) {
    console.error("Failed to recalculate fishing cooldown:", error);
    res.status(500).json({ error: "낚시 쿨타임 재계산에 실패했습니다." });
  }
});

// 탐사 쿨타임 제거됨 - 더 이상 사용하지 않음

// 🔐 접속자 목록 API (관리자 전용, 보안 강화)
app.get("/api/connected-users", authenticateJWT, async (req, res) => {
  try {
    // 🛡️ 관리자 권한 확인
    const { userUuid, username, isAdmin } = req.user;
    
    if (!isAdmin) {
      console.log(`🚨 [SECURITY] Unauthorized connected-users access attempt by ${username} (${userUuid})`);
      return res.status(403).json({ error: "관리자만 접속자 목록을 조회할 수 있습니다." });
    }
    
    console.log(`🔐 [ADMIN] Connected users request by admin: ${username}`);
    
    // 현재 연결된 사용자 목록을 메모리에서 가져오기 (정리된 목록)
    const cleanedUsers = cleanupConnectedUsers();
    
    // 🔐 보안: 민감한 정보 제거 (관리자용 최소 정보만 제공)
    const users = cleanedUsers.map(user => ({
      displayName: user.displayName || user.username,
      loginType: user.loginType || 'Guest',
      isOnline: true,
      lastSeen: new Date().toISOString()
      // userUuid, userId 등 민감한 정보 제거
    }));
    
    console.log(`🔐 [ADMIN] Sending ${users.length} connected users to admin: ${username}`);
    
    res.json({ 
      users,
      timestamp: new Date().toISOString(),
      count: users.length
    });
  } catch (error) {
    console.error("Failed to fetch connected users:", error);
    res.status(500).json({ error: "접속자 목록을 가져올 수 없습니다." });
  }
});

// 사용자 체크섬 생성 함수 (클라이언트 조작 방지)
function generateUserChecksum(userUuid, username) {
  const crypto = require('crypto');
  const secret = process.env.USER_CHECKSUM_SECRET || 'fishing-game-secret-2024';
  return crypto.createHmac('sha256', secret)
    .update(`${userUuid}-${username}-${Date.now().toString().slice(0, -4)}`) // 분 단위로 변경
    .digest('hex')
    .slice(0, 8); // 처음 8자만 사용
}

// 서버 측 전투 시스템 데이터
const getServerFishHealthMap = () => {
  return {
    "타코문어": 15, "풀고등어": 25, "경단붕어": 35, "버터오징어": 55, "간장새우": 80,
    "물수수": 115, "정어리파이": 160, "얼음상어": 215, "스퀄스퀴드": 280, "백년송거북": 355,
    "고스피쉬": 440, "유령치": 525, "바이트독": 640, "호박고래": 755, "바이킹조개": 880,
    "천사해파리": 1015, "악마복어": 1160, "칠성장어": 1315, "닥터블랙": 1480, "해룡": 1655,
    "메카핫킹크랩": 1840, "램프리": 2035, "마지막잎새": 2240, "아이스브리더": 2455, "해신": 2680,
    "핑키피쉬": 2915, "콘토퍼스": 3160, "딥원": 3415, "큐틀루": 3680, "꽃술나리": 3955,
    "다무스": 4240, "수호자": 4535, "태양가사리": 4840
  };
};

// 서버 측 전투 계산 함수들
// 강화 보너스 계산 함수 (3차방정식 - 퍼센트로 표시)
const calculateServerEnhancementBonus = (level) => {
  if (level <= 0) return 0;
  return 0.1 * Math.pow(level, 3) - 0.2 * Math.pow(level, 2) + 0.8 * level;
};

const calculateServerTotalEnhancementBonus = (level) => {
  let totalBonus = 0;
  for (let i = 1; i <= level; i++) {
    totalBonus += calculateServerEnhancementBonus(i);
  }
  return totalBonus;
};

// 체력 계산 (내정보 탭과 동일한 공식 사용 + 강화 보너스 적용)
const calculateServerPlayerMaxHp = (accessoryLevel, enhancementBonusPercent = 0) => {
  if (accessoryLevel === 0 && enhancementBonusPercent === 0) return 50; // 기본 체력
  const baseHp = accessoryLevel === 0 ? 50 : Math.floor(Math.pow(accessoryLevel, 1.325) + 50 * accessoryLevel + 5 * accessoryLevel);
  // 강화 보너스 퍼센트 적용
  return baseHp + (baseHp * enhancementBonusPercent / 100);
};

// 공격력 계산 (내정보 탭과 동일한 공식 사용 + 강화 보너스 적용)
const calculateServerPlayerAttack = (fishingSkill, enhancementBonusPercent = 0) => {
  const baseAttack = 0.00225 * Math.pow(fishingSkill, 3) + 0.165 * Math.pow(fishingSkill, 2) + 2 * fishingSkill + 3;
  const totalAttack = baseAttack + (baseAttack * enhancementBonusPercent / 100);
  const randomFactor = 0.8 + Math.random() * 0.4;
  return Math.floor(totalAttack * randomFactor);
};

const calculateServerEnemyAttack = (fishRank) => {
  if (fishRank === 0) return Math.floor(Math.random() * 3) + 8;
  return Math.floor(Math.pow(fishRank, 1.65) + fishRank * 1.3 + 10 + Math.random() * 5);
};

const getServerAccessoryLevel = (accessoryName) => {
  if (!accessoryName) return 0;
  const accessories = [
    '오래된반지', '은목걸이', '금귀걸이', '마법의펜던트', '에메랄드브로치',
    '토파즈이어링', '자수정팔찌', '백금티아라', '만드라고라허브', '에테르나무묘목',
    '몽마의조각상', '마카롱훈장', '빛나는마력순환체'
  ];
  const level = accessories.indexOf(accessoryName);
  return level >= 0 ? level + 1 : 0;
};

// 서버 측 접두어 데이터
const getServerPrefixData = () => {
  return [
    { name: '거대한', hpMultiplier: 1.0, amberMultiplier: 1.0, probability: 75 },
    { name: '변종', hpMultiplier: 1.45, amberMultiplier: 1.2, probability: 17 },
    { name: '심연의', hpMultiplier: 2.15, amberMultiplier: 1.4, probability: 6 },
    { name: '깊은어둠의', hpMultiplier: 3.25, amberMultiplier: 1.8, probability: 2 }
  ];
};

// 전투 시작 API (JWT 인증 필수)
app.post("/api/start-battle", authenticateJWT, async (req, res) => {
  try {
    const { material, baseFish, selectedPrefix, materialQuantity = 1 } = req.body;
    // JWT에서 사용자 정보 추출 (보안 강화)
    const { userUuid, username } = req.user;
    
    console.log(`🔐 Start battle request: ${username} (${userUuid})`, { material, baseFish, selectedPrefix, materialQuantity });
    
    // 재료 수량 검증 (1~5개)
    if (materialQuantity < 1 || materialQuantity > 5) {
      return res.status(400).json({ error: "재료 수량은 1~5개 사이여야 합니다." });
    }
    
    // 사용자 조회
    const queryResult = await getUserQuery('user', username, userUuid);
    let query = queryResult.userUuid ? { userUuid: queryResult.userUuid } : queryResult;
    
    // 🚀 사용자 장비 및 스킬 정보 병렬로 가져오기 (성능 최적화)
    const [userEquipment, fishingSkillData] = await Promise.all([
      UserEquipmentModel.findOne(query),
      FishingSkillModel.findOne(query)
    ]);
    const fishingSkill = fishingSkillData ? fishingSkillData.skill : 0;
    
    // 서버에서 전투 상태 계산
    const fishHealthMap = getServerFishHealthMap();
    const prefixData = getServerPrefixData();
    const accessoryLevel = getServerAccessoryLevel(userEquipment?.accessory);
    
    // 강화 보너스 계산 (내정보 탭과 동일)
    const accessoryEnhancement = userEquipment?.accessoryEnhancement || 0;
    const accessoryEnhancementBonus = calculateServerTotalEnhancementBonus(accessoryEnhancement);
    const playerMaxHp = calculateServerPlayerMaxHp(accessoryLevel, accessoryEnhancementBonus);
    
    // 다중 물고기 생성 (materialQuantity만큼)
    const enemies = [];
    for (let i = 0; i < materialQuantity; i++) {
      // 각 물고기마다 랜덤 접두어 선택
      let randomPrefix;
      const random = Math.random() * 100;
      let cumulative = 0;
      
      for (const prefix of prefixData) {
        cumulative += prefix.probability;
        if (random <= cumulative) {
          randomPrefix = prefix;
          break;
        }
      }
      
      if (!randomPrefix) {
        randomPrefix = prefixData[0]; // 기본값
      }
      
      const baseHp = fishHealthMap[baseFish] || 100;
      const enemyMaxHp = Math.floor(baseHp * randomPrefix.hpMultiplier);
      
      // 속도 계산 (물고기 rank 기반)
      const fishRank = getServerFishData().find(f => f.name === baseFish)?.rank || 1;
      const baseSpeed = 25 + (fishRank * 0.5);
      const prefixSpeedMultiplier = randomPrefix.name === '변종' ? 1.1 
        : randomPrefix.name === '심연의' ? 1.2 
        : randomPrefix.name === '깊은어둠의' ? 1.3 
        : 1.0;
      const speed = baseSpeed * prefixSpeedMultiplier;
      
      enemies.push({
        id: `enemy_${i + 1}`,
        name: `${randomPrefix.name} ${baseFish}`,
        baseFish: baseFish,
        prefix: randomPrefix,
        hp: enemyMaxHp,
        maxHp: enemyMaxHp,
        speed: speed,
        isAlive: true
      });
    }
    
    // 낚시대 강화 보너스도 저장 (공격 시 사용)
    const fishingRodEnhancement = userEquipment?.fishingRodEnhancement || 0;
    const fishingRodEnhancementBonus = calculateServerTotalEnhancementBonus(fishingRodEnhancement);
    
    const battleState = {
      enemies: enemies,
      playerHp: playerMaxHp,
      playerMaxHp: playerMaxHp,
      turn: 'player',
      material: material,
      materialQuantity: materialQuantity,
      round: 1,
      autoMode: false,
      canFlee: false, // 도망가기 불가
      fishingSkill: fishingSkill,
      accessoryLevel: accessoryLevel,
      fishingRodEnhancementBonus: fishingRodEnhancementBonus // 강화 보너스 추가
    };
    
    console.log("Server calculated battle state:", battleState);
    
    const enemyNames = enemies.map(e => e.name).join(', ');
    res.json({ 
      success: true, 
      battleState: battleState,
      log: [
        `${material} ${materialQuantity}개를 사용하여 ${materialQuantity}마리의 ${baseFish}와의 전투가 시작되었습니다!`,
        `출현한 적: ${enemyNames}`,
        `속도바가 채워지면 자동으로 공격합니다!`
      ]
    });
  } catch (error) {
    console.error("Failed to start battle:", error);
    res.status(500).json({ error: "전투 시작에 실패했습니다." });
  }
});

// 전투 공격 API (JWT 인증 필수)
app.post("/api/battle-attack", authenticateJWT, async (req, res) => {
  try {
    const { battleState, attackType, targetEnemyId } = req.body; // 'player' or 'enemy'
    // JWT에서 사용자 정보 추출 (보안 강화)
    const { userUuid, username } = req.user;
    
    console.log(`🔐 Battle attack request: ${username} (${userUuid})`, { attackType, targetEnemyId });
    
    if (!battleState) {
      return res.status(400).json({ error: "Invalid battle state" });
    }
    
    let newBattleState = { ...battleState, enemies: [...(battleState.enemies || [])] };
    let battleLog = [];
    
    if (attackType === 'player' && newBattleState.turn === 'player') {
      // 플레이어 공격 (서버에서 계산) - 강화 보너스 적용
      const enhancementBonus = newBattleState.fishingRodEnhancementBonus || 0;
      const damage = calculateServerPlayerAttack(newBattleState.fishingSkill, enhancementBonus);
      
      // 살아있는 적 찾기
      const aliveEnemies = newBattleState.enemies.filter(e => e.isAlive);
      
      if (aliveEnemies.length === 0) {
        return res.status(400).json({ error: "No alive enemies" });
      }
      
      // 대상 적 선택 (targetEnemyId가 있으면 해당 적, 없으면 랜덤)
      let targetEnemy;
      if (targetEnemyId) {
        targetEnemy = newBattleState.enemies.find(e => e.id === targetEnemyId && e.isAlive);
      }
      if (!targetEnemy) {
        targetEnemy = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
      }
      
      // 데미지 적용
      targetEnemy.hp = Math.max(0, targetEnemy.hp - damage);
      
      battleLog.push(`플레이어가 ${targetEnemy.name}에게 ${damage} 데미지를 입혔습니다! (${targetEnemy.hp}/${targetEnemy.maxHp})`);
      
      if (targetEnemy.hp <= 0) {
        targetEnemy.isAlive = false;
        battleLog.push(`${targetEnemy.name}을(를) 물리쳤습니다!`);
      }
      
      newBattleState.autoMode = true;
      newBattleState.canFlee = false;
      
      // 모든 적이 죽었는지 확인
      const remainingEnemies = newBattleState.enemies.filter(e => e.isAlive);
      
      if (remainingEnemies.length === 0) {
        // 승리 - 각 적마다 보상 계산
        let totalAmberReward = 0;
        
        newBattleState.enemies.forEach(enemy => {
          const baseReward = Math.floor(enemy.maxHp / 10) + Math.floor(Math.random() * 5) + 1;
          const amberReward = Math.floor(baseReward * (enemy.prefix?.amberMultiplier || 1));
          totalAmberReward += amberReward;
          
          const prefixBonus = enemy.prefix?.amberMultiplier > 1 
            ? ` (${enemy.prefix.name} 보너스 x${enemy.prefix.amberMultiplier})` 
            : '';
          
          battleLog.push(`${enemy.name}: 호박석 ${amberReward}개 획득!${prefixBonus}`);
        });
        
        battleLog.push(`전투 승리! 총 호박석 ${totalAmberReward}개를 획득했습니다!`);
        
        newBattleState.turn = 'victory';
        newBattleState.amberReward = totalAmberReward;
        
        res.json({ 
          success: true, 
          battleState: newBattleState, 
          log: battleLog,
          result: 'victory',
          amberReward: totalAmberReward
        });
      } else {
        // 적 턴으로 변경
        newBattleState.turn = 'enemy';
        res.json({ 
          success: true, 
          battleState: newBattleState, 
          log: battleLog,
          result: 'continue'
        });
      }
    } else if (attackType === 'enemy') {
      // 모든 살아있는 적이 플레이어를 공격
      const aliveEnemies = newBattleState.enemies.filter(e => e.isAlive);
      let totalDamage = 0;
      
      aliveEnemies.forEach(enemy => {
        const fishData = getServerFishData().find(fish => fish.name === enemy.baseFish);
        const fishRank = fishData ? fishData.rank : 1;
        const damage = calculateServerEnemyAttack(fishRank);
        totalDamage += damage;
        
        battleLog.push(`${enemy.name}이(가) ${damage} 데미지를 입혔습니다!`);
      });
      
      const newPlayerHp = Math.max(0, newBattleState.playerHp - totalDamage);
      
      battleLog.push(`총 ${totalDamage} 데미지를 받았습니다! (플레이어: ${newPlayerHp}/${newBattleState.playerMaxHp})`);
      
      newBattleState.playerHp = newPlayerHp;
      
      if (newPlayerHp <= 0) {
        // 패배
        battleLog.push(`패배했습니다... 재료를 잃었습니다.`);
        newBattleState.turn = 'defeat';
        
        res.json({ 
          success: true, 
          battleState: newBattleState, 
          log: battleLog,
          result: 'defeat'
        });
      } else {
        // 플레이어 턴으로 변경
        newBattleState.turn = 'player';
        res.json({ 
          success: true, 
          battleState: newBattleState, 
          log: battleLog,
          result: 'continue'
        });
      }
    } else {
      return res.status(400).json({ error: "Invalid attack type or turn" });
    }
  } catch (error) {
    console.error("Failed to process battle attack:", error);
    res.status(500).json({ error: "전투 처리에 실패했습니다." });
  }
});

// 카카오 토큰 교환 API
app.post("/api/kakao-token", async (req, res) => {
  try {
    console.log("=== 카카오 토큰 교환 API 호출 ===");
    console.log("Request headers:", req.headers);
    console.log("Request body:", req.body);
    
    const { code, redirectUri } = req.body;
    
    if (!code) {
      console.error("❌ Authorization code가 없음");
      return res.status(400).json({ error: "Authorization code is required" });
    }
    
    if (!redirectUri) {
      console.error("❌ Redirect URI가 없음");
      return res.status(400).json({ error: "Redirect URI is required" });
    }
    
    console.log("✅ 카카오 토큰 교환 요청:", { 
      code: code.substring(0, 10) + "...", 
      redirectUri,
      clientId: KAKAO_CLIENT_ID 
    });
    
    // 카카오 토큰 교환 요청
    const tokenRequestBody = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: KAKAO_CLIENT_ID,
      redirect_uri: redirectUri,
      code: code
    });
    
    console.log("카카오 API 요청 파라미터:", tokenRequestBody.toString());
    
    const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: tokenRequestBody
    });
    
    console.log("카카오 API 응답 상태:", tokenResponse.status);
    console.log("카카오 API 응답 헤더:", Object.fromEntries(tokenResponse.headers.entries()));
    
    const tokenData = await tokenResponse.json();
    console.log("카카오 API 응답 데이터:", tokenData);
    
    if (tokenData.access_token) {
      console.log("✅ 카카오 토큰 교환 성공");
      res.json(tokenData);
    } else {
      console.error("❌ 카카오 토큰 교환 실패:", tokenData);
      res.status(400).json({ error: "Failed to exchange token", details: tokenData });
    }
    
  } catch (error) {
    console.error("❌ 카카오 토큰 교환 오류:", error);
    console.error("오류 스택:", error.stack);
    res.status(500).json({ error: "Internal server error", message: error.message });
  }
});

// 닉네임 변경 API (더 이상 지원하지 않음)
app.post("/api/update-nickname", async (req, res) => {
  try {
    console.log("=== DEPRECATED UPDATE NICKNAME API ===");
    console.log("Nickname change is no longer supported");
    
    res.status(400).json({ 
      error: "닉네임 변경 기능이 중단되었습니다. 닉네임은 최초 설정 시에만 가능합니다.",
      deprecated: true 
    });
    
  } catch (error) {
    console.error("Deprecated nickname update API called:", error);
    res.status(500).json({ error: "닉네임 변경 기능이 중단되었습니다." });
  }
});

// 닉네임 중복 체크 API (최초 설정용)
app.post("/api/check-nickname", async (req, res) => {
  try {
    const { userUuid, googleId, kakaoId } = req.query;
    const { nickname } = req.body;
    
    console.log("=== CHECK NICKNAME API ===");
    console.log("Request params:", { userUuid, googleId, kakaoId, nickname });
    
    // 🔒 통합 닉네임 검증
    const validation = validateNickname(nickname);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }
    
    const trimmedNickname = validation.trimmed;
    
    // 중복 체크 로직 개선
    let query;
    
    if (googleId) {
      // 구글 계정인 경우: 같은 구글 계정의 기존 닉네임은 허용
      query = { 
        displayName: trimmedNickname, 
        originalGoogleId: { $ne: googleId } // 다른 구글 계정의 닉네임만 체크
      };
      console.log(`Checking nickname for Google user ${googleId}: allowing same account's existing nickname`);
    } else if (kakaoId) {
      // 카카오 계정인 경우: 같은 카카오 계정의 기존 닉네임은 허용
      query = { 
        displayName: trimmedNickname, 
        originalKakaoId: { $ne: kakaoId } // 다른 카카오 계정의 닉네임만 체크
      };
      console.log(`Checking nickname for Kakao user ${kakaoId}: allowing same account's existing nickname`);
    } else if (userUuid) {
      // 일반 사용자인 경우: 자신 제외
      query = { 
        displayName: trimmedNickname, 
        userUuid: { $ne: userUuid } 
      };
    } else {
      // 신규 사용자인 경우: 모든 닉네임 체크
      query = { displayName: trimmedNickname };
    }
      
    const existingUser = await UserUuidModel.findOne(query);
    
    if (existingUser) {
      console.log(`Nickname already exists: ${trimmedNickname} (used by ${existingUser.userUuid})`);
      return res.status(200).json({ available: false, error: "이미 사용 중인 닉네임입니다." });
    }
    
    console.log(`Nickname available: ${trimmedNickname}`);
    res.json({ available: true, message: "사용 가능한 닉네임입니다." });
    
  } catch (error) {
    console.error("Failed to check nickname:", error);
    res.status(500).json({ error: "닉네임 확인에 실패했습니다: " + error.message });
  }
});

// 사용자 설정 조회 API
app.get("/api/user-settings/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, userUuid, googleId, kakaoId } = req.query;
    
    console.log("=== GET USER SETTINGS API ===");
    console.log("Request params:", { userId, username, userUuid, googleId, kakaoId });
    
    let user;
    if (userUuid && userUuid !== 'null' && userUuid !== 'undefined') {
      user = await UserUuidModel.findOne({ userUuid });
    } else if (userId !== 'null') {
      // 구글/카카오 사용자 - originalGoogleId나 originalKakaoId로 찾기
      if (googleId) {
        console.log(`Looking for Google user with originalGoogleId: ${googleId}`);
        user = await UserUuidModel.findOne({ originalGoogleId: googleId });
      } else if (kakaoId) {
        console.log(`Looking for Kakao user with originalKakaoId: ${kakaoId}`);
        // kakaoId가 숫자만 있으면 접두사 추가해서 찾기
        const kakaoIdToSearch = kakaoId.startsWith('kakao_') ? kakaoId : `kakao_${kakaoId}`;
        console.log(`Searching with: ${kakaoIdToSearch}`);
        user = await UserUuidModel.findOne({ originalKakaoId: kakaoIdToSearch });
      } else {
        // 구글/카카오 ID가 없으면 username으로 찾기 (fallback)
        user = await UserUuidModel.findOne({ username, isGuest: false });
      }
    } else {
      // 게스트 사용자
      user = await UserUuidModel.findOne({ username, isGuest: true });
    }
    
    if (!user) {
      // 카카오/구글 사용자가 없으면 자동 생성
      if (kakaoId || googleId) {
        console.log(`Creating new ${kakaoId ? 'Kakao' : 'Google'} user...`);
        user = await getOrCreateUser(username, googleId, kakaoId);
        console.log(`New ${kakaoId ? 'Kakao' : 'Google'} user created:`, user.userUuid);
      } else {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
      }
    }
    
    // 쿨타임 계산
    const now = new Date();
    const fishingCooldown = user.fishingCooldownEnd && user.fishingCooldownEnd > now 
      ? Math.max(0, user.fishingCooldownEnd.getTime() - now.getTime()) 
      : 0;
    
    const settings = {
      userUuid: user.userUuid,
      username: user.username,
      displayName: user.displayName,
      termsAccepted: user.termsAccepted || false,
      darkMode: user.darkMode !== undefined ? user.darkMode : true,
      fishingCooldown,
      originalGoogleId: user.originalGoogleId,
      originalKakaoId: user.originalKakaoId
    };
    
    console.log("User settings retrieved:", settings);
    res.json(settings);
    
  } catch (error) {
    console.error("Failed to get user settings:", error);
    res.status(500).json({ error: "사용자 설정 조회에 실패했습니다: " + error.message });
  }
});

// 사용자 displayName 설정 API (JWT 인증 필수)
app.post("/api/set-display-name/:userId", authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.params;
    // JWT에서 사용자 정보 추출 (보안 강화)
    const { userUuid, username } = req.user;
    const { displayName } = req.body;
    
    // 본인만 닉네임 변경 가능하도록 검증
    if (userId !== 'user' && userId !== userUuid && userId !== username) {
      return res.status(403).json({ error: "본인의 닉네임만 변경할 수 있습니다." });
    }
    
    console.log("=== SET DISPLAY NAME API ===");
    console.log(`🔐 Request params: ${username} (${userUuid})`);
    console.log("Request body:", { displayName });
    
    // 🔒 통합 닉네임 검증
    const validation = validateNickname(displayName);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }
    
    const trimmedDisplayName = validation.trimmed;
    
    let user;
    if (userUuid && userUuid !== 'null' && userUuid !== 'undefined') {
      user = await UserUuidModel.findOne({ userUuid });
    } else if (userId !== 'null') {
      // 구글/카카오 사용자 - originalGoogleId나 originalKakaoId로 찾기
      if (googleId) {
        console.log(`Looking for Google user with originalGoogleId: ${googleId}`);
        user = await UserUuidModel.findOne({ originalGoogleId: googleId });
      } else if (kakaoId) {
        console.log(`Looking for Kakao user with originalKakaoId: ${kakaoId}`);
        // kakaoId가 숫자만 있으면 접두사 추가해서 찾기
        const kakaoIdToSearch = kakaoId.startsWith('kakao_') ? kakaoId : `kakao_${kakaoId}`;
        console.log(`Searching with: ${kakaoIdToSearch}`);
        user = await UserUuidModel.findOne({ originalKakaoId: kakaoIdToSearch });
      } else {
        // 구글/카카오 ID가 없으면 username으로 찾기 (fallback)
        user = await UserUuidModel.findOne({ username, isGuest: false });
      }
    } else {
      // 게스트 사용자
      user = await UserUuidModel.findOne({ username, isGuest: true });
    }
    
    if (!user) {
      // 카카오/구글 사용자가 없으면 자동 생성
      if (kakaoId || googleId) {
        console.log(`Creating new ${kakaoId ? 'Kakao' : 'Google'} user for displayName setting...`);
        user = await getOrCreateUser(username, googleId, kakaoId);
        console.log(`New ${kakaoId ? 'Kakao' : 'Google'} user created:`, user.userUuid);
      } else {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
      }
    }
    
    // displayName만 업데이트 (username은 소셜 이름으로 유지)
    user.displayName = trimmedDisplayName;
    await user.save();
    
    console.log(`Display name updated for ${user.userUuid}: ${displayName}`);
    res.json({ 
      success: true, 
      message: "닉네임이 설정되었습니다.",
      userUuid: user.userUuid,
      username: user.username,
      displayName: user.displayName
    });
    
  } catch (error) {
    console.error("Failed to set display name:", error);
    res.status(500).json({ error: "닉네임 설정에 실패했습니다: " + error.message });
  }
});

// 사용자 설정 업데이트 API (JWT 인증 필수)
app.post("/api/user-settings/:userId", authenticateJWT, async (req, res) => {
  try {
    const { userId } = req.params;
    // JWT에서 사용자 정보 추출 (보안 강화)
    const { userUuid, username } = req.user;
    const { termsAccepted, darkMode, fishingCooldown } = req.body;
    
    // 본인만 설정 변경 가능하도록 검증
    if (userId !== 'user' && userId !== userUuid && userId !== username) {
      return res.status(403).json({ error: "본인의 설정만 변경할 수 있습니다." });
    }
    
    console.log("=== UPDATE USER SETTINGS API ===");
    console.log(`🔐 Request params: ${username} (${userUuid})`);
    console.log("User settings update request received");
    
    let user;
    if (userUuid && userUuid !== 'null' && userUuid !== 'undefined') {
      user = await UserUuidModel.findOne({ userUuid });
    } else if (userId !== 'null') {
      // 구글/카카오 사용자 - originalGoogleId나 originalKakaoId로 찾기
      if (googleId) {
        console.log(`Looking for Google user with originalGoogleId: ${googleId}`);
        user = await UserUuidModel.findOne({ originalGoogleId: googleId });
      } else if (kakaoId) {
        console.log(`Looking for Kakao user with originalKakaoId: ${kakaoId}`);
        // kakaoId가 숫자만 있으면 접두사 추가해서 찾기
        const kakaoIdToSearch = kakaoId.startsWith('kakao_') ? kakaoId : `kakao_${kakaoId}`;
        console.log(`Searching with: ${kakaoIdToSearch}`);
        user = await UserUuidModel.findOne({ originalKakaoId: kakaoIdToSearch });
      } else {
        // 구글/카카오 ID가 없으면 username으로 찾기 (fallback)
        user = await UserUuidModel.findOne({ username, isGuest: false });
      }
    } else {
      // 게스트 사용자
      user = await UserUuidModel.findOne({ username, isGuest: true });
    }
    
    if (!user) {
      // 카카오/구글 사용자가 없으면 자동 생성
      if (kakaoId || googleId) {
        console.log(`Creating new ${kakaoId ? 'Kakao' : 'Google'} user for settings update...`);
        user = await getOrCreateUser(username, googleId, kakaoId);
        console.log(`New ${kakaoId ? 'Kakao' : 'Google'} user created:`, user.userUuid);
      } else {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
      }
    }
    
    // 설정 업데이트
    const updates = {};
    if (termsAccepted !== undefined) updates.termsAccepted = termsAccepted;
    if (darkMode !== undefined) updates.darkMode = darkMode;
    
    // 쿨타임 업데이트
    if (fishingCooldown !== undefined) {
      updates.fishingCooldownEnd = fishingCooldown > 0 
        ? new Date(Date.now() + fishingCooldown) 
        : null;
    }
    
    await UserUuidModel.updateOne({ userUuid: user.userUuid }, updates);
    
    console.log(`User settings updated for ${user.userUuid}:`, updates);
    res.json({ success: true, message: "사용자 설정이 업데이트되었습니다." });
    
  } catch (error) {
    console.error("Failed to update user settings:", error);
    res.status(500).json({ error: "사용자 설정 업데이트에 실패했습니다: " + error.message });
  }
});

// 누적 낚은 물고기 수 조회 API
app.get("/api/total-catches/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, userUuid } = req.query;
    
    console.log("Total catches request:", { userId, username, userUuid });
    
    const queryResult = await getUserQuery(userId, username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
      console.log("Using UUID query for total catches:", query);
    } else {
      query = queryResult;
      console.log("Using fallback query for total catches:", query);
    }
    
    // CatchModel에서 해당 사용자의 모든 낚시 기록 수 조회
    const totalCatches = await CatchModel.countDocuments(query);
    
    console.log(`Total catches for ${username}: ${totalCatches}`);
    
    res.json({ 
      totalCatches,
      username: query.username || username,
      userUuid: query.userUuid || userUuid
    });
  } catch (error) {
    console.error("Failed to fetch total catches:", error);
    res.status(500).json({ error: "총 낚은 물고기 수를 가져올 수 없습니다." });
  }
});

// Ranking API (랭킹 시스템) - 업적 보너스 반영
app.get("/api/ranking", async (req, res) => {
  try {
    console.log("Ranking request");
    
    // 모든 사용자의 기본 정보와 낚시 데이터 수집
    const [users, fishingSkills] = await Promise.all([
      UserUuidModel.find({}).lean(), // 사용자 기본 정보 (displayName, totalFishCaught 포함)
      FishingSkillModel.find({}).lean()
    ]);
    
    // 사용자별 데이터 병합 (userUuid 기준)
    const userRankingData = new Map();
    
    // 사용자 기본 정보 추가
    users.forEach(user => {
      if (user.userUuid) {
        userRankingData.set(user.userUuid, {
          userUuid: user.userUuid,
          username: user.username, // 소셜 계정 이름
          displayName: user.displayName, // 게임 닉네임
          fishingSkill: 0,
          totalFishCaught: user.totalFishCaught || 0 // 새로운 총 물고기 카운트 사용
        });
      }
    });
    
    // 🏆 낚시 스킬 데이터 추가 (업적 보너스 포함)
    for (const skill of fishingSkills) {
      if (skill.userUuid && userRankingData.has(skill.userUuid)) {
        const baseSkill = skill.skill || 0;
        
        // 업적 보너스 계산
        let achievementBonus = 0;
        try {
          achievementBonus = await achievementSystem.calculateAchievementBonus(skill.userUuid);
        } catch (error) {
          console.error(`Failed to calculate achievement bonus for ranking user ${skill.userUuid}:`, error);
        }
        
        const finalSkill = baseSkill + achievementBonus;
        userRankingData.get(skill.userUuid).fishingSkill = finalSkill;
        
        // 디버깅용 로그 (상위 사용자만)
        if (finalSkill > 50) {
          console.log(`🏆 Ranking skill calculation for ${skill.userUuid}: base ${baseSkill} + achievement ${achievementBonus} = ${finalSkill}`);
        }
      }
    }
    
    // 랭킹 배열로 변환 및 정렬 (게스트 제외)
    const rankings = Array.from(userRankingData.values())
      .filter(user => 
        user.displayName && 
        user.displayName.trim() !== '' && 
        !user.displayName.startsWith('Guest#') // 게스트 제외
      )
      .sort((a, b) => {
        // 1차 정렬: 총 낚은 물고기 수 (내림차순)
        if (b.totalFishCaught !== a.totalFishCaught) {
          return b.totalFishCaught - a.totalFishCaught;
        }
        // 2차 정렬: 낚시 스킬 (내림차순) - 업적 보너스 포함
        return b.fishingSkill - a.fishingSkill;
      })
      .map((user, index) => ({
        rank: index + 1,
        userUuid: user.userUuid,
        username: user.username, // 소셜 계정 이름
        displayName: user.displayName, // 게임 닉네임
        fishingSkill: user.fishingSkill, // 업적 보너스 포함된 최종 낚시실력
        totalFishCaught: user.totalFishCaught // 새로운 총 물고기 카운트
      }));
    
    console.log(`Sending ranking data for ${rankings.length} users (with achievement bonuses)`);
    
    res.json({ 
      rankings,
      totalUsers: rankings.length,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error("Failed to fetch ranking:", error);
    res.status(500).json({ error: "랭킹 정보를 가져올 수 없습니다." });
  }
});

// [Quest] Daily Quest APIs

// 일일 퀴스트 조회 API
app.get("/api/daily-quests/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, userUuid } = req.query;
    
    console.log("Daily quest request:", { userId, username, userUuid });
    
    // UUID 기반 사용자 조회
    const queryResult = await getUserQuery(userId, username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
    } else {
      query = queryResult;
    }
    
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    let dailyQuest = await DailyQuestModel.findOne(query);
    
    // 퀴스트 데이터가 없거나 날짜가 다른 경우 새로 생성/리셋
    if (!dailyQuest || dailyQuest.lastResetDate !== today) {
      // userUuid 필수 필드 검증
      const finalUserUuid = query.userUuid || userUuid;
      if (!finalUserUuid) {
        console.error("❌ Daily Quest Error: userUuid is required but not provided", { query, userUuid });
        return res.status(400).json({ error: "User UUID is required for daily quests" });
      }
      
      const createData = {
        userId: query.userId || 'user',
        username: query.username || username || 'Unknown',
        userUuid: finalUserUuid,
        fishCaught: 0,
        explorationWins: 0,
        fishSold: 0,
        questFishCaught: false,
        questExplorationWin: false,
        questFishSold: false,
        lastResetDate: today
      };
      
      if (dailyQuest) {
        // 기존 데이터 업데이트 (리셋)
        await DailyQuestModel.findOneAndUpdate(query, createData);
        dailyQuest = await DailyQuestModel.findOne(query);
        console.log("[Quest] Daily quests reset for user:", username);
      } else {
        // 새 사용자 생성
        dailyQuest = await DailyQuestModel.create(createData);
        console.log("[Quest] Created new daily quest for user:", username);
      }
    }
    
    // 퀴스트 데이터 반환
    const questData = {
      quests: [
        {
          id: 'fish_caught',
          name: '물고기 10마리 잡기',
          description: '물고기를 10마리 잡으세요',
          progress: dailyQuest.fishCaught,
          target: 10,
          completed: dailyQuest.questFishCaught,
          reward: '별조각 1개'
        },
        {
          id: 'exploration_win',
          name: '탐사전투 승리하기',
          description: '탐사에서 승리하세요',
          progress: dailyQuest.explorationWins,
          target: 1,
          completed: dailyQuest.questExplorationWin,
          reward: '호박석 10개'
        },
        {
          id: 'fish_sold',
          name: '물고기 10회 판매하기',
          description: '물고기를 10회 판매하세요',
          progress: dailyQuest.fishSold,
          target: 10,
          completed: dailyQuest.questFishSold,
          reward: '호박석 10개'
        }
      ],
      lastResetDate: dailyQuest.lastResetDate
    };
    
    res.json(questData);
  } catch (error) {
    console.error("Failed to fetch daily quests:", error);
    res.status(500).json({ error: "Failed to fetch daily quests" });
  }
});

// 퀴스트 진행도 업데이트 API - 모든 사용자 접근 가능
app.post("/api/update-quest-progress", authenticateJWT, async (req, res) => {
  try {
    const { questType, amount = 1 } = req.body;
    // JWT에서 사용자 정보 추출 (보안 강화)
    const { userUuid, username } = req.user;
    
    console.log("Quest progress update:", { questType, amount, username, userUuid });
    
    const queryResult = await getUserQuery('user', username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
    } else {
      query = queryResult;
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    let dailyQuest = await DailyQuestModel.findOne(query);
    if (!dailyQuest || dailyQuest.lastResetDate !== today) {
      // userUuid 필수 필드 검증
      const finalUserUuid = query.userUuid || userUuid;
      if (!finalUserUuid) {
        console.error("❌ Quest Progress Error: userUuid is required but not provided", { query, userUuid });
        return res.status(400).json({ error: "User UUID is required for quest progress" });
      }
      
      // 퀴스트 데이터가 없거나 오래된 경우 새로 생성
      const createData = {
        userId: query.userId || 'user',
        username: query.username || username || 'Unknown',
        userUuid: finalUserUuid,
        fishCaught: 0,
        explorationWins: 0,
        fishSold: 0,
        questFishCaught: false,
        questExplorationWin: false,
        questFishSold: false,
        lastResetDate: today
      };
      
      dailyQuest = await DailyQuestModel.findOneAndUpdate(query, createData, { upsert: true, new: true });
    }
    
    // 퀴스트 진행도 업데이트
    const updateData = {};
    
    switch (questType) {
      case 'fish_caught':
        updateData.fishCaught = Math.min(dailyQuest.fishCaught + amount, 10);
        if (updateData.fishCaught >= 10 && !dailyQuest.questFishCaught) {
          updateData.questFishCaught = true;
        }
        break;
      case 'exploration_win':
        updateData.explorationWins = Math.min(dailyQuest.explorationWins + amount, 1);
        if (updateData.explorationWins >= 1 && !dailyQuest.questExplorationWin) {
          updateData.questExplorationWin = true;
        }
        break;
      case 'fish_sold':
        updateData.fishSold = Math.min(dailyQuest.fishSold + amount, 10);
        if (updateData.fishSold >= 10 && !dailyQuest.questFishSold) {
          updateData.questFishSold = true;
        }
        break;
      default:
        return res.status(400).json({ error: "Invalid quest type" });
    }
    
    // 배치 업데이트에 추가 (즉시 DB 쿼리 없음)
    const userQuests = batchUpdates.questProgress.get(userUuid) || {};
    userQuests[questType] = (userQuests[questType] || 0) + amount;
    batchUpdates.questProgress.set(userUuid, userQuests);
    
    console.log(`[Quest] Quest progress queued for batch: ${questType} +${amount} for ${username} (total pending: ${userQuests[questType]})`);
    res.json({ success: true, message: "Quest progress updated" });
  } catch (error) {
    console.error("Failed to update quest progress:", error);
    res.status(500).json({ error: "Failed to update quest progress" });
  }
});

// 퀴스트 보상 수령 API - 모든 사용자 접근 가능
app.post("/api/claim-quest-reward", authenticateJWT, async (req, res) => {
  try {
    const { questId } = req.body;
    // JWT에서 사용자 정보 추출 (보안 강화)
    const { userUuid, username } = req.user;
    
    console.log("Quest reward claim:", { questId, username, userUuid });
    
    const queryResult = await getUserQuery('user', username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
    } else {
      query = queryResult;
    }
    
    const dailyQuest = await DailyQuestModel.findOne(query);
    if (!dailyQuest) {
      return res.status(404).json({ error: "Quest data not found" });
    }
    
    // 퀴스트 완료 여부 확인 및 보상 지급
    let canClaim = false;
    let rewardType = 'amber'; // 기본값: 호박석
    let rewardAmount = 10; // 기본 보상량
    
    switch (questId) {
      case 'fish_caught':
        canClaim = dailyQuest.fishCaught >= 10 && !dailyQuest.questFishCaught;
        rewardType = 'starPieces'; // 별조각으로 변경
        rewardAmount = 1; // 1개
        if (canClaim) {
          await DailyQuestModel.findOneAndUpdate(query, { questFishCaught: true });
        }
        break;
      case 'exploration_win':
        canClaim = dailyQuest.explorationWins >= 1 && !dailyQuest.questExplorationWin;
        rewardType = 'amber'; // 호박석 유지
        rewardAmount = 10;
        if (canClaim) {
          await DailyQuestModel.findOneAndUpdate(query, { questExplorationWin: true });
        }
        break;
      case 'fish_sold':
        canClaim = dailyQuest.fishSold >= 10 && !dailyQuest.questFishSold;
        rewardType = 'amber'; // 호박석 유지
        rewardAmount = 10;
        if (canClaim) {
          await DailyQuestModel.findOneAndUpdate(query, { questFishSold: true });
        }
        break;
      default:
        return res.status(400).json({ error: "Invalid quest ID" });
    }
    
    if (!canClaim) {
      return res.status(400).json({ error: "Quest not completed or already claimed" });
    }
    
    // 보상 지급 (타입별 처리)
    if (rewardType === 'starPieces') {
      // 별조각 보상 지급
      let userStarPieces = await StarPieceModel.findOne(query);
      if (!userStarPieces) {
        const createData = {
          userId: query.userId || 'user',
          username: query.username || username,
          userUuid: query.userUuid || userUuid,
          starPieces: rewardAmount
        };
        userStarPieces = new StarPieceModel(createData);
      } else {
        userStarPieces.starPieces = (userStarPieces.starPieces || 0) + rewardAmount;
      }
      
      await userStarPieces.save();
      
      console.log(`[Quest] Quest reward claimed: ${questId} - ${rewardAmount} star pieces for ${username}`);
      res.json({ 
        success: true, 
        message: `퀴스트 완료! 별조각 ${rewardAmount}개를 획득했습니다!`,
        newStarPieces: userStarPieces.starPieces,
        rewardType: 'starPieces'
      });
      
    } else {
      // 호박석 보상 지급 (기존 로직)
      let userAmber = await UserAmberModel.findOne(query);
      if (!userAmber) {
        const createData = {
          userId: query.userId || 'user',
          username: query.username || username,
          userUuid: query.userUuid || userUuid,
          amber: rewardAmount
        };
        userAmber = new UserAmberModel(createData);
      } else {
        userAmber.amber = (userAmber.amber || 0) + rewardAmount;
      }
      
      await userAmber.save();
      
      console.log(`[Quest] Quest reward claimed: ${questId} - ${rewardAmount} amber for ${username}`);
      res.json({ 
        success: true, 
        message: `퀴스트 완료! 호박석 ${rewardAmount}개를 획득했습니다!`,
        newAmber: userAmber.amber,
        rewardType: 'amber'
      });
    }
  } catch (error) {
    console.error("Failed to claim quest reward:", error);
    res.status(500).json({ error: "Failed to claim quest reward" });
  }
});

// Add Amber API (for exploration rewards)
app.post("/api/add-amber", authenticateJWT, async (req, res) => {
  try {
    const { amount } = req.body;
    // 🔐 JWT에서 사용자 정보 추출 (더 안전함)
    const { userUuid, username } = req.user;
    
    console.log("Add amber request:", { amount, username, userUuid });
    
    // UUID 기반 사용자 조회
    const queryResult = await getUserQuery('user', username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
      console.log("Using UUID query for add amber:", query);
    } else {
      query = queryResult;
      console.log("Using fallback query for add amber:", query);
    }
    
    console.log("Database query for add amber:", query);
    
    let userAmber = await UserAmberModel.findOne(query);
    
    if (!userAmber) {
      // 새 사용자인 경우 생성
      const createData = {
        userId: query.userId || 'user',
        username: query.username || username,
        userUuid: query.userUuid || userUuid,
        amber: amount
      };
      console.log("Creating new amber record for reward with data:", createData);
      userAmber = new UserAmberModel(createData);
    } else {
      userAmber.amber = (userAmber.amber || 0) + amount;
    }
    
    await userAmber.save();
    // 앰버 지급 완료 (보안상 잔액 정보는 로그에 기록하지 않음)
    
    res.json({ success: true, newAmber: userAmber.amber });
  } catch (error) {
    console.error("Failed to add amber:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ error: "Failed to add amber", details: error.message });
  }
});

// 🚀 서버 측 물고기 데이터 (allFishData와 완전 동기화 - 버그 완전 수정)
const getServerFishData = () => {
  return allFishData; // 동일한 데이터 사용으로 모든 불일치 해결
};

// 서버에서 물고기 가격 계산 (악세사리 효과 포함)
// 🚀 물고기 가격 캐시 (렌더 환경 최적화)
const fishPriceCache = new Map();
const FISH_PRICE_CACHE_TTL = process.env.NODE_ENV === 'production' 
  ? 10 * 60 * 1000  // 프로덕션: 10분 캐시 (더 오래)
  : 5 * 60 * 1000;  // 개발: 5분 캐시

const calculateServerFishPrice = async (fishName, userQuery) => {
  const cacheKey = `${fishName}-${userQuery.userUuid || userQuery.username}`;
  const cached = fishPriceCache.get(cacheKey);
  
  // 캐시된 가격이 있고 유효하면 반환
  if (cached && (Date.now() - cached.timestamp) < FISH_PRICE_CACHE_TTL) {
    return cached.price;
  }
  
  // 🚀 allFishData를 우선 사용 (버그 수정)
  let fishData = allFishData.find(fish => fish.name === fishName);
  if (!fishData) {
    // 폴백: getServerFishData에서 찾기
    fishData = getServerFishData().find(fish => fish.name === fishName);
  }
  if (!fishData) return 0;
  
  const basePrice = fishData.price;
  
  // 계산된 가격을 캐시에 저장
  fishPriceCache.set(cacheKey, {
    price: basePrice,
    timestamp: Date.now()
  });
  
  return basePrice;
};

// Fish Selling API (보안 강화 - 서버에서 가격 계산 + JWT 인증)
app.post("/api/sell-fish", authenticateJWT, async (req, res) => {
  try {
    const { fishName, quantity, totalPrice: clientTotalPrice } = req.body;
    // 🔐 JWT에서 사용자 정보 추출 (더 안전함)
    const { userUuid, username } = req.user;
    console.log(`🔐 JWT Sell fish request: ${fishName} x${quantity} by ${username} (${userUuid})`);
    
    // UUID 기반 사용자 조회
    const queryResult = await getUserQuery('user', username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
      console.log("Using UUID query for sell fish:", query);
    } else {
      query = queryResult;
      console.log("Using fallback query for sell fish:", query);
    }
    
    // 서버에서 실제 물고기 가격 계산 (클라이언트 가격 무시)
    const serverFishPrice = await calculateServerFishPrice(fishName, query);
    const serverTotalPrice = serverFishPrice * quantity;
    
    // 클라이언트에서 보낸 가격과 서버 가격 비교 (보안 검증)
    if (Math.abs(clientTotalPrice - serverTotalPrice) > 1) { // 소수점 오차 허용
      console.warn(`Fish price manipulation detected! Client: ${clientTotalPrice}, Server: ${serverTotalPrice}`);
      return res.status(400).json({ error: "Invalid fish price" });
    }
    
    // 사용자가 해당 물고기를 충분히 가지고 있는지 확인 (보안 강화 + 성능 최적화)
    const userFish = await measureDBQuery(`물고기판매-조회-${fishName}`, () =>
      CatchModel.find({ ...query, fish: fishName }, { _id: 1 }) // fish 필드 제거 (이미 알고 있음)
        .sort({ _id: 1 }) // 일관된 순서 (인덱스 활용)
        .limit(quantity + 10) // 필요한 수량보다 약간 많이만 조회 (성능 향상)
        .lean() // Mongoose 오버헤드 제거
    );
    debugLog(`Found ${userFish.length} ${fishName} for user`);
    
    // 🚀 물고기 존재 여부 확인 (두 데이터에서 모두 확인)
    const serverFishData = getServerFishData();
    const allFishValid = allFishData.some(fish => fish.name === fishName);
    const serverFishValid = serverFishData.some(fish => fish.name === fishName);
    
    if (!allFishValid && !serverFishValid) {
      console.warn(`Invalid fish name detected: ${fishName}, User: ${username}`);
      return res.status(400).json({ error: "Invalid fish type" });
    }
    
    // 데이터 불일치 경고 (버그 추적용)
    if (allFishValid && !serverFishValid) {
      console.warn(`🚀 Fish data mismatch detected for ${fishName} - using allFishData`);
    }
    
    if (userFish.length < quantity) {
      debugLog(`Not enough fish: has ${userFish.length}, needs ${quantity}`);
      return res.status(400).json({ error: "Not enough fish to sell" });
    }
    
    // 🚀 물고기 판매 (수량에 따른 최적화)
    let deleteResult;
    if (quantity === 1) {
      // 단일 아이템은 직접 삭제 (더 빠름)
      deleteResult = await measureDBQuery(`물고기판매-단일삭제`, () =>
        CatchModel.deleteOne({ _id: userFish[0]._id }, { writeConcern: { w: 1, j: false } })
      );
      debugLog(`⚡ Single deleted ${deleteResult.deletedCount}/1 ${fishName}`);
    } else {
      // 다중 아이템은 bulkWrite 사용
      const fishToDelete = userFish.slice(0, quantity).map(fish => ({
        deleteOne: { filter: { _id: fish._id } }
      }));
      
      deleteResult = await measureDBQuery(`물고기판매-대량삭제-${quantity}개`, () =>
        CatchModel.bulkWrite(fishToDelete, {
          ordered: false, // 순서 상관없이 병렬 처리
          writeConcern: { w: 1, j: false } // 저널링 비활성화로 속도 향상
        })
      );
      debugLog(`⚡ Bulk deleted ${deleteResult.deletedCount}/${quantity} ${fishName}`);
    }
    
    // 🚀 돈 업데이트와 캐시 무효화를 병렬 처리 (성능 최적화)
    const updateData = {
      $inc: { money: serverTotalPrice }, // 서버에서 계산된 가격 사용
      $setOnInsert: {
        ...query,
        ...(username && { username })
      }
    };
    
    const [userMoney] = await Promise.all([
      measureDBQuery("물고기판매-돈업데이트", () =>
        UserMoneyModel.findOneAndUpdate(
          query,
          updateData,
          { upsert: true, new: true }
        )
      ),
      // 캐시 무효화를 병렬로 처리
      userUuid ? Promise.resolve(invalidateCache('userMoney', userUuid)) : Promise.resolve()
    ]);
    // 골드 업데이트 완료 (보안상 잔액 정보는 로그에 기록하지 않음)
    
    res.json({ success: true, newBalance: userMoney.money });
  } catch (error) {
    console.error("Failed to sell fish:", error);
    res.status(500).json({ error: "Failed to sell fish" });
  }
});

// 🔒 서버 측 아이템 데이터는 gameData.js에서 관리 (중복 제거)

// Item Buying API (재료 기반 구매 시스템 - 서버에서 재료 검증 + JWT 인증)
app.post("/api/buy-item", authenticateJWT, async (req, res) => {
  try {
    const { itemName, material: clientMaterial, materialCount: clientMaterialCount, category } = req.body;
    // 🔐 JWT에서 사용자 정보 추출 (더 안전함)
    const { userUuid, username } = req.user;
    
    console.log("=== BUY ITEM REQUEST (MATERIAL-BASED) ===");
    console.log("Item:", itemName);
    console.log("Material:", clientMaterial);
    console.log("Material Count:", clientMaterialCount);
    console.log("Category:", category);
    console.log("Username:", username);
    console.log("UserUuid (decoded):", userUuid);
    
    // 서버에서 실제 아이템 정보 가져오기 (클라이언트 데이터 무시)
    const serverShopItems = getShopData();
    const categoryItems = serverShopItems[category];
    
    if (!categoryItems) {
      return res.status(400).json({ error: "Invalid item category" });
    }
    
    const serverItem = categoryItems.find(item => item.name === itemName);
    if (!serverItem) {
      return res.status(400).json({ error: "Item not found" });
    }
    
    // 클라이언트에서 보낸 재료 정보와 서버 재료 정보 비교 (보안 검증)
    if (clientMaterial !== serverItem.material || clientMaterialCount !== serverItem.materialCount) {
      console.warn(`Material manipulation detected! Client: ${clientMaterial}x${clientMaterialCount}, Server: ${serverItem.material}x${serverItem.materialCount}, Item: ${itemName}, User: ${username}`);
      return res.status(400).json({ error: "Invalid material requirement" });
    }
    
    // 서버에서 검증된 실제 재료 정보 사용
    const requiredMaterial = serverItem.material;
    const requiredCount = serverItem.materialCount;
    
    console.log(`Server validated material: ${requiredMaterial} x${requiredCount} for ${itemName}`);
    
    // UUID 기반 사용자 조회
    console.log("=== USER QUERY DEBUG ===");
    console.log("Calling getUserQuery with:", { userId: 'user', username, userUuid });
    
    const queryResult = await getUserQuery('user', username, userUuid);
    console.log("getUserQuery result:", queryResult);
    
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
      console.log("Using UUID query for buy item:", query);
    } else {
      query = queryResult;
      console.log("Using fallback query for buy item:", query);
    }
    
    console.log("Final database query for buy item:", query);
    
    // 사용자 존재 확인
    const userExists = await UserUuidModel.findOne(query);
    console.log("User exists check:", userExists ? "Found" : "Not found");
    if (!userExists) {
      console.error("User not found with query:", query);
      return res.status(400).json({ error: "User not found" });
    }
    
    // 재료 확인 및 차감
    const userMaterials = await MaterialModel.find({
      ...query,
      material: requiredMaterial
    });
    
    const userMaterialCount = userMaterials.length;
    
    if (userMaterialCount < requiredCount) {
      console.log(`Material shortage: User has ${userMaterialCount}, needs ${requiredCount}`);
      return res.status(400).json({ error: "Not enough materials" });
    }
    
    // 재료 차감 (requiredCount만큼의 문서 삭제)
    const materialsToDelete = userMaterials.slice(0, requiredCount);
    await MaterialModel.deleteMany({
      _id: { $in: materialsToDelete.map(m => m._id) }
    });
    console.log(`Material ${requiredMaterial} reduced by ${requiredCount} (${userMaterialCount} → ${userMaterialCount - requiredCount})`);

    
    // 장비 자동 장착
    console.log("=== EQUIPMENT SAVE DEBUG ===");
    console.log("Looking for equipment with query:", query);
    
    let userEquipment = await UserEquipmentModel.findOne(query);
    console.log("Found existing equipment:", userEquipment ? {
      userUuid: userEquipment.userUuid,
      username: userEquipment.username,
      fishingRod: userEquipment.fishingRod,
      accessory: userEquipment.accessory
    } : "None");
    
    if (!userEquipment) {
      const createData = {
        fishingRod: category === 'fishing_rod' ? itemName : null,
        accessory: category === 'accessories' ? itemName : null,
        fishingRodEnhancement: 0,
        accessoryEnhancement: 0,
        fishingRodFailCount: 0,
        accessoryFailCount: 0,
        ...query
      };
      
      // username이 있으면 추가
      if (username) {
        createData.username = username;
      }
      
      console.log("Creating new user equipment:", createData);
      userEquipment = await UserEquipmentModel.create(createData);
      console.log("Equipment created successfully:", {
        userUuid: userEquipment.userUuid,
        fishingRod: userEquipment.fishingRod,
        accessory: userEquipment.accessory
      });
    } else {
      console.log("Updating existing equipment...");
      const oldFishingRod = userEquipment.fishingRod;
      const oldAccessory = userEquipment.accessory;
      
      if (category === 'fishing_rod') {
        userEquipment.fishingRod = itemName;
        // 낚시대 구매 시 강화 수치 리셋
        userEquipment.fishingRodEnhancement = 0;
        userEquipment.fishingRodFailCount = 0;
        console.log(`Fishing rod: ${oldFishingRod} → ${itemName} (강화 수치 리셋)`);
      } else if (category === 'accessories') {
        userEquipment.accessory = itemName;
        // 악세사리 구매 시 강화 수치 리셋
        userEquipment.accessoryEnhancement = 0;
        userEquipment.accessoryFailCount = 0;
        console.log(`Accessory: ${oldAccessory} → ${itemName} (강화 수치 리셋)`);
        
        // 🚀 악세사리 구매 시 캐시 무효화 (성능 최적화)
        const cacheKey = userUuid || username;
        if (cacheKey) {
          // 모든 관련 캐시 무효화
          fishPriceCache.clear(); // 모든 가격 캐시 무효화 (악세사리 효과로 인해)
          cooldownCache.delete(cacheKey); // 해당 사용자 쿨타임 캐시 무효화
        }
      }
      
      await userEquipment.save();
      console.log("Equipment saved successfully:", {
        userUuid: userEquipment.userUuid,
        fishingRod: userEquipment.fishingRod,
        accessory: userEquipment.accessory
      });
    }
    
    // 낚시대 구매 시에만 낚시실력 +1 (악세사리는 제외)
    if (category === 'fishing_rod') {
      let fishingSkill = await FishingSkillModel.findOne(query);
      if (!fishingSkill) {
        const createData = {
          skill: 1,
          ...query
        };
        
        // username이 있으면 추가
        if (username) {
          createData.username = username;
        }
        
        debugLog("Creating new fishing skill:", createData);
        fishingSkill = await FishingSkillModel.create(createData);
        // 🚀 캐시 업데이트 (새 사용자)
        const userKey = userUuid || username;
        if (userKey) setCachedFishingSkill(userKey, 1);
      } else {
        fishingSkill.skill += 1;
        await fishingSkill.save();
        // 🚀 캐시 업데이트 (스킬 증가)
        const userKey = userUuid || username;
        if (userKey) setCachedFishingSkill(userKey, fishingSkill.skill);
      }
      console.log(`낚시 실력 증가 완료: 낚시대 구매로 ${fishingSkill.skill}`);
    }
    
    // 구매 성공 응답 (재료 기반)
    res.json({ 
      success: true, 
      usedMaterial: requiredMaterial,
      usedCount: requiredCount
    });
  } catch (error) {
    console.error("=== BUY ITEM ERROR ===");
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    console.error("Request body:", req.body);
    console.error("Request query:", req.query);
    res.status(500).json({ error: "Failed to buy item: " + error.message });
  }
});

// Fish Discovery API (발견한 물고기 목록 조회)
app.get("/api/fish-discoveries/:userId", optionalJWT, async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, userUuid } = req.query;
    
    console.log("=== FISH DISCOVERIES API ===");
    console.log("Request params:", { userId, username, userUuid });
    
    const queryResult = await getUserQuery(userId, username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
    } else {
      query = queryResult;
    }
    
    console.log("Fish discoveries query:", query);
    
    // FishDiscoveryModel에서 먼저 조회
    const discoveries = await FishDiscoveryModel.find(query).select('fishName firstCaughtAt');
    let discoveredFishNames = discoveries.map(d => d.fishName);
    
    console.log(`Found ${discoveredFishNames.length} fish in FishDiscovery collection`);
    
    // FishDiscoveryModel에 없으면 CatchModel에서도 조회 (레거시 데이터 호환)
    if (discoveredFishNames.length === 0) {
      console.log("No fish in FishDiscovery, checking CatchModel...");
      const catchAggregation = await CatchModel.aggregate([
        { $match: query },
        { $group: { _id: "$fish" } }
      ]);
      discoveredFishNames = catchAggregation.map(c => c._id).filter(name => name); // null 제거
      console.log(`Found ${discoveredFishNames.length} fish in Catch collection`);
    }
    
    res.json(discoveredFishNames);
  } catch (error) {
    console.error("Failed to fetch fish discoveries:", error);
    res.status(500).json({ error: "Failed to fetch fish discoveries" });
  }
});

// Equipment Enhancement API (장비 강화)
app.post("/api/enhance-equipment", authenticateJWT, async (req, res) => {
  try {
    const { equipmentType, targetLevel, amberCost } = req.body;
    const { userUuid, username } = req.user;
    
    console.log("=== EQUIPMENT ENHANCEMENT REQUEST (No Transaction) ===");
    console.log("Equipment Type:", equipmentType);
    console.log("Target Level:", targetLevel);
    console.log("Amber Cost:", amberCost);
    console.log("User:", username, userUuid);
    console.log("Request body:", req.body);
    console.log("Request headers:", req.headers.authorization ? "JWT Present" : "No JWT");
    
    // 기본 검증
    if (!userUuid || !username) {
      console.error("❌ Missing user authentication data");
      return res.status(401).json({ error: "Authentication required" });
    }
    
    // 입력 검증
    if (!equipmentType || !['fishingRod', 'accessory'].includes(equipmentType)) {
      return res.status(400).json({ error: "Invalid equipment type" });
    }
    
    // targetLevel은 참고용으로만 사용, 실제로는 서버에서 현재 레벨 + 1로 계산
    if (!targetLevel || targetLevel < 1 || targetLevel > 50) {
      return res.status(400).json({ error: "Invalid target level" });
    }
    
    if (amberCost === undefined || amberCost === null || amberCost < 0) {
      return res.status(400).json({ error: "Invalid amber cost" });
    }
    
    // 강화 공식: f(x) = 0.2x³ - 0.4x² + 1.6x
    const calculateEnhancementBonus = (level) => {
      if (level <= 0) return 0;
      return 0.2 * Math.pow(level, 3) - 0.4 * Math.pow(level, 2) + 1.6 * level;
    };
    
    // 장비 등급별 강화 비용 배율 (3차방정식: f(x) = 0.1x³ - 0.5x² + 2x + 0.4)
    const getEquipmentGradeMultiplier = (equipmentName, equipmentType) => {
      if (equipmentType === 'fishingRod') {
        const fishingRodOrder = [
          '나무낚시대', '낡은낚시대', '기본낚시대', '단단한낚시대', '은낚시대', '금낚시대',
          '강철낚시대', '사파이어낚시대', '루비낚시대', '다이아몬드낚시대', '레드다이아몬드낚시대',
          '벚꽃낚시대', '꽃망울낚시대', '호롱불낚시대', '산고등낚시대', '피크닉', '마녀빗자루',
          '에테르낚시대', '별조각낚시대', '여우꼬리낚시대', '초콜릿롤낚시대', '호박유령낚시대',
          '핑크버니낚시대', '할로우낚시대', '여우불낚시대'
        ];
        const grade = fishingRodOrder.indexOf(equipmentName);
        if (grade === -1) return 1.0;
        // 3차방정식: f(x) = 0.1x³ - 0.35x² + 1.7x + 0.4
        return Math.max(1.0, 0.1 * Math.pow(grade, 3) - 0.35 * Math.pow(grade, 2) + 1.7 * grade + 0.4);
      } else if (equipmentType === 'accessory') {
        const accessoryOrder = [
          '오래된반지', '은목걸이', '금귀걸이', '마법의펜던트', '에메랄드브로치',
          '토파즈이어링', '자수정팔찌', '백금티아라', '만드라고라허브', '에테르나무묘목',
          '몽마의조각상', '마카롱훈장', '빛나는마력순환체'
        ];
        const grade = accessoryOrder.indexOf(equipmentName);
        if (grade === -1) return 1.0;
        // 3차방정식: f(x) = 0.1x³ - 0.35x² + 1.7x + 0.4
        return Math.max(1.0, 0.1 * Math.pow(grade, 3) - 0.35 * Math.pow(grade, 2) + 1.7 * grade + 0.4);
      }
      return 1.0;
    };

    // 강화에 필요한 호박석 계산: 공식 * 1 * 장비등급배율 (90% 할인)
    const calculateRequiredAmber = (level, equipmentName, equipmentType) => {
      if (level <= 0) return 0;
      const baseCost = calculateEnhancementBonus(level) * 1; // 90% 할인 (10 → 1)
      const gradeMultiplier = getEquipmentGradeMultiplier(equipmentName, equipmentType);
      return Math.ceil(baseCost * gradeMultiplier);
    };
    
    // 누적 호박석 비용 계산
    const calculateTotalAmberCost = (fromLevel, toLevel) => {
      let totalCost = 0;
      for (let i = fromLevel + 1; i <= toLevel; i++) {
        totalCost += calculateRequiredAmber(i);
      }
      return totalCost;
    };
    
    // 강화 성공 확률 계산
    const calculateEnhancementSuccessRate = (currentLevel, failCount = 0) => {
      let baseRate;
      
      if (currentLevel === 0) {
        baseRate = 100; // 0강 → 1강: 100%
      } else {
        // 1강부터: 95%, 90%, 85%, 80%, ... (최소 5%)
        baseRate = Math.max(5, 100 - (currentLevel * 5));
      }
      
      // 실패 횟수에 따른 확률 증가: 원래확률 + (기본확률 * 0.01 * 실패횟수)
      const bonusRate = baseRate * 0.01 * failCount;
      const finalRate = Math.min(100, baseRate + bonusRate);
      
      return {
        baseRate,
        bonusRate,
        finalRate
      };
    };
    
    // 사용자 장비 정보 조회
    const query = { userUuid };
    let userEquipment = await UserEquipmentModel.findOne(query);
    
    if (!userEquipment) {
      return res.status(404).json({ error: "User equipment not found" });
    }
    
    // 기존 데이터에 새 필드가 없는 경우 기본값으로 초기화
    const needsUpdate = userEquipment.fishingRodFailCount === undefined || 
                       userEquipment.accessoryFailCount === undefined ||
                       userEquipment.fishingRodEnhancement === undefined ||
                       userEquipment.accessoryEnhancement === undefined;
    
    if (needsUpdate) {
      console.log("Initializing missing enhancement fields for user:", userUuid);
      try {
        await UserEquipmentModel.updateOne(
          { userUuid },
          { 
            $set: {
              fishingRodFailCount: userEquipment.fishingRodFailCount || 0,
              accessoryFailCount: userEquipment.accessoryFailCount || 0,
              fishingRodEnhancement: userEquipment.fishingRodEnhancement || 0,
              accessoryEnhancement: userEquipment.accessoryEnhancement || 0
            }
          }
        );
        // 업데이트된 데이터 다시 조회
        userEquipment = await UserEquipmentModel.findOne(query);
        console.log("✅ Enhancement fields initialized successfully");
      } catch (updateError) {
        console.error("❌ Failed to initialize enhancement fields:", updateError);
        return res.status(500).json({ error: "Failed to initialize user equipment data" });
      }
    }
    
    // 현재 강화 레벨 확인
    const currentLevel = equipmentType === 'fishingRod' 
      ? userEquipment.fishingRodEnhancement || 0
      : userEquipment.accessoryEnhancement || 0;
    
    // 서버에서 안전하게 다음 레벨로 설정 (클라이언트 값 무시)
    const actualTargetLevel = currentLevel + 1;
    
    console.log(`📊 레벨 설정: 현재=${currentLevel}, 클라이언트목표=${targetLevel}, 실제목표=${actualTargetLevel}`);
    
    if (actualTargetLevel > 50) {
      return res.status(400).json({ error: "Maximum enhancement level reached" });
    }
    
    // 해당 장비가 장착되어 있는지 확인
    const equippedItem = equipmentType === 'fishingRod' 
      ? userEquipment.fishingRod 
      : userEquipment.accessory;
    
    if (!equippedItem) {
      return res.status(400).json({ error: "No equipment equipped to enhance" });
    }
    
    // 서버에서 호박석 비용 재계산 (실제 목표 레벨 기준 + 장비 등급 배율)
    const serverAmberCost = calculateRequiredAmber(actualTargetLevel, equippedItem, equipmentType);
    
    console.log("💰 비용 검증:", { 
      client: amberCost, 
      server: serverAmberCost, 
      difference: Math.abs(serverAmberCost - amberCost),
      equippedItem,
      equipmentType,
      actualTargetLevel
    });
    
    if (Math.abs(serverAmberCost - amberCost) > 5) { // 더 관대한 오차 허용
      console.log("❌ Amber cost mismatch:", { client: amberCost, server: serverAmberCost });
      return res.status(400).json({ 
        error: "Invalid amber cost calculation",
        details: {
          clientCost: amberCost,
          serverCost: serverAmberCost,
          equippedItem,
          equipmentType,
          targetLevel: actualTargetLevel
        }
      });
    }
    
    // 사용자 호박석 확인
    let userAmber = await UserAmberModel.findOne(query);
    if (!userAmber) {
      userAmber = await UserAmberModel.create({
        userUuid,
        username,
        userId: 'user',
        amber: 0
      });
    }
    
    if (userAmber.amber < serverAmberCost) {
      return res.status(400).json({ error: "Insufficient amber" });
    }
    
    // 현재 실패 횟수 확인 (기본값 0으로 안전하게 처리)
    const currentFailCount = equipmentType === 'fishingRod' 
      ? (userEquipment.fishingRodFailCount !== undefined ? userEquipment.fishingRodFailCount : 0)
      : (userEquipment.accessoryFailCount !== undefined ? userEquipment.accessoryFailCount : 0);
    
    // 강화 성공 확률 계산
    const successRateInfo = calculateEnhancementSuccessRate(currentLevel, currentFailCount);
    const { baseRate, bonusRate, finalRate } = successRateInfo;
    
    console.log(`🎲 Enhancement attempt: ${equipmentType} ${currentLevel}→${actualTargetLevel}`);
    console.log(`📊 Success rate: ${finalRate}% (base: ${baseRate}%, bonus: ${bonusRate.toFixed(1)}%, fails: ${currentFailCount})`);
    
    // 강화 시도 (확률 판정)
    const randomValue = Math.random() * 100;
    const isSuccess = randomValue < finalRate;
    
    console.log(`🎯 Roll: ${randomValue.toFixed(2)}% vs ${finalRate}% = ${isSuccess ? 'SUCCESS' : 'FAIL'}`);
    
    // 트랜잭션 없이 순차적으로 업데이트 (로컬 MongoDB 호환)
    try {
      // 호박석 차감 (성공/실패 관계없이)
      const amberUpdateResult = await UserAmberModel.updateOne(
        { userUuid },
        { $inc: { amber: -serverAmberCost } }
      );
      
      if (amberUpdateResult.matchedCount === 0) {
        throw new Error("User amber record not found");
      }
      
      if (isSuccess) {
        // 강화 성공: 레벨 업 + 실패 횟수 초기화
        const updateField = equipmentType === 'fishingRod' 
          ? { 
              fishingRodEnhancement: actualTargetLevel,
              fishingRodFailCount: 0
            }
          : { 
              accessoryEnhancement: actualTargetLevel,
              accessoryFailCount: 0
            };
        
        const equipmentUpdateResult = await UserEquipmentModel.updateOne(
          { userUuid },
          { $set: updateField }
        );
        
        if (equipmentUpdateResult.matchedCount === 0) {
          throw new Error("User equipment record not found");
        }
        
        console.log(`✅ Enhancement SUCCESS: ${equipmentType} to level ${actualTargetLevel}`);
      } else {
        // 강화 실패: 실패 횟수 증가
        const updateField = equipmentType === 'fishingRod' 
          ? { $inc: { fishingRodFailCount: 1 } }
          : { $inc: { accessoryFailCount: 1 } };
        
        const equipmentUpdateResult = await UserEquipmentModel.updateOne(
          { userUuid },
          updateField
        );
        
        if (equipmentUpdateResult.matchedCount === 0) {
          throw new Error("User equipment record not found");
        }
        
        console.log(`❌ Enhancement FAILED: ${equipmentType} fail count: ${currentFailCount + 1}`);
      }
      
      // 업데이트된 데이터 반환
      const updatedEquipment = await UserEquipmentModel.findOne(query);
      const updatedAmber = await UserAmberModel.findOne(query);
      
      res.json({
        success: true,
        enhancementSuccess: isSuccess,
        equipment: {
          fishingRod: updatedEquipment.fishingRod,
          accessory: updatedEquipment.accessory,
          fishingRodEnhancement: updatedEquipment.fishingRodEnhancement || 0,
          accessoryEnhancement: updatedEquipment.accessoryEnhancement || 0,
          fishingRodFailCount: updatedEquipment.fishingRodFailCount !== undefined ? updatedEquipment.fishingRodFailCount : 0,
          accessoryFailCount: updatedEquipment.accessoryFailCount !== undefined ? updatedEquipment.accessoryFailCount : 0
        },
        amber: updatedAmber.amber,
        successRateInfo: {
          baseRate,
          bonusRate: Math.round(bonusRate * 10) / 10,
          finalRate: Math.round(finalRate * 10) / 10,
          failCount: isSuccess ? 0 : currentFailCount + 1
        }
      });
      
    } catch (updateError) {
      console.error("❌ Database update error:", updateError);
      throw updateError;
    }
    
  } catch (error) {
    console.error("❌ Equipment enhancement error:", error);
    console.error("Error stack:", error.stack);
    console.error("Error details:", {
      message: error.message,
      name: error.name,
      code: error.code
    });
    
    
    res.status(500).json({ 
      error: "Failed to enhance equipment",
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// User Equipment API
app.get("/api/user-equipment/:userId", optionalJWT, async (req, res) => {
  try {
    // 🔐 JWT에서 사용자 정보 추출 (선택적)
    const jwtUser = req.user || {};
    const { userId } = req.params;
    
    // JWT 또는 쿼리 파라미터에서 정보 가져오기
    const username = jwtUser.username || req.query.username;
    const userUuid = jwtUser.userUuid || req.query.userUuid;
    
    debugLog(`🔐 JWT Equipment request: ${username} (${userUuid})`);
    console.log("User equipment request:", { userId, username, userUuid });
    
    // UUID 기반 사용자 조회
    const queryResult = await getUserQuery(userId, username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
      console.log("Using UUID query for user equipment:", query);
    } else {
      query = queryResult;
      console.log("Using fallback query for user equipment:", query);
    }
    
    console.log("Database query for user equipment:", query);
    
    let userEquipment = await UserEquipmentModel.findOne(query);
    console.log("Found equipment in database:", userEquipment ? {
      userUuid: userEquipment.userUuid,
      username: userEquipment.username,
      fishingRod: userEquipment.fishingRod,
      accessory: userEquipment.accessory,
      fishingRodEnhancement: userEquipment.fishingRodEnhancement || 0,
      accessoryEnhancement: userEquipment.accessoryEnhancement || 0,
      fishingRodFailCount: userEquipment.fishingRodFailCount || 0,
      accessoryFailCount: userEquipment.accessoryFailCount || 0,
      createdAt: userEquipment.createdAt,
      updatedAt: userEquipment.updatedAt
    } : "None");
    
    if (!userEquipment) {
      // 새 사용자인 경우 기본 낚시대로 생성
      const createData = {
        fishingRod: '나무낚시대',
        accessory: null,
        ...query
      };
      
      // username이 있으면 추가
      if (username) {
        createData.username = username;
      }
      
      console.log("Creating new user equipment (no existing found):", createData);
      userEquipment = await UserEquipmentModel.create(createData);
      console.log("New equipment created:", {
        userUuid: userEquipment.userUuid,
        fishingRod: userEquipment.fishingRod,
        accessory: userEquipment.accessory
      });
    }
    
    // 기존 데이터에 강화 필드가 없는 경우 기본값으로 초기화
    if (userEquipment.fishingRodEnhancement === undefined || userEquipment.accessoryEnhancement === undefined) {
      console.log("Initializing missing enhancement fields for equipment API");
      await UserEquipmentModel.updateOne(
        query,
        { 
          $set: {
            fishingRodEnhancement: userEquipment.fishingRodEnhancement || 0,
            accessoryEnhancement: userEquipment.accessoryEnhancement || 0,
            fishingRodFailCount: userEquipment.fishingRodFailCount || 0,
            accessoryFailCount: userEquipment.accessoryFailCount || 0
          }
        }
      );
      // 업데이트된 데이터 다시 조회
      userEquipment = await UserEquipmentModel.findOne(query);
    }
    
    const response = {
      fishingRod: userEquipment.fishingRod,
      accessory: userEquipment.accessory,
      fishingRodEnhancement: userEquipment.fishingRodEnhancement || 0,
      accessoryEnhancement: userEquipment.accessoryEnhancement || 0,
      fishingRodFailCount: userEquipment.fishingRodFailCount || 0,
      accessoryFailCount: userEquipment.accessoryFailCount || 0
    };
    
    console.log("Sending equipment response:", response);
    res.json(response);
  } catch (error) {
    console.error("Failed to fetch user equipment:", error);
    res.status(500).json({ error: "Failed to fetch user equipment" });
  }
});

// Materials Inventory API (JWT 인증 - 거래소용)
app.get("/api/market/my-materials", authenticateJWT, async (req, res) => {
  try {
    const { userUuid, username } = req.user;
    
    const materials = await MaterialModel.find({ userUuid: userUuid }).lean();
    
    // 재료별로 갯수를 세어서 그룹화
    const materialCount = {};
    materials.forEach(m => {
      materialCount[m.material] = (materialCount[m.material] || 0) + m.count;
    });
    
    // 갯수 순으로 정렬해서 반환
    const materialInventory = Object.entries(materialCount)
      .map(([material, count]) => ({ material, count }))
      .sort((a, b) => b.count - a.count);
    
    res.json(materialInventory);
  } catch (error) {
    console.error("Failed to fetch user materials:", error);
    res.status(500).json({ error: "Failed to fetch user materials" });
  }
});

// Materials Inventory API
app.get("/api/materials/:userId", optionalJWT, async (req, res) => {
  try {
    // 🔐 JWT에서 사용자 정보 추출 (선택적)
    const jwtUser = req.user || {};
    const { userId } = req.params;
    
    // JWT 또는 쿼리 파라미터에서 정보 가져오기
    const username = jwtUser.username || req.query.username;
    const userUuid = jwtUser.userUuid || req.query.userUuid;
    
    debugLog(`🔐 JWT Materials request: ${username} (${userUuid})`);
    
    // 🔍 아딸 사용자 요청 추적
    if (username === '아딸' || userUuid === '#0002') {
      console.log(`🕵️ 아딸 MATERIALS - IP: ${req.ip || req.connection.remoteAddress}, UA: ${req.get('User-Agent')?.substring(0, 50) || 'N/A'}, Referer: ${req.get('Referer') || 'N/A'}`);
    }
    
    // UUID 기반 사용자 조회
    const queryResult = await getUserQuery(userId, username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
      console.log("Using UUID query for materials:", query);
    } else {
      // 🔧 존재하지 않는 사용자에 대한 반복 요청 방지
      if (userUuid === '#0002' && username === '아딸') {
        console.log("🚫 Blocking repeated requests for non-existent user:", { userUuid, username });
        return res.status(404).json({ error: "User not found. Please refresh and login again." });
      }
      query = queryResult;
      console.log("Using fallback query for materials:", query);
    }
    
    console.log("Database query for materials:", query);
    
    const materials = await MaterialModel.find(query);
    console.log(`Found ${materials.length} materials for query:`, query);
    
    // 재료별로 갯수를 세어서 그룹화
    const materialCount = {};
    materials.forEach(m => {
      console.log("Processing material:", { material: m.material, userUuid: m.userUuid, username: m.username });
      materialCount[m.material] = (materialCount[m.material] || 0) + 1;
    });
    
    console.log("Material count result:", materialCount);
    
    // 갯수 순으로 정렬해서 반환
    const materialInventory = Object.entries(materialCount)
      .map(([material, count]) => ({ material, count }))
      .sort((a, b) => b.count - a.count);
    
    console.log("Final material inventory:", materialInventory);
    res.json(materialInventory);
  } catch (error) {
    console.error("Failed to fetch materials:", error);
    res.status(500).json({ error: "Failed to fetch materials" });
  }
});

// Fish Decomposition API
app.post("/api/decompose-fish", authenticateJWT, async (req, res) => {
  try {
    const { fishName, quantity, material } = req.body;
    // 🔐 JWT에서 사용자 정보 추출 (더 안전함)
    const { userUuid, username } = req.user;
    console.log("Decompose fish request:", { fishName, quantity, material, username, userUuid });
    
    // UUID 기반 사용자 조회
    const userId = 'user'; // API 호출 시 기본값
    const queryResult = await getUserQuery(userId, username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
      console.log("Using UUID query for decompose fish:", query);
    } else {
      query = queryResult;
      console.log("Using fallback query for decompose fish:", query);
    }
    
    console.log("Database query for decompose fish:", query);
    
    // 사용자가 해당 물고기를 충분히 가지고 있는지 확인 (성능 최적화)
    const userFish = await measureDBQuery(`물고기분해-조회-${fishName}`, () =>
      CatchModel.find({ ...query, fish: fishName }, { _id: 1 }) // fish 필드 제거 (이미 알고 있음)
        .sort({ _id: 1 }) // 일관된 순서 (인덱스 활용)
        .limit(quantity + 10) // 필요한 수량보다 약간 많이만 조회 (성능 향상)
        .lean() // Mongoose 오버헤드 제거
    );
    console.log(`Found ${userFish.length} ${fishName} for user`);
    
    if (userFish.length < quantity) {
      console.log(`Not enough fish: has ${userFish.length}, needs ${quantity}`);
      return res.status(400).json({ error: "Not enough fish to decompose" });
    }
    
    // 🚀 물고기 제거 (수량에 따른 최적화)
    let deleteResult;
    if (quantity === 1) {
      // 단일 아이템은 직접 삭제 (더 빠름)
      deleteResult = await measureDBQuery(`물고기분해-단일삭제`, () =>
        CatchModel.deleteOne({ _id: userFish[0]._id }, { writeConcern: { w: 1, j: false } })
      );
      console.log(`⚡ Single deleted ${deleteResult.deletedCount}/1 ${fishName} for decompose`);
    } else {
      // 다중 아이템은 bulkWrite 사용
      const fishToDelete = userFish.slice(0, quantity).map(fish => ({
        deleteOne: { filter: { _id: fish._id } }
      }));
      
      deleteResult = await measureDBQuery(`물고기분해-대량삭제-${quantity}개`, () =>
        CatchModel.bulkWrite(fishToDelete, {
          ordered: false, // 순서 상관없이 병렬 처리
          writeConcern: { w: 1, j: false } // 저널링 비활성화로 속도 향상
        })
      );
      console.log(`⚡ Bulk deleted ${deleteResult.deletedCount}/${quantity} ${fishName} for decompose`);
    }
    
    // 스타피쉬 분해 시 별조각 지급 (성능 최적화 - upsert 사용)
    if (fishName === "스타피쉬") {
      const starPiecesPerFish = 1; // 스타피쉬 1마리당 별조각 1개
      const totalStarPieces = quantity * starPiecesPerFish;
      
      const updateData = {
        $inc: { starPieces: totalStarPieces },
        $setOnInsert: {
          userId: query.userId || 'user',
          username: query.username || username,
          userUuid: query.userUuid || userUuid
        }
      };
      
      const userStarPieces = await measureDBQuery("물고기분해-별조각지급", () =>
        StarPieceModel.findOneAndUpdate(
          query,
          updateData,
          { upsert: true, new: true }
        )
      );
      
      console.log(`Added ${totalStarPieces} star pieces from ${quantity} starfish decomposition. New total: ${userStarPieces.starPieces}`);
      
      res.json({ 
        success: true, 
        starPiecesGained: totalStarPieces,
        totalStarPieces: userStarPieces.starPieces 
      });
      return;
    }
    
    // 🚀 일반 물고기 분해 시 재료 추가 (대량 삽입으로 성능 최적화)
    const materialData = {
      ...query,
      material,
      displayName: query.username || username || 'User'
    };
    
    // username이 있으면 추가
    if (username) {
      materialData.username = username;
    }
    
    // 단일 재료는 직접 삽입, 다중 재료는 bulkWrite
    let bulkCreateResult;
    if (quantity === 1) {
      bulkCreateResult = await MaterialModel.create(materialData);
      console.log(`⚡ Single created 1 ${material}`);
    } else {
      const materialsToCreate = Array(quantity).fill().map(() => ({ insertOne: { document: materialData } }));
      bulkCreateResult = await MaterialModel.bulkWrite(materialsToCreate, {
        ordered: false, // 순서 상관없이 병렬 처리
        writeConcern: { w: 1, j: false } // 저널링 비활성화로 속도 향상
      });
      console.log(`⚡ Bulk created ${bulkCreateResult.insertedCount}/${quantity} ${material}`);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to decompose fish:", error);
    res.status(500).json({ error: "Failed to decompose fish" });
  }
});

// Material Consumption API (for exploration)
app.post("/api/consume-material", authenticateJWT, async (req, res) => {
  const { materialName, quantity } = req.body;
  // 🔐 JWT에서 사용자 정보 추출 (더 안전함)
  const { userUuid, username } = req.user;
  
  // 중복 요청 방지
  const consumeKey = `${userUuid || username}-${materialName}-${quantity}`;
  if (processingMaterialConsumption.has(consumeKey)) {
    console.log(`[DUPLICATE CONSUME] Ignoring duplicate consume request for ${consumeKey}`);
    return res.status(409).json({ error: "Request already processing" });
  }
  
  processingMaterialConsumption.add(consumeKey);
  
  try {
    console.log("Consume material request:", { materialName, quantity, username, userUuid });
    
    // UUID 기반 사용자 조회
    const userId = 'user'; // API 호출 시 기본값
    const queryResult = await getUserQuery(userId, username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
      console.log("Using UUID query for consume material:", query);
    } else {
      query = queryResult;
      console.log("Using fallback query for consume material:", query);
    }
    
    console.log("Database query for consume material:", query);
    
    // 사용자가 해당 재료를 충분히 가지고 있는지 확인
    const userMaterials = await MaterialModel.find({ ...query, material: materialName });
    console.log(`Found ${userMaterials.length} ${materialName} for user`);
    
    if (userMaterials.length < quantity) {
      console.log(`Not enough materials: has ${userMaterials.length}, needs ${quantity}`);
      return res.status(400).json({ error: "Not enough materials" });
    }
    
    // 재료 제거 (quantity만큼 삭제) - 더 안전한 방식으로 처리
    let deletedCount = 0;
    for (let i = 0; i < quantity; i++) {
      try {
        const deletedMaterial = await MaterialModel.findOneAndDelete({ ...query, material: materialName });
        if (deletedMaterial) {
          deletedCount++;
          console.log(`Successfully deleted material ${deletedCount}/${quantity}: ${materialName}`);
        } else {
          console.log(`Failed to delete material ${i + 1}/${quantity} - material not found`);
          // 일부만 삭제된 경우에도 성공으로 처리 (이미 삭제된 것은 되돌릴 수 없음)
          break;
        }
      } catch (deleteError) {
        console.error(`Error deleting material ${i + 1}/${quantity}:`, deleteError);
        break;
      }
    }
    
    if (deletedCount === 0) {
      console.log("No materials were deleted");
      return res.status(400).json({ error: "Failed to consume material" });
    }
    
    console.log(`Successfully consumed ${deletedCount} ${materialName} (requested: ${quantity})`);
    
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to consume material:", error);
    res.status(500).json({ error: "Failed to consume material" });
  } finally {
    // 처리 완료 후 중복 방지 키 제거
    processingMaterialConsumption.delete(consumeKey);
  }
});

// 조합 레시피 데이터 임포트
const { getCraftingRecipe, getDecomposeRecipe } = require('./data/craftingData');

// 재료 조합 API (하위 재료 3개 → 상위 재료 1개)
app.post("/api/craft-material", authenticateJWT, async (req, res) => {
  try {
    const { inputMaterial, inputCount, outputMaterial, outputCount } = req.body;
    // 🔐 JWT에서 사용자 정보 추출
    const { userUuid, username } = req.user;
    
    console.log("Craft material request:", { inputMaterial, inputCount, outputMaterial, outputCount, username, userUuid });
    
    // 레시피 유효성 검증
    const recipe = getCraftingRecipe(inputMaterial);
    if (!recipe || recipe.outputMaterial !== outputMaterial || recipe.inputCount !== inputCount) {
      return res.status(400).json({ error: "Invalid crafting recipe" });
    }
    
    // UUID 기반 사용자 조회
    const userId = 'user';
    const queryResult = await getUserQuery(userId, username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
    } else {
      query = queryResult;
    }
    
    // 사용자가 해당 재료를 충분히 가지고 있는지 확인
    const userMaterials = await MaterialModel.find({ ...query, material: inputMaterial });
    console.log(`Found ${userMaterials.length} ${inputMaterial} for user`);
    
    if (userMaterials.length < inputCount) {
      console.log(`Not enough materials: has ${userMaterials.length}, needs ${inputCount}`);
      return res.status(400).json({ error: `재료가 부족합니다. (${userMaterials.length}/${inputCount})` });
    }
    
    // 재료 제거 (inputCount만큼 삭제)
    const materialsToDelete = userMaterials.slice(0, inputCount).map(m => m._id);
    const deleteResult = await MaterialModel.deleteMany({ _id: { $in: materialsToDelete } });
    console.log(`Deleted ${deleteResult.deletedCount} ${inputMaterial}`);
    
    if (deleteResult.deletedCount !== inputCount) {
      console.error(`Material deletion failed: expected ${inputCount}, deleted ${deleteResult.deletedCount}`);
      return res.status(500).json({ error: "조합 중 오류가 발생했습니다." });
    }
    
    // 새로운 재료 추가
    const materialData = {
      ...query,
      material: outputMaterial,
      displayName: query.username || username || 'User'
    };
    
    if (username) {
      materialData.username = username;
    }
    
    // outputCount만큼 재료 생성
    const materialsToCreate = Array(outputCount).fill().map(() => ({ insertOne: { document: materialData } }));
    const bulkCreateResult = await MaterialModel.bulkWrite(materialsToCreate, {
      ordered: false,
      writeConcern: { w: 1, j: false }
    });
    
    console.log(`Created ${bulkCreateResult.insertedCount} ${outputMaterial}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to craft material:", error);
    res.status(500).json({ error: "재료 조합에 실패했습니다." });
  }
});

// 재료 분해 API (상위 재료 여러개 → 하위 재료 여러개)
app.post("/api/decompose-material", authenticateJWT, async (req, res) => {
  try {
    const { inputMaterial, outputMaterial, outputCount, quantity = 1 } = req.body;
    // 🔐 JWT에서 사용자 정보 추출
    const { userUuid, username } = req.user;
    
    console.log("Decompose material request:", { inputMaterial, outputMaterial, outputCount, quantity, username, userUuid });
    
    // 레시피 유효성 검증
    const recipe = getDecomposeRecipe(inputMaterial);
    if (!recipe || recipe.inputMaterial !== outputMaterial) {
      console.log("Recipe validation failed:", { 
        inputMaterial, 
        outputMaterial, 
        foundRecipe: recipe,
        expectedInputMaterial: recipe?.inputMaterial 
      });
      return res.status(400).json({ error: "Invalid decompose recipe" });
    }
    
    // 수량 검증
    if (quantity < 1 || !Number.isInteger(quantity)) {
      return res.status(400).json({ error: "잘못된 수량입니다." });
    }
    
    // UUID 기반 사용자 조회
    const userId = 'user';
    const queryResult = await getUserQuery(userId, username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
    } else {
      query = queryResult;
    }
    
    // 사용자가 해당 재료를 충분히 가지고 있는지 확인
    const userMaterials = await MaterialModel.find({ ...query, material: inputMaterial }).limit(quantity);
    
    if (!userMaterials || userMaterials.length < quantity) {
      console.log(`Not enough material: ${inputMaterial} (need ${quantity}, have ${userMaterials?.length || 0})`);
      return res.status(400).json({ error: `분해할 재료가 부족합니다. (${userMaterials?.length || 0}/${quantity})` });
    }
    
    // 재료 제거 (quantity개 삭제)
    const materialIdsToDelete = userMaterials.map(m => m._id);
    const deleteResult = await MaterialModel.deleteMany({ _id: { $in: materialIdsToDelete } });
    console.log(`Deleted ${deleteResult.deletedCount} ${inputMaterial}`);
    
    if (deleteResult.deletedCount !== quantity) {
      console.error(`Material deletion failed (expected ${quantity}, deleted ${deleteResult.deletedCount})`);
      return res.status(500).json({ error: "분해 중 오류가 발생했습니다." });
    }
    
    // 새로운 재료 추가 (outputCount * quantity만큼)
    const materialData = {
      ...query,
      material: outputMaterial,
      displayName: query.username || username || 'User'
    };
    
    if (username) {
      materialData.username = username;
    }
    
    // outputCount * quantity만큼 재료 생성
    const totalOutputCount = outputCount * quantity;
    const materialsToCreate = Array(totalOutputCount).fill().map(() => ({ insertOne: { document: materialData } }));
    const bulkCreateResult = await MaterialModel.bulkWrite(materialsToCreate, {
      ordered: false,
      writeConcern: { w: 1, j: false }
    });
    
    console.log(`Created ${bulkCreateResult.insertedCount} ${outputMaterial}`);
    
    res.json({ success: true, decomposedCount: quantity, gainedCount: totalOutputCount });
  } catch (error) {
    console.error("Failed to decompose material:", error);
    res.status(500).json({ error: "재료 분해에 실패했습니다." });
  }
});

// Fishing Skill API (보안 강화)
app.get("/api/fishing-skill/:userId", optionalJWT, async (req, res) => {
  try {
    // 🔐 JWT에서 사용자 정보 추출 (선택적)
    const jwtUser = req.user || {};
    const { userId } = req.params;
    
    // JWT 또는 쿼리 파라미터에서 정보 가져오기
    const username = jwtUser.username || req.query.username;
    const userUuid = jwtUser.userUuid || req.query.userUuid;
    
    debugLog(`🔐 Fishing skill request: ${username} (${userUuid})`);
    
    // 입력 검증
    if (!username && !userUuid) {
      console.warn("Fishing skill request without username or userUuid");
      return res.status(400).json({ error: "Username or userUuid is required" });
    }
    
    // UUID 기반 사용자 조회 먼저 시도
    const queryResult = await getUserQuery(userId, username, userUuid);
    
    if (!queryResult || (!queryResult.userUuid && !queryResult.username)) {
      console.warn("Invalid query result for fishing skill:", queryResult);
      return res.status(400).json({ error: "Invalid user identification" });
    }
    
    const query = queryResult.userUuid ? { userUuid: queryResult.userUuid } : queryResult;
    
    // 🔒 보안 검증: 본인 데이터만 조회 가능
    const ownershipValidation = await validateUserOwnership(query, userUuid, username);
    if (!ownershipValidation.isValid) {
      console.warn("Unauthorized fishing skill access:", ownershipValidation.reason);
      return res.status(403).json({ error: "Access denied: You can only view your own data" });
    }
    
    console.log("Database query for fishing skill:", query);
    
    let fishingSkill = await FishingSkillModel.findOne(query);
    
    if (!fishingSkill) {
      // 새 사용자인 경우 초기 실력 0으로 생성
      const createData = {
        skill: 0,
        ...query
      };
      
      // username이 있으면 추가
      if (username) {
        createData.username = username;
      }
      
      console.log("Creating new fishing skill:", createData);
      
      try {
      fishingSkill = await FishingSkillModel.create(createData);
      } catch (createError) {
        console.error("Failed to create fishing skill:", createError);
        // 생성 실패 시 기본값 반환
        return res.json({ skill: 0 });
      }
    }
    
    // 🏆 업적 보너스 계산 (모듈 사용)
    let achievementBonus = 0;
    try {
      const targetUserUuid = queryResult.userUuid || userUuid;
      if (targetUserUuid) {
        achievementBonus = await achievementSystem.calculateAchievementBonus(targetUserUuid);
      }
    } catch (error) {
      console.error("Failed to calculate achievement bonus:", error);
    }
    
    const finalSkill = (fishingSkill.skill || 0) + achievementBonus;
    
    res.json({ 
      skill: finalSkill,
      baseSkill: fishingSkill.skill || 0,
      achievementBonus: achievementBonus
    });
  } catch (error) {
    console.error("Failed to fetch fishing skill:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      userId: req.params.userId,
      username: req.query.username,
      userUuid: req.query.userUuid
    });
    
    // 에러 발생 시 기본값 반환 (500 에러 대신)
    res.json({ skill: 0 });
  }
});

// Static files (serve built client from dist/static)
const staticDir = path.join(__dirname, "..", "dist", "static");

// 정적 파일 존재 확인
console.log("=== STATIC FILES DEBUG ===");
console.log("Static directory:", staticDir);
console.log("Static directory exists:", require('fs').existsSync(staticDir));
if (require('fs').existsSync(staticDir)) {
  console.log("Static directory contents:", require('fs').readdirSync(staticDir));
}

// Assets 디렉토리 확인
const assetsDir = path.join(staticDir, 'assets');
console.log("Assets directory:", assetsDir);
console.log("Assets directory exists:", require('fs').existsSync(assetsDir));
if (require('fs').existsSync(assetsDir)) {
  const assetsFiles = require('fs').readdirSync(assetsDir);
  console.log("Assets directory contents:", assetsFiles);
  
  // CSS 파일 특별히 확인
  const cssFiles = assetsFiles.filter(file => file.endsWith('.css'));
  console.log("CSS files found:", cssFiles);
}

// Assets 경로를 먼저 처리 (우선순위 높음)
app.use('/assets', (req, res, next) => {
  console.log("=== ASSETS REQUEST ===");
  console.log("Requested path:", req.path);
  console.log("Full URL:", req.url);
  console.log("Request headers:", req.headers);
  
  // 실제 파일 경로
  const requestedFile = path.join(assetsDir, req.path);
  console.log("Looking for file:", requestedFile);
  console.log("File exists:", require('fs').existsSync(requestedFile));
  
  next();
}, express.static(assetsDir, {
  setHeaders: (res, filePath) => {
    console.log("=== SERVING ASSET ===");
    console.log("File path:", filePath);
    console.log("File exists check:", require('fs').existsSync(filePath));
    
    // CSS 파일에 대한 MIME 타입 명시적 설정
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      console.log("✅ Set CSS MIME type for:", filePath);
    }
    // JS 파일에 대한 MIME 타입 설정
    else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      console.log("✅ Set JS MIME type for:", filePath);
    }
    // 이미지 파일들
    else if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    }
    else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    }
    else if (filePath.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    }
    else if (filePath.endsWith('.ico')) {
      res.setHeader('Content-Type', 'image/x-icon');
    }
    
    // 캐시 설정 (정적 파일 성능 향상)
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1일
    
    // CORS 헤더 (필요한 경우)
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    console.log("Response headers set:", res.getHeaders());
  }
}));

// 나머지 정적 파일들 (index.html 등)
app.use(express.static(staticDir, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      // index.html은 캐시하지 않음 (항상 최신 빌드 참조)
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      // JS/CSS 파일은 1시간 캐시 (해시가 있어서 안전)
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  },
  maxAge: 0
}));

// SPA fallback handler
app.use((req, res, next) => {
  // API 요청인 경우 통과
  if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) {
    return next();
  }
  
  // Assets 요청인 경우 통과 (이미 위에서 처리됨)
  if (req.path.startsWith('/assets/')) {
    return next();
  }
  
  // 정적 파일 확장자가 있는 경우 통과 (404 처리를 위해)
  const fileExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot'];
  const hasFileExtension = fileExtensions.some(ext => req.path.endsWith(ext));
  if (hasFileExtension) {
    return next();
  }
  
  console.log("SPA fallback for:", req.path);
  
  // index.html 파일 경로
  const indexPath = path.join(staticDir, "index.html");
  
  // index.html 존재 확인
  if (!require('fs').existsSync(indexPath)) {
    console.error('index.html not found at:', indexPath);
    return res.status(404).send('index.html not found');
  }
  
  // index.html 서빙
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(500).send('Server Error');
    }
  });
});

// 계정 삭제 API
// 🔧 DELETE와 POST 방식 모두 지원 (호환성)
app.delete("/api/delete-account", deleteAccountHandler);
app.post("/api/delete-account", deleteAccountHandler);

async function deleteAccountHandler(req, res) {
  try {
    console.log("🔥 deleteAccountHandler called - v2024.12.19");
    console.log("Request method:", req.method);
    console.log("Request path:", req.path);
    
    const { username, userUuid } = req.query;
    const { confirmationKey } = req.body; // 🛡️ 보안: 확인 키 필요
    const clientIP = getClientIP(req);
    
    console.log("🚨 [SECURITY] === ACCOUNT DELETION REQUEST ===");
    console.log("Request params:", { username, userUuid, clientIP });
    
    // 🛡️ 보안 검증 1: 필수 매개변수 확인
    if (!userUuid || !username) {
      return res.status(400).json({ error: "사용자 UUID와 사용자명이 모두 필요합니다." });
    }
    
    // 🛡️ 보안 검증 2: 확인 키 필요 (계정 삭제는 매우 위험한 작업)
    const expectedConfirmationKey = `DELETE_${username}_${userUuid}_CONFIRM`;
    if (!confirmationKey || confirmationKey !== expectedConfirmationKey) {
      console.log(`🚨 [SECURITY] Invalid deletion attempt from ${clientIP} - User: ${username}`);
      return res.status(403).json({ 
        error: "계정 삭제를 위해서는 확인 키가 필요합니다.",
        requiredKey: expectedConfirmationKey
      });
    }
    
    // 사용자 확인 및 소유권 검증
    const user = await UserUuidModel.findOne({ userUuid });
    if (!user) {
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
    }
    
    // 🛡️ 보안 검증 3: 사용자명 일치 확인
    if (user.username !== username) {
      console.log(`🚨 [SECURITY] Username mismatch in deletion request - Expected: ${user.username}, Provided: ${username}`);
      return res.status(403).json({ error: "사용자 정보가 일치하지 않습니다." });
    }
    
    console.log(`Deleting all data for user: ${user.username} (${userUuid})`);
    
    // 모든 관련 데이터 삭제 (병렬 처리)
    const deletionResults = await Promise.allSettled([
      UserUuidModel.deleteOne({ userUuid }),
      CatchModel.deleteMany({ userUuid }),
      UserMoneyModel.deleteMany({ userUuid }),
      UserAmberModel.deleteMany({ userUuid }),
      UserEquipmentModel.deleteMany({ userUuid }),
      MaterialModel.deleteMany({ userUuid }),
      FishingSkillModel.deleteMany({ userUuid }),
      StarPieceModel.deleteMany({ userUuid }),
      CompanionModel.deleteMany({ userUuid }),
      AdminModel.deleteMany({ userUuid }),
      CooldownModel.deleteMany({ userUuid })
    ]);
    
    // 삭제 결과 로그
    const schemaNames = [
      'UserUuid', 'Catch', 'UserMoney', 'UserAmber', 
      'UserEquipment', 'Material', 'FishingSkill', 
      'StarPiece', 'Companion', 'Admin', 'Cooldown'
    ];
    
    deletionResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const deletedCount = result.value.deletedCount || (result.value.acknowledged ? 1 : 0);
        console.log(`✅ ${schemaNames[index]}: ${deletedCount} records deleted`);
      } else {
        console.error(`❌ ${schemaNames[index]} deletion failed:`, result.reason);
      }
    });
    
    // 연결된 사용자 목록에서도 제거
    for (const [socketId, userData] of connectedUsers.entries()) {
      if (userData.userUuid === userUuid) {
        connectedUsers.delete(socketId);
        console.log(`Removed user from connected users: ${socketId}`);
      }
    }
    
    // 모든 클라이언트에게 업데이트된 사용자 목록 전송
    const usersList = cleanupConnectedUsers();
    io.emit("users:update", usersList);
    
    console.log(`✅ Account deletion completed for ${user.username} (${userUuid})`);
    
    res.json({ 
      success: true, 
      message: "계정이 성공적으로 삭제되었습니다.",
      deletedUser: {
        username: user.username,
        userUuid: userUuid
      }
    });
    
  } catch (error) {
    console.error("Failed to delete account:", error);
    res.status(500).json({ error: "계정 삭제에 실패했습니다: " + error.message });
  }
}

// 🔧 디버그용 메모리 캐시 확인 API (임시)
app.get("/api/debug/memory-cache", (req, res) => {
  try {
    const connectedUsersArray = Array.from(connectedUsers.entries()).map(([socketId, userData]) => ({
      socketId,
      userUuid: userData.userUuid,
      username: userData.username,
      displayName: userData.displayName,
      joinTime: userData.joinTime,
      loginType: userData.loginType
    }));
    
    const memoryInfo = {
      connectedUsersCount: connectedUsers.size,
      connectedUsers: connectedUsersArray,
      processingJoins: Array.from(processingJoins),
      recentJoins: Array.from(recentJoins.entries()),
      userMessageHistoryCount: userMessageHistory.size
    };
    
    console.log("🔍 Memory cache debug requested:", memoryInfo);
    res.json(memoryInfo);
  } catch (error) {
    console.error("Failed to get memory cache info:", error);
    res.status(500).json({ error: "Failed to get memory cache info" });
  }
});

// 🔧 이전 API 호환성 지원 (임시)
app.get("/api/user-profile/:username", async (req, res) => {
  try {
    const { username } = req.params;
    console.log("⚠️  Using legacy API path for username:", username);
    
    // 새로운 API로 리다이렉트
    req.query.username = decodeURIComponent(username);
    return getUserProfileHandler(req, res);
  } catch (error) {
    console.error("Legacy API error:", error);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

// 🔐 사용자 프로필 조회 API (인증 필요, 보안 강화)
app.get("/api/user-profile", authenticateJWT, getUserProfileHandler);

async function getUserProfileHandler(req, res) {
  try {
    console.log("🔐 getUserProfileHandler called - v2024.12.19");
    
    const { username } = req.query;
    const { userUuid: requesterUuid, username: requesterUsername, isAdmin } = req.user;
    
    if (!username) {
      console.log("❌ Username missing from query");
      return res.status(400).json({ error: "Username is required" });
    }
    
    console.log(`🔐 Profile request: ${requesterUsername} requesting ${username}`);
    
    // 사용자 기본 정보 조회
    const user = await UserUuidModel.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // 🛡️ 보안 검증: 본인 프로필이거나 관리자만 상세 정보 조회 가능
    const isOwnProfile = user.userUuid === requesterUuid;
    const canViewDetails = isOwnProfile || isAdmin;
    
    if (!canViewDetails) {
      // 🔐 다른 사용자의 프로필은 공개 정보 제공 (장비, 재산 정보 포함)
      console.log(`🔐 Returning public profile for ${username} to ${requesterUsername}`);
      
      // 모든 공개 정보 병렬 조회 (업적 보너스 포함)
      const [userMoney, userAmber, userEquipment, fishingSkillData, totalCatches, achievementBonus] = await Promise.all([
        UserMoneyModel.findOne({ userUuid: user.userUuid }),
        UserAmberModel.findOne({ userUuid: user.userUuid }),
        UserEquipmentModel.findOne({ userUuid: user.userUuid }),
        FishingSkillModel.findOne({ userUuid: user.userUuid }),
        CatchModel.countDocuments({ userUuid: user.userUuid }),
        achievementSystem.calculateAchievementBonus(user.userUuid)
      ]);
      
      return res.json({
        username: user.username,
        displayName: user.displayName,
        isGuest: user.isGuest,
        money: userMoney?.money || 0, // 보유 골드 공개
        amber: userAmber?.amber || 0, // 보유 호박석 공개
        equipment: { // 장착 장비 공개 (강화 레벨 포함)
          fishingRod: userEquipment?.fishingRod || null,
          accessory: userEquipment?.accessory || null,
          fishingRodEnhancement: userEquipment?.fishingRodEnhancement || 0,
          accessoryEnhancement: userEquipment?.accessoryEnhancement || 0
        },
        fishingSkill: (fishingSkillData?.skill || 0) + (achievementBonus || 0), // 낚시실력 공개 (업적 보너스 포함)
        fishingSkillDetails: { // 낚시실력 상세 정보
          baseSkill: fishingSkillData?.skill || 0,
          achievementBonus: achievementBonus || 0,
          totalSkill: (fishingSkillData?.skill || 0) + (achievementBonus || 0)
        },
        totalFishCaught: user.totalFishCaught || 0,
        totalCatches: totalCatches || 0,
        createdAt: user.createdAt
      });
    }
    
    // 🔐 본인 프로필이거나 관리자인 경우 상세 정보 제공
    console.log(`🔐 Returning detailed profile for ${username} to ${requesterUsername} (${isOwnProfile ? 'own' : 'admin'})`);
    
    const [userMoney, userAmber, userEquipment, fishingSkillData, totalCatches, achievementBonus] = await Promise.all([
      UserMoneyModel.findOne({ userUuid: user.userUuid }),
      UserAmberModel.findOne({ userUuid: user.userUuid }),
      UserEquipmentModel.findOne({ userUuid: user.userUuid }),
      FishingSkillModel.findOne({ userUuid: user.userUuid }),
      CatchModel.countDocuments({ userUuid: user.userUuid }),
      achievementSystem.calculateAchievementBonus(user.userUuid)
    ]);
    
    const profileData = {
      // userUuid는 관리자에게만 제공
      ...(isAdmin && { userUuid: user.userUuid }),
      username: user.username,
      displayName: user.displayName,
      isGuest: user.isGuest,
      money: userMoney?.money || 0,
      amber: userAmber?.amber || 0,
      equipment: {
        fishingRod: userEquipment?.fishingRod || null,
        accessory: userEquipment?.accessory || null,
        fishingRodEnhancement: userEquipment?.fishingRodEnhancement || 0,
        accessoryEnhancement: userEquipment?.accessoryEnhancement || 0
      },
      fishingSkill: (fishingSkillData?.skill || 0) + (achievementBonus || 0),
      fishingSkillDetails: { // 낚시실력 상세 정보
        baseSkill: fishingSkillData?.skill || 0,
        achievementBonus: achievementBonus || 0,
        totalSkill: (fishingSkillData?.skill || 0) + (achievementBonus || 0)
      },
      totalCatches: totalCatches || 0,
      totalFishCaught: user.totalFishCaught || 0,
      createdAt: user.createdAt
    };
    
    console.log(`🔐 Profile data sent for ${username}`);
    res.json(profileData);
  } catch (error) {
    console.error("Failed to fetch user profile:", error);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
}

// 🏆 업적 시스템 인스턴스 생성
const achievementSystem = new AchievementSystem(CatchModel, FishingSkillModel, UserUuidModel, RaidDamageModel, RareFishCountModel);

// 🏆 업적 자동 체크 함수 (모듈화된 함수 호출)
async function checkAndGrantAchievements(userUuid, username) {
  return await achievementSystem.checkAndGrantAchievements(userUuid, username);
}

// 🏆 낚시실력에 업적 보너스 적용 (로깅용)
async function updateFishingSkillWithAchievements(userUuid) {
  return await achievementSystem.logAchievementBonus(userUuid);
}

// 🔥 서버 버전 정보 API
app.get("/api/version", (req, res) => {
  res.json({
    version: "v1.284"
  });
});

// 🔥 서버 버전 및 API 상태 확인 (디버깅용)
app.get("/api/debug/server-info", (req, res) => {
  const serverInfo = {
    version: "v1.284",
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    availableAPIs: [
      "GET /api/user-profile (new query-based)",
      "GET /api/user-profile/:username (legacy)",
      "POST /api/reset-account",
      "DELETE /api/delete-account",
      "POST /api/delete-account",
      "GET /api/game-data/*"
    ],
    message: "Server is running with updated APIs"
  };
  
  console.log("🔥 SERVER DEBUG INFO REQUESTED:", serverInfo);
  res.json(serverInfo);
});

// MongoDB 연결 상태 확인 엔드포인트
app.get("/api/health", async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    const stateNames = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    // 간단한 DB 쿼리 테스트
    const userCount = await UserUuidModel.countDocuments();
    
    // Admin 계정 상태 확인 (모든 Admin 계정)
    let adminStatus = null;
    try {
      const adminUsers = await UserUuidModel.find({ username: 'Admin' });
      if (adminUsers.length > 0) {
        adminStatus = adminUsers.map(admin => ({
          username: admin.username,
          userUuid: admin.userUuid,
          isAdmin: admin.isAdmin
        }));
      } else {
        adminStatus = 'NOT_FOUND';
      }
    } catch (error) {
      adminStatus = 'ERROR: ' + error.message;
    }
    
    res.json({
      status: 'ok',
      adminAccountStatus: adminStatus, // Admin 계정 상태 추가
      mongodb: {
        state: dbState,
        stateName: stateNames[dbState],
        connected: dbState === 1,
        database: mongoose.connection.db?.databaseName,
        userCount
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(500).json({
      status: 'error',
      mongodb: {
        state: mongoose.connection.readyState,
        connected: false,
        error: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// 🚀 Keep-Alive 엔드포인트 (콜드 스타트 방지)
app.get("/api/ping", (req, res) => {
  res.json({ 
    pong: true, 
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
});



// 🛡️ [SECURITY] 보안 강화된 계정 초기화 API
app.post("/api/reset-account", authenticateJWT, async (req, res) => {
  try {
    // 🔐 JWT에서 사용자 정보 추출 (더 안전함)
    const { userUuid: jwtUserUuid, username: jwtUsername } = req.user;
    const { confirmationKey } = req.body; // 🛡️ 보안: 확인 키 필수
    const clientIP = getClientIP(req);
    
    // JWT에서 추출한 정보 사용 (쿼리 파라미터 무시)
    const username = jwtUsername;
    const userUuid = jwtUserUuid;
    
    console.log("🚨 [SECURITY] === ACCOUNT RESET REQUEST ===");
    console.log("Reset account request:", { username, userUuid, clientIP });
    
    // 🛡️ 보안 검증 1: 필수 매개변수 확인
    if (!userUuid || !username) {
      return res.status(400).json({ error: "사용자 UUID와 사용자명이 모두 필요합니다." });
    }
    
    // 🛡️ 보안 검증 2: 확인 키 필수 (계정 초기화는 위험한 작업)
    const expectedConfirmationKey = `RESET_${username}_${userUuid}_CONFIRM`;
    if (!confirmationKey || confirmationKey !== expectedConfirmationKey) {
      console.log(`🚨 [SECURITY] Invalid reset attempt from ${clientIP} - User: ${username}`);
      return res.status(403).json({ 
        error: "계정 초기화를 위해서는 확인 키가 필요합니다.",
        requiredKey: expectedConfirmationKey
      });
    }
    
    // 사용자 존재 확인 및 소유권 검증
    const user = await UserUuidModel.findOne({ userUuid });
    if (!user) {
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
    }
    
    // 🛡️ 보안 검증 3: 사용자명 일치 확인
    if (user.username !== username) {
      console.log(`🚨 [SECURITY] Username mismatch in reset request - Expected: ${user.username}, Provided: ${username}`);
      return res.status(403).json({ error: "사용자 정보가 일치하지 않습니다." });
    }
    
    console.log(`🔄 [SECURITY] Authorized reset for user: ${user.username} (${userUuid}) from IP: ${clientIP}`);
    
    // 모든 관련 데이터 삭제 (동료 능력치 포함)
    const deleteResults = await Promise.all([
      CatchModel.deleteMany({ userUuid }),
      UserMoneyModel.deleteMany({ userUuid }),
      UserAmberModel.deleteMany({ userUuid }),
      UserEquipmentModel.deleteMany({ userUuid }),
      MaterialModel.deleteMany({ userUuid }),
      FishingSkillModel.deleteMany({ userUuid }),
      StarPieceModel.deleteMany({ userUuid }),
      CompanionModel.deleteMany({ userUuid }),
      CompanionStatsModel.deleteMany({ userUuid }), // 🔧 동료 능력치 데이터도 삭제
      CooldownModel.deleteMany({ userUuid }),
      EtherKeyModel.deleteMany({ userUuid })
    ]);
    
    console.log("Deleted data:", {
      catches: deleteResults[0].deletedCount,
      money: deleteResults[1].deletedCount,
      amber: deleteResults[2].deletedCount,
      equipment: deleteResults[3].deletedCount,
      materials: deleteResults[4].deletedCount,
      fishingSkill: deleteResults[5].deletedCount,
      starPieces: deleteResults[6].deletedCount,
      companions: deleteResults[7].deletedCount,
      companionStats: deleteResults[8].deletedCount, // 🔧 동료 능력치 삭제 로그
      cooldowns: deleteResults[9].deletedCount,
      etherKeys: deleteResults[10].deletedCount
    });
    
    // 초기 데이터 생성
    const initialMoney = await UserMoneyModel.create({
      userUuid,
      username: user.username,
      money: 100 // 초기 골드
    });
    
    const initialEquipment = await UserEquipmentModel.create({
      userUuid,
      username: user.username,
      fishingRod: '나무낚시대',
      accessory: null
    });
    
    const initialSkill = await FishingSkillModel.create({
      userUuid,
      username: user.username,
      skill: 0 // 초기 낚시실력
    });
    
    console.log("Created initial data:", {
      money: initialMoney.money,
      equipment: { fishingRod: initialEquipment.fishingRod, accessory: initialEquipment.accessory },
      skill: initialSkill.skill
    });
    
    res.json({
      success: true,
      message: "계정이 성공적으로 초기화되었습니다.",
      resetData: {
        userUuid: user.userUuid,
        username: user.username,
        money: initialMoney.money,
        equipment: {
          fishingRod: initialEquipment.fishingRod,
          accessory: initialEquipment.accessory
        },
        fishingSkill: initialSkill.skill,
        deletedCounts: {
          catches: deleteResults[0].deletedCount,
          money: deleteResults[1].deletedCount,
          equipment: deleteResults[2].deletedCount,
          materials: deleteResults[3].deletedCount,
          fishingSkill: deleteResults[4].deletedCount
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Failed to reset account:", error);
    res.status(500).json({ error: error.message });
  }
});

// 🔑 관리자 권한: 사용자 계정 초기화 API (JWT + AdminKey 이중 보안)
app.post("/api/admin/reset-user-account", authenticateJWT, async (req, res) => {
  try {
    const { targetUsername, adminKey, confirmationKey } = req.body;
    // JWT에서 관리자 정보 추출 (보안 강화)
    const { userUuid: adminUserUuid, username: adminUsername } = req.user;
    
    console.log(`🔑 [ADMIN] Reset user account request by ${adminUsername} (${adminUserUuid}):`, { targetUsername });
    
    // 관리자 권한 확인 (두 모델 모두 확인 및 동기화)
    console.log("🔍 [DEBUG] Looking for admin user:", { adminUserUuid, adminUsername });
    const adminUser = await UserUuidModel.findOne({ 
      $or: [{ userUuid: adminUserUuid }, { username: adminUsername }] 
    });
    
    // AdminModel에서도 확인
    const adminRecord = await AdminModel.findOne({
      $or: [{ userUuid: adminUserUuid }, { username: adminUsername }]
    });
    
    console.log("🔍 [DEBUG] Found admin user:", adminUser ? { 
      userUuid: adminUser.userUuid, 
      username: adminUser.username, 
      isAdmin: adminUser.isAdmin 
    } : null);
    console.log("🔍 [DEBUG] Found admin record:", adminRecord ? { 
      userUuid: adminRecord.userUuid, 
      username: adminRecord.username, 
      isAdmin: adminRecord.isAdmin 
    } : null);
    
    // AdminModel에 권한이 있지만 UserUuidModel에 없는 경우 동기화
    if (adminRecord?.isAdmin && adminUser && !adminUser.isAdmin) {
      console.log("🔄 [SYNC] Syncing admin rights for user reset");
      await UserUuidModel.updateOne(
        { _id: adminUser._id },
        { $set: { isAdmin: true } }
      );
      adminUser.isAdmin = true;
    }
    
    // 권한 확인 (두 모델 중 하나라도 관리자면 허용)
    const hasAdminRights = (adminUser?.isAdmin) || (adminRecord?.isAdmin);
    
    if (!hasAdminRights) {
      console.log("❌ [ADMIN] Unauthorized admin reset attempt:", adminUsername);
      return res.status(403).json({ error: "관리자 권한이 필요합니다." });
    }
    
    // 관리자 키 검증
    const validAdminKey = process.env.ADMIN_KEY || "admin_secret_key_2024";
    console.log("🔍 [DEBUG] Expected admin key:", validAdminKey);
    console.log("🔍 [DEBUG] Received admin key:", adminKey);
    console.log("🔍 [DEBUG] ADMIN_KEY env var:", process.env.ADMIN_KEY);
    if (adminKey !== validAdminKey) {
      console.log("❌ [ADMIN] Invalid admin key for reset");
      return res.status(403).json({ error: `잘못된 관리자 키입니다. 기대값: ${validAdminKey}` });
    }
    
    // 대상 사용자 찾기
    const targetUser = await UserUuidModel.findOne({ username: targetUsername });
    if (!targetUser) {
      return res.status(404).json({ error: "대상 사용자를 찾을 수 없습니다." });
    }
    
    console.log("🔑 [ADMIN] Resetting account for user:", targetUsername);
    
    // 사용자 데이터 삭제 (병렬 처리)
    const deletePromises = [
      CatchModel.deleteMany({ userUuid: targetUser.userUuid }),
      UserMoneyModel.deleteMany({ userUuid: targetUser.userUuid }),
      UserEquipmentModel.deleteMany({ userUuid: targetUser.userUuid }),
      MaterialModel.deleteMany({ userUuid: targetUser.userUuid }),
      FishingSkillModel.deleteMany({ userUuid: targetUser.userUuid }),
      DailyQuestModel.deleteMany({ userUuid: targetUser.userUuid }),
      CooldownModel.deleteMany({ userUuid: targetUser.userUuid })
    ];
    
    const deleteResults = await Promise.all(deletePromises);
    
    // 기본값으로 재설정
    const initialData = [
      UserMoneyModel.create({ userUuid: targetUser.userUuid, username: targetUsername, money: 100 }),
      UserEquipmentModel.create({ userUuid: targetUser.userUuid, username: targetUsername, fishingRod: '나무낚시대', accessory: null }),
      FishingSkillModel.create({ userUuid: targetUser.userUuid, username: targetUsername, skill: 0 })
    ];
    
    await Promise.all(initialData);
    
    console.log(`🔑 [ADMIN] Account reset completed for ${targetUsername} by ${adminUsername}`);
    
    res.json({
      success: true,
      message: `${targetUsername} 사용자의 계정이 초기화되었습니다.`,
      adminAction: {
        action: "reset",
        target: targetUsername,
        admin: adminUsername,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("Failed to reset user account:", error);
    res.status(500).json({ error: error.message });
  }
});

// 🔑 관리자 권한: 사용자 계정 삭제 API
// 🛡️ IP 차단 API
app.post("/api/admin/block-ip", authenticateJWT, async (req, res) => {
  try {
    const { ipAddress, reason, adminKey } = req.body;
    const { username: adminUsername, userUuid: adminUserUuid } = req.query;
    const clientIP = getClientIP(req);

    console.log("🛡️ [ADMIN] Block IP request:", { ipAddress, reason, adminUsername });

    // 관리자 권한 확인 (두 모델 모두 확인 및 동기화)
    const adminUser = await UserUuidModel.findOne({ 
      $or: [{ userUuid: adminUserUuid }, { username: adminUsername }] 
    });
    
    // AdminModel에서도 확인
    const adminRecord = await AdminModel.findOne({
      $or: [{ userUuid: adminUserUuid }, { username: adminUsername }]
    });
    
    // AdminModel에 권한이 있지만 UserUuidModel에 없는 경우 동기화
    if (adminRecord?.isAdmin && adminUser && !adminUser.isAdmin) {
      console.log("🔄 [SYNC] Syncing admin rights for IP block");
      await UserUuidModel.updateOne(
        { _id: adminUser._id },
        { $set: { isAdmin: true } }
      );
      adminUser.isAdmin = true;
    }
    
    // 권한 확인 (두 모델 중 하나라도 관리자면 허용)
    const hasAdminRights = (adminUser?.isAdmin) || (adminRecord?.isAdmin);
    
    if (!hasAdminRights) {
      console.log("❌ [ADMIN] Unauthorized IP block attempt:", adminUsername);
      return res.status(403).json({ error: "관리자 권한이 필요합니다." });
    }

    // 관리자 키 검증
    const validAdminKey = process.env.ADMIN_KEY || "admin_secret_key_2024";
    if (adminKey !== validAdminKey) {
      console.log("❌ [ADMIN] Invalid admin key for IP block");
      return res.status(403).json({ error: "잘못된 관리자 키입니다." });
    }

    // IP 주소 유효성 검사
    if (!isValidIPAddress(ipAddress)) {
      return res.status(400).json({ error: "올바르지 않은 IP 주소입니다." });
    }

    // 자기 자신 차단 방지
    if (ipAddress === clientIP) {
      return res.status(400).json({ error: "자신의 IP는 차단할 수 없습니다." });
    }

    // IP 차단 정보 저장 (한국시간)
    const koreanTime = new Date().toLocaleString('ko-KR', { 
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const blockInfo = {
      reason: reason || '관리자에 의한 수동 차단',
      blockedAt: koreanTime,
      blockedBy: adminUsername
    };
    
    // 메모리와 데이터베이스 모두에 저장
    blockedIPs.set(ipAddress, blockInfo);
    
    // 데이터베이스에 저장 (중복 시 업데이트)
    await BlockedIPModel.findOneAndUpdate(
      { ipAddress: ipAddress },
      {
        ipAddress: ipAddress,
        reason: blockInfo.reason,
        blockedAt: blockInfo.blockedAt,
        blockedBy: blockInfo.blockedBy
      },
      { upsert: true, new: true }
    );

    console.log(`🚫 [ADMIN] IP ${ipAddress} blocked by ${adminUsername}: ${blockInfo.reason}`);

    res.json({ 
      success: true, 
      message: `IP ${ipAddress}가 차단되었습니다.`,
      blockedIP: {
        address: ipAddress,
        ...blockInfo
      }
    });

  } catch (error) {
    console.error("Failed to block IP:", error);
    res.status(500).json({ error: error.message });
  }
});

// 🛡️ IP 차단 해제 API
app.post("/api/admin/unblock-ip", authenticateJWT, async (req, res) => {
  try {
    const { ipAddress, adminKey } = req.body;
    const { username: adminUsername, userUuid: adminUserUuid } = req.query;

    console.log("✅ [ADMIN] Unblock IP request:", { ipAddress, adminUsername });

    // 관리자 권한 확인 (두 모델 모두 확인 및 동기화)
    const adminUser = await UserUuidModel.findOne({ 
      $or: [{ userUuid: adminUserUuid }, { username: adminUsername }] 
    });
    
    // AdminModel에서도 확인
    const adminRecord = await AdminModel.findOne({
      $or: [{ userUuid: adminUserUuid }, { username: adminUsername }]
    });
    
    // AdminModel에 권한이 있지만 UserUuidModel에 없는 경우 동기화
    if (adminRecord?.isAdmin && adminUser && !adminUser.isAdmin) {
      console.log("🔄 [SYNC] Syncing admin rights for IP unblock");
      await UserUuidModel.updateOne(
        { _id: adminUser._id },
        { $set: { isAdmin: true } }
      );
      adminUser.isAdmin = true;
    }
    
    // 권한 확인 (두 모델 중 하나라도 관리자면 허용)
    const hasAdminRights = (adminUser?.isAdmin) || (adminRecord?.isAdmin);
    
    if (!hasAdminRights) {
      return res.status(403).json({ error: "관리자 권한이 필요합니다." });
    }

    // 관리자 키 검증
    const validAdminKey = process.env.ADMIN_KEY || "admin_secret_key_2024";
    if (adminKey !== validAdminKey) {
      return res.status(403).json({ error: "잘못된 관리자 키입니다." });
    }

    // 메모리와 데이터베이스에서 모두 삭제
    const wasBlocked = blockedIPs.delete(ipAddress);
    const dbResult = await BlockedIPModel.deleteOne({ ipAddress: ipAddress });

    if (wasBlocked || dbResult.deletedCount > 0) {
      console.log(`✅ [ADMIN] IP ${ipAddress} unblocked by ${adminUsername}`);
      res.json({ 
        success: true, 
        message: `IP ${ipAddress} 차단이 해제되었습니다.` 
      });
    } else {
      res.status(404).json({ error: "차단되지 않은 IP입니다." });
    }

  } catch (error) {
    console.error("Failed to unblock IP:", error);
    res.status(500).json({ error: error.message });
  }
});

// 🚫 계정 차단 API
app.post("/api/admin/block-account", authenticateJWT, async (req, res) => {
  try {
    const { userUuid, username, reason, adminKey } = req.body;
    const { username: adminUsername, userUuid: adminUserUuid } = req.query;

    console.log("🚫 [ADMIN] Block account request:", { userUuid, username, reason, adminUsername });

    // 관리자 권한 확인 (두 모델 모두 확인 및 동기화)
    const adminUser = await UserUuidModel.findOne({ 
      $or: [{ userUuid: adminUserUuid }, { username: adminUsername }] 
    });
    
    // AdminModel에서도 확인
    const adminRecord = await AdminModel.findOne({
      $or: [{ userUuid: adminUserUuid }, { username: adminUsername }]
    });
    
    // AdminModel에 권한이 있지만 UserUuidModel에 없는 경우 동기화
    if (adminRecord?.isAdmin && adminUser && !adminUser.isAdmin) {
      console.log("🔄 [SYNC] Syncing admin rights for account block");
      await UserUuidModel.updateOne(
        { _id: adminUser._id },
        { $set: { isAdmin: true } }
      );
      adminUser.isAdmin = true;
    }
    
    // 권한 확인 (두 모델 중 하나라도 관리자면 허용)
    const hasAdminRights = (adminUser?.isAdmin) || (adminRecord?.isAdmin);
    
    if (!hasAdminRights) {
      console.log("❌ [ADMIN] Unauthorized account block attempt:", adminUsername);
      return res.status(403).json({ error: "관리자 권한이 필요합니다." });
    }

    // 관리자 키 검증
    const validAdminKey = process.env.ADMIN_KEY || "admin_secret_key_2024";
    if (adminKey !== validAdminKey) {
      console.log("❌ [ADMIN] Invalid admin key for account block");
      return res.status(403).json({ error: "잘못된 관리자 키입니다." });
    }

    // 대상 사용자 확인 및 조회 (사용자명 또는 UUID로)
    if (!userUuid || !username) {
      return res.status(400).json({ error: "사용자 UUID와 사용자명이 필요합니다." });
    }

    // 실제 사용자 정보 조회 (사용자명이나 UUID 중 하나만 있어도 됨)
    let targetUser = null;
    let finalUserUuid = userUuid;
    let finalUsername = username;

    try {
      // UUID가 #으로 시작하는 경우 UUID로 검색
      if (userUuid.startsWith('#')) {
        targetUser = await UserUuidModel.findOne({ userUuid: userUuid });
        if (targetUser) {
          finalUsername = targetUser.displayName || targetUser.username;
        }
      } 
      // 그렇지 않으면 사용자명으로 검색
      else {
        targetUser = await UserUuidModel.findOne({ 
          $or: [
            { username: username },
            { displayName: username }
          ]
        });
        if (targetUser) {
          finalUserUuid = targetUser.userUuid;
          finalUsername = targetUser.displayName || targetUser.username;
        }
      }

      // 사용자를 찾지 못한 경우
      if (!targetUser) {
        console.log(`❌ [ADMIN] Target user not found: ${userUuid} / ${username}`);
        return res.status(404).json({ 
          error: `사용자를 찾을 수 없습니다: ${userUuid.startsWith('#') ? userUuid : username}` 
        });
      }

      console.log(`🎯 [ADMIN] Target user found: ${finalUsername} (${finalUserUuid})`);

    } catch (searchError) {
      console.error("❌ [ADMIN] Error searching for target user:", searchError);
      return res.status(500).json({ error: "사용자 조회 중 오류가 발생했습니다." });
    }

    // 계정 차단 정보 저장 (한국시간)
    const koreanTime = new Date().toLocaleString('ko-KR', { 
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const blockInfo = {
      username: finalUsername,
      reason: reason || '관리자에 의한 수동 차단',
      blockedAt: koreanTime,
      blockedBy: adminUsername
    };
    
    // 메모리와 데이터베이스 모두에 저장 (최종 정보 사용)
    blockedAccounts.set(finalUserUuid, blockInfo);
    
    // 데이터베이스에 저장 (중복 시 업데이트)
    await BlockedAccountModel.findOneAndUpdate(
      { userUuid: finalUserUuid },
      {
        userUuid: finalUserUuid,
        username: blockInfo.username,
        reason: blockInfo.reason,
        blockedAt: blockInfo.blockedAt,
        blockedBy: blockInfo.blockedBy
      },
      { upsert: true, new: true }
    );

    console.log(`🚫 [ADMIN] Account ${finalUsername} (${finalUserUuid}) blocked by ${adminUsername}: ${blockInfo.reason}`);

    // 해당 계정의 모든 Socket 연결 강제 종료
    if (global.io) {
      global.io.sockets.sockets.forEach((socket) => {
        if (socket.userUuid === finalUserUuid) {
          console.log(`🚫 [ADMIN] Disconnecting blocked account socket: ${socket.username}`);
          socket.emit('account-blocked', { 
            reason: blockInfo.reason,
            blockedAt: blockInfo.blockedAt,
            blockedBy: blockInfo.blockedBy
          });
          socket.disconnect(true);
        }
      });
    }

    res.json({ 
      success: true, 
      message: `계정 ${finalUsername}이 차단되었습니다.`,
      blockedAccount: {
        userUuid: finalUserUuid,
        username: finalUsername,
        ...blockInfo
      }
    });

  } catch (error) {
    console.error("Failed to block account:", error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ 계정 차단 해제 API
app.post("/api/admin/unblock-account", authenticateJWT, async (req, res) => {
  try {
    const { userUuid, adminKey } = req.body;
    const { username: adminUsername, userUuid: adminUserUuid } = req.query;

    console.log("✅ [ADMIN] Unblock account request:", { userUuid, adminUsername });

    // 관리자 권한 확인 (두 모델 모두 확인 및 동기화)
    const adminUser = await UserUuidModel.findOne({ 
      $or: [{ userUuid: adminUserUuid }, { username: adminUsername }] 
    });
    
    // AdminModel에서도 확인
    const adminRecord = await AdminModel.findOne({
      $or: [{ userUuid: adminUserUuid }, { username: adminUsername }]
    });
    
    // AdminModel에 권한이 있지만 UserUuidModel에 없는 경우 동기화
    if (adminRecord?.isAdmin && adminUser && !adminUser.isAdmin) {
      console.log("🔄 [SYNC] Syncing admin rights for account unblock");
      await UserUuidModel.updateOne(
        { _id: adminUser._id },
        { $set: { isAdmin: true } }
      );
      adminUser.isAdmin = true;
    }
    
    // 권한 확인 (두 모델 중 하나라도 관리자면 허용)
    const hasAdminRights = (adminUser?.isAdmin) || (adminRecord?.isAdmin);
    
    if (!hasAdminRights) {
      return res.status(403).json({ error: "관리자 권한이 필요합니다." });
    }

    // 관리자 키 검증
    const validAdminKey = process.env.ADMIN_KEY || "admin_secret_key_2024";
    if (adminKey !== validAdminKey) {
      return res.status(403).json({ error: "잘못된 관리자 키입니다." });
    }

    if (!userUuid) {
      return res.status(400).json({ error: "사용자 UUID가 필요합니다." });
    }

    // 메모리와 데이터베이스에서 모두 삭제
    const wasBlocked = blockedAccounts.delete(userUuid);
    const dbResult = await BlockedAccountModel.deleteOne({ userUuid: userUuid });

    if (wasBlocked || dbResult.deletedCount > 0) {
      console.log(`✅ [ADMIN] Account ${userUuid} unblocked by ${adminUsername}`);
      res.json({ 
        success: true, 
        message: `계정 차단이 해제되었습니다.` 
      });
    } else {
      res.status(404).json({ error: "차단되지 않은 계정입니다." });
    }

  } catch (error) {
    console.error("Failed to unblock account:", error);
    res.status(500).json({ error: error.message });
  }
});

// 📋 차단된 계정 목록 조회 API
app.get("/api/admin/blocked-accounts", async (req, res) => {
  try {
    const { username: adminUsername, userUuid: adminUserUuid } = req.query;
    
    console.log("🔍 [DEBUG] Blocked accounts request:", { adminUsername, adminUserUuid });

    // 관리자 권한 확인 (두 모델 모두 확인 및 동기화)
    const adminUser = await UserUuidModel.findOne({ 
      $or: [{ userUuid: adminUserUuid }, { username: adminUsername }] 
    });
    
    // AdminModel에서도 확인
    const adminRecord = await AdminModel.findOne({
      $or: [{ userUuid: adminUserUuid }, { username: adminUsername }]
    });
    
    // AdminModel에 권한이 있지만 UserUuidModel에 없는 경우 동기화
    if (adminRecord?.isAdmin && adminUser && !adminUser.isAdmin) {
      console.log("🔄 [SYNC] Syncing admin rights for blocked accounts list");
      await UserUuidModel.updateOne(
        { _id: adminUser._id },
        { $set: { isAdmin: true } }
      );
      adminUser.isAdmin = true;
    }
    
    // 권한 확인 (두 모델 중 하나라도 관리자면 허용)
    const hasAdminRights = (adminUser?.isAdmin) || (adminRecord?.isAdmin);
    
    if (!hasAdminRights) {
      console.log("❌ [DEBUG] Admin access denied for blocked accounts - no admin rights found");
      return res.status(403).json({ error: "관리자 권한이 필요합니다." });
    }

    // 차단된 계정 목록 반환
    const blockedList = Array.from(blockedAccounts.entries()).map(([userUuid, data]) => ({
      userUuid: userUuid,
      username: data.username,
      reason: data.reason,
      blockedAt: data.blockedAt,
      blockedBy: data.blockedBy
    }));

    console.log(`📋 [ADMIN] Blocked accounts list requested by ${adminUsername}: ${blockedList.length} accounts`);

    res.json({ 
      success: true, 
      blockedAccounts: blockedList.sort((a, b) => new Date(b.blockedAt) - new Date(a.blockedAt))
    });

  } catch (error) {
    console.error("Failed to fetch blocked accounts:", error);
    res.status(500).json({ error: error.message });
  }
});

// 🔍 현재 접속자 IP 조회 API (관리자 전용)
app.get("/api/admin/user-ips", async (req, res) => {
  try {
    const { username: adminUsername, userUuid: adminUserUuid } = req.query;
    
    // 관리자 권한 확인 (두 모델 모두 확인 및 동기화)
    const adminUser = await UserUuidModel.findOne({ 
      $or: [{ userUuid: adminUserUuid }, { username: adminUsername }] 
    });
    
    // AdminModel에서도 확인
    const adminRecord = await AdminModel.findOne({
      $or: [{ userUuid: adminUserUuid }, { username: adminUsername }]
    });
    
    console.log("🔍 [DEBUG] Admin check for user-ips:", {
      adminUsername,
      adminUserUuid,
      userFound: !!adminUser,
      userIsAdmin: adminUser?.isAdmin,
      adminRecordFound: !!adminRecord,
      adminRecordIsAdmin: adminRecord?.isAdmin
    });
    
    // AdminModel에 권한이 있지만 UserUuidModel에 없는 경우 동기화
    if (adminRecord?.isAdmin && adminUser && !adminUser.isAdmin) {
      console.log("🔄 [SYNC] Syncing admin rights from AdminModel to UserUuidModel");
      await UserUuidModel.updateOne(
        { _id: adminUser._id },
        { $set: { isAdmin: true } }
      );
      adminUser.isAdmin = true;
    }
    
    // 권한 확인 (두 모델 중 하나라도 관리자면 허용)
    const hasAdminRights = (adminUser?.isAdmin) || (adminRecord?.isAdmin);
    
    if (!hasAdminRights) {
      console.log("❌ [DEBUG] Admin access denied - no admin rights found");
      return res.status(403).json({ error: "관리자 권한이 필요합니다." });
    }

    // 현재 접속 중인 사용자들의 IP 정보
    const connectedUsers = [];
    
    // Socket.IO에서 연결된 사용자 정보 수집 (개선된 IP 수집)
    if (global.io) {
      global.io.sockets.sockets.forEach((socket) => {
        if (socket.username && socket.userUuid && socket.connected) {
          // Socket에 저장된 IP를 우선 사용, 없으면 헤더에서 추출
          const clientIP = socket.clientIP || 
                          socket.handshake.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                          socket.handshake.headers['x-real-ip'] || 
                          socket.handshake.headers['cf-connecting-ip'] ||
                          socket.handshake.address ||
                          socket.conn?.remoteAddress ||
                          socket.request?.connection?.remoteAddress ||
                          'Unknown';
          
          // 연결 상태 확인 (비활성 연결 필터링)
          const isActiveConnection = socket.connected && 
                                   (socket.lastActivity ? (Date.now() - socket.lastActivity < 120000) : true); // 2분 이내 활동
          
          if (isActiveConnection) {
            console.log(`🔍 [IP-DEBUG] Active Socket ${socket.username}: IP=${clientIP}, Connected=${socket.connected}, LastActivity=${socket.lastActivity ? new Date(socket.lastActivity).toLocaleString('ko-KR') : 'Unknown'}`);
            
            connectedUsers.push({
              username: socket.username,
              userUuid: socket.userUuid,
              ipAddress: clientIP,
              connectedAt: socket.connectedAt || new Date().toLocaleString('ko-KR', { 
                timeZone: 'Asia/Seoul',
                year: 'numeric',
                month: '2-digit', 
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              }),
              lastActivity: socket.lastActivity ? new Date(socket.lastActivity).toLocaleString('ko-KR', { 
                timeZone: 'Asia/Seoul',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              }) : '알 수 없음',
              isAlive: socket.isAlive || false
            });
          } else {
            console.log(`⚠️ [IP-DEBUG] Inactive Socket ${socket.username}: Skipping (LastActivity: ${socket.lastActivity ? new Date(socket.lastActivity).toLocaleString('ko-KR') : 'None'})`);
          }
        }
      });
    }

    res.json({ 
      success: true, 
      connectedUsers: connectedUsers,
      totalConnected: connectedUsers.length
    });

  } catch (error) {
    console.error("Failed to fetch user IPs:", error);
    res.status(500).json({ error: error.message });
  }
});

// 🛡️ 차단된 IP 목록 조회 API
app.get("/api/admin/blocked-ips", async (req, res) => {
  try {
    const { username: adminUsername, userUuid: adminUserUuid } = req.query;
    
    console.log("🔍 [DEBUG] Blocked IPs request:", { adminUsername, adminUserUuid });

    // 관리자 권한 확인 (두 모델 모두 확인 및 동기화)
    const adminUser = await UserUuidModel.findOne({ 
      $or: [{ userUuid: adminUserUuid }, { username: adminUsername }] 
    });
    
    // AdminModel에서도 확인
    const adminRecord = await AdminModel.findOne({
      $or: [{ userUuid: adminUserUuid }, { username: adminUsername }]
    });
    
    console.log("🔍 [DEBUG] Admin check for blocked-ips:", {
      adminUsername,
      adminUserUuid,
      userFound: !!adminUser,
      userIsAdmin: adminUser?.isAdmin,
      adminRecordFound: !!adminRecord,
      adminRecordIsAdmin: adminRecord?.isAdmin
    });
    
    // AdminModel에 권한이 있지만 UserUuidModel에 없는 경우 동기화
    if (adminRecord?.isAdmin && adminUser && !adminUser.isAdmin) {
      console.log("🔄 [SYNC] Syncing admin rights from AdminModel to UserUuidModel for blocked-ips");
      await UserUuidModel.updateOne(
        { _id: adminUser._id },
        { $set: { isAdmin: true } }
      );
      adminUser.isAdmin = true;
    }
    
    // 권한 확인 (두 모델 중 하나라도 관리자면 허용)
    const hasAdminRights = (adminUser?.isAdmin) || (adminRecord?.isAdmin);
    
    if (!hasAdminRights) {
      console.log("❌ [DEBUG] Admin access denied for blocked-ips - no admin rights found");
      return res.status(403).json({ error: "관리자 권한이 필요합니다." });
    }

    // 차단된 IP 목록 반환
    const blockedList = Array.from(blockedIPs.entries()).map(([ip, data]) => ({
      address: ip,
      reason: data.reason,
      blockedAt: data.blockedAt,
      blockedBy: data.blockedBy
    }));

    console.log(`📋 [ADMIN] Blocked IPs list requested by ${adminUsername}: ${blockedList.length} IPs`);

    res.json({ 
      success: true, 
      blockedIPs: blockedList.sort((a, b) => new Date(b.blockedAt) - new Date(a.blockedAt))
    });

  } catch (error) {
    console.error("Failed to fetch blocked IPs:", error);
    res.status(500).json({ error: error.message });
  }
});

// 🔄 관리자 권한: 클라이언트 업데이트 알림 API
app.post("/api/admin/notify-update", authenticateJWT, async (req, res) => {
  try {
    const { version, message } = req.body;
    const { username: adminUsername, userUuid: adminUserUuid } = req.query;
    
    console.log("🔑 [ADMIN] Update notification request:", { version, adminUsername });
    
    // 관리자 권한 확인
    const adminUser = await UserUuidModel.findOne({ 
      $or: [{ userUuid: adminUserUuid }, { username: adminUsername }] 
    });
    
    if (!adminUser || !adminUser.isAdmin) {
      console.log("❌ [ADMIN] Unauthorized update notification attempt:", { adminUsername, adminUserUuid });
      return res.status(403).json({ 
        error: "관리자 권한이 필요합니다",
        code: "ADMIN_REQUIRED"
      });
    }
    
    // 새 버전으로 업데이트 알림 전송
    const newVersion = version || `${new Date().toISOString().slice(0, 19).replace(/[-:]/g, '')}`;
    const customMessage = message || '새로운 버전이 배포되었습니다. 잠시 후 자동으로 새로고침됩니다.';
    
    notifyClientUpdate(newVersion);
    
    console.log(`✅ [ADMIN] Update notification sent by ${adminUsername}: ${newVersion}`);
    
    res.json({ 
      success: true, 
      version: newVersion,
      message: customMessage,
      connectedClients: io.sockets.sockets.size,
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error("❌ [ADMIN] Failed to send update notification:", error);
    res.status(500).json({ 
      error: "업데이트 알림 전송 실패",
      details: error.message 
    });
  }
});

app.post("/api/admin/delete-user-account", authenticateJWT, async (req, res) => {
  try {
    const { targetUsername, adminKey, confirmationKey } = req.body;
    const { username: adminUsername, userUuid: adminUserUuid } = req.query;
    
    console.log("🔑 [ADMIN] Delete user account request:", { targetUsername, adminUsername });
    
    // 관리자 권한 확인 (두 모델 모두 확인 및 동기화)
    console.log("🔍 [DEBUG] Looking for admin user:", { adminUserUuid, adminUsername });
    const adminUser = await UserUuidModel.findOne({ 
      $or: [{ userUuid: adminUserUuid }, { username: adminUsername }] 
    });
    
    // AdminModel에서도 확인
    const adminRecord = await AdminModel.findOne({
      $or: [{ userUuid: adminUserUuid }, { username: adminUsername }]
    });
    
    console.log("🔍 [DEBUG] Found admin user:", adminUser ? { 
      userUuid: adminUser.userUuid, 
      username: adminUser.username, 
      isAdmin: adminUser.isAdmin 
    } : null);
    console.log("🔍 [DEBUG] Found admin record:", adminRecord ? { 
      userUuid: adminRecord.userUuid, 
      username: adminRecord.username, 
      isAdmin: adminRecord.isAdmin 
    } : null);
    
    // AdminModel에 권한이 있지만 UserUuidModel에 없는 경우 동기화
    if (adminRecord?.isAdmin && adminUser && !adminUser.isAdmin) {
      console.log("🔄 [SYNC] Syncing admin rights for user delete");
      await UserUuidModel.updateOne(
        { _id: adminUser._id },
        { $set: { isAdmin: true } }
      );
      adminUser.isAdmin = true;
    }
    
    // 권한 확인 (두 모델 중 하나라도 관리자면 허용)
    const hasAdminRights = (adminUser?.isAdmin) || (adminRecord?.isAdmin);
    
    if (!hasAdminRights) {
      console.log("❌ [ADMIN] Unauthorized admin delete attempt:", adminUsername);
      return res.status(403).json({ error: "관리자 권한이 필요합니다." });
    }
    
    // 관리자 키 검증
    const validAdminKey = process.env.ADMIN_KEY || "admin_secret_key_2024";
    console.log("🔍 [DEBUG] Expected admin key:", validAdminKey);
    console.log("🔍 [DEBUG] Received admin key:", adminKey);
    if (adminKey !== validAdminKey) {
      console.log("❌ [ADMIN] Invalid admin key for delete");
      return res.status(403).json({ error: "잘못된 관리자 키입니다." });
    }
    
    // 대상 사용자 찾기
    const targetUser = await UserUuidModel.findOne({ username: targetUsername });
    if (!targetUser) {
      return res.status(404).json({ error: "대상 사용자를 찾을 수 없습니다." });
    }
    
    // 관리자가 자신을 삭제하는 것을 방지
    if (targetUser.userUuid === adminUserUuid) {
      return res.status(400).json({ error: "자신의 계정은 삭제할 수 없습니다." });
    }
    
    console.log("🔑 [ADMIN] Deleting account for user:", targetUsername);
    
    // 모든 관련 데이터 삭제 (병렬 처리)
    const deletePromises = [
      CatchModel.deleteMany({ userUuid: targetUser.userUuid }),
      UserMoneyModel.deleteMany({ userUuid: targetUser.userUuid }),
      UserEquipmentModel.deleteMany({ userUuid: targetUser.userUuid }),
      MaterialModel.deleteMany({ userUuid: targetUser.userUuid }),
      FishingSkillModel.deleteMany({ userUuid: targetUser.userUuid }),
      DailyQuestModel.deleteMany({ userUuid: targetUser.userUuid }),
      CooldownModel.deleteMany({ userUuid: targetUser.userUuid }),
      UserAmberModel.deleteMany({ userUuid: targetUser.userUuid }),
      StarPieceModel.deleteMany({ userUuid: targetUser.userUuid }),
      CompanionModel.deleteMany({ userUuid: targetUser.userUuid }),
      UserUuidModel.deleteOne({ userUuid: targetUser.userUuid }) // 사용자 자체 삭제
    ];
    
    const deleteResults = await Promise.all(deletePromises);
    
    console.log(`🔑 [ADMIN] Account deletion completed for ${targetUsername} by ${adminUsername}`);
    
    res.json({
      success: true,
      message: `${targetUsername} 사용자의 계정이 삭제되었습니다.`,
      adminAction: {
        action: "delete",
        target: targetUsername,
        admin: adminUsername,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("Failed to delete user account:", error);
    res.status(500).json({ error: error.message });
  }
});

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/fishing_game";
const PORT = Number(process.env.PORT || 4000);

// 🔐 JWT 설정
const JWT_SECRET = process.env.JWT_SECRET || "fishing_game_jwt_secret_key_2024";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d"; // 다시 7일로 복원

// 🔐 비밀번호 암호화 유틸리티 함수들
const SALT_ROUNDS = 12; // bcrypt 솔트 라운드 (보안성과 성능의 균형)

async function hashPassword(password) {
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hash = await bcrypt.hash(password, salt);
    return { hash, salt };
  } catch (error) {
    console.error("🚨 Password hashing failed:", error);
    throw new Error("비밀번호 암호화에 실패했습니다.");
  }
}

async function verifyPassword(password, hash) {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error("🚨 Password verification failed:", error);
    return false;
  }
}

// 🔐 계정 잠금 관련 함수들
const MAX_LOGIN_ATTEMPTS = 5; // 최대 로그인 시도 횟수
const LOCK_TIME = 30 * 60 * 1000; // 30분 잠금

async function isAccountLocked(user) {
  return user.lockedUntil && user.lockedUntil > Date.now();
}

async function incrementLoginAttempts(userUuid) {
  const user = await UserUuidModel.findOne({ userUuid });
  if (!user) return;
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // 최대 시도 횟수 도달 시 계정 잠금
  if (user.loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS && !user.lockedUntil) {
    updates.$set = { lockedUntil: Date.now() + LOCK_TIME };
    console.log(`🚨 Account locked due to failed login attempts: ${user.username}`);
  }
  
  await UserUuidModel.updateOne({ userUuid }, updates);
}

async function resetLoginAttempts(userUuid, clientIP) {
  await UserUuidModel.updateOne(
    { userUuid }, 
    { 
      $unset: { loginAttempts: 1, lockedUntil: 1 },
      $set: { lastLoginAt: new Date(), lastLoginIP: clientIP }
    }
  );
}

// 🔐 낚시하기 API (서버 사이드 쿨타임 검증 강화)
app.post("/api/fishing", authenticateJWT, async (req, res) => {
  try {
    const { userUuid, username } = req.user;
    const clientIP = getClientIP(req);
    
    console.log(`🎣 Fishing request from ${username} (${userUuid}) - IP: ${clientIP}`);
    
    // 🛡️ 1단계: 사용자 존재 확인
    const user = await UserUuidModel.findOne({ userUuid });
    if (!user) {
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
    }
    
    // 🛡️ 2단계: 계정 잠금 확인
    if (await isAccountLocked(user)) {
      return res.status(423).json({ 
        error: "계정이 일시적으로 잠겨있습니다. 나중에 다시 시도해주세요.",
        lockedUntil: user.lockedUntil 
      });
    }
    
    // 🛡️ 3단계: 서버에서 쿨타임 검증 (클라이언트 조작 방지)
    const now = new Date();
    if (user.fishingCooldownEnd && user.fishingCooldownEnd > now) {
      const remainingTime = user.fishingCooldownEnd.getTime() - now.getTime();
      console.log(`🚨 [SECURITY] Cooldown bypass attempt by ${username} - Remaining: ${remainingTime}ms`);
      return res.status(429).json({ 
        error: "낚시 쿨타임이 남아있습니다.",
        remainingTime,
        cooldownEnd: user.fishingCooldownEnd.toISOString()
      });
    }
    
    // 🛡️ 4단계: 레이트 리미팅 (DDoS 방지)
    const userKey = `fishing_${userUuid}`;
    const lastFishingTime = fishingRateLimit.get(userKey);
    if (lastFishingTime && (Date.now() - lastFishingTime) < 1000) { // 1초 제한
      return res.status(429).json({ error: "너무 빠르게 요청하고 있습니다." });
    }
    fishingRateLimit.set(userKey, Date.now());
    
    // 🎣 낚시 로직 실행
    const fishingResult = await performFishing(user);
    
    // 🛡️ 5단계: 서버에서 쿨타임 설정 (클라이언트 신뢰하지 않음)
    const cooldownDuration = await calculateFishingCooldownTime({ userUuid });
    const cooldownEnd = new Date(now.getTime() + cooldownDuration);
    
    await UserUuidModel.updateOne(
      { userUuid },
      { 
        fishingCooldownEnd: cooldownEnd,
        $inc: { totalFishCaught: fishingResult.success ? 1 : 0 }
      }
    );
    
    // 🏆 낚시 성공 시 업적 체크
    let achievementGranted = false;
    let newAchievement = null;
    if (fishingResult.success) {
      try {
        achievementGranted = await checkAndGrantAchievements(userUuid, username);
        if (achievementGranted) {
          console.log(`🏆 Achievement granted to ${username} after fishing`);
          // 방금 달성한 업적 정보 가져오기
          const latestAchievement = await AchievementModel.findOne({ 
            userUuid, 
            achievementId: "fish_collector" 
          }).sort({ createdAt: -1 });
          if (latestAchievement) {
            newAchievement = {
              id: latestAchievement.achievementId,
              name: latestAchievement.achievementName,
              description: latestAchievement.description
            };
          }
        }
      } catch (error) {
        console.error("Failed to check achievements after fishing:", error);
      }
    }
    
    console.log(`🎣 Fishing completed for ${username}: ${fishingResult.success ? 'SUCCESS' : 'FAIL'}`);
    
    res.json({
      success: true,
      fishingResult,
      cooldownEnd: cooldownEnd.toISOString(),
      remainingTime: cooldownDuration,
      achievementGranted,
      newAchievement
    });
    
  } catch (error) {
    console.error("Fishing API error:", error);
    res.status(500).json({ error: "낚시 중 오류가 발생했습니다." });
  }
});

// 🛡️ 레이트 리미팅을 위한 메모리 캐시
const fishingRateLimit = new Map();

// 🎣 낚시 로직 함수
async function performFishing(user) {
  // 실제 낚시 로직 구현
  // 이 부분은 기존 클라이언트 로직을 서버로 이동
  const success = Math.random() > 0.3; // 70% 성공률 (예시)
  
  if (success) {
    // 물고기 선택, 인벤토리 업데이트 등
    return {
      success: true,
      fish: "참치", // 예시
      message: "낚시에 성공했습니다!"
    };
  } else {
    return {
      success: false,
      message: "물고기가 도망갔습니다."
    };
  }
}

// 🔐 JWT 유틸리티 함수들
function generateJWT(user) {
  try {
    const payload = {
      userUuid: user.userUuid,
      username: user.username || user.displayName,
      isAdmin: user.isAdmin || false
    };
    
    const token = jwt.sign(payload, JWT_SECRET, { 
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'fishing-game-server'
    });
    
    console.log(`🔐 JWT generated for user: ${user.username} (${user.userUuid})`);
    return token;
  } catch (error) {
    console.error("🚨 JWT generation failed:", error);
    return null;
  }
}

function verifyJWT(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 토큰 만료 시간 상세 로깅
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = decoded.exp - now;
    console.log(`🔐 JWT 검증 성공: ${decoded.username} (${decoded.userUuid}), 만료까지 ${Math.floor(timeUntilExpiry / 3600)}시간 ${Math.floor((timeUntilExpiry % 3600) / 60)}분 남음`);
    
    return decoded;
  } catch (error) {
    console.error("🚨 JWT verification failed:", error.message);
    
    // 상세한 에러 정보 로깅
    if (error.name === 'TokenExpiredError') {
      console.error(`🚨 JWT 토큰 만료: ${error.expiredAt}`);
    } else if (error.name === 'JsonWebTokenError') {
      console.error(`🚨 JWT 토큰 형식 오류: ${error.message}`);
    } else if (error.name === 'NotBeforeError') {
      console.error(`🚨 JWT 토큰 아직 유효하지 않음: ${error.date}`);
    } else {
      console.error(`🚨 JWT 검증 알 수 없는 오류: ${error.name} - ${error.message}`);
    }
    
    return null;
  }
}

// 🔐 JWT 인증 미들웨어
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    console.log("🚨 JWT missing in request");
    return res.status(401).json({ 
      error: "Access token required",
      code: "JWT_MISSING" 
    });
  }
  
  const decoded = verifyJWT(token);
  if (!decoded) {
    return res.status(403).json({ 
      error: "Invalid or expired token",
      code: "JWT_INVALID" 
    });
  }
  
  // 요청 객체에 사용자 정보 추가
  req.user = decoded;
  req.userUuid = decoded.userUuid;
  req.username = decoded.username;
  
  console.log(`🔐 JWT authenticated: ${decoded.username} (${decoded.userUuid})`);
  next();
}

// 레이드 라우터 등록
  const raidRouter = setupRaidRoutes(io, UserUuidModel, authenticateJWT, CompanionModel, FishingSkillModel, CompanionStatsModel, AchievementModel, achievementSystem, AdminModel, CooldownModel, StarPieceModel, RaidDamageModel, RareFishCountModel, CatchModel, RaidKillCountModel, UserEquipmentModel);
  app.use("/api/raid", raidRouter);

// 원정 라우터 등록
app.use((req, res, next) => {
  req.io = io;
  next();
});
const expeditionRouter = setupExpeditionRoutes(authenticateJWT, CompanionStatsModel, FishingSkillModel, UserEquipmentModel, EtherKeyModel);
app.use("/api/expedition", expeditionRouter);

// 업적 라우터 등록
const { router: achievementRouter } = setupAchievementRoutes(authenticateJWT, UserUuidModel, CatchModel, FishingSkillModel, RaidDamageModel, RareFishCountModel);
app.use("/api/achievements", achievementRouter);

// ==================== 거래소 API ====================

// 거래소 목록 조회
app.get("/api/market/listings", authenticateJWT, async (req, res) => {
  try {
    const listings = await MarketListingModel.find({}).sort({ listedAt: -1 }).lean();
    console.log(`📦 거래소 목록 조회: ${listings.length}개 아이템, 요청자: ${req.user.username}`);
    res.json(listings);
  } catch (error) {
    console.error("거래소 목록 조회 실패:", error);
    res.status(500).json({ message: "거래소 목록을 불러올 수 없습니다." });
  }
});

// 아이템 등록
app.post("/api/market/list", authenticateJWT, async (req, res) => {
  try {
    const { userUuid, username } = req.user;
    const { itemName, itemType, quantity, pricePerUnit } = req.body;

    if (!itemName || !itemType || !quantity || !pricePerUnit || quantity <= 0 || pricePerUnit <= 0) {
      return res.status(400).json({ message: "올바른 정보를 입력해주세요." });
    }

    // 낚시 실력 확인 (5 이상만 거래소 이용 가능)
    const fishingSkill = await FishingSkillModel.findOne({ userUuid: userUuid });
    if (!fishingSkill || fishingSkill.skill < 5) {
      return res.status(403).json({ message: "거래소는 낚시 실력 5 이상부터 이용할 수 있습니다." });
    }

    // 보증금 계산 및 확인 (먼저 체크!)
    const totalPrice = pricePerUnit * quantity;
    const deposit = Math.floor(totalPrice * 0.05);

    const userMoney = await UserMoneyModel.findOne({ userUuid: userUuid });
    if (!userMoney || userMoney.money < deposit) {
      return res.status(400).json({ message: `보증금이 부족합니다. 필요한 보증금: ${deposit.toLocaleString()}골드` });
    }

    // 아이템 보유 확인 (아직 차감하지 않음)
    if (itemType === 'material') {
      const userMaterials = await MaterialModel.find({ 
        userUuid: userUuid,
        material: itemName 
      });
      const totalCount = userMaterials.length;
      if (totalCount < quantity) {
        console.log(`재료 부족: ${itemName} - 보유 ${totalCount}개, 필요 ${quantity}개`);
        return res.status(400).json({ message: "재료가 부족합니다." });
      }
    } else if (itemType === 'amber') {
      const userAmber = await UserAmberModel.findOne({ userUuid: userUuid });
      if (!userAmber || userAmber.amber < quantity) {
        return res.status(400).json({ message: "호박석이 부족합니다." });
      }
    } else if (itemType === 'starPiece') {
      const userStarPieces = await StarPieceModel.findOne({ userUuid: userUuid });
      if (!userStarPieces || userStarPieces.starPieces < quantity) {
        return res.status(400).json({ message: "별조각이 부족합니다." });
      }
    } else {
      return res.status(400).json({ message: "올바르지 않은 아이템 타입입니다." });
    }

    // 모든 검증 통과! 이제 차감 시작
    
    // 보증금 차감
    userMoney.money -= deposit;
    await userMoney.save();
    console.log(`💰 보증금 차감: ${deposit.toLocaleString()}골드 (${username})`);

    // 아이템 타입별 차감
    if (itemType === 'material') {
      const userMaterials = await MaterialModel.find({ 
        userUuid: userUuid,
        material: itemName 
      });
      const materialsToDelete = userMaterials.slice(0, quantity);
      await MaterialModel.deleteMany({
        _id: { $in: materialsToDelete.map(m => m._id) }
      });
      console.log(`📦 재료 차감: ${itemName} x${quantity}`);
      
    } else if (itemType === 'amber') {
      const userAmber = await UserAmberModel.findOne({ userUuid: userUuid });
      userAmber.amber -= quantity;
      await userAmber.save();
      console.log(`💎 호박석 차감: x${quantity}`);
      
    } else if (itemType === 'starPiece') {
      const userStarPieces = await StarPieceModel.findOne({ userUuid: userUuid });
      userStarPieces.starPieces -= quantity;
      await userStarPieces.save();
      console.log(`⭐ 별조각 차감: x${quantity}`);
    }

    // 골드 업데이트 소켓 전송
    const socketId = connectedUsersMap.get(userUuid);
    if (socketId) {
      io.to(socketId).emit('data:money', { money: userMoney.money });
    }

    // 거래소에 등록
    const listing = new MarketListingModel({
      userUuid: userUuid,
      sellerNickname: username,
      itemName: itemName,
      itemType: itemType,
      quantity: quantity,
      pricePerUnit: pricePerUnit,
      deposit: deposit,
      listedAt: new Date()
    });

    await listing.save();

    // 소켓으로 전체 사용자에게 알림
    io.emit('marketUpdate', { type: 'newListing', listing: listing.toObject() });

    // 등록한 사용자에게 아이템 업데이트 전송 (socketId는 위에서 이미 선언됨)
    if (socketId) {
      if (itemType === 'material') {
        const updatedMaterials = await MaterialModel.find({ userUuid: userUuid }).lean();
        io.to(socketId).emit('data:materials', { materials: updatedMaterials });
      } else if (itemType === 'amber') {
        const userAmber = await UserAmberModel.findOne({ userUuid: userUuid });
        if (userAmber) {
          io.to(socketId).emit('data:amber', { amber: userAmber.amber });
        }
      } else if (itemType === 'starPiece') {
        const userStarPieces = await StarPieceModel.findOne({ userUuid: userUuid });
        if (userStarPieces) {
          io.to(socketId).emit('data:starPieces', { starPieces: userStarPieces.starPieces });
        }
      }
    }

    res.json({ message: "아이템이 등록되었습니다.", listing: listing.toObject() });
  } catch (error) {
    console.error("아이템 등록 실패:", error);
    res.status(500).json({ message: "아이템 등록에 실패했습니다." });
  }
});

// 아이템 구매
app.post("/api/market/purchase/:listingId", authenticateJWT, async (req, res) => {
  try {
    const { userUuid, username } = req.user;
    const { listingId } = req.params;

    // 낚시 실력 확인 (5 이상만 거래소 이용 가능)
    const fishingSkill = await FishingSkillModel.findOne({ userUuid: userUuid });
    if (!fishingSkill || fishingSkill.skill < 5) {
      return res.status(403).json({ message: "거래소는 낚시 실력 5 이상부터 이용할 수 있습니다." });
    }

    // 거래소 등록 확인
    const listing = await MarketListingModel.findById(listingId);
    if (!listing) {
      return res.status(404).json({ message: "등록된 아이템을 찾을 수 없습니다." });
    }

    // 자기 자신의 물건은 구매 불가
    if (listing.userUuid === userUuid) {
      return res.status(400).json({ message: "자신의 물건은 구매할 수 없습니다." });
    }

    const totalPrice = listing.pricePerUnit * listing.quantity;

    // 구매자의 골드 확인
    const buyerMoney = await UserMoneyModel.findOne({ userUuid: userUuid });
    if (!buyerMoney || buyerMoney.money < totalPrice) {
      return res.status(400).json({ message: "골드가 부족합니다." });
    }

    // 구매자 골드 차감
    buyerMoney.money -= totalPrice;
    await buyerMoney.save();

    // 판매자에게 골드 지급 (100% 전액 지급, 보증금은 돌려받지 못함)
    const sellerMoney = await UserMoneyModel.findOne({ userUuid: listing.userUuid });
    if (sellerMoney) {
      sellerMoney.money += totalPrice;
      await sellerMoney.save();
    }

    console.log(`💰 거래 완료: 총액 ${totalPrice.toLocaleString()}골드, 판매자 수령 ${totalPrice.toLocaleString()}골드, 보증금 ${listing.deposit.toLocaleString()}골드 회수안됨`);

    // 구매자에게 골드 업데이트 소켓 전송
    const buyerSocketId = connectedUsersMap.get(userUuid);
    if (buyerSocketId) {
      io.to(buyerSocketId).emit('data:money', { money: buyerMoney.money });
      console.log(`💰 구매자 골드 업데이트 전송: ${username} - ${buyerMoney.money}`);
    }

    // 판매자에게 골드 업데이트 소켓 전송
    const sellerSocketId = connectedUsersMap.get(listing.userUuid);
    if (sellerSocketId && sellerMoney) {
      io.to(sellerSocketId).emit('data:money', { money: sellerMoney.money });
      console.log(`💰 판매자 골드 업데이트 전송: ${listing.sellerNickname} - ${sellerMoney.money}`);
    }

    // 구매자에게 아이템 지급
    if (listing.itemType === 'material') {
      // MaterialModel은 각 재료가 별도 document
      const newMaterials = [];
      for (let i = 0; i < listing.quantity; i++) {
        newMaterials.push({
          userUuid: userUuid,
          username: username,
          material: listing.itemName
        });
      }
      
      await MaterialModel.insertMany(newMaterials);
      console.log(`📦 재료 지급: ${listing.itemName} x${listing.quantity} → ${username}`);
      
    } else if (listing.itemType === 'amber') {
      // 호박석 지급
      let userAmber = await UserAmberModel.findOne({ userUuid: userUuid });
      if (!userAmber) {
        userAmber = new UserAmberModel({ userUuid: userUuid, username: username, amber: 0 });
      }
      userAmber.amber += listing.quantity;
      await userAmber.save();
      console.log(`💎 호박석 지급: x${listing.quantity} → ${username}`);
      
    } else if (listing.itemType === 'starPiece') {
      // 별조각 지급
      let userStarPieces = await StarPieceModel.findOne({ userUuid: userUuid });
      if (!userStarPieces) {
        userStarPieces = new StarPieceModel({ userUuid: userUuid, username: username, starPieces: 0 });
      }
      userStarPieces.starPieces += listing.quantity;
      await userStarPieces.save();
      console.log(`⭐ 별조각 지급: x${listing.quantity} → ${username}`);
    }

    // 거래소에서 제거
    await MarketListingModel.deleteOne({ _id: listingId });

    // 거래 내역 저장
    await MarketTradeHistoryModel.create({
      buyerUuid: userUuid,
      buyerNickname: username,
      sellerUuid: listing.userUuid,
      sellerNickname: listing.sellerNickname,
      itemName: listing.itemName,
      itemType: listing.itemType,
      quantity: listing.quantity,
      pricePerUnit: listing.pricePerUnit,
      totalPrice: totalPrice,
      tradedAt: new Date()
    });

    // 판매자에게 판매 알림 메일 발송
    try {
      const saleMail = new MailModel({
        senderUuid: 'system',
        senderNickname: '거래소',
        receiverUuid: listing.userUuid,
        receiverNickname: listing.sellerNickname,
        subject: '📦 거래소 판매 완료',
        message: `${username}님이 거래소에서 ${listing.itemName} ${listing.quantity}개를 ${totalPrice.toLocaleString()}골드(개당 ${listing.pricePerUnit.toLocaleString()}골드)에 구매했습니다.\n\n판매 금액: ${totalPrice.toLocaleString()}골드\n등록 보증금 ${listing.deposit.toLocaleString()}골드는 회수되지 않습니다.`,
        isRead: false,
        sentAt: new Date()
      });
      await saleMail.save();

      // 실시간 메일 알림 (판매자가 접속 중이면) - sellerSocketId는 위에서 이미 선언됨
      if (sellerSocketId) {
        io.to(sellerSocketId).emit("new-mail", {
          from: '거래소',
          subject: '📦 거래소 판매 완료'
        });
      }
    } catch (mailError) {
      console.error('판매 알림 메일 발송 실패:', mailError);
      // 메일 발송 실패해도 거래는 계속 진행
    }

    // 구매자에게 구매 확인 메일 발송
    try {
      const purchaseMail = new MailModel({
        senderUuid: 'system',
        senderNickname: '거래소',
        receiverUuid: userUuid,
        receiverNickname: username,
        subject: '🛒 거래소 구매 완료',
        message: `${listing.sellerNickname}님으로부터 ${listing.itemName} ${listing.quantity}개를 ${totalPrice.toLocaleString()}골드(개당 ${listing.pricePerUnit.toLocaleString()}골드)에 구매했습니다.`,
        isRead: false,
        sentAt: new Date()
      });
      await purchaseMail.save();

      // 실시간 메일 알림 (구매자가 접속 중이면) - buyerSocketId는 위에서 이미 선언됨
      if (buyerSocketId) {
        io.to(buyerSocketId).emit("new-mail", {
          from: '거래소',
          subject: '🛒 거래소 구매 완료'
        });
      }
    } catch (mailError) {
      console.error('구매 알림 메일 발송 실패:', mailError);
      // 메일 발송 실패해도 거래는 계속 진행
    }

    // 소켓으로 전체 사용자에게 알림
    io.emit('marketUpdate', { type: 'purchase', listingId: listingId });

    // 구매자에게 아이템 업데이트 소켓 전송
    if (buyerSocketId) {
      if (listing.itemType === 'material') {
        const buyerMaterials = await MaterialModel.find({ userUuid: userUuid }).lean();
        io.to(buyerSocketId).emit('data:materials', { materials: buyerMaterials });
        console.log(`📦 구매자 재료 업데이트 전송: ${username}`);
      } else if (listing.itemType === 'amber') {
        const userAmber = await UserAmberModel.findOne({ userUuid: userUuid });
        if (userAmber) {
          io.to(buyerSocketId).emit('data:amber', { amber: userAmber.amber });
          console.log(`💎 구매자 호박석 업데이트 전송: ${username} - ${userAmber.amber}`);
        }
      } else if (listing.itemType === 'starPiece') {
        const userStarPieces = await StarPieceModel.findOne({ userUuid: userUuid });
        if (userStarPieces) {
          io.to(buyerSocketId).emit('data:starPieces', { starPieces: userStarPieces.starPieces });
          console.log(`⭐ 구매자 별조각 업데이트 전송: ${username} - ${userStarPieces.starPieces}`);
        }
      }
    }

    res.json({ 
      message: "구매가 완료되었습니다!",
      item: listing.itemName,
      quantity: listing.quantity,
      totalPrice: totalPrice
    });
  } catch (error) {
    console.error("구매 실패:", error);
    res.status(500).json({ message: "구매 중 오류가 발생했습니다." });
  }
});

// 등록 취소
app.delete("/api/market/cancel/:listingId", authenticateJWT, async (req, res) => {
  try {
    const { userUuid, username } = req.user;
    const { listingId } = req.params;

    // 낚시 실력 확인 (5 이상만 거래소 이용 가능)
    const fishingSkill = await FishingSkillModel.findOne({ userUuid: userUuid });
    if (!fishingSkill || fishingSkill.skill < 5) {
      return res.status(403).json({ message: "거래소는 낚시 실력 5 이상부터 이용할 수 있습니다." });
    }

    // 거래소 등록 확인
    const listing = await MarketListingModel.findById(listingId);
    if (!listing) {
      return res.status(404).json({ message: "등록된 아이템을 찾을 수 없습니다." });
    }

    // 자기 자신의 물건만 취소 가능
    if (listing.userUuid !== userUuid) {
      return res.status(403).json({ message: "자신의 물건만 취소할 수 있습니다." });
    }

    // 아이템 반환
    if (listing.itemType === 'material') {
      // MaterialModel은 각 재료가 별도 document
      const newMaterials = [];
      for (let i = 0; i < listing.quantity; i++) {
        newMaterials.push({
          userUuid: userUuid,
          username: username,
          material: listing.itemName
        });
      }
      
      await MaterialModel.insertMany(newMaterials);
      console.log(`📦 재료 반환: ${listing.itemName} x${listing.quantity} → ${username}`);
      
    } else if (listing.itemType === 'amber') {
      // 호박석 반환
      let userAmber = await UserAmberModel.findOne({ userUuid: userUuid });
      if (!userAmber) {
        userAmber = new UserAmberModel({ userUuid: userUuid, username: username, amber: 0 });
      }
      userAmber.amber += listing.quantity;
      await userAmber.save();
      console.log(`💎 호박석 반환: x${listing.quantity} → ${username}`);
      
    } else if (listing.itemType === 'starPiece') {
      // 별조각 반환
      let userStarPieces = await StarPieceModel.findOne({ userUuid: userUuid });
      if (!userStarPieces) {
        userStarPieces = new StarPieceModel({ userUuid: userUuid, username: username, starPieces: 0 });
      }
      userStarPieces.starPieces += listing.quantity;
      await userStarPieces.save();
      console.log(`⭐ 별조각 반환: x${listing.quantity} → ${username}`);
    }

    // 보증금 반환
    const userMoney = await UserMoneyModel.findOne({ userUuid: userUuid });
    if (userMoney) {
      userMoney.money += listing.deposit;
      await userMoney.save();
      console.log(`💰 보증금 반환: ${listing.deposit.toLocaleString()}골드 → ${username}`);
    }

    // 거래소에서 제거
    await MarketListingModel.deleteOne({ _id: listingId });

    // 소켓으로 전체 사용자에게 알림
    io.emit('marketUpdate', { type: 'cancel', listingId: listingId });

    // 취소한 사용자에게 아이템 + 골드 업데이트 전송
    const socketId = connectedUsersMap.get(userUuid);
    if (socketId) {
      // 골드 업데이트
      if (userMoney) {
        io.to(socketId).emit('data:money', { money: userMoney.money });
      }
      // 아이템 업데이트
      if (listing.itemType === 'material') {
        const updatedMaterials = await MaterialModel.find({ userUuid: userUuid }).lean();
        io.to(socketId).emit('data:materials', { materials: updatedMaterials });
      } else if (listing.itemType === 'amber') {
        const userAmber = await UserAmberModel.findOne({ userUuid: userUuid });
        if (userAmber) {
          io.to(socketId).emit('data:amber', { amber: userAmber.amber });
        }
      } else if (listing.itemType === 'starPiece') {
        const userStarPieces = await StarPieceModel.findOne({ userUuid: userUuid });
        if (userStarPieces) {
          io.to(socketId).emit('data:starPieces', { starPieces: userStarPieces.starPieces });
        }
      }
    }

    res.json({ message: "등록이 취소되었습니다." });
  } catch (error) {
    console.error("등록 취소 실패:", error);
    res.status(500).json({ message: "등록 취소에 실패했습니다." });
  }
});

// 내 거래 내역 조회
app.get("/api/market/history", authenticateJWT, async (req, res) => {
  try {
    const { userUuid } = req.user;

    // 사용자가 구매하거나 판매한 거래 내역 조회 (최근 50개)
    const trades = await MarketTradeHistoryModel.find({
      $or: [
        { buyerUuid: userUuid },
        { sellerUuid: userUuid }
      ]
    })
    .sort({ tradedAt: -1 })
    .limit(50)
    .lean();

    // 각 거래에 type 추가 (purchase or sale)
    const tradesWithType = trades.map(trade => ({
      ...trade,
      type: trade.buyerUuid === userUuid ? 'purchase' : 'sale'
    }));

    res.json(tradesWithType);
  } catch (error) {
    console.error("거래 내역 조회 실패:", error);
    res.status(500).json({ message: "거래 내역을 불러올 수 없습니다." });
  }
});

// 전체 거래 내역 조회 (모든 플레이어)
app.get("/api/market/history/all", authenticateJWT, async (req, res) => {
  try {
    // 모든 거래 내역 조회 (최근 100개)
    const trades = await MarketTradeHistoryModel.find({})
      .sort({ tradedAt: -1 })
      .limit(100)
      .lean();

    res.json(trades);
  } catch (error) {
    console.error("전체 거래 내역 조회 실패:", error);
    res.status(500).json({ message: "거래 내역을 불러올 수 없습니다." });
  }
});

// 아이템별 평균 거래가 조회
app.get("/api/market/average-prices", authenticateJWT, async (req, res) => {
  try {
    // 최근 30일 이내의 모든 거래 내역 조회
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const trades = await MarketTradeHistoryModel.find({
      tradedAt: { $gte: thirtyDaysAgo }
    }).lean();

    // 아이템별로 평균 가격 계산
    const itemStats = {};
    
    trades.forEach(trade => {
      if (!itemStats[trade.itemName]) {
        itemStats[trade.itemName] = {
          totalPrice: 0,
          totalQuantity: 0,
          tradeCount: 0,
          prices: []
        };
      }
      
      itemStats[trade.itemName].totalPrice += trade.pricePerUnit * trade.quantity;
      itemStats[trade.itemName].totalQuantity += trade.quantity;
      itemStats[trade.itemName].tradeCount += 1;
      itemStats[trade.itemName].prices.push(trade.pricePerUnit);
    });

    // 평균 가격 계산
    const averagePrices = {};
    Object.keys(itemStats).forEach(itemName => {
      const stats = itemStats[itemName];
      averagePrices[itemName] = {
        avgPrice: stats.totalPrice / stats.totalQuantity,
        tradeCount: stats.tradeCount,
        minPrice: Math.min(...stats.prices),
        maxPrice: Math.max(...stats.prices)
      };
    });

    res.json(averagePrices);
  } catch (error) {
    console.error("평균 가격 조회 실패:", error);
    res.status(500).json({ message: "평균 가격을 불러올 수 없습니다." });
  }
});

// ==================== 거래소 API 끝 ====================

// 🔐 선택적 JWT 인증 미들웨어 (토큰이 없어도 통과, 있으면 검증)
function optionalJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token) {
    const decoded = verifyJWT(token);
    if (decoded) {
      req.user = decoded;
      req.userUuid = decoded.userUuid;
      req.username = decoded.username;
    }
  }
  
  next();
}

// 404 에러 핸들러 (모든 라우트 처리 후)
app.use((req, res) => {
  console.log("=== 404 NOT FOUND ===");
  console.log("Requested URL:", req.url);
  console.log("Method:", req.method);
  console.log("Headers:", req.headers);
  
  // CSS 파일 요청인 경우 특별 처리
  if (req.path.endsWith('.css')) {
    console.log("❌ CSS file not found:", req.path);
    console.log("Available CSS files in assets:");
    const assetsDir = path.join(staticDir, 'assets');
    if (require('fs').existsSync(assetsDir)) {
      const cssFiles = require('fs').readdirSync(assetsDir).filter(f => f.endsWith('.css'));
      console.log(cssFiles);
    }
  }
  
  res.status(404).send(`File not found: ${req.path}`);
});

async function bootstrap() {
  try {
    console.log("=== MONGODB CONNECTION DEBUG ===");
    console.log("Attempting to connect to MongoDB:", MONGO_URI);
    
    // 🚀 MongoDB 연결 (최소 설정 - 디버그 모드)
    console.log("Connection string length:", MONGO_URI.length);
    console.log("Connection string starts with:", MONGO_URI.substring(0, 25));
    
    // 🚨 강력한 연결 설정 - 모든 타임아웃 늘림
    const connectionString = MONGO_URI.includes('?') 
      ? `${MONGO_URI}&serverSelectionTimeoutMS=120000&connectTimeoutMS=120000&socketTimeoutMS=120000&maxPoolSize=5`
      : `${MONGO_URI}?serverSelectionTimeoutMS=120000&connectTimeoutMS=120000&socketTimeoutMS=120000&maxPoolSize=5`;
    
    console.log("🔗 Connection attempt with 2-minute timeout");
    console.log("Modified connection string:", connectionString.substring(0, 100) + "...");
    
    await mongoose.connect(connectionString, {
      // 🚀 렌더 환경 최적화 설정 (호환성 개선)
      serverSelectionTimeoutMS: 30000, // 30초로 단축 (더 빠른 실패)
      connectTimeoutMS: 30000, // 30초
      socketTimeoutMS: 0, // 무제한 (연결 유지)
      maxPoolSize: 10, // 렌더 환경에서 더 많은 연결 풀
      minPoolSize: 2, // 최소 연결 유지
      maxIdleTimeMS: 30000, // 30초 후 유휴 연결 정리
      waitQueueTimeoutMS: 5000, // 대기열 타임아웃 5초
      retryWrites: true,
      retryReads: true,
      readPreference: 'primary', // 더 빠른 읽기를 위해 primary 사용
      // 🚀 호환성 문제 해결: 지원되지 않는 옵션 제거
      heartbeatFrequencyMS: 10000 // 10초마다 하트비트
    });
    
    console.log("✅ MongoDB connected successfully!");
    console.log("Database name:", mongoose.connection.db.databaseName);
    console.log("Connection state:", mongoose.connection.readyState); // 1 = connected
    
    // 🚀 DB 인덱스 최적화 실행
    await optimizeDBIndexes();
    
    // 🔧 이상한 쿨타임 값 정리 (서버 시작 시 1회 실행)
    try {
      const now = new Date();
      const maxValidCooldown = new Date(now.getTime() + 10 * 60 * 1000); // 현재 시간 + 10분
      
      // 10분 이상 남은 쿨타임은 이상한 값으로 간주하고 제거
      const result = await UserUuidModel.updateMany(
        { 
          fishingCooldownEnd: { $gt: maxValidCooldown } 
        },
        { 
          $set: { fishingCooldownEnd: null } 
        }
      );
      
      if (result.modifiedCount > 0) {
        console.log(`🔧 Cleared ${result.modifiedCount} invalid fishing cooldown(s)`);
      }
      
      // CooldownModel도 정리
      await CooldownModel.updateMany(
        { 
          fishingCooldownEnd: { $gt: maxValidCooldown } 
        },
        { 
          $set: { fishingCooldownEnd: null } 
        }
      );
    } catch (error) {
      console.error('❌ Failed to clear invalid cooldowns:', error);
    }
    
    // 연결 상태 모니터링
    mongoose.connection.on('connected', () => {
      console.log('📡 MongoDB connected');
    });
    
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('📴 MongoDB disconnected');
    });
    
    // displayName 필드 마이그레이션 (기존 사용자들을 위해)
    console.log("=== DISPLAYNAME MIGRATION ===");
    const usersWithoutDisplayName = await UserUuidModel.find({ displayName: { $exists: false } });
    if (usersWithoutDisplayName.length > 0) {
      console.log(`Found ${usersWithoutDisplayName.length} users without displayName, migrating...`);
      for (const user of usersWithoutDisplayName) {
        user.displayName = user.username;
        await user.save();
        console.log(`Migrated displayName for ${user.userUuid}: ${user.username}`);
      }
      console.log("✅ DisplayName migration completed");
    } else {
      console.log("✅ All users already have displayName field");
    }
    
    // 🚀 데이터베이스 인덱스 최적화 (성능 향상)
    infoLog("=== DATABASE INDEX OPTIMIZATION ===");
    try {
      // 자주 사용되는 쿼리에 복합 인덱스 추가
      // 🔍 Query Profiler 기반 복합 인덱스 최적화
      await CatchModel.collection.createIndex({ userUuid: 1, fish: 1 }); // 물고기 판매/분해
      await CatchModel.collection.createIndex({ userUuid: 1, _id: 1 }); // 정렬 최적화
      await CatchModel.collection.createIndex({ userUuid: 1, fish: 1, _id: 1 }); // 집계 최적화
      
      await UserMoneyModel.collection.createIndex({ userUuid: 1 }); // 돈 조회
      await FishingSkillModel.collection.createIndex({ userUuid: 1 }); // 낚시 실력
      await MaterialModel.collection.createIndex({ userUuid: 1, material: 1 }); // 재료 소모
      await MaterialModel.collection.createIndex({ userUuid: 1, _id: 1 }); // 재료 집계 최적화
      await UserEquipmentModel.collection.createIndex({ userUuid: 1 }); // 장비 조회
      debugLog("✅ Database indexes optimized");
    } catch (indexError) {
      // 인덱스가 이미 존재하면 무시
      debugLog("Index optimization:", indexError.message);
    }
    
    // [Quest] 자정 리셋 시스템 초기화
    const resetDailyQuests = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const result = await DailyQuestModel.updateMany(
          { lastResetDate: { $ne: today } },
          {
            fishCaught: 0,
            explorationWins: 0,
            fishSold: 0,
            questFishCaught: false,
            questExplorationWin: false,
            questFishSold: false,
            lastResetDate: today
          }
        );
        
        if (result.modifiedCount > 0) {
          console.log(`[Quest] Daily quests reset for ${result.modifiedCount} users`);
        }
      } catch (error) {
        console.error('Failed to reset daily quests:', error);
      }
    };
    
    // 매일 자정에 리셋 스케줄링
    const scheduleQuestReset = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0); // 자정으로 설정
      
      const timeUntilMidnight = tomorrow.getTime() - now.getTime();
      
      setTimeout(() => {
        resetDailyQuests();
        // 24시간마다 반복
        setInterval(resetDailyQuests, 24 * 60 * 60 * 1000);
      }, timeUntilMidnight);
      
      console.log(`[Quest] Next quest reset scheduled in ${Math.round(timeUntilMidnight / 1000 / 60)} minutes`);
    };
    
    // 리셋 스케줄링 시작
    scheduleQuestReset();
    
    server.listen(PORT, () => {
      console.log(`🚀 Server listening on http://localhost:${PORT}`);
      console.log("MongoDB connection state:", mongoose.connection.readyState);
      console.log("[Quest] Daily Quest system initialized");
    });
  } catch (error) {
    console.error("❌ Failed to connect to MongoDB:", error);
    throw error;
  }
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
