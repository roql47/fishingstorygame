import React, { useState, useEffect } from 'react';
import { X, Heart, Coins, Package, TrendingUp, Lock, CheckCircle, Zap } from 'lucide-react';

const RoguelikeModal = ({ 
  isOpen, 
  onClose, 
  gameState, 
  currentEvent, 
  onChoice, 
  onAbandon,
  isDarkMode,
  eventResult 
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [displayedResult, setDisplayedResult] = useState(null);

  // 결과 애니메이션 효과
  useEffect(() => {
    if (eventResult) {
      setShowResult(true);
      setDisplayedResult(eventResult);
      setIsAnimating(true);
      
      const timer = setTimeout(() => {
        setIsAnimating(false);
        setShowResult(false);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [eventResult]);

  if (!isOpen || !gameState) return null;

  const hpPercentage = (gameState.hp / gameState.maxHp) * 100;
  const stageProgress = (gameState.stage / gameState.maxStage) * 100;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`max-w-3xl w-full max-h-[90vh] overflow-y-auto rounded-2xl border-2 ${
        isDarkMode 
          ? "bg-gray-900/95 border-purple-500/30" 
          : "bg-white/95 border-purple-300/50"
      } backdrop-blur-md`}>
        
        {/* 헤더 */}
        <div className={`sticky top-0 p-6 border-b ${
          isDarkMode ? "border-white/10 bg-gray-900/95" : "border-gray-300/20 bg-white/95"
        } backdrop-blur-md z-10`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎮</span>
              <div>
                <h2 className={`text-2xl font-bold ${
                  isDarkMode ? "text-purple-300" : "text-purple-700"
                }`}>
                  로그라이크 던전
                </h2>
                <p className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}>
                  {gameState.username}의 모험
                </p>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode 
                  ? "hover:bg-white/10 text-gray-400 hover:text-white" 
                  : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"
              }`}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* 진행 상황 */}
        <div className="p-6 space-y-4">
          {/* 스테이지 진행도 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}>
                <TrendingUp className="w-4 h-4 inline mr-1" />
                스테이지 {gameState.stage} / {gameState.maxStage}
              </span>
              <span className={`text-xs ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}>
                {Math.round(stageProgress)}%
              </span>
            </div>
            <div className={`w-full h-3 rounded-full overflow-hidden ${
              isDarkMode ? "bg-gray-700" : "bg-gray-200"
            }`}>
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"
                style={{ width: `${stageProgress}%` }}
              />
            </div>
          </div>

          {/* 상태 바 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* HP */}
            <div className={`p-4 rounded-xl ${
              isDarkMode ? "bg-gray-800/50" : "bg-gray-50/80"
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium flex items-center gap-1 ${
                  isDarkMode ? "text-red-400" : "text-red-600"
                }`}>
                  <Heart className="w-4 h-4" />
                  체력
                </span>
                <span className={`text-sm font-bold ${
                  hpPercentage > 50 
                    ? (isDarkMode ? "text-green-400" : "text-green-600")
                    : hpPercentage > 20
                    ? (isDarkMode ? "text-yellow-400" : "text-yellow-600")
                    : (isDarkMode ? "text-red-400" : "text-red-600")
                }`}>
                  {gameState.hp} / {gameState.maxHp}
                </span>
              </div>
              <div className={`w-full h-2 rounded-full overflow-hidden ${
                isDarkMode ? "bg-gray-700" : "bg-gray-200"
              }`}>
                <div 
                  className={`h-full transition-all duration-500 ${
                    hpPercentage > 50 
                      ? "bg-green-500"
                      : hpPercentage > 20
                      ? "bg-yellow-500"
                      : "bg-red-500"
                  }`}
                  style={{ width: `${hpPercentage}%` }}
                />
              </div>
            </div>

            {/* 골드 */}
            <div className={`p-4 rounded-xl ${
              isDarkMode ? "bg-gray-800/50" : "bg-gray-50/80"
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium flex items-center gap-1 ${
                  isDarkMode ? "text-yellow-400" : "text-yellow-600"
                }`}>
                  <Coins className="w-4 h-4" />
                  골드
                </span>
                <span className={`text-lg font-bold ${
                  isDarkMode ? "text-yellow-300" : "text-yellow-700"
                }`}>
                  {gameState.gold}
                </span>
              </div>
            </div>

            {/* 인벤토리 */}
            <div className={`p-4 rounded-xl ${
              isDarkMode ? "bg-gray-800/50" : "bg-gray-50/80"
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium flex items-center gap-1 ${
                  isDarkMode ? "text-blue-400" : "text-blue-600"
                }`}>
                  <Package className="w-4 h-4" />
                  아이템
                </span>
                <span className={`text-lg font-bold ${
                  isDarkMode ? "text-blue-300" : "text-blue-700"
                }`}>
                  {gameState.inventory.length}
                </span>
              </div>
            </div>
          </div>

          {/* 인벤토리 아이템 목록 */}
          {gameState.inventory.length > 0 && (
            <div className={`p-3 rounded-xl ${
              isDarkMode ? "bg-gray-800/30" : "bg-gray-50/50"
            }`}>
              <div className={`text-xs font-medium mb-2 ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}>
                보유 아이템
              </div>
              <div className="flex flex-wrap gap-2">
                {gameState.inventory.map((item, index) => (
                  <div 
                    key={index}
                    className={`px-3 py-1 rounded-full text-xs ${
                      isDarkMode 
                        ? "bg-blue-500/20 text-blue-300 border border-blue-400/30"
                        : "bg-blue-50 text-blue-700 border border-blue-200"
                    }`}
                  >
                    ✨ {item.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 결과 메시지 애니메이션 */}
        {showResult && displayedResult && (
          <div className={`mx-6 mb-4 p-4 rounded-xl border-2 transition-all duration-300 ${
            isAnimating ? "scale-100 opacity-100" : "scale-95 opacity-0"
          } ${
            displayedResult.success
              ? (isDarkMode 
                  ? "bg-green-900/30 border-green-500/50" 
                  : "bg-green-50 border-green-300")
              : (isDarkMode 
                  ? "bg-red-900/30 border-red-500/50" 
                  : "bg-red-50 border-red-300")
          }`}>
            <div className={`font-medium whitespace-pre-line ${
              displayedResult.success
                ? (isDarkMode ? "text-green-300" : "text-green-700")
                : (isDarkMode ? "text-red-300" : "text-red-700")
            }`}>
              {displayedResult.message}
            </div>
          </div>
        )}

        {/* 현재 이벤트 */}
        {currentEvent && (
          <div className="px-6 pb-6">
            <div className={`p-6 rounded-xl border-2 ${
              isDarkMode 
                ? "bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-purple-500/30"
                : "bg-gradient-to-br from-purple-50 to-blue-50 border-purple-300/50"
            }`}>
              {/* 이벤트 제목 */}
              <div className="text-center mb-6">
                <div className="text-5xl mb-3">{currentEvent.emoji}</div>
                <h3 className={`text-2xl font-bold mb-2 ${
                  isDarkMode ? "text-purple-300" : "text-purple-700"
                }`}>
                  {currentEvent.title}
                </h3>
                <p className={`text-sm ${
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                }`}>
                  {currentEvent.description}
                </p>
              </div>

              {/* 선택지 */}
              <div className="space-y-3">
                {currentEvent.choices.map((choice, index) => (
                  <button
                    key={choice.id}
                    onClick={() => onChoice(choice.id, currentEvent)}
                    disabled={choice.disabled}
                    className={`w-full p-4 rounded-xl border-2 transition-all duration-300 ${
                      choice.disabled
                        ? (isDarkMode 
                            ? "bg-gray-800/30 border-gray-700/30 text-gray-600 cursor-not-allowed"
                            : "bg-gray-100/50 border-gray-300/30 text-gray-400 cursor-not-allowed")
                        : (isDarkMode
                            ? "bg-gray-800/50 border-purple-500/30 hover:border-purple-400/50 hover:bg-purple-900/20 text-white"
                            : "bg-white border-purple-300/50 hover:border-purple-400/70 hover:bg-purple-50 text-gray-900")
                    } ${!choice.disabled && "hover:scale-102 hover:shadow-lg"}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{choice.emoji}</span>
                      <span className="font-medium text-left flex-1">
                        {choice.text}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 하단 버튼 */}
        <div className={`sticky bottom-0 p-6 border-t ${
          isDarkMode ? "border-white/10 bg-gray-900/95" : "border-gray-300/20 bg-white/95"
        } backdrop-blur-md`}>
          <button
            onClick={onAbandon}
            className={`w-full py-3 rounded-xl font-medium transition-all duration-300 ${
              isDarkMode 
                ? "bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-500/30"
                : "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200"
            }`}
          >
            포기하기 (보상 없음)
          </button>
        </div>
      </div>
    </div>
  );
};

const RoguelikeDungeonSelectModal = ({ 
  isOpen, 
  onClose, 
  dungeonProgress,
  onDungeonSelect,
  isDarkMode
}) => {
  if (!isOpen) return null;

  const dungeons = [
    { level: "n-1", name: "초심자의 에테르던전", icon: "🌙", difficulty: "⭐" },
    { level: "n-2", name: "견습생의 에테르던전", icon: "🌙", difficulty: "⭐⭐" },
    { level: "n-3", name: "숙련자의 에테르던전", icon: "🌙", difficulty: "⭐⭐⭐" },
    { level: "n-4", name: "전사의 에테르던전", icon: "🌙", difficulty: "⭐⭐⭐⭐" },
    { level: "n-5", name: "영웅의 에테르던전", icon: "🌙", difficulty: "⭐⭐⭐⭐⭐" },
    { level: "n-6", name: "신비의 에테르던전", icon: "✨", difficulty: "⭐⭐⭐⭐⭐" },
    { level: "n-7", name: "전설의 에테르던전", icon: "✨", difficulty: "⭐⭐⭐⭐⭐" },
    { level: "n-8", name: "신성한 에테르던전", icon: "✨", difficulty: "⭐⭐⭐⭐⭐" },
    { level: "n-9", name: "심연의 에테르던전", icon: "🔥", difficulty: "⭐⭐⭐⭐⭐" },
    { level: "n-10", name: "최후의 에테르던전", icon: "🔥", difficulty: "⭐⭐⭐⭐⭐" }
  ];

  const getDungeonStatus = (level, index) => {
    const progress = dungeonProgress[level] || 0;
    const isFirstDungeon = index === 0;
    
    if (isFirstDungeon) {
      return { accessible: true, completed: progress === 10, progress };
    }
    
    const prevLevel = dungeons[index - 1].level;
    const prevProgress = dungeonProgress[prevLevel] || 0;
    const accessible = prevProgress === 10;
    
    return { accessible, completed: progress === 10, progress };
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-2xl border-2 ${
        isDarkMode 
          ? "bg-gray-900/95 border-purple-500/30" 
          : "bg-white/95 border-purple-300/50"
      } backdrop-blur-md`}>
        
        {/* 헤더 */}
        <div className={`sticky top-0 p-6 border-b ${
          isDarkMode ? "border-white/10 bg-gray-900/95" : "border-gray-300/20 bg-white/95"
        } backdrop-blur-md z-10`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎮</span>
              <div>
                <h2 className={`text-2xl font-bold ${
                  isDarkMode ? "text-purple-300" : "text-purple-700"
                }`}>
                  에테르던전 선택
                </h2>
                <p className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}>
                  도전할 던전을 선택하세요
                </p>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode 
                  ? "hover:bg-white/10 text-gray-400 hover:text-white" 
                  : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"
              }`}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* 던전 목록 */}
        <div className="p-6 space-y-3">
          {dungeons.map((dungeon, index) => {
            const status = getDungeonStatus(dungeon.level, index);
            
            return (
              <button
                key={dungeon.level}
                onClick={() => {
                  if (status.accessible) {
                    onDungeonSelect(dungeon.level);
                  }
                }}
                disabled={!status.accessible}
                className={`w-full p-4 rounded-xl border-2 transition-all duration-300 text-left ${
                  status.accessible
                    ? status.completed
                      ? isDarkMode
                        ? "bg-green-900/20 border-green-500/30 hover:border-green-400/50 hover:bg-green-900/30"
                        : "bg-green-50 border-green-300/50 hover:border-green-400/70 hover:bg-green-100/30"
                      : isDarkMode
                        ? "bg-gray-800/50 border-purple-500/30 hover:border-purple-400/50 hover:bg-purple-900/20"
                        : "bg-white border-purple-300/50 hover:border-purple-400/70 hover:bg-purple-50"
                    : isDarkMode
                        ? "bg-gray-800/20 border-gray-600/30 cursor-not-allowed"
                        : "bg-gray-100/50 border-gray-300/30 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    {/* 던전 아이콘 */}
                    <span className="text-4xl">{dungeon.icon}</span>
                    
                    {/* 던전 정보 */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`font-bold text-lg ${
                          isDarkMode ? "text-white" : "text-gray-900"
                        }`}>
                          {dungeon.level} - {dungeon.name}
                        </h3>
                        <span className="text-sm">{dungeon.difficulty}</span>
                      </div>
                      
                      {/* 진행도 바 */}
                      <div className="w-full h-2 rounded-full overflow-hidden" style={{
                        backgroundColor: isDarkMode ? "#374151" : "#e5e7eb"
                      }}>
                        <div 
                          className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"
                          style={{ width: `${(status.progress / 10) * 100}%` }}
                        />
                      </div>
                      <p className={`text-xs mt-1 ${
                        isDarkMode ? "text-gray-400" : "text-gray-600"
                      }`}>
                        {status.progress} / 10 스테이지 완료
                      </p>
                    </div>
                  </div>
                  
                  {/* 상태 아이콘 */}
                  <div className="ml-4">
                    {status.completed ? (
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    ) : !status.accessible ? (
                      <Lock className="w-6 h-6 text-gray-500" />
                    ) : (
                      <Zap className="w-6 h-6 text-yellow-500" />
                    )}
                  </div>
                </div>

                {/* 진입 불가 메시지 */}
                {!status.accessible && (
                  <div className={`mt-2 text-xs ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}>
                    🔒 {dungeons[index - 1].level} 던전을 먼저 완료해주세요
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* 하단 설명 */}
        <div className={`p-6 border-t ${
          isDarkMode ? "border-white/10 bg-gray-900/95" : "border-gray-300/20 bg-white/95"
        } backdrop-blur-md`}>
          <p className={`text-sm ${
            isDarkMode ? "text-gray-400" : "text-gray-600"
          }`}>
            💡 각 던전의 모든 스테이지(10/10)를 완료해야 다음 던전에 진입할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RoguelikeModal;
export { RoguelikeDungeonSelectModal };


