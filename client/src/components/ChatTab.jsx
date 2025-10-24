import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Trash2, LogOut, User, Clock, ThumbsUp, Heart, Send, Lock, Unlock } from 'lucide-react';
import axios from 'axios';

const ChatTab = ({
  // Props from App.jsx
  messages,
  setMessages,
  input,
  setInput,
  username,
  setUsername,
  setInventory,
  setMaterials,
  setMyCatches,
  setUserMoney,
  setIdToken,
  setUsernameInput,
  setActiveTab,
  setUserUuid,
  isGuest,
  setIsGuest,
  isDarkMode,
  isAdmin,
  userAdminStatus,
  fishingCooldown,
  userProfileImages,
  loadProfileImage,
  setFishingCooldown,
  isProcessingFishing,
  setIsProcessingFishing,
  serverUrl,
  idToken,
  userUuid,
  getSocket,
  updateQuestProgress,
  formatCooldown,
  openIPManager,
  fetchOtherUserProfile,
  setSelectedUserProfile,
  setShowProfile,
  secureToggleAdminRights,
  toggleAdminRights,
  cooldownLoaded,
  setCooldownLoaded,
  grantAchievement,
  revokeAchievement,
  refreshFishingSkill,
  authenticatedRequest,
  alchemyPotions,
  setAlchemyPotions,
  handleExpeditionInviteClick,
  setShowClickerModal
}) => {
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  
  // 스크롤 고정 상태 (localStorage에 저장하여 탭 전환 시에도 유지)
  const [isScrollLocked, setIsScrollLocked] = useState(() => {
    const saved = localStorage.getItem('chatScrollLocked');
    return saved === 'true';
  });
  
  // 전투로그 팝업 상태
  const [showBattleDetails, setShowBattleDetails] = useState(false);
  const [selectedBattleData, setSelectedBattleData] = useState(null);

  // 전투로그 클릭 핸들러
  const handleBattleLogClick = (battleDetails) => {
    setSelectedBattleData(battleDetails);
    setShowBattleDetails(true);
  };

  // 채팅 메시지 전송 함수
  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    
    // 메시지 길이 제한 (트래픽 과부하 방지)
    const MAX_MESSAGE_LENGTH = 500;
    if (text.length > MAX_MESSAGE_LENGTH) {
      alert(`메시지는 ${MAX_MESSAGE_LENGTH}자 이하로 입력해 주세요. (현재: ${text.length}자)`);
      return;
    }
    
    // 🎮 에테르 던전 명령어 체크
    if (text === "에테르 던전") {
      setShowClickerModal(true);
      setInput("");
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
    
    // 🏆 업적 부여 명령어 (/grant_achievement <사용자명> <업적ID>)
    if (text.startsWith('/grant_achievement ')) {
      if (!isAdmin) {
        alert('⚠️ 관리자 권한이 필요합니다.');
        setInput("");
        return;
      }
      
      const parts = text.split(' ');
      if (parts.length !== 3) {
        alert('❌ 사용법: /grant_achievement <사용자명> <업적ID>\n\n업적 ID:\n- fox_location: 여우가 어디사는지 아니?\n- fox_gamble: 여우는 겜블을 좋아해\n- fish_collector: 너를 위해 준비했어 (물고기 1000마리)');
        setInput("");
        return;
      }
      
      const targetUsername = parts[1];
      const achievementId = parts[2];
      
      // 유효한 업적 ID 체크
      const validAchievements = ['fox_location', 'fox_gamble', 'fish_collector'];
      if (!validAchievements.includes(achievementId)) {
        alert('❌ 잘못된 업적 ID입니다.\n\n사용 가능한 업적 ID:\n- fox_location: 여우가 어디사는지 아니?\n- fox_gamble: 여우는 겜블을 좋아해\n- fish_collector: 너를 위해 준비했어 (물고기 1000마리)');
        setInput("");
        return;
      }
      
      try {
        await grantAchievement(targetUsername, achievementId, refreshFishingSkill);
        alert(`✅ 업적이 '${targetUsername}'에게 부여되었습니다.`);
      } catch (error) {
        alert(`❌ 업적 부여 실패: ${error.message}`);
      }
      setInput("");
      return;
    }
    
    // 🏆 업적 해제 명령어 (/revoke_achievement <사용자명> <업적ID>)
    if (text.startsWith('/revoke_achievement ')) {
      if (!isAdmin) {
        alert('⚠️ 관리자 권한이 필요합니다.');
        setInput("");
        return;
      }
      
      const parts = text.split(' ');
      if (parts.length !== 3) {
        alert('❌ 사용법: /revoke_achievement <사용자명> <업적ID>\n\n업적 ID:\n- fox_location: 여우가 어디사는지 아니?\n- fox_gamble: 여우는 겜블을 좋아해\n- fish_collector: 너를 위해 준비했어 (물고기 1000마리)');
        setInput("");
        return;
      }
      
      const targetUsername = parts[1];
      const achievementId = parts[2];
      
      // 유효한 업적 ID 체크
      const validAchievements = ['fox_location', 'fox_gamble', 'fish_collector'];
      if (!validAchievements.includes(achievementId)) {
        alert('❌ 잘못된 업적 ID입니다.\n\n사용 가능한 업적 ID:\n- fox_location: 여우가 어디사는지 아니?\n- fox_gamble: 여우는 겜블을 좋아해\n- fish_collector: 너를 위해 준비했어 (물고기 1000마리)');
        setInput("");
        return;
      }
      
      // 확인 메시지
      const confirmMessage = `정말로 '${targetUsername}' 사용자의 업적을 해제하시겠습니까?\n\n업적: ${achievementId}\n\n이 작업은 되돌릴 수 없습니다.`;
      if (!confirm(confirmMessage)) {
        setInput("");
        return;
      }
      
      try {
        await revokeAchievement(targetUsername, achievementId, refreshFishingSkill);
        alert(`✅ 업적이 '${targetUsername}'에게서 해제되었습니다.`);
      } catch (error) {
        alert(`❌ 업적 해제 실패: ${error.message}`);
      }
      setInput("");
      return;
    }
    
    // 낚시하기 명령어 체크 및 쿨타임 적용
    if (text === "낚시하기") {
      // 🛡️ 1. 처리 중 상태 확인 (중복 방지)
      if (isProcessingFishing) {
        console.log("이미 낚시 처리 중입니다.");
        return;
      }
      
      // 🛡️ 2. 쿨타임 확인 (게스트는 쿨타임 로드 대기 생략)
      if (!isGuest && !cooldownLoaded) {
        alert("쿨타임 정보를 로딩 중입니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      
      if (fishingCooldown > 0) {
        alert(`낚시하기 쿨타임이 ${formatCooldown(fishingCooldown)} 남았습니다!`);
        return;
      }
      
      // 🛡️ 3. 처리 중 상태 설정
      setIsProcessingFishing(true);
      
      // 서버에 낚시 쿨타임 설정 (게스트 포함)
      try {
        const params = { username, userUuid };
        const response = await authenticatedRequest.post(`${serverUrl}/api/set-fishing-cooldown`, {}, { params });
        
        // 🚀 서버에서 계산된 쿨타임으로 클라이언트 설정
        const serverCooldownTime = response.data.remainingTime || 0;
        setFishingCooldown(serverCooldownTime);
        setCooldownLoaded(true); // 쿨타임 로드 완료 상태 설정
        
        // localStorage에 쿨타임 종료 시간 저장
        if (serverCooldownTime > 0) {
          const fishingEndTime = new Date(Date.now() + serverCooldownTime);
          localStorage.setItem('fishingCooldownEnd', fishingEndTime.toISOString());
        } else {
          localStorage.removeItem('fishingCooldownEnd');
        }
        
        console.log(`Fishing cooldown set: ${serverCooldownTime}ms`);
      } catch (error) {
        console.error('Failed to set fishing cooldown:', error);
        // 서버 설정 실패 시 기본 쿨타임 설정 (5분)
        const fallbackCooldownTime = 5 * 60 * 1000; // 5분
        setFishingCooldown(fallbackCooldownTime);
        setCooldownLoaded(true); // 에러 시에도 로드 완료 상태 설정
        
        // localStorage에 쿨타임 종료 시간 저장
        const fishingEndTime = new Date(Date.now() + fallbackCooldownTime);
        localStorage.setItem('fishingCooldownEnd', fishingEndTime.toISOString());
      } finally {
        // 🛡️ 4. 처리 완료 후 상태 해제 (1초 후)
        setTimeout(() => {
          setIsProcessingFishing(false);
        }, 1000);
      }
      
      // 낚시하기는 소켓으로 메시지를 전송 (서버에서 물고기 처리)
      const socket = getSocket();
      const payload = { 
        username, 
        content: text, 
        timestamp: new Date().toISOString(),
        userUuid: localStorage.getItem('userUuid')
      };
      socket.emit("chat:message", payload);
      setInput("");
      return;
    }
    
    const socket = getSocket();
    const payload = { 
      username, 
      content: text, 
      timestamp: new Date().toISOString(),
      userUuid: localStorage.getItem('userUuid') // 📸 프로필 이미지용 userUuid 추가
    };
    socket.emit("chat:message", payload);
    setInput("");
  };

  // 메시지 반응 추가 함수 (하나의 반응만 가능)
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
    
    socket.emit("message:reaction", {
      messageId,
      messageIndex,
      reactionType,
      currentReaction
    });
  };


  // 메시지 스크롤 자동 이동 (스크롤 고정 상태가 아닐 때만)
  // 📱 모바일 스크롤 최적화: scrollIntoView 대신 scrollTop 직접 조작
  useEffect(() => {
    if (!isScrollLocked && messagesContainerRef.current) {
      // 컨테이너 내부에서만 스크롤 (페이지 전체 스크롤 방지)
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages.length, isScrollLocked]);

  return (
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
              {/* 스크롤 고정 버튼 */}
              <button
                className={`p-2 rounded-lg hover:glow-effect transition-all duration-300 ${
                  isScrollLocked 
                    ? (isDarkMode ? "glass-input text-yellow-400" : "bg-yellow-50/80 backdrop-blur-sm border border-yellow-400/60 text-yellow-600")
                    : (isDarkMode ? "glass-input text-gray-400" : "bg-white/60 backdrop-blur-sm border border-gray-300/40 text-gray-600")
                }`}
                onClick={() => {
                  const newLockState = !isScrollLocked;
                  setIsScrollLocked(newLockState);
                  localStorage.setItem('chatScrollLocked', String(newLockState));
                }}
                title={isScrollLocked ? "스크롤 고정 해제" : "스크롤 고정"}
              >
                {isScrollLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              </button>
              
              {/* 채팅 클리어 버튼 */}
              <button
                className={`p-2 rounded-lg hover:glow-effect transition-all duration-300 text-blue-400 ${
                  isDarkMode ? "glass-input" : "bg-white/60 backdrop-blur-sm border border-gray-300/40"
                }`}
                onClick={() => {
                  if (confirm("채팅창을 클리어하시겠습니까?")) {
                    setMessages([]);
                  }
                }}
                title="채팅창 클리어"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              
              {/* 관리자 버튼 (관리자만 보임) */}
              {isAdmin && (
                <button
                  className={`p-2 rounded-lg hover:glow-effect transition-all duration-300 text-orange-400 ${
                    isDarkMode ? "glass-input" : "bg-white/60 backdrop-blur-sm border border-gray-300/40"
                  }`}
                  onClick={openIPManager}
                  title="IP 차단 관리"
                >
                  🛡️
                </button>
              )}
              
              {/* 연금술포션 사용 버튼 */}
              <button
                className={`p-2 rounded-lg hover:glow-effect transition-all duration-300 text-green-400 ${
                  isDarkMode ? "glass-input" : "bg-white/60 backdrop-blur-sm border border-gray-300/40"
                }`}
                onClick={async () => {
                  try {
                    const response = await authenticatedRequest.post(`${serverUrl}/api/use-alchemy-potion`);
                    
                    if (response.data.success) {
                      // 쿨타임 업데이트
                      setFishingCooldown(response.data.newCooldown);
                      
                      // localStorage에 쿨타임 종료 시간 저장
                      const fishingEndTime = new Date(Date.now() + response.data.newCooldown);
                      localStorage.setItem('fishingCooldownEnd', fishingEndTime.toISOString());
                      
                      // 연금술포션 개수 업데이트
                      setAlchemyPotions(response.data.remainingPotions);
                      
                      // 성공 메시지 (세션 유지)
                      setMessages(prev => [...prev, {
                        system: true,
                        content: `🧪 연금술포션을 사용했습니다! 낚시 쿨타임이 10초로 감소했습니다. (남은 포션: ${response.data.remainingPotions}개)`,
                        timestamp: new Date().toISOString()
                      }]);
                    }
                  } catch (error) {
                    console.error('연금술포션 사용 실패:', error);
                    alert(error.response?.data?.error || '연금술포션 사용에 실패했습니다.');
                  }
                }}
                title="연금술포션 사용 (낚시 쿨타임 10초로 감소)"
              >
                🧪
              </button>
              
              {/* 로그아웃 버튼 */}
              <button
                className={`p-2 rounded-lg hover:glow-effect transition-all duration-300 text-red-400 ${
                  isDarkMode ? "glass-input" : "bg-white/60 backdrop-blur-sm border border-gray-300/40"
                }`}
                onClick={() => {
                  if (confirm("로그아웃 하시겠습니까?")) {
                    // 로그아웃 시 최소한의 정보만 제거 (구글 ID는 유지)
                    localStorage.removeItem("nickname");
                    localStorage.removeItem("idToken");
                    localStorage.removeItem("userUuid");
                    localStorage.removeItem("isGuest"); // 게스트 상태도 제거
                    // googleId와 darkMode는 유지
                    
                    // 상태 초기화
                    setUsername("");
                    setMessages([]);
                    setInventory([]);
                    setMaterials([]);
                    setMyCatches(0);
                    setUserMoney(0);
                    setIdToken(undefined);
                    setUsernameInput("");
                    setActiveTab("chat");
                    setUserUuid(null);
                    setIsGuest(false); // 게스트 상태 초기화
                    setFishingCooldown(0); // 쿨타임 초기화
                    setCooldownLoaded(false); // 쿨타임 로드 상태 초기화
                  }
                }}
                title="로그아웃"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        
        {/* 쿠폰 안내 메시지 */}
        {input === "여우와 함께 하는 낚시게임" && (
          <div className={`mx-4 mt-4 p-3 rounded-lg border-2 border-dashed ${
            isDarkMode 
              ? "border-yellow-400/50 bg-yellow-400/10" 
              : "border-yellow-500/50 bg-yellow-500/10"
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎁</span>
              <div>
                <p className={`text-sm font-semibold ${
                  isDarkMode ? "text-yellow-300" : "text-yellow-700"
                }`}>
                  쿠폰 코드가 감지되었습니다!
                </p>
                <p className={`text-xs ${
                  isDarkMode ? "text-yellow-400/80" : "text-yellow-600/80"
                }`}>
                  전송하면 별조각 3개를 받을 수 있습니다. (소셜 로그인 필요, 계정당 1회)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 채팅 메시지 영역 */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[50vh]" style={{ overscrollBehavior: 'contain' }}>
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
              ) : m.isBattleLog ? (
                // 전투 로그 특별 스타일링 (클릭 가능, 작은 크기)
                <div className="my-2">
                  <div 
                    className={`p-3 rounded-lg border cursor-pointer transition-all duration-300 hover:scale-[1.01] hover:shadow-md ${
                      isDarkMode 
                        ? "bg-gradient-to-r from-purple-900/20 to-blue-900/20 border-purple-500/20 hover:border-purple-400/40" 
                        : "bg-gradient-to-r from-purple-50/60 to-blue-50/60 border-purple-300/40 hover:border-purple-400/60"
                    } backdrop-blur-sm`}
                    onClick={() => handleBattleLogClick(m.battleDetails)}
                    title="클릭하여 상세 정보 보기"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                        isDarkMode ? "bg-purple-500/15" : "bg-purple-500/8"
                      }`}>
                        <span className="text-sm">⚔️</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium text-sm ${
                            isDarkMode ? "text-purple-300" : "text-purple-700"
                          }`}>
                            {m.username}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            isDarkMode 
                              ? "bg-purple-500/15 text-purple-400" 
                              : "bg-purple-500/8 text-purple-600"
                          }`}>
                            전투 결과
                          </span>
                          <span className={`text-[10px] ${
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
                        <div className={`text-sm mt-1 ${
                          isDarkMode ? "text-gray-300" : "text-gray-700"
                        }`}>
                          {m.content}
                        </div>
                        <div className={`text-xs mt-1 ${
                          isDarkMode ? "text-purple-400/70" : "text-purple-600/70"
                        }`}>
                          💡 상세 정보 보기
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : m.expeditionInvite ? (
                // 🎣 원정 초대 메시지 특별 스타일링
                <div className="my-2">
                  <div 
                    className={`p-3 rounded-lg border cursor-pointer transition-all duration-300 hover:scale-[1.01] hover:shadow-md ${
                      isDarkMode 
                        ? "bg-gradient-to-r from-teal-900/20 to-cyan-900/20 border-teal-500/20 hover:border-teal-400/40" 
                        : "bg-gradient-to-r from-teal-50/60 to-cyan-50/60 border-teal-300/40 hover:border-teal-400/60"
                    } backdrop-blur-sm`}
                    onClick={() => handleExpeditionInviteClick(m.expeditionInvite.roomId, m.expeditionInvite.areaName)}
                    title="클릭하여 원정 참가하기"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                        isDarkMode ? "bg-teal-500/15" : "bg-teal-500/8"
                      }`}>
                        <span className="text-sm">🗺️</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium text-sm ${
                            isDarkMode ? "text-teal-300" : "text-teal-700"
                          }`}>
                            {m.username}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            isDarkMode 
                              ? "bg-teal-500/15 text-teal-400" 
                              : "bg-teal-500/8 text-teal-600"
                          }`}>
                            원정 초대
                          </span>
                          <span className={`text-[10px] ${
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
                        <div className={`text-sm mt-1 ${
                          isDarkMode ? "text-gray-300" : "text-gray-700"
                        }`}>
                          {m.content}
                        </div>
                        <div className={`text-xs mt-1 font-medium ${
                          isDarkMode ? "text-teal-400/70" : "text-teal-600/70"
                        }`}>
                          💡 클릭하여 참가하기
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  {/* 📸 프로필 이미지 또는 기본 아이콘 */}
                  {userProfileImages[m.userUuid] ? (
                    <img 
                      src={userProfileImages[m.userUuid]} 
                      alt={m.username}
                      className={`w-8 h-8 rounded-full object-cover border cursor-pointer hover:scale-110 transition-all duration-300 ${
                        isDarkMode ? "border-white/10 hover:border-blue-400/50" : "border-gray-300/20 hover:border-blue-500/50"
                      }`}
                      onClick={async () => {
                        setSelectedUserProfile({ username: m.username });
                        await fetchOtherUserProfile(m.username);
                        setShowProfile(true);
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                      title={`${m.username}님의 프로필 보기`}
                    />
                  ) : (
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
                  )}
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
                    {/* 메시지 말풍선 - 인스타그램 스타일 반응 UI 통합 */}
                    <div className="relative inline-block group">
                      <div className={`px-4 py-2 rounded-xl max-w-fit ${
                        isDarkMode ? "glass-input" : "bg-white/60 backdrop-blur-sm border border-gray-300/40"
                      }`}>
                        <span className={`text-sm ${
                          isDarkMode ? "text-gray-200" : "text-gray-700"
                        }`}>{m.content}</span>
                      </div>
                      
                      {/* 반응 버튼들 (호버 시 표시, 모바일 최적화) */}
                      <div className="absolute -bottom-6 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                          onClick={() => addReaction(i, 'thumbsup')}
                          className={`p-1.5 rounded-full backdrop-blur-sm border touch-manipulation ${
                            m.reactions?.thumbsup?.includes(username)
                              ? "bg-blue-500/20 border-blue-400/50 text-blue-500 shadow-lg shadow-blue-500/25" 
                              : isDarkMode 
                                ? "bg-gray-800/80 border-gray-600/50 text-gray-400" 
                                : "bg-white/80 border-gray-300/50 text-gray-500"
                          }`}
                          title="좋아요"
                        >
                          <ThumbsUp className={`w-3 h-3 ${
                            m.reactions?.thumbsup?.includes(username) ? "fill-current" : ""
                          }`} />
                        </button>
                        <button
                          onClick={() => addReaction(i, 'heart')}
                          className={`p-1.5 rounded-full backdrop-blur-sm border touch-manipulation ${
                            m.reactions?.heart?.includes(username)
                              ? "bg-red-500/20 border-red-400/50 text-red-500 shadow-lg shadow-red-500/25" 
                              : isDarkMode 
                                ? "bg-gray-800/80 border-gray-600/50 text-gray-400" 
                                : "bg-white/80 border-gray-300/50 text-gray-500"
                          }`}
                          title="하트"
                        >
                          <Heart className={`w-3 h-3 ${
                            m.reactions?.heart?.includes(username) ? "fill-current" : ""
                          }`} />
                        </button>
                      </div>
                      
                      {/* 반응 카운트 표시 (모바일 최적화) */}
                      {m.reactions && Object.keys(m.reactions).length > 0 && (
                        <div className="absolute -bottom-2 -right-1 flex gap-0.5 z-10">
                          {['thumbsup', 'heart'].filter(type => m.reactions[type]).map((reactionType) => (
                            <div
                              key={reactionType}
                              className={`flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full text-[10px] font-medium border-2 cursor-pointer touch-manipulation ${
                                reactionType === 'heart'
                                  ? isDarkMode
                                    ? "bg-red-500 text-white border-gray-800 shadow-lg shadow-red-500/30"
                                    : "bg-red-500 text-white border-white shadow-lg shadow-red-500/30"
                                  : isDarkMode
                                    ? "bg-blue-500 text-white border-gray-800 shadow-lg shadow-blue-500/30"
                                    : "bg-blue-500 text-white border-white shadow-lg shadow-blue-500/30"
                              }`}
                              title={`${m.reactions[reactionType].join(', ')}님이 ${reactionType === 'heart' ? '하트' : '좋아요'}를 눌렀습니다`}
                              onClick={() => addReaction(i, reactionType)}
                            >
                              {reactionType === 'heart' ? (
                                <Heart className="w-2 h-2 fill-current mr-0.5" />
                              ) : (
                                <ThumbsUp className="w-2 h-2 fill-current mr-0.5" />
                              )}
                              <span>{m.reactions[reactionType].length}</span>
                            </div>
                          ))}
                        </div>
                      )}
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
              } ${input.length > 450 ? 'border-red-400' : ''} ${isProcessingFishing ? 'opacity-50 cursor-not-allowed' : ''} ${
                input === "여우와 함께 하는 낚시게임" 
                  ? (isDarkMode ? 'border-yellow-400 shadow-lg shadow-yellow-400/20' : 'border-yellow-500 shadow-lg shadow-yellow-500/20')
                  : ''
              }`}
              placeholder={isProcessingFishing 
                ? "낚시 처리 중..." 
                : !cooldownLoaded
                  ? "쿨타임 로딩 중..."
                  : fishingCooldown > 0 
                    ? `낚시하기 쿨타임: ${formatCooldown(fishingCooldown)}` 
                    : input === "여우와 함께 하는 낚시게임"
                      ? "🎁 쿠폰 코드 입력됨! 전송하세요!"
                      : "메시지를 입력하세요... (낚시하기)"
              }
              value={input}
              maxLength={500}
              disabled={isProcessingFishing}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isProcessingFishing) handleSend();
              }}
            />
            <button
              className={`px-6 py-3 rounded-xl hover:glow-effect transition-all duration-300 transform hover:scale-105 flex items-center gap-2 ${
                isDarkMode 
                  ? "glass-input text-blue-400" 
                  : "bg-white/60 backdrop-blur-sm border border-gray-300/40 text-blue-600"
              } ${isProcessingFishing ? 'opacity-50 cursor-not-allowed' : ''} ${
                input === "여우와 함께 하는 낚시게임" 
                  ? (isDarkMode ? 'border-yellow-400 text-yellow-400 shadow-lg shadow-yellow-400/20' : 'border-yellow-500 text-yellow-600 shadow-lg shadow-yellow-500/20')
                  : ''
              }`}
              onClick={isProcessingFishing ? undefined : handleSend}
              disabled={isProcessingFishing}
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline font-medium">전송</span>
            </button>
          </div>
          {/* 글자 수 표시 */}
          {input.length > 0 && (
            <div className={`mt-2 text-xs text-right ${
              input.length > 450 
                ? 'text-red-400' 
                : isDarkMode 
                  ? 'text-gray-400' 
                  : 'text-gray-500'
            }`}>
              {input.length}/500
            </div>
          )}
          <div className="mt-3 text-center">
            <p className={`text-xs flex items-center justify-center gap-2 ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}>
            {isProcessingFishing ? (
              <>
                <span className="animate-spin">⚙️</span>
                낚시 처리 중...
              </>
            ) : !cooldownLoaded ? (
              <>
                <span className="animate-spin">⏳</span>
                쿨타임 로딩 중...
              </>
            ) : fishingCooldown > 0 ? (
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

      {/* 전투로그 상세 정보 팝업 */}
      {showBattleDetails && selectedBattleData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`max-w-2xl w-full max-h-[80vh] overflow-y-auto rounded-2xl border-2 ${
            isDarkMode 
              ? "bg-gray-900/95 border-purple-500/30" 
              : "bg-white/95 border-purple-300/50"
          } backdrop-blur-md`}>
            {/* 헤더 */}
            <div className={`sticky top-0 p-6 border-b ${
              isDarkMode ? "border-white/10 bg-gray-900/95" : "border-gray-300/20 bg-white/95"
            } backdrop-blur-md`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⚔️</span>
                  <div>
                    <h3 className={`text-xl font-bold ${
                      isDarkMode ? "text-purple-300" : "text-purple-700"
                    }`}>
                      {selectedBattleData.username}님의 전투 기록
                    </h3>
                    <p className={`text-sm ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}>
                      {selectedBattleData.enemy}와의 전투
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowBattleDetails(false)}
                  className={`p-2 rounded-lg transition-colors ${
                    isDarkMode 
                      ? "hover:bg-white/10 text-gray-400 hover:text-white" 
                      : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"
                  }`}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* 내용 */}
            <div className="p-6 space-y-6">
              {/* 전투 결과 */}
              <div className={`p-4 rounded-xl ${
                selectedBattleData.result === '승리' 
                  ? (isDarkMode ? "bg-green-900/30 border border-green-500/30" : "bg-green-50/80 border border-green-300/50")
                  : selectedBattleData.result === '패배'
                  ? (isDarkMode ? "bg-red-900/30 border border-red-500/30" : "bg-red-50/80 border border-red-300/50")
                  : (isDarkMode ? "bg-yellow-900/30 border border-yellow-500/30" : "bg-yellow-50/80 border border-yellow-300/50")
              }`}>
                <div className="text-center">
                  <div className="text-4xl mb-2">
                    {selectedBattleData.result === '승리' ? '🏆' : selectedBattleData.result === '패배' ? '💀' : '🏃'}
                  </div>
                  <h4 className={`text-2xl font-bold ${
                    selectedBattleData.result === '승리' 
                      ? (isDarkMode ? "text-green-300" : "text-green-700")
                      : selectedBattleData.result === '패배'
                      ? (isDarkMode ? "text-red-300" : "text-red-700")
                      : (isDarkMode ? "text-yellow-300" : "text-yellow-700")
                  }`}>
                    {selectedBattleData.result}!
                  </h4>
                  {selectedBattleData.result === '승리' && selectedBattleData.amberReward > 0 && (
                    <p className={`text-lg mt-2 ${
                      isDarkMode ? "text-yellow-300" : "text-yellow-600"
                    }`}>
                      🟡 호박석 {selectedBattleData.amberReward}개 획득
                    </p>
                  )}
                </div>
              </div>

              {/* 전투 정보 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-4 rounded-xl ${
                  isDarkMode ? "bg-gray-800/50" : "bg-gray-50/80"
                }`}>
                  <h5 className={`font-bold mb-3 ${
                    isDarkMode ? "text-blue-300" : "text-blue-700"
                  }`}>
                    ⚔️ 전투 정보
                  </h5>
                  <div className="space-y-2 text-sm">
                    <div>🎯 상대: {selectedBattleData.enemy}</div>
                    <div>❤️ 플레이어 체력: {selectedBattleData.playerHp}/{selectedBattleData.playerMaxHp}</div>
                  </div>
                </div>

                {selectedBattleData.companions && selectedBattleData.companions.length > 0 && (
                  <div className={`p-4 rounded-xl ${
                    isDarkMode ? "bg-gray-800/50" : "bg-gray-50/80"
                  }`}>
                    <h5 className={`font-bold mb-3 ${
                      isDarkMode ? "text-green-300" : "text-green-700"
                    }`}>
                      👥 참여 동료
                    </h5>
                    <div className="space-y-2 text-sm">
                      {selectedBattleData.companions.map(companion => {
                        const companionHp = selectedBattleData.companionHp[companion];
                        if (companionHp) {
                          const hpPercent = Math.round((companionHp.hp / companionHp.maxHp) * 100);
                          const status = companionHp.hp <= 0 ? '💀' : hpPercent < 30 ? '🔴' : hpPercent < 70 ? '🟡' : '🟢';
                          return (
                            <div key={companion}>
                              {status} {companion}: {companionHp.hp}/{companionHp.maxHp} ({hpPercent}%)
                            </div>
                          );
                        }
                        return <div key={companion}>{companion}</div>;
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 전투 로그 */}
              {selectedBattleData.log && selectedBattleData.log.length > 0 && (
                <div className={`p-4 rounded-xl ${
                  isDarkMode ? "bg-gray-800/30" : "bg-gray-50/50"
                }`}>
                  <h5 className={`font-bold mb-3 ${
                    isDarkMode ? "text-orange-300" : "text-orange-700"
                  }`}>
                    📜 전투 로그
                  </h5>
                  <div className={`max-h-60 overflow-y-auto space-y-1 text-sm ${
                    isDarkMode ? "text-gray-300" : "text-gray-700"
                  }`}>
                    {selectedBattleData.log.map((logEntry, index) => (
                      <div key={index} className="leading-relaxed">
                        {logEntry}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatTab;