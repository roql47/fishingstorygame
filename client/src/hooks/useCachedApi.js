/**
 * 🚀 캐시 최적화된 API 사용을 위한 React 훅
 * 레이턴시 최적화와 사용자 경험 향상
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import GameApiClient from '../api/CachedApiClient';
import { useClientCache } from '../cache/ClientCacheSystem';

// 🌐 전역 API 클라이언트 인스턴스
let globalApiClient = null;

export const initializeApiClient = (serverUrl) => {
  if (!globalApiClient) {
    globalApiClient = new GameApiClient(serverUrl);
  }
  return globalApiClient;
};

export const getApiClient = () => {
  if (!globalApiClient) {
    throw new Error('API 클라이언트가 초기화되지 않았습니다. initializeApiClient를 먼저 호출하세요.');
  }
  return globalApiClient;
};

// 🎯 캐시 최적화된 데이터 페칭 훅
export const useCachedData = (key, fetchFunction, options = {}) => {
  const {
    cacheType = 'default',
    dependencies = [],
    refreshInterval = null,
    staleWhileRevalidate = true,
    onError = null,
    onSuccess = null
  } = options;
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  const cache = useClientCache();
  const isMountedRef = useRef(true);
  const refreshTimeoutRef = useRef(null);
  
  // 🔄 데이터 페칭 함수
  const fetchData = useCallback(async (forceRefresh = false) => {
    try {
      // 캐시 확인 (강제 새로고침이 아닌 경우)
      if (!forceRefresh) {
        const cachedData = cache.get(key, cacheType);
        if (cachedData) {
          setData(cachedData);
          setFromCache(true);
          setLoading(false);
          setError(null);
          
          // Stale-While-Revalidate: 백그라운드에서 새 데이터 페칭
          if (staleWhileRevalidate) {
            setTimeout(() => fetchData(true), 100);
          }
          return;
        }
      }
      
      setLoading(true);
      setError(null);
      
      const result = await fetchFunction();
      
      if (isMountedRef.current) {
        setData(result);
        setFromCache(false);
        setLoading(false);
        setLastUpdated(new Date());
        
        // 캐시에 저장
        cache.set(key, result, cacheType);
        
        if (onSuccess) {
          onSuccess(result);
        }
      }
      
    } catch (err) {
      if (isMountedRef.current) {
        setError(err);
        setLoading(false);
        
        if (onError) {
          onError(err);
        }
        
        // 에러 시 오래된 캐시라도 사용
        const staleData = cache.get(key, cacheType);
        if (staleData) {
          setData(staleData);
          setFromCache(true);
          console.warn('네트워크 에러, 오래된 캐시 사용:', key);
        }
      }
    }
  }, [key, fetchFunction, cacheType, staleWhileRevalidate, cache, onSuccess, onError]);
  
  // 🚀 초기 데이터 로드
  useEffect(() => {
    fetchData();
    
    // 주기적 새로고침 설정
    if (refreshInterval) {
      refreshTimeoutRef.current = setInterval(() => {
        fetchData(true);
      }, refreshInterval);
    }
    
    return () => {
      if (refreshTimeoutRef.current) {
        clearInterval(refreshTimeoutRef.current);
      }
    };
  }, [...dependencies, fetchData, refreshInterval]);
  
  // 🧹 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (refreshTimeoutRef.current) {
        clearInterval(refreshTimeoutRef.current);
      }
    };
  }, []);
  
  // 🔄 수동 새로고침
  const refresh = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);
  
  // 🗑️ 캐시 무효화
  const invalidate = useCallback(() => {
    cache.invalidate(key);
    return fetchData(true);
  }, [cache, key, fetchData]);
  
  return {
    data,
    loading,
    error,
    fromCache,
    lastUpdated,
    refresh,
    invalidate
  };
};

// 📦 인벤토리 데이터 훅
export const useInventory = (userInfo, options = {}) => {
  const apiClient = getApiClient();
  
  const fetchInventory = useCallback(async () => {
    if (!userInfo.username) return [];
    
    const { userId = 'user', username, userUuid } = userInfo;
    const result = await apiClient.getInventory(userId, username, userUuid);
    return result.data;
  }, [userInfo.username, userInfo.userUuid, userInfo.userId, apiClient]);
  
  return useCachedData(
    `inventory_${userInfo.userUuid}`,
    fetchInventory,
    {
      cacheType: 'inventory',
      dependencies: [userInfo.username, userInfo.userUuid],
      refreshInterval: 30000, // 30초마다 새로고침
      ...options
    }
  );
};

// 🧱 재료 데이터 훅
export const useMaterials = (userInfo, options = {}) => {
  const apiClient = getApiClient();
  
  const fetchMaterials = useCallback(async () => {
    if (!userInfo.username) return [];
    
    const { userId = 'user', username, userUuid } = userInfo;
    const result = await apiClient.getMaterials(userId, username, userUuid);
    return result.data;
  }, [userInfo.username, userInfo.userUuid, userInfo.userId, apiClient]);
  
  return useCachedData(
    `materials_${userInfo.userUuid}`,
    fetchMaterials,
    {
      cacheType: 'materials',
      dependencies: [userInfo.username, userInfo.userUuid],
      refreshInterval: 45000, // 45초마다 새로고침
      ...options
    }
  );
};

// 💰 돈 데이터 훅
export const useMoney = (userInfo, options = {}) => {
  const apiClient = getApiClient();
  
  const fetchMoney = useCallback(async () => {
    if (!userInfo.username) return { money: 0 };
    
    const { userId = 'user', username, userUuid } = userInfo;
    const result = await apiClient.getMoney(userId, username, userUuid);
    return result.data;
  }, [userInfo.username, userInfo.userUuid, userInfo.userId, apiClient]);
  
  return useCachedData(
    `money_${userInfo.userUuid}`,
    fetchMoney,
    {
      cacheType: 'userMoney',
      dependencies: [userInfo.username, userInfo.userUuid],
      refreshInterval: 60000, // 1분마다 새로고침
      ...options
    }
  );
};

// 🏆 랭킹 데이터 훅
export const useRanking = (options = {}) => {
  const apiClient = getApiClient();
  
  const fetchRanking = useCallback(async () => {
    const result = await apiClient.getRanking();
    return result.data;
  }, [apiClient]);
  
  return useCachedData(
    'global_ranking',
    fetchRanking,
    {
      cacheType: 'ranking',
      dependencies: [],
      refreshInterval: 2 * 60 * 1000, // 2분마다 새로고침
      ...options
    }
  );
};

// 👥 접속자 데이터 훅
export const useConnectedUsers = (options = {}) => {
  const apiClient = getApiClient();
  
  const fetchConnectedUsers = useCallback(async () => {
    const result = await apiClient.getConnectedUsers();
    return result.data;
  }, [apiClient]);
  
  return useCachedData(
    'connected_users',
    fetchConnectedUsers,
    {
      cacheType: 'connectedUsers',
      dependencies: [],
      refreshInterval: 15000, // 15초마다 새로고침
      ...options
    }
  );
};

// 🎯 다중 데이터 페칭 훅 (병렬 처리)
export const useMultipleData = (dataConfigs, options = {}) => {
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});
  
  const { 
    parallel = true,
    onComplete = null 
  } = options;
  
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      
      try {
        if (parallel) {
          // 🚀 병렬 처리
          const promises = dataConfigs.map(async (config) => {
            try {
              const result = await config.fetchFunction();
              return { key: config.key, data: result, error: null };
            } catch (error) {
              return { key: config.key, data: null, error };
            }
          });
          
          const responses = await Promise.all(promises);
          
          const newResults = {};
          const newErrors = {};
          
          responses.forEach(({ key, data, error }) => {
            if (error) {
              newErrors[key] = error;
            } else {
              newResults[key] = data;
            }
          });
          
          setResults(newResults);
          setErrors(newErrors);
          
        } else {
          // 순차 처리
          const newResults = {};
          const newErrors = {};
          
          for (const config of dataConfigs) {
            try {
              const result = await config.fetchFunction();
              newResults[config.key] = result;
            } catch (error) {
              newErrors[config.key] = error;
            }
          }
          
          setResults(newResults);
          setErrors(newErrors);
        }
        
      } finally {
        setLoading(false);
        if (onComplete) {
          onComplete(results, errors);
        }
      }
    };
    
    fetchAllData();
  }, [dataConfigs, parallel, onComplete]);
  
  return { results, loading, errors };
};

// 🔥 캐시 워밍업 훅
export const useCacheWarmup = () => {
  const apiClient = getApiClient();
  
  const warmupUserCache = useCallback(async (userInfo) => {
    console.log('🔥 사용자 캐시 워밍업 시작...');
    await apiClient.warmupGameCache(userInfo);
    console.log('✅ 사용자 캐시 워밍업 완료');
  }, [apiClient]);
  
  const warmupGlobalCache = useCallback(async () => {
    console.log('🔥 전역 캐시 워밍업 시작...');
    
    const globalEndpoints = [
      { url: '/api/ranking', params: {}, cacheType: 'ranking' },
      { url: '/api/connected-users', params: {}, cacheType: 'connectedUsers' }
    ];
    
    await apiClient.warmupCache(globalEndpoints);
    console.log('✅ 전역 캐시 워밍업 완료');
  }, [apiClient]);
  
  return {
    warmupUserCache,
    warmupGlobalCache
  };
};

// 📊 캐시 성능 모니터링 훅
export const useCacheStats = () => {
  const [stats, setStats] = useState(null);
  const apiClient = getApiClient();
  
  const updateStats = useCallback(() => {
    const report = apiClient.getPerformanceReport();
    setStats(report);
  }, [apiClient]);
  
  useEffect(() => {
    updateStats();
    
    // 5분마다 통계 업데이트
    const interval = setInterval(updateStats, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [updateStats]);
  
  return {
    stats,
    updateStats
  };
};
