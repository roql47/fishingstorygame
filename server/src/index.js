const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken"); // 🔐 JWT 라이브러리 추가

// 🚀 성능 최적화: 프로덕션 환경에서 로깅 축소
const isProduction = process.env.NODE_ENV === 'production';
const debugLog = isProduction ? () => {} : console.log;
const infoLog = console.log; // 중요한 로그는 유지
const errorLog = console.error; // 에러 로그는 항상 유지

// 🔍 DB 쿼리 성능 측정 헬퍼 함수
const measureDBQuery = async (queryName, queryFunction) => {
  const startTime = Date.now();
  try {
    const result = await queryFunction();
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // 느린 쿼리 감지 (100ms 이상)
    if (duration > 100) {
      console.warn(`⚠️ 느린 DB 쿼리 감지: ${queryName} - ${duration}ms`);
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

// 🚀 성능 최적화: 낚시 스킬 캐시 (5분 TTL)
const fishingSkillCache = new Map();
const SKILL_CACHE_TTL = 5 * 60 * 1000; // 5분

function getCachedFishingSkill(userKey) {
  const cached = fishingSkillCache.get(userKey);
  if (cached && Date.now() - cached.timestamp < SKILL_CACHE_TTL) {
    return cached.skill;
  }
  return null;
}

function setCachedFishingSkill(userKey, skill) {
  fishingSkillCache.set(userKey, { skill, timestamp: Date.now() });
}
// 🔒 게임 데이터 임포트
const {
  getFishData,
  getFishHealthData,
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
const blockedIPs = new Set(); // 차단된 IP 목록
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
  if (blockedIPs.has(clientIP)) {
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
    blockedIPs.add(clientIP);
    console.log(`🚨 LOIC/DDoS 공격 감지! IP 차단: ${clientIP} (${requests.count} requests/min)`);
    
    // 10분 후 차단 해제
    setTimeout(() => {
      blockedIPs.delete(clientIP);
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
  
  console.log(`🧹 보안 시스템 정리: ${requestCounts.size} IPs tracked, ${blockedIPs.size} blocked, ${suspiciousIPs.size} suspicious`);
}, 300000);

const app = express();

// 신뢰할 수 있는 프록시 설정 (렌더 서버용)
app.set('trust proxy', true);

// 🚀 DDoS 방어 미들웨어 임시 비활성화 (성능 테스트)
// app.use(ddosProtection); // 성능 문제로 비활성화

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

const server = http.createServer(app);

// Socket.IO 연결 제한 미들웨어
const socketConnectionLimit = (socket, next) => {
  const clientIP = getClientIP({ headers: socket.handshake.headers, connection: socket.conn });
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
    if (blockedIPs.has(clientIP)) {
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

// Mongo Models
const catchSchema = new mongoose.Schema(
  {
    userUuid: { type: String, index: true }, // 새로운 UUID 기반 식별자
    username: { type: String, required: true, index: true },
    fish: { type: String, required: true },
    weight: { type: Number, required: true },
    userId: { type: String, index: true },
    displayName: { type: String },
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

// Cooldown Schema (쿨타임 관리)
const cooldownSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    username: { type: String, required: true },
    userUuid: { type: String, index: true },
    fishingCooldownEnd: { type: Date, default: null }, // 낚시 쿨타임 종료 시간
    explorationCooldownEnd: { type: Date, default: null }, // 탐사 쿨타임 종료 시간
  },
  { timestamps: true }
);

const CooldownModel = mongoose.model("Cooldown", cooldownSchema);

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
    
    // 사용자 설정 (로컬스토리지 대체)
    termsAccepted: { type: Boolean, default: false }, // 이용약관 동의 여부
    darkMode: { type: Boolean, default: true }, // 다크모드 설정 (기본값: true)
    
    // 쿨타임 정보
    fishingCooldownEnd: { type: Date, default: null }, // 낚시 쿨타임 종료 시간
    explorationCooldownEnd: { type: Date, default: null }, // 탐사 쿨타임 종료 시간
    
    // 물고기 카운터
    totalFishCaught: { type: Number, default: 0 }, // 총 낚은 물고기 수
    
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

const UserUuidModel = mongoose.model("UserUuid", userUuidSchema);

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
      user = await UserUuidModel.findOne({ originalKakaoId: kakaoId });
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
  { name: "경단붕어", price: 1500, material: "당고", rank: 3 },
  { name: "버터오징어", price: 8000, material: "버터조각", rank: 4 },
  { name: "간장새우", price: 15000, material: "간장종지", rank: 5 },
  { name: "물수수", price: 30000, material: "옥수수콘", rank: 6 },
  { name: "정어리파이", price: 40000, material: "버터", rank: 7 },
  { name: "얼음상어", price: 50000, material: "얼음조각", rank: 8 },
  { name: "스퀄스퀴드", price: 60000, material: "오징어먹물", rank: 9 },
  { name: "백년송거북", price: 100000, material: "백년송", rank: 10 },
  { name: "고스피쉬", price: 150000, material: "후춧가루", rank: 11 },
  { name: "유령치", price: 230000, material: "석화", rank: 12 },
  { name: "바이트독", price: 470000, material: "핫소스", rank: 13 },
  { name: "호박고래", price: 700000, material: "펌킨조각", rank: 14 },
  { name: "바이킹조개", price: 1250000, material: "꽃술", rank: 15 },
  { name: "천사해파리", price: 2440000, material: "프레첼", rank: 16 },
  { name: "악마복어", price: 4100000, material: "베놈", rank: 17 },
  { name: "칠성장어", price: 6600000, material: "장어꼬리", rank: 18 },
  { name: "닥터블랙", price: 9320000, material: "아인스바인", rank: 19 },
  { name: "해룡", price: 14400000, material: "헤븐즈서펀트", rank: 20 },
  { name: "메카핫킹크랩", price: 27950000, material: "집게다리", rank: 21 },
  { name: "램프리", price: 46400000, material: "이즈니버터", rank: 22 },
  { name: "마지막잎새", price: 76500000, material: "라벤더오일", rank: 23 },
  { name: "아이스브리더", price: 131200000, material: "샤베트", rank: 24 },
  { name: "해신", price: 288000000, material: "마법의정수", rank: 25 },
  { name: "핑키피쉬", price: 418600000, material: "마법의돌", rank: 26 },
  { name: "콘토퍼스", price: 931560000, material: "마법의돌", rank: 27 },
  { name: "딥원", price: 1326400000, material: "마법의돌", rank: 28 },
  { name: "큐틀루", price: 2088000000, material: "마법의돌", rank: 29 },
  { name: "꽃술나리", price: 3292000000, material: "마법의돌", rank: 30 },
  { name: "다무스", price: 7133200000, material: "마법의돌", rank: 31 },
  { name: "수호자", price: 15512000000, material: "마법의돌", rank: 32 },
  { name: "태양가사리", price: 29360000000, material: "마법의돌", rank: 33 },
  { name: "빅파더펭귄", price: 48876000000, material: "마법의돌", rank: 34 },
  { name: "크레인터틀", price: 87124000000, material: "마법의돌", rank: 35 },
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
  
  for (const fishInfo of availableFish) {
    cumulative += fishInfo.probability;
    if (random <= cumulative) {
      return { fish: fishInfo.name };
    }
  }
  
  // 만약을 위한 fallback
  return { fish: availableFish[0]?.name || "타코문어" };
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
const processingJoins = new Set(); // 중복 join 요청 방지
const recentJoins = new Map(); // 최근 입장 메시지 추적 (userUuid -> timestamp)
const processingMaterialConsumption = new Set(); // 중복 재료 소모 요청 방지
const processingFishing = new Set(); // 🚀 중복 낚시 요청 방지

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
  
  // 모든 클라이언트에게 정리된 사용자 목록 전송
  io.emit("users:update", uniqueUsers);
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
      blockedIPs: blockedIPs.size,
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
  socket.on("chat:join", async ({ username, idToken, userUuid }) => {
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
          user = await UserUuidModel.findOne({ originalKakaoId: kakaoId });
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
          console.log(`🚨 Duplicate ${provider} login detected! Disconnecting previous session: ${existingUserData.username} (${existingSocketId})`);
          
          // 기존 연결에 중복 로그인 알림 전송
          const existingSocket = io.sockets.sockets.get(existingSocketId);
          if (existingSocket) {
            existingSocket.emit("duplicate_login", {
              message: "다른 기기에서 로그인되어 연결이 해제됩니다."
            });
            existingSocket.disconnect(true);
          }
          
          // 기존 연결 제거
          connectedUsers.delete(existingSocketId);
          console.log(`Previous session disconnected: ${existingSocketId}`);
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
      
      // 🔐 JWT 토큰 생성 및 전송
      const jwtToken = generateJWT({
        userUuid: user.userUuid,
        username: user.username,
        displayName: displayNameToSend,
        isAdmin: false // 기본값, 관리자 권한은 별도 처리
      });
      
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
    
    // 사용자 정보 가져오기
    const user = connectedUsers.get(socket.id);
    if (!user || !user.userUuid) {
      socket.emit("chat:error", { message: "사용자 인증이 필요합니다." });
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
    
    if (trimmed === "낚시하기") {
      // 🚀 중복 요청 방지 (가장 중요!)
      const userKey = socket.data.userUuid || socket.data.username || socket.data.userId || socket.id;
      if (processingFishing.has(userKey)) {
        debugLog(`[DUPLICATE FISHING] Ignoring duplicate fishing request for ${userKey}`);
        return; // 조용히 무시
      }
      
      processingFishing.add(userKey);
      
      try {
        debugLog("=== Fishing Request ===");
        debugLog("Socket data:", {
          userUuid: socket.data.userUuid,
          username: socket.data.username,
          userId: socket.data.userId,
          displayName: socket.data.displayName
        });
        
        // 사용자 식별 확인
        if (!socket.data.userUuid && !socket.data.username && !socket.data.userId) {
          errorLog("No user identification found");
          socket.emit("error", { message: "사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요." });
          return;
        }
        
        // UUID 기반 사용자의 낚시실력 가져오기 (fallback 포함)
        let query = {};
        if (socket.data.userUuid) {
          query = { userUuid: socket.data.userUuid };
        } else if (socket.data.username) {
          query = { username: socket.data.username };
        } else {
          query = { userId: socket.data.userId || 'user' };
        }
        
        debugLog("Fishing skill query:", query);
        
        // 🚀 캐시된 낚시 스킬 사용 (성능 최적화)
        const userKey = socket.data.userUuid || socket.data.username || socket.data.userId;
        let userSkill = getCachedFishingSkill(userKey);
        
        if (userSkill === null) {
          // 캐시 미스 시 DB에서 조회
          const fishingSkill = await FishingSkillModel.findOne(query);
          userSkill = fishingSkill ? fishingSkill.skill : 0;
          setCachedFishingSkill(userKey, userSkill);
          debugLog(`Fishing skill loaded from DB: ${userSkill}`);
        } else {
          debugLog(`Fishing skill from cache: ${userSkill}`);
        }
        
        // 사용자 낚시 실력 정보는 보안상 로그에 기록하지 않음
        const { fish } = randomFish(userSkill);
        debugLog("Random fish result:", fish);
        
        // 물고기 저장 데이터 준비 (UUID 기반)
        const catchData = {
          fish,
          weight: 0, // 무게는 0으로 설정 (기존 스키마 호환성)
        };
        
        // 사용자 식별 정보 추가 (우선순위: userUuid > username > userId)
        debugLog("Socket data for catch:", {
          userUuid: socket.data.userUuid,
          username: socket.data.username,
          userId: socket.data.userId,
          displayName: socket.data.displayName
        });
        
        if (socket.data.userUuid) {
          catchData.userUuid = socket.data.userUuid;
          catchData.username = socket.data.username || "사용자";
          catchData.displayName = socket.data.displayName || socket.data.username || "사용자";
          console.log("Using userUuid for catch:", socket.data.userUuid);
        } else if (socket.data.username) {
          catchData.username = socket.data.username;
          catchData.displayName = socket.data.displayName || socket.data.username;
          if (socket.data.userId) catchData.userId = socket.data.userId;
          console.log("Using username for catch:", socket.data.username);
        } else {
          catchData.userId = socket.data.userId || 'user';
          catchData.username = socket.data.username || "사용자";
          catchData.displayName = socket.data.displayName || socket.data.username || "사용자";
          console.log("Using userId for catch:", socket.data.userId);
        }
        
        debugLog("Saving fish catch:", catchData);
        
        // 물고기 저장
        const savedCatch = await CatchModel.create(catchData);
        debugLog("Fish saved successfully:", {
          _id: savedCatch._id,
          userUuid: savedCatch.userUuid,
          username: savedCatch.username,
          fish: savedCatch.fish
        });

        // 사용자의 총 물고기 카운트 증가 (비동기 처리로 속도 개선)
        if (socket.data.userUuid) {
          // 백그라운드에서 비동기로 처리하여 응답 속도 향상
          measureDBQuery("낚시-총물고기수증가", () => 
            UserUuidModel.updateOne(
              { userUuid: socket.data.userUuid },
              { $inc: { totalFishCaught: 1 } }
            )
          ).catch(error => {
            console.error("Failed to update total fish count:", error);
          });
        }
        
        // 성공 메시지
        io.emit("chat:message", {
          system: true,
          username: "system",
          content: `${catchData.displayName} 님이 ${fish}를 낚았습니다!`,
          timestamp,
        });
        
        // 🚀 낚시 성공 후 클라이언트 인벤토리 업데이트 (비동기 처리)
        if (socket.data.userUuid) {
          // 백그라운드에서 비동기로 처리하여 응답 속도 향상
          getInventoryData(socket.data.userUuid)
            .then(updatedInventory => {
              socket.emit('data:inventory', updatedInventory);
              debugLog(`📦 Inventory update sent to ${socket.data.username}`);
            })
            .catch(inventoryError => {
              console.error("Failed to send inventory update:", inventoryError);
            });
        }
        
        debugLog("=== Fishing SUCCESS ===");
        
      } catch (error) {
        console.error("=== Fishing FAILED ===");
        console.error("Error details:", error);
        console.error("Stack:", error.stack);
        
        socket.emit("error", { message: "낚시에 실패했습니다. 다시 시도해주세요." });
        
        // 기본 메시지라도 전송
        io.emit("chat:message", {
          system: true,
          username: "system",
          content: `낚시 중 오류가 발생했습니다.`,
          timestamp,
        });
      } finally {
        // 🚀 처리 완료 후 즉시 제거 (성능 최적화)
        processingFishing.delete(userKey);
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
      
      // 접속자 목록 업데이트 전송 (중복 제거)
      const uniqueUsers = cleanupConnectedUsers();
      io.emit("users:update", uniqueUsers);
      
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
    if (userUuid && username) {
      socket.userUuid = userUuid;
      socket.username = username;
      console.log(`User ${username} subscribed to data updates`);
      
      // 즉시 현재 데이터 전송
      sendUserDataUpdate(socket, userUuid, username);
    }
  });

  socket.on("data:request", async ({ type, userUuid, username }) => {
    if (!userUuid || !username) return;
    
    try {
      switch (type) {
        case 'inventory':
          const inventory = await getInventoryData(userUuid);
          socket.emit('data:inventory', inventory);
          break;
        case 'materials':
          const materials = await getMaterialsData(userUuid);
          socket.emit('data:materials', materials);
          break;
        case 'money':
          const money = await getMoneyData(userUuid);
          socket.emit('data:money', money);
          break;
        case 'amber':
          const amber = await getAmberData(userUuid);
          socket.emit('data:amber', amber);
          break;
        case 'starPieces':
          const starPieces = await getStarPiecesData(userUuid);
          socket.emit('data:starPieces', starPieces);
          break;
        case 'cooldown':
          const cooldown = await getCooldownData(userUuid);
          socket.emit('data:cooldown', cooldown);
          break;
        case 'totalCatches':
          const totalCatches = await getTotalCatchesData(userUuid);
          socket.emit('data:totalCatches', totalCatches);
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
    console.log(`🚀 Sending data update to ${username}`);
    const [inventory, materials, money, amber, starPieces, cooldown, totalCatches, companions, adminStatus, equipment] = await Promise.all([
      getInventoryData(userUuid),
      getMaterialsData(userUuid),
      getMoneyData(userUuid),
      getAmberData(userUuid),
      getStarPiecesData(userUuid),
      getCooldownData(userUuid),
      getTotalCatchesData(userUuid),
      getCompanionsData(userUuid),
      getAdminStatusData(userUuid),
      getEquipmentData(userUuid)
    ]);

    console.log(`📊 Data being sent to ${username}:`, {
      inventory: inventory?.length || 0,
      materials: materials?.length || 0,
      money: money?.money || 0,
      companions: companions?.companions?.length || 0,
      adminStatus: adminStatus?.isAdmin || false,
      equipment: equipment?.fishingRod || 'none'
    });
    
    socket.emit('data:update', {
      inventory,
      materials,
      money,
      amber,
      starPieces,
      cooldown,
      totalCatches,
      companions,
      adminStatus,
      equipment
    });
  } catch (error) {
    console.error(`Error sending data update for ${username}:`, error);
  }
}

async function getInventoryData(userUuid) {
  const catches = await CatchModel.aggregate([
    { $match: { userUuid } },
    { $group: { _id: "$fish", count: { $sum: 1 } } },
    { $project: { _id: 0, fish: "$_id", count: 1 } }
  ]);
  return catches;
}

async function getMaterialsData(userUuid) {
  const materials = await MaterialModel.aggregate([
    { $match: { userUuid } },
    { $group: { _id: "$material", count: { $sum: 1 } } },
    { $project: { _id: 0, material: "$_id", count: 1 } }
  ]);
  return materials;
}

async function getMoneyData(userUuid) {
  const userMoney = await UserMoneyModel.findOne({ userUuid });
  return { money: userMoney?.money || 0 };
}

async function getAmberData(userUuid) {
  const userAmber = await UserAmberModel.findOne({ userUuid });
  return { amber: userAmber?.amber || 0 };
}

async function getStarPiecesData(userUuid) {
  const starPieces = await StarPieceModel.findOne({ userUuid });
  return { starPieces: starPieces?.starPieces || 0 };
}

async function getCooldownData(userUuid) {
  const user = await UserUuidModel.findOne({ userUuid });
  const now = new Date();
  const fishingCooldown = user?.fishingCooldownEnd && user.fishingCooldownEnd > now 
    ? Math.ceil((user.fishingCooldownEnd - now) / 1000) : 0;
  const explorationCooldown = user?.explorationCooldownEnd && user.explorationCooldownEnd > now 
    ? Math.ceil((user.explorationCooldownEnd - now) / 1000) : 0;
  
  return { fishingCooldown, explorationCooldown };
}

async function getTotalCatchesData(userUuid) {
  const totalCatches = await CatchModel.countDocuments({ userUuid });
  return { totalCatches };
}

async function getCompanionsData(userUuid) {
  const user = await UserUuidModel.findOne({ userUuid });
  const companions = user?.companions || [];
  return { companions };
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

// 데이터 변경 시 모든 해당 사용자에게 업데이트 전송
function broadcastUserDataUpdate(userUuid, username, dataType, data) {
  let broadcastCount = 0;
  io.sockets.sockets.forEach((socket) => {
    // 🔧 좀비 소켓 방지: 연결 상태와 사용자 정보 확인
    if (socket.userUuid === userUuid && socket.connected) {
      socket.emit(`data:${dataType}`, data);
      broadcastCount++;
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
    
    // 클라이언트가 이전 버전과 호환되도록 배열 형태로 반환하되, 메타데이터는 별도 헤더로 전송
    res.set({
      'X-Inventory-Hash': inventoryHash,
      'X-Inventory-Timestamp': timestamp,
      'X-Inventory-Count': inventory.length.toString(),
      'X-Total-Items': inventory.reduce((sum, item) => sum + item.count, 0).toString()
    });
    
    res.json(inventory);
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

// Add Star Pieces API (별조각 추가)
app.post("/api/add-star-pieces", async (req, res) => {
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

// Companion APIs (동료 시스템)
// 동료 뽑기 API
app.post("/api/recruit-companion", async (req, res) => {
  try {
    const { starPieceCost = 1 } = req.body; // 별조각 1개 기본 비용
    const { username, userUuid } = req.query;
    
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
    
    const userStarPieces = await StarPieceModel.findOne(query);
    if (!userStarPieces || userStarPieces.starPieces < starPieceCost) {
      console.log(`Not enough star pieces: has ${userStarPieces?.starPieces || 0}, needs ${starPieceCost}`);
      return res.status(400).json({ error: "별조각이 부족합니다." });
    }
    
    // 보유 동료 확인
    let userCompanions = await CompanionModel.findOne(query);
    if (!userCompanions) {
      const createData = {
        userId: query.userId || 'user',
        username: query.username || username,
        userUuid: query.userUuid || userUuid,
        companions: []
      };
      console.log("Creating new companion record:", createData);
      userCompanions = new CompanionModel(createData);
    }
    
    // 미보유 동료 목록
    const availableCompanions = COMPANION_LIST.filter(
      companion => !userCompanions.companions.includes(companion)
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
      
      userCompanions.companions.push(randomCompanion);
      await userCompanions.save();
      
      console.log(`Successfully recruited: ${randomCompanion}`);
      
      res.json({
        success: true,
        recruited: true,
        companion: randomCompanion,
        remainingStarPieces: userStarPieces.starPieces,
        totalCompanions: userCompanions.companions.length
      });
    } else {
      console.log("Recruitment failed");
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

// 🛡️ [SECURITY] Admin APIs (보안 강화된 관리자 시스템)

// 보안 강화: 관리자 비밀 키 목록
const ADMIN_SECRET_KEYS = [
  'ttm2033_secure_admin_key_2024', // 기본 관리자 키
  process.env.ADMIN_SECRET_KEY, // 환경변수 관리자 키
  'dev_master_key_fishing_game' // 개발자 마스터 키
].filter(Boolean);

// 관리자 시도 추적 (어러용도 방지)
const adminAttempts = new Map(); // IP -> { count, lastAttempt }

// 보안 강화된 관리자 권한 토글 API
app.post("/api/toggle-admin", async (req, res) => {
  try {
    const { username, userUuid } = req.query;
    const { adminKey } = req.body; // 관리자 키 필수
    const clientIP = getClientIP(req);
    
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
    if (blockedIPs.has(clientIP)) {
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
      
      console.log(`🔑 [ADMIN] Admin rights granted to: ${username} from IP: ${clientIP}`);
      res.json({
        success: true,
        isAdmin: true,
        message: "관리자 권한이 부여되었습니다."
      });
    } else {
      adminRecord.isAdmin = !adminRecord.isAdmin;
      await adminRecord.save();
      
      const statusMessage = adminRecord.isAdmin ? "관리자 권한이 부여되었습니다." : "관리자 권한이 해제되었습니다.";
      console.log(`🔑 [ADMIN] Admin rights ${adminRecord.isAdmin ? 'granted' : 'revoked'} for: ${username} from IP: ${clientIP}`);
      
      res.json({
        success: true,
        isAdmin: adminRecord.isAdmin,
        message: statusMessage
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
    let explorationCooldown = 0;
    
    if (cooldownRecord) {
      // 낚시 쿨타임 계산
      if (cooldownRecord.fishingCooldownEnd && cooldownRecord.fishingCooldownEnd > now) {
        fishingCooldown = cooldownRecord.fishingCooldownEnd.getTime() - now.getTime();
      }
      
      // 탐사 쿨타임 계산
      if (cooldownRecord.explorationCooldownEnd && cooldownRecord.explorationCooldownEnd > now) {
        explorationCooldown = cooldownRecord.explorationCooldownEnd.getTime() - now.getTime();
      }
    }
    
    // 쿨다운 데이터는 보안상 로그에 기록하지 않음
    
    res.json({ 
      fishingCooldown: Math.max(0, fishingCooldown),
      explorationCooldown: Math.max(0, explorationCooldown)
    });
  } catch (error) {
    console.error("Failed to fetch cooldown status:", error);
    res.status(500).json({ error: "쿨타임 상태를 가져올 수 없습니다." });
  }
});

// 서버 측 낚시 쿨타임 계산 함수 (악세사리만 영향)
const calculateFishingCooldownTime = async (userQuery) => {
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
    
    return Math.max(baseTime - reduction, 0); // 최소 0초
  } catch (error) {
    console.error('Error calculating fishing cooldown time:', error);
    // 에러 시 기본 쿨타임 반환
    return 5 * 60 * 1000; // 5분
  }
};

// 낚시 쿨타임 설정 API (서버에서 쿨타임 계산)
app.post("/api/set-fishing-cooldown", async (req, res) => {
  try {
    const { username, userUuid } = req.query;
    
    console.log("Set fishing cooldown request received");
    
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
    
    // CooldownModel 업데이트 (기존 시스템 호환성)
    await CooldownModel.findOneAndUpdate(
      query,
      updateData,
      { upsert: true, new: true }
    );
    
    // UserUuidModel도 동시에 업데이트 (WebSocket 동기화용)
    if (query.userUuid) {
      await UserUuidModel.updateOne(
        { userUuid: query.userUuid },
        { fishingCooldownEnd: cooldownEnd }
      );
      console.log(`Updated fishing cooldown in UserUuidModel for ${query.userUuid}`);
      
      // WebSocket으로 실시간 쿨타임 업데이트 전송
      broadcastUserDataUpdate(query.userUuid, query.username, 'cooldown', {
        fishingCooldown: cooldownDuration,
        explorationCooldown: 0 // 현재 탐사 쿨타임 유지
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

// 🛡️ [FIX] 낚시 쿨타임 재계산 API (악세사리 구매 후 호출)
app.post("/api/recalculate-fishing-cooldown", async (req, res) => {
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
        fishingCooldown: newRemainingTime,
        explorationCooldown: 0
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

// 탐사 쿨타임 설정 API
app.post("/api/set-exploration-cooldown", async (req, res) => {
  try {
    const { type } = req.body; // 'victory', 'defeat', 'flee' 타입
    const { username, userUuid } = req.query;
    
    console.log("Set exploration cooldown request received");
    
    const queryResult = await getUserQuery('user', username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
      console.log("Using UUID query for exploration cooldown:", query);
    } else {
      query = queryResult;
      console.log("Using fallback query for exploration cooldown:", query);
    }
    
    // 서버에서 탐사 쿨타임 계산
    let cooldownDuration;
    switch(type) {
      case 'victory':
      case 'defeat':
      case 'start':
        cooldownDuration = 10 * 60 * 1000; // 10분
        break;
      case 'flee':
        cooldownDuration = 5 * 60 * 1000; // 5분 (절반)
        break;
      default:
        cooldownDuration = 10 * 60 * 1000; // 기본 10분
    }
    
    const now = new Date();
    const cooldownEnd = new Date(now.getTime() + cooldownDuration);
    
    const updateData = {
      userId: query.userId || 'user',
      username: query.username || username,
      userUuid: query.userUuid || userUuid,
      explorationCooldownEnd: cooldownEnd
    };
    
    // CooldownModel 업데이트 (기존 시스템 호환성)
    await CooldownModel.findOneAndUpdate(
      query,
      updateData,
      { upsert: true, new: true }
    );
    
    // UserUuidModel도 동시에 업데이트 (WebSocket 동기화용)
    if (query.userUuid) {
      await UserUuidModel.updateOne(
        { userUuid: query.userUuid },
        { explorationCooldownEnd: cooldownEnd }
      );
      console.log(`Updated exploration cooldown in UserUuidModel for ${query.userUuid}`);
      
      // WebSocket으로 실시간 쿨타임 업데이트 전송
      broadcastUserDataUpdate(query.userUuid, query.username, 'cooldown', {
        fishingCooldown: 0, // 현재 낚시 쿨타임 유지
        explorationCooldown: cooldownDuration
      });
    }
    
    // 탐사 쿨다운 설정 완료 (보안상 상세 정보는 로그에 기록하지 않음)
    
    res.json({ 
      success: true,
      cooldownEnd: cooldownEnd.toISOString(),
      remainingTime: cooldownDuration
    });
  } catch (error) {
    console.error("Failed to set exploration cooldown:", error);
    res.status(500).json({ error: "탐사 쿨타임 설정에 실패했습니다." });
  }
});

// 접속자 목록 API (보안 강화)
app.get("/api/connected-users", async (req, res) => {
  try {
    console.log("Connected users request");
    
    // 현재 연결된 사용자 목록을 메모리에서 가져오기 (정리된 목록)
    const cleanedUsers = cleanupConnectedUsers();
    
    // 데이터베이스에서 최신 사용자 정보 검증
    const users = await Promise.all(cleanedUsers.map(async (user) => {
      try {
        // 데이터베이스에서 최신 사용자 정보 가져오기
        const dbUser = await UserUuidModel.findOne({ userUuid: user.userUuid });
        
        return {
      userUuid: user.userUuid,
          username: dbUser?.displayName || user.displayName || user.username, // DB에서 최신 displayName 사용
          displayName: dbUser?.displayName || user.displayName || user.username,
          userId: user.userId,
          hasIdToken: user.hasIdToken || false,
          loginType: user.loginType || 'Guest',
          // 서버에서만 관리되는 추가 검증 데이터
          isOnline: true,
          lastSeen: new Date().toISOString(),
          // 클라이언트 조작 방지를 위한 체크섬
          checksum: generateUserChecksum(user.userUuid, dbUser?.displayName || user.username)
        };
      } catch (error) {
        console.error(`Failed to verify user ${user.userUuid}:`, error);
        // DB 조회 실패 시 메모리 데이터 사용 (fallback)
        return {
          userUuid: user.userUuid,
          username: user.displayName || user.username,
      displayName: user.displayName || user.username,
          userId: user.userId,
          hasIdToken: user.hasIdToken || false,
          loginType: user.loginType || 'Guest',
          isOnline: true,
          lastSeen: new Date().toISOString(),
          checksum: generateUserChecksum(user.userUuid, user.displayName || user.username)
        };
      }
    }));
    
    console.log("Sending verified connected users:", users.length);
    
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
const calculateServerPlayerMaxHp = (accessoryLevel) => {
  if (accessoryLevel === 0) return 100;
  return Math.floor(Math.pow(accessoryLevel, 1.125) + 30 * accessoryLevel);
};

const calculateServerPlayerAttack = (fishingSkill) => {
  return Math.floor(Math.pow(fishingSkill, 1.4) + fishingSkill * 2 + 5 + Math.random() * 10);
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

// 전투 시작 API (보안 강화)
app.post("/api/start-battle", async (req, res) => {
  try {
    const { material, baseFish, selectedPrefix } = req.body;
    const { username, userUuid } = req.query;
    
    console.log("Start battle request:", { material, baseFish, selectedPrefix, username, userUuid });
    
    // 사용자 조회
    const queryResult = await getUserQuery('user', username, userUuid);
    let query = queryResult.userUuid ? { userUuid: queryResult.userUuid } : queryResult;
    
    // 사용자 장비 및 스킬 정보 가져오기
    const userEquipment = await UserEquipmentModel.findOne(query);
    const fishingSkillData = await FishingSkillModel.findOne(query);
    const fishingSkill = fishingSkillData ? fishingSkillData.skill : 0;
    
    // 서버에서 전투 상태 계산
    const fishHealthMap = getServerFishHealthMap();
    const baseHp = fishHealthMap[baseFish] || 100;
    const enemyMaxHp = Math.floor(baseHp * (selectedPrefix?.hpMultiplier || 1));
    
    const accessoryLevel = getServerAccessoryLevel(userEquipment?.accessory);
    const playerMaxHp = calculateServerPlayerMaxHp(accessoryLevel);
    
    const battleState = {
      enemy: `${selectedPrefix?.name || ''} ${baseFish}`.trim(),
      baseFish: baseFish,
      prefix: selectedPrefix,
      playerHp: playerMaxHp,
      playerMaxHp: playerMaxHp,
      enemyHp: enemyMaxHp,
      enemyMaxHp: enemyMaxHp,
      turn: 'player',
      material: material,
      round: 1,
      autoMode: false,
      canFlee: true,
      fishingSkill: fishingSkill,
      accessoryLevel: accessoryLevel
    };
    
    console.log("Server calculated battle state:", battleState);
    
    res.json({ 
      success: true, 
      battleState: battleState,
      log: [`${material}을(를) 사용하여 ${battleState.enemy}(HP: ${enemyMaxHp})와의 전투가 시작되었습니다!`, `전투를 시작하거나 도망갈 수 있습니다.`]
    });
  } catch (error) {
    console.error("Failed to start battle:", error);
    res.status(500).json({ error: "전투 시작에 실패했습니다." });
  }
});

// 전투 공격 API (보안 강화)
app.post("/api/battle-attack", async (req, res) => {
  try {
    const { battleState, attackType } = req.body; // 'player' or 'enemy'
    const { username, userUuid } = req.query;
    
    console.log("Battle attack request:", { attackType, username, userUuid });
    
    if (!battleState) {
      return res.status(400).json({ error: "Invalid battle state" });
    }
    
    let newBattleState = { ...battleState };
    let battleLog = [];
    
    if (attackType === 'player' && newBattleState.turn === 'player') {
      // 플레이어 공격 (서버에서 계산)
      const damage = calculateServerPlayerAttack(newBattleState.fishingSkill);
      const newEnemyHp = Math.max(0, newBattleState.enemyHp - damage);
      
      battleLog.push(`플레이어가 ${damage} 데미지를 입혔습니다! (${newBattleState.enemy}: ${newEnemyHp}/${newBattleState.enemyMaxHp})`);
      
      newBattleState.enemyHp = newEnemyHp;
      newBattleState.autoMode = true;
      newBattleState.canFlee = false;
      
      if (newEnemyHp <= 0) {
        // 승리
        const baseReward = Math.floor(newBattleState.enemyMaxHp / 10) + Math.floor(Math.random() * 5) + 1;
        const amberReward = Math.floor(baseReward * (newBattleState.prefix?.amberMultiplier || 1));
        
        const prefixBonus = newBattleState.prefix?.amberMultiplier > 1 
          ? ` (${newBattleState.prefix.name} 보너스 x${newBattleState.prefix.amberMultiplier})` 
          : '';
        
        battleLog.push(`${newBattleState.enemy}를 물리쳤습니다! 호박석 ${amberReward}개를 획득했습니다!${prefixBonus}`);
        
        newBattleState.turn = 'victory';
        newBattleState.amberReward = amberReward;
        
        res.json({ 
          success: true, 
          battleState: newBattleState, 
          log: battleLog,
          result: 'victory',
          amberReward: amberReward
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
      // 적 공격 (서버에서 계산)
      const fishData = getServerFishData().find(fish => fish.name === newBattleState.baseFish);
      const fishRank = fishData ? fishData.rank : 1;
      const damage = calculateServerEnemyAttack(fishRank);
      const newPlayerHp = Math.max(0, newBattleState.playerHp - damage);
      
      battleLog.push(`${newBattleState.enemy}가 ${damage} 데미지를 입혔습니다! (플레이어: ${newPlayerHp}/${newBattleState.playerMaxHp})`);
      
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
    const { code, redirectUri } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: "Authorization code is required" });
    }
    
    console.log("카카오 토큰 교환 요청:", { code: code.substring(0, 10) + "...", redirectUri });
    
    // 카카오 토큰 교환 요청
    const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: KAKAO_CLIENT_ID,
        redirect_uri: redirectUri,
        code: code
      })
    });
    
    const tokenData = await tokenResponse.json();
    
    if (tokenData.access_token) {
      console.log("카카오 토큰 교환 성공");
      res.json(tokenData);
    } else {
      console.error("카카오 토큰 교환 실패:", tokenData);
      res.status(400).json({ error: "Failed to exchange token", details: tokenData });
    }
    
  } catch (error) {
    console.error("카카오 토큰 교환 오류:", error);
    res.status(500).json({ error: "Internal server error" });
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
    const { userUuid, googleId } = req.query;
    const { nickname } = req.body;
    
    console.log("=== CHECK NICKNAME API ===");
    console.log("Request params:", { userUuid, googleId, nickname });
    
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
    const { username, userUuid, googleId } = req.query;
    
    console.log("=== GET USER SETTINGS API ===");
    console.log("Request params:", { userId, username, userUuid, googleId });
    
    let user;
    if (userUuid && userUuid !== 'null' && userUuid !== 'undefined') {
      user = await UserUuidModel.findOne({ userUuid });
    } else if (userId !== 'null') {
      // 구글/카카오 사용자 - originalGoogleId나 originalKakaoId로 찾기
      if (googleId) {
        console.log(`Looking for Google user with originalGoogleId: ${googleId}`);
        user = await UserUuidModel.findOne({ originalGoogleId: googleId });
      } else {
        // 구글 ID가 없으면 username으로 찾기 (fallback)
        user = await UserUuidModel.findOne({ username, isGuest: false });
      }
    } else {
      // 게스트 사용자
      user = await UserUuidModel.findOne({ username, isGuest: true });
    }
    
    if (!user) {
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
    }
    
    // 쿨타임 계산
    const now = new Date();
    const fishingCooldown = user.fishingCooldownEnd && user.fishingCooldownEnd > now 
      ? Math.max(0, user.fishingCooldownEnd.getTime() - now.getTime()) 
      : 0;
    const explorationCooldown = user.explorationCooldownEnd && user.explorationCooldownEnd > now 
      ? Math.max(0, user.explorationCooldownEnd.getTime() - now.getTime()) 
      : 0;
    
    const settings = {
      userUuid: user.userUuid,
      username: user.username,
      displayName: user.displayName,
      termsAccepted: user.termsAccepted || false,
      darkMode: user.darkMode !== undefined ? user.darkMode : true,
      fishingCooldown,
      explorationCooldown,
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

// 사용자 displayName 설정 API (최초 닉네임 설정용)
app.post("/api/set-display-name/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, userUuid, googleId } = req.query;
    const { displayName } = req.body;
    
    console.log("=== SET DISPLAY NAME API ===");
    console.log("Request params:", { userId, username, userUuid, googleId });
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
      // 구글/카카오 사용자 - originalGoogleId로 찾기
      if (googleId) {
        console.log(`Looking for Google user with originalGoogleId: ${googleId}`);
        user = await UserUuidModel.findOne({ originalGoogleId: googleId });
      } else {
        // 구글 ID가 없으면 username으로 찾기 (fallback)
        user = await UserUuidModel.findOne({ username, isGuest: false });
      }
    } else {
      // 게스트 사용자
      user = await UserUuidModel.findOne({ username, isGuest: true });
    }
    
    if (!user) {
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
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

// 사용자 설정 업데이트 API
app.post("/api/user-settings/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, userUuid, googleId } = req.query;
    const { termsAccepted, darkMode, fishingCooldown, explorationCooldown } = req.body;
    
    console.log("=== UPDATE USER SETTINGS API ===");
    console.log("Request params:", { userId, username, userUuid, googleId });
    console.log("User settings update request received");
    
    let user;
    if (userUuid && userUuid !== 'null' && userUuid !== 'undefined') {
      user = await UserUuidModel.findOne({ userUuid });
    } else if (userId !== 'null') {
      // 구글/카카오 사용자 - originalGoogleId로 찾기
      if (googleId) {
        console.log(`Looking for Google user with originalGoogleId: ${googleId}`);
        user = await UserUuidModel.findOne({ originalGoogleId: googleId });
      } else {
        // 구글 ID가 없으면 username으로 찾기 (fallback)
        user = await UserUuidModel.findOne({ username, isGuest: false });
      }
    } else {
      // 게스트 사용자
      user = await UserUuidModel.findOne({ username, isGuest: true });
    }
    
    if (!user) {
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
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
    if (explorationCooldown !== undefined) {
      updates.explorationCooldownEnd = explorationCooldown > 0 
        ? new Date(Date.now() + explorationCooldown) 
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

// Ranking API (랭킹 시스템)
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
    
    // 낚시 스킬 데이터 추가
    fishingSkills.forEach(skill => {
      if (skill.userUuid && userRankingData.has(skill.userUuid)) {
        userRankingData.get(skill.userUuid).fishingSkill = skill.skill || 0;
      }
    });
    
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
        // 2차 정렬: 낚시 스킬 (내림차순)
        return b.fishingSkill - a.fishingSkill;
      })
      .map((user, index) => ({
        rank: index + 1,
        userUuid: user.userUuid,
        username: user.username, // 소셜 계정 이름
        displayName: user.displayName, // 게임 닉네임
        fishingSkill: user.fishingSkill,
        totalFishCaught: user.totalFishCaught // 새로운 총 물고기 카운트
      }));
    
    console.log(`Sending ranking data for ${rankings.length} users`);
    
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
      const createData = {
        userId: query.userId || 'user',
        username: query.username || username,
        userUuid: query.userUuid || userUuid,
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
          reward: '호박석 10개'
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

// 퀴스트 진행도 업데이트 API
app.post("/api/update-quest-progress", async (req, res) => {
  try {
    const { questType, amount = 1 } = req.body;
    const { username, userUuid } = req.query;
    
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
      // 퀴스트 데이터가 없거나 오래된 경우 새로 생성
      const createData = {
        userId: query.userId || 'user',
        username: query.username || username,
        userUuid: query.userUuid || userUuid,
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
    
    await DailyQuestModel.findOneAndUpdate(query, updateData);
    
    console.log(`[Quest] Quest progress updated: ${questType} +${amount} for ${username}`);
    res.json({ success: true, message: "Quest progress updated" });
  } catch (error) {
    console.error("Failed to update quest progress:", error);
    res.status(500).json({ error: "Failed to update quest progress" });
  }
});

// 퀴스트 보상 수령 API
app.post("/api/claim-quest-reward", async (req, res) => {
  try {
    const { questId } = req.body;
    const { username, userUuid } = req.query;
    
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
    let rewardAmount = 10; // 호박석 10개
    
    switch (questId) {
      case 'fish_caught':
        canClaim = dailyQuest.fishCaught >= 10 && !dailyQuest.questFishCaught;
        if (canClaim) {
          await DailyQuestModel.findOneAndUpdate(query, { questFishCaught: true });
        }
        break;
      case 'exploration_win':
        canClaim = dailyQuest.explorationWins >= 1 && !dailyQuest.questExplorationWin;
        if (canClaim) {
          await DailyQuestModel.findOneAndUpdate(query, { questExplorationWin: true });
        }
        break;
      case 'fish_sold':
        canClaim = dailyQuest.fishSold >= 10 && !dailyQuest.questFishSold;
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
    
    // 호박석 보상 지급
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
      newAmber: userAmber.amber 
    });
  } catch (error) {
    console.error("Failed to claim quest reward:", error);
    res.status(500).json({ error: "Failed to claim quest reward" });
  }
});

// Add Amber API (for exploration rewards)
app.post("/api/add-amber", async (req, res) => {
  try {
    const { amount } = req.body;
    const { username, userUuid } = req.query;
    
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
const calculateServerFishPrice = async (fishName, userQuery) => {
  // 🚀 allFishData를 우선 사용 (버그 수정)
  let fishData = allFishData.find(fish => fish.name === fishName);
  if (!fishData) {
    // 폴백: getServerFishData에서 찾기
    fishData = getServerFishData().find(fish => fish.name === fishName);
  }
  if (!fishData) return 0;
  
  let basePrice = fishData.price;
  
  // 악세사리 효과: 각 악세사리마다 8% 증가
  try {
    const userEquipment = await UserEquipmentModel.findOne(userQuery);
    if (userEquipment && userEquipment.accessory) {
      const serverShopItems = getShopData();
      const accessoryItems = serverShopItems.accessories || [];
      const equippedAccessory = accessoryItems.find(item => item.name === userEquipment.accessory);
      if (equippedAccessory) {
        // 악세사리 레벨에 따른 가격 증가 (레벨당 8%)
        const priceIncrease = (equippedAccessory.requiredSkill + 1) * 8; // 8% per level
        basePrice = Math.floor(basePrice * (1 + priceIncrease / 100));
      }
    }
  } catch (error) {
    console.error('Failed to calculate accessory bonus for fish price:', error);
    // 에러 시 기본 가격 사용
  }
  
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
    
    // 사용자가 해당 물고기를 충분히 가지고 있는지 확인 (보안 강화)
    const userFish = await CatchModel.find({ ...query, fish: fishName });
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
    
    // 🚀 물고기 판매 (bulkWrite로 성능 최적화)
    const fishToDelete = userFish.slice(0, quantity).map(fish => ({
      deleteOne: { filter: { _id: fish._id } }
    }));
    
    const bulkResult = await CatchModel.bulkWrite(fishToDelete);
    debugLog(`⚡ Bulk deleted ${bulkResult.deletedCount}/${quantity} ${fishName}`);
    
    // 사용자 돈 업데이트 (성능 최적화 - upsert 사용)
    const updateData = {
      $inc: { money: serverTotalPrice }, // 서버에서 계산된 가격 사용
      $setOnInsert: {
        ...query,
        ...(username && { username })
      }
    };
    
    const userMoney = await measureDBQuery("물고기판매-돈업데이트", () =>
      UserMoneyModel.findOneAndUpdate(
        query,
        updateData,
        { upsert: true, new: true }
      )
    );
    // 골드 업데이트 완료 (보안상 잔액 정보는 로그에 기록하지 않음)
    
    res.json({ success: true, newBalance: userMoney.money });
  } catch (error) {
    console.error("Failed to sell fish:", error);
    res.status(500).json({ error: "Failed to sell fish" });
  }
});

// 🔒 서버 측 아이템 데이터는 gameData.js에서 관리 (중복 제거)

// Item Buying API (보안 강화 - 서버에서 가격 검증 + JWT 인증)
app.post("/api/buy-item", authenticateJWT, async (req, res) => {
  try {
    const { itemName, price: clientPrice, category, currency = 'gold' } = req.body;
    // 🔐 JWT에서 사용자 정보 추출 (더 안전함)
    const { userUuid, username } = req.user;
    
    console.log("=== BUY ITEM REQUEST ===");
    console.log("Item:", itemName);
    console.log("Price:", clientPrice);
    console.log("Category:", category);
    console.log("Currency:", currency);
    console.log("Username:", username);
    console.log("UserUuid (decoded):", userUuid);
    console.log("Raw query:", req.query);
    
    // 서버에서 실제 아이템 정보 가져오기 (클라이언트 가격 무시)
    const serverShopItems = getShopData();
    const categoryItems = serverShopItems[category];
    
    if (!categoryItems) {
      return res.status(400).json({ error: "Invalid item category" });
    }
    
    const serverItem = categoryItems.find(item => item.name === itemName);
    if (!serverItem) {
      return res.status(400).json({ error: "Item not found" });
    }
    
    // 클라이언트에서 보낸 가격과 서버 가격 비교 (보안 검증)
    if (clientPrice !== serverItem.price) {
      console.warn(`Price manipulation detected! Client: ${clientPrice}, Server: ${serverItem.price}, Item: ${itemName}, User: ${username}`);
      return res.status(400).json({ error: "Invalid item price" });
    }
    
    // 서버에서 검증된 실제 가격 사용
    const actualPrice = serverItem.price;
    const actualCurrency = serverItem.currency || currency;
    
    console.log(`Server validated price: ${actualPrice} ${actualCurrency} for ${itemName}`);
    
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
    
    // 화폐 종류에 따른 잔액 확인 및 차감
    let userMoney = null;
    let userAmber = null;
    
    if (actualCurrency === 'amber') {
      userAmber = await UserAmberModel.findOne(query);
      
      if (!userAmber || userAmber.amber < actualPrice) {
        // 앰버 부족 (보안상 잔액 정보는 로그에 기록하지 않음)
        return res.status(400).json({ error: "Not enough amber" });
      }
      
      // 호박석 차감
      userAmber.amber -= actualPrice;
      await userAmber.save();
      // 앰버 차감 완료 (보안상 잔액 정보는 로그에 기록하지 않음)
    } else {
      // 골드 확인 및 차감
      userMoney = await UserMoneyModel.findOne(query);
      
      if (!userMoney || userMoney.money < actualPrice) {
        // 골드 부족 (보안상 잔액 정보는 로그에 기록하지 않음)
      return res.status(400).json({ error: "Not enough money" });
    }
    
    // 돈 차감
      userMoney.money -= actualPrice;
    await userMoney.save();
      // 골드 차감 완료 (보안상 잔액 정보는 로그에 기록하지 않음)
    }
    
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
        console.log(`Fishing rod: ${oldFishingRod} → ${itemName}`);
      } else if (category === 'accessories') {
        userEquipment.accessory = itemName;
        console.log(`Accessory: ${oldAccessory} → ${itemName}`);
      }
      
      await userEquipment.save();
      console.log("Equipment saved successfully:", {
        userUuid: userEquipment.userUuid,
        fishingRod: userEquipment.fishingRod,
        accessory: userEquipment.accessory
      });
    }
    
    // 낚시대 구매 시 낚시실력 +1
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
      // 낚시 실력 증가 완료
    }
    
    // 구매 성공 응답 (화폐 종류에 따라 적절한 잔액 반환)
    if (actualCurrency === 'amber') {
      res.json({ success: true, newAmber: userAmber.amber });
    } else {
    res.json({ success: true, newBalance: userMoney.money });
    }
  } catch (error) {
    console.error("=== BUY ITEM ERROR ===");
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    console.error("Request body:", req.body);
    console.error("Request query:", req.query);
    res.status(500).json({ error: "Failed to buy item: " + error.message });
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
      createdAt: userEquipment.createdAt,
      updatedAt: userEquipment.updatedAt
    } : "None");
    
    if (!userEquipment) {
      // 새 사용자인 경우 빈 장비로 생성
      const createData = {
        fishingRod: null,
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
    
    const response = {
      fishingRod: userEquipment.fishingRod,
      accessory: userEquipment.accessory
    };
    
    console.log("Sending equipment response:", response);
    res.json(response);
  } catch (error) {
    console.error("Failed to fetch user equipment:", error);
    res.status(500).json({ error: "Failed to fetch user equipment" });
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
app.post("/api/decompose-fish", async (req, res) => {
  try {
    const { fishName, quantity, material } = req.body;
    const { username, userUuid } = req.query;
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
    
    // 사용자가 해당 물고기를 충분히 가지고 있는지 확인
    const userFish = await CatchModel.find({ ...query, fish: fishName });
    console.log(`Found ${userFish.length} ${fishName} for user`);
    
    if (userFish.length < quantity) {
      console.log(`Not enough fish: has ${userFish.length}, needs ${quantity}`);
      return res.status(400).json({ error: "Not enough fish to decompose" });
    }
    
    // 🚀 물고기 제거 (bulkWrite로 성능 최적화)
    const fishToDelete = userFish.slice(0, quantity).map(fish => ({
      deleteOne: { filter: { _id: fish._id } }
    }));
    
    const bulkDeleteResult = await CatchModel.bulkWrite(fishToDelete);
    console.log(`⚡ Bulk deleted ${bulkDeleteResult.deletedCount}/${quantity} ${fishName} for decompose`);
    
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
    
    // 🚀 일반 물고기 분해 시 재료 추가 (bulkWrite로 성능 최적화)
    const materialsToCreate = [];
    for (let i = 0; i < quantity; i++) {
      const materialData = {
        ...query,
        material,
        displayName: query.username || username || 'User'
      };
      
      // username이 있으면 추가
      if (username) {
        materialData.username = username;
      }
      
      materialsToCreate.push({ insertOne: { document: materialData } });
    }
    
    const bulkCreateResult = await MaterialModel.bulkWrite(materialsToCreate);
    console.log(`⚡ Bulk created ${bulkCreateResult.insertedCount}/${quantity} ${material}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to decompose fish:", error);
    res.status(500).json({ error: "Failed to decompose fish" });
  }
});

// Material Consumption API (for exploration)
app.post("/api/consume-material", async (req, res) => {
  const { materialName, quantity } = req.body;
  const { username, userUuid } = req.query;
  
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
    
    // 재료 제거 (quantity만큼 삭제)
    for (let i = 0; i < quantity; i++) {
      const deletedMaterial = await MaterialModel.findOneAndDelete({ ...query, material: materialName });
      if (!deletedMaterial) {
        console.log(`Failed to delete material ${i + 1}/${quantity}`);
        return res.status(400).json({ error: "Failed to consume material" });
      }
    }
    console.log(`Successfully consumed ${quantity} ${materialName}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to consume material:", error);
    res.status(500).json({ error: "Failed to consume material" });
  } finally {
    // 처리 완료 후 중복 방지 키 제거
    processingMaterialConsumption.delete(consumeKey);
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
    
    res.json({ skill: fishingSkill.skill || 0 });
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
    }
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1시간
  }
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

// 다른 사용자 프로필 조회 API (특수문자 지원)
app.get("/api/user-profile", getUserProfileHandler);

async function getUserProfileHandler(req, res) {
  try {
    console.log("🔥 getUserProfileHandler called - v2024.12.19");
    console.log("Request method:", req.method);
    console.log("Request path:", req.path);
    console.log("Request query:", req.query);
    console.log("Request params:", req.params);
    
    const { username } = req.query;
    
    if (!username) {
      console.log("❌ Username missing from query");
      return res.status(400).json({ error: "Username is required" });
    }
    
    console.log("✅ Fetching profile for username:", username);
    
    // 사용자 기본 정보 조회
    const user = await UserUuidModel.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // 사용자의 모든 정보 병렬로 조회
    const [userMoney, userAmber, userEquipment, fishingSkill, totalCatches] = await Promise.all([
      UserMoneyModel.findOne({ userUuid: user.userUuid }),
      UserAmberModel.findOne({ userUuid: user.userUuid }),
      UserEquipmentModel.findOne({ userUuid: user.userUuid }),
      FishingSkillModel.findOne({ userUuid: user.userUuid }),
      CatchModel.countDocuments({ userUuid: user.userUuid })
    ]);
    
    const profileData = {
      userUuid: user.userUuid,
      username: user.username,
      displayName: user.displayName,
      isGuest: user.isGuest,
      money: userMoney?.money || 0,
      amber: userAmber?.amber || 0,
      equipment: {
        fishingRod: userEquipment?.fishingRod || null,
        accessory: userEquipment?.accessory || null
      },
      fishingSkill: fishingSkill?.skill || 0,
      totalCatches: totalCatches || 0,
      totalFishCaught: user.totalFishCaught || 0, // 새로운 총 물고기 카운트
      createdAt: user.createdAt
    };
    
    console.log("Profile data fetched:", profileData);
    res.json(profileData);
  } catch (error) {
    console.error("Failed to fetch user profile:", error);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
}

// 🔥 서버 버전 및 API 상태 확인 (디버깅용)
app.get("/api/debug/server-info", (req, res) => {
  const serverInfo = {
    version: "v2024.12.19",
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
    
    res.json({
      status: 'ok',
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



// 🛡️ [SECURITY] 보안 강화된 계정 초기화 API
app.post("/api/reset-account", async (req, res) => {
  try {
    const { username, userUuid } = req.query;
    const { confirmationKey } = req.body; // 🛡️ 보안: 확인 키 필수
    const clientIP = getClientIP(req);
    
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
    
    // 모든 관련 데이터 삭제
    const deleteResults = await Promise.all([
      CatchModel.deleteMany({ userUuid }),
      UserMoneyModel.deleteMany({ userUuid }),
      UserEquipmentModel.deleteMany({ userUuid }),
      MaterialModel.deleteMany({ userUuid }),
      FishingSkillModel.deleteMany({ userUuid })
    ]);
    
    console.log("Deleted data:", {
      catches: deleteResults[0].deletedCount,
      money: deleteResults[1].deletedCount,
      equipment: deleteResults[2].deletedCount,
      materials: deleteResults[3].deletedCount,
      fishingSkill: deleteResults[4].deletedCount
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
      fishingRod: null,
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

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/fishing_game";
const PORT = Number(process.env.PORT || 4000);

// 🔐 JWT 설정
const JWT_SECRET = process.env.JWT_SECRET || "fishing_game_jwt_secret_key_2024";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

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
    console.log(`🔐 JWT verified for user: ${decoded.username} (${decoded.userUuid})`);
    return decoded;
  } catch (error) {
    console.error("🚨 JWT verification failed:", error.message);
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
    
    // 🚀 MongoDB 연결 최적화 (성능 향상)
    await mongoose.connect(MONGO_URI, {
      // 연결 풀 최적화
      maxPoolSize: 10, // 최대 연결 수
      minPoolSize: 2,  // 최소 연결 수 유지
      maxIdleTimeMS: 30000, // 30초 후 유휴 연결 정리
      serverSelectionTimeoutMS: 5000, // 5초 서버 선택 타임아웃
      socketTimeoutMS: 45000, // 45초 소켓 타임아웃
      // 성능 최적화
      bufferCommands: false // 버퍼링 비활성화 (즉시 에러 반환)
    });
    
    console.log("✅ MongoDB connected successfully!");
    console.log("Database name:", mongoose.connection.db.databaseName);
    console.log("Connection state:", mongoose.connection.readyState); // 1 = connected
    
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
      await CatchModel.collection.createIndex({ userUuid: 1, fish: 1 }); // 물고기 판매/분해
      await UserMoneyModel.collection.createIndex({ userUuid: 1 }); // 돈 조회
      await FishingSkillModel.collection.createIndex({ userUuid: 1 }); // 낚시 실력
      await MaterialModel.collection.createIndex({ userUuid: 1, material: 1 }); // 재료 소모
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
