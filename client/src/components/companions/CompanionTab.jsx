import React from 'react';
import { Users, Sword, Shield, Heart } from 'lucide-react';

const CompanionTab = ({
  // 상태
  isDarkMode,
  userStarPieces,
  companions,
  battleCompanions,
  
  // 함수
  recruitCompanion,
  toggleBattleCompanion
}) => {
  const allCompanions = ["실", "피에나", "애비게일", "림스&베리", "클로에", "나하트라"];
  const maxBattleCompanions = 3;

  return (
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
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              isDarkMode ? "bg-purple-500/20 text-purple-400" : "bg-purple-500/10 text-purple-600"
            }`}>
              전투 참여: {battleCompanions.length}/{maxBattleCompanions}
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
        
        {/* 보유 동료 목록 - 전투 참여 토글 기능 */}
        <div className={`p-4 rounded-xl mb-4 ${
          isDarkMode ? "glass-input" : "bg-white/60 backdrop-blur-sm border border-gray-300/40"
        }`}>
          <h3 className={`font-medium mb-3 flex items-center gap-2 ${
            isDarkMode ? "text-white" : "text-gray-800"
          }`}>
            <Sword className="w-4 h-4" />
            보유 동료 ({companions.length}/6)
          </h3>
          {companions.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {companions.map((companion, index) => {
                const isInBattle = battleCompanions.includes(companion);
                const canAddToBattle = battleCompanions.length < maxBattleCompanions;
                
                return (
                  <div key={index} className={`p-3 rounded-lg flex items-center justify-between transition-all duration-200 ${
                    isInBattle
                      ? isDarkMode 
                        ? "bg-green-500/20 border-2 border-green-400/40 glow-effect-green" 
                        : "bg-green-500/10 border-2 border-green-500/40"
                      : isDarkMode 
                        ? "bg-purple-500/10 border border-purple-400/20 hover:bg-purple-500/15" 
                        : "bg-purple-500/5 border border-purple-300/30 hover:bg-purple-500/10"
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isInBattle
                          ? isDarkMode ? "bg-green-500/30 text-green-400" : "bg-green-500/20 text-green-600"
                          : isDarkMode ? "bg-purple-500/30 text-purple-400" : "bg-purple-500/20 text-purple-600"
                      }`}>
                        {isInBattle ? <Sword className="w-4 h-4" /> : <Heart className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className={`font-medium text-sm ${
                          isInBattle
                            ? isDarkMode ? "text-green-400" : "text-green-600"
                            : isDarkMode ? "text-purple-400" : "text-purple-600"
                        }`}>{companion}</div>
                        <div className={`text-xs ${
                          isDarkMode ? "text-gray-400" : "text-gray-600"
                        }`}>
                          {isInBattle ? "전투 참여 중" : "대기 중"}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleBattleCompanion(companion)}
                      disabled={!isInBattle && !canAddToBattle}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                        isInBattle
                          ? isDarkMode
                            ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-400/30"
                            : "bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/30"
                          : canAddToBattle
                            ? isDarkMode
                              ? "bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-400/30"
                              : "bg-green-500/10 text-green-600 hover:bg-green-500/20 border border-green-500/30"
                            : isDarkMode
                              ? "bg-gray-500/20 text-gray-500 cursor-not-allowed border border-gray-500/20"
                              : "bg-gray-300/30 text-gray-400 cursor-not-allowed border border-gray-300/30"
                      }`}
                    >
                      {isInBattle ? "해제" : canAddToBattle ? "참여" : "만원"}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`text-center py-4 text-sm ${
              isDarkMode ? "text-gray-500" : "text-gray-600"
            }`}>
              아직 동료가 없습니다.
              <br />
              동료를 모집해서 전투에 참여시켜보세요!
            </div>
          )}
        </div>

        {/* 전투 참여 동료 현황 */}
        {battleCompanions.length > 0 && (
          <div className={`p-4 rounded-xl mb-4 ${
            isDarkMode ? "bg-green-500/10 border border-green-400/20" : "bg-green-500/5 border border-green-500/20"
          }`}>
            <h3 className={`font-medium mb-3 flex items-center gap-2 ${
              isDarkMode ? "text-green-400" : "text-green-600"
            }`}>
              <Shield className="w-4 h-4" />
              전투 참여 동료
            </h3>
            <div className="flex flex-wrap gap-2">
              {battleCompanions.map((companion, index) => (
                <div key={index} className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                  isDarkMode ? "bg-green-500/20 text-green-400" : "bg-green-500/10 text-green-600"
                }`}>
                  <Sword className="w-3 h-3" />
                  {companion}
                </div>
              ))}
            </div>
            <div className={`text-xs mt-2 ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}>
              탐사 전투에서 함께 싸워줍니다! ({battleCompanions.length}/{maxBattleCompanions})
            </div>
          </div>
        )}
        
        {/* 동료 소개 */}
        <div className={`p-4 rounded-xl ${
          isDarkMode ? "glass-input" : "bg-white/60 backdrop-blur-sm border border-gray-300/40"
        }`}>
          <h3 className={`font-medium mb-3 ${
            isDarkMode ? "text-white" : "text-gray-800"
          }`}>동료 소개</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            {allCompanions.map((name, index) => (
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
  );
};

export default CompanionTab;
