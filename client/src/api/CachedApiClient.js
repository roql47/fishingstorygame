/**
 * 🚀 캐시 최적화된 API 클라이언트
 * 레이턴시 최적화를 위한 스마트 캐시 통합
 */

import axios from 'axios';
import clientCache from '../cache/ClientCacheSystem';

class CachedApiClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.axios = axios.create({
      baseURL,
      timeout: 10000
    });
    
    // 📊 API 성능 통계
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      networkRequests: 0,
      errors: 0,
      
      getStats() {
        return {
          totalRequests: this.totalRequests,
          cacheHitRate: this.totalRequests > 0 ? 
            (this.cacheHits / this.totalRequests * 100).toFixed(2) + '%' : '0%',
          networkSaved: this.cacheHits,
          errorRate: this.totalRequests > 0 ? 
            (this.errors / this.totalRequests * 100).toFixed(2) + '%' : '0%'
        };
      }
    };
    
    this.setupInterceptors();
  }
  
  // 🔧 인터셉터 설정
  setupInterceptors() {
    // 요청 인터셉터 - JWT 토큰 자동 포함
    this.axios.interceptors.request.use(
      (config) => {
        this.stats.totalRequests++;
        config.metadata = { startTime: Date.now() };
        
        // JWT 토큰 자동 포함
        const token = localStorage.getItem('jwtToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        
        return config;
      },
      (error) => {
        this.stats.errors++;
        return Promise.reject(error);
      }
    );
    
    // 응답 인터셉터
    this.axios.interceptors.response.use(
      (response) => {
        const duration = Date.now() - response.config.metadata.startTime;
        console.log(`🌐 API 응답: ${response.config.url} - ${duration}ms`);
        return response;
      },
      (error) => {
        this.stats.errors++;
        const duration = Date.now() - error.config.metadata.startTime;
        console.error(`❌ API 에러: ${error.config.url} - ${duration}ms`, error.message);
        return Promise.reject(error);
      }
    );
  }
  
  // 🚀 캐시 우선 GET 요청
  async cachedGet(url, options = {}) {
    const {
      params = {},
      cacheKey = null,
      cacheType = 'apiResponse',
      cacheTTL = null,
      forceRefresh = false,
      fallbackToCache = true
    } = options;
    
    // 캐시 키 생성
    const finalCacheKey = cacheKey || this.generateCacheKey(url, params);
    
    // 강제 새로고침이 아닌 경우 캐시 확인
    if (!forceRefresh) {
      const cached = clientCache.get(finalCacheKey, cacheType);
      if (cached) {
        this.stats.cacheHits++;
        console.log(`🎯 API 캐시 히트: ${url}`);
        return { data: cached, fromCache: true };
      }
    }
    
    // 네트워크 요청
    try {
      this.stats.cacheMisses++;
      this.stats.networkRequests++;
      
      const response = await this.axios.get(url, { params });
      
      // 응답 캐시 저장
      if (response.data) {
        const cacheOptions = {};
        if (cacheTTL) {
          clientCache.TTL[cacheType] = cacheTTL;
        }
        
        clientCache.set(finalCacheKey, response.data, cacheType, cacheOptions);
        console.log(`💾 API 응답 캐시: ${url}`);
      }
      
      return { data: response.data, fromCache: false };
      
    } catch (error) {
      // 네트워크 에러 시 오래된 캐시라도 반환
      if (fallbackToCache) {
        const staleCache = this.getStaleCache(finalCacheKey, cacheType);
        if (staleCache) {
          console.warn(`⚠️ 네트워크 에러, 오래된 캐시 사용: ${url}`);
          return { data: staleCache, fromCache: true, stale: true };
        }
      }
      
      throw error;
    }
  }
  
  // 🔄 POST 요청 (캐시 무효화 포함)
  async post(url, data = {}, options = {}) {
    const {
      invalidatePatterns = [],
      invalidateUserCache = false,
      userUuid = null
    } = options;
    
    try {
      const response = await this.axios.post(url, data);
      
      // 관련 캐시 무효화
      this.invalidateRelatedCache(url, invalidatePatterns, invalidateUserCache, userUuid);
      
      return response;
      
    } catch (error) {
      throw error;
    }
  }
  
  // 🔄 PUT 요청 (캐시 무효화 포함)
  async put(url, data = {}, options = {}) {
    const {
      invalidatePatterns = [],
      invalidateUserCache = false,
      userUuid = null
    } = options;
    
    try {
      const response = await this.axios.put(url, data);
      
      // 관련 캐시 무효화
      this.invalidateRelatedCache(url, invalidatePatterns, invalidateUserCache, userUuid);
      
      return response;
      
    } catch (error) {
      throw error;
    }
  }
  
  // 🗑️ 관련 캐시 무효화
  invalidateRelatedCache(url, patterns, invalidateUser, userUuid) {
    // URL 기반 자동 패턴 생성
    const autoPatterns = this.generateInvalidationPatterns(url);
    const allPatterns = [...patterns, ...autoPatterns];
    
    allPatterns.forEach(pattern => {
      clientCache.invalidate(pattern);
    });
    
    // 사용자별 캐시 무효화
    if (invalidateUser && userUuid) {
      clientCache.invalidate(userUuid);
    }
  }
  
  // 🔍 캐시 키 생성
  generateCacheKey(url, params) {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        result[key] = params[key];
        return result;
      }, {});
    
    return `${url}_${JSON.stringify(sortedParams)}`;
  }
  
  // 🔄 무효화 패턴 생성
  generateInvalidationPatterns(url) {
    const patterns = [];
    
    // API 경로 기반 패턴
    if (url.includes('/inventory/')) {
      patterns.push('inventory');
    }
    if (url.includes('/materials/')) {
      patterns.push('materials');
    }
    if (url.includes('/money') || url.includes('/sell-fish')) {
      patterns.push('userMoney');
    }
    if (url.includes('/amber')) {
      patterns.push('userAmber');
    }
    if (url.includes('/ranking')) {
      patterns.push('ranking');
    }
    if (url.includes('/equipment')) {
      patterns.push('equipment');
    }
    
    return patterns;
  }
  
  // 📦 오래된 캐시 조회
  getStaleCache(cacheKey, cacheType) {
    // TTL 무시하고 캐시 조회
    const allCaches = [
      clientCache.memoryCache,
      clientCache.sessionCache,
      clientCache.localStorageCache
    ];
    
    for (const cache of allCaches) {
      if (cache.has(cacheKey)) {
        return cache.get(cacheKey).data;
      }
    }
    
    return null;
  }
  
  // 🔥 캐시 워밍업
  async warmupCache(endpoints = []) {
    console.log('🔥 API 캐시 워밍업 시작...');
    
    const warmupPromises = endpoints.map(async (endpoint) => {
      try {
        const { url, params, cacheType } = endpoint;
        await this.cachedGet(url, { params, cacheType, forceRefresh: true });
        console.log(`✅ 워밍업 완료: ${url}`);
      } catch (error) {
        console.warn(`⚠️ 워밍업 실패: ${endpoint.url}`, error.message);
      }
    });
    
    await Promise.all(warmupPromises);
    console.log('🔥 API 캐시 워밍업 완료');
  }
  
  // 📊 성능 리포트
  getPerformanceReport() {
    return {
      api: this.stats.getStats(),
      cache: clientCache.getPerformanceReport(),
      recommendations: this.getRecommendations()
    };
  }
  
  // 💡 최적화 권장사항
  getRecommendations() {
    const apiStats = this.stats.getStats();
    const cacheStats = clientCache.getPerformanceReport();
    const recommendations = [];
    
    const cacheHitRate = parseFloat(apiStats.cacheHitRate);
    if (cacheHitRate < 50) {
      recommendations.push('API 캐시 히트율이 낮습니다. TTL 설정을 검토하세요.');
    }
    
    const errorRate = parseFloat(apiStats.errorRate);
    if (errorRate > 5) {
      recommendations.push('API 에러율이 높습니다. 네트워크 상태를 확인하세요.');
    }
    
    if (this.stats.networkRequests > 100 && cacheHitRate < 70) {
      recommendations.push('네트워크 요청이 많습니다. 캐시 전략을 개선하세요.');
    }
    
    return recommendations;
  }
}

