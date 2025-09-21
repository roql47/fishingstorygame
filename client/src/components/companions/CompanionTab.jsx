import React, { useState } from 'react';
import { Users, Sword, Shield, Heart, Star, Zap, X, Info } from 'lucide-react';
import { COMPANION_DATA, calculateCompanionStats, getRarityColor } from '../../data/companionData';

const CompanionTab = ({
  // 상태
  isDarkMode,
  userStarPieces,
  companions,
  battleCompanions,
  companionStats,
  
  // 함수
  recruitCompanion,
  toggleBattleCompanion
}) => {
  // 동료 상세 모달 상태
  const [selectedCompanion, setSelectedCompanion] = useState(null);
  const [showCompanionModal, setShowCompanionModal] = useState(false);
  
  // 동료 클릭 핸들러
  const handleCompanionClick = (companionName) => {
    setSelectedCompanion(companionName);
    setShowCompanionModal(true);
  };
  
  // 모달 닫기
  const closeCompanionModal = () => {
    setShowCompanionModal(false);
    setSelectedCompanion(null);
  };

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
            <button
              onClick={() => window.location.reload()}
              className={`p-1 rounded-full hover:scale-110 transition-all duration-300 ${
                isDarkMode 
                  ? "bg-gray-500/20 text-gray-400 hover:bg-gray-500/30" 
                  : "bg-gray-300/30 text-gray-600 hover:bg-gray-300/50"
              }`}
              title="페이지 새로고침"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
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
                const companionStat = companionStats[companion] || { level: 1, exp: 0, expToNext: 100 };
                const companionData = calculateCompanionStats(companion, companionStat.level);
                const baseData = COMPANION_DATA[companion];
                
                return (
                  <div key={index} className={`p-4 rounded-lg transition-all duration-200 ${
                    isInBattle
                      ? isDarkMode 
                        ? "bg-green-500/20 border-2 border-green-400/40 glow-effect-green" 
                        : "bg-green-500/10 border-2 border-green-500/40"
                      : isDarkMode 
                        ? "bg-purple-500/10 border border-purple-400/20 hover:bg-purple-500/15" 
                        : "bg-purple-500/5 border border-purple-300/30 hover:bg-purple-500/10"
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isInBattle
                            ? isDarkMode ? "bg-green-500/30 text-green-400" : "bg-green-500/20 text-green-600"
                            : isDarkMode ? "bg-purple-500/30 text-purple-400" : "bg-purple-500/20 text-purple-600"
                        }`}>
                          {isInBattle ? <Sword className="w-5 h-5" /> : <Heart className="w-5 h-5" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`font-medium ${
                              isInBattle
                                ? isDarkMode ? "text-green-400" : "text-green-600"
                                : isDarkMode ? "text-purple-400" : "text-purple-600"
                            }`}>{companion}</div>
                            <div className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              isDarkMode ? "bg-yellow-500/20 text-yellow-400" : "bg-yellow-500/10 text-yellow-600"
                            }`}>
                              Lv.{companionStat.level}
                            </div>
                            <div className={`text-xs px-1.5 py-0.5 rounded font-medium ${getRarityColor(baseData?.rarity, isDarkMode)} ${
                              isDarkMode ? "bg-gray-700/30" : "bg-gray-200/50"
                            }`}>
                              {baseData?.rarity}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-1">
                              <Heart className="w-3 h-3 text-red-400" />
                              <span className={isDarkMode ? "text-gray-300" : "text-gray-700"}>
                                {companionData?.hp || 100}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Sword className="w-3 h-3 text-orange-400" />
                              <span className={isDarkMode ? "text-gray-300" : "text-gray-700"}>
                                {companionData?.attack || 25}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Zap className="w-3 h-3 text-blue-400" />
                              <span className={isDarkMode ? "text-gray-300" : "text-gray-700"}>
                                {companionData?.speed || 30}
                              </span>
                            </div>
                          </div>
                          <div className={`text-xs mt-1 ${
                            isDarkMode ? "text-gray-400" : "text-gray-600"
                          }`}>
                            {isInBattle ? "전투 참여 중" : "대기 중"} • EXP: {companionStat.exp}/{companionStat.expToNext}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleBattleCompanion(companion)}
                        disabled={!isInBattle && !canAddToBattle}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 ${
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
              <div 
                key={index} 
                className={`p-2 rounded text-center cursor-pointer transition-all duration-200 hover:scale-105 ${
                  companions.includes(name)
                    ? isDarkMode
                      ? "bg-green-500/20 text-green-400 border border-green-400/30 hover:bg-green-500/30"
                      : "bg-green-500/10 text-green-600 border border-green-500/30 hover:bg-green-500/20"
                    : isDarkMode
                      ? "bg-gray-500/10 text-gray-500 border border-gray-500/20 hover:bg-gray-500/20"
                      : "bg-gray-300/20 text-gray-600 border border-gray-300/30 hover:bg-gray-300/40"
                }`}
                onClick={() => companions.includes(name) && handleCompanionClick(name)}
              >
                {name} {companions.includes(name) ? "✓" : ""}
                {companions.includes(name) && (
                  <div className="text-xs mt-1 opacity-70">클릭하여 상세보기</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 동료 상세 모달 */}
      {showCompanionModal && selectedCompanion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className={`relative w-full max-w-md mx-4 rounded-2xl border shadow-2xl ${
            isDarkMode 
              ? "bg-gray-800/95 border-gray-700/50 backdrop-blur-md" 
              : "bg-white/95 border-gray-300/50 backdrop-blur-md"
          }`}>
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between p-6 border-b border-gray-300/20">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  isDarkMode ? "bg-blue-500/20 text-blue-400" : "bg-blue-500/10 text-blue-600"
                }`}>
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${
                    isDarkMode ? "text-white" : "text-gray-800"
                  }`}>{selectedCompanion}</h2>
                  <div className={`text-sm ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}>동료 상세 정보</div>
                </div>
              </div>
              <button
                onClick={closeCompanionModal}
                className={`p-2 rounded-full transition-colors ${
                  isDarkMode 
                    ? "hover:bg-gray-700/50 text-gray-400 hover:text-white" 
                    : "hover:bg-gray-200/50 text-gray-600 hover:text-gray-800"
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 모달 내용 */}
            <div className="p-6 max-h-96 overflow-y-auto">
              {(() => {
                const baseData = COMPANION_DATA[selectedCompanion];
                const companionStat = companionStats[selectedCompanion];
                const level = companionStat?.level || 1;
                const exp = companionStat?.exp || 0;
                const expToNext = companionStat?.expToNext || 100;
                const companionData = calculateCompanionStats(selectedCompanion, level);
                const isInBattle = battleCompanions.includes(selectedCompanion);

                if (!baseData) return <div>동료 정보를 불러올 수 없습니다.</div>;

                return (
                  <div className="space-y-6">
                    {/* 기본 정보 */}
                    <div className={`p-4 rounded-lg ${
                      isDarkMode ? "bg-gray-700/30" : "bg-gray-100/50"
                    }`}>
                      <h3 className={`font-semibold mb-3 ${
                        isDarkMode ? "text-white" : "text-gray-800"
                      }`}>기본 정보</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>레벨</span>
                          <span className={isDarkMode ? "text-white" : "text-gray-800"}>Lv.{level}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>희귀도</span>
                          <span className={"font-medium " + getRarityColor(baseData.rarity, isDarkMode)}>
                            {baseData.rarity}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>전투 상태</span>
                          <span className={
                            "font-medium " + (isInBattle 
                              ? isDarkMode ? "text-green-400" : "text-green-600"
                              : isDarkMode ? "text-gray-400" : "text-gray-600")
                          }>
                            {isInBattle ? "참여 중" : "대기 중"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 능력치 */}
                    <div className={`p-4 rounded-lg ${
                      isDarkMode ? "bg-gray-700/30" : "bg-gray-100/50"
                    }`}>
                      <h3 className={`font-semibold mb-3 ${
                        isDarkMode ? "text-white" : "text-gray-800"
                      }`}>능력치</h3>
                      <div className="space-y-3">
                        {/* 체력 */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Heart className="w-4 h-4 text-red-400" />
                            <span className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>체력</span>
                          </div>
                          <div className="text-right">
                            <div className={`font-semibold ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                              {companionData?.hp || baseData.baseHp}
                            </div>
                            <div className="text-xs text-gray-500">
                              기본 {baseData.baseHp} (+{baseData.growthHp}/Lv)
                            </div>
                          </div>
                        </div>

                        {/* 공격력 */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sword className="w-4 h-4 text-orange-400" />
                            <span className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>공격력</span>
                          </div>
                          <div className="text-right">
                            <div className={`font-semibold ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                              {companionData?.attack || baseData.baseAttack}
                            </div>
                            <div className="text-xs text-gray-500">
                              기본 {baseData.baseAttack} (+{baseData.growthAttack}/Lv)
                            </div>
                          </div>
                        </div>

                        {/* 속도 */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-blue-400" />
                            <span className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>속도</span>
                          </div>
                          <div className="text-right">
                            <div className={`font-semibold ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                              {companionData?.speed || baseData.baseSpeed}
                            </div>
                            <div className="text-xs text-gray-500">
                              기본 {baseData.baseSpeed} (+{baseData.growthSpeed}/Lv)
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 경험치 */}
                    <div className={`p-4 rounded-lg ${
                      isDarkMode ? "bg-gray-700/30" : "bg-gray-100/50"
                    }`}>
                      <h3 className={`font-semibold mb-3 ${
                        isDarkMode ? "text-white" : "text-gray-800"
                      }`}>경험치</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>현재 EXP</span>
                          <span className={isDarkMode ? "text-white" : "text-gray-800"}>{exp} / {expToNext}</span>
                        </div>
                        <div className={`w-full h-2 rounded-full ${
                          isDarkMode ? "bg-gray-600" : "bg-gray-300"
                        }`}>
                          <div 
                            className="h-full bg-blue-500 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, (exp / expToNext) * 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {/* 스킬 정보 */}
                    {baseData.skill && (
                      <div className={`p-4 rounded-lg ${
                        isDarkMode ? "bg-purple-500/10 border border-purple-500/20" : "bg-purple-500/5 border border-purple-500/20"
                      }`}>
                        <h3 className={`font-semibold mb-3 flex items-center gap-2 ${
                          isDarkMode ? "text-purple-400" : "text-purple-600"
                        }`}>
                          <Star className="w-4 h-4" />
                          보유 스킬
                        </h3>
                        <div className="space-y-3">
                          <div className={`p-3 rounded-lg ${
                            isDarkMode ? "bg-purple-500/10" : "bg-purple-500/5"
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className={`font-medium ${
                                isDarkMode ? "text-purple-400" : "text-purple-600"
                              }`}>{baseData.skill.name}</h4>
                              <div className={`text-xs px-2 py-1 rounded-full ${
                                isDarkMode ? "bg-yellow-500/20 text-yellow-400" : "bg-yellow-500/10 text-yellow-600"
                              }`}>
                                사기 {baseData.skill.moraleRequired} 필요
                              </div>
                            </div>
                            <p className={`text-sm mb-2 ${
                              isDarkMode ? "text-gray-300" : "text-gray-700"
                            }`}>
                              {baseData.skill.description}
                            </p>
                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-1">
                                <Sword className="w-3 h-3 text-orange-400" />
                                <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>데미지:</span>
                                <span className={isDarkMode ? "font-semibold text-orange-400" : "font-semibold text-orange-600"}>
                                  {Math.floor((baseData.skill?.damageMultiplier || 1) * 100)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 설명 */}
                    <div className={`p-4 rounded-lg ${
                      isDarkMode ? "bg-gray-700/30" : "bg-gray-100/50"
                    }`}>
                      <h3 className={`font-semibold mb-2 ${
                        isDarkMode ? "text-white" : "text-gray-800"
                      }`}>설명</h3>
                      <p className={`text-sm ${
                        isDarkMode ? "text-gray-300" : "text-gray-700"
                      }`}>
                        {baseData.description}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* 모달 푸터 */}
            <div className="flex justify-end gap-3 p-6 border-t border-gray-300/20">
              <button
                onClick={closeCompanionModal}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  isDarkMode 
                    ? "bg-gray-700/50 text-gray-300 hover:bg-gray-700" 
                    : "bg-gray-200/50 text-gray-700 hover:bg-gray-200"
                }`}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanionTab;
