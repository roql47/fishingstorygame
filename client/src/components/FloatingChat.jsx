import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, User, Gamepad2 } from 'lucide-react';

const FloatingChat = ({
  messages,
  input,
  setInput,
  username,
  isDarkMode,
  userProfileImages,
  loadProfileImage,
  getSocket,
  isGuest,
  fetchOtherUserProfile,
  setSelectedUserProfile,
  setShowProfile,
  serverUrl,
  setShowClickerModal
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const prevMessagesLengthRef = useRef(messages.length);

  // 메시지 추가 시 읽지 않음 카운트 증가 (창이 닫혀있을 때만)
  useEffect(() => {
    if (!isOpen && messages.length > prevMessagesLengthRef.current) {
      const newMessageCount = messages.length - prevMessagesLengthRef.current;
      setUnreadCount(prev => prev + newMessageCount);
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages.length, isOpen]);

  // 채팅창 열면 읽지 않음 초기화
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  // 자동 스크롤
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // 메시지 전송
  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;

    const MAX_MESSAGE_LENGTH = 500;
    if (text.length > MAX_MESSAGE_LENGTH) {
      alert(`메시지는 ${MAX_MESSAGE_LENGTH}자 이하로 입력해 주세요.`);
      return;
    }

    const socket = getSocket();
    if (!socket) {
      console.error("소켓 연결이 없습니다.");
      return;
    }

    socket.emit("chat:message", {
      username: username,
      content: text,
      timestamp: new Date().toISOString()
    });

    setInput("");
  };

  // Enter 키로 전송
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 사용자 프로필 클릭
  const handleUsernameClick = async (clickedUsername) => {
    if (clickedUsername === username) return;
    const profile = await fetchOtherUserProfile(clickedUsername);
    if (profile) {
      setSelectedUserProfile(profile);
      setShowProfile(true);
    }
  };

  // 메시지 렌더링
  const renderMessage = (msg, idx) => {
    const isOwnMessage = msg.username === username;
    const isSystemMessage = msg.username === "시스템" || msg.username === "System";
    const isBattleLog = msg.type === 'battle_log';

    return (
      <div
        key={idx}
        className={`flex gap-2 p-2 rounded-lg transition-all ${
          isOwnMessage
            ? isDarkMode
              ? "bg-blue-900/20"
              : "bg-blue-50"
            : ""
        }`}
      >
        {/* 프로필 이미지 */}
        {!isSystemMessage && (
          <div className="flex-shrink-0">
            {userProfileImages[msg.userUuid] ? (
              <img
                src={userProfileImages[msg.userUuid]}
                alt={msg.username}
                className="w-8 h-8 rounded-full object-cover cursor-pointer hover:ring-2 hover:ring-blue-400"
                onClick={() => handleUsernameClick(msg.username)}
                onError={(e) => {
                  e.target.style.display = 'none';
                  if (msg.userUuid) {
                    loadProfileImage(msg.userUuid);
                  }
                }}
              />
            ) : (
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer ${
                  isDarkMode ? "bg-gray-700" : "bg-gray-300"
                }`}
                onClick={() => handleUsernameClick(msg.username)}
              >
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        )}

        {/* 메시지 내용 */}
        <div className="flex-1 min-w-0">
          {!isSystemMessage && (
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`font-semibold text-sm cursor-pointer hover:underline ${
                  isOwnMessage
                    ? isDarkMode
                      ? "text-blue-400"
                      : "text-blue-600"
                    : isDarkMode
                      ? "text-gray-300"
                      : "text-gray-700"
                }`}
                onClick={() => handleUsernameClick(msg.username)}
              >
                {msg.username}
              </span>
              <span className={`text-xs ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
                {new Date(msg.timestamp).toLocaleTimeString('ko-KR', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          )}

          <div
            className={`text-sm break-words whitespace-pre-wrap ${
              isSystemMessage
                ? isDarkMode
                  ? "text-yellow-400 font-medium"
                  : "text-yellow-600 font-medium"
                : isDarkMode
                  ? "text-gray-200"
                  : "text-gray-800"
            }`}
          >
            {msg.content}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* 플로팅 버튼 */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={`fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-50 transition-all hover:scale-110 ${
            isDarkMode
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "bg-blue-500 hover:bg-blue-600 text-white"
          }`}
        >
          <MessageCircle className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* 플로팅 채팅창 */}
      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 w-80 sm:w-96 h-96 sm:h-[500px] rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden ${
            isDarkMode
              ? "bg-gray-800 border border-gray-700"
              : "bg-white border border-gray-300"
          }`}
        >
          {/* 헤더 */}
          <div
            className={`flex items-center justify-between p-4 border-b ${
              isDarkMode
                ? "bg-gray-900 border-gray-700"
                : "bg-blue-500 border-blue-600"
            }`}
          >
            <div className="flex items-center gap-2">
              <MessageCircle className={`w-5 h-5 ${isDarkMode ? "text-blue-400" : "text-white"}`} />
              <span className={`font-semibold ${isDarkMode ? "text-white" : "text-white"}`}>
                채팅
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* 에테르 던전 버튼 */}
              <button
                onClick={() => {
                  setShowClickerModal(true);
                  setInput("");
                }}
                className={`p-1.5 rounded-lg transition-all hover:scale-110 ${
                  isDarkMode
                    ? "hover:bg-gray-700 text-purple-400 hover:text-purple-300"
                    : "hover:bg-blue-600 text-purple-100 hover:text-white"
                }`}
                title="에테르 던전"
              >
                <Gamepad2 className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className={`p-1 rounded-lg transition-colors ${
                  isDarkMode
                    ? "hover:bg-gray-700 text-gray-300"
                    : "hover:bg-blue-600 text-white"
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 메시지 영역 */}
          <div
            ref={messagesContainerRef}
            className={`flex-1 overflow-y-auto p-3 space-y-2 ${
              isDarkMode ? "bg-gray-800" : "bg-gray-50"
            }`}
          >
            {messages.length === 0 ? (
              <div className={`text-center py-8 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
                <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">채팅이 없습니다</p>
              </div>
            ) : (
              messages.map((msg, idx) => renderMessage(msg, idx))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 입력 영역 */}
          {!isGuest && username && (
            <div
              className={`p-3 border-t ${
                isDarkMode
                  ? "bg-gray-900 border-gray-700"
                  : "bg-white border-gray-200"
              }`}
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="메시지를 입력하세요..."
                  maxLength={500}
                  className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${
                    isDarkMode
                      ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500"
                      : "bg-white border-gray-300 text-gray-800 placeholder-gray-400 focus:border-blue-500"
                  } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    !input.trim()
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:scale-105"
                  } ${
                    isDarkMode
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "bg-blue-500 hover:bg-blue-600 text-white"
                  }`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {(isGuest || !username) && (
            <div
              className={`p-3 border-t text-center text-sm ${
                isDarkMode
                  ? "bg-gray-900 border-gray-700 text-gray-400"
                  : "bg-gray-50 border-gray-200 text-gray-600"
              }`}
            >
              채팅을 사용하려면 로그인이 필요합니다
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default FloatingChat;