// 🚀 사전 정의된 API 메소드들
class GameApiClient extends CachedApiClient {
  constructor(baseURL) {
    super(baseURL);
  }
  
  // 📦 인벤토리 조회
  async getInventory(userId, username, userUuid) {
    return this.cachedGet(`/api/inventory/${userId}`, {
      params: { username, userUuid },
      cacheType: 'inventory',
      cacheKey: `inventory_${userUuid}`
    });
  }
  
  // 🧱 재료 조회
  async getMaterials(userId, username, userUuid) {
    return this.cachedGet(`/api/materials/${userId}`, {
      params: { username, userUuid },
      cacheType: 'materials',
      cacheKey: `materials_${userUuid}`
    });
  }
  
  // 💰 돈 조회
  async getMoney(userId, username, userUuid) {
    return this.cachedGet(`/api/money/${userId}`, {
      params: { username, userUuid },
      cacheType: 'userMoney',
      cacheKey: `money_${userUuid}`
    });
  }
  
  // 🏆 랭킹 조회
  async getRanking() {
    return this.cachedGet('/api/ranking', {
      cacheType: 'ranking',
      cacheKey: 'global_ranking'
    });
  }
  
  // 👥 접속자 조회 (관리자만)
  async getConnectedUsers(token) {
    return this.cachedGet('/api/connected-users', {
      cacheType: 'connectedUsers',
      cacheKey: 'connected_users',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
  }
  
  // 🎣 물고기 판매
  async sellFish(fishName, quantity, totalPrice) {
    return this.post('/api/sell-fish', 
      { fishName, quantity, totalPrice },
      { 
        invalidatePatterns: ['inventory', 'userMoney'],
        invalidateUserCache: true
      }
    );
  }
  
  // ⚔️ 전투 시작
  async startBattle(material, baseFish, selectedPrefix, username, userUuid) {
    return this.post('/api/start-battle', 
      { material, baseFish, selectedPrefix },
      { 
        params: { username, userUuid },
        invalidatePatterns: ['materials'],
        invalidateUserCache: true
      }
    );
  }
  
  // 🎯 캐시 워밍업 (게임 시작 시)
  async warmupGameCache(userInfo) {
    const { userId, username, userUuid } = userInfo;
    
    const endpoints = [
      { url: `/api/inventory/${userId}`, params: { username, userUuid }, cacheType: 'inventory' },
      { url: `/api/materials/${userId}`, params: { username, userUuid }, cacheType: 'materials' },
      { url: `/api/money/${userId}`, params: { username, userUuid }, cacheType: 'userMoney' },
      { url: '/api/ranking', params: {}, cacheType: 'ranking' }
      // connected-users는 관리자만 접근 가능하므로 warmup에서 제외
    ];
    
    await this.warmupCache(endpoints);
  }
}

export default GameApiClient;
export { CachedApiClient };
