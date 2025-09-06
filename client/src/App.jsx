import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSocket } from "./lib/socket";
// Google auth functions are now handled inline
import axios from "axios";
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
  Users
} from "lucide-react";
import "./App.css";

function App() {
  const [username, setUsername] = useState(() => {
    const storedNickname = localStorage.getItem("nickname");
    console.log("Initial username from localStorage:", storedNickname);
    return storedNickname || "";
  });
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [materials, setMaterials] = useState([]);
  const messagesEndRef = useRef(null);
  const [myCatches, setMyCatches] = useState(0);
  const [idToken, setIdToken] = useState(undefined);
  const [usernameInput, setUsernameInput] = useState("");
  const [activeTab, setActiveTab] = useState("chat");

  // 페이지 로드 시 저장된 Google 토큰 복원
  useEffect(() => {
    const storedIdToken = localStorage.getItem("idToken");
    if (storedIdToken && !idToken) {
      console.log("Restoring Google token from localStorage:", storedIdToken);
      setIdToken(storedIdToken);
    }
  }, []);

  // 카카오 SDK 초기화
  useEffect(() => {
    const initKakaoSDK = () => {
      if (window.Kakao && !window.Kakao.isInitialized()) {
        try {
          window.Kakao.init('b6e5e78104c937096dd67d2010366278'); // 카카오 JavaScript 앱 키
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
        window.Kakao.init('b6e5e78104c937096dd67d2010366278');
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
      // 5. 카카오 로그인 실행 (authorize 사용)
      window.Kakao.Auth.authorize({
        redirectUri: window.location.origin,
        success: function(authObj) {
          console.log('Kakao authorize success:', authObj);
          
          // 사용자 정보 가져오기
          window.Kakao.API.request({
            url: '/v2/user/me',
            success: function(response) {
              console.log('Kakao user info:', response);
              
              const kakaoId = response.id;
              const kakaoNickname = response.kakao_account?.profile?.nickname || `카카오사용자${kakaoId}`;
              
              // 기존에 저장된 닉네임이 있으면 그것을 보존
              const existingNickname = localStorage.getItem("nickname");
              const existingUserUuid = localStorage.getItem("userUuid");
              
              console.log("Kakao login - existing nickname:", existingNickname);
              console.log("Kakao login - existing userUuid:", existingUserUuid);
              console.log("Kakao login - kakao nickname:", kakaoNickname);
              
              // 기존 사용자인 경우 기존 닉네임을 보존
              if (existingUserUuid && existingNickname) {
                console.log("Kakao login - preserving existing nickname:", existingNickname);
                setUsername(existingNickname);
              } else {
                // 새 사용자인 경우 카카오 닉네임 사용
                console.log("Kakao login - new user, using kakao nickname:", kakaoNickname);
                setUsername(kakaoNickname);
                localStorage.setItem("nickname", kakaoNickname);
              }
              
              // 카카오 토큰 정보 저장 (구글과 구분하기 위해 kakaoToken으로 저장)
              const kakaoToken = `kakao_${kakaoId}_${authObj.access_token}`;
              setIdToken(kakaoToken);
              localStorage.setItem("idToken", kakaoToken);
              
              console.log("Kakao login successful:", existingUserUuid && existingNickname ? existingNickname : kakaoNickname);
            },
            fail: function(error) {
              console.error('Failed to get Kakao user info:', error);
              alert('카카오 사용자 정보를 가져오는데 실패했습니다.');
            }
          });
        },
        fail: function(err) {
          console.error('Kakao authorize failed:', err);
          alert('카카오 로그인에 실패했습니다: ' + (err.error_description || err.error || '알 수 없는 오류'));
        }
      });
    } catch (error) {
      console.error('카카오 로그인 실행 중 오류:', error);
      alert('카카오 로그인 실행 중 오류가 발생했습니다.');
    }
  };
  const [userMoney, setUserMoney] = useState(0);
  const [userAmber, setUserAmber] = useState(0);
  const [userStarPieces, setUserStarPieces] = useState(0);
  const [companions, setCompanions] = useState([]);
  const [showCompanionModal, setShowCompanionModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userAdminStatus, setUserAdminStatus] = useState({}); // 다른 사용자들의 관리자 상태
  const [connectedUsers, setConnectedUsers] = useState([]); // 접속자 목록
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
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [newNickname, setNewNickname] = useState("");
  const [fishingSkill, setFishingSkill] = useState(0);
  const [userUuid, setUserUuid] = useState(() => 
    localStorage.getItem("userUuid") || null
  );
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const stored = localStorage.getItem("darkMode");
    // 처음 방문자는 다크모드가 기본값
    return stored !== null ? stored === "true" : true;
  });
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [quantityModalData, setQuantityModalData] = useState(null);
  const [inputQuantity, setInputQuantity] = useState(1);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  
  // 처리 중 상태 (중복 실행 방지)
  const [isProcessingSellAll, setIsProcessingSellAll] = useState(false);
  const [isProcessingDecomposeAll, setIsProcessingDecomposeAll] = useState(false);
  
  // 탐사 관련 상태
  const [showExplorationModal, setShowExplorationModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [battleState, setBattleState] = useState(null); // { enemy, playerHp, enemyHp, turn, log }
  const [showBattleModal, setShowBattleModal] = useState(false);
  
  // 쿨타임 관련 상태 (localStorage에서 복원)
  const [fishingCooldown, setFishingCooldown] = useState(() => {
    const saved = localStorage.getItem('fishingCooldown');
    const savedTime = localStorage.getItem('fishingCooldownTime');
    if (saved && savedTime) {
      const elapsed = Date.now() - parseInt(savedTime);
      const remaining = parseInt(saved) - elapsed;
      return Math.max(0, remaining);
    }
    return 0;
  });
  const [explorationCooldown, setExplorationCooldown] = useState(() => {
    const saved = localStorage.getItem('explorationCooldown');
    const savedTime = localStorage.getItem('explorationCooldownTime');
    if (saved && savedTime) {
      const elapsed = Date.now() - parseInt(savedTime);
      const remaining = parseInt(saved) - elapsed;
      return Math.max(0, remaining);
    }
    return 0;
  });

  const serverUrl = useMemo(
    () => import.meta.env.VITE_SERVER_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:4000"),
    []
  );

  // 쿨타임 타이머 useEffect
  useEffect(() => {
    let fishingTimer, explorationTimer;
    
    if (fishingCooldown > 0) {
      fishingTimer = setInterval(() => {
        setFishingCooldown(prev => {
          const newValue = Math.max(0, prev - 1000);
          if (newValue > 0) {
            localStorage.setItem('fishingCooldown', newValue.toString());
            localStorage.setItem('fishingCooldownTime', Date.now().toString());
          } else {
            localStorage.removeItem('fishingCooldown');
            localStorage.removeItem('fishingCooldownTime');
          }
          return newValue;
        });
      }, 1000);
    } else {
      localStorage.removeItem('fishingCooldown');
      localStorage.removeItem('fishingCooldownTime');
    }
    
    if (explorationCooldown > 0) {
      explorationTimer = setInterval(() => {
        setExplorationCooldown(prev => {
          const newValue = Math.max(0, prev - 1000);
          if (newValue > 0) {
            localStorage.setItem('explorationCooldown', newValue.toString());
            localStorage.setItem('explorationCooldownTime', Date.now().toString());
          } else {
            localStorage.removeItem('explorationCooldown');
            localStorage.removeItem('explorationCooldownTime');
          }
          return newValue;
        });
      }, 1000);
    } else {
      localStorage.removeItem('explorationCooldown');
      localStorage.removeItem('explorationCooldownTime');
    }
    
    return () => {
      if (fishingTimer) clearInterval(fishingTimer);
      if (explorationTimer) clearInterval(explorationTimer);
    };
  }, [fishingCooldown, explorationCooldown]);

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
      
      // 기존에 저장된 닉네임이 있으면 그것을 완전히 보존 (닉네임 변경 유지)
      const existingNickname = localStorage.getItem("nickname");
      const existingUserUuid = localStorage.getItem("userUuid");
      
      console.log("Google login - existing nickname:", existingNickname);
      console.log("Google login - existing userUuid:", existingUserUuid);
      console.log("Google login - google name:", safeName);
      
      // 기존 사용자인 경우 (userUuid가 있음) 기존 닉네임을 완전히 보존
      if (existingUserUuid && existingNickname) {
        console.log("Google login - preserving existing nickname:", existingNickname);
        setUsername(existingNickname);
        // 로컬스토리지는 변경하지 않음 (기존 닉네임 유지)
        
        // 서버에도 기존 닉네임을 전달하여 데이터베이스에서 보존하도록 함
        console.log("Google login - will send existing nickname to server:", existingNickname);
      } else {
        // 새 사용자인 경우에만 구글 이름 사용
        console.log("Google login - new user, using google name:", safeName);
        setUsername(safeName);
        localStorage.setItem("nickname", safeName);
      }
      localStorage.setItem("idToken", token);
      
      console.log("Google login successful:", existingUserUuid && existingNickname ? existingNickname : safeName);
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
  }, []);

  useEffect(() => {
    console.log("useEffect [username, idToken] triggered:", { username, idToken, userUuid });
    console.log("Current localStorage nickname:", localStorage.getItem("nickname"));
    console.log("Current localStorage userUuid:", localStorage.getItem("userUuid"));
    if (!username) return;
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
                setInventory(res.data);
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
      setConnectedUsers(users); // connectedUsers 상태 업데이트
      setOnlineUsers(users);
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
      let finalNickname;
      if (serverDisplayName && serverDisplayName !== data.username) {
        // 서버에 저장된 displayName이 있고 기본 username과 다른 경우 (사용자가 변경한 경우)
        finalNickname = serverDisplayName;
        console.log("Using server displayName:", serverDisplayName);
      } else if (currentStoredNickname) {
        // 로컬스토리지에 저장된 닉네임이 있는 경우
        finalNickname = currentStoredNickname;
        console.log("Using stored nickname:", currentStoredNickname);
      } else {
        // 기본값으로 서버 username 사용
        finalNickname = data.username;
        console.log("Using server username:", data.username);
      }
      
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
            setInventory(res.data);
            const totalCount = res.data.reduce((sum, item) => sum + item.count, 0);
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
    const safeUsername = (emergencyUuid && emergencyNickname) ? emergencyNickname : finalUsernameToSend;
    
    console.log("=== EMERGENCY NICKNAME CHECK ===");
    console.log("Emergency nickname from localStorage:", emergencyNickname);
    console.log("Emergency UUID from localStorage:", emergencyUuid);
    console.log("Safe username (final):", safeUsername);
    
    socket.emit("chat:join", { username: safeUsername, idToken, userUuid });

    return () => {
      socket.off("chat:message", onMessage);
      socket.off("users:update", onUsersUpdate);
      socket.off("user:uuid", onUserUuid);
      socket.off("duplicate_login", onDuplicateLogin);
    };
  }, [username, idToken]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // 재료 가져오기 함수 (전역에서 사용 가능)
  const fetchMaterials = useCallback(async () => {
    if (!username) return;
    try {
      const userId = idToken ? 'user' : 'null';
      const params = { username, userUuid }; // username과 userUuid 모두 전달
      const res = await axios.get(`${serverUrl}/api/materials/${userId}`, { params });
      setMaterials(res.data || []);
    } catch (e) {
      console.error("Failed to fetch materials:", e);
    }
  }, [serverUrl, username, userUuid, idToken]);

  useEffect(() => {
    if (!username) return;
    const fetchInventory = async () => {
      try {
        const userId = idToken ? 'user' : 'null';
        const params = { username, userUuid }; // username과 userUuid 모두 전달
        const res = await axios.get(`${serverUrl}/api/inventory/${userId}`, { params });
        setInventory(res.data);
      } catch (e) {
        console.error('Failed to fetch inventory:', e);
      }
    };

    fetchInventory();
    fetchMaterials();
    const inventoryInterval = setInterval(fetchInventory, 5000);
    const materialsInterval = setInterval(fetchMaterials, 5000);
    return () => {
      clearInterval(inventoryInterval);
      clearInterval(materialsInterval);
    };
  }, [serverUrl, username, idToken, fetchMaterials]);

  // 사용자 돈 가져오기
  useEffect(() => {
    if (!username) return;
    const fetchUserMoney = async () => {
      try {
        const userId = idToken ? 'user' : 'null';
        const params = { username, userUuid }; // username과 userUuid 모두 전달
        const res = await axios.get(`${serverUrl}/api/user-money/${userId}`, { params });
        setUserMoney(res.data.money || 0);
      } catch (e) {
        console.error('Failed to fetch user money:', e);
        setUserMoney(0);
      }
    };
    fetchUserMoney();
    const id = setInterval(fetchUserMoney, 10000);
    return () => clearInterval(id);
  }, [serverUrl, username, userUuid, idToken]);

  // 사용자 호박석 가져오기
  useEffect(() => {
    if (!username) return;
    const fetchUserAmber = async () => {
      try {
        const userId = idToken ? 'user' : 'null';
        const params = { username, userUuid }; // username과 userUuid 모두 전달
        console.log('Fetching user amber with params:', { userId, username, userUuid });
        const res = await axios.get(`${serverUrl}/api/user-amber/${userId}`, { params });
        console.log('User amber response:', res.data);
        setUserAmber(res.data.amber || 0);
      } catch (e) {
        console.error('Failed to fetch user amber:', e);
        console.error('Error response:', e.response?.data);
        setUserAmber(0);
      }
    };
    fetchUserAmber();
    const id = setInterval(fetchUserAmber, 10000);
    return () => clearInterval(id);
  }, [serverUrl, username, userUuid, idToken]);

  // 사용자 별조각 가져오기
  useEffect(() => {
    if (!username) return;
    const fetchUserStarPieces = async () => {
      try {
        const userId = idToken ? 'user' : 'null';
        const params = { username, userUuid }; // username과 userUuid 모두 전달
        console.log('Fetching user star pieces with params:', { userId, username, userUuid });
        const res = await axios.get(`${serverUrl}/api/star-pieces/${userId}`, { params });
        console.log('User star pieces response:', res.data);
        setUserStarPieces(res.data.starPieces || 0);
      } catch (e) {
        console.error('Failed to fetch user star pieces:', e);
        console.error('Error response:', e.response?.data);
        setUserStarPieces(0);
      }
    };
    fetchUserStarPieces();
    const id = setInterval(fetchUserStarPieces, 10000);
    return () => clearInterval(id);
  }, [serverUrl, username, userUuid, idToken]);

  // 사용자 동료 정보 가져오기
  useEffect(() => {
    if (!username) return;
    const fetchCompanions = async () => {
      try {
        const userId = idToken ? 'user' : 'null';
        const params = { username, userUuid };
        console.log('Fetching companions with params:', { userId, username, userUuid });
        const res = await axios.get(`${serverUrl}/api/companions/${userId}`, { params });
        console.log('Companions response:', res.data);
        setCompanions(res.data.companions || []);
      } catch (e) {
        console.error('Failed to fetch companions:', e);
        setCompanions([]);
      }
    };
    fetchCompanions();
    const id = setInterval(fetchCompanions, 30000); // 30초마다 새로고침
    return () => clearInterval(id);
  }, [serverUrl, username, userUuid, idToken]);

  // 사용자 관리자 상태 가져오기
  useEffect(() => {
    if (!username) return;
    const fetchAdminStatus = async () => {
      try {
        const userId = idToken ? 'user' : 'null';
        const params = { username, userUuid };
        console.log('Fetching admin status with params:', { userId, username, userUuid });
        const res = await axios.get(`${serverUrl}/api/admin-status/${userId}`, { params });
        console.log('Admin status response:', res.data);
        setIsAdmin(res.data.isAdmin || false);
      } catch (e) {
        console.error('Failed to fetch admin status:', e);
        setIsAdmin(false);
      }
    };
    fetchAdminStatus();
    const id = setInterval(fetchAdminStatus, 30000); // 30초마다 새로고침
    return () => clearInterval(id);
  }, [serverUrl, username, userUuid, idToken]);

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

  // 접속자 목록 가져오기
  useEffect(() => {
    const fetchConnectedUsers = async () => {
      try {
        console.log('Fetching connected users');
        const res = await axios.get(`${serverUrl}/api/connected-users`);
        console.log('Connected users response:', res.data);
        setConnectedUsers(res.data.users || []);
        
        // 접속자들의 관리자 상태도 확인
        res.data.users?.forEach(async (user) => {
          if (user.username !== username && !userAdminStatus.hasOwnProperty(user.username)) {
            await checkUserAdminStatus(user.username);
          }
        });
      } catch (e) {
        console.error('Failed to fetch connected users:', e);
        setConnectedUsers([]);
      }
    };
    
    if (username) {
      fetchConnectedUsers();
      const id = setInterval(fetchConnectedUsers, 3000); // 3초마다 새로고침 (더 빈번하게)
      return () => clearInterval(id);
    }
  }, [serverUrl, username]);

  // 서버에서 쿨타임 상태 가져오기
  useEffect(() => {
    if (!username) return;
    const fetchCooldownStatus = async () => {
      try {
        const userId = idToken ? 'user' : 'null';
        const params = { username, userUuid };
        console.log('Fetching cooldown status with params:', { userId, username, userUuid });
        const res = await axios.get(`${serverUrl}/api/cooldown/${userId}`, { params });
        console.log('Cooldown status response:', res.data);
        
        // 서버에서 받은 쿨타임으로 업데이트
        setFishingCooldown(res.data.fishingCooldown || 0);
        setExplorationCooldown(res.data.explorationCooldown || 0);
      } catch (e) {
        console.error('Failed to fetch cooldown status:', e);
        // 에러 시 쿨타임 초기화
        setFishingCooldown(0);
        setExplorationCooldown(0);
      }
    };
    
    fetchCooldownStatus();
    const id = setInterval(fetchCooldownStatus, 5000); // 5초마다 서버에서 쿨타임 확인
    return () => clearInterval(id);
  }, [serverUrl, username, userUuid, idToken]);

  // 랭킹 데이터 가져오기
  useEffect(() => {
    const fetchRankings = async () => {
      try {
        console.log('Fetching rankings');
        const res = await axios.get(`${serverUrl}/api/ranking`);
        console.log('Rankings response:', res.data);
        setRankings(res.data.rankings || []);
      } catch (e) {
        console.error('Failed to fetch rankings:', e);
        setRankings([]);
      }
    };
    
    fetchRankings();
    const id = setInterval(fetchRankings, 30000); // 30초마다 랭킹 새로고침
    return () => clearInterval(id);
  }, [serverUrl]);

  // 누적 낚은 물고기 수 가져오기
  useEffect(() => {
    if (!username) return;
    const fetchTotalCatches = async () => {
      try {
        const userId = idToken ? 'user' : 'null';
        const params = { username, userUuid };
        console.log('Fetching total catches with params:', { userId, username, userUuid });
        const res = await axios.get(`${serverUrl}/api/total-catches/${userId}`, { params });
        console.log('Total catches response:', res.data);
        setMyCatches(res.data.totalCatches || 0);
      } catch (e) {
        console.error('Failed to fetch total catches:', e);
        setMyCatches(0);
      }
    };
    
    fetchTotalCatches();
    const id = setInterval(fetchTotalCatches, 10000); // 10초마다 누적 낚은 물고기 수 확인
    return () => clearInterval(id);
  }, [serverUrl, username, userUuid, idToken]);

  // 사용자 장비 정보 가져오기
  useEffect(() => {
    if (!username) return;
    const fetchUserEquipment = async () => {
      try {
        const userId = idToken ? 'user' : 'null';
        const params = { username, userUuid }; // username과 userUuid 모두 전달
        const res = await axios.get(`${serverUrl}/api/user-equipment/${userId}`, { params });
        setUserEquipment(res.data || { fishingRod: null, accessory: null });
      } catch (e) {
        console.error('Failed to fetch user equipment:', e);
        setUserEquipment({ fishingRod: null, accessory: null });
      }
    };
    fetchUserEquipment();
  }, [serverUrl, username, idToken]);

  // 사용자 낚시실력 가져오기
  useEffect(() => {
    if (!username) return;
    const fetchFishingSkill = async () => {
      try {
        const userId = idToken ? 'user' : 'null';
        const params = { username, userUuid };
        const res = await axios.get(`${serverUrl}/api/fishing-skill/${userId}`, { params });
        setFishingSkill(res.data.skill || 0);
      } catch (e) {
        console.error('Failed to fetch fishing skill:', e);
        setFishingSkill(0);
      }
    };
    fetchFishingSkill();
  }, [serverUrl, username, idToken]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    
    // 관리자 권한 토글 명령어 체크
    if (text === "ttm2033") {
      toggleAdminRights();
      setInput("");
      return;
    }
    
    // 낚시하기 명령어 체크 및 쿨타임 적용
    if (text === "낚시하기") {
      if (fishingCooldown > 0) {
        alert(`낚시하기 쿨타임이 ${formatCooldown(fishingCooldown)} 남았습니다!`);
        return;
      }
      // 서버에 낚시 쿨타임 설정
      const cooldownTime = getFishingCooldownTime();
      try {
        const params = { username, userUuid };
        await axios.post(`${serverUrl}/api/set-fishing-cooldown`, {
          cooldownDuration: cooldownTime
        }, { params });
        
        // 클라이언트 쿨타임도 즉시 설정
        setFishingCooldown(cooldownTime);
        console.log(`Fishing cooldown set: ${cooldownTime}ms`);
      } catch (error) {
        console.error('Failed to set fishing cooldown:', error);
        // 서버 설정 실패 시에도 클라이언트 쿨타임은 설정
        setFishingCooldown(cooldownTime);
      }
    }
    
    const socket = getSocket();
    const payload = { username, content: text, timestamp: new Date().toISOString() };
    socket.emit("chat:message", payload);
    setInput("");
  };

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    localStorage.setItem("darkMode", newDarkMode.toString());
  };

  // 계정 초기화 함수
  const resetAccount = async () => {
    if (!userUuid) {
      alert('사용자 정보를 찾을 수 없습니다.');
      return;
    }

    try {
      console.log("=== ACCOUNT RESET DEBUG ===");
      console.log("Resetting account for:", { username, userUuid });

      const params = { username, userUuid };
      const response = await axios.post(`${serverUrl}/api/reset-account`, {}, { params });

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

  // 확률 배열은 고정, 낚시실력에 따라 물고기만 변경
  const probabilityTemplate = [40, 24, 15, 8, 5, 3, 2, 1, 0.7, 0.3]; // 고정 확률 배열

  const allFishTypes = [
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
    { name: "스타피쉬", price: 100, material: "별조각", rank: 0 }
  ];

  // 낚시실력에 따른 물고기 배열 반환 (확률 배열 고정)
  const getAvailableFish = (skill) => {
    // 스타피쉬 제외한 일반 물고기들
    const normalFish = allFishTypes.filter(f => f.name !== "스타피쉬");
    
    // 낚시실력에 따라 시작 인덱스만 1씩 증가 (최소 10개 유지)
    const startIndex = Math.min(skill, Math.max(0, normalFish.length - 10));
    const selectedFish = normalFish.slice(startIndex, startIndex + 10);
    
    // 고정된 확률 배열을 선택된 물고기에 적용
    const availableFish = selectedFish.map((fish, index) => ({
      ...fish,
      probability: probabilityTemplate[index] || 0.1 // 기본값 0.1%
    }));
    
    // 스타피쉬는 항상 포함 (특별한 물고기)
    const starFish = allFishTypes.find(f => f.name === "스타피쉬");
    if (starFish) {
      availableFish.push({
        ...starFish,
        probability: 1 // 스타피쉬는 항상 1%
      });
    }
    
    return availableFish;
  };

  // 현재 사용 가능한 물고기 배열
  const fishTypes = getAvailableFish(fishingSkill);

  // 물고기 판매 가격 정의
  const getFishPrice = (fishName) => {
    const fishData = allFishTypes.find(fish => fish.name === fishName);
    return fishData ? fishData.price : 0;
  };

  // 물고기 분해 시 얻는 재료
  const getFishMaterial = (fishName) => {
    const fishData = allFishTypes.find(fish => fish.name === fishName);
    return fishData ? fishData.material : null;
  };

  // 다른 사용자 프로필 데이터 가져오기
  const fetchOtherUserProfile = async (username) => {
    try {
      console.log("Fetching profile for:", username);
      const response = await axios.get(`${serverUrl}/api/user-profile/${encodeURIComponent(username)}`);
      console.log("Other user profile data:", response.data);
      setOtherUserData(response.data);
    } catch (error) {
      console.error("Failed to fetch other user profile:", error);
      alert("사용자 프로필을 불러올 수 없습니다.");
      setOtherUserData(null);
    }
  };

  // 닉네임 업데이트 함수
  const updateNickname = async () => {
    if (!newNickname.trim()) {
      alert("닉네임을 입력해주세요!");
      return;
    }
    
    if (newNickname.trim() === username) {
      setIsEditingNickname(false);
      setNewNickname("");
      return;
    }
    
    try {
      const oldNickname = username;
      const newNick = newNickname.trim();
      
      // 서버에 닉네임 변경 요청 (displayName으로 저장)
      const response = await axios.post(`${serverUrl}/api/update-nickname`, {
        newNickname: newNick
      }, {
        params: { username: oldNickname, userUuid }
      });
      
      if (response.data.success) {
        // 로컬에서 닉네임 업데이트
        setUsername(newNick);
        localStorage.setItem("nickname", newNick);
        
        // UI 상태 초기화
        setIsEditingNickname(false);
        setNewNickname("");
        
        // 소켓 재연결로 서버에 업데이트된 닉네임 전송 (userUuid 포함)
        const socket = getSocket();
        console.log("=== NICKNAME CHANGE DEBUG ===");
        console.log("Old nickname:", oldNickname);
        console.log("New nickname:", newNick);
        console.log("Current userUuid state:", userUuid);
        console.log("localStorage userUuid:", localStorage.getItem("userUuid"));
        console.log("localStorage nickname before emit:", localStorage.getItem("nickname"));
        console.log("Emitting chat:join with new nickname:", { username: newNick, idToken: !!idToken, userUuid });
        
        socket.emit("chat:join", { username: newNick, idToken, userUuid });
        
        // 성공 메시지
        setMessages(prev => [...prev, {
          system: true,
          username: "system",
          content: `닉네임이 '${newNick}'으로 변경되었습니다.`,
          timestamp: new Date().toISOString()
        }]);
        
        console.log(`Nickname changed from ${oldNickname} to ${newNick}`);
        
        // 접속자 목록 즉시 새로고침
        setTimeout(async () => {
          try {
            const res = await axios.get(`${serverUrl}/api/connected-users`);
            setConnectedUsers(res.data.users || []);
          } catch (e) {
            console.error('Failed to refresh connected users after nickname change:', e);
          }
        }, 500);
        
      } else {
        alert("닉네임 변경에 실패했습니다: " + (response.data.error || "알 수 없는 오류"));
      }
      
    } catch (error) {
      console.error("Failed to update nickname:", error);
      alert("닉네임 변경에 실패했습니다: " + (error.response?.data?.error || error.message));
    }
  };

  // 물고기별 체력 하드코딩
  const fishHealthMap = {
    "타코문어": 15,
    "풀고등어": 25,
    "경단붕어": 35,
    "버터오징어": 55,
    "간장새우": 80,
    "물수수": 115,
    "정어리파이": 160,
    "얼음상어": 215,
    "스퀄스퀴드": 280,
    "백년송거북": 355,
    "고스피쉬": 440,
    "유령치": 525,
    "바이트독": 640,
    "호박고래": 755,
    "바이킹조개": 880,
    "천사해파리": 1015,
    "악마복어": 1160,
    "칠성장어": 1315,
    "닥터블랙": 1480,
    "해룡": 1655,
    "메카핫킹크랩": 1840,
    "램프리": 2035,
    "마지막잎새": 2240,
    "아이스브리더": 2455,
    "해신": 2680,
    "핑키피쉬": 2915,
    "콘토퍼스": 3160,
    "딥원": 3415,
    "큐틀루": 3680,
    "꽃술나리": 3955,
    "다무스": 4240,
    "수호자": 4535,
    "태양가사리": 4840,
    "빅파더펭귄": 5155,
    "크레인터틀": 5480
  };

  // 물고기 접두어 시스템
  const fishPrefixes = [
    { name: '거대한', probability: 70, hpMultiplier: 1.0, amberMultiplier: 1.0 },
    { name: '변종', probability: 20, hpMultiplier: 1.5, amberMultiplier: 1.5 },
    { name: '심연의', probability: 7, hpMultiplier: 2.4, amberMultiplier: 3.0 },
    { name: '깊은어둠의', probability: 3, hpMultiplier: 3.9, amberMultiplier: 5.0 }
  ];

  // 접두어 선택 함수
  const selectFishPrefix = () => {
    const random = Math.random() * 100;
    let cumulative = 0;
    
    for (const prefix of fishPrefixes) {
      cumulative += prefix.probability;
      if (random <= cumulative) {
        return prefix;
      }
    }
    
    return fishPrefixes[0]; // 기본값 (거대한)
  };

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

  // 재료와 물고기 매핑 (분해 시 얻는 재료 -> 해당 물고기)
  const getMaterialToFish = (materialName) => {
    const fishData = allFishTypes.find(fish => fish.material === materialName);
    return fishData ? fishData.name : null;
  };

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
    if (accessoryLevel === 0) return 100; // 기본 체력
    return Math.floor(Math.pow(accessoryLevel, 1.125) + 30 * accessoryLevel);
  };

  // 물고기 공격력 계산 함수 (물고기 단계 기반)
  const calculateEnemyAttack = (fishRank) => {
    if (fishRank === 0) return Math.floor(Math.random() * 3) + 8; // 스타피쉬 특별 처리
    return Math.floor(Math.pow(fishRank, 1.65) + fishRank * 1.3 + 10 + Math.random() * 5);
  };

  // 낚시대 개수에 따른 낚시 쿨타임 계산
  const getFishingCooldownTime = () => {
    const baseTime = 5 * 60 * 1000; // 5분 (밀리초)
    const reduction = fishingSkill * 15 * 1000; // 낚시실력(낚시대 개수) * 15초
    return Math.max(baseTime - reduction, 0); // 최소 0초
  };

  // 쿨타임 포맷팅 함수
  const formatCooldown = (ms) => {
    const minutes = Math.floor(ms / (60 * 1000));
    const seconds = Math.floor((ms % (60 * 1000)) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // 호박석 지급 함수
  const addAmber = async (amount) => {
    try {
      console.log('Adding amber:', { amount, username, userUuid });
      const response = await axios.post(`${serverUrl}/api/add-amber`, {
        amount
      }, {
        params: { username, userUuid }
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
      
      const response = await axios.post(`${serverUrl}/api/recruit-companion`, {
        starPieceCost
      }, { params });
      
      console.log('Recruit response:', response.data);
      
      if (response.data.success) {
        setUserStarPieces(response.data.remainingStarPieces);
        
        if (response.data.recruited) {
          setCompanions(prev => [...prev, response.data.companion]);
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

  // 관리자 권한 토글 함수
  const toggleAdminRights = async () => {
    try {
      const params = { username, userUuid };
      console.log('Toggling admin rights with params:', params);
      
      const response = await axios.post(`${serverUrl}/api/toggle-admin`, {}, { params });
      
      console.log('Admin toggle response:', response.data);
      
      if (response.data.success) {
        setIsAdmin(response.data.isAdmin);
        setMessages(prev => [...prev, {
          system: true,
          username: "system",
          content: `🔧 ${response.data.message}`,
          timestamp: new Date().toISOString()
        }]);
        alert(`🔧 ${response.data.message}`);
      }
    } catch (error) {
      console.error('Failed to toggle admin rights:', error);
      alert('관리자 권한 변경에 실패했습니다.');
    }
  };





  // 재료 소모 함수
  const consumeMaterial = async (materialName, quantity = 1) => {
    try {
      const response = await axios.post(`${serverUrl}/api/consume-material`, {
        materialName,
        quantity
      }, {
        params: {
          username,
          userUuid
        }
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

    // 탐사 쿨타임 설정 (10분)
    const explorationCooldownTime = 10 * 60 * 1000; // 10분
    setExplorationCooldown(explorationCooldownTime);
    localStorage.setItem('explorationCooldown', explorationCooldownTime.toString());
    localStorage.setItem('explorationCooldownTime', Date.now().toString());

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
    
    // 전투 상태 먼저 초기화 (재료 소모 전에)
    const newBattleState = {
      enemy: enemyFish,
      baseFish: baseFish,
      prefix: selectedPrefix,
      playerHp: playerMaxHp,
      playerMaxHp: playerMaxHp,
      enemyHp: enemyMaxHp,
      enemyMaxHp: enemyMaxHp,
      turn: 'player',
      log: [`${material.material}을(를) 사용하여 ${enemyFish}(HP: ${enemyMaxHp})와의 전투가 시작되었습니다!`, `전투를 시작하거나 도망갈 수 있습니다.`],
      material: material.material,
      round: 1,
      materialConsumed: false, // 재료 소모 여부 추적
      autoMode: false, // 자동 전투 모드
      canFlee: true // 도망 가능 여부 (첫 턴에만 가능)
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
      
      // 탐사 쿨타임을 절반으로 설정 (5분)
      const halfCooldownTime = 5 * 60 * 1000; // 5분
      setExplorationCooldown(halfCooldownTime);
      localStorage.setItem('explorationCooldown', halfCooldownTime.toString());
      localStorage.setItem('explorationCooldownTime', Date.now().toString());
      
      // 서버에도 탐사 쿨타임 설정
      try {
        const params = { username, userUuid };
        await axios.post(`${serverUrl}/api/set-exploration-cooldown`, {
          cooldownDuration: halfCooldownTime
        }, { params });
        console.log(`Server exploration cooldown set: ${halfCooldownTime}ms`);
      } catch (error) {
        console.error('Failed to set server exploration cooldown:', error);
      }
      
      // 도망 메시지 추가
      const fleeLog = [...battleState.log, `${battleState.enemy}에게서 도망쳤습니다!`, `탐사 쿨타임이 절반으로 감소했습니다. (5분)`];
      
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

  // 플레이어 공격
  const playerAttack = () => {
    setBattleState(prevState => {
      if (!prevState || prevState.turn !== 'player') return prevState;

      const damage = calculatePlayerAttack(fishingSkill); // 낚시실력 기반 공격력
      const newEnemyHp = Math.max(0, prevState.enemyHp - damage);
      
      const newLog = [...prevState.log, `플레이어가 ${damage} 데미지를 입혔습니다! (${prevState.enemy}: ${newEnemyHp}/${prevState.enemyMaxHp})`];

      // 첫 공격 후 자동 모드 활성화
      const newAutoMode = !prevState.autoMode || prevState.autoMode;

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
        setTimeout(() => {
          // 승리 시 탐사 쿨타임 설정 (10분)
          const explorationCooldownTime = 10 * 60 * 1000; // 10분
          setExplorationCooldown(explorationCooldownTime);
          localStorage.setItem('explorationCooldown', explorationCooldownTime.toString());
          localStorage.setItem('explorationCooldownTime', Date.now().toString());
          
          // 서버에도 탐사 쿨타임 설정
          const setServerCooldown = async () => {
            try {
              const params = { username, userUuid };
              await axios.post(`${serverUrl}/api/set-exploration-cooldown`, {
                cooldownDuration: explorationCooldownTime
              }, { params });
              console.log(`Server exploration cooldown set after victory: ${explorationCooldownTime}ms`);
            } catch (error) {
              console.error('Failed to set server exploration cooldown after victory:', error);
            }
          };
          setServerCooldown();
          
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
        // 적 턴으로 변경
        const newState = {
          ...prevState,
          enemyHp: newEnemyHp,
          log: newLog,
          turn: 'enemy',
          autoMode: true, // 자동 모드 활성화
          canFlee: false // 공격 후에는 도망 불가능
        };

        // 적 공격 (1초 후)
        setTimeout(() => {
          enemyAttack(newEnemyHp, newLog);
        }, 1000);

        return newState;
      }
    });
  };

  // 적 공격
  const enemyAttack = (currentEnemyHp, currentLog) => {
    setBattleState(prevState => {
      if (!prevState) return null;

      // 물고기 단계 기반 공격력 계산
      const fishData = allFishTypes.find(fish => fish.name === prevState.baseFish);
      const fishRank = fishData ? fishData.rank : 1;
      const damage = calculateEnemyAttack(fishRank);
      const newPlayerHp = Math.max(0, prevState.playerHp - damage);
      
      const newLog = [...currentLog, `${prevState.enemy}가 ${damage} 데미지를 입혔습니다! (플레이어: ${newPlayerHp}/${prevState.playerMaxHp})`];

      if (newPlayerHp <= 0) {
        // 패배
        newLog.push(`패배했습니다... 재료를 잃었습니다.`);
        
        setTimeout(() => {
          // 패배 시 탐사 쿨타임 설정 (10분)
          const explorationCooldownTime = 10 * 60 * 1000; // 10분
          setExplorationCooldown(explorationCooldownTime);
          localStorage.setItem('explorationCooldown', explorationCooldownTime.toString());
          localStorage.setItem('explorationCooldownTime', Date.now().toString());
          
          // 서버에도 탐사 쿨타임 설정
          const setServerCooldown = async () => {
            try {
              const params = { username, userUuid };
              await axios.post(`${serverUrl}/api/set-exploration-cooldown`, {
                cooldownDuration: explorationCooldownTime
              }, { params });
              console.log(`Server exploration cooldown set after defeat: ${explorationCooldownTime}ms`);
            } catch (error) {
              console.error('Failed to set server exploration cooldown after defeat:', error);
            }
          };
          setServerCooldown();
          
          setShowBattleModal(false);
          setBattleState(null);
          alert("패배했습니다...");
        }, 2000);

        return {
          ...prevState,
          enemyHp: currentEnemyHp, // 적 체력 유지
          playerHp: 0,
          log: newLog,
          turn: 'defeat'
        };
      } else {
        // 플레이어 턴으로 변경
        const newState = {
          ...prevState,
          enemyHp: currentEnemyHp, // 적 체력 유지
          playerHp: newPlayerHp,
          log: newLog,
          turn: 'player'
        };

        // 자동 모드일 때 플레이어 공격 자동 실행 (1.5초 후)
        if (prevState.autoMode) {
          setTimeout(() => {
            playerAttack();
          }, 1500);
        }

        return newState;
      }
    });
  };

  // 상점 아이템 목록 (낚시실력에 따른 단계별)
  const getAllShopItems = () => {
    return {
      fishing_rod: [
        { name: '낡은낚시대', price: 10000, description: '오래된 낚시대입니다', requiredSkill: 0 },
        { name: '일반낚시대', price: 60000, description: '평범한 낚시대입니다', requiredSkill: 1 },
        { name: '단단한낚시대', price: 140000, description: '견고한 낚시대입니다', requiredSkill: 2 },
        { name: '은낚시대', price: 370000, description: '은으로 만든 고급 낚시대입니다', requiredSkill: 3 },
        { name: '금낚시대', price: 820000, description: '금으로 만든 최고급 낚시대입니다', requiredSkill: 4 },
        { name: '강철낚시대', price: 2390000, description: '강철로 제련된 견고한 낚시대입니다', requiredSkill: 5 },
        { name: '사파이어낚시대', price: 6100000, description: '사파이어가 박힌 신비로운 낚시대입니다', requiredSkill: 6 },
        { name: '루비낚시대', price: 15000000, description: '루비의 힘이 깃든 화려한 낚시대입니다', requiredSkill: 7 },
        { name: '다이아몬드낚시대', price: 45000000, description: '다이아몬드의 광채가 빛나는 낚시대입니다', requiredSkill: 8 },
        { name: '레드다이아몬드낚시대', price: 100000000, description: '희귀한 레드다이아몬드로 만든 전설적인 낚시대입니다', requiredSkill: 9 },
        { name: '벚꽃낚시대', price: 300000000, description: '벚꽃의 아름다움을 담은 환상적인 낚시대입니다', requiredSkill: 10 },
        { name: '꽃망울낚시대', price: 732000000, description: '꽃망울처럼 생긴 신비한 낚시대입니다', requiredSkill: 11 },
        { name: '호롱불낚시대', price: 1980000000, description: '호롱불처럼 따뜻한 빛을 내는 낚시대입니다', requiredSkill: 12 },
        { name: '산고등낚시대', price: 4300000000, description: '바다 깊은 곳의 산고로 만든 낚시대입니다', requiredSkill: 13 },
        { name: '피크닉', price: 8800000000, description: '즐거운 피크닉 분위기의 특별한 낚시대입니다', requiredSkill: 14 },
        { name: '마녀빗자루', price: 25000000000, description: '마녀의 마법이 깃든 신비로운 빗자루 낚시대입니다', requiredSkill: 15 },
        { name: '에테르낚시대', price: 64800000000, description: '에테르의 힘으로 만들어진 초월적인 낚시대입니다', requiredSkill: 16 },
        { name: '별조각낚시대', price: 147600000000, description: '별의 조각으로 만든 우주적인 낚시대입니다', requiredSkill: 17 },
        { name: '여우꼬리낚시대', price: 320000000000, description: '여우의 꼬리처럼 유연한 신비한 낚시대입니다', requiredSkill: 18 },
        { name: '초콜릿롤낚시대', price: 780000000000, description: '달콤한 초콜릿롤 모양의 귀여운 낚시대입니다', requiredSkill: 19 },
        { name: '호박유령낚시대', price: 2800000000000, description: '호박 속 유령의 힘이 깃든 무서운 낚시대입니다', requiredSkill: 20 },
        { name: '핑크버니낚시대', price: 6100000000000, description: '핑크빛 토끼의 귀여움이 담긴 낚시대입니다', requiredSkill: 21 },
        { name: '할로우낚시대', price: 15100000000000, description: '할로윈의 신비로운 힘이 깃든 낚시대입니다', requiredSkill: 22 },
        { name: '여우불낚시대', price: 40400000000000, description: '여우불의 환상적인 힘을 지닌 최고급 낚시대입니다', requiredSkill: 23 }
      ],
      accessories: [
        { name: '오래된반지', price: 10, currency: 'amber', description: '낡았지만 의미있는 반지입니다', requiredSkill: 0 },
        { name: '은목걸이', price: 25, currency: 'amber', description: '은으로 만든 아름다운 목걸이입니다', requiredSkill: 1 },
        { name: '금귀걸이', price: 50, currency: 'amber', description: '금으로 만든 화려한 귀걸이입니다', requiredSkill: 2 },
        { name: '마법의펜던트', price: 80, currency: 'amber', description: '마법의 힘이 깃든 신비한 펜던트입니다', requiredSkill: 3 },
        { name: '에메랄드브로치', price: 120, currency: 'amber', description: '에메랄드가 박힌 고급스러운 브로치입니다', requiredSkill: 4 },
        { name: '토파즈이어링', price: 180, currency: 'amber', description: '토파즈의 빛이 아름다운 이어링입니다', requiredSkill: 5 },
        { name: '자수정팔찌', price: 250, currency: 'amber', description: '자수정으로 만든 우아한 팔찌입니다', requiredSkill: 6 },
        { name: '백금티아라', price: 350, currency: 'amber', description: '백금으로 제작된 고귀한 티아라입니다', requiredSkill: 7 },
        { name: '만드라고라허브', price: 500, currency: 'amber', description: '신비한 만드라고라 허브입니다', requiredSkill: 8 },
        { name: '에테르나무묘목', price: 700, currency: 'amber', description: '에테르 나무의 신비한 묘목입니다', requiredSkill: 9 },
        { name: '몽마의조각상', price: 1000, currency: 'amber', description: '몽마의 힘이 깃든 신비한 조각상입니다', requiredSkill: 10 },
        { name: '마카롱훈장', price: 1500, currency: 'amber', description: '달콤한 마카롱 모양의 특별한 훈장입니다', requiredSkill: 11 },
        { name: '빛나는마력순환체', price: 2000, currency: 'amber', description: '마력이 순환하는 빛나는 신비한 구슬입니다', requiredSkill: 12 }
      ]
    };
  };

  // 현재 구매 가능한 아이템 (낚시실력에 따라)
  const getAvailableShopItem = (category) => {
    const allItems = getAllShopItems()[category] || [];
    
    // 현재 장착된 아이템의 레벨 확인
    let currentItemLevel = -1;
    if (category === 'fishing_rod' && userEquipment.fishingRod) {
      const currentItem = allItems.find(item => item.name === userEquipment.fishingRod);
      if (currentItem) {
        currentItemLevel = currentItem.requiredSkill;
      }
    } else if (category === 'accessories' && userEquipment.accessory) {
      const currentItem = allItems.find(item => item.name === userEquipment.accessory);
      if (currentItem) {
        currentItemLevel = currentItem.requiredSkill;
      }
    }
    
    // 다음 레벨 아이템 찾기
    const nextItem = allItems.find(item => item.requiredSkill === currentItemLevel + 1);
    
    return nextItem || null;
  };

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
      const price = getFishPrice(fishName);
      const totalPrice = price * quantity;
      
      const response = await axios.post(`${serverUrl}/api/sell-fish`, {
        fishName,
        quantity,
        totalPrice
      }, { params });
      
      if (response.data.success) {
        setUserMoney(prev => prev + totalPrice);
        // 인벤토리 새로고침
        const res = await axios.get(`${serverUrl}/api/inventory/${userId}`, { params });
        setInventory(res.data);
        const totalCount = res.data.reduce((sum, item) => sum + item.count, 0);
        setMyCatches(totalCount);
        
        // 판매 메시지 채팅에 추가
        setMessages(prev => [...prev, {
          system: true,
          content: `${fishName} ${quantity}마리를 ${totalPrice.toLocaleString()}골드에 판매했습니다!`,
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
        content: `모든 물고기를 판매하여 총 ${totalEarned.toLocaleString()}골드를 획득했습니다!`,
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
      const params = { username, userUuid };
      const response = await axios.post(`${serverUrl}/api/decompose-fish`, {
        fishName,
        quantity,
        material
      }, { params });

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
        
        // 인벤토리와 재료 새로고침
        const userId = idToken ? 'user' : 'null';
        const inventoryRes = await axios.get(`${serverUrl}/api/inventory/${userId}`, { params });
        setInventory(inventoryRes.data);
        const totalCount = inventoryRes.data.reduce((sum, item) => sum + item.count, 0);
        setMyCatches(totalCount);

        const materialsRes = await axios.get(`${serverUrl}/api/materials/${userId}`, { params });
        setMaterials(materialsRes.data || []);
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
  const buyItem = async (itemName, price, category) => {
    console.log("buyItem called with:", { itemName, price, category, username, userUuid });
    
    if (!username) {
      alert('사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.');
      return;
    }
    
    if (userMoney < price) {
      alert('골드가 부족합니다!');
      return;
    }
    
    try {
      const userId = idToken ? 'user' : 'null';
      const params = { username, userUuid }; // username과 userUuid 모두 전달
      
      console.log("Sending buy item request:", { itemName, price, category, params });
      
      const response = await axios.post(`${serverUrl}/api/buy-item`, {
        itemName,
        price,
        category
      }, { params });
      
      if (response.data.success) {
        setUserMoney(prev => prev - price);
        
        // 장비 자동 장착
        if (category === 'fishing_rod') {
          setUserEquipment(prev => ({ ...prev, fishingRod: itemName }));
          // 낚시대 구매 시 낚시실력 +1
          setFishingSkill(prev => prev + 1);
          // 낚시대 구매 시 현재 낚시하기 쿨타임 15초 감소
          setFishingCooldown(prev => {
            const newValue = Math.max(0, prev - 15000); // 15초 감소, 최소 0
            if (newValue > 0) {
              localStorage.setItem('fishingCooldown', newValue.toString());
              localStorage.setItem('fishingCooldownTime', Date.now().toString());
            } else {
              localStorage.removeItem('fishingCooldown');
              localStorage.removeItem('fishingCooldownTime');
            }
            return newValue;
          });
        } else if (category === 'accessories') {
          setUserEquipment(prev => ({ ...prev, accessory: itemName }));
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
        const skillMessage = category === 'fishing_rod' ? ' (낚시실력 +1)' : '';
        setMessages(prev => [...prev, {
          system: true,
          content: `${itemName}을(를) ${price.toLocaleString()}골드에 구매하고 장착했습니다!${skillMessage}`,
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (error) {
      console.error('Failed to buy item:', error);
      alert('아이템 구매에 실패했습니다.');
    }
  };

  // "낚시하기" 버튼은 제거하고 채팅 명령으로만 사용합니다

  if (!username) {
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
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="닉네임을 입력하세요"
                      className="flex-1 px-4 py-3 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && usernameInput.trim()) {
                          setUsername(usernameInput.trim());
                          localStorage.setItem("nickname", usernameInput.trim());
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        if (usernameInput.trim()) {
                          setUsername(usernameInput.trim());
                          localStorage.setItem("nickname", usernameInput.trim());
                        } else {
                          alert("닉네임을 입력해주세요!");
                        }
                      }}
                      className="px-6 py-3 bg-gray-700/50 hover:bg-gray-600/50 text-white rounded-lg transition-all duration-300 transform hover:scale-105 border border-gray-600/50"
                    >
                      시작
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 text-center">
                    게스트로 시작하면 데이터가 저장되지 않습니다
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
                <h1 className={`font-bold text-lg ${
                  isDarkMode ? "text-white gradient-text" : "text-gray-800"
                }`}>Fishing Chat</h1>
                <p className={`text-xs ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}>실시간 낚시 게임</p>
              </div>
            </div>
          
          <div className="flex items-center gap-4">
            {/* 테마 토글 */}
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-full hover:glow-effect transition-all duration-300 ${
                isDarkMode 
                  ? "glass-input text-yellow-400" 
                  : "bg-white/60 backdrop-blur-sm border border-gray-300/40 text-gray-600 hover:text-yellow-500"
              }`}
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            
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
                      <div key={user.userUuid || user.username} className={`p-3 rounded-lg transition-all duration-300 hover:scale-105 cursor-pointer ${
                        isDarkMode ? "glass-input" : "bg-white/60 backdrop-blur-sm border border-gray-300/40"
                      } ${user.username === username ? 
                        (isDarkMode ? "ring-2 ring-yellow-400/50 bg-yellow-500/10" : "ring-2 ring-yellow-500/50 bg-yellow-500/5")
                        : ""
                      }`}>
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
                                🐟 {user.totalFish}마리
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
          <div>
            <div className={`rounded-2xl board-shadow min-h-full flex flex-col ${
              isDarkMode ? "glass-card" : "bg-white/80 backdrop-blur-md border border-gray-300/30"
            }`}>
              {/* 채팅 헤더 */}
              <div className={`border-b p-4 ${
                isDarkMode ? "border-white/10" : "border-gray-300/30"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                      <MessageCircle className={`w-4 h-4 ${
                        isDarkMode ? "text-blue-400" : "text-blue-600"
                      }`} />
                    </div>
                    <h2 className={`text-lg font-semibold ${
                      isDarkMode ? "text-white" : "text-gray-800"
                    }`}>실시간 채팅</h2>
                  </div>
                  
                  {/* 액션 버튼들 */}
                  <div className="flex gap-2">
                    <button
                      className={`p-2 rounded-lg hover:glow-effect transition-all duration-300 text-red-400 ${
                        isDarkMode ? "glass-input" : "bg-white/60 backdrop-blur-sm border border-gray-300/40"
                      }`}
                      onClick={() => {
                        if (confirm("로그아웃 하시겠습니까?")) {
                          localStorage.removeItem("nickname");
                          setUsername("");
                          setMessages([]);
                          setInventory([]);
                          setMyCatches(0);
                          setUserMoney(0);
                          setIdToken(undefined);
                          setUsernameInput("");
                          setActiveTab("chat");
                        }
                      }}
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              
              {/* 채팅 메시지 영역 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[50vh]">
                {messages.map((m, i) => (
                  <div key={i} className="group">
                    {m.system ? (
                      <div className="text-center my-1">
                        <div className={`inline-block px-2 py-0.5 rounded-md text-xs ${
                          isDarkMode ? "bg-gray-800/50 border border-gray-700/30" : "bg-gray-100/80 border border-gray-300/30"
                        }`}>
                          <span className={`font-medium ${
                            isDarkMode ? "text-yellow-300" : "text-amber-700"
                          }`}>
                            {m.content}
                          </span>
                          <span className={`ml-1 text-[10px] ${
                            isDarkMode ? "text-gray-500" : "text-gray-500"
                          }`}>
                            {m.timestamp ? new Date(m.timestamp).toLocaleTimeString('ko-KR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : new Date().toLocaleTimeString('ko-KR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <div 
                          className={`flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border cursor-pointer hover:scale-110 transition-all duration-300 ${
                            isDarkMode ? "border-white/10 hover:border-blue-400/50" : "border-gray-300/20 hover:border-blue-500/50"
                          }`}
                          onClick={async () => {
                            setSelectedUserProfile({ username: m.username }); // 다른 사용자 프로필
                            await fetchOtherUserProfile(m.username); // 해당 사용자 데이터 가져오기
                            setShowProfile(true);
                          }}
                          title={`${m.username}님의 프로필 보기`}
                        >
                          <User className={`w-4 h-4 ${isDarkMode ? "text-blue-400" : "text-blue-600"}`} />
                        </div>
                        <div className="flex-1 max-w-md">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`font-semibold text-sm ${
                              isDarkMode ? "text-blue-400" : "text-blue-600"
                            }`}>{m.username}</span>
                            {((m.username === username && isAdmin) || userAdminStatus[m.username]) && (
                              <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                                isDarkMode ? "bg-red-500/20 text-red-400" : "bg-red-500/10 text-red-600"
                              }`}>관리자</span>
                            )}
                            <div className={`flex items-center gap-1 text-xs ${
                              isDarkMode ? "text-gray-500" : "text-gray-600"
                            }`}>
                              <Clock className="w-3 h-3" />
                              {m.timestamp ? new Date(m.timestamp).toLocaleTimeString('ko-KR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : new Date().toLocaleTimeString('ko-KR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                          <div className={`inline-block px-4 py-2 rounded-xl max-w-fit ${
                            isDarkMode ? "glass-input" : "bg-white/60 backdrop-blur-sm border border-gray-300/40"
                          }`}>
                            <span className={`text-sm ${
                              isDarkMode ? "text-gray-200" : "text-gray-700"
                            }`}>{m.content}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              
              {/* 메시지 입력 영역 */}
              <div className={`border-t p-4 ${
                isDarkMode ? "border-white/10" : "border-gray-300/20"
              }`}>
                <div className="flex gap-3">
                  <input
                    className={`flex-1 px-4 py-3 rounded-xl text-sm transition-all duration-300 focus:scale-105 ${
                      isDarkMode 
                        ? "glass-input text-white placeholder-gray-400" 
                        : "bg-white/60 backdrop-blur-sm border border-gray-300/40 text-gray-800 placeholder-gray-500"
                    }`}
                    placeholder={fishingCooldown > 0 
                      ? `낚시하기 쿨타임: ${formatCooldown(fishingCooldown)}` 
                      : "메시지를 입력하세요... (낚시하기)"
                    }
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSend();
                    }}
                  />
                  <button
                    className={`px-6 py-3 rounded-xl hover:glow-effect transition-all duration-300 transform hover:scale-105 flex items-center gap-2 ${
                      isDarkMode 
                        ? "glass-input text-blue-400" 
                        : "bg-white/60 backdrop-blur-sm border border-gray-300/40 text-blue-600"
                    }`}
                    onClick={handleSend}
                  >
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline font-medium">전송</span>
                  </button>
                </div>
                <div className="mt-3 text-center">
                  <p className={`text-xs flex items-center justify-center gap-2 ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}>
                    {fishingCooldown > 0 ? (
                      <>
                        <span>⏰</span>
                        낚시하기 쿨타임: {formatCooldown(fishingCooldown)}
                      </>
                    ) : (
                      <>
                        <span className="animate-pulse">🎣</span>
                        "낚시하기" 입력으로 물고기를 낚아보세요!
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
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
                    }`}>총 {inventory.reduce((sum, item) => sum + item.count, 0)}마리</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const userId = idToken ? 'user' : 'null';
                        const params = { username, userUuid };
                        console.log("Manual inventory refresh:", { userId, username, userUuid });
                        const res = await axios.get(`${serverUrl}/api/inventory/${userId}`, { params });
                        console.log("Manual inventory result:", res.data);
                        setInventory(res.data);
                        const totalCount = res.data.reduce((sum, item) => sum + item.count, 0);
                        setMyCatches(totalCount);
                      } catch (e) {
                        console.error('Failed to refresh inventory:', e);
                      }
                    }}
                    className={`p-2 rounded-full transition-all hover:scale-110 ${
                      isDarkMode 
                        ? "bg-blue-500/20 hover:bg-blue-500/30 text-blue-400" 
                        : "bg-blue-500/20 hover:bg-blue-500/30 text-blue-600"
                    }`}
                    title="인벤토리 새로고침"
                  >
                    🔄
                  </button>
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border ${
                    isDarkMode ? "border-yellow-400/20" : "border-yellow-500/30"
                  }`}>
                    <Coins className={`w-4 h-4 ${
                      isDarkMode ? "text-yellow-400" : "text-yellow-600"
                    }`} />
                    <span className={`text-sm font-bold ${
                      isDarkMode ? "text-yellow-400" : "text-yellow-600"
                    }`}>{userMoney.toLocaleString()}</span>
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
                    }`}>{userAmber.toLocaleString()}</span>
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
                    }`}>{userStarPieces.toLocaleString()}</span>
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
                            }`}>{getFishPrice(item.fish).toLocaleString()}</span>
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
                  <div className={`flex items-center gap-2 mb-4 px-2 ${
                    isDarkMode ? "text-purple-400" : "text-purple-600"
                  }`}>
                    <Gem className="w-5 h-5" />
                    <h3 className="font-semibold">재료 ({materials.length}종)</h3>
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
                    }`}>{userMoney.toLocaleString()}</span>
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
                    }`}>{userAmber.toLocaleString()}</span>
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
                    }`}>{userStarPieces.toLocaleString()}</span>
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
                const availableItem = getAvailableShopItem(shopCategory);
                
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
                              }`}>{availableItem.price.toLocaleString()}</span>
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
                              }`}>{availableItem.price.toLocaleString()}</span>
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
                              currentUsername: username,
                              currentUserUuid: userUuid,
                              currentUserMoney: userMoney
                            });
                            buyItem(availableItem.name, availableItem.price, shopCategory);
                          }}
                          disabled={availableItem.currency === 'amber' ? true : userMoney < availableItem.price}
                          className={`w-full py-3 px-6 rounded-lg font-bold text-lg transition-all duration-300 ${
                            availableItem.currency === 'amber'
                              ? isDarkMode
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
                            ? "호박석 시스템 준비 중" 
                            : userMoney >= availableItem.price 
                              ? "구매하기" 
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
          <div className={`rounded-2xl board-shadow min-h-full flex flex-col ${
            isDarkMode ? "glass-card" : "bg-white/80 backdrop-blur-md border border-gray-300/30"
          }`}>
            {/* 동료모집 헤더 */}
            <div className={`border-b p-4 ${
              isDarkMode ? "border-white/10" : "border-gray-300/20"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 border ${
                    isDarkMode ? "border-white/10" : "border-purple-300/30"
                  }`}>
                    <Users className={`w-4 h-4 ${
                      isDarkMode ? "text-purple-400" : "text-purple-600"
                    }`} />
                  </div>
                  <div>
                    <h2 className={`text-lg font-semibold ${
                      isDarkMode ? "text-white" : "text-gray-800"
                    }`}>동료모집</h2>
                    <p className={`text-xs ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}>별조각 1개로 15% 확률 가챠</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 border ${
                    isDarkMode ? "border-blue-400/20" : "border-blue-500/30"
                  }`}>
                    <Star className={`w-4 h-4 ${
                      isDarkMode ? "text-blue-400" : "text-blue-600"
                    }`} />
                    <span className={`text-sm font-bold ${
                      isDarkMode ? "text-blue-400" : "text-blue-600"
                    }`}>{userStarPieces.toLocaleString()}</span>
                    <span className={`text-xs ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}>별조각</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 동료 모집 버튼 */}
            <div className="p-6">
              <div className="text-center mb-6">
                <button
                  onClick={recruitCompanion}
                  disabled={userStarPieces < 1 || companions.length >= 6}
                  className={`px-8 py-4 rounded-xl font-bold text-lg transition-all duration-300 ${
                    userStarPieces >= 1 && companions.length < 6
                      ? isDarkMode
                        ? "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 hover:scale-105 glow-effect border border-purple-400/30"
                        : "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 hover:scale-105 border border-purple-500/30"
                      : isDarkMode
                        ? "bg-gray-500/20 text-gray-500 cursor-not-allowed border border-gray-500/20"
                        : "bg-gray-300/30 text-gray-400 cursor-not-allowed border border-gray-300/30"
                  }`}
                >
                  {companions.length >= 6
                    ? "모든 동료 보유 완료"
                    : userStarPieces < 1
                      ? `별조각 부족 (${userStarPieces}/1)`
                      : "동료 모집 (별조각 1개)"
                  }
                </button>
                <div className={`text-xs mt-2 ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}>
                  성공 확률: 15% | 남은 동료: {6 - companions.length}명
                </div>
              </div>
              
              {/* 보유 동료 목록 */}
              <div className={`p-4 rounded-xl ${
                isDarkMode ? "glass-input" : "bg-white/60 backdrop-blur-sm border border-gray-300/40"
              }`}>
                <h3 className={`font-medium mb-3 ${
                  isDarkMode ? "text-white" : "text-gray-800"
                }`}>보유 동료 ({companions.length}/6)</h3>
                
                {companions.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {companions.map((companion, index) => (
                      <div key={index} className={`p-3 rounded-lg text-center ${
                        isDarkMode ? "bg-purple-500/10 border border-purple-400/20" : "bg-purple-500/5 border border-purple-300/30"
                      }`}>
                        <div className={`font-medium ${
                          isDarkMode ? "text-purple-400" : "text-purple-600"
                        }`}>{companion}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={`text-center py-8 ${
                    isDarkMode ? "text-gray-500" : "text-gray-600"
                  }`}>
                    아직 동료가 없습니다.
                    <br />
                    별조각 10개로 동료를 모집해보세요!
                  </div>
                )}
              </div>
              
              {/* 동료 소개 */}
              <div className={`mt-4 p-4 rounded-xl ${
                isDarkMode ? "glass-input" : "bg-white/60 backdrop-blur-sm border border-gray-300/40"
              }`}>
                <h3 className={`font-medium mb-3 ${
                  isDarkMode ? "text-white" : "text-gray-800"
                }`}>동료 소개</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                  {["실", "피에나", "애비게일", "림스&베리", "클로에", "나하트라"].map((name, index) => (
                    <div key={index} className={`p-2 rounded text-center ${
                      companions.includes(name)
                        ? isDarkMode
                          ? "bg-green-500/20 text-green-400 border border-green-400/30"
                          : "bg-green-500/10 text-green-600 border border-green-500/30"
                        : isDarkMode
                          ? "bg-gray-500/10 text-gray-500 border border-gray-500/20"
                          : "bg-gray-300/20 text-gray-600 border border-gray-300/30"
                    }`}>
                      {name} {companions.includes(name) ? "✓" : ""}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
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
                    }`}>총 낚은 물고기</span>
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
                            }`}>{fish.rank}Rank • {fish.price.toLocaleString()}골드</p>
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
                    if (explorationCooldown > 0) {
                      alert(`탐사하기 쿨타임이 ${formatCooldown(explorationCooldown)} 남았습니다!`);
                      return;
                    }
                    setShowExplorationModal(true);
                  }}
                  disabled={materials.length === 0 || explorationCooldown > 0}
                  className={`px-6 py-3 rounded-lg font-bold text-lg transition-all duration-300 ${
                    materials.length > 0 && explorationCooldown === 0
                      ? isDarkMode
                        ? "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 hover:scale-105 glow-effect"
                        : "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 hover:scale-105"
                      : isDarkMode
                        ? "bg-gray-500/20 text-gray-500 cursor-not-allowed"
                        : "bg-gray-300/30 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  {explorationCooldown > 0 
                    ? `쿨타임 ${formatCooldown(explorationCooldown)}`
                    : materials.length > 0 
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
                        {(user.userId === 'user' || user.hasIdToken) ? "Google" : "Guest"}
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
                  {isEditingNickname && !selectedUserProfile ? ( // 내 프로필일 때만 편집 가능
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newNickname}
                        onChange={(e) => setNewNickname(e.target.value)}
                        className={`px-2 py-1 rounded text-sm border ${
                          isDarkMode 
                            ? "bg-gray-800 border-gray-600 text-white" 
                            : "bg-white border-gray-300 text-gray-800"
                        }`}
                        placeholder="새 닉네임"
                        autoFocus
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') updateNickname();
                          if (e.key === 'Escape') {
                            setIsEditingNickname(false);
                            setNewNickname("");
                          }
                        }}
                      />
                      <button
                        onClick={updateNickname}
                        className={`px-2 py-1 rounded text-xs ${
                          isDarkMode 
                            ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30" 
                            : "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20"
                        }`}
                      >
                        저장
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingNickname(false);
                          setNewNickname("");
                        }}
                        className={`px-2 py-1 rounded text-xs ${
                          isDarkMode 
                            ? "bg-gray-500/20 text-gray-400 hover:bg-gray-500/30" 
                            : "bg-gray-500/10 text-gray-600 hover:bg-gray-500/20"
                        }`}
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h2 className={`text-lg font-semibold ${
                        isDarkMode ? "text-white" : "text-gray-800"
                      }`}>{selectedUserProfile ? `${selectedUserProfile.username}님의 프로필` : `${username}님의 프로필`}</h2>
                      {!selectedUserProfile && ( // 내 프로필일 때만 수정 버튼 표시
                        <button
                          onClick={() => {
                            setIsEditingNickname(true);
                            setNewNickname(username);
                          }}
                          className={`px-2 py-1 rounded text-xs transition-all duration-300 hover:scale-105 ${
                            isDarkMode 
                              ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30" 
                              : "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20"
                          }`}
                        >
                          수정
                        </button>
                      )}
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    {(selectedUserProfile ? otherUserData?.userUuid : userUuid) && (
                      <div className="flex items-center gap-2">
                        <p className={`text-xs font-mono ${
                          isDarkMode ? "text-green-400" : "text-green-600"
                        }`}>ID: {selectedUserProfile ? otherUserData?.userUuid : userUuid}</p>
                        {!selectedUserProfile && ( // 내 프로필일 때만 계정 초기화 버튼 표시
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
                    }`}>총 낚은 물고기</div>
                  </div>
                  <div className="text-center">
                    <div className={`font-bold text-lg ${
                      isDarkMode ? "text-yellow-400" : "text-yellow-600"
                    }`}>
                      {selectedUserProfile ? (otherUserData?.money || 0).toLocaleString() : userMoney.toLocaleString()}
                    </div>
                    <div className={`text-xs ${
                      isDarkMode ? "text-gray-500" : "text-gray-600"
                    }`}>보유 골드</div>
                  </div>
                  <div className="text-center">
                    <div className={`font-bold text-lg ${
                      isDarkMode ? "text-orange-400" : "text-orange-600"
                    }`}>
                      {selectedUserProfile ? (otherUserData?.amber || 0).toLocaleString() : userAmber.toLocaleString()}
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
              } ${user.username === username ? 
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
                      {user.totalCatches.toLocaleString()}마리
                    </div>
                    <div className={`text-sm ${
                      isDarkMode ? "text-emerald-400" : "text-emerald-600"
                    }`}>
                      Lv.{user.fishingSkill}
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
                        {(getFishPrice(quantityModalData.fishName) * inputQuantity).toLocaleString()}골드
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
                    <div>• 모든 낚은 물고기 ({myCatches}마리)</div>
                    <div>• 골드 ({userMoney.toLocaleString()}골드)</div>
                    <div>• 호박석 ({userAmber.toLocaleString()}개)</div>
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
              }`}>전투: vs <span className={battleState.prefix ? getPrefixColor(battleState.prefix.name, isDarkMode) : ''}>{battleState.enemy}</span></h3>
              <div className="flex items-center gap-2">
                <p className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}>재료: {battleState.material}</p>
                {battleState.materialConsumed ? (
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
                      }`}>{battleState.playerHp}/{battleState.playerMaxHp}</span>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        (battleState.playerHp / battleState.playerMaxHp) >= 0.8 
                          ? isDarkMode ? "bg-green-500/20 text-green-400" : "bg-green-500/10 text-green-600"
                          : (battleState.playerHp / battleState.playerMaxHp) >= 0.5 
                          ? isDarkMode ? "bg-yellow-500/20 text-yellow-400" : "bg-yellow-500/10 text-yellow-600"
                          : isDarkMode ? "bg-red-500/20 text-red-400" : "bg-red-500/10 text-red-600"
                      }`}>{Math.round((battleState.playerHp / battleState.playerMaxHp) * 100)}%</span>
                    </div>
                  </div>
                  <div className={`w-full h-4 rounded-full ${
                    isDarkMode ? "bg-gray-700" : "bg-gray-200"
                  }`}>
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500"
                      style={{ width: `${(battleState.playerHp / battleState.playerMaxHp) * 100}%` }}
                    ></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className={`text-sm font-medium ${
                      battleState.prefix ? getPrefixColor(battleState.prefix.name, isDarkMode) : (isDarkMode ? "text-red-400" : "text-red-600")
                    }`}>{battleState.enemy}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${
                        isDarkMode ? "text-white" : "text-gray-800"
                      }`}>{battleState.enemyHp}/{battleState.enemyMaxHp}</span>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        (battleState.enemyHp / battleState.enemyMaxHp) >= 0.8 
                          ? isDarkMode ? "bg-green-500/20 text-green-400" : "bg-green-500/10 text-green-600"
                          : (battleState.enemyHp / battleState.enemyMaxHp) >= 0.5 
                          ? isDarkMode ? "bg-yellow-500/20 text-yellow-400" : "bg-yellow-500/10 text-yellow-600"
                          : isDarkMode ? "bg-red-500/20 text-red-400" : "bg-red-500/10 text-red-600"
                      }`}>{Math.round((battleState.enemyHp / battleState.enemyMaxHp) * 100)}%</span>
                    </div>
                  </div>
                  <div className={`w-full h-4 rounded-full ${
                    isDarkMode ? "bg-gray-700" : "bg-gray-200"
                  }`}>
                    <div 
                      className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(0, (battleState.enemyHp / battleState.enemyMaxHp) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* 전투 로그 */}
              <div className={`p-4 rounded-lg max-h-[200px] overflow-y-auto ${
                isDarkMode ? "bg-gray-800/50 border border-gray-700/30" : "bg-gray-100/80 border border-gray-300/30"
              }`}>
                <div className="space-y-1">
                  {battleState.log.map((message, index) => (
                    <p key={index} className={`text-sm ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}>
                      {message}
                    </p>
                  ))}
                </div>
              </div>

              {/* 자동 모드 상태 표시 */}
              {battleState.autoMode && (battleState.turn === 'player' || battleState.turn === 'enemy') && (
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
                {battleState.turn === 'player' && !battleState.autoMode && (
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
                    {battleState.canFlee && (
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

                {battleState.turn === 'player' && battleState.autoMode && (
                  <div className="flex gap-2 w-full">
                    <div className={`flex-1 py-3 px-6 rounded-lg text-center font-medium ${
                      isDarkMode ? "bg-yellow-500/20 text-yellow-400" : "bg-yellow-500/10 text-yellow-600"
                    }`}>
                      자동 공격 중...
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
                
                {battleState.turn === 'enemy' && (
                  <div className="flex gap-2 w-full">
                    <div className={`flex-1 py-3 px-6 rounded-lg text-center font-medium ${
                      isDarkMode ? "bg-gray-500/20 text-gray-400" : "bg-gray-300/30 text-gray-600"
                    }`}>
                      적의 턴...
                    </div>
                    {battleState.autoMode && (
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
                
                {(battleState.turn === 'victory' || battleState.turn === 'defeat' || battleState.turn === 'fled') && (
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
                    {battleState.turn === 'victory' ? '승리!' : battleState.turn === 'fled' ? '도망 성공!' : '패배...'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;