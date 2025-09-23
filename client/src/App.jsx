import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSocket, notifyUserLogin } from "./lib/socket";
// Google auth functions are now handled inline
import axios from "axios";
// 🚀 게임 데이터 훅 임포트 (변수 초기화 문제 해결)
import { useGameData } from "./hooks/useGameData";
import ChatTab from "./components/ChatTab";
import NoticeModal from "./components/NoticeModal";
import TutorialModal from "./components/TutorialModal";
import { CompanionTab, processCompanionSkill, canUseCompanionSkill } from './components/companions';
import { COMPANION_DATA, calculateCompanionStats } from './data/companionData';
import { 
  Fish, 
  MessageCircle, 
  Package, 
  LogOut, 
  Send, 
  User,
  Clock,
  Trophy,
  Moon,
  Sun,
  ShoppingCart,
  Coins,
  Trash2,
  Gem,
  Diamond,
  Waves,
  Star,
  Users,
  Heart,
  ThumbsUp,
  Target,
  CheckCircle,
  Gift,
  X,
  Bell,
  BookOpen,
  Info
} from "lucide-react";
import "./App.css";

// Axios 응답 인터셉터 설정 (차단된 IP/계정 처리)
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403 && error.response?.data?.blocked) {
      const blockInfo = error.response.data;
      alert(`🚫 ${blockInfo.message}`);
      
      // 계정 차단의 경우 로그아웃 처리
      if (blockInfo.accountBlocked) {
        localStorage.clear();
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);

function App() {
  // 🚀 게임 데이터 훅 사용 (변수 초기화 문제 해결)
  const {
    isLoading: gameDataLoading,
    probabilityTemplate,
    allFishTypes,
    fishHealthMap,
    fishSpeedMap,
    fishPrefixes,
    shopData,
    getAvailableFish,
    getFishPrice,
    getFishMaterial,
    getMaterialToFish,
    selectFishPrefix,
    getAllShopItems,
    getAvailableShopItem
  } = useGameData();

  // Socket 초기화
  const socket = getSocket();
  
  const [username, setUsername] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [myCatches, setMyCatches] = useState(0);
  const [idToken, setIdToken] = useState(undefined);
  const [usernameInput, setUsernameInput] = useState("");
  const [activeTab, setActiveTab] = useState("chat");
  const [dailyQuests, setDailyQuests] = useState({ quests: [], lastResetDate: '' });
  const [isGuest, setIsGuest] = useState(false); // 게스트 여부 추적
  const [jwtToken, setJwtToken] = useState(null); // 🔐 JWT 토큰 상태 (위치 이동)
  const [fishingCooldown, setFishingCooldown] = useState(0); // 🛡️ 쿨타임 상태 (위치 이동)
  const [cooldownLoaded, setCooldownLoaded] = useState(false); // 🛡️ 쿨타임 로드 상태 (위치 이동)
  
  // 🔧 모든 상태 변수들을 상단으로 이동 (TDZ 문제 해결)
  const [userMoney, setUserMoney] = useState(0);
  const [userAmber, setUserAmber] = useState(0);
  const [userStarPieces, setUserStarPieces] = useState(0);
  const [companions, setCompanions] = useState([]);
  const [battleCompanions, setBattleCompanions] = useState([]); // 전투 참여 동료 (최대 3명)
  const [companionStats, setCompanionStats] = useState({}); // 동료별 레벨/경험치 관리
  const [showCompanionModal, setShowCompanionModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminStatusLoaded, setAdminStatusLoaded] = useState(false); // 관리자 상태 로드 완료 여부
  const [userAdminStatus, setUserAdminStatus] = useState({}); // 다른 사용자들의 관리자 상태
  const [connectedUsers, setConnectedUsers] = useState([]); // 접속자 목록
  const [isLoadingUsers, setIsLoadingUsers] = useState(true); // 접속자 목록 로딩 상태
  const [rankings, setRankings] = useState([]); // 랭킹 데이터
  const [shopCategory, setShopCategory] = useState("fishing_rod");
  const [showProfile, setShowProfile] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState(null); // 선택된 사용자 프로필 정보
  const [otherUserData, setOtherUserData] = useState(null); // 다른 사용자의 실제 데이터
  const [userEquipment, setUserEquipment] = useState({
    fishingRod: null,
    accessory: null
  });
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [fishingSkill, setFishingSkill] = useState(0);
  const [userUuid, setUserUuid] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(true); // 기본값: 다크모드
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [quantityModalData, setQuantityModalData] = useState(null);
  const [inputQuantity, setInputQuantity] = useState(1);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [blockedIPs, setBlockedIPs] = useState([]);
  const [newIPAddress, setNewIPAddress] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [showIPManager, setShowIPManager] = useState(false);
  const [showAccountManager, setShowAccountManager] = useState(false);
  const [blockedAccounts, setBlockedAccounts] = useState([]);
  const [connectedUsersList, setConnectedUsersList] = useState([]);
  const [newAccountTarget, setNewAccountTarget] = useState('');
  const [accountBlockReason, setAccountBlockReason] = useState('');
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [initialNickname, setInitialNickname] = useState("");
  
  // 🔧 추가 상태 변수들 (TDZ 문제 해결)
  const [isProcessingSellAll, setIsProcessingSellAll] = useState(false);
  const [isProcessingDecomposeAll, setIsProcessingDecomposeAll] = useState(false);
  const [showExplorationModal, setShowExplorationModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [battleState, setBattleState] = useState(null); // { enemy, playerHp, enemyHp, turn, log }
  const [showBattleModal, setShowBattleModal] = useState(false);
  const [isProcessingFishing, setIsProcessingFishing] = useState(false); // 🛡️ 낚시 처리 중 상태
  const [showNoticeModal, setShowNoticeModal] = useState(false); // 공지사항 모달
  const [showTutorialModal, setShowTutorialModal] = useState(false); // 튜토리얼 모달

  // 🔄 동료 능력치 서버 저장 함수
  const saveCompanionStatsToServer = async (companionName, stats) => {
    if (!jwtToken) return;
    
    try {
      await axios.post(`${serverUrl}/api/update-companion-stats`, {
        companionName,
        level: stats.level,
        experience: stats.exp || stats.experience || 0, // exp 필드를 experience로 전송
        isInBattle: stats.isInBattle || false
      }, {
        headers: {
          'Authorization': `Bearer ${jwtToken}`
        }
      });
      console.log(`✅ Saved companion stats to server: ${companionName}`, stats);
    } catch (e) {
      console.error(`❌ Failed to save companion stats to server: ${companionName}`, e);
    }
  };

  // 🔄 동료 목록 새로고침 함수 (TDZ 방지를 위해 일반 함수로 정의)
  const refreshCompanions = async () => {
    if (!username) return;
    
    try {
      const userId = idToken ? 'user' : 'null';
      const params = { username, userUuid };
      
      console.log('🔄 Refreshing companions...', { userId, params });
      const companionsRes = await axios.get(`${serverUrl}/api/companions/${userId}`, { params });
      console.log('✅ Refreshed companions:', companionsRes.data);
      
      setCompanions(companionsRes.data.companions || []);
      
      // 동료 능력치도 함께 새로고침
      try {
        const statsRes = await axios.get(`${serverUrl}/api/companion-stats/${userId}`, { params });
        console.log('✅ Refreshed companion stats:', statsRes.data);
        
        // 서버 데이터를 클라이언트 형식으로 변환 (expToNext 계산)
        const serverStats = statsRes.data.companionStats || {};
        const processedStats = {};
        
        Object.entries(serverStats).forEach(([companionName, stats]) => {
          const level = stats.level || 1;
          const exp = stats.experience || 0; // 서버에서는 experience 필드 사용
          const expToNext = level * 50 + 50; // 레벨당 필요 경험치 계산
          
          processedStats[companionName] = {
            level: level,
            exp: exp,
            expToNext: expToNext,
            hp: calculateCompanionStats(companionName, level)?.hp || 100,
            maxHp: calculateCompanionStats(companionName, level)?.hp || 100,
            isInBattle: stats.isInBattle || false
          };
        });
        
        console.log('✅ Processed refreshed companion stats:', processedStats);
        setCompanionStats(processedStats);
      } catch (e) {
        console.warn('⚠️ Failed to refresh companion stats:', e);
      }
      
    } catch (e) {
      console.error('❌ Failed to refresh companions:', e);
    }
  };

  // 페이지 로드 시 저장된 토큰들 및 게스트 상태 복원
  useEffect(() => {
    const storedIdToken = localStorage.getItem("idToken");
    const storedIsGuest = localStorage.getItem("isGuest");
    const storedJwtToken = localStorage.getItem("jwtToken"); // 🔐 JWT 토큰 복원
    
    if (storedIdToken && !idToken) {
      console.log("Restoring Google token from localStorage:", storedIdToken);
      setIdToken(storedIdToken);
    }
    
    if (storedJwtToken) {
      console.log("🔐 Restoring JWT token from localStorage");
      setJwtToken(storedJwtToken);
    }
    
    if (storedIsGuest === "true") {
      setIsGuest(true);
      console.log("User is a guest");
    }

    // 🚀 페이지 로드 시 localStorage에서 쿨타임 복원
    const storedFishingCooldownEnd = localStorage.getItem('fishingCooldownEnd');
    if (storedFishingCooldownEnd) {
      const cooldownEndTime = new Date(storedFishingCooldownEnd);
      const now = new Date();
      const remainingTime = Math.max(0, cooldownEndTime.getTime() - now.getTime());
      
      if (remainingTime > 0) {
        console.log("Restoring fishing cooldown from localStorage:", remainingTime);
        setFishingCooldown(remainingTime);
        setCooldownLoaded(true);
      } else {
        // 쿠타임이 이미 만료된 경우 localStorage에서 제거
        localStorage.removeItem('fishingCooldownEnd');
        setCooldownLoaded(true);
      }
    } else {
      setCooldownLoaded(true);
    }
  }, []);

  // 전투 로그 자동 스크롤 함수
  const scrollBattleLogToBottom = useCallback(() => {
    if (battleLogRef.current) {
      setTimeout(() => {
        battleLogRef.current.scrollTop = battleLogRef.current.scrollHeight;
      }, 0);
    }
  }, []);

  // 전투 로그 채팅 공유 함수 (간결한 버전)
  const shareBattleLog = useCallback(() => {
    if (!battleState || !username) return;
    
    const socket = getSocket();
    
    // 간결한 전투로그 제목 생성
    const battleSummary = `⚔️ '${username}'님의 전투로그`;
    
    // 상세 정보 (클릭 시 표시할 데이터)
    const battleDetails = {
      username,
      enemy: battleState.enemy,
      result: battleState.turn === 'victory' ? '승리' : battleState.turn === 'defeat' ? '패배' : '도망',
      round: battleState.round,
      playerHp: battleState.playerHp,
      playerMaxHp: battleState.playerMaxHp,
      amberReward: battleState.amberReward || 0,
      companions: battleState.companions || [],
      companionHp: battleState.companionHp || {},
      log: battleState.log || []
    };
    
    // 채팅으로 전송
    const payload = { 
      username, 
      content: battleSummary, 
      timestamp: new Date().toISOString(),
      isBattleLog: true, // 전투 로그임을 표시
      battleDetails: battleDetails // 상세 정보 포함
    };
    
    socket.emit("chat:message", payload);
    
    // 성공 메시지
    console.log("전투 로그가 채팅에 공유되었습니다!");
  }, [battleState, username, getSocket]);

  // 카카오 SDK 초기화
  useEffect(() => {
    const initKakaoSDK = () => {
      if (window.Kakao && !window.Kakao.isInitialized()) {
        try {
          window.Kakao.init('4ca63f8b2f7e43690a060c4571eb7bf0'); // 카카오 JavaScript 앱 키
          console.log('Kakao SDK initialized successfully');
        } catch (error) {
          console.error('Failed to initialize Kakao SDK:', error);
        }
      } else if (!window.Kakao) {
        // SDK가 아직 로드되지 않은 경우 잠시 후 재시도
        setTimeout(initKakaoSDK, 1000);
      }
    };

    initKakaoSDK();
  }, []);

  // 카카오 로그인 처리 함수
  const handleKakaoLogin = async () => {
    console.log('카카오 로그인 시작');
    
    // 1. 기본 SDK 체크
    if (!window.Kakao) {
      console.error('window.Kakao가 존재하지 않음');
      alert('카카오 SDK가 로드되지 않았습니다. 페이지를 새로고침해주세요.');
      return;
    }

    // 2. SDK 초기화 체크
    if (!window.Kakao.isInitialized()) {
      console.log('카카오 SDK 초기화 시도');
      try {
        window.Kakao.init('4ca63f8b2f7e43690a060c4571eb7bf0');
        console.log('카카오 SDK 초기화 완료');
      } catch (error) {
        console.error('카카오 SDK 초기화 실패:', error);
        alert('카카오 SDK 초기화에 실패했습니다.');
        return;
      }
    }

    // 3. Auth 객체 체크
    if (!window.Kakao.Auth) {
      console.error('window.Kakao.Auth가 존재하지 않음');
      alert('카카오 인증 모듈을 찾을 수 없습니다. 페이지를 새로고침해주세요.');
      return;
    }

    // 4. authorize 함수 체크 (최신 SDK에서는 login 대신 authorize 사용)
    if (typeof window.Kakao.Auth.authorize !== 'function') {
      console.error('window.Kakao.Auth.authorize이 함수가 아님:', typeof window.Kakao.Auth.authorize);
      console.log('사용 가능한 Kakao 메소드들:', Object.keys(window.Kakao));
      console.log('사용 가능한 Kakao.Auth 메소드들:', Object.keys(window.Kakao.Auth || {}));
      alert('카카오 로그인 함수를 찾을 수 없습니다. 페이지를 새로고침해주세요.');
      return;
    }

    console.log('모든 체크 완료, 카카오 로그인 실행');

    try {
      // 5. 카카오 로그인 실행 (최신 SDK 방식)
      console.log('카카오 authorize 실행 중...');
      
      // authorize는 Promise를 반환하지 않고 리다이렉트 방식으로 작동
      // 대신 간단한 팝업 방식으로 변경
      window.Kakao.Auth.authorize({
        redirectUri: window.location.origin
      });
      
      // 리다이렉트 후 처리는 페이지 로드 시 URL 파라미터로 처리
      console.log('카카오 로그인 리다이렉트 시작됨');
      
    } catch (error) {
      console.error('카카오 authorize 실행 중 오류:', error);
      
      // authorize가 실패하면 대안으로 간단한 로그인 시도
      try {
        console.log('대안 방법 시도: 카카오 토큰으로 직접 로그인');
        
        // 토큰이 있는지 확인하고 사용자 정보 가져오기
        if (window.Kakao.Auth.getAccessToken()) {
          console.log('기존 카카오 토큰 발견:', window.Kakao.Auth.getAccessToken());
          
          // 사용자 정보 가져오기 (async/await 방식)
          try {
            const response = await new Promise((resolve, reject) => {
              window.Kakao.API.request({
                url: '/v2/user/me',
                success: resolve,
                fail: reject
              });
            });
            
            console.log('Kakao user info:', response);
            
            const kakaoId = response.id;
            const kakaoNickname = response.kakao_account?.profile?.nickname || `카카오사용자${kakaoId}`;
            
            // 카카오 ID 저장 (서버에서 기존 사용자 식별용)
            localStorage.setItem("kakaoId", kakaoId);
            
            console.log("Kakao login - kakaoId:", kakaoId);
            console.log("Kakao login - kakao nickname:", kakaoNickname);
            
            // 서버에서 사용자 설정 로드 시도 (카카오 계정 기반)
            const settings = await loadUserSettings('user', kakaoNickname, '', '', kakaoId);
            
            if (settings && settings.termsAccepted) {
              console.log("Kakao login - existing user with settings:", settings);
              // 기존 사용자로 인식되어 설정이 로드됨
            } else {
              // 새 사용자이거나 이용약관 미동의 - 이용약관과 닉네임 설정 필요
              console.log("Kakao login - new user or terms not accepted, showing terms modal");
              setIsFirstLogin(true);
              setShowTermsModal(true);
              // username은 설정하지 않음 - 모달에서 설정할 예정
            }
            
            // 카카오 토큰 정보 저장
            const accessToken = window.Kakao.Auth.getAccessToken();
            const kakaoToken = `kakao_${kakaoId}_${accessToken}`;
            setIdToken(kakaoToken);
            localStorage.setItem("idToken", kakaoToken);
            
            console.log("Kakao login successful:", existingUserUuid && existingNickname ? existingNickname : kakaoNickname);
          } catch (error) {
            console.error('Failed to get Kakao user info:', error);
            alert('카카오 사용자 정보를 가져오는데 실패했습니다.');
          }
        } else {
          alert('카카오 로그인이 필요합니다. 카카오 웹사이트에서 로그인 후 다시 시도해주세요.');
        }
      } catch (fallbackError) {
        console.error('대안 방법도 실패:', fallbackError);
        alert('카카오 로그인에 실패했습니다. 페이지를 새로고침 후 다시 시도해주세요.');
      }
    }
  };
  
  const battleLogRef = useRef(null); // 전투 로그 자동 스크롤을 위한 ref

  const serverUrl = useMemo(() => {
    const hostname = window.location.hostname;
    const origin = window.location.origin;
    
    console.log('=== Server URL 설정 ===');
    console.log('Hostname:', hostname);
    console.log('Origin:', origin);
    console.log('import.meta.env.PROD:', import.meta.env.PROD);
    console.log('VITE_SERVER_URL:', import.meta.env.VITE_SERVER_URL);
    
    // 배포 환경 감지: hostname이 localhost가 아니면 배포 환경
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      console.log('✅ 배포 환경 감지, serverUrl:', origin);
      return origin;
    }
    
    // 로컬 개발 환경에서만 환경 변수 사용
    const localUrl = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";
    console.log('🔧 로컬 개발 환경, serverUrl:', localUrl);
    return localUrl;
  }, []);

  // 🔐 JWT 인증 헤더를 포함한 axios 요청 함수
  const authenticatedRequest = useMemo(() => {
    const token = jwtToken || localStorage.getItem("jwtToken");
    
    return {
      get: (url, config = {}) => {
        return axios.get(url, {
          ...config,
          headers: {
            ...config.headers,
            ...(token && { Authorization: `Bearer ${token}` })
          }
        });
      },
      post: (url, data, config = {}) => {
        return axios.post(url, data, {
          ...config,
          headers: {
            ...config.headers,
            ...(token && { Authorization: `Bearer ${token}` })
          }
        });
      },
      put: (url, data, config = {}) => {
        return axios.put(url, data, {
          ...config,
          headers: {
            ...config.headers,
            ...(token && { Authorization: `Bearer ${token}` })
          }
        });
      },
      delete: (url, config = {}) => {
        return axios.delete(url, {
          ...config,
          headers: {
            ...config.headers,
            ...(token && { Authorization: `Bearer ${token}` })
          }
        });
      }
    };
  }, [jwtToken]);

  // 🔒 닉네임 검증 함수 (재사용 가능) - v2024.12.19
  const validateNickname = (nickname) => {
    const trimmed = nickname.trim();
    
    // 길이 검증
    if (trimmed.length < 2) {
      return { valid: false, message: "닉네임은 2글자 이상이어야 합니다!" };
    }
    if (trimmed.length > 12) {
      return { valid: false, message: "닉네임은 12글자 이하여야 합니다!" };
    }
    
    // 특수문자 검증 (한글, 영문, 숫자만 허용)
    const nicknameRegex = /^[가-힣a-zA-Z0-9]+$/;
    if (!nicknameRegex.test(trimmed)) {
      return { valid: false, message: "닉네임은 한글, 영문, 숫자만 사용 가능합니다!" };
    }
    
    return { valid: true, message: "", trimmed };
  };

  // 게스트 닉네임 자동 생성 함수
  const generateGuestNickname = () => {
    const randomNum = Math.floor(Math.random() * 9999) + 1;
    return `Guest#${randomNum}`;
  };

  // 게스트 로그인 함수
  const handleGuestLogin = () => {
    const guestName = generateGuestNickname();
    setUsername(guestName);
    setIsGuest(true);
    localStorage.setItem("nickname", guestName);
    localStorage.setItem("isGuest", "true");
  };

  // 쿨타임 상태를 서버에서 가져오는 함수
  const fetchCooldownStatus = async (tempUsername = '', tempUserUuid = '') => {
    try {
      console.log('🔄 Fetching cooldown status from server...');
      
      // localStorage 쿨타임 확인
      const storedFishingCooldownEnd = localStorage.getItem('fishingCooldownEnd');
      const localRemainingTime = (() => {
        if (storedFishingCooldownEnd) {
          const cooldownEndTime = new Date(storedFishingCooldownEnd);
          const now = new Date();
          const remaining = Math.max(0, cooldownEndTime.getTime() - now.getTime());
          console.log('📱 localStorage cooldown:', remaining);
          return remaining;
        }
        return 0;
      })();

      const userId = idToken ? 'user' : 'null';
      const params = { username: tempUsername, userUuid: tempUserUuid };
      const response = await axios.get(`${serverUrl}/api/cooldown/${userId}`, { params });
      const cooldownData = response.data;
      
      console.log("Cooldown status loaded from server:", cooldownData);
      
      const serverCooldown = Math.max(0, cooldownData.fishingCooldown || 0);
      console.log('📡 Server cooldown:', serverCooldown);
      
      // localStorage와 서버 쿨타임 중 더 긴 것 사용
      const maxCooldown = Math.max(localRemainingTime, serverCooldown);
      console.log('⏰ Final cooldown (max of local/server):', maxCooldown);
      
      setFishingCooldown(maxCooldown);
      setCooldownLoaded(true);
      
      // localStorage에 최종 쿨타임 종료 시간 저장
      if (maxCooldown > 0) {
        const fishingEndTime = new Date(Date.now() + maxCooldown);
        localStorage.setItem('fishingCooldownEnd', fishingEndTime.toISOString());
        console.log('💾 Updated localStorage with final cooldown:', fishingEndTime.toISOString());
      } else {
        localStorage.removeItem('fishingCooldownEnd');
        console.log('🗑️ Removed expired cooldown from localStorage');
      }
      
      return maxCooldown;
    } catch (error) {
      console.error('Failed to fetch cooldown status:', error);
      setCooldownLoaded(true);
      return 0;
    }
  };

  // 사용자 설정 관리 함수들
  const loadUserSettings = async (userId = 'null', tempUsername = '', tempUserUuid = '', googleId = '', kakaoId = '') => {
    try {
      const params = { username: tempUsername, userUuid: tempUserUuid, googleId, kakaoId };
      const response = await axios.get(`${serverUrl}/api/user-settings/${userId}`, { params });
      const settings = response.data;
      
      console.log("User settings loaded from server:", settings);
      
      // 상태 업데이트 (displayName을 게임 닉네임으로 사용)
      setUsername(settings.displayName || settings.username || '');
      setUserUuid(settings.userUuid || null);
      setIsDarkMode(settings.darkMode !== undefined ? settings.darkMode : true);
      
      // Socket.IO로 사용자 로그인 정보 전송 (IP 수집용)
      if (settings.userUuid && (settings.displayName || settings.username)) {
        notifyUserLogin(settings.displayName || settings.username, settings.userUuid);
      }
      
      // 쿨타임은 별도 함수로 가져옴 (loadUserSettings와 분리)
      setTimeout(() => {
        fetchCooldownStatus(settings.displayName || settings.username, settings.userUuid);
      }, 100); // 사용자 설정 로드 후 쿨타임 가져오기
      
      // 초기 재료 데이터 로드 (모든 로그인 방식에 적용)
      if (settings.userUuid) {
        try {
          console.log('Loading initial materials data for userUuid:', settings.userUuid);
          const materialsResponse = await axios.get(`${serverUrl}/api/materials/${userId}`, { 
            params: { username: settings.displayName || settings.username, userUuid: settings.userUuid } 
          });
          setMaterials(materialsResponse.data || []);
          console.log('Initial materials loaded:', materialsResponse.data?.length || 0, 'types');
          
          // 추가로 인벤토리도 로드
          try {
            console.log('Loading initial inventory data for userUuid:', settings.userUuid);
            const inventoryResponse = await axios.get(`${serverUrl}/api/inventory/${userId}`, { 
              params: { username: settings.displayName || settings.username, userUuid: settings.userUuid } 
            });
            const safeInventory = Array.isArray(inventoryResponse.data) ? inventoryResponse.data : [];
            setInventory(safeInventory);
            const totalCount = safeInventory.reduce((sum, item) => sum + item.count, 0);
            setMyCatches(totalCount);
            console.log('Initial inventory loaded:', safeInventory.length, 'types, total:', totalCount);
          } catch (inventoryError) {
            console.error("Failed to load initial inventory:", inventoryError);
            setInventory([]);
          }
          
        } catch (materialsError) {
          console.error("Failed to load initial materials:", materialsError);
          setMaterials([]); // 실패 시 빈 배열
        }
      }
      
      // 로컬스토리지에도 최소한의 정보만 저장 (호환성을 위해)
      if (settings.displayName) localStorage.setItem("nickname", settings.displayName);
      if (settings.userUuid) localStorage.setItem("userUuid", settings.userUuid);
      if (settings.originalGoogleId) localStorage.setItem("googleId", settings.originalGoogleId);
      if (settings.originalKakaoId) localStorage.setItem("kakaoId", settings.originalKakaoId);
      localStorage.setItem("darkMode", settings.darkMode.toString());
      
      return settings;
    } catch (error) {
      console.error("Failed to load user settings:", error);
      return null;
    }
  };

  const saveUserSettings = async (updates) => {
    try {
      const userId = idToken ? 'user' : 'null';
      const googleId = localStorage.getItem("googleId");
      const kakaoId = localStorage.getItem("kakaoId");
      const params = { username, userUuid, googleId, kakaoId };
      await axios.post(`${serverUrl}/api/user-settings/${userId}`, updates, { params });
      console.log("User settings saved to server:", updates);
    } catch (error) {
      console.error("Failed to save user settings:", error);
    }
  };

  // 쿨타임 타이머 useEffect - 쿨타임이 로드된 후에만 실행
  useEffect(() => {
    const timerRef = { current: null };
    
    // 쿨타임이 로드되고 0보다 클 때만 타이머 시작
    if (cooldownLoaded && fishingCooldown > 0) {
      timerRef.current = setInterval(() => {
        setFishingCooldown(prev => {
          const newValue = Math.max(0, prev - 1000);
          // 쿨타임이 끝나면 localStorage에서 제거
          if (newValue <= 0) {
            localStorage.removeItem('fishingCooldownEnd');
          }
          return newValue;
        });
      }, 1000);
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fishingCooldown, cooldownLoaded]);

  // 구글 로그인 토큰 처리 함수
  const handleCredentialResponse = async (token) => {
    try {
      setIdToken(token);
      
      // JWT 토큰 디코딩하여 사용자 정보 추출
      const payload = JSON.parse(decodeURIComponent(escape(atob(token.split('.')[1]))));
      const googleName = payload.name || payload.email.split('@')[0];
      
      // 한글 이름이 깨지는 경우 이메일 주소 사용
      const safeName = googleName.includes('?') || googleName.includes('�') 
        ? payload.email.split('@')[0] 
        : googleName;
      
      // 구글 ID 저장 (재로그인 시 기존 사용자 식별용)
      localStorage.setItem("googleId", payload.sub);
      
      console.log("Google login - current googleId:", payload.sub);
      console.log("Google login - google name:", safeName);
      
      // 서버에서 사용자 설정 로드 시도 (구글 계정 기반)
      const settings = await loadUserSettings('user', safeName, '', payload.sub);
      
      if (settings && settings.termsAccepted) {
        console.log("Google login - existing user with settings:", settings);
        // 기존 사용자로 인식되어 설정이 로드됨 (재료는 loadUserSettings에서 자동 로드됨)
      } else {
        // 새 사용자이거나 이용약관 미동의 - 이용약관과 닉네임 설정 필요
        console.log("Google login - new user or terms not accepted, showing terms modal");
        setIsFirstLogin(true);
        setShowTermsModal(true);
        // username은 설정하지 않음 - 모달에서 설정할 예정
      }
      localStorage.setItem("idToken", token);
      
      console.log("Google login successful:", settings?.username || safeName);
    } catch (error) {
      console.error("Failed to process Google login:", error);
      // 오류 발생 시 이메일 주소 사용
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const fallbackName = payload.email.split('@')[0];
        
        // 기존 닉네임 우선 사용
        const existingNickname = localStorage.getItem("nickname");
        const existingUserUuid = localStorage.getItem("userUuid");
        
        // 기존 사용자인 경우 기존 닉네임 보존
        if (existingUserUuid && existingNickname) {
          setUsername(existingNickname);
        } else {
          setUsername(fallbackName);
          localStorage.setItem("nickname", fallbackName);
        }
        localStorage.setItem("idToken", token);
      } catch (fallbackError) {
        console.error("Fallback parsing also failed:", fallbackError);
      }
    }
  };

  // 전역으로 함수 노출 (팝업에서 접근 가능하도록)
  useEffect(() => {
    window.handleCredentialResponse = handleCredentialResponse;
    return () => {
      delete window.handleCredentialResponse;
    };
  }, []);

  // URL에서 ID 토큰 처리 (리디렉션 후)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.hash.substring(1));
    const searchParams = new URLSearchParams(window.location.search);
    
    // 구글 ID 토큰 처리
    const idToken = urlParams.get('id_token');
    if (idToken) {
      // 팝업 창에서 실행 중인지 확인
      if (window.opener && !window.opener.closed) {
        // 팝업 창에서 부모 창으로 메시지 전송
        window.opener.postMessage({
          type: 'GOOGLE_LOGIN_SUCCESS',
          idToken: idToken
        }, window.location.origin);
        window.close();
      } else {
        // 일반 리디렉션인 경우
        handleCredentialResponse(idToken);
        // URL에서 토큰 제거
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
    
    // 카카오 인증 코드 처리
    const kakaoCode = searchParams.get('code');
    const kakaoState = searchParams.get('state');
    
    if (kakaoCode && window.location.search.includes('code=')) {
      console.log('카카오 인증 코드 감지:', kakaoCode);
      
      // 카카오 SDK로 토큰 교환
      if (window.Kakao && window.Kakao.Auth) {
        try {
          // 서버를 통해 토큰 교환 (CORS 문제 해결)
          const handleKakaoTokenExchange = async () => {
            try {
              const requestData = {
                code: kakaoCode,
                redirectUri: window.location.origin
              };
              
              console.log('=== 카카오 토큰 교환 요청 ===');
              console.log('Server URL:', serverUrl);
              console.log('Request Data:', requestData);
              console.log('Current Origin:', window.location.origin);
              console.log('Current Href:', window.location.href);
              
              const response = await fetch(`${serverUrl}/api/kakao-token`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
              });
              
              console.log('=== 카카오 토큰 교환 응답 ===');
              console.log('Response Status:', response.status);
              console.log('Response OK:', response.ok);
              
              const tokenData = await response.json();
              console.log('Response Data:', tokenData);
              
              if (tokenData.access_token) {
                console.log('✅ 카카오 토큰 교환 성공:', tokenData);
                
                // SDK에 토큰 설정
                window.Kakao.Auth.setAccessToken(tokenData.access_token);
                
                // 사용자 정보 가져오기 (id_token에서 직접 추출 + API 호출)
                try {
                  let kakaoId, kakaoNickname;
                  
                  // 먼저 id_token에서 정보 추출 시도
                  if (tokenData.id_token) {
                    try {
                      const payload = JSON.parse(atob(tokenData.id_token.split('.')[1]));
                      console.log('Kakao id_token payload:', payload);
                      kakaoId = payload.sub;
                      kakaoNickname = payload.nickname || `카카오사용자${kakaoId}`;
                      console.log('✅ 카카오 사용자 정보 (id_token에서):', { kakaoId, kakaoNickname });
                    } catch (tokenError) {
                      console.error('Failed to parse id_token:', tokenError);
                    }
                  }
                  
                  // id_token 파싱이 실패했으면 API로 사용자 정보 가져오기
                  if (!kakaoId) {
                    console.log('Trying to get user info via API...');
                    const userResponse = await new Promise((resolve, reject) => {
                      window.Kakao.API.request({
                        url: '/v2/user/me',
                        success: resolve,
                        fail: reject
                      });
                    });
                    
                    console.log('Kakao user info from API:', userResponse);
                    kakaoId = userResponse.id;
                    kakaoNickname = userResponse.kakao_account?.profile?.nickname || `카카오사용자${kakaoId}`;
                  }
                  
                  // 카카오 ID 저장 (서버에서 기존 사용자 식별용)
                  localStorage.setItem("kakaoId", kakaoId);
                  
                  // 서버에서 사용자 설정 로드 시도 (카카오 계정 기반)
                  const settings = await loadUserSettings('user', kakaoNickname, '', '', kakaoId);
                  
                  if (settings && settings.termsAccepted) {
                    console.log("Kakao redirect - existing user with settings:", settings);
                    // 기존 사용자로 인식되어 설정이 로드됨
                  } else {
                    // 새 사용자이거나 이용약관 미동의 - 이용약관과 닉네임 설정 필요
                    console.log("Kakao redirect - new user or terms not accepted, showing terms modal");
                    setIsFirstLogin(true);
                    setShowTermsModal(true);
                    // username은 설정하지 않음 - 모달에서 설정할 예정
                  }
                  
                  // 카카오 토큰 정보 저장
                  const kakaoToken = `kakao_${kakaoId}_${tokenData.access_token}`;
                  setIdToken(kakaoToken);
                  localStorage.setItem("idToken", kakaoToken);
                  
                  console.log("Kakao login from redirect successful");
                  
                  // URL에서 인증 코드 제거
                  window.history.replaceState({}, document.title, window.location.pathname);
                } catch (error) {
                  console.error('Failed to get Kakao user info from redirect:', error);
                }
              } else {
                console.error('❌ 카카오 토큰 교환 실패:', tokenData);
                if (tokenData.error) {
                  console.error('카카오 오류 상세:', tokenData.error);
                }
                if (tokenData.details) {
                  console.error('서버 오류 상세:', tokenData.details);
                }
              }
            } catch (error) {
              console.error('❌ 카카오 토큰 요청 오류:', error);
              console.error('오류 타입:', error.name);
              console.error('오류 메시지:', error.message);
              if (error.stack) {
                console.error('오류 스택:', error.stack);
              }
            }
          };
          
          // 함수 실행
          handleKakaoTokenExchange();
        } catch (error) {
          console.error('카카오 리다이렉트 처리 오류:', error);
        }
      }
    }
  }, []);

  useEffect(() => {
    console.log("useEffect [username, idToken] triggered:", { username, idToken, userUuid });
    console.log("Current localStorage nickname:", localStorage.getItem("nickname"));
    console.log("Current localStorage userUuid:", localStorage.getItem("userUuid"));
    // username이 없어도 idToken이 있으면 소켓 연결 (이용약관 모달을 위해)
    if (!username && !idToken) return;
    const socket = getSocket();

    const onMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
      if (msg.system && msg.content.includes("낚았습니다")) {
        console.log("Fish caught message detected:", msg.content);
        console.log("Current username:", username);
        
        // 자신의 낚시인지 확인 (더 안전한 매칭)
        const isMyFish = msg.content.includes(`${username} 님이`) || 
                        msg.content.includes(username);
        
        if (isMyFish) {
          console.log("This is my fish, updating inventory...");
          // [퀘스트] 낚시 퀘스트 진행도 업데이트
          updateQuestProgress('fish_caught', 1);
          // 인벤토리 즉시 업데이트
          setTimeout(() => {
            const fetchInventory = async () => {
              try {
                const userId = idToken ? 'user' : 'null';
                const params = { username, userUuid }; // username과 userUuid 모두 전달
                            console.log("Fetching inventory with params:", { userId, username, userUuid });
            const res = await axios.get(`${serverUrl}/api/inventory/${userId}`, { params });
            console.log("Inventory response:", res.data);
            console.log("Current userUuid state:", userUuid);
            const safeInventory = Array.isArray(res.data) ? res.data : [];
            setInventory(safeInventory);
            console.log("Inventory updated");
              } catch (e) {
                console.error('Failed to fetch inventory:', e);
              }
            };
            fetchInventory();
          }, 1000); // 1초로 증가하여 DB 저장 완료 대기
        } else {
          console.log("Not my fish, skipping inventory update");
        }
      }
    };

    const onUsersUpdate = (users) => {
      console.log("=== USERS UPDATE DEBUG ===");
      console.log("Received users list:", users);
      console.log("Users count:", users?.length || 0);
      
      // 실시간 업데이트 데이터 검증
      if (!Array.isArray(users)) {
        console.error('Invalid users update format:', users);
        return;
      }
      
      // 사용자 데이터 유효성 재검증
      const validUsers = users.filter(user => {
        if (!user.userUuid || !user.username) {
          console.warn('Invalid user in real-time update:', user);
          return false;
        }
        return true;
      });
      
      // 중복 제거
      const uniqueUsers = validUsers.reduce((acc, user) => {
        const existingIndex = acc.findIndex(u => u.userUuid === user.userUuid);
        if (existingIndex >= 0) {
          // 더 최근 데이터로 교체
          if (!acc[existingIndex].joinTime || (user.joinTime && user.joinTime > acc[existingIndex].joinTime)) {
            acc[existingIndex] = user;
          }
        } else {
          acc.push(user);
        }
        return acc;
      }, []);
      
      console.log(`Real-time update: ${uniqueUsers.length} validated users`);
      // 유효한 사용자가 있을 때만 업데이트 (기존 목록 유지)
      if (uniqueUsers.length > 0) {
        setConnectedUsers(uniqueUsers); // connectedUsers 상태 업데이트
        setOnlineUsers(uniqueUsers);
        setIsLoadingUsers(false);
      }
    };

    const onReactionUpdate = (data) => {
      const { messageIndex, reactionType, username: reactingUser, messageId, currentReaction } = data;
      
      setMessages(prevMessages => {
        const newMessages = [...prevMessages];
        const message = newMessages[messageIndex];
        
        if (message) {
          // reactions 객체가 없으면 생성
          if (!message.reactions) {
            message.reactions = {};
          }
          
          // 먼저 사용자의 기존 반응을 모두 제거
          Object.keys(message.reactions).forEach(type => {
            const userIndex = message.reactions[type].indexOf(reactingUser);
            if (userIndex !== -1) {
              message.reactions[type].splice(userIndex, 1);
              // 배열이 비었으면 삭제
              if (message.reactions[type].length === 0) {
                delete message.reactions[type];
              }
            }
          });
          
          // 같은 반응을 다시 누른 게 아니라면 새로운 반응 추가
          if (currentReaction !== reactionType) {
            // 해당 반응 타입의 배열이 없으면 생성
            if (!message.reactions[reactionType]) {
              message.reactions[reactionType] = [];
            }
            
            // 새로운 반응 추가
            message.reactions[reactionType].push(reactingUser);
          }
          
          // reactions 객체가 비었으면 삭제
          if (Object.keys(message.reactions).length === 0) {
            delete message.reactions;
          }
        }
        
        return newMessages;
      });
    };

    const onUserUuid = (data) => {
      console.log("=== USER UUID UPDATE DEBUG ===");
      console.log("Received UUID data:", data);
      console.log("Previous userUuid state:", userUuid);
      console.log("Previous username state:", username);
      console.log("Previous localStorage nickname:", localStorage.getItem("nickname"));
      
      // 서버에서 저장된 displayName 우선 사용
      const serverDisplayName = data.displayName;
      const currentStoredNickname = localStorage.getItem("nickname");
      
      console.log("Current stored nickname:", currentStoredNickname);
      console.log("Server nickname:", data.username);
      console.log("Server displayName:", serverDisplayName);
      
      // UUID는 항상 업데이트
      setUserUuid(data.userUuid);
      localStorage.setItem("userUuid", data.userUuid);
      
      // 우선순위: 서버의 displayName > 로컬스토리지 닉네임 > 서버 username
      const finalNickname = (() => {
      if (serverDisplayName && serverDisplayName !== data.username) {
        // 서버에 저장된 displayName이 있고 기본 username과 다른 경우 (사용자가 변경한 경우)
        console.log("Using server displayName:", serverDisplayName);
          return serverDisplayName;
      } else if (currentStoredNickname) {
        // 로컬스토리지에 저장된 닉네임이 있는 경우
        console.log("Using stored nickname:", currentStoredNickname);
          return currentStoredNickname;
      } else {
        // 기본값으로 서버 username 사용
        console.log("Using server username:", data.username);
          return data.username;
      }
      })();
      
      setUsername(finalNickname);
      localStorage.setItem("nickname", finalNickname);
      
      console.log("Updated userUuid state to:", data.userUuid);
      console.log("Final username state:", finalNickname);
      console.log("Final localStorage nickname:", localStorage.getItem("nickname"));
      
      // UUID 업데이트 후 인벤토리 새로고침
      setTimeout(() => {
        const fetchInventory = async () => {
          try {
            const userId = idToken ? 'user' : 'null';
            const finalNickname = currentStoredNickname || data.username;
            const params = { username: finalNickname, userUuid: data.userUuid };
            console.log("Refreshing inventory after UUID update:", { userId, username: finalNickname, userUuid: data.userUuid });
            const res = await axios.get(`${serverUrl}/api/inventory/${userId}`, { params });
            console.log("Inventory after UUID update:", res.data);
            const safeInventory = Array.isArray(res.data) ? res.data : [];
            setInventory(safeInventory);
            const totalCount = safeInventory.reduce((sum, item) => sum + item.count, 0);
            setMyCatches(totalCount);
          } catch (e) {
            console.error('Failed to refresh inventory after UUID update:', e);
          }
        };
        fetchInventory();
      }, 500);
    };

    socket.on("chat:message", onMessage);
    socket.on("users:update", onUsersUpdate);
    socket.on("user:uuid", onUserUuid);
    socket.on("message:reaction:update", onReactionUpdate);
    
    // 🔐 JWT 토큰 처리
    socket.on("auth:token", (data) => {
      console.log("🔐 JWT token received from server");
      if (data.token) {
        localStorage.setItem("jwtToken", data.token);
        localStorage.setItem("jwtExpiresIn", data.expiresIn);
        setJwtToken(data.token); // 🔐 상태 업데이트로 authenticatedRequest 재생성
        console.log(`🔐 JWT token stored, expires in: ${data.expiresIn}`);
      }
    });
    
    // 중복 로그인 알림 처리
    const onDuplicateLogin = (data) => {
      alert(data.message);
      // 로그아웃 처리
      localStorage.removeItem("idToken");
      localStorage.removeItem("nickname");
      localStorage.removeItem("userUuid");
      window.location.reload();
    };
    
    socket.on("duplicate_login", onDuplicateLogin);
    
    // 입장 에러 처리 (닉네임 중복 등)
    const onJoinError = (data) => {
      console.error("Join error:", data);
      if (data.type === "NICKNAME_TAKEN") {
        alert(`❌ ${data.message}\n\n다른 닉네임을 사용해 주세요.`);
        // 게스트 사용자인 경우 닉네임 입력으로 돌아가기
        if (!idToken) {
          setUsername("");
          setUsernameInput("");
          localStorage.removeItem("nickname");
          localStorage.removeItem("userUuid");
        }
      } else {
        alert(`입장 실패: ${data.message}`);
      }
    };
    
    socket.on("join:error", onJoinError);
    
    // 채팅 에러 처리 (스팸 방지 등)
    const onChatError = (data) => {
      console.error("Chat error:", data);
      alert(`💬 ${data.message}`);
    };
    
    socket.on("chat:error", onChatError);
    
    // 소켓 연결 에러 처리 (IP 차단 등)
    const onConnectError = (error) => {
      console.error("Socket connection error:", error);
      if (error.message) {
        if (error.message.includes('blocked') || error.message.includes('차단')) {
          alert(`🚫 접속이 차단되었습니다.\n\n사유: ${error.message}\n\n관리자에게 문의하세요.`);
        } else {
          alert(`연결 오류: ${error.message}`);
        }
      }
    };
    
    socket.on("connect_error", onConnectError);
    
    // 계정 차단 알림 처리
    const onAccountBlocked = (blockInfo) => {
      console.error("Account blocked:", blockInfo);
      alert(`🚫 계정이 차단되었습니다.\n\n차단 사유: ${blockInfo.reason}\n차단 일시: ${blockInfo.blockedAt}\n차단자: ${blockInfo.blockedBy}\n\n관리자에게 문의하세요.`);
      // 로그아웃 처리
      localStorage.clear();
      window.location.reload();
    };
    
    socket.on("account-blocked", onAccountBlocked);
    
    console.log("=== CLIENT CHAT:JOIN DEBUG ===");
    
    // 로컬스토리지에서 최신 닉네임 확인 (구글 로그인 후 덮어쓰기 방지)
    const currentStoredNickname = localStorage.getItem("nickname");
    const currentStoredUuid = localStorage.getItem("userUuid");
    const finalUsernameToSend = currentStoredUuid && currentStoredNickname ? currentStoredNickname : username;
    
    console.log("Current state username:", username);
    console.log("Current localStorage nickname:", currentStoredNickname);
    console.log("Current localStorage userUuid:", currentStoredUuid);
    console.log("Final username to send:", finalUsernameToSend);
    console.log("Emitting chat:join with:", { username: finalUsernameToSend, idToken: !!idToken, userUuid });
    
    // 최종 안전장치: 로컬스토리지 닉네임 강제 사용
    const emergencyNickname = localStorage.getItem("nickname");
    const emergencyUuid = localStorage.getItem("userUuid");
    const safeUsername = (emergencyUuid && emergencyNickname) ? emergencyNickname : (finalUsernameToSend || "");
    
    console.log("=== EMERGENCY NICKNAME CHECK ===");
    console.log("Emergency nickname from localStorage:", emergencyNickname);
    console.log("Emergency UUID from localStorage:", emergencyUuid);
    console.log("Safe username (final):", safeUsername);
    
    // username이 없어도 idToken이 있으면 소켓 연결 (이용약관 모달을 위해)
    if (safeUsername || idToken) {
    socket.emit("chat:join", { username: safeUsername, idToken, userUuid });
    }

    return () => {
      socket.off("chat:message", onMessage);
      socket.off("users:update", onUsersUpdate);
      socket.off("user:uuid", onUserUuid);
      socket.off("message:reaction:update", onReactionUpdate);
      socket.off("duplicate_login", onDuplicateLogin);
      socket.off("join:error", onJoinError);
      socket.off("chat:error", onChatError);
      socket.off("connect_error", onConnectError);
      socket.off("account-blocked", onAccountBlocked);
    };
  }, [username, idToken]);


  // 🚀 재료 가져오기 함수 (전역에서 사용 가능) - useCallback으로 최적화
  const fetchMaterials = useCallback(async () => {
    if (!username) return;
    try {
      const userId = idToken ? 'user' : 'null';
      const params = { username, userUuid }; // username과 userUuid 모두 전달
      console.log('🔄 Fetching materials...', { userId, params });
      const res = await axios.get(`${serverUrl}/api/materials/${userId}`, { params });
      console.log('✅ Materials response:', res.data);
      setMaterials(res.data || []);
    } catch (e) {
      console.error("❌ Failed to fetch materials:", e);
      console.error("Materials error details:", {
        status: e.response?.status,
        data: e.response?.data,
        message: e.message
      });
    }
  }, [serverUrl, username, userUuid, idToken]);

  // 🚀 Socket을 통한 병렬 데이터 요청 함수 (성능 최적화)
  const requestAllDataParallel = useCallback(() => {
    if (!username || !userUuid || !socket) return;
    
    console.log('🚀 Requesting all data in parallel via Socket...');
    socket.emit('data:request', { type: 'all', userUuid, username });
  }, [username, userUuid, socket]);

  // 🚀 자주 사용되는 계산들을 useMemo로 최적화
  const memoizedInventoryCount = useMemo(() => {
    return inventory.reduce((total, item) => total + item.count, 0);
  }, [inventory]);

  const memoizedMaterialsCount = useMemo(() => {
    return materials.reduce((total, item) => total + item.count, 0);
  }, [materials]);

  const memoizedTotalValue = useMemo(() => {
    return inventory.reduce((total, item) => {
      const fishPrice = getFishPrice(item.fish, userEquipment);
      return total + (fishPrice * item.count);
    }, 0);
  }, [inventory, getFishPrice, userEquipment]);

  // 🚀 현재 사용 가능한 물고기 배열을 useMemo로 최적화
  const fishTypes = useMemo(() => {
    if (!allFishTypes.length || !probabilityTemplate.length) {
      return []; // 🔧 데이터가 로드되지 않았으면 빈 배열 반환
    }
    return getAvailableFish(fishingSkill);
  }, [fishingSkill, allFishTypes, probabilityTemplate]);

  // WebSocket을 통한 실시간 데이터 동기화
  useEffect(() => {
    if (!username || !userUuid || !socket) return;

    // 데이터 구독
    socket.emit('data:subscribe', { userUuid, username });
    
    // 🚀 초기 데이터를 병렬로 요청 (성능 최적화)
    setTimeout(() => {
      requestAllDataParallel();
      
      // 추가로 재료와 인벤토리, 동료 데이터 직접 요청 (확실한 로딩을 위해)
      console.log('🔄 Requesting materials, inventory, and companions directly...');
      fetchMaterials();
      
      // 인벤토리도 직접 요청
      const fetchInventoryDirect = async () => {
        try {
          const userId = idToken ? 'user' : 'null';
          const params = { username, userUuid };
          const res = await axios.get(`${serverUrl}/api/inventory/${userId}`, { params });
          const safeInventory = Array.isArray(res.data) ? res.data : [];
          setInventory(safeInventory);
          const totalCount = safeInventory.reduce((sum, item) => sum + item.count, 0);
          setMyCatches(totalCount);
          console.log('✅ Direct inventory loaded:', safeInventory.length, 'types, total:', totalCount);
        } catch (e) {
          console.error("❌ Failed to fetch inventory directly:", e);
        }
      };
      fetchInventoryDirect();
      
      // 동료 데이터도 WebSocket으로 직접 요청
      console.log('🔄 Requesting companions via WebSocket...');
      socket.emit('data:request', { type: 'companions', userUuid, username });
      
    }, 1000); // 연결 안정화 후 요청

    // 실시간 데이터 업데이트 리스너
    const handleDataUpdate = (data) => {
      console.log('Received data update:', data);
      if (data.inventory) {
        const safeInventory = Array.isArray(data.inventory) ? data.inventory : [];
        setInventory(safeInventory);
      }
      if (data.materials) setMaterials(data.materials);
      if (data.money) setUserMoney(data.money.money);
      if (data.amber) setUserAmber(data.amber.amber);
      if (data.starPieces) setUserStarPieces(data.starPieces.starPieces);
      if (data.cooldown) {
        const newFishingCooldown = data.cooldown.fishingCooldown || 0;
        
        console.log('📡 Received cooldown update from server:', newFishingCooldown);
        
        // localStorage 쿨타임과 비교해서 더 긴 쿨타임 사용
        const storedFishingCooldownEnd = localStorage.getItem('fishingCooldownEnd');
        const calculatedCooldown = (() => {
          if (storedFishingCooldownEnd) {
            const cooldownEndTime = new Date(storedFishingCooldownEnd);
            const now = new Date();
            const localRemainingTime = Math.max(0, cooldownEndTime.getTime() - now.getTime());
            
            // localStorage의 쿨타임이 더 길면 그것을 사용
            if (localRemainingTime > newFishingCooldown) {
              console.log('📱 Using localStorage cooldown (longer):', localRemainingTime);
              return localRemainingTime;
            } else {
              console.log('📡 Using server cooldown:', newFishingCooldown);
              return newFishingCooldown;
            }
          }
          return newFishingCooldown;
        })();
        
        setFishingCooldown(calculatedCooldown);
        setCooldownLoaded(true);
        
        // localStorage에 최종 쿨타임 종료 시간 저장
        if (calculatedCooldown > 0) {
          const fishingEndTime = new Date(Date.now() + calculatedCooldown);
          localStorage.setItem('fishingCooldownEnd', fishingEndTime.toISOString());
          console.log('💾 Saved cooldown to localStorage:', fishingEndTime.toISOString());
        } else {
          localStorage.removeItem('fishingCooldownEnd');
          console.log('🗑️ Removed cooldown from localStorage (expired)');
        }
      }
      if (data.totalCatches) setMyCatches(data.totalCatches.totalCatches);
      if (data.companions) {
        console.log('🔄 Updating companions via WebSocket:', data.companions.companions);
        setCompanions(data.companions.companions);
      }
      if (data.adminStatus) {
        setUserAdminStatus(prev => ({ ...prev, [username]: data.adminStatus.isAdmin }));
      }
      if (data.equipment) setUserEquipment(data.equipment);
    };

    const handleInventoryUpdate = (data) => {
      const safeInventory = Array.isArray(data) ? data : [];
      setInventory(safeInventory);
    };
    const handleMaterialsUpdate = (data) => setMaterials(data);
    const handleUsersUpdate = (users) => {
      console.log('Received users update via WebSocket:', users);
      // 빈 배열이 아닌 경우에만 업데이트 (기존 목록 유지)
      if (Array.isArray(users) && users.length > 0) {
        setConnectedUsers(users);
        setIsLoadingUsers(false);
      }
    };

    socket.on('data:update', handleDataUpdate);
    socket.on('data:inventory', handleInventoryUpdate);
    socket.on('data:materials', handleMaterialsUpdate);
    socket.on('users:update', handleUsersUpdate);
    
    // 개별 데이터 업데이트 이벤트 처리
    socket.on('data:companions', (data) => {
      console.log('🔄 Received companions update via WebSocket:', data);
      if (data && Array.isArray(data.companions)) {
        setCompanions(data.companions);
      }
    });
    
    socket.on('data:starPieces', (data) => {
      console.log('🔄 Received starPieces update via WebSocket:', data);
      if (data && typeof data.starPieces === 'number') {
        setUserStarPieces(data.starPieces);
      }
    });

    return () => {
      socket.off('data:update', handleDataUpdate);
      socket.off('data:inventory', handleInventoryUpdate);
      socket.off('data:materials', handleMaterialsUpdate);
      socket.off('users:update', handleUsersUpdate);
      socket.off('data:companions');
      socket.off('data:starPieces');
      // 데이터 구독 해제
      socket.emit('data:unsubscribe', { userUuid, username });
    };
  }, [username, userUuid, socket]);

  // 사용자 돈은 WebSocket으로 실시간 업데이트됨 (위에서 처리)

  // 사용자 호박석, 별조각은 WebSocket으로 실시간 업데이트됨 (위에서 처리)

  // 🚀 사용자 동료 정보와 관리자 상태를 병렬로 가져오기 (성능 최적화)
  useEffect(() => {
    if (!username) return;
    
    const fetchUserData = async () => {
      try {
        const userId = idToken ? 'user' : 'null';
        const params = { username, userUuid };
        
        // 병렬 처리로 동료 정보와 관리자 상태 동시 조회
        console.log('🔄 Fetching companions and admin status...', { userId, params });
        const [companionsRes, adminStatusRes] = await Promise.all([
          axios.get(`${serverUrl}/api/companions/${userId}`, { params }),
          axios.get(`${serverUrl}/api/admin-status/${userId}`, { params })
        ]);
        
        console.log('✅ Companions response:', companionsRes.data);
        console.log('✅ Admin status response:', adminStatusRes.data);
        
        setCompanions(companionsRes.data.companions || []);
        setIsAdmin(adminStatusRes.data.isAdmin || false);
        setAdminStatusLoaded(true); // 관리자 상태 로드 완료
        
        // 동료 능력치 서버에서 불러오기
        try {
          const statsRes = await axios.get(`${serverUrl}/api/companion-stats/${userId}`, { params });
          console.log('✅ Loaded companion stats from server:', statsRes.data);
          
          // 서버 데이터를 클라이언트 형식으로 변환 (expToNext 계산)
          const serverStats = statsRes.data.companionStats || {};
          const processedStats = {};
          
          Object.entries(serverStats).forEach(([companionName, stats]) => {
            const level = stats.level || 1;
            const exp = stats.experience || 0; // 서버에서는 experience 필드 사용
            const expToNext = level * 50 + 50; // 레벨당 필요 경험치 계산
            
            processedStats[companionName] = {
              level: level,
              exp: exp,
              expToNext: expToNext,
              hp: calculateCompanionStats(companionName, level)?.hp || 100,
              maxHp: calculateCompanionStats(companionName, level)?.hp || 100,
              isInBattle: stats.isInBattle || false
            };
          });
          
          console.log('✅ Processed companion stats:', processedStats);
          setCompanionStats(processedStats);
        } catch (e) {
          console.warn('⚠️ Failed to load companion stats from server, using localStorage fallback:', e);
          // 서버 실패 시 localStorage 폴백
          const savedStats = localStorage.getItem(`companionStats_${userUuid || username}`);
          if (savedStats) {
            try {
              const parsedStats = JSON.parse(savedStats);
              console.log('✅ Restored companion stats from localStorage:', parsedStats);
              setCompanionStats(parsedStats);
            } catch (e) {
              console.error('❌ Failed to parse companion stats from localStorage:', e);
            }
          }
        }
        
      } catch (e) {
        console.error('Failed to fetch user data:', e);
        setCompanions([]);
        setIsAdmin(false);
        setAdminStatusLoaded(true); // 오류가 발생해도 로드 완료로 표시
      }
    };
    
    fetchUserData();
  }, [serverUrl, username, userUuid, idToken]);

  // 🔄 동료 능력치 변경 시 서버에 저장
  useEffect(() => {
    if (!jwtToken || !username || Object.keys(companionStats).length === 0) return;
    
    // 각 동료의 능력치를 서버에 저장
    Object.entries(companionStats).forEach(([companionName, stats]) => {
      saveCompanionStatsToServer(companionName, stats);
    });
    
    // localStorage에도 백업 저장
    localStorage.setItem(`companionStats_${userUuid || username}`, JSON.stringify(companionStats));
  }, [companionStats, jwtToken, username, userUuid]);

  // 채팅 메시지의 사용자들 관리자 상태 확인
  useEffect(() => {
    const uniqueUsernames = [...new Set(
      messages
        .filter(m => !m.system && m.username && m.username !== username)
        .map(m => m.username)
    )];
    
    uniqueUsernames.forEach(async (user) => {
      if (!userAdminStatus.hasOwnProperty(user)) {
        await checkUserAdminStatus(user);
      }
    });
  }, [messages, username, serverUrl]);

  // 접속자 목록 가져오기 (관리자만)
  useEffect(() => {
    const fetchConnectedUsers = async () => {
      console.log('🔍 DEBUG - Connected users fetch attempt:', {
        adminStatusLoaded,
        isAdmin,
        username,
        jwtToken: jwtToken ? 'EXISTS' : 'MISSING'
      });
      
      // 관리자 상태가 로드되지 않았거나 관리자가 아니면 접속자 목록을 가져오지 않음
      if (!adminStatusLoaded || !isAdmin) {
        console.log('🚫 Skipping connected users fetch - not admin or not loaded');
        return;
      }
      
      // 브라우저 탭이 비활성화되었거나 사용자가 없으면 요청 중단
      if (document.hidden || !username || !userUuid || !jwtToken) {
        console.log('Skipping API call - tab inactive or user not available');
        return;
      }
      
      try {
        console.log('Fetching connected users (admin only)');
        const res = await axios.get(`${serverUrl}/api/connected-users`, {
          headers: {
            'Authorization': `Bearer ${jwtToken}`
          }
        });
        console.log('Connected users response:', res.data);
        
        // 서버 응답 검증
        if (!res.data.users || !Array.isArray(res.data.users)) {
          console.error('Invalid connected users response format');
          return;
        }
        
        // 사용자 데이터 유효성 검증
        const validUsers = res.data.users.filter(user => {
          // 필수 필드 검증
          if (!user.userUuid || !user.username) {
            console.warn('Invalid user data:', user);
            return false;
          }
          
          // 체크섬 검증 (선택적 - 서버에서 제공하는 경우)
          if (user.checksum) {
            // 클라이언트에서는 체크섬을 검증할 수 없지만, 존재 여부는 확인
            console.log(`User ${user.username} has checksum: ${user.checksum}`);
          }
          
          return true;
        });
        
        // 중복 사용자 제거 (userUuid 기준)
        const uniqueUsers = validUsers.reduce((acc, user) => {
          const existingIndex = acc.findIndex(u => u.userUuid === user.userUuid);
          if (existingIndex >= 0) {
            // 더 최근 데이터로 교체
            if (user.lastSeen > acc[existingIndex].lastSeen) {
              acc[existingIndex] = user;
            }
          } else {
            acc.push(user);
          }
          return acc;
        }, []);
        
        console.log(`Validated ${uniqueUsers.length} unique users out of ${res.data.users.length} received`);
        // 유효한 사용자가 있을 때만 업데이트 (0명일 때 기존 목록 유지)
        if (uniqueUsers.length > 0) {
          setConnectedUsers(uniqueUsers);
          setIsLoadingUsers(false);
        } else {
          console.log('⚠️ Received 0 users, keeping existing list to prevent flickering');
          // 첫 로딩이라면 로딩 상태 해제
          if (isLoadingUsers) {
            setIsLoadingUsers(false);
          }
        }
        
        // 접속자들의 관리자 상태도 확인
        uniqueUsers.forEach(async (user) => {
          if (user.username !== username && !userAdminStatus.hasOwnProperty(user.username)) {
            await checkUserAdminStatus(user.username);
          }
        });
      } catch (e) {
        console.error('Failed to fetch connected users:', e);
        // 네트워크 오류 시 기존 목록 유지 (빈 배열로 초기화하지 않음)
        // setConnectedUsers([]) <- 이 코드는 제거하여 기존 목록 유지
      }
    };
    
    if (username && adminStatusLoaded && isAdmin) {
      fetchConnectedUsers();
      const id = setInterval(fetchConnectedUsers, 15000); // 15초마다 새로고침 (최적화)
      return () => clearInterval(id);
    }
  }, [serverUrl, username, adminStatusLoaded, isAdmin, jwtToken]);

  // 쿨타임과 총 낚은 수는 WebSocket으로 실시간 업데이트됨 (위에서 처리)

  // 랭킹 데이터 가져오기 (자주 변경되지 않으므로 주기 증가)
  useEffect(() => {
    const fetchRankings = async () => {
      // 브라우저 탭이 비활성화되었으면 요청 중단
      if (document.hidden) {
        console.log('Skipping ranking API call - tab inactive');
        return;
      }
      
      try {
        const res = await axios.get(`${serverUrl}/api/ranking`);
        setRankings(res.data.rankings || []);
      } catch (e) {
        console.error('Failed to fetch rankings:', e);
        setRankings([]);
      }
    };
    
    fetchRankings();
    const id = setInterval(fetchRankings, 60000); // 60초마다 랭킹 새로고침 (최적화)
    return () => clearInterval(id);
  }, [serverUrl]);

  // 🚀 사용자 장비 정보와 낚시실력을 병렬로 가져오기 (성능 최적화)
  useEffect(() => {
    if (!username) return;
    
    const fetchUserGameData = async () => {
      try {
        const userId = idToken ? 'user' : 'null';
        const params = { username, userUuid };
        
        // 병렬 처리로 장비와 낚시실력 동시 조회
        const [equipmentRes, skillRes] = await Promise.all([
          axios.get(`${serverUrl}/api/user-equipment/${userId}`, { params }),
          axios.get(`${serverUrl}/api/fishing-skill/${userId}`, { params })
        ]);
        
        setUserEquipment(equipmentRes.data || { fishingRod: null, accessory: null });
        setFishingSkill(skillRes.data.skill || 0);
      } catch (e) {
        console.error('Failed to fetch user game data:', e);
        setUserEquipment({ fishingRod: null, accessory: null });
        setFishingSkill(0);
      }
    };
    
    fetchUserGameData();
  }, [serverUrl, username, userUuid, idToken]);


  const toggleDarkMode = async () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    localStorage.setItem("darkMode", newDarkMode.toString());
    
    // 서버에도 저장
    await saveUserSettings({ darkMode: newDarkMode });
  };


  // 🛡️ [SECURITY] 보안 강화된 계정 초기화 함수
  const resetAccount = async () => {
    if (!userUuid || !username) {
      alert('사용자 정보를 찾을 수 없습니다.');
      return;
    }

    // 🛡️ 보안 강화: 단계별 확인 절차
    
    // 1단계: 초기 경고
    const initialWarning = `⚠️ 계정 초기화 경고\n\n이 작업은 되돌릴 수 없습니다!\n• 모든 낚시 기록 삭제\n• 모든 골드와 아이템 삭제\n• 모든 낚시실력 초기화\n• 복구 불가능\n\n정말로 계속하시겠습니까?`;
    if (!confirm(initialWarning)) {
      return;
    }
    
    // 2단계: 사용자명 확인
    const confirmMessage = `계정 초기화를 위해 닉네임을 입력하세요:\n\n⚠️ 주의: 모든 게임 데이터가 삭제됩니다!\n\n'${username}'을(를) 정확히 입력하세요:`;
    const userInput = prompt(confirmMessage);
    
    if (userInput !== username) {
      if (userInput !== null) {
        alert('닉네임이 일치하지 않습니다. 계정 초기화가 취소되었습니다.');
      }
      return;
    }
    
    // 3단계: 최종 확인
    const finalConfirm = '정말로 계정을 초기화하시겠습니까?\n\n이것이 마지막 경고입니다!';
    if (!confirm(finalConfirm)) {
      return;
    }

    try {
      console.log("🚨 [SECURITY] CLIENT - SECURE ACCOUNT RESET v2024.12.19");
      console.log("=== SECURE ACCOUNT RESET ===");
      console.log("Resetting account for:", { username, userUuid });
      
      // 🛡️ 보안 키 생성
      const confirmationKey = `RESET_${username}_${userUuid}_CONFIRM`;
      console.log("🔑 Generated confirmation key for secure reset");

      const params = { username, userUuid };
      const securePayload = {
        confirmationKey: confirmationKey
      };
      
      let response;
      
      try {
        console.log("🛡️ Trying secure reset-account API...");
        response = await authenticatedRequest.post(`${serverUrl}/api/reset-account`, securePayload);
        console.log("✅ Secure Reset API success");
      } catch (resetError) {
        if (resetError.response?.status === 404) {
          console.log("❌ reset-account API not found");
          throw new Error("계정 초기화 API를 찾을 수 없습니다. 서버가 업데이트되지 않았을 수 있습니다.");
        } else if (resetError.response?.status === 403) {
          console.log("❌ Secure reset failed - Invalid confirmation key");
          throw new Error("보안 검증에 실패했습니다. 계정 초기화가 차단되었습니다.");
        } else {
          throw resetError;
        }
      }

      if (response.data.success) {
        console.log("Account reset successful:", response.data);

        // 클라이언트 상태 초기화
        setUserMoney(100);
        setUserEquipment({ fishingRod: null, accessory: null });
        setFishingSkill(0);
        setInventory([]);
        setMaterials([]);
        setMyCatches(0);

        // 성공 메시지
        setMessages(prev => [...prev, {
          system: true,
          content: `계정이 초기화되었습니다! 초기 골드: 100, 낚시실력: 0`,
          timestamp: new Date().toISOString()
        }]);

        // 모달 닫기
        setShowResetConfirm(false);
        setShowProfile(false);
        setSelectedUserProfile(null);
        setOtherUserData(null);

        alert('계정이 성공적으로 초기화되었습니다!');
      }
    } catch (error) {
      console.error('Failed to reset account:', error);
      alert('계정 초기화에 실패했습니다: ' + (error.response?.data?.error || error.message));
    }
  };

  // 🚫 계정 차단 함수
  const blockAccount = async (targetUserUuid, targetUsername) => {
    if (!isAdmin) {
      alert('관리자 권한이 필요합니다.');
      return;
    }

    const reason = prompt(`${targetUsername} 계정을 차단하는 사유를 입력하세요:`, '부적절한 행동');
    if (!reason) return;

    const adminKey = prompt('관리자 키를 입력하세요:');
    if (!adminKey) return;

    try {
      const params = { username, userUuid };
      const response = await axios.post(`${serverUrl}/api/admin/block-account`, {
        userUuid: targetUserUuid,
        username: targetUsername,
        reason: reason,
        adminKey: adminKey
      }, { params });

      if (response.data.success) {
        alert(`${targetUsername} 계정이 차단되었습니다.`);
        // 현재 접속자 목록 새로고침
        fetchConnectedUserIPs();
        // 차단된 계정 목록 새로고침
        fetchBlockedAccounts();
      }
    } catch (error) {
      console.error('Failed to block account:', error);
      alert('계정 차단에 실패했습니다: ' + (error.response?.data?.error || error.message));
    }
  };

  // 수동 계정 차단 함수 (사용자명 또는 UUID로)
  const blockAccountManually = async () => {
    if (!isAdmin) {
      alert('관리자 권한이 필요합니다.');
      return;
    }

    if (!newAccountTarget.trim()) {
      alert('사용자명 또는 UUID를 입력하세요.');
      return;
    }

    if (!accountBlockReason.trim()) {
      alert('차단 사유를 입력하세요.');
      return;
    }

    const adminKey = prompt('관리자 키를 입력하세요:');
    if (!adminKey) return;

    try {
      const params = { username, userUuid };
      
      // 입력된 값이 UUID인지 사용자명인지 판단
      let targetUserUuid, targetUsername;
      
      if (newAccountTarget.startsWith('#')) {
        // UUID로 입력된 경우
        targetUserUuid = newAccountTarget;
        targetUsername = newAccountTarget; // 서버에서 실제 사용자명을 찾을 것임
      } else {
        // 사용자명으로 입력된 경우
        targetUsername = newAccountTarget;
        targetUserUuid = newAccountTarget; // 서버에서 실제 UUID를 찾을 것임
      }

      const response = await axios.post(`${serverUrl}/api/admin/block-account`, {
        userUuid: targetUserUuid,
        username: targetUsername,
        reason: accountBlockReason.trim(),
        adminKey: adminKey
      }, { params });

      if (response.data.success) {
        alert(`${newAccountTarget} 계정이 차단되었습니다.`);
        // 폼 초기화
        setNewAccountTarget('');
        setAccountBlockReason('');
        // 목록 새로고침
        fetchConnectedUserIPs();
        fetchBlockedAccounts();
      }
    } catch (error) {
      console.error('Failed to block account manually:', error);
      const errorMsg = error.response?.data?.error || error.message;
      if (errorMsg.includes('not found') || errorMsg.includes('찾을 수 없습니다')) {
        alert(`사용자를 찾을 수 없습니다: ${newAccountTarget}\n\n정확한 사용자명 또는 UUID를 입력해주세요.`);
      } else {
        alert('계정 차단에 실패했습니다: ' + errorMsg);
      }
    }
  };

  // 계정 차단 해제 함수
  const unblockAccount = async (targetUserUuid) => {
    if (!isAdmin) {
      alert('관리자 권한이 필요합니다.');
      return;
    }

    const adminKey = prompt('관리자 키를 입력하세요:');
    if (!adminKey) return;

    try {
      const params = { username, userUuid };
      const response = await axios.post(`${serverUrl}/api/admin/unblock-account`, {
        userUuid: targetUserUuid,
        adminKey: adminKey
      }, { params });

      if (response.data.success) {
        alert('계정 차단이 해제되었습니다.');
        // 차단된 계정 목록 새로고침
        fetchBlockedAccounts();
      }
    } catch (error) {
      console.error('Failed to unblock account:', error);
      alert('계정 차단 해제에 실패했습니다: ' + (error.response?.data?.error || error.message));
    }
  };


  // 차단된 계정 목록 조회 함수
  const fetchBlockedAccounts = async () => {
    if (!isAdmin) return;

    try {
      const params = { username, userUuid };
      const response = await axios.get(`${serverUrl}/api/admin/blocked-accounts`, { params });
      
      if (response.data.success) {
        setBlockedAccounts(response.data.blockedAccounts || []);
      }
    } catch (error) {
      console.error('Failed to fetch blocked accounts:', error);
    }
  };

  // 🛡️ [SECURITY] 보안 강화된 계정 삭제 함수
  const deleteAccount = async () => {
    if (!userUuid || !username) {
      alert('사용자 정보를 찾을 수 없습니다.');
      return;
    }

    // 🛡️ 보안 강화: 단계별 확인 절차
    
    // 1단계: 초기 경고
    const initialWarning = `⚠️ 계정 삭제 경고\n\n이 작업은 되돌릴 수 없습니다!\n모든 데이터가 영구적으로 삭제됩니다.\n\n계속하시겠습니까?`;
    if (!confirm(initialWarning)) {
      return;
    }
    
    // 2단계: 사용자명 확인
    const confirmMessage = `계정 삭제를 위해 닉네임을 입력하세요:\n\n⚠️ 주의사항:\n• 모든 낚시 기록 삭제\n• 모든 아이템 삭제\n• 모든 게임 진행 내역 삭제\n• 복구 불가능\n\n'${username}'을(를) 정확히 입력하세요:`;
    const userInput = prompt(confirmMessage);
    
    if (userInput !== username) {
      if (userInput !== null) {
        alert('닉네임이 일치하지 않습니다. 계정 삭제가 취소되었습니다.');
      }
      return;
    }
    
    // 3단계: 최종 확인 및 보안 키 생성
    const finalConfirm = '정말로 계정을 삭제하시겠습니까?\n\n이것이 마지막 경고입니다!';
    if (!confirm(finalConfirm)) {
      return;
    }

    try {
      console.log("🚨 [SECURITY] CLIENT - SECURE DELETE ACCOUNT v2024.12.19");
      console.log("=== SECURE ACCOUNT DELETION ===");
      console.log("Deleting account for:", { username, userUuid });
      
      // 🛡️ 보안 키 생성
      const confirmationKey = `DELETE_${username}_${userUuid}_CONFIRM`;
      console.log("🔑 Generated confirmation key for secure deletion");
      
      const params = { username, userUuid };
      const securePayload = {
        confirmationKey: confirmationKey
      };
      
      let response;
      
      try {
        // 보안 강화된 DELETE 방식 시도
        console.log("🛡️ Trying secure DELETE method...");
        response = await axios.delete(`${serverUrl}/api/delete-account`, { 
          params,
          data: securePayload
        });
        console.log("✅ Secure DELETE method success");
      } catch (deleteError) {
        if (deleteError.response?.status === 404) {
          console.log("❌ DELETE failed with 404, trying secure POST...");
          try {
            // DELETE가 404로 실패하면 POST 방식으로 재시도
            response = await axios.post(`${serverUrl}/api/delete-account`, securePayload, { params });
            console.log("✅ Secure POST method success");
          } catch (postError) {
            if (postError.response?.status === 404) {
              console.log("❌ Both DELETE and POST failed with 404");
              throw new Error("계정 삭제 API를 찾을 수 없습니다. 서버가 업데이트되지 않았을 수 있습니다.");
            } else if (postError.response?.status === 403) {
              console.log("❌ Secure POST failed - Invalid confirmation key");
              throw new Error("보안 검증에 실패했습니다. 계정 삭제가 차단되었습니다.");
            } else {
              throw postError;
            }
          }
        } else if (deleteError.response?.status === 405) {
          console.log("❌ DELETE not allowed, trying secure POST...");
          response = await axios.post(`${serverUrl}/api/delete-account`, securePayload, { params });
          console.log("✅ Secure POST method success");
        } else if (deleteError.response?.status === 403) {
          console.log("❌ Secure DELETE failed - Invalid confirmation key");
          throw new Error("보안 검증에 실패했습니다. 계정 삭제가 차단되었습니다.");
        } else {
          throw deleteError;
        }
      }

      if (response.data.success) {
        console.log("Account deletion successful:", response.data);

        alert('계정이 성공적으로 삭제되었습니다. 안녕히 가세요!');
        
        // 로그아웃 처리 (계정 삭제 시에는 모든 데이터 삭제)
        localStorage.removeItem("idToken");
        localStorage.removeItem("nickname");
        localStorage.removeItem("userUuid");
        localStorage.removeItem("googleId");
        localStorage.removeItem("termsAccepted");
        localStorage.removeItem("darkMode");
        // 🛡️ 쿨타임 localStorage 백업도 정리
        localStorage.removeItem("fishingCooldown");
        localStorage.removeItem("explorationCooldown");
        localStorage.removeItem("fishingCooldownEnd");
        localStorage.removeItem("explorationCooldownEnd");
        
        // 페이지 새로고침으로 완전 초기화
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to delete account:', error);
      console.error("Delete account error details:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        method: error.config?.method,
        params: error.config?.params
      });
      
      const errorMessage = error.response?.data?.error || error.message;
      alert('계정 삭제에 실패했습니다: ' + errorMessage);
    }
  };

  // 🔧 게임 데이터는 useGameData 훅에서 관리됨

  // 🔧 게임 데이터 변수들은 useGameData 훅에서 제공됨

  // 🔧 getAvailableFish 함수는 useGameData 훅에서 제공됨

  // 🚀 현재 사용 가능한 물고기 배열은 위에서 useMemo로 최적화됨

  // 🔧 getFishPrice, getFishMaterial 함수들은 useGameData 훅에서 제공됨

  // 🚀 다른 사용자 프로필 데이터 가져오기 - useCallback으로 최적화
  const fetchOtherUserProfile = useCallback(async (username) => {
    try {
      console.log("🔥 CLIENT VERSION: v2024.12.19 - WITH JWT TOKEN");
      console.log("Fetching profile for:", username);
      console.log("Server URL:", serverUrl);
      console.log("JWT Token:", jwtToken ? "EXISTS" : "MISSING");
      
      if (!jwtToken) {
        console.error("❌ No JWT token available for profile request");
        alert("로그인이 필요합니다.");
        return;
      }
      
      let response;
      
      try {
        // 먼저 새로운 API 시도 (JWT 토큰 포함)
        console.log("Trying new API:", `${serverUrl}/api/user-profile?username=${encodeURIComponent(username)}`);
        response = await axios.get(`${serverUrl}/api/user-profile`, {
          params: { username },
          headers: {
            'Authorization': `Bearer ${jwtToken}`
          }
        });
        console.log("✅ New API success");
      } catch (newApiError) {
        if (newApiError.response?.status === 404) {
          console.log("❌ New API failed, trying legacy API...");
          // 새 API 실패 시 이전 API 시도 (JWT 토큰 포함)
          console.log("Trying legacy API:", `${serverUrl}/api/user-profile/${encodeURIComponent(username)}`);
          response = await axios.get(`${serverUrl}/api/user-profile/${encodeURIComponent(username)}`, {
            headers: {
              'Authorization': `Bearer ${jwtToken}`
            }
          });
          console.log("✅ Legacy API success");
        } else {
          throw newApiError;
        }
      }
      console.log("Other user profile data:", response.data);
      setOtherUserData(response.data);
    } catch (error) {
      console.error("Failed to fetch other user profile:", error);
      console.error("Error details:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url
      });
      
      const errorMessage = error.response?.data?.error || "사용자 프로필을 불러올 수 없습니다.";
      alert(errorMessage);
      setOtherUserData(null);
    }
  }, [serverUrl, jwtToken]);

  // 최초 닉네임 설정 함수
  const setInitialNicknameFunc = async () => {
    if (!initialNickname.trim()) {
      alert("닉네임을 입력해주세요!");
      return;
    }
    
    // 🔒 통합 닉네임 검증
    const validation = validateNickname(initialNickname);
    if (!validation.valid) {
      alert(validation.message);
      return;
    }
    
    try {
      // 서버에 닉네임 중복 체크 (구글/카카오 ID도 함께 전달)
      const googleId = localStorage.getItem("googleId");
      const kakaoId = localStorage.getItem("kakaoId");
      const params = { userUuid, googleId, kakaoId };
      const checkResponse = await axios.post(`${serverUrl}/api/check-nickname`, {
        nickname: initialNickname.trim()
      }, { params });

      if (!checkResponse.data.available) {
        alert("이미 사용 중인 닉네임입니다. 다른 닉네임을 선택해주세요.");
        return;
      }

      // 서버에 displayName 설정 (새로운 API 사용)
      const userId = idToken ? 'user' : 'null';
      const displayNameResponse = await axios.post(`${serverUrl}/api/set-display-name/${userId}`, {
        displayName: initialNickname.trim()
      }, { params });

      if (!displayNameResponse.data.success) {
        alert("닉네임 설정에 실패했습니다.");
        return;
      }

      // 클라이언트 상태 업데이트
      setUsername(displayNameResponse.data.displayName); // displayName을 username으로 사용
      setUserUuid(displayNameResponse.data.userUuid);
      localStorage.setItem("nickname", displayNameResponse.data.displayName);
      localStorage.setItem("userUuid", displayNameResponse.data.userUuid);
      
      // 서버에 약관 동의 저장
      await saveUserSettings({ termsAccepted: true });
      
      setShowTermsModal(false);
      setIsFirstLogin(false);
      
      // 소켓 연결은 메인 useEffect에서 자동으로 처리됨 (중복 방지)
      console.log("Initial nickname set:", displayNameResponse.data.displayName);
      console.log("User data:", displayNameResponse.data);
    } catch (error) {
      console.error("Failed to set initial nickname:", error);
      const errorMessage = error.response?.data?.error || "닉네임 설정에 실패했습니다.";
      alert(errorMessage);
    }
  };

  // 🔧 fishHealthMap, fishPrefixes, selectFishPrefix는 useGameData 훅에서 제공됨

  // 접두어에 따른 색상 반환
  const getPrefixColor = (prefixName, isDark) => {
    switch (prefixName) {
      case '거대한':
        return isDark ? 'text-gray-300' : 'text-gray-700'; // 일반 (회색)
      case '변종':
        return isDark ? 'text-green-400' : 'text-green-600'; // 변종 (초록)
      case '심연의':
        return isDark ? 'text-purple-400' : 'text-purple-600'; // 심연 (보라)
      case '깊은어둠의':
        return isDark ? 'text-red-400' : 'text-red-600'; // 깊은어둠 (빨강)
      default:
        return isDark ? 'text-gray-300' : 'text-gray-700';
    }
  };

  // 🔧 getMaterialToFish는 useGameData 훅에서 제공됨

  // 낚시실력 기반 공격력 계산 (3차방정식)
  const calculatePlayerAttack = (skill) => {
    // 3차방정식: 0.00225 * skill³ + 0.165 * skill² + 2 * skill + 3
    const baseAttack = 0.00225 * Math.pow(skill, 3) + 0.165 * Math.pow(skill, 2) + 2 * skill + 3;
    // 랜덤 요소 추가 (±20%)
    const randomFactor = 0.8 + Math.random() * 0.4;
    return Math.floor(baseAttack * randomFactor);
  };

  // 공격력 범위 계산 (최소/최대) - 3차방정식 기반
  const getAttackRange = (skill) => {
    // 3차방정식으로 기본 공격력 계산: 0.00225 * skill³ + 0.165 * skill² + 2 * skill + 3
    const baseAttack = 0.00225 * Math.pow(skill, 3) + 0.165 * Math.pow(skill, 2) + 2 * skill + 3;
    // ±20% 범위 계산 (소수점 제거)
    const minAttack = Math.floor(baseAttack * 0.8);
    const maxAttack = Math.floor(baseAttack * 1.2);
    return { min: minAttack, max: maxAttack, base: Math.floor(baseAttack) };
  };

  // 악세사리 단계 계산 함수
  const getAccessoryLevel = (accessoryName) => {
    if (!accessoryName) return 0;
    
    const accessories = [
      '오래된반지', '은목걸이', '금귀걸이', '마법의펜던트', '에메랄드브로치',
      '토파즈이어링', '자수정팔찌', '백금티아라', '만드라고라허브', '에테르나무묘목',
      '몽마의조각상', '마카롱훈장', '빛나는마력순환체'
    ];
    
    const level = accessories.indexOf(accessoryName);
    return level >= 0 ? level + 1 : 0; // 1부터 시작
  };

  // 사용자 체력 계산 함수 (악세사리 단계 기반)
  const calculatePlayerMaxHp = (accessoryLevel) => {
    if (accessoryLevel === 0) return 50; // 기본 체력
    return Math.floor(Math.pow(accessoryLevel, 1.325) + 50 * accessoryLevel + 5 * accessoryLevel);
  };

  // 물고기 공격력 계산 함수 (물고기 단계 기반)
  const calculateEnemyAttack = (fishRank) => {
    if (fishRank === 0) return Math.floor(Math.random() * 3) + 8; // 스타피쉬 특별 처리
    return Math.floor(Math.pow(fishRank, 1.65) + fishRank * 1.3 + 10 + Math.random() * 5);
  };

  // 크리티컬 히트 계산 함수
  const calculateCriticalHit = (baseDamage, criticalChance = 0.05, companionName = null, companionBuffs = {}) => {
    const finalCriticalChance = (() => {
      let chance = criticalChance;
      
      // 동료의 크리티컬 버프 적용
      if (companionName && companionBuffs[companionName]?.critical) {
        chance += companionBuffs[companionName].critical.multiplier;
      }
      
      return chance;
    })();
    
    const isCritical = Math.random() < finalCriticalChance;
    if (isCritical) {
      const criticalDamage = Math.floor(baseDamage * 1.5); // 50% 추가 데미지
      return { damage: criticalDamage, isCritical: true };
    }
    return { damage: baseDamage, isCritical: false };
  };

  // 악세사리에 따른 낚시 쿨타임 계산 (낚시실력은 쿨타임에 영향 없음)
  const getFishingCooldownTime = () => {
    const baseTime = 5 * 60 * 1000; // 5분 (밀리초)
    const reduction = (() => {
    // 악세사리 효과: 각 악세사리마다 15초 감소
    if (userEquipment.accessory) {
      const accessoryItems = getAllShopItems().accessories || [];
      const equippedAccessory = accessoryItems.find(item => item.name === userEquipment.accessory);
      if (equippedAccessory) {
        // 악세사리 레벨에 따른 쿨타임 감소 (레벨당 15초)
          return (equippedAccessory.requiredSkill + 1) * 15 * 1000;
      }
    }
      return 0; // 낚시실력은 쿨타임에 영향 없음
    })();
    
    return Math.max(baseTime - reduction, 0); // 최소 0초
  };

  // 쿨타임 포맷팅 함수
  const formatCooldown = (ms) => {
    const minutes = Math.floor(ms / (60 * 1000));
    const seconds = Math.floor((ms % (60 * 1000)) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // [퀘스트] 일일 퀘스트 데이터 로드
  const loadDailyQuests = async () => {
    try {
      const userId = idToken ? 'user' : 'null';
      const params = { username, userUuid };
      const response = await axios.get(`${serverUrl}/api/daily-quests/${userId}`, { params });
      
      if (response.data) {
        setDailyQuests(response.data);
        console.log('Daily quests loaded:', response.data);
      }
    } catch (error) {
      console.error('Failed to load daily quests:', error);
    }
  };
  
  // 퀘스트 진행도 업데이트 - 모든 사용자 접근 가능
  const updateQuestProgress = async (questType, amount = 1) => {
    try {
      const params = { username, userUuid };
      await axios.post(`${serverUrl}/api/update-quest-progress`, {
        questType,
        amount
      }, { params });
      
      // 퀘스트 데이터 새로고침
      await loadDailyQuests();
    } catch (error) {
      console.error('Failed to update quest progress:', error);
    }
  };
  
  // 퀘스트 보상 수령 - 모든 사용자 접근 가능
  const claimQuestReward = async (questId) => {
    try {
      const params = { username, userUuid };
      const response = await axios.post(`${serverUrl}/api/claim-quest-reward`, {
        questId
      }, { params });
      
      if (response.data.success) {
        alert(response.data.message);
        
        // 보상 타입에 따라 상태 업데이트
        if (response.data.rewardType === 'starPieces') {
          setUserStarPieces(response.data.newStarPieces);
        } else {
          setUserAmber(response.data.newAmber);
        }
        // 퀘스트 데이터 새로고침
        await loadDailyQuests();
      }
    } catch (error) {
      console.error('Failed to claim quest reward:', error);
      alert('보상 수령에 실패했습니다.');
    }
  };
  
  // 사용자 데이터 로드 시 퀘스트도 로드
  useEffect(() => {
    if (username && userUuid) {
      loadDailyQuests();
    }
  }, [username, userUuid]);

  // 호박석 지급 함수
  const addAmber = async (amount) => {
    try {
      console.log('Adding amber reward');
      const response = await authenticatedRequest.post(`${serverUrl}/api/add-amber`, {
        amount
      });
      
      console.log('Add amber response:', response.data);
      
      if (response.data.success) {
        console.log(`Added ${amount} amber. New total: ${response.data.newAmber}`);
        setUserAmber(response.data.newAmber);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to add amber:", error);
      console.error("Error response:", error.response?.data);
      return false;
    }
  };

  // 동료 모집 함수
  const recruitCompanion = async () => {
    const starPieceCost = 1; // 별조각 1개 비용
    
    if (userStarPieces < starPieceCost) {
      alert(`별조각이 부족합니다! (필요: ${starPieceCost}개, 보유: ${userStarPieces}개)`);
      return;
    }
    
    if (companions.length >= 6) {
      alert('모든 동료를 이미 보유하고 있습니다!');
      return;
    }
    
    try {
      const params = { username, userUuid };
      console.log('Recruiting companion with params:', params);
      
      const response = await authenticatedRequest.post(`${serverUrl}/api/recruit-companion`, {
        starPieceCost
      });
      
      console.log('Recruit response:', response.data);
      
      if (response.data.success) {
        setUserStarPieces(response.data.remainingStarPieces);
        
        if (response.data.recruited) {
          // 서버에서 최신 동료 목록을 새로고침 (DB와 동기화)
          await refreshCompanions();
          
          // 새 동료 능력치 초기화
          initializeCompanionStats(response.data.companion);
          setMessages(prev => [...prev, {
            system: true,
            username: "system",
            content: `🎉 ${response.data.companion}을(를) 동료로 영입했습니다! (총 ${response.data.totalCompanions}/6명)`,
            timestamp: new Date().toISOString()
          }]);
          alert(`🎉 ${response.data.companion}을(를) 동료로 영입했습니다!`);
        } else {
          setMessages(prev => [...prev, {
            system: true,
            username: "system",
            content: `😢 동료 모집에 실패했습니다. (별조각 ${starPieceCost}개 소모)`,
            timestamp: new Date().toISOString()
          }]);
          alert('😢 동료 모집에 실패했습니다. 다시 시도해보세요!');
        }
      }
    } catch (error) {
      console.error('Failed to recruit companion:', error);
      if (error.response?.status === 400) {
        alert(error.response.data.error || '동료 모집에 실패했습니다.');
      } else {
        alert('동료 모집에 실패했습니다.');
      }
    }
  };

  // 동료 능력치 초기화 함수
  const initializeCompanionStats = (companionName) => {
    if (!companionStats[companionName]) {
      console.log(`🔧 ${companionName} 능력치 초기화 중...`);
      
      // localStorage에서 저장된 능력치 확인
      const savedStats = localStorage.getItem(`companionStats_${userUuid || username}`);
      const allStats = (() => {
        if (savedStats) {
          try {
            return JSON.parse(savedStats);
          } catch (e) {
            console.error('Failed to parse companion stats from localStorage:', e);
            return {};
          }
        }
        return {};
      })();
      
      const defaultLevel = 1;
      const defaultExp = 0;
      const defaultExpToNext = defaultLevel * 50 + 50; // 안전한 계산
      
      const newStats = allStats[companionName] || {
        level: defaultLevel,
        exp: defaultExp,
        expToNext: defaultExpToNext,
        hp: calculateCompanionStats(companionName, defaultLevel)?.hp || 100,
        maxHp: calculateCompanionStats(companionName, defaultLevel)?.hp || 100
      };
      
      // expToNext가 NaN이거나 유효하지 않으면 재계산
      if (!newStats.expToNext || isNaN(newStats.expToNext)) {
        newStats.expToNext = (newStats.level || 1) * 50 + 50;
      }
      
      console.log(`✅ ${companionName} 초기화된 능력치:`, newStats);
      
      setCompanionStats(prev => {
        const updated = {
          ...prev,
          [companionName]: newStats
        };
        
        // localStorage에 저장
        localStorage.setItem(`companionStats_${userUuid || username}`, JSON.stringify(updated));
        return updated;
      });
    }
  };

  // 동료 경험치 추가 함수
  const addCompanionExp = (companionName, expAmount) => {
    console.log(`📈 addCompanionExp 호출: ${companionName}에게 경험치 ${expAmount} 추가`);
    setCompanionStats(prev => {
      const current = prev[companionName] || {
        level: 1,
        exp: 0,
        expToNext: 100,
        hp: calculateCompanionStats(companionName, 1)?.hp || 100,
        maxHp: calculateCompanionStats(companionName, 1)?.hp || 100
      };
      console.log(`📊 ${companionName} 현재 상태:`, current);
      
      const expCalc = (() => {
        let newExp = current.exp + expAmount;
        let newLevel = current.level;
        let newExpToNext = current.expToNext;
        
        return { newExp, newLevel, newExpToNext };
      })();
      
      let { newExp, newLevel, newExpToNext } = expCalc;
      
      // 레벨업 체크
      while (newExp >= newExpToNext) {
        newExp -= newExpToNext;
        newLevel++;
        newExpToNext = newLevel * 50 + 50; // 레벨당 필요 경험치 증가
        console.log(`🎉 ${companionName} 레벨업! ${newLevel-1} → ${newLevel}`);
      }
      
      console.log(`📊 ${companionName} 최종 능력치: 레벨 ${newLevel}, 경험치 ${newExp}/${newExpToNext}`);
      
      // 레벨업 시 능력치 재계산
      const newStats = calculateCompanionStats(companionName, newLevel);
      
      const updated = {
        ...prev,
        [companionName]: {
          level: newLevel,
          exp: newExp,
          expToNext: newExpToNext,
          hp: newStats?.hp || current.hp,
          maxHp: newStats?.hp || current.maxHp
        }
      };
      
      // localStorage에 저장
      localStorage.setItem(`companionStats_${userUuid || username}`, JSON.stringify(updated));
      
      // 서버에 즉시 저장 (경험치 변경 시)
      const updatedStats = updated[companionName];
      if (jwtToken) {
        setTimeout(() => {
          saveCompanionStatsToServer(companionName, updatedStats);
        }, 100); // 상태 업데이트 후 저장
      }
      
      // 레벨업 알림
      if (newLevel > current.level) {
        setTimeout(() => {
          alert(`${companionName}이(가) 레벨 ${newLevel}로 레벨업했습니다!`);
        }, 500);
      }
      
      return updated;
    });
  };

  // 전투 참여 동료 토글 함수
  const toggleBattleCompanion = (companionName) => {
    // 동료 능력치 초기화
    initializeCompanionStats(companionName);
    
    setBattleCompanions(prev => {
      const isCurrentlyInBattle = prev.includes(companionName);
      
      if (isCurrentlyInBattle) {
        // 전투에서 제외
        return prev.filter(name => name !== companionName);
      } else {
        // 전투에 추가 (최대 3명까지)
        if (prev.length >= 3) {
          alert('전투 참여는 최대 3명까지 가능합니다!');
          return prev;
        }
        return [...prev, companionName];
      }
    });
  };

  // 다른 사용자의 관리자 상태 확인 함수
  const checkUserAdminStatus = async (username) => {
    try {
      const userId = 'user'; // 다른 사용자 조회용
      const params = { username };
      console.log('Checking admin status for user:', username);
      const res = await axios.get(`${serverUrl}/api/admin-status/${userId}`, { params });
      console.log('Admin status response for', username, ':', res.data);
      
      setUserAdminStatus(prev => ({
        ...prev,
        [username]: res.data.isAdmin || false
      }));
      
      return res.data.isAdmin || false;
    } catch (e) {
      console.error('Failed to fetch admin status for', username, ':', e);
      setUserAdminStatus(prev => ({
        ...prev,
        [username]: false
      }));
      return false;
    }
  };

  // 🛡️ [SECURITY] 보안 강화된 관리자 권한 토글 함수
  const secureToggleAdminRights = async (adminKey) => {
    try {
      // 🛡️ 보안 검증: 관리자 키 필수
      if (!adminKey || typeof adminKey !== 'string' || adminKey.length < 10) {
        alert('⚠️ 올바른 관리자 키가 필요합니다.');
        return;
      }
      
      const params = { username, userUuid };
      console.log('🔑 [SECURITY] Secure admin toggle attempt');
      
      const response = await axios.post(`${serverUrl}/api/toggle-admin`, {
        adminKey: adminKey // 보안 키 전송
      }, { params });
      
      console.log('🔑 [SECURITY] Admin toggle response:', response.data);
      
      if (response.data.success) {
        setIsAdmin(response.data.isAdmin);
        
        // 🔐 새 JWT 토큰 저장 (관리자 권한 포함)
        if (response.data.jwtToken) {
          localStorage.setItem("jwtToken", response.data.jwtToken);
          setJwtToken(response.data.jwtToken);
          console.log("🔐 New admin JWT token saved");
        }
        
        // ✅ 관리자 상태 로드 완료로 즉시 업데이트
        setAdminStatusLoaded(true);
        console.log("🔑 [ADMIN] Admin status updated immediately:", response.data.isAdmin);
        
        setMessages(prev => [...prev, {
          system: true,
          username: "system",
          content: `🔑 [ADMIN] ${response.data.message}`,
          timestamp: new Date().toISOString()
        }]);
        alert(`🔑 [ADMIN] ${response.data.message}`);
      } else {
        alert(`⚠️ ${response.data.error || '관리자 권한 변경에 실패했습니다.'}`);
      }
    } catch (error) {
      console.error('🚨 [SECURITY] Failed to toggle admin rights:', error);
      
      if (error.response?.status === 403) {
        alert('⚠️ 권한이 없습니다. 올바른 관리자 키가 필요합니다.');
      } else if (error.response?.status === 429) {
        alert('⚠️ 너무 많은 시도입니다. 잠시 후 다시 시도해주세요.');
      } else {
        alert('⚠️ 관리자 권한 변경에 실패했습니다.');
      }
    }
  };
  
  // 기존 함수를 보안 버전으로 대체 (하위 호환성)
  const toggleAdminRights = () => {
    const adminKey = prompt('🔑 관리자 비밀 키를 입력하세요:');
    if (adminKey) {
      secureToggleAdminRights(adminKey);
    }
  };

  // 🔑 관리자 권한: 다른 사용자 계정 초기화
  const adminResetUserAccount = async (targetUsername) => {
    if (!isAdmin) {
      alert('⚠️ 관리자 권한이 필요합니다.');
      return;
    }

    // 보안 확인
    const adminKey = prompt('🔑 관리자 비밀 키를 입력하여 권한을 확인하세요:');
    if (!adminKey) {
      return;
    }

    // 확인 단계
    const confirmMessage = `⚠️ 관리자 권한으로 계정 초기화\n\n대상 사용자: ${targetUsername}\n\n이 작업은 되돌릴 수 없습니다!\n• 모든 낚시 기록 삭제\n• 모든 골드와 아이템 삭제\n• 모든 낚시실력 초기화\n\n정말로 실행하시겠습니까?`;
    if (!confirm(confirmMessage)) {
      return;
    }

    // 최종 확인
    const finalConfirm = `정말로 '${targetUsername}' 사용자의 계정을 초기화하시겠습니까?\n\n이것이 마지막 경고입니다!`;
    if (!confirm(finalConfirm)) {
      return;
    }

    try {
      console.log("🔑 [ADMIN] Resetting user account:", targetUsername);
      
      const confirmationKey = `ADMIN_RESET_${targetUsername}_${userUuid}_CONFIRM`;
      
      const response = await axios.post(`${serverUrl}/api/admin/reset-user-account`, {
        targetUsername: targetUsername,
        adminKey: adminKey,
        confirmationKey: confirmationKey
      }, {
        params: { username, userUuid }
      });

      if (response.data.success) {
        alert(`✅ '${targetUsername}' 사용자의 계정이 성공적으로 초기화되었습니다.`);
        
        // 프로필 모달 닫기
        setShowProfile(false);
        setSelectedUserProfile(null);
        setOtherUserData(null);

        // 관리자 액션 메시지
        setMessages(prev => [...prev, {
          system: true,
          content: `🔑 [관리자] ${targetUsername} 사용자의 계정을 초기화했습니다.`,
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (error) {
      console.error('Failed to reset user account:', error);
      if (error.response?.status === 403) {
        alert('⚠️ 관리자 권한이 없거나 잘못된 관리자 키입니다.');
      } else {
        alert('⚠️ 계정 초기화에 실패했습니다: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  // 🛡️ IP 차단 관리 함수들
  
  // IP 유효성 검사
  const isValidIP = (ip) => {
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (!ipRegex.test(ip)) return false;
    
    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part);
      return num >= 0 && num <= 255;
    });
  };

  // 차단된 IP 목록 조회
  const fetchBlockedIPs = async () => {
    if (!isAdmin) return;
    
    try {
      const params = { username, userUuid };
      const response = await axios.get(`${serverUrl}/api/admin/blocked-ips`, { params });
      
      if (response.data.success) {
        setBlockedIPs(response.data.blockedIPs || []);
      }
    } catch (error) {
      console.error('Failed to fetch blocked IPs:', error);
    }
  };

  // 현재 접속자 IP 조회
  const fetchConnectedUserIPs = async () => {
    if (!isAdmin) return;
    
    try {
      const params = { username, userUuid };
      const response = await axios.get(`${serverUrl}/api/admin/user-ips`, { params });
      
      if (response.data.success) {
        setConnectedUsersList(response.data.connectedUsers || []);
      }
    } catch (error) {
      console.error('Failed to fetch user IPs:', error);
    }
  };

  // IP 차단
  const blockIP = async () => {
    if (!newIPAddress || !isValidIP(newIPAddress)) {
      alert('❌ 올바른 IP 주소를 입력하세요.\n예: 192.168.1.1');
      return;
    }

    const adminKey = prompt('🔑 관리자 비밀 키를 입력하세요:');
    if (!adminKey) return;

    try {
      const response = await axios.post(`${serverUrl}/api/admin/block-ip`, {
        ipAddress: newIPAddress,
        reason: blockReason || '관리자에 의한 수동 차단',
        adminKey: adminKey
      }, {
        params: { username, userUuid }
      });

      if (response.data.success) {
        alert(`✅ IP ${newIPAddress}가 차단되었습니다.`);
        setNewIPAddress('');
        setBlockReason('');
        fetchBlockedIPs(); // 목록 새로고침
      }
    } catch (error) {
      alert(`❌ IP 차단 실패: ${error.response?.data?.error || error.message}`);
    }
  };

  // IP 차단 해제
  const unblockIP = async (ipAddress) => {
    const adminKey = prompt('🔑 관리자 비밀 키를 입력하세요:');
    if (!adminKey) return;

    const confirmMessage = `정말로 IP ${ipAddress}의 차단을 해제하시겠습니까?`;
    if (!confirm(confirmMessage)) return;

    try {
      const response = await axios.post(`${serverUrl}/api/admin/unblock-ip`, {
        ipAddress: ipAddress,
        adminKey: adminKey
      }, {
        params: { username, userUuid }
      });

      if (response.data.success) {
        alert(`✅ IP ${ipAddress} 차단이 해제되었습니다.`);
        fetchBlockedIPs(); // 목록 새로고림
      }
    } catch (error) {
      alert(`❌ 차단 해제 실패: ${error.response?.data?.error || error.message}`);
    }
  };

  // IP 관리자 패널 열기
  const openIPManager = () => {
    setShowIPManager(true);
    fetchBlockedIPs();
    fetchConnectedUserIPs();
    fetchBlockedAccounts();
  };

  // 🔑 관리자 권한: 다른 사용자 계정 삭제
  const adminDeleteUserAccount = async (targetUsername) => {
    if (!isAdmin) {
      alert('⚠️ 관리자 권한이 필요합니다.');
      return;
    }

    // 보안 확인
    const adminKey = prompt('🔑 관리자 비밀 키를 입력하여 권한을 확인하세요:');
    if (!adminKey) {
      return;
    }

    // 확인 단계
    const confirmMessage = `⚠️ 관리자 권한으로 계정 삭제\n\n대상 사용자: ${targetUsername}\n\n이 작업은 되돌릴 수 없습니다!\n• 모든 데이터 영구 삭제\n• 계정 완전 삭제\n• 복구 불가능\n\n정말로 실행하시겠습니까?`;
    if (!confirm(confirmMessage)) {
      return;
    }

    // 최종 확인
    const finalConfirm = `정말로 '${targetUsername}' 사용자의 계정을 삭제하시겠습니까?\n\n이것이 마지막 경고입니다!`;
    if (!confirm(finalConfirm)) {
      return;
    }

    try {
      console.log("🔑 [ADMIN] Deleting user account:", targetUsername);
      
      const confirmationKey = `ADMIN_DELETE_${targetUsername}_${userUuid}_CONFIRM`;
      
      const response = await axios.post(`${serverUrl}/api/admin/delete-user-account`, {
        targetUsername: targetUsername,
        adminKey: adminKey,
        confirmationKey: confirmationKey
      }, {
        params: { username, userUuid }
      });

      if (response.data.success) {
        alert(`✅ '${targetUsername}' 사용자의 계정이 성공적으로 삭제되었습니다.`);
        
        // 프로필 모달 닫기
        setShowProfile(false);
        setSelectedUserProfile(null);
        setOtherUserData(null);

        // 관리자 액션 메시지
        setMessages(prev => [...prev, {
          system: true,
          content: `🔑 [관리자] ${targetUsername} 사용자의 계정을 삭제했습니다.`,
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (error) {
      console.error('Failed to delete user account:', error);
      if (error.response?.status === 403) {
        alert('⚠️ 관리자 권한이 없거나 잘못된 관리자 키입니다.');
      } else {
        alert('⚠️ 계정 삭제에 실패했습니다: ' + (error.response?.data?.error || error.message));
      }
    }
  };





  // 재료 소모 함수
  const consumeMaterial = async (materialName, quantity = 1) => {
    try {
      const response = await authenticatedRequest.post(`${serverUrl}/api/consume-material`, {
        materialName,
        quantity
      });
      
      if (response.data.success) {
        console.log(`Consumed ${quantity} ${materialName}`);
        // 재료 목록 새로고침
        await fetchMaterials();
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to consume material:", error);
      return false;
    }
  };

  // 탐사 시작 함수
  const startExploration = async (material) => {
    const baseFish = getMaterialToFish(material.material);
    if (!baseFish) {
      alert("해당 재료로는 탐사할 수 없습니다.");
      return;
    }

    // 재료 부족 체크 (소모 전에 미리 확인)
    if (material.count < 1) {
      alert("재료가 부족합니다.");
      return;
    }

    // 서버에 탐사 시작 쿨타임 설정 요청 - JWT 인증 사용
    // 탐사 쿨타임 제거됨

    console.log(`Starting exploration with ${material.material}, current count: ${material.count}`);

    // 접두어 선택
    const selectedPrefix = selectFishPrefix();
    const enemyFish = `${selectedPrefix.name} ${baseFish}`;
    
    // 물고기 체력 계산 (접두어 배율 적용)
    const baseHp = fishHealthMap[baseFish] || 100;
    const enemyMaxHp = Math.floor(baseHp * selectedPrefix.hpMultiplier);

    // 사용자 체력 계산 (악세사리 단계 기반)
    const accessoryLevel = getAccessoryLevel(userEquipment.accessory);
    const playerMaxHp = calculatePlayerMaxHp(accessoryLevel);
    
    // 전투 참여 동료들의 체력 및 사기 초기화
    const companionHpData = {};
    const companionMoraleData = {};
    battleCompanions.forEach(companion => {
      const companionStat = companionStats[companion];
      const companionLevel = companionStat?.level || 1;
      const companionData = calculateCompanionStats(companion, companionLevel);
      const maxHp = companionData?.hp || 100;
      
      companionHpData[companion] = {
        hp: maxHp,
        maxHp: maxHp,
        level: companionLevel
      };
      
      // 사기 초기화 (기본 50)
      companionMoraleData[companion] = {
        morale: 50,
        maxMorale: 100
      };
    });

    // 턴 순서 계산 (속도 기반)
    const enemySpeed = fishSpeedMap?.[baseFish] || 50;
    const turnOrder = ['player']; // 플레이어는 항상 첫 번째
    
    // 동료들과 적의 속도 비교하여 턴 순서 결정
    const combatants = [
      { type: 'enemy', speed: enemySpeed },
      ...battleCompanions.map(companion => {
        const companionStat = companionStats[companion];
        const companionLevel = companionStat?.level || 1;
        const companionData = calculateCompanionStats(companion, companionLevel);
        return { type: 'companion', name: companion, speed: companionData?.speed || 30 };
      })
    ];
    
    // 속도 순으로 정렬 (높은 속도가 먼저)
    combatants.sort((a, b) => b.speed - a.speed);
    
    // 플레이어 다음 턴 순서 배치
    combatants.forEach(combatant => {
      if (combatant.type === 'enemy') {
        turnOrder.push('enemy');
      } else if (combatant.type === 'companion') {
        turnOrder.push(`companion_${combatant.name}`);
      }
    });
    
    // 동료 버프 초기화
    const companionBuffs = {};
    battleCompanions.forEach(companion => {
      companionBuffs[companion] = {};
    });
    
    // 전투 상태 먼저 초기화 (재료 소모 전에)
    const newBattleState = {
      enemy: enemyFish,
      baseFish: baseFish,
      prefix: selectedPrefix,
      playerHp: playerMaxHp,
      playerMaxHp: playerMaxHp,
      enemyHp: enemyMaxHp,
      enemyMaxHp: enemyMaxHp,
      enemySpeed: enemySpeed,
      turn: 'player',
      turnOrder: turnOrder, // 턴 순서 배열
      currentTurnIndex: 0, // 현재 턴 인덱스
      log: [
        `${material.material}을(를) 사용하여 ${enemyFish}(HP: ${enemyMaxHp}, 속도: ${enemySpeed})와의 전투가 시작되었습니다!`,
        ...(battleCompanions.length > 0 
          ? [`동료 ${battleCompanions.join(', ')}가 함께 전투에 참여합니다!`]
          : []
        ),
        `턴 순서: ${turnOrder.map(turn => {
          if (turn === 'player') return '플레이어';
          if (turn === 'enemy') return '적';
          if (turn.startsWith('companion_')) return turn.replace('companion_', '');
          return turn;
        }).join(' → ')}`,
        `전투를 시작하거나 도망갈 수 있습니다.`
      ],
      material: material.material,
      round: 1,
      materialConsumed: false, // 재료 소모 여부 추적
      autoMode: false, // 자동 전투 모드
      canFlee: true, // 도망 가능 여부 (첫 턴에만 가능)
      companions: [...battleCompanions], // 전투 참여 동료 목록
      companionHp: companionHpData, // 동료별 체력 정보
      companionMorale: companionMoraleData, // 동료별 사기 정보
      companionBuffs: companionBuffs // 동료별 버프 정보
    };

    setBattleState(newBattleState);
    setSelectedMaterial(material);
    setShowExplorationModal(false);
    setShowBattleModal(true);

    // 전투 시작 후 재료 소모
    try {
      const consumed = await consumeMaterial(material.material, 1);
      if (consumed) {
        console.log(`Successfully consumed ${material.material}`);
        setBattleState(prev => prev ? { ...prev, materialConsumed: true } : null);
      } else {
        console.error("Failed to consume material");
        // 재료 소모 실패 시 전투 종료
        setBattleState(null);
        setShowBattleModal(false);
        alert("재료 소모에 실패했습니다.");
      }
    } catch (error) {
      console.error("Error consuming material:", error);
      setBattleState(null);
      setShowBattleModal(false);
      alert("재료 소모 중 오류가 발생했습니다.");
    }
  };

  // 도망가기 함수
  const fleeFromBattle = async () => {
    if (!battleState || !battleState.canFlee) return;
    
    try {
      // 재료 소모 (이미 소모되었다면 스킵)
      if (!battleState.materialConsumed) {
        const consumed = await consumeMaterial(battleState.material, 1);
        if (!consumed) {
          alert("재료 소모에 실패했습니다.");
          return;
        }
      }
      
      // 탐사 쿨타임 제거됨
      
      // 도망 메시지 추가
      const fleeLog = [...battleState.log, `${battleState.enemy}에게서 도망쳤습니다!`];
      
      setBattleState(prev => prev ? {
        ...prev,
        log: fleeLog,
        turn: 'fled',
        materialConsumed: true
      } : null);
      
      // 2초 후 모달 닫기
      setTimeout(() => {
        setShowBattleModal(false);
        setBattleState(null);
        alert("도망쳤습니다! 재료는 소모되었지만 탐사 쿨타임이 절반으로 줄었습니다.");
      }, 2000);
      
    } catch (error) {
      console.error("Failed to flee from battle:", error);
      alert("도망가기에 실패했습니다.");
    }
  };

  // 다음 턴으로 넘어가는 함수
  const nextTurn = (currentBattleState) => {
    if (!currentBattleState?.turnOrder) return currentBattleState;
    
    const nextTurnIndex = (currentBattleState.currentTurnIndex + 1) % currentBattleState.turnOrder.length;
    const nextTurnType = currentBattleState.turnOrder[nextTurnIndex];
    
    // 버프 지속시간 감소 (라운드 완료 시에만 - 즉, 다시 플레이어 턴이 될 때)
    const updatedBuffs = { ...currentBattleState.companionBuffs };
    const expiredBuffs = {}; // 만료된 버프 정보 저장
    
    // 한 라운드가 완료되었을 때만 버프 지속시간 감소 (nextTurnIndex가 0이 될 때)
    if (nextTurnIndex === 0) {
      Object.keys(updatedBuffs).forEach(companionName => {
        Object.keys(updatedBuffs[companionName]).forEach(buffType => {
          if (updatedBuffs[companionName][buffType].turnsLeft > 0) {
            updatedBuffs[companionName][buffType] = {
              ...updatedBuffs[companionName][buffType],
              turnsLeft: updatedBuffs[companionName][buffType].turnsLeft - 1
            };
            
            // 버프 만료 시 스킬 이름 저장 후 제거
            if (updatedBuffs[companionName][buffType].turnsLeft <= 0) {
              const companionData = COMPANION_DATA[companionName];
              if (companionData?.skill?.name) {
                if (!expiredBuffs[companionName]) {
                  expiredBuffs[companionName] = [];
                }
                expiredBuffs[companionName].push(companionData.skill.name);
              }
              delete updatedBuffs[companionName][buffType];
            }
          }
        });
      });
    }
    
    // 버프 만료 메시지 추가
    let newLog = [...currentBattleState.log];
    if (Object.keys(expiredBuffs).length > 0) {
      Object.keys(expiredBuffs).forEach(companionName => {
        expiredBuffs[companionName].forEach(skillName => {
          newLog.push(`⏰ ${companionName}의 '${skillName}' 효과가 만료되었습니다.`);
        });
      });
    }
    
    const newState = {
      ...currentBattleState,
      currentTurnIndex: nextTurnIndex,
      turn: nextTurnType,
      companionBuffs: updatedBuffs,
      expiredBuffs: expiredBuffs,
      round: nextTurnIndex === 0 ? (currentBattleState.round || 1) + 1 : currentBattleState.round || 1,
      log: newLog
    };
    
    // 자동으로 다음 턴 실행
    setTimeout(() => {
      if (nextTurnType === 'enemy') {
        enemyAttack(newState.enemyHp, newState.log);
      } else if (nextTurnType.startsWith('companion_')) {
        const companionName = nextTurnType.replace('companion_', '');
        companionAttack(companionName, newState);
      } else if (nextTurnType === 'player' && newState.autoMode) {
        // 자동모드일 때 플레이어 자동 공격
        setTimeout(() => playerAttack(), 100); // 추가 딜레이로 상태 안정화
      }
    }, 1000);
    
    return newState;
  };

  // 동료 공격 함수
  const companionAttack = (companionName, currentState) => {
    setBattleState(prevState => {
      if (!prevState || prevState.enemyHp <= 0) return prevState;
      
      const companionStat = companionStats[companionName];
      const companionLevel = companionStat?.level || 1;
      const companionData = calculateCompanionStats(companionName, companionLevel);
      const companionBaseData = COMPANION_DATA[companionName];
      
      // 동료가 쓰러져 있으면 턴 넘김
      if (prevState.companionHp?.[companionName]?.hp <= 0) {
        const newLog = [...prevState.log, `${companionName}이(가) 쓰러져서 공격할 수 없습니다.`];
        return nextTurn({ ...prevState, log: newLog });
      }
      
      // 사기 증가 (턴마다 +15)
      const newCompanionMorale = { ...prevState.companionMorale };
      if (newCompanionMorale[companionName]) {
        newCompanionMorale[companionName] = {
          ...newCompanionMorale[companionName],
          morale: Math.min(100, newCompanionMorale[companionName].morale + 15)
        };
      }
      
      // 스킬 사용 가능 여부 체크
      const currentMorale = newCompanionMorale[companionName]?.morale || 0;
      const hasSkill = companionBaseData?.skill;
      const canUseSkill = canUseCompanionSkill(companionName, newCompanionMorale);
      
      // 동료 공격력 계산
      const baseAttack = companionData?.attack || 25;
      let damage, attackType;
      
      const newCompanionBuffs = { ...prevState.companionBuffs };
      
      let isCritical = false;
      
      if (canUseSkill) {
        // 스킬 시스템 모듈을 사용하여 스킬 처리
        const skillResult = processCompanionSkill({
          battleState: prevState,
          companionName,
          companionStats,
          companionMorale: newCompanionMorale,
          companionBuffs: newCompanionBuffs,
          calculateCriticalHit,
          nextTurn
        });
        
        if (skillResult) {
          return skillResult; // 스킬 처리 완료 후 다음 턴으로
        }
        
        // skillResult가 null인 경우 (승리 처리 등) 기존 로직 계속 진행
        const skill = companionBaseData.skill;
        if (skill.skillType === 'heal') {
          damage = 0;
          isCritical = false;
          attackType = 'heal_skill';
        } else if (skill.buffType) {
          const baseDamage = Math.floor(baseAttack * (skill.damageMultiplier || 1.0) * (0.9 + Math.random() * 0.2));
          const criticalResult = calculateCriticalHit(baseDamage, 0.05, companionName, newCompanionBuffs);
          damage = criticalResult.damage;
          isCritical = criticalResult.isCritical;
          attackType = 'buff_skill';
        } else {
          const baseDamage = Math.floor(baseAttack * companionBaseData.skill.damageMultiplier * (0.9 + Math.random() * 0.2));
          const criticalResult = calculateCriticalHit(baseDamage, 0.05, companionName, newCompanionBuffs);
          damage = criticalResult.damage;
          isCritical = criticalResult.isCritical;
          attackType = 'damage_skill';
        }
      } else {
        // 일반 공격 (버프가 적용된 공격력 사용)
        const effectiveAttack = (() => {
          if (newCompanionBuffs[companionName]?.attack) {
            return Math.floor(baseAttack * newCompanionBuffs[companionName].attack.multiplier);
          }
          return baseAttack;
        })();
        const baseDamage = Math.floor(effectiveAttack * (0.8 + Math.random() * 0.4)); // ±20% 랜덤
        const criticalResult = calculateCriticalHit(baseDamage, 0.05, companionName, newCompanionBuffs);
        damage = criticalResult.damage;
        isCritical = criticalResult.isCritical;
        attackType = 'normal';
      }
      
      const newEnemyHp = Math.max(0, prevState.enemyHp - damage);
      const newLog = [...prevState.log];
      const newPlayerHp = prevState.playerHp;
      const newCompanionHp = { ...prevState.companionHp };
      
      if (attackType === 'buff_skill') {
        const skillMessage = isCritical ? `💥 크리티컬! ${companionName}(Lv.${companionLevel})이(가) 스킬 '${companionBaseData.skill.name}'을(를) 사용했습니다!` : `${companionName}(Lv.${companionLevel})이(가) 스킬 '${companionBaseData.skill.name}'을(를) 사용했습니다!`;
        newLog.push(skillMessage);
        
        // 스킬 타입에 따른 버프 메시지
        if (companionBaseData.skill.buffType === 'attack') {
          newLog.push(`🔥 3턴 동안 공격력이 25% 상승합니다!`);
        } else if (companionBaseData.skill.buffType === 'critical') {
          newLog.push(`🎯 3턴 동안 크리티컬 확률이 20% 상승합니다!`);
        }
        
        if (damage > 0) {
          newLog.push(`💥 ${damage} 데미지! (${prevState.enemy}: ${newEnemyHp}/${prevState.enemyMaxHp})`);
        }
      } else if (attackType === 'damage_skill') {
        const skillMessage = isCritical ? `💥 크리티컬! ${companionName}(Lv.${companionLevel})이(가) 스킬 '${companionBaseData.skill.name}'을(를) 사용했습니다!` : `${companionName}(Lv.${companionLevel})이(가) 스킬 '${companionBaseData.skill.name}'을(를) 사용했습니다!`;
        newLog.push(skillMessage);
        newLog.push(`💥 ${damage} 데미지! (${prevState.enemy}: ${newEnemyHp}/${prevState.enemyMaxHp})`);
      } else {
        let buffText = "";
        if (newCompanionBuffs[companionName]?.attack) {
          buffText = " (공격력 강화!)";
        } else if (prevState.expiredBuffs && prevState.expiredBuffs[companionName]) {
          const expiredSkillNames = prevState.expiredBuffs[companionName];
          buffText = ` (${expiredSkillNames.join(', ')} 종료)`;
        }
        
        const criticalText = isCritical ? "💥 크리티컬! " : "";
        newLog.push(`${criticalText}${companionName}(Lv.${companionLevel})이(가) ${damage} 데미지를 입혔습니다!${buffText} (${prevState.enemy}: ${newEnemyHp}/${prevState.enemyMaxHp})`);
      }
      
      if (newEnemyHp <= 0) {
        // 승리 처리
        const baseReward = Math.floor(prevState.enemyMaxHp / 10) + Math.floor(Math.random() * 5) + 1;
        const amberReward = Math.floor(baseReward * (prevState.prefix?.amberMultiplier || 1));
        
        const prefixBonus = prevState.prefix?.amberMultiplier > 1 
          ? ` (${prevState.prefix.name} 보너스 x${prevState.prefix.amberMultiplier})` 
          : '';
        
        newLog.push(`${prevState.enemy}를 물리쳤습니다! 호박석 ${amberReward}개를 획득했습니다!${prefixBonus}`);
        
        // 승리 시 모든 동료에게 사기 +25
        const finalCompanionMorale = { ...newCompanionMorale };
        Object.keys(finalCompanionMorale).forEach(companion => {
          finalCompanionMorale[companion] = {
            ...finalCompanionMorale[companion],
            morale: Math.min(100, finalCompanionMorale[companion].morale + 25)
          };
        });

        setTimeout(async () => {
          await addAmber(amberReward);
          updateQuestProgress('exploration_win', 1);
          
          // 동료들에게 경험치 지급
          if (prevState.companions && prevState.companions.length > 0) {
            const expReward = Math.floor(prevState.enemyMaxHp / 5) + 10;
            console.log(`🎯 전투 승리! 동료들에게 경험치 ${expReward} 지급:`, prevState.companions);
            prevState.companions.forEach(companion => {
              console.log(`📈 ${companion}에게 경험치 ${expReward} 지급 중...`);
              addCompanionExp(companion, expReward);
            });
          }
          
          setTimeout(() => {
            setShowBattleModal(false);
            setBattleState(null);
            alert(`승리! 호박석 ${amberReward}개를 획득했습니다!${prefixBonus}`);
          }, 1000);
        }, 1000);

        return {
          ...prevState,
          enemyHp: 0,
          log: newLog,
          turn: 'victory',
          amberReward: amberReward,
          companionMorale: finalCompanionMorale,
          companionBuffs: newCompanionBuffs
        };
      } else {
        // 다음 턴으로 (expiredBuffs 초기화)
        return nextTurn({
          ...prevState,
          enemyHp: newEnemyHp,
          log: newLog,
          companionMorale: newCompanionMorale,
          companionBuffs: newCompanionBuffs,
          expiredBuffs: {} // 만료 정보 초기화
        });
      }
    });
  };

  // 플레이어 공격
  const playerAttack = () => {
    setBattleState(prevState => {
      if (!prevState || prevState.turn !== 'player') return prevState;

      const baseDamage = calculatePlayerAttack(fishingSkill); // 낚시실력 기반 공격력
      const { damage, isCritical } = calculateCriticalHit(baseDamage); // 크리티컬 계산
      const newEnemyHp = Math.max(0, prevState.enemyHp - damage);
      
      const attackMessage = isCritical 
        ? `💥 크리티컬! 플레이어가 ${damage} 데미지를 입혔습니다!`
        : `플레이어가 ${damage} 데미지를 입혔습니다!`;

      const newLog = [...prevState.log, `${attackMessage} (${prevState.enemy}: ${newEnemyHp}/${prevState.enemyMaxHp})`];

      if (newEnemyHp <= 0) {
        // 승리 - 호박석 보상 계산 (접두어 배율 적용)
        const baseReward = Math.floor(prevState.enemyMaxHp / 10) + Math.floor(Math.random() * 5) + 1;
        const amberReward = Math.floor(baseReward * (prevState.prefix?.amberMultiplier || 1));
        
        const prefixBonus = prevState.prefix?.amberMultiplier > 1 
          ? ` (${prevState.prefix.name} 보너스 x${prevState.prefix.amberMultiplier})` 
          : '';
        
        newLog.push(`${prevState.enemy}를 물리쳤습니다! 호박석 ${amberReward}개를 획득했습니다!${prefixBonus}`);
        
        // 호박석 지급
        setTimeout(async () => {
          await addAmber(amberReward);
          // [퀘스트] 탐사 승리 퀘스트 진행도 업데이트
          updateQuestProgress('exploration_win', 1);
          
          // 동료들에게 경험치 지급
          if (prevState.companions && prevState.companions.length > 0) {
            const expReward = Math.floor(prevState.enemyMaxHp / 5) + 10; // 적 체력 기반 경험치
            console.log(`🎯 자동전투 승리! 동료들에게 경험치 ${expReward} 지급:`, prevState.companions);
            prevState.companions.forEach(companion => {
              console.log(`📈 ${companion}에게 경험치 ${expReward} 지급 중...`);
              addCompanionExp(companion, expReward);
            });
          }
          
          setTimeout(async () => {
            // 서버에 승리 쿨타임 설정 요청 - JWT 인증 사용
            // 탐사 쿨타임 제거됨
          
            setShowBattleModal(false);
            setBattleState(null);
            alert(`승리! 호박석 ${amberReward}개를 획득했습니다!${prefixBonus}`);
          }, 1000);
        }, 1000);

        return {
          ...prevState,
          enemyHp: 0,
          log: newLog,
          turn: 'victory',
          amberReward: amberReward,
          autoMode: true,
          canFlee: false
        };
      } else {
        // 다음 턴으로 넘어가기 (첫 공격 후 자동모드 활성화)
        return nextTurn({
          ...prevState,
          enemyHp: newEnemyHp,
          log: newLog,
          autoMode: true, // 첫 공격 후 자동 모드 활성화
          canFlee: false // 공격 후에는 도망 불가능
        });
      }
    });
    
    // 전투 로그 스크롤
    setTimeout(() => scrollBattleLogToBottom(), 200);
  };

  // 적 공격
  const enemyAttack = (currentEnemyHp, currentLog) => {
    setBattleState(prevState => {
      if (!prevState) return null;

      // 물고기 단계 기반 공격력 계산
      const fishData = allFishTypes.find(fish => fish.name === prevState.baseFish);
      const fishRank = fishData ? fishData.rank : 1;
      const baseDamage = calculateEnemyAttack(fishRank);
      const { damage, isCritical } = calculateCriticalHit(baseDamage);
      
      // 공격 대상 선택 (플레이어와 살아있는 동료들 중 랜덤)
      const aliveTargets = ['player'];
      if (prevState.companions && prevState.companions.length > 0) {
        prevState.companions.forEach(companion => {
          if (prevState.companionHp?.[companion]?.hp > 0) {
            aliveTargets.push(companion);
          }
        });
      }
      
      // 랜덤으로 하나의 대상 선택
      const targetIndex = Math.floor(Math.random() * aliveTargets.length);
      const target = aliveTargets[targetIndex];
      
      const newCompanionHp = { ...prevState.companionHp };
      const newCompanionMorale = { ...prevState.companionMorale };
      let newPlayerHp = prevState.playerHp;
      
      const attackMessage = isCritical ? `💥 크리티컬! ${prevState.enemy}가 공격했습니다!` : `${prevState.enemy}가 공격했습니다!`;
      const newLog = [...currentLog, attackMessage];
      
      if (target === 'player') {
        // 플레이어 공격
        newPlayerHp = Math.max(0, prevState.playerHp - damage);
        newLog.push(`플레이어가 ${damage} 데미지를 받았습니다! (${newPlayerHp}/${prevState.playerMaxHp})`);
      } else {
        // 동료 공격
        if (newCompanionHp[target]) {
          const oldHp = newCompanionHp[target].hp;
          const newHp = Math.max(0, oldHp - damage);
          newCompanionHp[target] = {
            ...newCompanionHp[target],
            hp: newHp
          };
          newLog.push(`${target}이(가) ${damage} 데미지를 받았습니다! (${newHp}/${newCompanionHp[target].maxHp})`);
          
          // 공격받은 동료의 사기 +25
          if (newCompanionMorale[target]) {
            newCompanionMorale[target] = {
              ...newCompanionMorale[target],
              morale: Math.min(100, newCompanionMorale[target].morale + 25)
            };
          }
        }
      }

      // 패배 조건 체크 (플레이어 또는 모든 동료가 쓰러짐)
      const allCompanionsDown = prevState.companions?.every(companion => 
        newCompanionHp[companion]?.hp <= 0
      ) ?? true;
      
      if (newPlayerHp <= 0 && allCompanionsDown) {
        // 패배
        newLog.push(`패배했습니다... 재료를 잃었습니다.`);
        
        setTimeout(async () => {
          // 서버에 패배 쿨타임 설정 요청 - JWT 인증 사용
          // 탐사 쿨타임 제거됨
          
          setShowBattleModal(false);
          setBattleState(null);
          alert("패배했습니다...");
        }, 2000);

        return {
          ...prevState,
          enemyHp: currentEnemyHp, // 적 체력 유지
          playerHp: newPlayerHp,
          companionHp: newCompanionHp,
          companionMorale: newCompanionMorale,
          log: newLog,
          turn: 'defeat'
        };
      } else {
        // 다음 턴으로 넘어가기
        return nextTurn({
          ...prevState,
          enemyHp: currentEnemyHp, // 적 체력 유지
          playerHp: newPlayerHp,
          companionHp: newCompanionHp,
          companionMorale: newCompanionMorale,
          log: newLog
        });
      }
    });
    
    // 전투 로그 스크롤
    setTimeout(() => scrollBattleLogToBottom(), 200);
  };

  // 🔧 getAllShopItems, getAvailableShopItem는 useGameData 훅에서 제공됨

  // 🔧 상점 아이템 조회는 useGameData 훅의 getAvailableShopItem 사용

  // 수량 모달 열기
  const openQuantityModal = (type, fishName, maxQuantity) => {
    setQuantityModalData({ type, fishName, maxQuantity });
    setInputQuantity(1);
    setShowQuantityModal(true);
  };

  // 수량 모달에서 확인 버튼
  const handleQuantityConfirm = () => {
    if (!quantityModalData) return;
    
    const { type, fishName } = quantityModalData;
    const quantity = Math.min(inputQuantity, quantityModalData.maxQuantity);
    
    if (type === 'sell') {
      sellFish(fishName, quantity);
    } else if (type === 'decompose') {
      decomposeFish(fishName, quantity);
    }
    
    setShowQuantityModal(false);
    setQuantityModalData(null);
    setInputQuantity(1);
  };

  // 물고기 판매 함수
  const sellFish = async (fishName, quantity) => {
    try {
      const userId = idToken ? 'user' : 'null';
      const params = { username, userUuid }; // username과 userUuid 모두 전달
      const price = getFishPrice(fishName, userEquipment); // userEquipment 추가
      const totalPrice = price * quantity;
      
      // 🔐 JWT 인증을 사용한 API 호출
      const response = await authenticatedRequest.post(`${serverUrl}/api/sell-fish`, {
        fishName,
        quantity,
        totalPrice
      });
      
      if (response.data.success) {
        setUserMoney(prev => prev + totalPrice);
        // [퀘스트] 물고기 판매 퀘스트 진행도 업데이트
        updateQuestProgress('fish_sold', quantity);
        
        // 🚀 인벤토리 최적화: 로컬에서 먼저 업데이트 후 서버에서 검증
        setInventory(prev => {
          const updated = prev.map(item => 
            item.fish === fishName 
              ? { ...item, count: Math.max(0, item.count - quantity) }
              : item
          ).filter(item => item.count > 0);
          
          const totalCount = updated.reduce((sum, item) => sum + item.count, 0);
          setMyCatches(totalCount);
          return updated;
        });
        
        // 백그라운드에서 서버 동기화 (오류 시에만 다시 로드)
        setTimeout(async () => {
          try {
            const res = await axios.get(`${serverUrl}/api/inventory/${userId}`, { params });
            const safeInventory = Array.isArray(res.data) ? res.data : [];
            setInventory(safeInventory);
            const totalCount = safeInventory.reduce((sum, item) => sum + item.count, 0);
            setMyCatches(totalCount);
          } catch (error) {
            console.error('Background inventory sync failed:', error);
          }
        }, 1000);
        
        // 판매 메시지 채팅에 추가
        setMessages(prev => [...prev, {
          system: true,
          content: `${fishName} ${quantity}마리를 ${(totalPrice || 0).toLocaleString()}골드에 판매했습니다!`,
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (error) {
      console.error('Failed to sell fish:', error);
      alert('물고기 판매에 실패했습니다.');
    }
  };

  // 전체 판매 함수
  const sellAllFish = async () => {
    if (isProcessingSellAll || isProcessingDecomposeAll) {
      alert('이미 처리 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    
    if (inventory.length === 0) {
      alert('판매할 물고기가 없습니다.');
      return;
    }
    
    if (!confirm('모든 물고기를 판매하시겠습니까?')) {
      return;
    }
    
    setIsProcessingSellAll(true);
    
    try {
      let totalEarned = 0;
      
      for (const item of inventory) {
        const price = getFishPrice(item.fish);
        const totalPrice = price * item.count;
        totalEarned += totalPrice;
        
        await sellFish(item.fish, item.count);
      }
      
      setMessages(prev => [...prev, {
        system: true,
        content: `모든 물고기를 판매하여 총 ${(totalEarned || 0).toLocaleString()}골드를 획득했습니다!`,
        timestamp: new Date().toISOString()
      }]);
    } catch (error) {
      console.error('Failed to sell all fish:', error);
      alert('전체 판매에 실패했습니다.');
    } finally {
      setIsProcessingSellAll(false);
    }
  };



  // 물고기 분해 함수
  const decomposeFish = async (fishName, quantity) => {
    const material = getFishMaterial(fishName);
    if (!material) {
      alert('분해할 수 없는 물고기입니다.');
      return;
    }

    try {
      const response = await authenticatedRequest.post(`${serverUrl}/api/decompose-fish`, {
        fishName,
        quantity,
        material
      });

      if (response.data.success) {
        // 스타피쉬 분해 시 별조각 획득 처리
        if (fishName === "스타피쉬" && response.data.starPiecesGained) {
          setUserStarPieces(response.data.totalStarPieces);
          
          // 별조각 획득 메시지
          setMessages(prev => [...prev, {
            system: true,
            username: "system",
            content: `✨ 스타피쉬 ${quantity}마리를 분해하여 별조각 ${response.data.starPiecesGained}개를 획득했습니다! (총 ${response.data.totalStarPieces}개)`,
            timestamp: new Date().toISOString()
          }]);
          
          // 별조각 획득 알림
          alert(`✨ 별조각 ${response.data.starPiecesGained}개를 획득했습니다!\n총 보유 별조각: ${response.data.totalStarPieces}개`);
        } else {
          // 일반 물고기 분해 메시지
          setMessages(prev => [...prev, {
            system: true,
            username: "system",
            content: `${fishName} ${quantity}마리를 분해하여 ${material} ${quantity}개를 획득했습니다!`,
            timestamp: new Date().toISOString()
          }]);
        }
        
        // 🚀 인벤토리 최적화: 로컬에서 먼저 업데이트
        setInventory(prev => {
          const updated = prev.map(item => 
            item.fish === fishName 
              ? { ...item, count: Math.max(0, item.count - quantity) }
              : item
          ).filter(item => item.count > 0);
          
          const totalCount = updated.reduce((sum, item) => sum + item.count, 0);
          setMyCatches(totalCount);
          return updated;
        });
        
        // 재료 로컬 업데이트
        const material = getFishMaterial(fishName);
        if (material && fishName !== "스타피쉬") {
          setMaterials(prev => {
            const existingMaterial = prev.find(m => m.material === material);
            if (existingMaterial) {
              return prev.map(m => 
                m.material === material 
                  ? { ...m, count: m.count + quantity }
                  : m
              );
            } else {
              return [...prev, { material, count: quantity }];
            }
          });
        }
        
        // 백그라운드에서 서버 동기화
        setTimeout(async () => {
          try {
            const userId = idToken ? 'user' : 'null';
            const [inventoryRes, materialsRes] = await Promise.all([
              authenticatedRequest.get(`${serverUrl}/api/inventory/${userId}`),
              authenticatedRequest.get(`${serverUrl}/api/materials/${userId}`)
            ]);
            
            const safeInventory = Array.isArray(inventoryRes.data) ? inventoryRes.data : [];
            setInventory(safeInventory);
            const totalCount = safeInventory.reduce((sum, item) => sum + item.count, 0);
            setMyCatches(totalCount);
            setMaterials(materialsRes.data || []);
          } catch (error) {
            console.error('Background sync failed:', error);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to decompose fish:', error);
      alert('물고기 분해에 실패했습니다.');
    }
  };

  // 전체 분해 함수
  const decomposeAllFish = async () => {
    if (isProcessingSellAll || isProcessingDecomposeAll) {
      alert('이미 처리 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    
    if (inventory.length === 0) {
      alert('분해할 물고기가 없습니다.');
      return;
    }
    
    if (!confirm('모든 물고기를 분해하시겠습니까?')) {
      return;
    }
    
    setIsProcessingDecomposeAll(true);
    
    try {
      let totalMaterials = 0;
      
      for (const item of inventory) {
        const material = getFishMaterial(item.fish);
        if (material) {
          await decomposeFish(item.fish, item.count);
          totalMaterials += item.count;
        }
      }
      
      setMessages(prev => [...prev, {
        system: true,
        content: `모든 물고기를 분해하여 총 ${totalMaterials}개의 재료를 획득했습니다!`,
        timestamp: new Date().toISOString()
      }]);
    } catch (error) {
      console.error('Failed to decompose all fish:', error);
      alert('전체 분해에 실패했습니다.');
    } finally {
      setIsProcessingDecomposeAll(false);
    }
  };

  // 아이템 구매 함수
  const buyItem = async (itemName, price, category, currency = 'gold') => {
    console.log("buyItem called with:", { itemName, price, category, currency, username, userUuid });
    
    if (!username) {
      alert('사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.');
      return;
    }
    
    // 화폐 종류에 따른 잔액 확인
    if (currency === 'amber') {
      if (userAmber < price) {
        alert('호박석이 부족합니다!');
        return;
      }
    } else {
    if (userMoney < price) {
      alert('골드가 부족합니다!');
      return;
      }
    }
    
    try {
      const userId = idToken ? 'user' : 'null';
      const params = { username, userUuid }; // username과 userUuid 모두 전달
      
      console.log("Sending buy item request:", { itemName, price, category, params });
      
      // 🔐 JWT 인증을 사용한 API 호출
      const response = await authenticatedRequest.post(`${serverUrl}/api/buy-item`, {
        itemName,
        price,
        category,
        currency // 화폐 종류 전송
      });
      
      if (response.data.success) {
        // 화폐 종류에 따라 차감
        if (currency === 'amber') {
          setUserAmber(prev => prev - price);
        } else {
        setUserMoney(prev => prev - price);
        }
        
        // 장비 자동 장착
        if (category === 'fishing_rod') {
          setUserEquipment(prev => ({ ...prev, fishingRod: itemName }));
          // 낚시대 구매 시 낚시실력 +1 (쿨타임에는 영향 없음)
          setFishingSkill(prev => prev + 1);
        } else if (category === 'accessories') {
          setUserEquipment(prev => ({ ...prev, accessory: itemName }));
          // 악세사리 구매 시에도 낚시실력 +1 (순차 구매를 위해)
          setFishingSkill(prev => prev + 1);
          // 🛡️ [FIX] 악세사리 구매 시 서버에서 쿨타임 재계산 요청
          try {
            const response = await authenticatedRequest.post(`${serverUrl}/api/recalculate-fishing-cooldown`, {});
            
            if (response.data.success) {
              const newCooldownTime = response.data.remainingTime || 0;
              setFishingCooldown(newCooldownTime);
              console.log(`🎣 Fishing cooldown recalculated after accessory purchase: ${newCooldownTime}ms`);
            }
          } catch (error) {
            console.error('Failed to recalculate fishing cooldown:', error);
            // 실패 시 클라이언트에서만 임시로 감소 (서버와 동기화는 다음 로그인 시)
            setFishingCooldown(prev => Math.max(0, prev - 15000));
          }
        }
        
        // 장비 정보 새로고침
        setTimeout(async () => {
          try {
            const userId = idToken ? 'user' : 'null';
            const params = { username };
            const equipmentRes = await axios.get(`${serverUrl}/api/user-equipment/${userId}`, { params });
            setUserEquipment(equipmentRes.data || { fishingRod: null, accessory: null });
            
            // 낚시실력도 새로고침
            const skillRes = await axios.get(`${serverUrl}/api/fishing-skill/${userId}`, { params });
            setFishingSkill(skillRes.data.skill || 0);
          } catch (e) {
            console.error('Failed to refresh equipment after purchase:', e);
          }
        }, 500);
        
        // 구매 메시지 채팅에 추가
        const skillMessage = (category === 'fishing_rod' || category === 'accessories') ? ' (낚시실력 +1)' : '';
        const currencyText = currency === 'amber' ? '호박석' : '골드';
        setMessages(prev => [...prev, {
          system: true,
          content: `${itemName}을(를) ${(price || 0).toLocaleString()}${currencyText}에 구매하고 장착했습니다!${skillMessage}`,
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (error) {
      console.error('Failed to buy item:', error);
      alert('아이템 구매에 실패했습니다.');
    }
  };

  // "낚시하기" 버튼은 제거하고 채팅 명령으로만 사용합니다

  // 🔧 게임 데이터 로딩 중일 때 로딩 화면 표시
  if (gameDataLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">게임 데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  // 로그인 화면 표시 조건: username이 없고, idToken도 없고, 이용약관 모달도 표시되지 않는 경우
  if (!username && !idToken && !showTermsModal) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 flex items-center justify-center p-4 relative overflow-hidden">
        {/* 배경 장식 요소들 */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl animate-pulse delay-500"></div>
        </div>

        <div className="relative z-10 w-full max-w-md">
          <div className="glass-card rounded-3xl p-8 board-shadow">
            <div className="text-center mb-8">
              {/* 로고 */}
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-sm border border-white/10 bounce-slow">
                <Fish className="w-10 h-10 text-blue-400 drop-shadow-lg" />
              </div>
              
              {/* 제목 */}
              <h1 className="text-3xl font-bold text-white mb-2 gradient-text">
                여우이야기 V1.0
              </h1>
              <p className="text-gray-300 text-sm mb-4">
                실시간 채팅 낚시 게임에 오신 것을 환영합니다
              </p>

            </div>
            
            <div className="space-y-6">
              {/* Google 로그인 영역 */}
              <div className="text-center space-y-4">
                <button
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-4 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center justify-center gap-3 glow-effect"
                  onClick={() => {
                    // 모바일 임베디드 브라우저 감지 (네이버 앱 포함)
                    const isEmbeddedBrowser = /FBAN|FBAV|Instagram|Line|KakaoTalk|NAVER|wv|WebView/.test(navigator.userAgent);
                    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                    
                    if (isEmbeddedBrowser || (isMobile && window.navigator.standalone === false)) {
                      alert('앱 내 브라우저에서는 Google 로그인이 제한됩니다.\n\n✅ 해결 방법:\n1. 링크를 길게 눌러 "브라우저에서 열기" 선택\n2. 또는 Safari/Chrome 앱을 열어서 주소를 직접 입력\n\n주소: https://fising-master.onrender.com');
                      return;
                    }
                    
                    const clientId = '1023938003062-256niij987fc2q7o74qmssi2bca7vdnf.apps.googleusercontent.com';
                    const redirectUri = window.location.origin;
                    const scope = 'openid email profile';
                    const responseType = 'id_token';
                    const nonce = Math.random().toString(36).substring(2, 15);
                    
                    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                      `client_id=${clientId}&` +
                      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
                      `scope=${encodeURIComponent(scope)}&` +
                      `response_type=${responseType}&` +
                      `nonce=${nonce}`;
                    
                    window.location.href = authUrl;
                  }}
                >
                  <Fish className="w-5 h-5" />
                  <span className="text-lg">Google 계정으로 시작하기</span>
                </button>

                {/* 카카오 로그인 버튼 */}
                <button
                  className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-black font-semibold py-4 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center justify-center gap-3"
                  onClick={handleKakaoLogin}
                >
                  <div className="w-5 h-5 bg-black rounded-sm flex items-center justify-center">
                    <span className="text-yellow-400 text-xs font-bold">K</span>
                  </div>
                  <span className="text-lg">카카오 계정으로 시작하기</span>
                </button>

                {/* 구분선 */}
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-600"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-gray-900 text-gray-400">또는</span>
                  </div>
                </div>

                {/* 게스트 로그인 버튼 */}
                <div className="space-y-3">
                  <button
                    onClick={handleGuestLogin}
                    className="w-full px-6 py-3 bg-gray-700/50 hover:bg-gray-600/50 text-white rounded-lg transition-all duration-300 transform hover:scale-105 border border-gray-600/50 flex items-center justify-center gap-2"
                  >
                    <User className="w-4 h-4" />
                    게스트로 접속
                  </button>
                  <p className="text-xs text-gray-400 text-center">
                    게스트로 접속하면 데이터가 저장되지 않습니다
                  </p>
                </div>
                
                {/* 모바일 사용자를 위한 안내 메시지 */}
                {/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && (
                  <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg text-sm text-yellow-800">
                    📱 <strong>모바일 사용자 안내:</strong><br/>
                    카카오톡, 네이버, 인스타그램 등 앱 내 브라우저에서는 Google 로그인이 제한됩니다.<br/>
                    <strong>Safari나 Chrome에서 직접 접속해주세요!</strong>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen relative overflow-hidden ${
      isDarkMode 
        ? "bg-gradient-to-br from-gray-900 via-black to-gray-800" 
        : "bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-200"
    }`}>
      {/* 배경 장식 요소들 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className={`absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse ${
          isDarkMode ? "bg-blue-500/5" : "bg-blue-500/10"
        }`}></div>
        <div className={`absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full blur-3xl animate-pulse delay-1000 ${
          isDarkMode ? "bg-purple-500/5" : "bg-purple-500/10"
        }`}></div>
        <div className={`absolute top-3/4 left-3/4 w-48 h-48 rounded-full blur-2xl animate-pulse delay-500 ${
          isDarkMode ? "bg-emerald-500/5" : "bg-emerald-500/10"
        }`}></div>
      </div>

      {/* 헤더 */}
      <div className={`sticky top-0 z-50 border-b ${
        isDarkMode 
          ? "glass-card-dark border-white/10" 
          : "bg-white/80 backdrop-blur-md border-gray-300/30"
      }`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
                      <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-sm border ${
                isDarkMode ? "border-white/10" : "border-blue-300/30"
              }`}>
                <Fish className={`w-5 h-5 ${
                  isDarkMode ? "text-blue-400" : "text-blue-600"
                }`} />
              </div>
              <div>
                <div className="flex items-center gap-3">
                <h1 className={`font-bold text-lg ${
                  isDarkMode ? "text-white gradient-text" : "text-gray-800"
                  }`}>여우이야기</h1>
                  {/* 카카오톡 채널방 링크 */}
                  <a
                    href="https://open.kakao.com/o/guv74VXg"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all duration-300 hover:scale-105 ${
                      isDarkMode 
                        ? "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-400/30" 
                        : "bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 border border-yellow-500/30"
                    }`}
                    title="카카오톡 채널방 참여하기"
                  >
                    <div className="w-3 h-3 bg-yellow-500 rounded-sm flex items-center justify-center">
                      <span className="text-white text-[8px] font-bold">K</span>
                    </div>
                    <span>채널방</span>
                  </a>
                </div>
                <p className={`text-xs ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}>실시간 낚시 게임</p>
              </div>
            </div>
          
          <div className="flex items-center gap-4">
            {/* 유틸리티 버튼들 */}
            <div className="flex items-center gap-2">
              {/* 공지사항 버튼 */}
              <button
                onClick={() => setShowNoticeModal(true)}
                className={`p-2 rounded-full hover:glow-effect transition-all duration-300 ${
                  isDarkMode 
                    ? "glass-input text-blue-400 hover:text-blue-300" 
                    : "bg-white/60 backdrop-blur-sm border border-gray-300/40 text-blue-600 hover:text-blue-500"
                }`}
                title="공지사항"
              >
                <Bell className="w-4 h-4" />
              </button>
              
              {/* 튜토리얼 버튼 */}
              <button
                onClick={() => setShowTutorialModal(true)}
                className={`p-2 rounded-full hover:glow-effect transition-all duration-300 ${
                  isDarkMode 
                    ? "glass-input text-green-400 hover:text-green-300" 
                    : "bg-white/60 backdrop-blur-sm border border-gray-300/40 text-green-600 hover:text-green-500"
                }`}
                title="튜토리얼"
              >
                <BookOpen className="w-4 h-4" />
              </button>
              
              {/* 테마 토글 */}
              <button
                onClick={toggleDarkMode}
                className={`p-2 rounded-full hover:glow-effect transition-all duration-300 ${
                  isDarkMode 
                    ? "glass-input text-yellow-400" 
                    : "bg-white/60 backdrop-blur-sm border border-gray-300/40 text-gray-600 hover:text-yellow-500"
                }`}
                title="테마 변경"
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
            
            {/* 사용자 정보 */}
            <div 
              className={`flex items-center gap-3 px-4 py-2 rounded-full cursor-pointer hover:scale-105 transition-all duration-300 ${
                isDarkMode ? "glass-input hover:bg-white/10" : "bg-white/60 backdrop-blur-sm border border-gray-300/40 hover:bg-white/80"
              }`}
              onClick={() => {
                setSelectedUserProfile(null); // 내 프로필
                setOtherUserData(null); // 다른 사용자 데이터 초기화
                setShowProfile(true);
              }}
            >
              <div className={`flex items-center gap-2 ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}>
                <User className="w-4 h-4" />
                <span className="text-sm font-medium">{username}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-blue-500 text-white font-semibold">
                <Trophy className="w-4 h-4" />
                <span>{myCatches}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-4">
        <div className={`flex justify-center gap-2 p-2 rounded-2xl ${
          isDarkMode ? "glass-card" : "bg-white/80 backdrop-blur-md border border-gray-300/30"
        }`}>
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 font-medium ${
              activeTab === "chat"
                ? isDarkMode
                  ? "bg-blue-500/20 text-blue-400 border border-blue-400/30"
                  : "bg-blue-500/10 text-blue-600 border border-blue-500/30"
                : isDarkMode
                  ? "text-gray-400 hover:text-gray-300"
                  : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            <span className="hidden sm:inline">채팅</span>
          </button>
          <button
            onClick={() => setActiveTab("inventory")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 font-medium ${
              activeTab === "inventory"
                ? isDarkMode
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-400/30"
                  : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
                : isDarkMode
                  ? "text-gray-400 hover:text-gray-300"
                  : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <Package className="w-4 h-4" />
            <span className="hidden sm:inline">인벤토리</span>
          </button>
          <button
            onClick={() => setActiveTab("shop")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 font-medium ${
              activeTab === "shop"
                ? isDarkMode
                  ? "bg-purple-500/20 text-purple-400 border border-purple-400/30"
                  : "bg-purple-500/10 text-purple-600 border border-purple-500/30"
                : isDarkMode
                  ? "text-gray-400 hover:text-gray-300"
                  : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span className="hidden sm:inline">상점</span>
          </button>
          <button
            onClick={() => setActiveTab("exploration")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 font-medium ${
              activeTab === "exploration"
                ? isDarkMode
                  ? "bg-orange-500/20 text-orange-400 border border-orange-400/30"
                  : "bg-orange-500/10 text-orange-600 border border-orange-500/30"
                : isDarkMode
                  ? "text-gray-400 hover:text-gray-300"
                  : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <Waves className="w-4 h-4" />
            <span className="hidden sm:inline">탐사</span>
          </button>
          <button
            onClick={() => setActiveTab("companions")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 font-medium ${
              activeTab === "companions"
                ? isDarkMode
                  ? "bg-purple-500/20 text-purple-400 border border-purple-400/30"
                  : "bg-purple-500/10 text-purple-600 border border-purple-500/30"
                : isDarkMode
                  ? "text-gray-400 hover:text-gray-300"
                  : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">동료모집</span>
          </button>
          <button
            onClick={() => setActiveTab("quests")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 font-medium ${
              activeTab === "quests"
                ? isDarkMode
                  ? "bg-yellow-500/20 text-yellow-400 border border-yellow-400/30"
                  : "bg-yellow-500/10 text-yellow-600 border border-yellow-500/30"
                : isDarkMode
                  ? "text-gray-400 hover:text-gray-300"
                  : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <Target className="w-4 h-4" />
            <span className="hidden sm:inline">퀘스트</span>
          </button>
          <button
            onClick={() => setActiveTab("myinfo")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 font-medium ${
              activeTab === "myinfo"
                ? isDarkMode
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-400/30"
                  : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
                : isDarkMode
                  ? "text-gray-400 hover:text-gray-300"
                  : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span className="hidden sm:inline">내정보</span>
          </button>
          <button
            onClick={() => setActiveTab("ranking")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 font-medium ${
              activeTab === "ranking"
                ? isDarkMode
                  ? "bg-yellow-500/20 text-yellow-400 border border-yellow-400/30"
                  : "bg-yellow-500/10 text-yellow-600 border border-yellow-500/30"
                : isDarkMode
                  ? "text-gray-400 hover:text-gray-300"
                  : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span className="hidden sm:inline">랭킹</span>
          </button>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="relative z-10 max-w-7xl mx-auto p-6">
        <div className={`grid gap-6 min-h-[75vh] ${
          activeTab === "ranking" 
            ? "grid-cols-1" // 랭킹 탭일 때는 1열 그리드 (랭킹만 전체 너비)
            : "grid-cols-1 xl:grid-cols-4"  // 다른 탭일 때는 4열 그리드
        }`}>
          
          {/* 랭킹 사이드바 (랭킹 탭일 때만 표시) */}
          {activeTab === "ranking" && (
            <div className="xl:col-span-1 h-full order-first">
              <div className={`rounded-2xl board-shadow h-full flex flex-col ${
                isDarkMode ? "glass-card" : "bg-white/80 backdrop-blur-md border border-gray-300/30"
              }`}>
                {/* 랭킹 헤더 */}
                <div className={`border-b p-4 ${
                  isDarkMode ? "border-white/10" : "border-gray-300/20"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border ${
                      isDarkMode ? "border-white/10" : "border-yellow-300/30"
                    }`}>
                      <Trophy className={`w-4 h-4 ${
                        isDarkMode ? "text-yellow-400" : "text-yellow-600"
                      }`} />
                    </div>
                    <div>
                      <h2 className={`text-lg font-semibold ${
                        isDarkMode ? "text-white" : "text-gray-800"
                      }`}>랭킹</h2>
                      <p className={`text-xs ${
                        isDarkMode ? "text-gray-400" : "text-gray-600"
                      }`}>총 {rankings.length}명</p>
                    </div>
                  </div>
                </div>
                
                {/* 랭킹 콘텐츠 */}
                <div className="flex-1 p-3 space-y-2 overflow-y-auto">
                  {rankings && rankings.length > 0 ? (
                    rankings.map((user, index) => (
                      <div 
                        key={user.userUuid || user.username} 
                        className={`p-3 rounded-lg transition-all duration-300 hover:scale-105 cursor-pointer ${
                          isDarkMode ? "glass-input" : "bg-white/60 backdrop-blur-sm border border-gray-300/40"
                        } ${(user.displayName || user.username) === username ? 
                          (isDarkMode ? "ring-2 ring-yellow-400/50 bg-yellow-500/10" : "ring-2 ring-yellow-500/50 bg-yellow-500/5")
                          : ""
                        }`}
                        onClick={async () => {
                          if ((user.displayName || user.username) === username) {
                            setSelectedUserProfile(null); // 내 프로필
                            setOtherUserData(null); // 다른 사용자 데이터 초기화
                          } else {
                            setSelectedUserProfile({ username: user.displayName || user.username }); // 다른 사용자 프로필
                            await fetchOtherUserProfile(user.displayName || user.username); // 해당 사용자 데이터 가져오기
                          }
                          setShowProfile(true);
                        }}
                        title={`${user.displayName || user.username}님의 프로필 보기`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {/* 순위 */}
                            <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                              user.rank === 1 
                                ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-white"
                                : user.rank === 2 
                                ? "bg-gradient-to-br from-gray-300 to-gray-500 text-white" 
                                : user.rank === 3
                                ? "bg-gradient-to-br from-amber-600 to-amber-800 text-white"
                                : isDarkMode 
                                ? "bg-gray-700 text-gray-300"
                                : "bg-gray-200 text-gray-600"
                            }`}>
                              {user.rank <= 3 && user.rank === 1 && "🥇"}
                              {user.rank <= 3 && user.rank === 2 && "🥈"}
                              {user.rank <= 3 && user.rank === 3 && "🥉"}
                              {user.rank > 3 && user.rank}
                            </div>
                            
                            {/* 사용자 정보 */}
                            <div className="min-w-0 flex-1">
                              <div className={`font-medium text-sm truncate ${
                                isDarkMode ? "text-white" : "text-gray-800"
                              }`}>
                                {user.displayName || user.username}
                              </div>
                              <div className={`text-xs ${
                                isDarkMode ? "text-gray-400" : "text-gray-600"
                              }`}>
                                🐟 {user.totalFishCaught || 0}마리
                              </div>
                            </div>
                          </div>
                          
                          {/* 스킬 레벨 */}
                          <div className={`text-xs px-2 py-1 rounded-full ${
                            isDarkMode ? "bg-blue-500/20 text-blue-400" : "bg-blue-500/10 text-blue-600"
                          }`}>
                            Lv.{user.fishingSkill}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={`text-center py-8 ${
                      isDarkMode ? "text-gray-500" : "text-gray-600"
                    }`}>
                      <Trophy className={`w-12 h-12 mx-auto mb-3 opacity-30 ${
                        isDarkMode ? "text-gray-600" : "text-gray-400"
                      }`} />
                      <p className="text-sm">랭킹 데이터 없음</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* 메인 콘텐츠 영역 - 랭킹 탭에서는 숨김 */}
          {activeTab !== "ranking" && (
          <div className="xl:col-span-3 h-full">
          
          {/* 채팅 탭 */}
          {activeTab === "chat" && (
            <ChatTab
              messages={messages}
              setMessages={setMessages}
              input={input}
              setInput={setInput}
              username={username}
              setUsername={setUsername}
              setInventory={setInventory}
              setMaterials={setMaterials}
              setMyCatches={setMyCatches}
              setUserMoney={setUserMoney}
              setIdToken={setIdToken}
              setUsernameInput={setUsernameInput}
              setActiveTab={setActiveTab}
              setUserUuid={setUserUuid}
              setIsGuest={setIsGuest}
              isDarkMode={isDarkMode}
              isAdmin={isAdmin}
              userAdminStatus={userAdminStatus}
              fishingCooldown={fishingCooldown}
              setFishingCooldown={setFishingCooldown}
              isProcessingFishing={isProcessingFishing}
              setIsProcessingFishing={setIsProcessingFishing}
              serverUrl={serverUrl}
              idToken={idToken}
              userUuid={userUuid}
              getSocket={getSocket}
              updateQuestProgress={updateQuestProgress}
              formatCooldown={formatCooldown}
              openIPManager={openIPManager}
              fetchOtherUserProfile={fetchOtherUserProfile}
              setSelectedUserProfile={setSelectedUserProfile}
              setShowProfile={setShowProfile}
              secureToggleAdminRights={secureToggleAdminRights}
              toggleAdminRights={toggleAdminRights}
              cooldownLoaded={cooldownLoaded}
              setCooldownLoaded={setCooldownLoaded}
            />
          )}

          {/* 인벤토리 탭 */}
          {activeTab === "inventory" && (
          <div className={`rounded-2xl board-shadow min-h-full flex flex-col ${
            isDarkMode ? "glass-card" : "bg-white/80 backdrop-blur-md border border-gray-300/30"
          }`}>
            {/* 인벤토리 헤더 */}
            <div className={`border-b p-4 ${
              isDarkMode ? "border-white/10" : "border-gray-300/20"
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/20 to-blue-500/20">
                    <Package className={`w-4 h-4 ${
                      isDarkMode ? "text-emerald-400" : "text-emerald-600"
                    }`} />
                  </div>
                  <div>
                    <h2 className={`text-lg font-semibold ${
                      isDarkMode ? "text-white" : "text-gray-800"
                    }`}>내 인벤토리</h2>
                    <p className={`text-xs ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}>총 {Array.isArray(inventory) ? inventory.reduce((sum, item) => sum + item.count, 0) : 0}마리</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border ${
                    isDarkMode ? "border-yellow-400/20" : "border-yellow-500/30"
                  }`}>
                    <Coins className={`w-4 h-4 ${
                      isDarkMode ? "text-yellow-400" : "text-yellow-600"
                    }`} />
                    <span className={`text-sm font-bold ${
                      isDarkMode ? "text-yellow-400" : "text-yellow-600"
                    }`}>{(userMoney || 0).toLocaleString()}</span>
                    <span className={`text-xs ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}>골드</span>
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-orange-500/20 to-amber-500/20 border ${
                    isDarkMode ? "border-orange-400/20" : "border-orange-500/30"
                  }`}>
                    <Gem className={`w-4 h-4 ${
                      isDarkMode ? "text-orange-400" : "text-orange-600"
                    }`} />
                    <span className={`text-sm font-bold ${
                      isDarkMode ? "text-orange-400" : "text-orange-600"
                    }`}>{(userAmber || 0).toLocaleString()}</span>
                    <span className={`text-xs ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}>호박석</span>
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 border ${
                    isDarkMode ? "border-blue-400/20" : "border-blue-500/30"
                  }`}>
                    <Star className={`w-4 h-4 ${
                      isDarkMode ? "text-blue-400" : "text-blue-600"
                    }`} />
                    <span className={`text-sm font-bold ${
                      isDarkMode ? "text-blue-400" : "text-blue-600"
                    }`}>{(userStarPieces || 0).toLocaleString()}</span>
                    <span className={`text-xs ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}>별조각</span>
                  </div>
                </div>
              </div>
              
              {/* 전체 판매/분해 버튼 */}
              {inventory.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={sellAllFish}
                    disabled={isProcessingSellAll || isProcessingDecomposeAll}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                      (isProcessingSellAll || isProcessingDecomposeAll)
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:scale-105"
                    } ${
                      isDarkMode 
                        ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30" 
                        : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                    }`}
                  >
                    <Coins className="w-4 h-4" />
                    <span className="text-sm">
                      {isProcessingSellAll ? "판매 중..." : "전체 판매"}
                    </span>
                  </button>
                  <button
                    onClick={decomposeAllFish}
                    disabled={isProcessingSellAll || isProcessingDecomposeAll}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                      (isProcessingSellAll || isProcessingDecomposeAll)
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:scale-105"
                    } ${
                      isDarkMode 
                        ? "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30" 
                        : "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20"
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm">
                      {isProcessingDecomposeAll ? "분해 중..." : "전체 분해"}
                    </span>
                  </button>
                </div>
              )}
            </div>
            
            {/* 인벤토리 목록 */}
            <div className="flex-1 p-4">
              {inventory.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 mb-4 bounce-slow">
                    <Fish className={`w-8 h-8 ${
                      isDarkMode ? "text-blue-400" : "text-blue-600"
                    }`} />
                  </div>
                  <p className={`text-sm font-medium mb-2 ${
                    isDarkMode ? "text-gray-300" : "text-gray-700"
                  }`}>아직 낚은 물고기가 없습니다</p>
                  <p className={`text-xs ${
                    isDarkMode ? "text-gray-500" : "text-gray-600"
                  }`}>채팅에서 "낚시하기"를 시도해보세요!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {inventory
                    .sort((a, b) => {
                      // 희귀도 낮은 순으로 정렬 (rank가 낮을수록 희귀도가 낮음)
                      const fishA = allFishTypes.find(f => f.name === a.fish);
                      const fishB = allFishTypes.find(f => f.name === b.fish);
                      const rankA = fishA ? fishA.rank : 999;
                      const rankB = fishB ? fishB.rank : 999;
                      return rankA - rankB;
                    })
                    .map((item, index) => (
                    <div key={index} className={`p-4 rounded-xl hover:glow-effect transition-all duration-300 group ${
                      isDarkMode ? "glass-input" : "bg-white/60 backdrop-blur-sm border border-gray-300/40"
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                            <Fish className={`w-6 h-6 group-hover:scale-110 transition-transform ${
                              isDarkMode ? "text-blue-400" : "text-blue-600"
                            }`} />
                          </div>
                          <div>
                            <div className={`font-medium text-base ${
                              isDarkMode ? "text-white" : "text-gray-800"
                            }`}>{item.fish}</div>
                            <div className={`text-xs ${
                              isDarkMode ? "text-gray-400" : "text-gray-600"
                            }`}>보유량: {item.count}마리</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-emerald-500/20 to-blue-500/20 border ${
                            isDarkMode ? "border-emerald-400/20" : "border-emerald-500/30"
                          }`}>
                            <Coins className={`w-3 h-3 ${
                              isDarkMode ? "text-yellow-400" : "text-yellow-600"
                            }`} />
                            <span className={`text-xs font-bold ${
                              isDarkMode ? "text-yellow-400" : "text-yellow-600"
                            }`}>{(getFishPrice(item.fish, userEquipment) || 0).toLocaleString()}</span>
                          </div>
                          <button
                            onClick={() => openQuantityModal('sell', item.fish, item.count)}
                            className={`p-2 rounded-lg hover:scale-110 transition-all duration-300 ${
                              isDarkMode 
                                ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30" 
                                : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                            }`}
                            title="판매하기"
                          >
                            <Coins className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openQuantityModal('decompose', item.fish, item.count)}
                            className={`p-2 rounded-lg hover:scale-110 transition-all duration-300 ${
                              isDarkMode 
                                ? "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30" 
                                : "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20"
                            }`}
                            title={`분해하기 (${getFishMaterial(item.fish)} 획득)`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 재료 섹션 */}
              {materials.length > 0 && (
                <div className="mt-6">
                  <div className={`flex items-center justify-between mb-4 px-2 ${
                    isDarkMode ? "text-purple-400" : "text-purple-600"
                  }`}>
                    <div className="flex items-center gap-2">
                    <Gem className="w-5 h-5" />
                    <h3 className="font-semibold">재료 ({materials.length}종)</h3>
                    </div>
                    <button
                      onClick={fetchMaterials}
                      className={`p-2 rounded-lg hover:scale-110 transition-all duration-300 ${
                        isDarkMode 
                          ? "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30" 
                          : "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20"
                      }`}
                      title="재료 새로고침"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                  <div className="space-y-3">
                    {materials.map((item, index) => (
                      <div key={index} className={`p-4 rounded-xl hover:glow-effect transition-all duration-300 group ${
                        isDarkMode ? "glass-input" : "bg-white/60 backdrop-blur-sm border border-gray-300/40"
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                              <Gem className={`w-6 h-6 group-hover:scale-110 transition-transform ${
                                isDarkMode ? "text-purple-400" : "text-purple-600"
                              }`} />
                            </div>
                            <div>
                              <div className={`font-medium text-base ${
                                isDarkMode ? "text-white" : "text-gray-800"
                              }`}>{item.material}</div>
                              <div className={`text-xs ${
                                isDarkMode ? "text-gray-400" : "text-gray-600"
                              }`}>보유량: {item.count}개</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          )}

          {/* 상점 탭 */}
          {activeTab === "shop" && (
          <div className={`rounded-2xl board-shadow min-h-full flex flex-col ${
            isDarkMode ? "glass-card" : "bg-white/80 backdrop-blur-md border border-gray-300/30"
          }`}>
            {/* 상점 헤더 */}
            <div className={`border-b p-4 ${
              isDarkMode ? "border-white/10" : "border-gray-300/20"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                    <ShoppingCart className={`w-4 h-4 ${
                      isDarkMode ? "text-purple-400" : "text-purple-600"
                    }`} />
                  </div>
                  <div>
                    <h2 className={`text-lg font-semibold ${
                      isDarkMode ? "text-white" : "text-gray-800"
                    }`}>장비 상점</h2>
                    <p className={`text-xs ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}>낚시 장비와 악세서리를 구매하세요</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border ${
                    isDarkMode ? "border-yellow-400/20" : "border-yellow-500/30"
                  }`}>
                    <Coins className={`w-4 h-4 ${
                      isDarkMode ? "text-yellow-400" : "text-yellow-600"
                    }`} />
                    <span className={`text-sm font-bold ${
                      isDarkMode ? "text-yellow-400" : "text-yellow-600"
                    }`}>{(userMoney || 0).toLocaleString()}</span>
                    <span className={`text-xs ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}>골드</span>
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-orange-500/20 to-amber-500/20 border ${
                    isDarkMode ? "border-orange-400/20" : "border-orange-500/30"
                  }`}>
                    <Gem className={`w-4 h-4 ${
                      isDarkMode ? "text-orange-400" : "text-orange-600"
                    }`} />
                    <span className={`text-sm font-bold ${
                      isDarkMode ? "text-orange-400" : "text-orange-600"
                    }`}>{(userAmber || 0).toLocaleString()}</span>
                    <span className={`text-xs ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}>호박석</span>
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 border ${
                    isDarkMode ? "border-blue-400/20" : "border-blue-500/30"
                  }`}>
                    <Star className={`w-4 h-4 ${
                      isDarkMode ? "text-blue-400" : "text-blue-600"
                    }`} />
                    <span className={`text-sm font-bold ${
                      isDarkMode ? "text-blue-400" : "text-blue-600"
                    }`}>{(userStarPieces || 0).toLocaleString()}</span>
                    <span className={`text-xs ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}>별조각</span>
                  </div>
                </div>
              </div>
              
              {/* 카테고리 탭 */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setShopCategory("fishing_rod")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 font-medium ${
                    shopCategory === "fishing_rod"
                      ? isDarkMode
                        ? "bg-blue-500/20 text-blue-400 border border-blue-400/30"
                        : "bg-blue-500/10 text-blue-600 border border-blue-500/30"
                      : isDarkMode
                        ? "text-gray-400 hover:text-gray-300"
                        : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  <Waves className="w-4 h-4" />
                  <span className="text-sm">낚시대</span>
                </button>
                <button
                  onClick={() => setShopCategory("accessories")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 font-medium ${
                    shopCategory === "accessories"
                      ? isDarkMode
                        ? "bg-purple-500/20 text-purple-400 border border-purple-400/30"
                        : "bg-purple-500/10 text-purple-600 border border-purple-500/30"
                      : isDarkMode
                        ? "text-gray-400 hover:text-gray-300"
                        : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  <Gem className="w-4 h-4" />
                  <span className="text-sm">악세서리</span>
                </button>
              </div>
            </div>
            
            {/* 상점 목록 */}
            <div className="flex-1 p-4">
              {(() => {
                const availableItem = getAvailableShopItem(shopCategory, fishingSkill, userEquipment);
                
                if (!availableItem) {
                  return (
                    <div className="text-center py-12">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 mb-4 bounce-slow">
                        <Trophy className={`w-8 h-8 ${
                          isDarkMode ? "text-green-400" : "text-green-600"
                        }`} />
                      </div>
                      <p className={`text-lg font-medium mb-2 ${
                        isDarkMode ? "text-green-400" : "text-green-600"
                      }`}>최고 레벨 달성!</p>
                      <p className={`text-sm ${
                        isDarkMode ? "text-gray-400" : "text-gray-600"
                      }`}>
                        {shopCategory === 'fishing_rod' ? '모든 낚시대를 구매했습니다' : '모든 악세서리를 구매했습니다'}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="max-w-md mx-auto">
                    <div className={`p-6 rounded-xl hover:glow-effect transition-all duration-300 group ${
                      isDarkMode ? "glass-input" : "bg-white/60 backdrop-blur-sm border border-gray-300/40"
                    }`}>
                      <div className="text-center">
                        <div className="flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 mx-auto mb-4">
                          {shopCategory === "fishing_rod" ? (
                            <Waves className={`w-10 h-10 group-hover:scale-110 transition-transform ${
                              isDarkMode ? "text-blue-400" : "text-blue-600"
                            }`} />
                          ) : (
                            <Gem className={`w-10 h-10 group-hover:scale-110 transition-transform ${
                              isDarkMode ? "text-purple-400" : "text-purple-600"
                            }`} />
                          )}
                        </div>
                        
                        <h3 className={`font-bold text-xl mb-2 ${
                          isDarkMode ? "text-white" : "text-gray-800"
                        }`}>{availableItem.name}</h3>
                        
                        <p className={`text-sm mb-4 ${
                          isDarkMode ? "text-gray-400" : "text-gray-600"
                        }`}>{availableItem.description}</p>
                        
                        <div className={`flex items-center justify-center gap-2 mb-4 px-4 py-2 rounded-full bg-gradient-to-r ${
                          availableItem.currency === 'amber' 
                            ? 'from-orange-500/20 to-amber-500/20 border' + (isDarkMode ? ' border-orange-400/20' : ' border-orange-500/30')
                            : 'from-yellow-500/20 to-orange-500/20 border' + (isDarkMode ? ' border-yellow-400/20' : ' border-yellow-500/30')
                        }`}>
                          {availableItem.currency === 'amber' ? (
                            <>
                              <Gem className={`w-5 h-5 ${
                                isDarkMode ? "text-orange-400" : "text-orange-600"
                              }`} />
                              <span className={`font-bold text-lg ${
                                isDarkMode ? "text-orange-400" : "text-orange-600"
                              }`}>{(availableItem.price || 0).toLocaleString()}</span>
                              <span className={`text-sm ${
                                isDarkMode ? "text-gray-400" : "text-gray-600"
                              }`}>호박석</span>
                            </>
                          ) : (
                            <>
                              <Coins className={`w-5 h-5 ${
                                isDarkMode ? "text-yellow-400" : "text-yellow-600"
                              }`} />
                              <span className={`font-bold text-lg ${
                                isDarkMode ? "text-yellow-400" : "text-yellow-600"
                              }`}>{(availableItem.price || 0).toLocaleString()}</span>
                              <span className={`text-sm ${
                                isDarkMode ? "text-gray-400" : "text-gray-600"
                              }`}>골드</span>
                            </>
                          )}
                        </div>
                        
                        {/* 현재 장착된 아이템 정보 */}
                        {((shopCategory === 'fishing_rod' && userEquipment.fishingRod) || 
                          (shopCategory === 'accessories' && userEquipment.accessory)) && (
                          <div className={`mb-4 p-3 rounded-lg ${
                            isDarkMode ? "bg-gray-800/50 border border-gray-700/30" : "bg-gray-100/80 border border-gray-300/30"
                          }`}>
                            <p className={`text-xs mb-1 ${
                              isDarkMode ? "text-gray-500" : "text-gray-600"
                            }`}>현재 장착:</p>
                            <p className={`text-sm font-medium ${
                              isDarkMode ? "text-blue-400" : "text-blue-600"
                            }`}>
                              {shopCategory === 'fishing_rod' ? userEquipment.fishingRod : userEquipment.accessory}
                            </p>
                          </div>
                        )}
                        
                        <button
                          onClick={() => {
                            console.log("Shop button clicked:", { 
                              itemName: availableItem.name, 
                              price: availableItem.price, 
                              category: shopCategory,
                              currency: availableItem.currency,
                              currentUsername: username,
                              currentUserUuid: userUuid,
                              currentUserMoney: userMoney,
                              currentUserAmber: userAmber
                            });
                            buyItem(availableItem.name, availableItem.price, shopCategory, availableItem.currency);
                          }}
                          disabled={
                            availableItem.currency === 'amber' 
                              ? userAmber < availableItem.price
                              : userMoney < availableItem.price
                          }
                          className={`w-full py-3 px-6 rounded-lg font-bold text-lg transition-all duration-300 ${
                            availableItem.currency === 'amber'
                              ? userAmber >= availableItem.price
                              ? isDarkMode
                                  ? "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 hover:scale-105 glow-effect"
                                  : "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 hover:scale-105"
                                : isDarkMode
                                ? "bg-gray-500/20 text-gray-500 cursor-not-allowed"
                                : "bg-gray-300/30 text-gray-400 cursor-not-allowed"
                              : userMoney >= availableItem.price
                                ? isDarkMode
                                  ? "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 hover:scale-105 glow-effect"
                                  : "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 hover:scale-105"
                                : isDarkMode
                                  ? "bg-gray-500/20 text-gray-500 cursor-not-allowed"
                                  : "bg-gray-300/30 text-gray-400 cursor-not-allowed"
                          }`}
                        >
                          {availableItem.currency === 'amber' 
                            ? userAmber >= availableItem.price
                              ? "호박석으로 구매하기"
                              : "호박석 부족"
                            : userMoney >= availableItem.price 
                              ? "골드로 구매하기" 
                              : "골드 부족"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
          )}

          {/* 동료모집 탭 */}
          {activeTab === "companions" && (
            <CompanionTab
              // 상태
              isDarkMode={isDarkMode}
              userStarPieces={userStarPieces}
              companions={companions}
              battleCompanions={battleCompanions}
              companionStats={companionStats}
              
              // 함수
              recruitCompanion={recruitCompanion}
              toggleBattleCompanion={toggleBattleCompanion}
            />
          )}

          {/* 내정보 탭 */}
          {activeTab === "myinfo" && (
          <div className={`rounded-2xl board-shadow min-h-full flex flex-col ${
            isDarkMode ? "glass-card" : "bg-white/80 backdrop-blur-md border border-gray-300/30"
          }`}>
            {/* 내정보 헤더 */}
            <div className={`border-b p-4 ${
              isDarkMode ? "border-white/10" : "border-gray-300/20"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/20 to-green-500/20 border ${
                  isDarkMode ? "border-white/10" : "border-emerald-300/30"
                }`}>
                  <Trophy className={`w-4 h-4 ${
                    isDarkMode ? "text-emerald-400" : "text-emerald-600"
                  }`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className={`text-lg font-semibold ${
                      isDarkMode ? "text-white" : "text-gray-800"
                    }`}>내 정보</h2>
                    {isAdmin && (
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        isDarkMode ? "bg-red-500/20 text-red-400 border border-red-400/30" : "bg-red-500/10 text-red-600 border border-red-500/30"
                      }`}>관리자</span>
                    )}
                  </div>
                  <p className={`text-xs ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}>낚시 실력과 잡을 수 있는 물고기 목록</p>
                </div>
              </div>
            </div>
            
            {/* 내정보 콘텐츠 */}
            <div className="flex-1 p-4 space-y-6">
              
              {/* 기본 정보 */}
              <div className={`p-4 rounded-xl ${
                isDarkMode ? "glass-input" : "bg-white/60 backdrop-blur-sm border border-gray-300/40"
              }`}>
                <h3 className={`text-md font-semibold mb-3 ${
                  isDarkMode ? "text-white" : "text-gray-800"
                }`}>기본 정보</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className={`text-sm ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}>닉네임</span>
                    <span className={`text-sm font-medium ${
                      isDarkMode ? "text-white" : "text-gray-800"
                    }`}>{username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-sm ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}>낚시 실력</span>
                    <span className={`text-sm font-medium ${
                      isDarkMode ? "text-emerald-400" : "text-emerald-600"
                    }`}>Lv.{fishingSkill}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-sm ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}>보유 물고기</span>
                    <span className={`text-sm font-medium ${
                      isDarkMode ? "text-blue-400" : "text-blue-600"
                    }`}>{myCatches}마리</span>
                  </div>
                </div>
              </div>

              {/* 보유 동료 */}
              <div className={`p-4 rounded-xl ${
                isDarkMode ? "glass-input" : "bg-white/60 backdrop-blur-sm border border-gray-300/40"
              }`}>
                <h3 className={`text-md font-semibold mb-3 ${
                  isDarkMode ? "text-white" : "text-gray-800"
                }`}>보유 동료 ({companions.length}/6)</h3>
                {companions.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {companions.map((companion, index) => (
                      <div key={index} className={`p-3 rounded-lg text-center ${
                        isDarkMode ? "bg-purple-500/10 border border-purple-400/20" : "bg-purple-500/5 border border-purple-300/30"
                      }`}>
                        <div className={`font-medium text-sm ${
                          isDarkMode ? "text-purple-400" : "text-purple-600"
                        }`}>{companion}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={`text-center py-4 text-sm ${
                    isDarkMode ? "text-gray-500" : "text-gray-600"
                  }`}>
                    아직 동료가 없습니다.
                    <br />
                    동료모집 탭에서 동료를 영입해보세요!
                  </div>
                )}
              </div>

              {/* 전투 능력치 */}
              <div className={`p-4 rounded-xl ${
                isDarkMode ? "glass-input" : "bg-white/60 backdrop-blur-sm border border-gray-300/40"
              }`}>
                <h3 className={`text-md font-semibold mb-3 ${
                  isDarkMode ? "text-white" : "text-gray-800"
                }`}>전투 능력치</h3>
                <div className="space-y-3">
                                    {/* 체력 바 */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className={`text-sm ${
                        isDarkMode ? "text-gray-400" : "text-gray-600"
                      }`}>체력</span>
                      <span className={`text-sm font-medium ${
                        isDarkMode ? "text-green-400" : "text-green-600"
                      }`}>{(() => {
                        const accessoryLevel = getAccessoryLevel(userEquipment.accessory);
                        const maxHp = calculatePlayerMaxHp(accessoryLevel);
                        return `${maxHp} / ${maxHp}`;
                      })()}</span>
                    </div>
                    <div className={`w-full h-3 rounded-full ${
                      isDarkMode ? "bg-gray-700" : "bg-gray-200"
                    }`}>
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full"
                        style={{ width: '100%' }}
                      ></div>
                    </div>
                  </div>

                  {/* 공격력 정보 */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className={`text-sm ${
                        isDarkMode ? "text-gray-400" : "text-gray-600"
                      }`}>기본 공격력</span>
                      <span className={`text-sm font-medium ${
                        isDarkMode ? "text-orange-400" : "text-orange-600"
                      }`}>{getAttackRange(fishingSkill).base}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`text-xs ${
                        isDarkMode ? "text-gray-500" : "text-gray-500"
                      }`}>데미지 범위 (±20%)</span>
                      <span className={`text-xs font-medium ${
                        isDarkMode ? "text-red-400" : "text-red-600"
                      }`}>{getAttackRange(fishingSkill).min} - {getAttackRange(fishingSkill).max}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 낚을 수 있는 물고기 목록 */}
              <div className={`p-4 rounded-xl ${
                isDarkMode ? "glass-input" : "bg-white/60 backdrop-blur-sm border border-gray-300/40"
              }`}>
                <h3 className={`text-md font-semibold mb-3 ${
                  isDarkMode ? "text-white" : "text-gray-800"
                }`}>낚을 수 있는 물고기 (Lv.{fishingSkill})</h3>
                
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2" style={{scrollbarWidth: 'thin'}}>
                  {(() => {
                    // 서버와 동일한 로직으로 낚을 수 있는 물고기 계산
                    const probabilityTemplate = [40, 24, 15, 8, 5, 3, 2, 1, 0.7, 0.3];
                    
                    // 스타피쉬 제외한 일반 물고기들
                    const normalFish = allFishTypes.filter(f => f.name !== "스타피쉬");
                    
                    // 낚시실력에 따라 시작 인덱스만 1씩 증가 (최소 10개 유지)
                    const startIndex = Math.min(fishingSkill, Math.max(0, normalFish.length - 10));
                    const selectedFish = normalFish.slice(startIndex, startIndex + 10);
                    
                    // 고정된 확률 배열을 선택된 물고기에 적용
                    const availableFish = selectedFish.map((fish, index) => ({
                      ...fish,
                      probability: probabilityTemplate[index] || 0.1
                    }));
                    
                    // 스타피쉬는 항상 포함 (특별한 물고기)
                    const starFish = allFishTypes.find(f => f.name === "스타피쉬");
                    if (starFish) {
                      availableFish.push({
                        ...starFish,
                        probability: 1 // 스타피쉬는 항상 1%
                      });
                    }
                    
                    return availableFish.map((fish, index) => (
                      <div key={index} className={`flex items-center justify-between p-3 rounded-lg transition-all duration-300 hover:scale-[1.02] ${
                        isDarkMode ? "hover:bg-white/5 border border-transparent hover:border-white/10" : "hover:bg-gray-100/50 border border-transparent hover:border-gray-300/30"
                      }`}>
                        <div className="flex items-center gap-3">
                          <Fish className={`w-4 h-4 ${
                            isDarkMode ? "text-blue-400" : "text-blue-600"
                          }`} />
                          <div>
                            <p className={`text-sm font-medium ${
                              isDarkMode ? "text-white" : "text-gray-800"
                            }`}>{fish.name}</p>
                            <p className={`text-xs ${
                              isDarkMode ? "text-gray-500" : "text-gray-600"
                            }`}>{fish.rank}Rank • {(fish.price || 0).toLocaleString()}골드</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className={`text-xs px-2 py-1 rounded-full font-medium ${
                            fish.probability >= 10
                              ? isDarkMode 
                                ? "bg-emerald-500/20 text-emerald-400" 
                                : "bg-emerald-500/10 text-emerald-600"
                              : fish.probability >= 5
                                ? isDarkMode 
                                  ? "bg-yellow-500/20 text-yellow-400" 
                                  : "bg-yellow-500/10 text-yellow-600"
                                : isDarkMode 
                                  ? "bg-red-500/20 text-red-400" 
                                  : "bg-red-500/10 text-red-600"
                          }`}>
                            {fish.probability}%
                          </div>
                          <div className={`text-xs ${
                            isDarkMode ? "text-gray-500" : "text-gray-600"
                          }`}>
                            {fish.probability >= 10 ? "높음" : fish.probability >= 5 ? "보통" : "낮음"}
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
                
                {/* 스크롤 힌트 */}
                <div className={`text-center mt-3 pt-3 border-t ${
                  isDarkMode ? "border-white/10 text-gray-500" : "border-gray-300/20 text-gray-600"
                }`}>
                  <p className="text-xs">↕ 스크롤하여 더 많은 물고기를 확인하세요</p>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* [퀘스트] 퀘스트 탭 */}
          {activeTab === "quests" && (
          <div className={`rounded-2xl board-shadow min-h-full flex flex-col ${
            isDarkMode ? "glass-card" : "bg-white/80 backdrop-blur-md border border-gray-300/30"
          }`}>
            {/* 퀘스트 헤더 */}
            <div className={`border-b p-4 ${
              isDarkMode ? "border-white/10" : "border-gray-300/30"
            }`}>
              <div className="flex items-center gap-3">
                <Target className={`w-6 h-6 ${
                  isDarkMode ? "text-yellow-400" : "text-yellow-600"
                }`} />
                <h2 className={`text-xl font-bold ${
                  isDarkMode ? "text-white" : "text-gray-800"
                }`}>[Quest] 일일 퀘스트</h2>
              </div>
              <p className={`text-sm mt-2 ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}>매일 자정에 리셋되는 일일 퀘스트를 완료하고 보상을 받으세요!</p>
            </div>
            
            {/* 퀘스트 목록 */}
            <div className="p-4 flex-1 overflow-y-auto">
              {dailyQuests.quests && dailyQuests.quests.length > 0 ? (
                <div className="space-y-4">
                  {dailyQuests.quests.map((quest, index) => {
                    const isCompleted = quest.progress >= quest.target;
                    const canClaim = isCompleted && !quest.completed;
                    
                    return (
                      <div key={quest.id} className={`p-4 rounded-xl border transition-all duration-300 ${
                        isDarkMode 
                          ? quest.completed 
                            ? "bg-green-500/10 border-green-400/30" 
                            : canClaim 
                              ? "bg-yellow-500/10 border-yellow-400/30" 
                              : "bg-white/5 border-white/10 hover:border-white/20"
                          : quest.completed
                            ? "bg-green-50 border-green-200"
                            : canClaim
                              ? "bg-yellow-50 border-yellow-200"
                              : "bg-gray-50 border-gray-200 hover:border-gray-300"
                      }`}>
                        {/* 퀘스트 제목 */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className={`font-bold text-lg mb-1 ${
                              isDarkMode ? "text-white" : "text-gray-800"
                            }`}>{quest.name}</h3>
                            <p className={`text-sm ${
                              isDarkMode ? "text-gray-400" : "text-gray-600"
                            }`}>{quest.description}</p>
                          </div>
                          
                          {/* 상태 아이콘 */}
                          <div className="ml-4">
                            {quest.completed ? (
                              <CheckCircle className="w-6 h-6 text-green-500" />
                            ) : canClaim ? (
                              <Gift className="w-6 h-6 text-yellow-500" />
                            ) : (
                              <Target className={`w-6 h-6 ${
                                isDarkMode ? "text-gray-500" : "text-gray-400"
                              }`} />
                            )}
                          </div>
                        </div>
                        
                        {/* 진행도 바 */}
                        <div className="mb-3">
                          <div className="flex justify-between text-sm mb-1">
                            <span className={isDarkMode ? "text-gray-300" : "text-gray-700"}>
                              진행도
                            </span>
                            <span className={`font-medium ${
                              isDarkMode ? "text-white" : "text-gray-800"
                            }`}>
                              {quest.progress} / {quest.target}
                            </span>
                          </div>
                          <div className={`w-full bg-gray-200 rounded-full h-2 ${
                            isDarkMode ? "bg-white/10" : "bg-gray-200"
                          }`}>
                            <div 
                              className={`h-2 rounded-full transition-all duration-500 ${
                                quest.completed 
                                  ? "bg-green-500" 
                                  : canClaim 
                                    ? "bg-yellow-500" 
                                    : "bg-blue-500"
                              }`}
                              style={{ width: `${Math.min((quest.progress / quest.target) * 100, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                        
                        {/* 보상 및 버튼 */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Gem className="w-4 h-4 text-amber-500" />
                            <span className={`text-sm font-medium ${
                              isDarkMode ? "text-amber-400" : "text-amber-600"
                            }`}>{quest.reward}</span>
                          </div>
                          
                          {quest.completed ? (
                            <span className="text-sm text-green-500 font-medium">
                              ✓ 완료
                            </span>
                          ) : canClaim ? (
                            <button
                              onClick={() => claimQuestReward(quest.id)}
                              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors duration-200 font-medium text-sm"
                            >
                              보상 수령
                            </button>
                          ) : (
                            <span className={`text-sm ${
                              isDarkMode ? "text-gray-500" : "text-gray-400"
                            }`}>
                              진행 중...
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={`text-center py-12 ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}>
                  <Target className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>퀘스트를 로드하는 중...</p>
                </div>
              )}
              
              {/* 리셋 정보 */}
              {dailyQuests.lastResetDate && (
                <div className={`mt-6 p-3 rounded-lg text-center text-sm ${
                  isDarkMode ? "bg-white/5 text-gray-400" : "bg-gray-100 text-gray-600"
                }`}>
                  <Clock className="w-4 h-4 inline mr-1" />
                  마지막 리셋: {dailyQuests.lastResetDate} | 다음 리셋: 내일 자정
                </div>
              )}
            </div>
          </div>
          )}

          {/* 탐사 탭 */}
          {activeTab === "exploration" && (
          <div className={`rounded-2xl board-shadow min-h-full flex flex-col ${
            isDarkMode ? "glass-card" : "bg-white/80 backdrop-blur-md border border-gray-300/30"
          }`}>
            {/* 탐사 헤더 */}
            <div className={`border-b p-4 ${
              isDarkMode ? "border-white/10" : "border-gray-300/20"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-orange-500/20 to-red-500/20 border ${
                  isDarkMode ? "border-white/10" : "border-orange-300/30"
                }`}>
                  <Waves className={`w-4 h-4 ${
                    isDarkMode ? "text-orange-400" : "text-orange-600"
                  }`} />
                </div>
                <div>
                  <h2 className={`text-lg font-semibold ${
                    isDarkMode ? "text-white" : "text-gray-800"
                  }`}>탐사</h2>
                  <p className={`text-xs ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}>재료를 사용해 몬스터와 전투하고 호박석을 획득하세요</p>
                </div>
              </div>
            </div>
            
            {/* 탐사 콘텐츠 */}
            <div className="flex-1 p-4 space-y-6">
              
              {/* 탐사 시작 버튼 */}
              <div className={`p-6 rounded-xl text-center ${
                isDarkMode ? "glass-input" : "bg-white/60 backdrop-blur-sm border border-gray-300/40"
              }`}>
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-orange-500/20 to-red-500/20 mb-4 ${
                  isDarkMode ? "border border-orange-400/30" : "border border-orange-300/30"
                }`}>
                  <Waves className={`w-8 h-8 ${
                    isDarkMode ? "text-orange-400" : "text-orange-600"
                  }`} />
                </div>
                <h3 className={`text-lg font-semibold mb-2 ${
                  isDarkMode ? "text-white" : "text-gray-800"
                }`}>탐사 시작</h3>
                <p className={`text-sm mb-4 ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}>인벤토리의 재료를 사용해 탐사를 떠나보세요!</p>
                
                <button
                  onClick={() => {
                    setShowExplorationModal(true);
                  }}
                  disabled={materials.length === 0}
                  className={`px-6 py-3 rounded-lg font-bold text-lg transition-all duration-300 ${
                    materials.length > 0
                      ? isDarkMode
                        ? "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 hover:scale-105 glow-effect"
                        : "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 hover:scale-105"
                      : isDarkMode
                        ? "bg-gray-500/20 text-gray-500 cursor-not-allowed"
                        : "bg-gray-300/30 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  {materials.length > 0 
                    ? "탐사하기" 
                      : "재료가 필요합니다"
                  }
                </button>
              </div>

              {/* 사용 가능한 재료 목록 */}
              {materials.length > 0 && (
                <div className={`p-4 rounded-xl ${
                  isDarkMode ? "glass-input" : "bg-white/60 backdrop-blur-sm border border-gray-300/40"
                }`}>
                  <h3 className={`text-md font-semibold mb-3 ${
                    isDarkMode ? "text-white" : "text-gray-800"
                  }`}>사용 가능한 재료</h3>
                  
                  <div className="grid grid-cols-2 gap-3 max-h-[40vh] overflow-y-auto">
                    {materials.map((material, index) => (
                      <div key={index} className={`p-3 rounded-lg transition-all duration-300 hover:scale-105 ${
                        isDarkMode ? "hover:bg-white/5 border border-white/10" : "hover:bg-gray-100/50 border border-gray-300/30"
                      }`}>
                        <div className="flex items-center gap-2">
                          <Diamond className={`w-4 h-4 ${
                            isDarkMode ? "text-purple-400" : "text-purple-600"
                          }`} />
                          <div>
                            <p className={`text-sm font-medium ${
                              isDarkMode ? "text-white" : "text-gray-800"
                            }`}>{material.material}</p>
                            <p className={`text-xs ${
                              isDarkMode ? "text-gray-500" : "text-gray-600"
                            }`}>{material.count}개 보유</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          )}

          </div>
          )}
          
          {/* 사이드바 - 접속자 목록 - 랭킹 탭에서는 숨김 */}
          {activeTab !== "ranking" && (
          <div className="xl:col-span-1 h-full">
            <div className={`rounded-2xl board-shadow h-full flex flex-col ${
              isDarkMode ? "glass-card" : "bg-white/80 backdrop-blur-md border border-gray-300/30"
            }`}>
              {/* 사이드바 헤더 */}
              <div className={`border-b p-4 ${
                isDarkMode ? "border-white/10" : "border-gray-300/20"
              }`}>
                <div className="flex items-center gap-2">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/20 to-green-500/20 border ${
                    isDarkMode ? "border-white/10" : "border-emerald-300/30"
                  }`}>
                    <User className={`w-4 h-4 ${
                      isDarkMode ? "text-emerald-400" : "text-emerald-600"
                    }`} />
                  </div>
                  <div>
                    <h3 className={`font-semibold text-sm ${
                      isDarkMode ? "text-white" : "text-gray-800"
                    }`}>접속자</h3>
                    <p className={`text-xs ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}>{connectedUsers.length}명 온라인</p>
                  </div>
                </div>
              </div>

              {/* 접속자 목록 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {connectedUsers.map((user, index) => (
                  <div 
                    key={index} 
                    className={`flex items-center gap-3 p-2 rounded-lg transition-all duration-300 hover:scale-105 cursor-pointer ${
                      isDarkMode ? "hover:bg-white/5" : "hover:bg-gray-100/50"
                    }`}
                    onClick={async () => {
                      if (user.username === username) {
                        setSelectedUserProfile(null); // 내 프로필
                        setOtherUserData(null); // 다른 사용자 데이터 초기화
                      } else {
                        setSelectedUserProfile({ username: user.username }); // 다른 사용자 프로필
                        await fetchOtherUserProfile(user.username); // 해당 사용자 데이터 가져오기
                      }
                      setShowProfile(true);
                    }}
                    title={`${user.username}님의 프로필 보기`}
                  >
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border ${
                      isDarkMode ? "border-white/10" : "border-blue-300/30"
                    }`}>
                      <User className={`w-4 h-4 ${
                        isDarkMode ? "text-blue-400" : "text-blue-600"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium text-sm truncate flex items-center gap-1 ${
                        isDarkMode ? "text-white" : "text-gray-800"
                      }`}>
                        {user.username}
                        {((user.username === username && isAdmin) || userAdminStatus[user.username]) && (
                          <span className={`text-xs font-bold ${
                            isDarkMode ? "text-red-400" : "text-red-600"
                          }`}>👑</span>
                        )}
                      </div>
                      <div className={`text-xs ${
                        isDarkMode ? "text-gray-400" : "text-gray-600"
                      }`}>
                        {user.loginType || "Guest"}
                      </div>
                    </div>
                    <div className={`w-2 h-2 rounded-full bg-gradient-to-r from-emerald-400 to-green-400 animate-pulse`}></div>
                  </div>
                ))}
                
                {connectedUsers.length === 0 && (
                  <div className={`text-center py-8 ${
                    isDarkMode ? "text-gray-500" : "text-gray-600"
                  }`}>
                    <User className={`w-12 h-12 mx-auto mb-2 opacity-30 ${
                      isDarkMode ? "text-gray-600" : "text-gray-400"
                    }`} />
                    <p className="text-sm">접속자가 없습니다</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          )}

        </div>
      </div>

      {/* 프로필 모달 */}
      {showProfile && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            // 배경 클릭 시 모달 닫기 (모달 내용 클릭 시에는 닫히지 않음)
            if (e.target === e.currentTarget) {
              setShowProfile(false);
              setSelectedUserProfile(null);
              setOtherUserData(null);
            }
          }}
        >
          <div className={`w-full max-w-md rounded-2xl board-shadow ${
            isDarkMode ? "glass-card" : "bg-white/90 backdrop-blur-md border border-gray-300/30"
          }`}>
            {/* 모달 헤더 */}
            <div className={`flex items-center justify-between p-4 border-b ${
              isDarkMode ? "border-white/10" : "border-gray-300/20"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border ${
                  isDarkMode ? "border-white/10" : "border-blue-300/30"
                }`}>
                  <User className={`w-5 h-5 ${
                    isDarkMode ? "text-blue-400" : "text-blue-600"
                  }`} />
                </div>
                <div>
                      <h2 className={`text-lg font-semibold ${
                        isDarkMode ? "text-white" : "text-gray-800"
                      }`}>{selectedUserProfile ? `${selectedUserProfile.username}님의 프로필` : `${username}님의 프로필`}</h2>
                  <div className="flex flex-col gap-1">
                    {/* 🛡️ [SECURITY] UUID는 관리자에게만 표시 */}
                    {(selectedUserProfile ? otherUserData?.userUuid : userUuid) && isAdmin && (
                      <div className="flex items-center gap-2">
                        <p className={`text-xs font-mono ${
                          isDarkMode ? "text-green-400" : "text-green-600"
                        }`}>🔑 ID: {selectedUserProfile ? otherUserData?.userUuid : userUuid}</p>
                        {!selectedUserProfile && ( // 내 프로필일 때만 관리자 기능 표시
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setShowResetConfirm(true)}
                              className={`text-xs px-2 py-1 rounded transition-all duration-300 hover:scale-105 ${
                                isDarkMode 
                                  ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" 
                                  : "bg-red-500/10 text-red-600 hover:bg-red-500/20"
                              }`}
                              title="모든 데이터를 초기화합니다"
                            >
                              계정 초기화
                            </button>
                            <button
                              onClick={openIPManager}
                              className={`text-xs px-2 py-1 rounded transition-all duration-300 hover:scale-105 ${
                                isDarkMode 
                                  ? "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30" 
                                  : "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20"
                              }`}
                              title="IP 차단 관리"
                            >
                              🛡️ IP 관리
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    <p className={`text-xs ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}>장착된 장비</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowProfile(false);
                  setSelectedUserProfile(null); // 선택된 사용자 정보 초기화
                  setOtherUserData(null); // 다른 사용자 데이터 초기화
                }}
                className={`p-2 rounded-lg hover:scale-110 transition-all duration-300 ${
                  isDarkMode 
                    ? "glass-input text-gray-400 hover:text-white" 
                    : "bg-white/60 backdrop-blur-sm border border-gray-300/40 text-gray-600 hover:text-gray-800"
                }`}
              >
                ✕
              </button>
            </div>

            {/* 모달 콘텐츠 */}
            <div className="p-4 space-y-4">
              {/* 낚시대 */}
              <div className={`p-4 rounded-xl ${
                isDarkMode ? "glass-input" : "bg-white/60 backdrop-blur-sm border border-gray-300/40"
              }`}>
                <div className="flex items-center gap-3 mb-2">
                  <Waves className={`w-5 h-5 ${
                    isDarkMode ? "text-blue-400" : "text-blue-600"
                  }`} />
                  <h3 className={`font-medium ${
                    isDarkMode ? "text-white" : "text-gray-800"
                  }`}>낚시대</h3>
                </div>
                {(selectedUserProfile ? otherUserData?.equipment?.fishingRod : userEquipment.fishingRod) ? (
                  <div className={`text-sm ${
                    isDarkMode ? "text-gray-300" : "text-gray-700"
                  }`}>
                    <div className="font-medium text-blue-500">
                      {selectedUserProfile ? otherUserData?.equipment?.fishingRod : userEquipment.fishingRod}
                    </div>
                    <div className={`text-xs mt-1 ${
                      isDarkMode ? "text-gray-500" : "text-gray-600"
                    }`}>장착됨</div>
                  </div>
                ) : (
                  <div className={`text-sm ${
                    isDarkMode ? "text-gray-500" : "text-gray-600"
                  }`}>
                    장착된 낚시대가 없습니다
                  </div>
                )}
              </div>

              {/* 악세서리 */}
              <div className={`p-4 rounded-xl ${
                isDarkMode ? "glass-input" : "bg-white/60 backdrop-blur-sm border border-gray-300/40"
              }`}>
                <div className="flex items-center gap-3 mb-2">
                  <Gem className={`w-5 h-5 ${
                    isDarkMode ? "text-purple-400" : "text-purple-600"
                  }`} />
                  <h3 className={`font-medium ${
                    isDarkMode ? "text-white" : "text-gray-800"
                  }`}>악세서리</h3>
                </div>
                {(selectedUserProfile ? otherUserData?.equipment?.accessory : userEquipment.accessory) ? (
                  <div className={`text-sm ${
                    isDarkMode ? "text-gray-300" : "text-gray-700"
                  }`}>
                    <div className="font-medium text-purple-500">
                      {selectedUserProfile ? otherUserData?.equipment?.accessory : userEquipment.accessory}
                    </div>
                    <div className={`text-xs mt-1 ${
                      isDarkMode ? "text-gray-500" : "text-gray-600"
                    }`}>장착됨</div>
                  </div>
                ) : (
                  <div className={`text-sm ${
                    isDarkMode ? "text-gray-500" : "text-gray-600"
                  }`}>
                    장착된 악세서리가 없습니다
  </div>
                )}
              </div>

              {/* 내 정보 */}
              <div className={`p-4 rounded-xl ${
                isDarkMode ? "glass-input" : "bg-white/60 backdrop-blur-sm border border-gray-300/40"
              }`}>
                <div className="flex items-center gap-3 mb-2">
                  <User className={`w-5 h-5 ${
                    isDarkMode ? "text-emerald-400" : "text-emerald-600"
                  }`} />
                  <h3 className={`font-medium ${
                    isDarkMode ? "text-white" : "text-gray-800"
                  }`}>{selectedUserProfile ? "사용자 정보" : "내 정보"}</h3>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <div className={`font-bold text-lg ${
                      isDarkMode ? "text-emerald-400" : "text-emerald-600"
                    }`}>
                      {selectedUserProfile ? (otherUserData?.totalCatches || 0) : myCatches}
                    </div>
                    <div className={`text-xs ${
                      isDarkMode ? "text-gray-500" : "text-gray-600"
                    }`}>보유 물고기</div>
                  </div>
                  <div className="text-center">
                    <div className={`font-bold text-lg ${
                      isDarkMode ? "text-yellow-400" : "text-yellow-600"
                    }`}>
                      {selectedUserProfile ? (otherUserData?.money || 0).toLocaleString() : (userMoney || 0).toLocaleString()}
                    </div>
                    <div className={`text-xs ${
                      isDarkMode ? "text-gray-500" : "text-gray-600"
                    }`}>보유 골드</div>
                  </div>
                  <div className="text-center">
                    <div className={`font-bold text-lg ${
                      isDarkMode ? "text-orange-400" : "text-orange-600"
                    }`}>
                      {selectedUserProfile ? (otherUserData?.amber || 0).toLocaleString() : (userAmber || 0).toLocaleString()}
                    </div>
                    <div className={`text-xs ${
                      isDarkMode ? "text-gray-500" : "text-gray-600"
                    }`}>보유 호박석</div>
                  </div>
                  <div className="text-center">
                    <div className={`font-bold text-lg ${
                      isDarkMode ? "text-blue-400" : "text-blue-600"
                    }`}>
                      {selectedUserProfile ? (otherUserData?.fishingSkill || 0) : fishingSkill}
                    </div>
                    <div className={`text-xs ${
                      isDarkMode ? "text-gray-500" : "text-gray-600"
                    }`}>낚시실력</div>
                  </div>
                </div>
              </div>

              {/* 계정 관리 버튼들 */}
              <div className="flex gap-2 pt-4 border-t border-gray-300/20">
                {!selectedUserProfile ? (
                  // 내 프로필일 때
                  <>
                    {/* 계정 초기화 버튼 */}
                    <button
                      onClick={() => setShowResetConfirm(true)}
                      className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-300 hover:scale-105 ${
                        isDarkMode
                          ? "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-400/30"
                          : "bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 border border-yellow-500/30"
                      }`}
                    >
                      계정 초기화
                    </button>
                    
                    {/* 계정 탈퇴 버튼 */}
                    <button
                      onClick={deleteAccount}
                      className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-300 hover:scale-105 ${
                        isDarkMode
                          ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-400/30"
                          : "bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/30"
                      }`}
                    >
                      계정 탈퇴
                    </button>
                  </>
                ) : (
                  // 다른 사용자 프로필일 때 - 관리자만 계정 관리 버튼 표시
                  isAdmin && (
                    <>
                      {/* 관리자 권한: 사용자 계정 초기화 */}
                      <button
                        onClick={() => adminResetUserAccount(selectedUserProfile.username)}
                        className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-300 hover:scale-105 ${
                          isDarkMode
                            ? "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-400/30"
                            : "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 border border-orange-500/30"
                        }`}
                        title="관리자 권한으로 사용자 계정을 초기화합니다"
                      >
                        🔑 계정 초기화
                      </button>
                      
                      {/* 관리자 권한: 사용자 계정 삭제 */}
                      <button
                        onClick={() => adminDeleteUserAccount(selectedUserProfile.username)}
                        className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-300 hover:scale-105 ${
                          isDarkMode
                            ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-400/30"
                            : "bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/30"
                        }`}
                        title="관리자 권한으로 사용자 계정을 삭제합니다"
                      >
                        🔑 계정 삭제
                      </button>
                    </>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

          {/* 랭킹 탭 */}
          {activeTab === "ranking" && (
            <div className={`rounded-2xl board-shadow min-h-full flex flex-col ${
              isDarkMode ? "glass-card" : "bg-white/80 backdrop-blur-md border border-gray-300/30"
            }`}>
        {/* 랭킹 헤더 */}
        <div className={`border-b p-4 ${
          isDarkMode ? "border-white/10" : "border-gray-300/20"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border ${
                isDarkMode ? "border-white/10" : "border-yellow-300/30"
              }`}>
                <Trophy className={`w-4 h-4 ${
                  isDarkMode ? "text-yellow-400" : "text-yellow-600"
                }`} />
              </div>
              <div>
                <h2 className={`text-lg font-semibold ${
                  isDarkMode ? "text-white" : "text-gray-800"
                }`}>랭킹</h2>
                <p className={`text-xs ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}>왼쪽 사이드바에서 확인하세요</p>
              </div>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs ${
              isDarkMode ? "bg-yellow-500/20 text-yellow-400" : "bg-yellow-500/10 text-yellow-600"
            }`}>
              총 {rankings.length}명
            </div>
          </div>
        </div>
        
        {/* 랭킹 콘텐츠 - 사이드바로 이동됨 */}
        <div className="flex-1 p-8 flex items-center justify-center">
          <div className={`text-center ${
            isDarkMode ? "text-gray-400" : "text-gray-600"
          }`}>
            <Trophy className={`w-16 h-16 mx-auto mb-4 opacity-30 ${
              isDarkMode ? "text-gray-600" : "text-gray-400"
            }`} />
            <h3 className={`text-lg font-semibold mb-2 ${
              isDarkMode ? "text-white" : "text-gray-800"
            }`}>랭킹</h3>
            <p>전체 랭킹이 표시됩니다</p>
          </div>
        </div>
        {/* 기존 랭킹 리스트는 제거됨 */}
        <div style={{display: 'none'}}>
          {rankings.length > 0 ? (
            rankings.map((user, index) => (
              <div key={user.userUuid || user.username} className={`p-4 rounded-xl transition-all duration-300 hover:scale-105 cursor-pointer ${
                isDarkMode ? "glass-input" : "bg-white/60 backdrop-blur-sm border border-gray-300/40"
              } ${(user.displayName || user.username) === username ? 
                (isDarkMode ? "ring-2 ring-yellow-400/50 bg-yellow-500/10" : "ring-2 ring-yellow-500/50 bg-yellow-500/5")
                : ""
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* 순위 */}
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-lg ${
                      user.rank === 1 
                        ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-white"
                        : user.rank === 2 
                        ? "bg-gradient-to-br from-gray-300 to-gray-500 text-white" 
                        : user.rank === 3
                        ? "bg-gradient-to-br from-amber-600 to-amber-800 text-white"
                        : isDarkMode 
                        ? "bg-gray-700 text-gray-300"
                        : "bg-gray-200 text-gray-600"
                    }`}>
                      {user.rank <= 3 && user.rank === 1 && "🥇"}
                      {user.rank <= 3 && user.rank === 2 && "🥈"}
                      {user.rank <= 3 && user.rank === 3 && "🥉"}
                      {user.rank > 3 && user.rank}
                    </div>
                    
                    {/* 사용자 정보 */}
                    <div>
                      <div className={`font-medium text-base flex items-center gap-2 ${
                        isDarkMode ? "text-white" : "text-gray-800"
                      }`}>
                        {user.username}
                        {((user.username === username && isAdmin) || userAdminStatus[user.username]) && (
                          <span className={`text-xs font-bold ${
                            isDarkMode ? "text-red-400" : "text-red-600"
                          }`}>👑</span>
                        )}
                        {user.username === username && (
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            isDarkMode ? "bg-blue-500/20 text-blue-400" : "bg-blue-500/10 text-blue-600"
                          }`}>나</span>
                        )}
                      </div>
                      <div className={`text-sm ${
                        isDarkMode ? "text-gray-400" : "text-gray-600"
                      }`}>
                        {user.userUuid || "게스트"}
                      </div>
                    </div>
                  </div>
                  
                  {/* 통계 */}
                  <div className="text-right">
                    <div className={`font-bold text-lg ${
                      isDarkMode ? "text-blue-400" : "text-blue-600"
                    }`}>
                      {(user.totalFishCaught || user.totalCatches || 0).toLocaleString()}마리
                    </div>
                    <div className={`text-sm ${
                      isDarkMode ? "text-emerald-400" : "text-emerald-600"
                    }`}>
                      Lv.{user.fishingSkill || 0}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className={`text-center py-12 ${
              isDarkMode ? "text-gray-500" : "text-gray-600"
            }`}>
              <Trophy className={`w-16 h-16 mx-auto mb-4 opacity-30 ${
                isDarkMode ? "text-gray-600" : "text-gray-400"
              }`} />
              <p>아직 랭킹 데이터가 없습니다.</p>
              <p className="text-sm mt-2">낚시를 시작해보세요!</p>
            </div>
          )}
        </div> {/* 숨겨진 div 닫기 */}
            </div>
      )}

      {/* 수량 입력 모달 */}
      {showQuantityModal && quantityModalData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-2xl board-shadow ${
            isDarkMode ? "glass-card" : "bg-white/90 backdrop-blur-md border border-gray-300/30"
          }`}>
            {/* 모달 헤더 */}
            <div className={`flex items-center justify-between p-4 border-b ${
              isDarkMode ? "border-white/10" : "border-gray-300/20"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br ${
                  quantityModalData.type === 'sell' 
                    ? "from-emerald-500/20 to-green-500/20" 
                    : "from-purple-500/20 to-pink-500/20"
                } border ${
                  isDarkMode ? "border-white/10" : "border-gray-300/30"
                }`}>
                  {quantityModalData.type === 'sell' ? (
                    <Coins className={`w-5 h-5 ${
                      isDarkMode ? "text-emerald-400" : "text-emerald-600"
                    }`} />
                  ) : (
                    <Trash2 className={`w-5 h-5 ${
                      isDarkMode ? "text-purple-400" : "text-purple-600"
                    }`} />
                  )}
                </div>
                <div>
                  <h2 className={`text-lg font-semibold ${
                    isDarkMode ? "text-white" : "text-gray-800"
                  }`}>
                    {quantityModalData.type === 'sell' ? '물고기 판매' : '물고기 분해'}
                  </h2>
                  <p className={`text-sm ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}>{quantityModalData.fishName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowQuantityModal(false)}
                className={`p-2 rounded-lg hover:scale-110 transition-all duration-300 ${
                  isDarkMode 
                    ? "glass-input text-gray-400 hover:text-white" 
                    : "bg-white/60 backdrop-blur-sm border border-gray-300/40 text-gray-600 hover:text-gray-800"
                }`}
              >
                ✕
              </button>
            </div>

            {/* 모달 콘텐츠 */}
            <div className="p-4 space-y-4">
              <div className={`p-4 rounded-xl ${
                isDarkMode ? "glass-input" : "bg-white/60 backdrop-blur-sm border border-gray-300/40"
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-sm ${
                    isDarkMode ? "text-gray-300" : "text-gray-700"
                  }`}>보유량:</span>
                  <span className={`font-bold ${
                    isDarkMode ? "text-white" : "text-gray-800"
                  }`}>{quantityModalData.maxQuantity}마리</span>
                </div>
                
                <div className="space-y-3">
                  <label className={`block text-sm font-medium ${
                    isDarkMode ? "text-gray-300" : "text-gray-700"
                  }`}>
                    {quantityModalData.type === 'sell' ? '판매' : '분해'} 수량:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={quantityModalData.maxQuantity}
                    value={inputQuantity}
                    onChange={(e) => setInputQuantity(Math.max(1, Math.min(quantityModalData.maxQuantity, parseInt(e.target.value) || 1)))}
                    className={`w-full px-4 py-3 rounded-xl text-center font-bold text-lg transition-all duration-300 focus:scale-105 ${
                      isDarkMode 
                        ? "glass-input text-white placeholder-gray-400" 
                        : "bg-white/60 backdrop-blur-sm border border-gray-300/40 text-gray-800 placeholder-gray-500"
                    }`}
                  />
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => setInputQuantity(1)}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-300 ${
                        isDarkMode 
                          ? "glass-input text-gray-300 hover:text-white" 
                          : "bg-white/60 backdrop-blur-sm border border-gray-300/40 text-gray-600 hover:text-gray-800"
                      }`}
                    >
                      1개
                    </button>
                    <button
                      onClick={() => setInputQuantity(Math.floor(quantityModalData.maxQuantity / 2))}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-300 ${
                        isDarkMode 
                          ? "glass-input text-gray-300 hover:text-white" 
                          : "bg-white/60 backdrop-blur-sm border border-gray-300/40 text-gray-600 hover:text-gray-800"
                      }`}
                    >
                      절반
                    </button>
                    <button
                      onClick={() => setInputQuantity(quantityModalData.maxQuantity)}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-300 ${
                        isDarkMode 
                          ? "glass-input text-gray-300 hover:text-white" 
                          : "bg-white/60 backdrop-blur-sm border border-gray-300/40 text-gray-600 hover:text-gray-800"
                      }`}
                    >
                      전체
                    </button>
                  </div>
                </div>
                
                {quantityModalData.type === 'sell' && (
                  <div className={`mt-4 p-3 rounded-lg ${
                    isDarkMode ? "bg-emerald-500/10 border border-emerald-400/20" : "bg-emerald-500/5 border border-emerald-500/20"
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm ${
                        isDarkMode ? "text-emerald-300" : "text-emerald-700"
                      }`}>예상 수익:</span>
                      <span className={`font-bold ${
                        isDarkMode ? "text-emerald-400" : "text-emerald-600"
                      }`}>
                        {((getFishPrice(quantityModalData.fishName, userEquipment) || 0) * inputQuantity).toLocaleString()}골드
                      </span>
                    </div>
                  </div>
                )}
                
                {quantityModalData.type === 'decompose' && (
                  <div className={`mt-4 p-3 rounded-lg ${
                    isDarkMode ? "bg-purple-500/10 border border-purple-400/20" : "bg-purple-500/5 border border-purple-500/20"
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm ${
                        isDarkMode ? "text-purple-300" : "text-purple-700"
                      }`}>획득 재료:</span>
                      <span className={`font-bold ${
                        isDarkMode ? "text-purple-400" : "text-purple-600"
                      }`}>
                        {getFishMaterial(quantityModalData.fishName)} {inputQuantity}개
                      </span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowQuantityModal(false)}
                  className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-300 ${
                    isDarkMode 
                      ? "glass-input text-gray-400 hover:text-white" 
                      : "bg-white/60 backdrop-blur-sm border border-gray-300/40 text-gray-600 hover:text-gray-800"
                  }`}
                >
                  취소
                </button>
                <button
                  onClick={handleQuantityConfirm}
                  className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all duration-300 hover:scale-105 glow-effect ${
                    quantityModalData.type === 'sell'
                      ? isDarkMode
                        ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                        : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                      : isDarkMode
                        ? "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                        : "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20"
                  }`}
                >
                  {quantityModalData.type === 'sell' ? '판매하기' : '분해하기'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IP 차단 관리 모달 */}
      {showIPManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-lg shadow-xl ${
            isDarkMode ? "bg-gray-800" : "bg-white"
          }`}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className={`text-xl font-bold ${
                  isDarkMode ? "text-white" : "text-gray-800"
                }`}>🛡️ IP 차단 관리</h2>
                <button
                  onClick={() => setShowIPManager(false)}
                  className={`p-2 rounded-full hover:bg-gray-600/20 transition-colors ${
                    isDarkMode ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* IP 차단 추가 폼 */}
              <div className={`p-4 rounded-lg mb-6 ${
                isDarkMode ? "bg-gray-700/50" : "bg-gray-50"
              }`}>
                <h3 className={`text-lg font-semibold mb-4 ${
                  isDarkMode ? "text-white" : "text-gray-800"
                }`}>새 IP 차단</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}>IP 주소</label>
                    <input
                      type="text"
                      value={newIPAddress}
                      onChange={(e) => setNewIPAddress(e.target.value)}
                      placeholder="예: 192.168.1.1"
                      pattern="^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$"
                      className={`w-full px-3 py-2 rounded-lg border transition-colors ${
                        isDarkMode
                          ? "bg-gray-600 border-gray-500 text-white placeholder-gray-400 focus:border-purple-400"
                          : "bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-purple-500"
                      } focus:outline-none focus:ring-2 focus:ring-purple-500/20`}
                    />
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}>차단 사유</label>
                    <input
                      type="text"
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      placeholder="예: 해킹 시도, 스팸 등"
                      className={`w-full px-3 py-2 rounded-lg border transition-colors ${
                        isDarkMode
                          ? "bg-gray-600 border-gray-500 text-white placeholder-gray-400 focus:border-purple-400"
                          : "bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-purple-500"
                      } focus:outline-none focus:ring-2 focus:ring-purple-500/20`}
                    />
                  </div>
                </div>
                
                <button
                  onClick={blockIP}
                  className={`mt-4 px-4 py-2 rounded-lg font-medium transition-all duration-300 hover:scale-105 ${
                    isDarkMode
                      ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-400/30"
                      : "bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/30"
                  }`}
                >
                  🚫 IP 차단
                </button>
              </div>

              {/* 계정 차단 추가 폼 */}
              <div className={`p-4 rounded-lg mb-6 ${
                isDarkMode ? "bg-orange-900/20" : "bg-orange-50"
              }`}>
                <h3 className={`text-lg font-semibold mb-4 ${
                  isDarkMode ? "text-orange-300" : "text-orange-800"
                }`}>🔒 새 계정 차단</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? "text-orange-300" : "text-orange-700"
                    }`}>사용자명 또는 UUID</label>
                    <input
                      type="text"
                      value={newAccountTarget}
                      onChange={(e) => setNewAccountTarget(e.target.value)}
                      placeholder="예: 사용자명 또는 #0001"
                      className={`w-full px-3 py-2 rounded-lg border transition-colors ${
                        isDarkMode
                          ? "bg-gray-600 border-gray-500 text-white placeholder-gray-400 focus:border-orange-400"
                          : "bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-orange-500"
                      } focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
                    />
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? "text-orange-300" : "text-orange-700"
                    }`}>차단 사유</label>
                    <input
                      type="text"
                      value={accountBlockReason}
                      onChange={(e) => setAccountBlockReason(e.target.value)}
                      placeholder="예: 부적절한 행동, 해킹 시도 등"
                      className={`w-full px-3 py-2 rounded-lg border transition-colors ${
                        isDarkMode
                          ? "bg-gray-600 border-gray-500 text-white placeholder-gray-400 focus:border-orange-400"
                          : "bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-orange-500"
                      } focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
                    />
                  </div>
                </div>
                
                <button
                  onClick={blockAccountManually}
                  className={`mt-4 px-4 py-2 rounded-lg font-medium transition-all duration-300 hover:scale-105 ${
                    isDarkMode
                      ? "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-400/30"
                      : "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 border border-orange-500/30"
                  }`}
                >
                  🔒 계정 차단
                </button>
              </div>

              {/* 현재 접속자 IP 목록 */}
              <div className={`p-4 rounded-lg mb-6 ${
                isDarkMode ? "bg-blue-900/20" : "bg-blue-50"
              }`}>
                <h3 className={`text-lg font-semibold mb-4 ${
                  isDarkMode ? "text-blue-300" : "text-blue-800"
                }`}>🌐 현재 접속자 IP ({connectedUsersList.length}명)</h3>
                
                {connectedUsersList.length === 0 ? (
                  <div className={`text-center py-4 ${
                    isDarkMode ? "text-blue-400" : "text-blue-600"
                  }`}>
                    현재 접속 중인 사용자가 없습니다.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {connectedUsersList.map((user, index) => (
                      <div
                        key={`${user.userUuid}-${index}`}
                        className={`p-3 rounded-lg border ${
                          isDarkMode
                            ? "bg-blue-800/30 border-blue-600/50"
                            : "bg-blue-100/50 border-blue-200"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <span className={`font-bold ${
                                isDarkMode ? "text-blue-300" : "text-blue-700"
                              }`}>👤 {user.username}</span>
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                isDarkMode
                                  ? "bg-blue-500/20 text-blue-300"
                                  : "bg-blue-500/10 text-blue-600"
                              }`}>접속 중</span>
                            </div>
                            
                            <div className={`text-sm space-y-1 ${
                              isDarkMode ? "text-blue-200" : "text-blue-600"
                            }`}>
                              <p><strong>IP:</strong> <span className="font-mono">{user.ipAddress}</span></p>
                              <p><strong>UUID:</strong> <span className="font-mono text-xs">{user.userUuid}</span></p>
                              <p><strong>접속시간:</strong> {
                                user.connectedAt ? 
                                  (isNaN(new Date(user.connectedAt)) ? 
                                    '알 수 없음' : 
                                    new Date(user.connectedAt).toLocaleString('ko-KR')
                                  ) : 
                                  '알 수 없음'
                              }</p>
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => {
                                setNewIPAddress(user.ipAddress);
                                setBlockReason(`${user.username} 사용자 차단`);
                              }}
                              className={`px-3 py-2 rounded-lg font-medium transition-all duration-300 hover:scale-105 ${
                                isDarkMode
                                  ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-400/30"
                                  : "bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/30"
                              }`}
                              title="이 IP를 차단 목록에 추가"
                            >
                              🚫 IP 차단
                            </button>
                            
                            <button
                              onClick={() => blockAccount(user.userUuid, user.username)}
                              className={`px-3 py-2 rounded-lg font-medium transition-all duration-300 hover:scale-105 ${
                                isDarkMode
                                  ? "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-400/30"
                                  : "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 border border-orange-500/30"
                              }`}
                              title="이 계정을 영구 차단"
                            >
                              🔒 계정 차단
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 차단된 IP 목록 */}
              <div>
                <h3 className={`text-lg font-semibold mb-4 ${
                  isDarkMode ? "text-white" : "text-gray-800"
                }`}>🚫 차단된 IP 목록 ({blockedIPs.length}개)</h3>
                
                {blockedIPs.length === 0 ? (
                  <div className={`text-center py-8 ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}>
                    차단된 IP가 없습니다.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {blockedIPs.map((ip, index) => (
                      <div
                        key={`${ip.address}-${index}`}
                        className={`p-4 rounded-lg border ${
                          isDarkMode
                            ? "bg-gray-700/50 border-gray-600"
                            : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className={`font-mono font-bold text-lg ${
                                isDarkMode ? "text-red-400" : "text-red-600"
                              }`}>🚫 {ip.address}</span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                isDarkMode
                                  ? "bg-red-500/20 text-red-400"
                                  : "bg-red-500/10 text-red-600"
                              }`}>차단됨</span>
                            </div>
                            
                            <div className={`text-sm space-y-1 ${
                              isDarkMode ? "text-gray-300" : "text-gray-700"
                            }`}>
                              <p><strong>사유:</strong> {ip.reason}</p>
                              <p><strong>차단일:</strong> {new Date(ip.blockedAt).toLocaleString('ko-KR')}</p>
                              <p><strong>차단자:</strong> {ip.blockedBy}</p>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => unblockIP(ip.address)}
                            className={`px-3 py-2 rounded-lg font-medium transition-all duration-300 hover:scale-105 ${
                              isDarkMode
                                ? "bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-400/30"
                                : "bg-green-500/10 text-green-600 hover:bg-green-500/20 border border-green-500/30"
                            }`}
                            title="차단 해제"
                          >
                            ✅ 해제
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 차단된 계정 목록 */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`text-lg font-semibold ${
                    isDarkMode ? "text-white" : "text-gray-800"
                  }`}>🔒 차단된 계정 목록 ({blockedAccounts.length}개)</h3>
                  <button
                    onClick={fetchBlockedAccounts}
                    className={`px-3 py-2 rounded-lg font-medium transition-all duration-300 hover:scale-105 ${
                      isDarkMode
                        ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-400/30"
                        : "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border border-blue-500/30"
                    }`}
                  >
                    🔄 새로고침
                  </button>
                </div>
                
                {blockedAccounts.length === 0 ? (
                  <div className={`text-center py-8 ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}>
                    차단된 계정이 없습니다.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {blockedAccounts.map((account, index) => (
                      <div
                        key={`${account.userUuid}-${index}`}
                        className={`p-4 rounded-lg border ${
                          isDarkMode
                            ? "bg-gray-700/50 border-gray-600"
                            : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className={`font-bold text-lg ${
                                isDarkMode ? "text-orange-400" : "text-orange-600"
                              }`}>🔒 {account.username}</span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                isDarkMode
                                  ? "bg-orange-500/20 text-orange-400"
                                  : "bg-orange-500/10 text-orange-600"
                              }`}>계정 차단됨</span>
                            </div>
                            
                            <div className={`text-sm space-y-1 ${
                              isDarkMode ? "text-gray-300" : "text-gray-600"
                            }`}>
                              <p><strong>UUID:</strong> <span className="font-mono text-xs">{account.userUuid}</span></p>
                              <p><strong>차단 사유:</strong> {account.reason}</p>
                              <p><strong>차단 일시:</strong> {account.blockedAt}</p>
                              <p><strong>차단자:</strong> {account.blockedBy}</p>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => unblockAccount(account.userUuid)}
                            className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 hover:scale-105 ${
                              isDarkMode
                                ? "bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-400/30"
                                : "bg-green-500/10 text-green-600 hover:bg-green-500/20 border border-green-500/30"
                            }`}
                            title="계정 차단 해제"
                          >
                            ✅ 차단 해제
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 계정 초기화 확인 모달 */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl board-shadow ${
            isDarkMode ? "glass-card" : "bg-white/90 backdrop-blur-md border border-gray-300/30"
          }`}>
            {/* 모달 헤더 */}
            <div className={`flex items-center justify-between p-4 border-b ${
              isDarkMode ? "border-white/10" : "border-gray-300/20"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 border ${
                  isDarkMode ? "border-white/10" : "border-gray-300/30"
                }`}>
                  <Trash2 className={`w-5 h-5 ${
                    isDarkMode ? "text-red-400" : "text-red-600"
                  }`} />
                </div>
                <div>
                  <h2 className={`text-lg font-semibold ${
                    isDarkMode ? "text-white" : "text-gray-800"
                  }`}>계정 초기화</h2>
                  <p className={`text-sm ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}>모든 데이터가 삭제됩니다</p>
                </div>
              </div>
              <button
                onClick={() => setShowResetConfirm(false)}
                className={`p-2 rounded-lg hover:scale-110 transition-all duration-300 ${
                  isDarkMode 
                    ? "glass-input text-gray-400 hover:text-white" 
                    : "bg-white/60 backdrop-blur-sm border border-gray-300/40 text-gray-600 hover:text-gray-800"
                }`}
              >
                ✕
              </button>
            </div>

            {/* 모달 콘텐츠 */}
            <div className="p-4 space-y-4">
              <div className={`p-4 rounded-xl border-2 border-dashed ${
                isDarkMode ? "border-red-400/30 bg-red-500/10" : "border-red-500/30 bg-red-500/5"
              }`}>
                <div className="text-center space-y-3">
                  <div className={`text-2xl ${
                    isDarkMode ? "text-red-400" : "text-red-600"
                  }`}>⚠️</div>
                  <div>
                    <h3 className={`font-bold text-lg mb-2 ${
                      isDarkMode ? "text-red-400" : "text-red-600"
                    }`}>주의!</h3>
                    <p className={`text-sm leading-relaxed ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}>
                      다음 데이터가 <strong>영구적으로 삭제</strong>됩니다:
                    </p>
                  </div>
                  <div className={`text-left space-y-1 text-sm ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}>
                    <div>• 모든 보유 물고기 ({myCatches}마리)</div>
                    <div>• 골드 ({(userMoney || 0).toLocaleString()}골드)</div>
                    <div>• 호박석 ({(userAmber || 0).toLocaleString()}개)</div>
                    <div>• 장착된 장비 ({userEquipment.fishingRod || '없음'})</div>
                    <div>• 낚시실력 (레벨 {fishingSkill})</div>
                    <div>• 모든 재료 ({materials.length}종류)</div>
                  </div>
                  <div className={`p-3 rounded-lg ${
                    isDarkMode ? "bg-green-500/10 border border-green-400/20" : "bg-green-500/5 border border-green-500/20"
                  }`}>
                    <p className={`text-sm ${
                      isDarkMode ? "text-green-300" : "text-green-700"
                    }`}>
                      <strong>초기화 후:</strong> 골드 100, 낚시실력 0으로 새로 시작
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-300 ${
                    isDarkMode 
                      ? "glass-input text-gray-400 hover:text-white" 
                      : "bg-white/60 backdrop-blur-sm border border-gray-300/40 text-gray-600 hover:text-gray-800"
                  }`}
                >
                  취소
                </button>
                <button
                  onClick={resetAccount}
                  className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all duration-300 hover:scale-105 glow-effect ${
                    isDarkMode
                      ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      : "bg-red-500/10 text-red-600 hover:bg-red-500/20"
                  }`}
                >
                  계정 초기화
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 탐사 재료 선택 모달 */}
      {showExplorationModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl board-shadow ${
            isDarkMode ? "glass-card" : "bg-white/90 backdrop-blur-md border border-gray-300/30"
          }`}>
            <div className={`border-b p-4 ${
              isDarkMode ? "border-white/10" : "border-gray-300/20"
            }`}>
              <h3 className={`text-lg font-semibold ${
                isDarkMode ? "text-white" : "text-gray-800"
              }`}>탐사 재료 선택</h3>
              <p className={`text-sm ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}>사용할 재료를 선택하세요</p>
            </div>
            
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-3">
                {materials
                  .sort((a, b) => {
                    // 재료를 희귀도 낮은 순으로 정렬 (rank 기준)
                    const fishA = allFishTypes.find(fish => fish.material === a.material);
                    const fishB = allFishTypes.find(fish => fish.material === b.material);
                    const rankA = fishA ? fishA.rank : 999;
                    const rankB = fishB ? fishB.rank : 999;
                    return rankA - rankB; // 낮은 rank가 먼저 (희귀도 낮은 순)
                  })
                  .map((material, index) => {
                  const enemyFish = getMaterialToFish(material.material);
                  return (
                    <div
                      key={index}
                      onClick={() => startExploration(material)}
                      className={`p-4 rounded-lg cursor-pointer transition-all duration-300 hover:scale-105 ${
                        isDarkMode ? "hover:bg-white/5 border border-white/10 hover:border-orange-400/30" : "hover:bg-gray-100/50 border border-gray-300/30 hover:border-orange-500/30"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Diamond className={`w-5 h-5 ${
                            isDarkMode ? "text-purple-400" : "text-purple-600"
                          }`} />
                          <div>
                            <p className={`font-medium ${
                              isDarkMode ? "text-white" : "text-gray-800"
                            }`}>{material.material}</p>
                            <p className={`text-sm ${
                              isDarkMode ? "text-gray-400" : "text-gray-600"
                            }`}>{material.count}개 보유</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-medium ${
                            isDarkMode ? "text-orange-400" : "text-orange-600"
                          }`}>vs {enemyFish}</p>
                          <p className={`text-xs ${
                            isDarkMode ? "text-gray-500" : "text-gray-600"
                          }`}>전투 시작</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className={`border-t p-4 ${
              isDarkMode ? "border-white/10" : "border-gray-300/20"
            }`}>
              <button
                onClick={() => setShowExplorationModal(false)}
                className={`w-full py-2 px-4 rounded-lg font-medium transition-all duration-300 ${
                  isDarkMode 
                    ? "bg-gray-500/20 text-gray-400 hover:bg-gray-500/30" 
                    : "bg-gray-300/30 text-gray-600 hover:bg-gray-300/50"
                }`}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 전투 모달 */}
      {showBattleModal && battleState && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-2xl rounded-2xl board-shadow ${
            isDarkMode ? "glass-card" : "bg-white/90 backdrop-blur-md border border-gray-300/30"
          }`}>
            <div className={`border-b p-4 ${
              isDarkMode ? "border-white/10" : "border-gray-300/20"
            }`}>
              <h3 className={`text-lg font-semibold ${
                isDarkMode ? "text-white" : "text-gray-800"
              }`}>전투: vs <span className={battleState && battleState.prefix ? getPrefixColor(battleState.prefix.name, isDarkMode) : ''}>{battleState && battleState.enemy}</span></h3>
              <div className="flex items-center gap-2">
                <p className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}>재료: {battleState && battleState.material}</p>
                {battleState && battleState.materialConsumed ? (
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    isDarkMode ? "bg-green-500/20 text-green-400" : "bg-green-500/10 text-green-600"
                  }`}>소모됨</span>
                ) : (
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    isDarkMode ? "bg-orange-500/20 text-orange-400" : "bg-orange-500/10 text-orange-600"
                  }`}>소모 중...</span>
                )}
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* HP 바 */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className={`text-sm font-medium ${
                      isDarkMode ? "text-blue-400" : "text-blue-600"
                    }`}>플레이어</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${
                        isDarkMode ? "text-white" : "text-gray-800"
                      }`}>{battleState ? battleState.playerHp : 0}/{battleState ? battleState.playerMaxHp : 0}</span>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        battleState && (battleState.playerHp / battleState.playerMaxHp) >= 0.8 
                          ? isDarkMode ? "bg-green-500/20 text-green-400" : "bg-green-500/10 text-green-600"
                          : battleState && (battleState.playerHp / battleState.playerMaxHp) >= 0.5 
                          ? isDarkMode ? "bg-yellow-500/20 text-yellow-400" : "bg-yellow-500/10 text-yellow-600"
                          : isDarkMode ? "bg-red-500/20 text-red-400" : "bg-red-500/10 text-red-600"
                      }`}>{battleState ? Math.round((battleState.playerHp / battleState.playerMaxHp) * 100) : 0}%</span>
                    </div>
                  </div>
                  <div className={`w-full h-4 rounded-full ${
                    isDarkMode ? "bg-gray-700" : "bg-gray-200"
                  }`}>
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500"
                      style={{ width: `${battleState ? (battleState.playerHp / battleState.playerMaxHp) * 100 : 0}%` }}
                    ></div>
                  </div>
                  
                  {/* 동료 정보 */}
                  {battleState && battleState.companions && battleState.companions.length > 0 && (
                    <div className="mt-3">
                      <div className={`text-xs mb-2 ${
                        isDarkMode ? "text-gray-400" : "text-gray-600"
                      }`}>함께 싸우는 동료:</div>
                      <div className="space-y-2">
                        {battleState.companions.map((companion, index) => {
                          const companionHp = battleState.companionHp?.[companion];
                          const companionMorale = battleState.companionMorale?.[companion];
                          const hpPercentage = companionHp ? (companionHp.hp / companionHp.maxHp) * 100 : 100;
                          const moralePercentage = companionMorale ? (companionMorale.morale / companionMorale.maxMorale) * 100 : 50;
                          const isDown = companionHp?.hp <= 0;
                          const canUseSkill = companionMorale?.morale >= 100;
                          
                          return (
                            <div key={index} className="flex items-center gap-2">
                              <span className={`text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 ${
                                isDown 
                                  ? isDarkMode ? "bg-red-500/20 text-red-400 border border-red-400/30" : "bg-red-500/10 text-red-600 border border-red-500/30"
                                  : canUseSkill
                                  ? isDarkMode ? "bg-purple-500/20 text-purple-400 border border-purple-400/30" : "bg-purple-500/10 text-purple-600 border border-purple-500/30"
                                  : isDarkMode ? "bg-green-500/20 text-green-400 border border-green-400/30" : "bg-green-500/10 text-green-600 border border-green-500/30"
                              }`}>
                                {isDown ? "💀" : canUseSkill ? "✨" : "⚔️"} {companion} Lv.{companionHp?.level || 1}
                              </span>
                              <div className="flex-1 flex flex-col gap-1">
                                {/* 체력바 */}
                                <div className="flex items-center gap-1">
                                  <div className={`flex-1 h-2 rounded-full ${
                                    isDarkMode ? "bg-gray-700" : "bg-gray-200"
                                  }`}>
                                    <div 
                                      className={`h-full rounded-full transition-all duration-500 ${
                                        isDown ? "bg-red-500" : hpPercentage >= 70 ? "bg-green-500" : hpPercentage >= 30 ? "bg-yellow-500" : "bg-red-500"
                                      }`}
                                      style={{ width: `${Math.max(0, hpPercentage)}%` }}
                                    ></div>
                                  </div>
                                  <span className={`text-xs font-medium ${
                                    isDarkMode ? "text-gray-300" : "text-gray-700"
                                  }`}>
                                    {companionHp?.hp || 0}/{companionHp?.maxHp || 100}
                                  </span>
                                </div>
                                {/* 사기바 */}
                                <div className="flex items-center gap-1">
                                  <div className={`flex-1 h-1 rounded-full ${
                                    isDarkMode ? "bg-gray-700" : "bg-gray-200"
                                  }`}>
                                    <div 
                                      className={`h-full rounded-full transition-all duration-500 ${
                                        canUseSkill ? "bg-yellow-400" : "bg-yellow-600"
                                      }`}
                                      style={{ width: `${Math.max(0, moralePercentage)}%` }}
                                    ></div>
                                  </div>
                                  <span className={`text-xs font-medium ${
                                    isDarkMode ? "text-yellow-400" : "text-yellow-600"
                                  }`}>
                                    {companionMorale?.morale || 50}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className={`text-sm font-medium ${
                      battleState && battleState.prefix ? getPrefixColor(battleState.prefix.name, isDarkMode) : (isDarkMode ? "text-red-400" : "text-red-600")
                    }`}>{battleState ? battleState.enemy : ''}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${
                        isDarkMode ? "text-white" : "text-gray-800"
                      }`}>{battleState ? battleState.enemyHp : 0}/{battleState ? battleState.enemyMaxHp : 0}</span>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        battleState && (battleState.enemyHp / battleState.enemyMaxHp) >= 0.8 
                          ? isDarkMode ? "bg-green-500/20 text-green-400" : "bg-green-500/10 text-green-600"
                          : battleState && (battleState.enemyHp / battleState.enemyMaxHp) >= 0.5 
                          ? isDarkMode ? "bg-yellow-500/20 text-yellow-400" : "bg-yellow-500/10 text-yellow-600"
                          : isDarkMode ? "bg-red-500/20 text-red-400" : "bg-red-500/10 text-red-600"
                      }`}>{battleState ? Math.round((battleState.enemyHp / battleState.enemyMaxHp) * 100) : 0}%</span>
                    </div>
                  </div>
                  <div className={`w-full h-4 rounded-full ${
                    isDarkMode ? "bg-gray-700" : "bg-gray-200"
                  }`}>
                    <div 
                      className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full transition-all duration-500"
                      style={{ width: `${battleState ? Math.max(0, (battleState.enemyHp / battleState.enemyMaxHp) * 100) : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* 전투 로그 */}
              <div 
                ref={battleLogRef}
                className={`p-4 rounded-lg max-h-[200px] overflow-y-auto ${
                isDarkMode ? "bg-gray-800/50 border border-gray-700/30" : "bg-gray-100/80 border border-gray-300/30"
                }`}
              >
                <div className="space-y-1">
                  {battleState && battleState.log ? battleState.log.map((message, index) => (
                    <p key={index} className={`text-sm ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}>
                      {message}
                    </p>
                  )) : null}
                </div>
              </div>

              {/* 자동 모드 상태 표시 */}
              {battleState && battleState.autoMode && battleState.turn !== 'victory' && battleState.turn !== 'defeat' && battleState.turn !== 'fled' && (
                <div className={`text-center mb-4 ${
                  isDarkMode ? "text-yellow-400" : "text-yellow-600"
                }`}>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>
                    <span className="text-sm font-medium">자동 전투 진행 중...</span>
                  </div>
                </div>
              )}

              {/* 액션 버튼 */}
              <div className="flex gap-4">
                {battleState && battleState.turn === 'player' && !battleState.autoMode && (
                  <div className="flex gap-3 w-full">
                  <button
                    onClick={playerAttack}
                    className={`flex-1 py-3 px-6 rounded-lg font-bold text-lg transition-all duration-300 hover:scale-105 ${
                      isDarkMode
                        ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 glow-effect"
                        : "bg-red-500/10 text-red-600 hover:bg-red-500/20"
                    }`}
                  >
                    공격하기
                    </button>
                    {battleState && battleState.canFlee && (
                      <button
                        onClick={fleeFromBattle}
                        className={`flex-1 py-3 px-6 rounded-lg font-bold text-lg transition-all duration-300 hover:scale-105 ${
                          isDarkMode
                            ? "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
                            : "bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20"
                        }`}
                      >
                        도망가기
                  </button>
                    )}
                  </div>
                )}

                {battleState && battleState.turn === 'player' && battleState.autoMode && (
                  <div className="flex gap-2 w-full">
                    <div className={`flex-1 py-3 px-6 rounded-lg text-center font-medium flex items-center justify-center gap-2 ${
                      isDarkMode ? "bg-yellow-500/20 text-yellow-400" : "bg-yellow-500/10 text-yellow-600"
                    }`}>
                      <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>
                      <span>자동 공격 중...</span>
                    </div>
                    <button
                      onClick={() => {
                        setBattleState(prev => prev ? { ...prev, autoMode: false } : null);
                      }}
                      className={`px-4 py-3 rounded-lg font-medium transition-all duration-300 hover:scale-105 ${
                        isDarkMode
                          ? "bg-gray-500/20 text-gray-400 hover:bg-gray-500/30"
                          : "bg-gray-300/30 text-gray-600 hover:bg-gray-300/50"
                      }`}
                    >
                      수동
                    </button>
                  </div>
                )}
                
                {battleState && battleState.turn === 'enemy' && (
                  <div className="flex gap-2 w-full">
                  <div className={`flex-1 py-3 px-6 rounded-lg text-center font-medium ${
                    isDarkMode ? "bg-gray-500/20 text-gray-400" : "bg-gray-300/30 text-gray-600"
                  }`}>
                    적의 턴...
                    </div>
                    {battleState && battleState.autoMode && (
                      <button
                        onClick={() => {
                          setBattleState(prev => prev ? { ...prev, autoMode: false } : null);
                        }}
                        className={`px-4 py-3 rounded-lg font-medium transition-all duration-300 hover:scale-105 ${
                          isDarkMode
                            ? "bg-gray-500/20 text-gray-400 hover:bg-gray-500/30"
                            : "bg-gray-300/30 text-gray-600 hover:bg-gray-300/50"
                        }`}
                      >
                        수동
                      </button>
                    )}
                  </div>
                )}
                
                {battleState && (battleState.turn === 'victory' || battleState.turn === 'defeat' || battleState.turn === 'fled') && (
                  <div className="flex gap-3">
                    {/* 채팅 공유 버튼 */}
                    <button
                      onClick={shareBattleLog}
                      className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-semibold transition-all duration-300 hover:scale-105 ${
                        isDarkMode
                          ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30"
                          : "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border border-blue-500/30"
                      }`}
                      title="전투 결과를 채팅에 공유"
                    >
                      <MessageCircle className="w-5 h-5" />
                      <span className="hidden sm:inline">공유</span>
                    </button>
                    
                    {/* 닫기 버튼 */}
                  <button
                    onClick={() => {
                      setShowBattleModal(false);
                      setBattleState(null);
                    }}
                    className={`flex-1 py-3 px-6 rounded-lg font-bold text-lg transition-all duration-300 hover:scale-105 ${
                      battleState.turn === 'victory'
                        ? isDarkMode
                          ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                          : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                        : battleState.turn === 'fled'
                          ? isDarkMode
                            ? "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
                            : "bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20"
                        : isDarkMode
                          ? "bg-gray-500/20 text-gray-400 hover:bg-gray-500/30"
                          : "bg-gray-300/30 text-gray-600 hover:bg-gray-300/50"
                    }`}
                  >
                      {battleState && battleState.turn === 'victory' ? '승리!' : battleState && battleState.turn === 'fled' ? '도망 성공!' : '패배...'}
                  </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 이용약관 및 닉네임 설정 모달 */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-2xl board-shadow ${
            isDarkMode ? "glass-card" : "bg-white/95 backdrop-blur-md border border-gray-300/30"
          }`}>
            {/* 모달 헤더 */}
            <div className={`p-6 border-b ${
              isDarkMode ? "border-white/10" : "border-gray-300/20"
            }`}>
              <div className="text-center">
                <div className={`flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 mx-auto mb-4 border ${
                  isDarkMode ? "border-white/10" : "border-blue-300/30"
                }`}>
                  <Fish className={`w-8 h-8 ${
                    isDarkMode ? "text-blue-400" : "text-blue-600"
                  }`} />
                </div>
                <h2 className={`text-2xl font-bold ${
                  isDarkMode ? "text-white" : "text-gray-800"
                }`}>여우이야기에 오신 것을 환영합니다!</h2>
                <p className={`text-sm mt-2 ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}>서비스 이용을 위해 약관 동의와 닉네임 설정이 필요합니다</p>
              </div>
            </div>
            
            {/* 모달 콘텐츠 */}
            <div className="p-6 space-y-6">
              {/* 이용약관 */}
              <div className={`p-4 rounded-xl max-h-48 overflow-y-auto ${
                isDarkMode ? "glass-input" : "bg-gray-50/80 border border-gray-300/30"
              }`}>
                <h3 className={`font-semibold mb-3 ${
                  isDarkMode ? "text-white" : "text-gray-800"
                }`}>이용약관</h3>
                <div className={`text-sm space-y-2 ${
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                }`}>
                  <p>1. 본 서비스는 실시간 채팅 낚시 게임 서비스입니다.</p>
                  <p>2. 사용자는 건전한 게임 문화 조성에 협조해야 합니다.</p>
                  <p>3. 부적절한 닉네임이나 채팅은 제재 대상입니다.</p>
                  <p>4. 게임 내 데이터는 서버에 안전하게 저장됩니다.</p>
                  <p>5. 서비스 개선을 위한 업데이트가 있을 수 있습니다.</p>
                  <p>6. 문의사항은 카카오톡 채널방을 통해 연락 바랍니다.</p>
                </div>
              </div>
              
              {/* 약관 동의 체크박스 */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="termsCheckbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="w-5 h-5 rounded border-2 border-blue-500 text-blue-500 focus:ring-blue-500"
                />
                <label htmlFor="termsCheckbox" className={`text-sm cursor-pointer ${
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                }`}>
                  위 이용약관에 동의합니다 (필수)
                </label>
              </div>
              
              {/* 닉네임 입력 */}
              {termsAccepted && (
                <div className="space-y-3">
                  <label className={`block text-sm font-medium ${
                    isDarkMode ? "text-gray-300" : "text-gray-700"
                  }`}>
                    사용할 닉네임을 입력해주세요
                  </label>
                  <input
                    type="text"
                    value={initialNickname}
                    onChange={(e) => setInitialNickname(e.target.value)}
                    placeholder="2-12글자, 한글/영문/숫자만 가능"
                    className={`w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      isDarkMode 
                        ? "bg-gray-800 border-gray-600 text-white placeholder-gray-400" 
                        : "bg-white border-gray-300 text-gray-800 placeholder-gray-500"
                    }`}
                    maxLength={12}
                    autoFocus
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') setInitialNicknameFunc();
                    }}
                  />
                  <p className={`text-xs ${
                    isDarkMode ? "text-gray-500" : "text-gray-600"
                  }`}>
                    ⚠️ 닉네임은 한 번 설정하면 변경할 수 없습니다!
                  </p>
                </div>
              )}
            </div>
            
            {/* 모달 하단 버튼 */}
            <div className={`p-6 border-t ${
              isDarkMode ? "border-white/10" : "border-gray-300/20"
            }`}>
              <button
                onClick={setInitialNicknameFunc}
                disabled={!termsAccepted || !initialNickname.trim()}
                className={`w-full py-3 px-6 rounded-lg font-medium transition-all duration-300 ${
                  (!termsAccepted || !initialNickname.trim())
                    ? "opacity-50 cursor-not-allowed bg-gray-500/20 text-gray-500"
                    : isDarkMode
                      ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-400/30 hover:scale-105"
                      : "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border border-blue-500/30 hover:scale-105"
                }`}
              >
                게임 시작하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 공지사항 모달 */}
      <NoticeModal 
        showNoticeModal={showNoticeModal}
        setShowNoticeModal={setShowNoticeModal}
        isDarkMode={isDarkMode}
      />

      {/* 튜토리얼 모달 */}
      <TutorialModal 
        showTutorialModal={showTutorialModal}
        setShowTutorialModal={setShowTutorialModal}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}

export default App;