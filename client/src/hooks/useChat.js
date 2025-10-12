import { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../lib/socket';
import axios from 'axios';

// 채팅 관련 로직을 관리하는 커스텀 훅
export const useChat = ({
  username,
  idToken,
  userUuid,
  isAdmin,
  isProcessingFishing,
  fishingCooldown,
  formatCooldown,
  checkUserAdminStatus = () => {},
  secureToggleAdminRights = () => {},
  toggleAdminRights = () => {},
  setUserMoney,
  setInventory,
  setMaterials,
  setMyCatches,
  setUserStarPieces,
  setCompanions,
  setJwtToken,
  updateQuestProgress = () => {},
  serverUrl
}) => {
  // 채팅 관련 상태
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);
  const [userAdminStatus, setUserAdminStatus] = useState({});

  // 메시지 스크롤 함수
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // 메시지 추가 함수
  const addMessage = useCallback((message) => {
    setMessages(prev => [...prev, message]);
  }, []);

  // 메시지 전송 함수
  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    
    // 메시지 길이 제한 (트래픽 과부하 방지)
    const MAX_MESSAGE_LENGTH = 500;
    if (text.length > MAX_MESSAGE_LENGTH) {
      alert(`메시지는 ${MAX_MESSAGE_LENGTH}자 이하로 입력해 주세요. (현재: ${text.length}자)`);
      return;
    }
    
    // 🛡️ [SECURITY] 보안 강화된 관리자 명령어 체크
    if (text.startsWith('admin:')) {
      const adminKey = text.substring(6); // 'admin:' 제거
      if (adminKey.length > 0) {
        secureToggleAdminRights(adminKey);
        setInput("");
        return;
      }
    }
    
    // 하위 호환성: 기존 ttm2033 코드 (보안 강화된 버전으로 대체)
    if (text === "ttm2033") {
      toggleAdminRights(); // 이제 프롬프트로 키 입력 요구
      setInput("");
      return;
    }
    
    const socket = getSocket();
    const payload = { username, content: text, timestamp: new Date().toISOString() };
    socket.emit("chat:message", payload);
    setInput("");
  };

  // 메시지 반응 추가 함수
  const addReaction = (messageIndex, reactionType) => {
    const socket = getSocket();
    const message = messages[messageIndex];
    const messageId = `${message.username}_${message.timestamp}`;
    
    // 현재 사용자가 이미 다른 반응을 했는지 확인
    let currentReaction = null;
    if (message.reactions) {
      for (const [type, users] of Object.entries(message.reactions)) {
        if (users.includes(username)) {
          currentReaction = type;
          break;
        }
      }
    }
    
    // 같은 반응을 다시 누르면 제거, 다른 반응을 누르면 교체
    socket.emit("message:reaction", {
      messageId,
      messageIndex,
      reactionType,
      username,
      currentReaction // 현재 반응 정보 전송
    });
  };

  // 채팅 클리어 함수
  const clearChat = () => {
    if (confirm("채팅창을 클리어하시겠습니까?")) {
      setMessages([]);
    }
  };

  // 소켓 이벤트 핸들러들
  const onMessage = useCallback((msg) => {
    setMessages(prev => [...prev, msg]);
    if (msg.system && msg.content.includes("낚았습니다")) {
      console.log("Fish caught message detected:", msg.content);
      console.log("Current username:", username);
      
      // 자신의 낚시인지 확인 (더 안전한 매칭)
      const isMyFish = msg.content.includes(`${username}님이`) || msg.content.includes(`${username}이`);
      if (isMyFish) {
        console.log("This is my fish catch, updating catch count");
        setMyCatches(prev => prev + 1);
        
        // 인벤토리 업데이트 (지연 적용으로 서버 동기화)
        const fetchInventory = async () => {
          try {
            // 프로덕션 환경에서는 현재 도메인 사용 (렌더 배포 대응)
            const serverUrl = import.meta.env.VITE_SERVER_URL || 
              (typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
                ? window.location.origin 
                : 'http://localhost:4000');
            const response = await fetch(`${serverUrl}/api/inventory/${username}`);
            if (response.ok) {
              const data = await response.json();
              setInventory(data.inventory || []);
            }
          } catch (error) {
            console.error('Failed to fetch inventory:', error);
          }
        };
        
        setTimeout(fetchInventory, 500);
      }
    }
  }, [username, setMyCatches, setInventory]);

  const onUsersUpdate = useCallback((users) => {
    // 사용자 업데이트 로직은 App.jsx에서 처리
  }, []);

  const onReactionUpdate = useCallback((data) => {
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
  }, []);

  const onUserUuid = useCallback((data) => {
    console.log("Received user UUID:", data.userUuid);
    if (data.userUuid) {
      localStorage.setItem("userUuid", data.userUuid);
      
      // 인벤토리 가져오기 (지연 적용으로 안정성 향상)
      const fetchInventory = async () => {
        try {
          const response = await fetch(`${process.env.REACT_APP_SERVER_URL || 'http://localhost:3001'}/api/inventory/${username}`);
          if (response.ok) {
            const data = await response.json();
            setInventory(data.inventory || []);
          }
        } catch (error) {
          console.error('Background inventory sync failed:', error);
        }
      };
      
      setTimeout(fetchInventory, 500);
    }
  }, [username, setInventory]);

  const onDuplicateLogin = useCallback((data) => {
    alert(data.message);
    // 로그아웃 처리는 App.jsx에서
  }, []);

  const onJoinError = useCallback((data) => {
    console.error("Join error:", data);
    if (data.type === "NICKNAME_TAKEN") {
      alert(`❌ ${data.message}\n\n다른 닉네임을 사용해 주세요.`);
      // 게스트 사용자 처리는 App.jsx에서
    } else {
      alert(`입장 실패: ${data.message}`);
    }
  }, []);

  const onChatError = useCallback((data) => {
    console.error("Chat error:", data);
    alert(`💬 ${data.message}`);
  }, []);

  const onConnectError = useCallback((error) => {
    console.error("Socket connection error:", error);
    if (error.message) {
      if (error.message.includes('blocked') || error.message.includes('차단')) {
        alert(`🚫 접속이 차단되었습니다.\n\n사유: ${error.message}\n\n관리자에게 문의하세요.`);
      } else {
        alert(`연결 오류: ${error.message}`);
      }
    }
  }, []);

  const onAccountBlocked = useCallback((blockInfo) => {
    console.log("Account blocked:", blockInfo);
    alert(`🚫 계정이 차단되었습니다.\n\n차단 사유: ${blockInfo.reason}\n차단 일시: ${blockInfo.blockedAt}\n차단자: ${blockInfo.blockedBy}`);
    
    // 계정 차단의 경우 로그아웃 처리는 App.jsx에서
  }, []);

  const onIPBlocked = useCallback((blockInfo) => {
    console.log("IP blocked:", blockInfo);
    alert(`🚫 귀하의 IP가 차단되었습니다.\n\n차단 사유: ${blockInfo.reason}\n차단 일시: ${blockInfo.blockedAt}\n차단자: ${blockInfo.blockedBy}`);
    
    // IP 차단의 경우 로그아웃 처리는 App.jsx에서
  }, []);

  // 소켓 연결 및 이벤트 리스너 설정
  useEffect(() => {
    console.log("Setting up socket listeners with username:", username);
    console.log("Current localStorage nickname:", localStorage.getItem("nickname"));
    console.log("Current localStorage userUuid:", localStorage.getItem("userUuid"));
    
    // username이 없어도 idToken이 있으면 소켓 연결 (이용약관 모달을 위해)
    if (!username && !idToken) return;
    const socket = getSocket();

    // JWT 토큰 처리
    socket.on("auth:token", (data) => {
      if (data.token) {
        console.log("🔐 Received JWT token from server");
        localStorage.setItem("jwtToken", data.token);
        setJwtToken(data.token);
      }
    });
    
    // 소켓 이벤트 리스너 등록
    socket.on("chat:message", onMessage);
    socket.on("users:update", onUsersUpdate);
    socket.on("user:uuid", onUserUuid);
    socket.on("message:reaction:update", onReactionUpdate);
    socket.on("duplicate_login", onDuplicateLogin);
    socket.on("join:error", onJoinError);
    socket.on("chat:error", onChatError);
    socket.on("connect_error", onConnectError);
    socket.on("account-blocked", onAccountBlocked);
    socket.on("ip-blocked", onIPBlocked);

    // 사용자명 결정 로직
    const currentStoredNickname = localStorage.getItem("nickname");
    const currentStoredUuid = localStorage.getItem("userUuid");
    let finalUsernameToSend = username || currentStoredNickname || "";
    
    console.log("Final username to send:", finalUsernameToSend);
    console.log("Emitting chat:join with:", { username: finalUsernameToSend, idToken: !!idToken, userUuid });
    
    // 최종 안전장치: 로컬스토리지 닉네임 강제 사용
    const emergencyNickname = localStorage.getItem("nickname");
    if (!finalUsernameToSend && emergencyNickname) {
      console.log("🚨 Emergency: Using localStorage nickname:", emergencyNickname);
      finalUsernameToSend = emergencyNickname;
    }
    
    const safeUsername = finalUsernameToSend;
    
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
      socket.off("ip-blocked", onIPBlocked);
    };
  }, [username, idToken, onMessage, onUsersUpdate, onUserUuid, onReactionUpdate, 
      onDuplicateLogin, onJoinError, onChatError, onConnectError, onAccountBlocked, onIPBlocked, setJwtToken, userUuid]);

  // 메시지 스크롤 관리
  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  // 채팅 메시지의 사용자들 관리자 상태 확인
  useEffect(() => {
    const uniqueUsernames = [...new Set(
      messages
        .filter(m => !m.system && m.username && m.username !== username)
        .map(m => m.username)
    )];

    uniqueUsernames.forEach(async (user) => {
      if (!userAdminStatus[user]) {
        await checkUserAdminStatus(user);
      }
    });
  }, [messages, username, userAdminStatus, checkUserAdminStatus]);

  return {
    // 상태
    messages,
    input,
    messagesEndRef,
    userAdminStatus,
    
    // 함수
    setInput,
    setMessages,
    setUserAdminStatus,
    handleSend,
    addReaction,
    clearChat,
    addMessage,
    scrollToBottom
  };
};
