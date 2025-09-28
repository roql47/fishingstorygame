import React from 'react';
import { Trophy, Medal } from 'lucide-react';

/**
 * 업적 모달 컴포넌트
 * @param {boolean} isOpen - 모달 열림 상태
 * @param {function} onClose - 모달 닫기 함수
 * @param {array} achievements - 업적 목록
 * @param {object} selectedUserProfile - 선택된 사용자 프로필 (다른 사용자 업적 조회 시)
 * @param {boolean} isDarkMode - 다크모드 여부
 * @param {boolean} loading - 로딩 상태
 */
const AchievementModal = ({ 
  isOpen, 
  onClose, 
  achievements, 
  selectedUserProfile, 
  isDarkMode,
  loading = false
}) => {
  if (!isOpen) return null;

  const completedCount = achievements.filter(a => a.completed).length;
  const totalCount = achievements.length;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={`w-full max-w-2xl rounded-2xl board-shadow ${
        isDarkMode ? "glass-card" : "bg-white/90 backdrop-blur-md border border-gray-300/30"
      }`}>
        {/* 모달 헤더 */}
        <div className={`flex items-center justify-between p-4 border-b ${
          isDarkMode ? "border-white/10" : "border-gray-300/20"
        }`}>
          <div className="flex items-center gap-3">
            <Medal className={`w-6 h-6 ${
              isDarkMode ? "text-yellow-400" : "text-yellow-600"
            }`} />
            <h2 className={`text-xl font-bold ${
              isDarkMode ? "text-white" : "text-gray-800"
            }`}>
              {selectedUserProfile ? `${selectedUserProfile.username}님의 업적` : "내 업적"}
            </h2>
            <div className={`text-sm px-2 py-1 rounded-full ${
              isDarkMode ? "bg-yellow-500/20 text-yellow-400" : "bg-yellow-500/10 text-yellow-600"
            }`}>
              {completedCount}/{totalCount}
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg hover:scale-110 transition-all duration-300 ${
              isDarkMode 
                ? "glass-input text-gray-400 hover:text-white" 
                : "bg-white/60 backdrop-blur-sm border border-gray-300/40 text-gray-600 hover:text-gray-800"
            }`}
          >
            ✕
          </button>
        </div>

        {/* 업적 목록 */}
        <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
          {loading ? (
            <div className={`text-center py-8 ${
              isDarkMode ? "text-gray-500" : "text-gray-600"
            }`}>
              <Medal className="w-12 h-12 mx-auto mb-3 opacity-50 animate-spin" />
              <p>업적 정보를 불러오는 중...</p>
            </div>
          ) : achievements.length > 0 ? (
            achievements.map((achievement) => (
              <AchievementItem 
                key={achievement.id}
                achievement={achievement}
                isDarkMode={isDarkMode}
              />
            ))
          ) : (
            <div className={`text-center py-8 ${
              isDarkMode ? "text-gray-500" : "text-gray-600"
            }`}>
              <Medal className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>업적 정보를 찾을 수 없습니다.</p>
            </div>
          )}
        </div>

        {/* 진행도 바 */}
        {!loading && achievements.length > 0 && (
          <div className={`p-4 border-t ${
            isDarkMode ? "border-white/10" : "border-gray-300/20"
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}>
                전체 진행도
              </span>
              <span className={`text-sm font-medium ${
                isDarkMode ? "text-yellow-400" : "text-yellow-600"
              }`}>
                {Math.round((completedCount / totalCount) * 100)}%
              </span>
            </div>
            <div className={`w-full h-2 rounded-full ${
              isDarkMode ? "bg-gray-700" : "bg-gray-200"
            }`}>
              <div 
                className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full transition-all duration-500"
                style={{ width: `${(completedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 개별 업적 아이템 컴포넌트
 */
const AchievementItem = ({ achievement, isDarkMode }) => {
  // 진행상황이 있는 업적인지 확인
  const hasProgress = achievement.progress !== null && achievement.maxProgress !== null;
  
  // 진행상황 포맷팅 함수
  const formatProgress = (progress, maxProgress) => {
    // 모든 값을 실제 숫자로 표시 (쉼표 구분자 사용)
    return `${progress.toLocaleString()} / ${maxProgress.toLocaleString()}`;
  };

  return (
    <div
      className={`p-4 rounded-xl border transition-all duration-300 ${
        achievement.completed
          ? isDarkMode
            ? "bg-yellow-500/10 border-yellow-400/30 hover:bg-yellow-500/20"
            : "bg-yellow-500/5 border-yellow-500/30 hover:bg-yellow-500/10"
          : isDarkMode
            ? "bg-gray-500/5 border-gray-500/20 hover:bg-gray-500/10"
            : "bg-gray-100/50 border-gray-300/30 hover:bg-gray-100/70"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div className={`p-2 rounded-lg ${
            achievement.completed
              ? isDarkMode
                ? "bg-yellow-500/20 text-yellow-400"
                : "bg-yellow-500/10 text-yellow-600"
              : isDarkMode
                ? "bg-gray-500/20 text-gray-500"
                : "bg-gray-300/30 text-gray-400"
          }`}>
            <Trophy className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className={`font-medium mb-1 ${
              achievement.completed
                ? isDarkMode ? "text-yellow-400" : "text-yellow-600"
                : isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}>
              {achievement.name}
            </h3>
            <p className={`text-sm ${
              isDarkMode ? "text-gray-300" : "text-gray-700"
            }`}>
              {achievement.description}
            </p>
            
            {/* 진행상황 표시 */}
            {hasProgress && !achievement.completed && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}>
                    진행상황
                  </span>
                  <span className={`text-xs font-medium ${
                    isDarkMode ? "text-blue-400" : "text-blue-600"
                  }`}>
                    {formatProgress(achievement.progress, achievement.maxProgress)} ({achievement.progressPercentage}%)
                  </span>
                </div>
                <div className={`w-full h-1.5 rounded-full ${
                  isDarkMode ? "bg-gray-700" : "bg-gray-200"
                }`}>
                  <div 
                    className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${achievement.progressPercentage}%` }}
                  />
                </div>
              </div>
            )}
            
            {achievement.completed && achievement.completedAt && (
              <p className={`text-xs mt-2 ${
                isDarkMode ? "text-gray-500" : "text-gray-600"
              }`}>
                달성일: {new Date(achievement.completedAt).toLocaleDateString('ko-KR')}
              </p>
            )}
          </div>
        </div>
        {achievement.completed ? (
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
            isDarkMode
              ? "bg-green-500/20 text-green-400"
              : "bg-green-500/10 text-green-600"
          }`}>
            완료
          </div>
        ) : hasProgress && (
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
            isDarkMode
              ? "bg-blue-500/20 text-blue-400"
              : "bg-blue-500/10 text-blue-600"
          }`}>
            {achievement.progressPercentage}%
          </div>
        )}
      </div>
    </div>
  );
};

export default AchievementModal;
