import { useState, useCallback } from 'react';

// 업적 정의 (서버와 동일)
export const ACHIEVEMENT_DEFINITIONS = {
  fox_location: {
    id: "fox_location",
    name: "여우가 어디사는지 아니?",
    description: "여우이야기 채팅방 플레이 유저라면 획득",
    autoCheck: false
  },
  fox_gamble: {
    id: "fox_gamble", 
    name: "여우는 겜블을 좋아해",
    description: "호감도 100만점이상 달성",
    autoCheck: false
  },
  fish_collector: {
    id: "fish_collector",
    name: "너를 위해 준비했어",
    description: "보유물고기 100마리 이상",
    autoCheck: true
  },
  rare_fish_hunter: {
    id: "rare_fish_hunter",
    name: "이제 입질이 오기 시작했어",
    description: "0.3% 물고기 10번 낚시하기",
    autoCheck: true
  },
  raid_finisher: {
    id: "raid_finisher",
    name: "전장의 지배자",
    description: "레이드 물고기 마지막 공격으로 처치",
    autoCheck: true
  }
};

/**
 * 업적 관리 커스텀 훅
 * @param {string} serverUrl - 서버 URL
 * @param {string} jwtToken - JWT 토큰
 * @param {object} authenticatedRequest - 인증된 요청 객체
 * @param {boolean} isAdmin - 관리자 여부
 * @param {string} username - 현재 사용자명
 */
export const useAchievements = (serverUrl, jwtToken, authenticatedRequest, isAdmin, username) => {
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 🏆 업적 데이터 가져오기
  const fetchAchievements = useCallback(async (targetUsername = null) => {
    if (!jwtToken) {
      console.warn('No JWT token available for achievements');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const params = targetUsername ? { targetUsername } : {};
      const response = await authenticatedRequest.get(`${serverUrl}/api/achievements`, { params });
      
      if (response.data.success) {
        setAchievements(response.data.achievements);
        console.log('🏆 Achievements loaded:', response.data.achievements);
        return response.data.achievements;
      } else {
        throw new Error('Failed to fetch achievements');
      }
    } catch (error) {
      console.error('❌ Failed to fetch achievements:', error);
      setError(error.response?.data?.error || error.message);
      setAchievements([]);
      return null;
    } finally {
      setLoading(false);
    }
  }, [serverUrl, jwtToken, authenticatedRequest]);

  // 🏆 관리자 업적 부여 함수
  const grantAchievement = useCallback(async (targetUsername, achievementId, onFishingSkillUpdate) => {
    if (!isAdmin) {
      const errorMsg = '⚠️ 관리자 권한이 필요합니다.';
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    if (!ACHIEVEMENT_DEFINITIONS[achievementId]) {
      const errorMsg = '❌ 잘못된 업적 ID입니다.';
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    setLoading(true);
    setError(null);

    try {
      const response = await authenticatedRequest.post(`${serverUrl}/api/achievements/admin/grant`, {
        targetUsername,
        achievementId
      });

      if (response.data.success) {
        console.log(`✅ Achievement granted: ${response.data.message}`);
        
        // 현재 보고 있는 사용자의 업적이면 새로고침
        if (targetUsername === username || !targetUsername) {
          await fetchAchievements();
          
          // 🎯 낚시실력 실시간 업데이트
          if (onFishingSkillUpdate && typeof onFishingSkillUpdate === 'function') {
            try {
              console.log('🔄 업적 부여 후 낚시실력 새로고침 중...');
              await onFishingSkillUpdate();
            } catch (skillError) {
              console.error('Failed to update fishing skill after achievement grant:', skillError);
            }
          }
        }
        
        return response.data;
      } else {
        throw new Error(response.data.error || 'Failed to grant achievement');
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message;
      console.error('❌ Failed to grant achievement:', errorMsg);
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [serverUrl, authenticatedRequest, isAdmin, username, fetchAchievements]);

  // 🏆 관리자 업적 해제 함수
  const revokeAchievement = useCallback(async (targetUsername, achievementId, onFishingSkillUpdate) => {
    if (!isAdmin) {
      const errorMsg = '⚠️ 관리자 권한이 필요합니다.';
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    if (!ACHIEVEMENT_DEFINITIONS[achievementId]) {
      const errorMsg = '❌ 잘못된 업적 ID입니다.';
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    setLoading(true);
    setError(null);

    try {
      const response = await authenticatedRequest.post(`${serverUrl}/api/achievements/admin/revoke`, {
        targetUsername,
        achievementId
      });

      if (response.data.success) {
        console.log(`✅ Achievement revoked: ${response.data.message}`);
        
        // 현재 보고 있는 사용자의 업적이면 새로고침
        if (targetUsername === username || !targetUsername) {
          await fetchAchievements();
          
          // 🎯 낚시실력 실시간 업데이트
          if (onFishingSkillUpdate && typeof onFishingSkillUpdate === 'function') {
            try {
              console.log('🔄 업적 해제 후 낚시실력 새로고침 중...');
              await onFishingSkillUpdate();
            } catch (skillError) {
              console.error('Failed to update fishing skill after achievement revoke:', skillError);
            }
          }
        }
        
        return response.data;
      } else {
        throw new Error(response.data.error || 'Failed to revoke achievement');
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message;
      console.error('❌ Failed to revoke achievement:', errorMsg);
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [serverUrl, authenticatedRequest, isAdmin, username, fetchAchievements]);

  // 🏆 업적 자동 체크 (낚시 후 호출)
  const checkAchievements = useCallback(async () => {
    if (!jwtToken) return false;
    
    try {
      const response = await authenticatedRequest.post(`${serverUrl}/api/achievements/check`);
      
      if (response.data.success && response.data.achievementGranted) {
        console.log('🏆 New achievement granted!');
        // 업적 목록 새로고침
        await fetchAchievements();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to check achievements:', error);
      return false;
    }
  }, [serverUrl, jwtToken, authenticatedRequest, fetchAchievements]);

  // 🏆 업적 통계 계산
  const getAchievementStats = useCallback(() => {
    const completed = achievements.filter(a => a.completed);
    const total = achievements.length;
    const completionRate = total > 0 ? Math.round((completed.length / total) * 100) : 0;
    
    return {
      completed: completed.length,
      total,
      completionRate,
      remaining: total - completed.length
    };
  }, [achievements]);

  // 🏆 특정 업적 완료 여부 확인
  const hasAchievement = useCallback((achievementId) => {
    return achievements.some(a => a.id === achievementId && a.completed);
  }, [achievements]);

  // 🏆 완료된 업적 목록
  const getCompletedAchievements = useCallback(() => {
    return achievements.filter(a => a.completed);
  }, [achievements]);

  // 🏆 미완료 업적 목록
  const getPendingAchievements = useCallback(() => {
    return achievements.filter(a => !a.completed);
  }, [achievements]);

  return {
    // 상태
    achievements,
    loading,
    error,
    
    // 액션
    fetchAchievements,
    grantAchievement,
    revokeAchievement,
    checkAchievements,
    
    // 유틸리티
    getAchievementStats,
    hasAchievement,
    getCompletedAchievements,
    getPendingAchievements,
    
    // 상수
    ACHIEVEMENT_DEFINITIONS
  };
};
