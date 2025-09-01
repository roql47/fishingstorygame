const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
const { OAuth2Client } = require("google-auth-library");

// dotenv는 개발환경에서만 로드
if (process.env.NODE_ENV !== 'production') {
  try {
    require("dotenv").config();
  } catch (err) {
    console.log("dotenv not available, using environment variables");
  }
}

const app = express();

app.use(cors({
  origin: [
    "http://localhost:4000",
    "http://localhost:5173", 
    "http://127.0.0.1:4000",
    "http://127.0.0.1:5173"
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// CORS 헤더 추가
app.use((req, res, next) => {
  res.header('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.header('Cross-Origin-Embedder-Policy', 'unsafe-none');
  next();
});

app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:4000",
      "http://localhost:5173", 
      "http://127.0.0.1:4000",
      "http://127.0.0.1:5173"
    ],
    credentials: true,
    methods: ["GET", "POST"]
  },
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
    isGuest: { type: Boolean, default: false }, // 게스트 여부
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

const UserUuidModel = mongoose.model("UserUuid", userUuidSchema);

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
async function getOrCreateUser(username, googleId = null) {
  try {
    let user;
    
    if (googleId) {
      // 구글 로그인 사용자
      user = await UserUuidModel.findOne({ originalGoogleId: googleId });
      if (!user) {
        const userUuid = await generateNextUuid();
        user = await UserUuidModel.create({
          userUuid,
          username: username || "구글사용자",
          displayName: username || "구글사용자",
          originalGoogleId: googleId,
          isGuest: false
        });
        console.log(`Created new Google user: ${userUuid} (${username})`);
      } else if (user.username !== username && username) {
        // 구글 사용자의 경우 기존 닉네임 유지 (사용자가 변경한 닉네임 보존)
        console.log(`Google user found with existing nickname: ${user.username} (keeping instead of ${username})`);
        // 닉네임 업데이트 하지 않음 - 기존 닉네임 유지
      }
    } else {
      // 게스트 사용자 - 기존 사용자를 찾되, 없으면 새로 생성
      user = await UserUuidModel.findOne({ username, isGuest: true });
      if (!user) {
        const userUuid = await generateNextUuid();
        user = await UserUuidModel.create({
          userUuid,
          username: username || "게스트",
          displayName: username || "게스트",
          isGuest: true
        });
        console.log(`Created new guest user: ${userUuid} (${username})`);
      } else if (user.username !== username && username) {
        // 게스트 사용자의 닉네임이 변경된 경우 업데이트
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
  console.log("getUserQuery called with:", { userId, username, userUuid });
  
  // 1순위: userUuid로 직접 조회 (가장 정확)
  if (userUuid) {
    const user = await UserUuidModel.findOne({ userUuid });
    console.log("Found user by userUuid:", user ? { userUuid: user.userUuid, username: user.username } : "Not found");
    if (user) {
      return { userUuid: user.userUuid, user };
    }
  }
  
  // 2순위: username으로 UUID 조회
  if (username) {
    const user = await UserUuidModel.findOne({ username });
    console.log("Found user by username:", user ? { userUuid: user.userUuid, username: user.username } : "Not found");
    if (user) {
      return { userUuid: user.userUuid, user };
    }
  }
  
  // 3순위: 기존 방식 fallback
  if (userId !== 'null' && userId !== 'user') {
    console.log("Using fallback with userId:", userId);
    return { userId, user: null };
  } else if (username) {
    console.log("Using fallback with username:", username);
    return { username, user: null };
  } else {
    console.log("Using fallback with default user");
    return { userId: 'user', user: null };
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
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

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
    
    console.log("Google token verified successfully:", { userId, displayName });
    return { userId, displayName, sub: payload.sub };
  } catch (error) {
    console.error("Google token verification failed:", error.message);
    return null;
  }
}

// 접속자 관리
const connectedUsers = new Map();
const processingJoins = new Set(); // 중복 join 요청 방지
const recentJoins = new Map(); // 최근 입장 메시지 추적 (userUuid -> timestamp)
const processingMaterialConsumption = new Set(); // 중복 재료 소모 요청 방지

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
setInterval(() => {
  console.log("🕐 Performing periodic connection cleanup...");
  const uniqueUsers = cleanupConnectedUsers();
  
  // 모든 클라이언트에게 정리된 사용자 목록 전송
  io.emit("users:update", uniqueUsers);
}, 30000); // 30초

io.on("connection", (socket) => {
  socket.on("chat:join", async ({ username, idToken, userUuid }) => {
    // 중복 요청 방지
    const joinKey = `${socket.id}-${userUuid || username}`;
    if (processingJoins.has(joinKey)) {
      console.log(`[DUPLICATE JOIN] Ignoring duplicate join request for ${joinKey}`);
      return;
    }
    
    processingJoins.add(joinKey);
    
    try {
      console.log("=== CHAT:JOIN DEBUG ===");
      console.log("Received parameters:", { username, idToken: !!idToken, userUuid });
      
      const info = await verifyGoogleIdToken(idToken);
      
            // UUID 기반 사용자 등록/조회
      const googleId = info?.sub || null; // 구글 ID (sub claim)
      
      // 닉네임 우선순위 결정 (구글 로그인 여부에 따라)
      let effectiveName;
      
      // 구글 로그인 시 기존 사용자의 닉네임 보존
      if (googleId) {
        console.log("Google login detected, checking for existing user with Google ID:", googleId);
        const existingGoogleUser = await UserUuidModel.findOne({ originalGoogleId: googleId });
        
        if (existingGoogleUser) {
          // 기존 구글 사용자가 있으면 데이터베이스의 닉네임을 우선 사용
          console.log("Found existing Google user:", {
            userUuid: existingGoogleUser.userUuid,
            storedDisplayName: existingGoogleUser.displayName,
            clientUsername: username,
            googleDisplayName: info?.displayName
          });
          
          // 클라이언트에서 보낸 username이 데이터베이스의 displayName과 다르고,
          // Google displayName과도 다르면 닉네임 변경으로 간주
          const isNicknameChange = username && 
                                  username !== existingGoogleUser.displayName && 
                                  username !== info?.displayName;
          
          if (isNicknameChange) {
            console.log("Nickname change detected:", existingGoogleUser.displayName, "->", username);
            effectiveName = username; // 변경된 닉네임 사용
          } else {
            console.log("Using stored displayName (preserving user's custom nickname):", existingGoogleUser.displayName);
            effectiveName = existingGoogleUser.displayName; // 기존 닉네임 보존
          }
        } else {
          // 새 구글 사용자인 경우
          effectiveName = info?.displayName || username || "구글사용자";
          console.log("New Google user - using displayName:", effectiveName);
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
          user = await getOrCreateUser(effectiveName, googleId);
        }
      } else if (googleId) {
        // 2순위: 구글 사용자 (새 로그인 또는 기존 사용자)
        console.log(`[PRIORITY 2] Looking for Google user with ID: ${googleId}`);
        user = await UserUuidModel.findOne({ originalGoogleId: googleId });
        if (user) {
          console.log(`[PRIORITY 2] Found existing Google user: ${user.username}`);
          
          // 닉네임 변경 감지 및 처리
          if (user.username !== effectiveName && effectiveName !== user.displayName) {
            const oldUsername = user.username;
            console.log(`[PRIORITY 2] Updating nickname from ${oldUsername} to ${effectiveName} for Google user: ${googleId}`);
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
          console.log(`[PRIORITY 2] Creating new Google user`);
          user = await getOrCreateUser(effectiveName, googleId);
        }
      } else {
        // 3순위: 게스트 사용자 (새 로그인) - 기존 사용자 찾기 시도
        console.log(`[PRIORITY 3] Looking for guest user with username: ${effectiveName}`);
        user = await UserUuidModel.findOne({ username: effectiveName, isGuest: true });
        if (!user) {
          console.log(`[PRIORITY 3] Creating new guest user`);
          user = await getOrCreateUser(effectiveName, googleId);
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
    
      // 같은 구글 아이디로 중복 접속 방지 (PC/모바일 동시 접속 차단)
      if (googleId) {
        const existingGoogleConnection = Array.from(connectedUsers.entries())
          .find(([socketId, userData]) => userData.originalGoogleId === googleId && socketId !== socket.id);
        
        if (existingGoogleConnection) {
          const [existingSocketId, existingUserData] = existingGoogleConnection;
          console.log(`🚨 Duplicate Google login detected! Disconnecting previous session: ${existingUserData.username} (${existingSocketId})`);
          
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
        loginType: idToken ? 'Google' : 'Guest',
        joinTime: new Date(),
        socketId: socket.id,
        originalGoogleId: user.originalGoogleId // 구글 ID 정보도 추가
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
      console.log(`[USER:UUID EVENT] Sending to client: { userUuid: ${user.userUuid}, username: ${user.username} }`);
      socket.emit("user:uuid", { userUuid: user.userUuid, username: user.username });
      
      // 입장/닉네임 변경 메시지 전송 (중복 방지)
      if (isNicknameChange) {
        // 닉네임 변경 시에는 메시지를 보내지 않음
        console.log(`[NICKNAME CHANGE] Silent nickname change: ${oldNickname} -> ${user.username}`);
      } else if (!isAlreadyConnected) {
        // 최근 입장 메시지 중복 방지 (5초 내 같은 사용자)
        const now = Date.now();
        const lastJoinTime = recentJoins.get(user.userUuid);
        
        if (!lastJoinTime || (now - lastJoinTime) > 5000) {
          // 5초 이상 지났거나 처음 입장인 경우에만 메시지 전송
          recentJoins.set(user.userUuid, now);
          
          io.emit("chat:message", { 
            system: true, 
            username: "system", 
            content: `${user.username} 님이 입장했습니다.`,
            timestamp: new Date().toISOString()
          });
          console.log(`[JOIN MESSAGE] Sent join message for new user: ${user.username}`);
        } else {
          console.log(`[JOIN MESSAGE] Skipped duplicate join message for ${user.username} (within 5 seconds)`);
        }
      } else {
        console.log(`[JOIN MESSAGE] Skipped join message for already connected user: ${user.username}`);
      }
      
    } catch (error) {
      console.error("Error in chat:join:", error);
      console.error("Stack trace:", error.stack);
      socket.emit("error", { message: "Failed to join chat" });
      
      // 오류 발생 시에도 기본 입장 메시지
      io.emit("chat:message", { 
        system: true, 
        username: "system", 
        content: `${username || "사용자"} 님이 입장했습니다.`,
        timestamp: new Date().toISOString()
      });
    } finally {
      // 처리 완료 후 중복 방지 키 제거
      processingJoins.delete(joinKey);
    }
  });

  socket.on("chat:message", async (msg) => {
    const trimmed = msg.content.trim();
    const timestamp = msg.timestamp || new Date().toISOString();
    
    if (trimmed === "낚시하기") {
      try {
        console.log("=== Fishing Request ===");
        console.log("Socket data:", {
          userUuid: socket.data.userUuid,
          username: socket.data.username,
          userId: socket.data.userId,
          displayName: socket.data.displayName
        });
        
        // 사용자 식별 확인
        if (!socket.data.userUuid && !socket.data.username && !socket.data.userId) {
          console.error("No user identification found");
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
        
        console.log("Fishing skill query:", query);
        let fishingSkill = await FishingSkillModel.findOne(query);
        const userSkill = fishingSkill ? fishingSkill.skill : 0;
        
        console.log(`User ${socket.data.userUuid || socket.data.username} fishing skill: ${userSkill}`);
        const { fish } = randomFish(userSkill);
        console.log("Random fish result:", fish);
        
        // 물고기 저장 데이터 준비 (UUID 기반)
        const catchData = {
          fish,
          weight: 0, // 무게는 0으로 설정 (기존 스키마 호환성)
        };
        
        // 사용자 식별 정보 추가 (우선순위: userUuid > username > userId)
        console.log("Socket data for catch:", {
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
        
        console.log("Saving fish catch:", catchData);
        
        // 물고기 저장
        const savedCatch = await CatchModel.create(catchData);
        console.log("Fish saved successfully:", {
          _id: savedCatch._id,
          userUuid: savedCatch.userUuid,
          username: savedCatch.username,
          fish: savedCatch.fish
        });
        
        // 성공 메시지
        io.emit("chat:message", {
          system: true,
          username: "system",
          content: `${catchData.displayName} 님이 ${fish}를 낚았습니다!`,
          timestamp,
        });
        
        console.log("=== Fishing SUCCESS ===");
        
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
          content: `${user.displayName} 님이 퇴장했습니다.`,
          timestamp: new Date()
        });
      }
    }
  });
});

// Personal Inventory API
app.get("/api/inventory/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const username = req.query.username;
    
    console.log("Inventory request:", { userId, username });
    
    // UUID 기반 사용자 조회
    const queryResult = await getUserQuery(userId, username);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
      console.log("Using UUID query for inventory:", query);
    } else {
      query = queryResult;
      console.log("Using fallback query for inventory:", query);
    }
    
    console.log("Database query for inventory:", query);
    
    const catches = await CatchModel.find(query);
    console.log(`Found ${catches.length} catches for query:`, query);
    
    // 물고기별로 갯수를 세어서 그룹화
    const fishCount = {};
    catches.forEach(c => {
      console.log("Processing catch:", { fish: c.fish, userUuid: c.userUuid, username: c.username });
      fishCount[c.fish] = (fishCount[c.fish] || 0) + 1;
    });
    
    console.log("Fish count result:", fishCount);
    
    // 갯수 순으로 정렬해서 반환
    const inventory = Object.entries(fishCount)
      .map(([fish, count]) => ({ fish, count }))
      .sort((a, b) => b.count - a.count);
    
    console.log("Final inventory:", inventory);
    res.json(inventory);
  } catch (error) {
    console.error("Failed to fetch inventory:", error);
    res.status(500).json({ error: "Failed to fetch inventory" });
  }
});

// User Money API
app.get("/api/user-money/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, userUuid } = req.query;
    
    console.log("User money request:", { userId, username, userUuid });
    
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

// User Amber API
app.get("/api/user-amber/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, userUuid } = req.query;
    
    console.log("User amber request:", { userId, username, userUuid });
    
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
app.get("/api/star-pieces/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, userUuid } = req.query;
    console.log("Star pieces request:", { userId, username, userUuid });
    
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
    console.log(`Added ${amount} star pieces. New total: ${userStarPieces.starPieces}`);
    
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

// Admin APIs (관리자 시스템)
// 관리자 권한 토글 API
app.post("/api/toggle-admin", async (req, res) => {
  try {
    const { username, userUuid } = req.query;
    
    console.log("Admin toggle request:", { username, userUuid });
    
    const queryResult = await getUserQuery('user', username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
      console.log("Using UUID query for admin toggle:", query);
    } else {
      query = queryResult;
      console.log("Using fallback query for admin toggle:", query);
    }
    
    // 기존 관리자 상태 확인
    let adminRecord = await AdminModel.findOne(query);
    if (!adminRecord) {
      const createData = {
        userId: query.userId || 'user',
        username: query.username || username,
        userUuid: query.userUuid || userUuid,
        isAdmin: true
      };
      console.log("Creating new admin record:", createData);
      adminRecord = new AdminModel(createData);
      await adminRecord.save();
      
      console.log(`Admin rights granted to: ${username}`);
      res.json({
        success: true,
        isAdmin: true,
        message: "관리자 권한이 부여되었습니다."
      });
    } else {
      // 기존 기록이 있으면 토글
      adminRecord.isAdmin = !adminRecord.isAdmin;
      await adminRecord.save();
      
      console.log(`Admin rights ${adminRecord.isAdmin ? 'granted' : 'revoked'} for: ${username}`);
      res.json({
        success: true,
        isAdmin: adminRecord.isAdmin,
        message: adminRecord.isAdmin ? "관리자 권한이 부여되었습니다." : "관리자 권한이 해제되었습니다."
      });
    }
  } catch (error) {
    console.error("Failed to toggle admin:", error);
    res.status(500).json({ error: "관리자 권한 변경에 실패했습니다." });
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
    
    console.log("Cooldown status request:", { userId, username, userUuid });
    
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
    
    console.log(`Cooldown status for ${username}:`, { 
      fishingCooldown: Math.max(0, fishingCooldown), 
      explorationCooldown: Math.max(0, explorationCooldown)
    });
    
    res.json({ 
      fishingCooldown: Math.max(0, fishingCooldown),
      explorationCooldown: Math.max(0, explorationCooldown)
    });
  } catch (error) {
    console.error("Failed to fetch cooldown status:", error);
    res.status(500).json({ error: "쿨타임 상태를 가져올 수 없습니다." });
  }
});

// 낚시 쿨타임 설정 API
app.post("/api/set-fishing-cooldown", async (req, res) => {
  try {
    const { cooldownDuration } = req.body; // 쿨타임 지속시간 (밀리초)
    const { username, userUuid } = req.query;
    
    console.log("Set fishing cooldown request:", { cooldownDuration, username, userUuid });
    
    const queryResult = await getUserQuery('user', username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
      console.log("Using UUID query for fishing cooldown:", query);
    } else {
      query = queryResult;
      console.log("Using fallback query for fishing cooldown:", query);
    }
    
    const now = new Date();
    const cooldownEnd = new Date(now.getTime() + cooldownDuration);
    
    const updateData = {
      userId: query.userId || 'user',
      username: query.username || username,
      userUuid: query.userUuid || userUuid,
      fishingCooldownEnd: cooldownEnd
    };
    
    await CooldownModel.findOneAndUpdate(
      query,
      updateData,
      { upsert: true, new: true }
    );
    
    console.log(`Fishing cooldown set for ${username} until:`, cooldownEnd);
    
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

// 탐사 쿨타임 설정 API
app.post("/api/set-exploration-cooldown", async (req, res) => {
  try {
    const { cooldownDuration } = req.body; // 쿨타임 지속시간 (밀리초)
    const { username, userUuid } = req.query;
    
    console.log("Set exploration cooldown request:", { cooldownDuration, username, userUuid });
    
    const queryResult = await getUserQuery('user', username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
      console.log("Using UUID query for exploration cooldown:", query);
    } else {
      query = queryResult;
      console.log("Using fallback query for exploration cooldown:", query);
    }
    
    const now = new Date();
    const cooldownEnd = new Date(now.getTime() + cooldownDuration);
    
    const updateData = {
      userId: query.userId || 'user',
      username: query.username || username,
      userUuid: query.userUuid || userUuid,
      explorationCooldownEnd: cooldownEnd
    };
    
    await CooldownModel.findOneAndUpdate(
      query,
      updateData,
      { upsert: true, new: true }
    );
    
    console.log(`Exploration cooldown set for ${username} until:`, cooldownEnd);
    
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

// 접속자 목록 API
app.get("/api/connected-users", async (req, res) => {
  try {
    console.log("Connected users request");
    
    // 현재 연결된 사용자 목록을 메모리에서 가져오기
    const users = Array.from(connectedUsers.values()).map(user => ({
      userUuid: user.userUuid,
      username: user.username,
      displayName: user.displayName || user.username,
      userId: user.userId, // 구글 로그인 여부 판단용
      hasIdToken: user.hasIdToken || false // ID 토큰 보유 여부
    }));
    
    console.log("Sending connected users:", users);
    
    res.json({ users });
  } catch (error) {
    console.error("Failed to fetch connected users:", error);
    res.status(500).json({ error: "접속자 목록을 가져올 수 없습니다." });
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
    
    // 모든 사용자의 낚시 데이터 수집
    const [fishingSkills, catches] = await Promise.all([
      FishingSkillModel.find({}).lean(),
      CatchModel.aggregate([
        {
          $group: {
            _id: { userUuid: "$userUuid", username: "$username" },
            totalCatches: { $sum: 1 }
          }
        }
      ])
    ]);
    
    // 사용자별 데이터 병합
    const userRankingData = new Map();
    
    // 낚시 스킬 데이터 추가
    fishingSkills.forEach(skill => {
      const key = skill.userUuid || skill.username;
      userRankingData.set(key, {
        userUuid: skill.userUuid,
        username: skill.username,
        fishingSkill: skill.fishingSkill || 0,
        totalCatches: 0
      });
    });
    
    // 총 낚은 물고기 데이터 추가
    catches.forEach(catchData => {
      const key = catchData._id.userUuid || catchData._id.username;
      if (userRankingData.has(key)) {
        userRankingData.get(key).totalCatches = catchData.totalCatches;
      } else {
        userRankingData.set(key, {
          userUuid: catchData._id.userUuid,
          username: catchData._id.username,
          fishingSkill: 0,
          totalCatches: catchData.totalCatches
        });
      }
    });
    
    // 랭킹 배열로 변환 및 정렬
    const rankings = Array.from(userRankingData.values())
      .filter(user => user.username && user.username.trim() !== '') // 유효한 사용자만
      .sort((a, b) => {
        // 1차 정렬: 총 낚은 물고기 수 (내림차순)
        if (b.totalCatches !== a.totalCatches) {
          return b.totalCatches - a.totalCatches;
        }
        // 2차 정렬: 낚시 스킬 (내림차순)
        return b.fishingSkill - a.fishingSkill;
      })
      .map((user, index) => ({
        rank: index + 1,
        userUuid: user.userUuid,
        username: user.username,
        fishingSkill: user.fishingSkill,
        totalCatches: user.totalCatches
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
    console.log(`Added ${amount} amber. New total: ${userAmber.amber}`);
    
    res.json({ success: true, newAmber: userAmber.amber });
  } catch (error) {
    console.error("Failed to add amber:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ error: "Failed to add amber", details: error.message });
  }
});

// Fish Selling API
app.post("/api/sell-fish", async (req, res) => {
  try {
    const { fishName, quantity, totalPrice } = req.body;
    const { username, userUuid } = req.query;
    console.log("Sell fish request:", { fishName, quantity, totalPrice, username, userUuid });
    
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
    
    console.log("Database query for sell fish:", query);
    
    // 사용자가 해당 물고기를 충분히 가지고 있는지 확인
    const userFish = await CatchModel.find({ ...query, fish: fishName });
    console.log(`Found ${userFish.length} ${fishName} for user`);
    
    if (userFish.length < quantity) {
      console.log(`Not enough fish: has ${userFish.length}, needs ${quantity}`);
      return res.status(400).json({ error: "Not enough fish to sell" });
    }
    
    // 물고기 판매 (quantity만큼 삭제)
    for (let i = 0; i < quantity; i++) {
      await CatchModel.findOneAndDelete({ ...query, fish: fishName });
    }
    console.log(`Deleted ${quantity} ${fishName}`);
    
    // 사용자 돈 업데이트
    let userMoney = await UserMoneyModel.findOne(query);
    if (!userMoney) {
      const createData = {
        money: totalPrice,
        ...query
      };
      
      // username이 있으면 추가
      if (username) {
        createData.username = username;
      }
      
      console.log("Creating new user money for sell:", createData);
      userMoney = await UserMoneyModel.create(createData);
    } else {
      userMoney.money += totalPrice;
      await userMoney.save();
    }
    console.log(`Updated user money: ${userMoney.money}`);
    
    res.json({ success: true, newBalance: userMoney.money });
  } catch (error) {
    console.error("Failed to sell fish:", error);
    res.status(500).json({ error: "Failed to sell fish" });
  }
});

// Item Buying API (for fishing rods and accessories)
app.post("/api/buy-item", async (req, res) => {
  try {
    const { itemName, price, category } = req.body;
    const { username, userUuid } = req.query;
    console.log("Buy item request:", { itemName, price, category, username, userUuid });
    console.log("Full request query:", req.query);
    console.log("Full request body:", req.body);
    
    // UUID 기반 사용자 조회
    const queryResult = await getUserQuery('user', username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
      console.log("Using UUID query for buy item:", query);
    } else {
      query = queryResult;
      console.log("Using fallback query for buy item:", query);
    }
    
    console.log("Database query for buy item:", query);
    
    // 사용자 돈 확인
    let userMoney = await UserMoneyModel.findOne(query);
    
    if (!userMoney || userMoney.money < price) {
      console.log(`Not enough money: has ${userMoney?.money || 0}, needs ${price}`);
      return res.status(400).json({ error: "Not enough money" });
    }
    
    // 돈 차감
    userMoney.money -= price;
    await userMoney.save();
    console.log(`Money deducted: ${price}, new balance: ${userMoney.money}`);
    
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
        
        console.log("Creating new fishing skill:", createData);
        fishingSkill = await FishingSkillModel.create(createData);
      } else {
        fishingSkill.skill += 1;
        await fishingSkill.save();
      }
      console.log(`Fishing skill increased to ${fishingSkill.skill} for user`);
    }
    
    res.json({ success: true, newBalance: userMoney.money });
  } catch (error) {
    console.error("Failed to buy item:", error);
    res.status(500).json({ error: "Failed to buy item" });
  }
});

// User Equipment API
app.get("/api/user-equipment/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, userUuid } = req.query;
    
    console.log("=== EQUIPMENT LOAD DEBUG ===");
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
app.get("/api/materials/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, userUuid } = req.query;
    
    console.log("Materials request:", { userId, username, userUuid });
    
    // UUID 기반 사용자 조회
    const queryResult = await getUserQuery(userId, username, userUuid);
    let query;
    if (queryResult.userUuid) {
      query = { userUuid: queryResult.userUuid };
      console.log("Using UUID query for materials:", query);
    } else {
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
    
    // 물고기 제거 (quantity만큼 삭제)
    for (let i = 0; i < quantity; i++) {
      await CatchModel.findOneAndDelete({ ...query, fish: fishName });
    }
    console.log(`Deleted ${quantity} ${fishName}`);
    
    // 스타피쉬 분해 시 별조각 지급
    if (fishName === "스타피쉬") {
      const starPiecesPerFish = 1; // 스타피쉬 1마리당 별조각 1개
      const totalStarPieces = quantity * starPiecesPerFish;
      
      let userStarPieces = await StarPieceModel.findOne(query);
      
      if (!userStarPieces) {
        // 새 사용자인 경우 생성
        const createData = {
          userId: query.userId || 'user',
          username: query.username || username,
          userUuid: query.userUuid || userUuid,
          starPieces: totalStarPieces
        };
        console.log("Creating new star pieces record for decompose:", createData);
        userStarPieces = new StarPieceModel(createData);
      } else {
        userStarPieces.starPieces = (userStarPieces.starPieces || 0) + totalStarPieces;
      }
      
      await userStarPieces.save();
      console.log(`Added ${totalStarPieces} star pieces from ${quantity} starfish decomposition. New total: ${userStarPieces.starPieces}`);
      
      res.json({ 
        success: true, 
        starPiecesGained: totalStarPieces,
        totalStarPieces: userStarPieces.starPieces 
      });
      return;
    }
    
    // 일반 물고기 분해 시 재료 추가
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
      
      await MaterialModel.create(materialData);
    }
    console.log(`Added ${quantity} ${material}`);
    
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

// Fishing Skill API
app.get("/api/fishing-skill/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, userUuid } = req.query;
    
    console.log("Fishing skill request:", { userId, username, userUuid });
    
    // UUID 기반 사용자 조회 먼저 시도
    const queryResult = await getUserQuery(userId, username, userUuid);
    const query = queryResult.userUuid ? { userUuid: queryResult.userUuid } : queryResult;
    
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
      fishingSkill = await FishingSkillModel.create(createData);
    }
    
    res.json({ skill: fishingSkill.skill });
  } catch (error) {
    console.error("Failed to fetch fishing skill:", error);
    res.status(500).json({ error: "Failed to fetch fishing skill" });
  }
});

// Static files (serve built client from dist/static)
const staticDir = path.join(__dirname, "..", "dist", "static");
app.use(express.static(staticDir));

// SPA fallback (exclude API and socket paths)
app.get(/^(?!\/api|\/socket\.io).*/, (req, res) => {
  res.sendFile(path.join(staticDir, "index.html"));
});

// 다른 사용자 프로필 조회 API
app.get("/api/user-profile/:username", async (req, res) => {
  try {
    const { username } = req.params;
    
    console.log("Fetching profile for username:", username);
    
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
      createdAt: user.createdAt
    };
    
    console.log("Profile data fetched:", profileData);
    res.json(profileData);
  } catch (error) {
    console.error("Failed to fetch user profile:", error);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
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



// 계정 초기화 API
app.post("/api/reset-account", async (req, res) => {
  try {
    const { username, userUuid } = req.query;
    
    console.log("=== ACCOUNT RESET DEBUG ===");
    console.log("Reset account request:", { username, userUuid });
    
    if (!userUuid) {
      return res.status(400).json({ error: "userUuid is required" });
    }
    
    // 사용자 존재 확인
    const user = await UserUuidModel.findOne({ userUuid });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    console.log("Resetting account for user:", { userUuid: user.userUuid, username: user.username });
    
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

async function bootstrap() {
  try {
    console.log("=== MONGODB CONNECTION DEBUG ===");
    console.log("Attempting to connect to MongoDB:", MONGO_URI);
    
    await mongoose.connect(MONGO_URI);
    
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
    
    server.listen(PORT, () => {
      console.log(`🚀 Server listening on http://localhost:${PORT}`);
      console.log("MongoDB connection state:", mongoose.connection.readyState);
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
