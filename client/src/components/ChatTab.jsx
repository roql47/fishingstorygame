import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Trash2, LogOut, User, Clock, ThumbsUp, Heart, Send } from 'lucide-react';
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
  setIsGuest,
  isDarkMode,
  isAdmin,
  userAdminStatus,
  fishingCooldown,
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
  toggleAdminRights
}) => {
  const messagesEndRef = useRef(null);

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
    
    // 낚시하기 명령어 체크 및 쿨타임 적용
    if (text === "낚시하기") {
      // 🛡️ 1. 처리 중 상태 확인 (중복 방지)
      if (isProcessingFishing) {
        console.log("이미 낚시 처리 중입니다.");
        return;
      }
      
      // 🛡️ 2. 쿨타임 확인
      if (fishingCooldown > 0) {
        alert(`낚시하기 쿨타임이 ${formatCooldown(fishingCooldown)} 남았습니다!`);
        return;
      }
      
      // 🛡️ 3. 처리 중 상태 설정
      setIsProcessingFishing(true);
      
      // 서버에 낚시 쿨타임 설정 (서버에서 쿨타임 계산) - 모든 사용자 접근 가능
      try {
        const params = { username, userUuid };
        const response = await axios.post(`${serverUrl}/api/set-fishing-cooldown`, {}, { params });
        
        // 🚀 서버에서 계산된 쿨타임으로 클라이언트 설정 (중복 저장 제거)
        const serverCooldownTime = response.data.remainingTime || 0;
        setFishingCooldown(serverCooldownTime);
        
        // 서버에서 이미 저장했으므로 중복 저장 제거
        
        console.log(`Fishing cooldown set: ${serverCooldownTime}ms`);
      } catch (error) {
        console.error('Failed to set fishing cooldown:', error);
        // 서버 설정 실패 시 기본 쿨타임 설정 (5분)
        const fallbackCooldownTime = 5 * 60 * 1000; // 5분
        setFishingCooldown(fallbackCooldownTime);
      } finally {
        // 🛡️ 4. 처리 완료 후 상태 해제 (1초 후)
        setTimeout(() => {
          setIsProcessingFishing(false);
        }, 1000);
      }
    }
    
    const socket = getSocket();
    const payload = { username, content: text, timestamp: new Date().toISOString() };
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


  // 메시지 스크롤 자동 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

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
                    // 🛡️ [FIX] 쿨타임은 서버에서 관리하므로 클라이언트에서 초기화하지 않음
                    // setFishingCooldown(0); // 제거됨
                    // setExplorationCooldown(0); // 제거됨
                  }
                }}
                title="로그아웃"
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
                    {/* 메시지 말풍선 - 인스타그램 스타일 반응 UI 통합 */}
                    <div className="relative inline-block group">
                      <div className={`px-4 py-2 rounded-xl max-w-fit ${
                        isDarkMode ? "glass-input" : "bg-white/60 backdrop-blur-sm border border-gray-300/40"
                      }`}>
                        <span className={`text-sm ${
                          isDarkMode ? "text-gray-200" : "text-gray-700"
                        }`}>{m.content}</span>
                      </div>
                      
                      {/* 반응 버튼들 (호버 시 표시) */}
                      <div className="absolute -bottom-6 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-y-2 group-hover:translate-y-0">
                        <button
                          onClick={() => addReaction(i, 'thumbsup')}
                          className={`p-1.5 rounded-full backdrop-blur-sm border transition-all duration-200 hover:scale-110 ${
                            m.reactions?.thumbsup?.includes(username)
                              ? "bg-blue-500/20 border-blue-400/50 text-blue-500 shadow-lg shadow-blue-500/25" 
                              : isDarkMode 
                                ? "bg-gray-800/80 border-gray-600/50 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 hover:border-blue-400/30" 
                                : "bg-white/80 border-gray-300/50 text-gray-500 hover:text-blue-500 hover:bg-blue-50/80 hover:border-blue-300/50"
                          }`}
                          title="좋아요"
                        >
                          <ThumbsUp className={`w-3 h-3 ${
                            m.reactions?.thumbsup?.includes(username) ? "fill-current" : ""
                          }`} />
                        </button>
                        <button
                          onClick={() => addReaction(i, 'heart')}
                          className={`p-1.5 rounded-full backdrop-blur-sm border transition-all duration-200 hover:scale-110 ${
                            m.reactions?.heart?.includes(username)
                              ? "bg-red-500/20 border-red-400/50 text-red-500 shadow-lg shadow-red-500/25" 
                              : isDarkMode 
                                ? "bg-gray-800/80 border-gray-600/50 text-gray-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-400/30" 
                                : "bg-white/80 border-gray-300/50 text-gray-500 hover:text-red-500 hover:bg-red-50/80 hover:border-red-300/50"
                          }`}
                          title="하트"
                        >
                          <Heart className={`w-3 h-3 ${
                            m.reactions?.heart?.includes(username) ? "fill-current" : ""
                          }`} />
                        </button>
                      </div>
                      
                      {/* 반응 카운트 표시 (인스타그램 스타일 - 말풍선 오른쪽 하단 모서리) */}
                      {m.reactions && Object.keys(m.reactions).length > 0 && (
                        <div className="absolute -bottom-2 -right-1 flex gap-0.5 z-10">
                          {['thumbsup', 'heart'].filter(type => m.reactions[type]).map((reactionType) => (
                            <div
                              key={reactionType}
                              className={`flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full text-[10px] font-medium border-2 transition-all duration-200 hover:scale-110 cursor-pointer ${
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
              } ${input.length > 450 ? 'border-red-400' : ''} ${isProcessingFishing ? 'opacity-50 cursor-not-allowed' : ''}`}
              placeholder={isProcessingFishing 
                ? "낚시 처리 중..." 
                : fishingCooldown > 0 
                  ? `낚시하기 쿨타임: ${formatCooldown(fishingCooldown)}` 
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
              } ${isProcessingFishing ? 'opacity-50 cursor-not-allowed' : ''}`}
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
    </div>
  );
};

export default ChatTab;