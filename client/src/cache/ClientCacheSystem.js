/**
 * 🚀 클라이언트 측 스마트 캐시 시스템
 * 레이턴시 최적화를 위한 다중 레벨 캐시
 */

class ClientCacheSystem {
  constructor() {
    // 🎯 다중 캐시 저장소
    this.memoryCache = new Map();     // 메모리 캐시 (가장 빠름)
    this.sessionCache = new Map();    // 세션 캐시 (탭 닫을 때까지)
    this.localStorageCache = new Map(); // 로컬스토리지 캐시 (영구)
    
    // ⏰ TTL 설정 (밀리초)
    this.TTL = {
      // 사용자 데이터
      inventory: 10 * 1000,         // 10초
      materials: 15 * 1000,         // 15초
      userMoney: 30 * 1000,         // 30초
      userAmber: 30 * 1000,         // 30초
      fishingSkill: 5 * 60 * 1000,  // 5분
      equipment: 2 * 60 * 1000,     // 2분
      
      // 시스템 데이터
      ranking: 60 * 1000,           // 1분
      connectedUsers: 5 * 1000,     // 5초
      
      // 정적 데이터
      gameData: 24 * 60 * 60 * 1000, // 24시간
      fishPrices: 5 * 60 * 1000,    // 5분
      
      // API 응답
      apiResponse: 2 * 60 * 1000,   // 2분
      
      // 계산 결과
      calculations: 1 * 60 * 1000   // 1분
    };
    
    // 📊 성능 통계
    this.stats = {
      hits: 0,
      misses: 0,
      totalRequests: 0,
      hitsByType: {},
      missesByType: {},
      
      recordHit(type) {
        this.hits++;
        this.totalRequests++;
        this.hitsByType[type] = (this.hitsByType[type] || 0) + 1;
      },
      
      recordMiss(type) {
        this.misses++;
        this.totalRequests++;
        this.missesByType[type] = (this.missesByType[type] || 0) + 1;
      },
      
      getHitRate() {
        return this.totalRequests > 0 ? 
          (this.hits / this.totalRequests * 100).toFixed(2) + '%' : '0%';
      },
      
      reset() {
        this.hits = 0;
        this.misses = 0;
        this.totalRequests = 0;
        this.hitsByType = {};
        this.missesByType = {};
      }
    };
    
    // 🔄 주기적 정리
    this.startPeriodicCleanup();
    
    // 📈 성능 모니터링
    this.startPerformanceMonitoring();
  }
  
  // 🎯 스마트 캐시 조회
  get(key, type = 'default') {
    const cacheEntry = this.getCacheEntry(key, type);
    
    if (cacheEntry && this.isValid(cacheEntry, type)) {
      this.stats.recordHit(type);
      this.updateAccessInfo(key, type);
      console.log(`🎯 클라이언트 캐시 히트: ${type}:${key}`);
      return cacheEntry.data;
    }
    
    this.stats.recordMiss(type);
    console.log(`❌ 클라이언트 캐시 미스: ${type}:${key}`);
    return null;
  }
  
  // 💾 스마트 캐시 저장
  set(key, data, type = 'default', options = {}) {
    const cacheEntry = {
      data,
      timestamp: Date.now(),
      type,
      accessCount: 1,
      lastAccess: Date.now(),
      persistent: options.persistent || false,
      priority: options.priority || 1 // 1: 낮음, 2: 보통, 3: 높음
    };
    
    // 캐시 레벨 결정
    const cacheLevel = this.determineCacheLevel(type, options);
    
    switch (cacheLevel) {
      case 'localStorage':
        this.setInLocalStorage(key, cacheEntry);
        break;
      case 'session':
        this.sessionCache.set(key, cacheEntry);
        break;
      default:
        this.memoryCache.set(key, cacheEntry);
    }
    
    console.log(`💾 클라이언트 캐시 저장: ${type}:${key} (레벨: ${cacheLevel})`);
    
    // 캐시 크기 관리
    this.manageCacheSize();
  }
  
  // 🔍 캐시 항목 조회 (다중 레벨)
  getCacheEntry(key, type) {
    // 1. 메모리 캐시 우선 확인
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key);
    }
    
    // 2. 세션 캐시 확인
    if (this.sessionCache.has(key)) {
      const entry = this.sessionCache.get(key);
      // 자주 사용되면 메모리로 승격
      if (entry.accessCount > 3) {
        this.memoryCache.set(key, entry);
      }
      return entry;
    }
    
    // 3. 로컬스토리지 확인
    const localEntry = this.getFromLocalStorage(key);
    if (localEntry) {
      // 자주 사용되면 메모리로 승격
      if (localEntry.accessCount > 5) {
        this.memoryCache.set(key, localEntry);
      }
      return localEntry;
    }
    
    return null;
  }
  
  // ✅ 캐시 유효성 검사
  isValid(cacheEntry, type) {
    const ttl = this.TTL[type] || this.TTL.default || 60000;
    const age = Date.now() - cacheEntry.timestamp;
    return age < ttl;
  }
  
  // 📊 접근 정보 업데이트
  updateAccessInfo(key, type) {
    const updateEntry = (cache) => {
      if (cache.has(key)) {
        const entry = cache.get(key);
        entry.accessCount++;
        entry.lastAccess = Date.now();
        cache.set(key, entry);
      }
    };
    
    updateEntry(this.memoryCache);
    updateEntry(this.sessionCache);
    
    // 로컬스토리지는 성능상 업데이트 스킵
  }
  
  // 🎚️ 캐시 레벨 결정
  determineCacheLevel(type, options) {
    if (options.persistent || this.isPersistentType(type)) {
      return 'localStorage';
    }
    
    if (this.isSessionType(type)) {
      return 'session';
    }
    
    return 'memory';
  }
  
  // 🔒 영구 캐시 타입 판단
  isPersistentType(type) {
    const persistentTypes = ['gameData', 'userSettings', 'fishPrices'];
    return persistentTypes.includes(type);
  }
  
  // 📱 세션 캐시 타입 판단
  isSessionType(type) {
    const sessionTypes = ['ranking', 'connectedUsers', 'apiResponse'];
    return sessionTypes.includes(type);
  }
  
  // 💾 로컬스토리지 저장
  setInLocalStorage(key, cacheEntry) {
    try {
      const storageKey = `cache:${key}`;
      localStorage.setItem(storageKey, JSON.stringify(cacheEntry));
      this.localStorageCache.set(key, cacheEntry);
    } catch (error) {
      console.warn('로컬스토리지 저장 실패:', error);
      // 폴백: 세션 캐시 사용
      this.sessionCache.set(key, cacheEntry);
    }
  }
  
  // 📱 로컬스토리지 조회
  getFromLocalStorage(key) {
    try {
      const storageKey = `cache:${key}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const entry = JSON.parse(stored);
        this.localStorageCache.set(key, entry);
        return entry;
      }
    } catch (error) {
      console.warn('로컬스토리지 조회 실패:', error);
    }
    return null;
  }
  
  // 🗑️ 캐시 무효화
  invalidate(pattern) {
    let invalidated = 0;
    
    // 패턴 매칭으로 키 찾기
    const matchingKeys = this.findMatchingKeys(pattern);
    
    matchingKeys.forEach(key => {
      this.memoryCache.delete(key);
      this.sessionCache.delete(key);
      
      try {
        localStorage.removeItem(`cache:${key}`);
        this.localStorageCache.delete(key);
      } catch (error) {
        console.warn('로컬스토리지 삭제 실패:', error);
      }
      
      invalidated++;
    });
    
    console.log(`🗑️ 클라이언트 캐시 무효화: ${pattern} (${invalidated}개 항목)`);
    return invalidated;
  }
  
  // 🔍 패턴 매칭 키 찾기
  findMatchingKeys(pattern) {
    const allKeys = new Set([
      ...this.memoryCache.keys(),
      ...this.sessionCache.keys(),
      ...this.localStorageCache.keys()
    ]);
    
    return Array.from(allKeys).filter(key => {
      if (typeof pattern === 'string') {
        return key.includes(pattern);
      }
      if (pattern instanceof RegExp) {
        return pattern.test(key);
      }
      return false;
    });
  }
  
  // 🧹 주기적 정리
  startPeriodicCleanup() {
    // 5분마다 만료된 캐시 정리
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 5 * 60 * 1000);
    
    // 30분마다 사용 빈도가 낮은 캐시 정리
    setInterval(() => {
      this.cleanupLowUsageEntries();
    }, 30 * 60 * 1000);
  }
  
  // 🧹 만료된 항목 정리
  cleanupExpiredEntries() {
    let cleaned = 0;
    
    [this.memoryCache, this.sessionCache].forEach(cache => {
      for (const [key, entry] of cache.entries()) {
        if (!this.isValid(entry, entry.type)) {
          cache.delete(key);
          cleaned++;
        }
      }
    });
    
    if (cleaned > 0) {
      console.log(`🧹 만료된 캐시 정리: ${cleaned}개 항목`);
    }
  }
  
  // 🧹 사용 빈도 낮은 항목 정리
  cleanupLowUsageEntries() {
    const maxSize = 500; // 최대 캐시 항목 수
    
    if (this.memoryCache.size > maxSize) {
      const entries = Array.from(this.memoryCache.entries())
        .map(([key, entry]) => ({
          key,
          entry,
          score: this.calculateCacheScore(entry)
        }))
        .sort((a, b) => a.score - b.score); // 낮은 점수부터
      
      const toRemove = entries.slice(0, this.memoryCache.size - Math.floor(maxSize * 0.8));
      toRemove.forEach(({ key }) => this.memoryCache.delete(key));
      
      console.log(`🧹 저사용 캐시 정리: ${toRemove.length}개 항목`);
    }
  }
  
  // 📏 캐시 크기 관리
  manageCacheSize() {
    const maxMemorySize = 200;
    const maxSessionSize = 300;
    
    if (this.memoryCache.size > maxMemorySize) {
      this.cleanupLowUsageEntries();
    }
    
    if (this.sessionCache.size > maxSessionSize) {
      // 가장 오래된 항목부터 제거
      const oldestKeys = Array.from(this.sessionCache.entries())
        .sort((a, b) => a[1].lastAccess - b[1].lastAccess)
        .slice(0, 50)
        .map(([key]) => key);
      
      oldestKeys.forEach(key => this.sessionCache.delete(key));
    }
  }
  
  // 📊 캐시 점수 계산
  calculateCacheScore(entry) {
    const age = Date.now() - entry.timestamp;
    const timeSinceLastAccess = Date.now() - entry.lastAccess;
    const accessFrequency = entry.accessCount;
    const priority = entry.priority || 1;
    
    // 낮을수록 제거 우선순위 높음
    return (age + timeSinceLastAccess) / (accessFrequency * priority);
  }
  
  // 📈 성능 모니터링
  startPerformanceMonitoring() {
    // 10분마다 성능 리포트
    setInterval(() => {
      const report = this.getPerformanceReport();
      console.log('📈 클라이언트 캐시 성능:', report);
    }, 10 * 60 * 1000);
  }
  
  // 📊 성능 리포트 생성
  getPerformanceReport() {
    return {
      hitRate: this.stats.getHitRate(),
      totalRequests: this.stats.totalRequests,
      cacheSize: {
        memory: this.memoryCache.size,
        session: this.sessionCache.size,
        localStorage: this.localStorageCache.size
      },
      topTypes: this.getTopCacheTypes()
    };
  }
  
  // 🏆 가장 많이 사용되는 캐시 타입
  getTopCacheTypes() {
    const typeStats = {};
    
    Object.entries(this.stats.hitsByType).forEach(([type, hits]) => {
      const misses = this.stats.missesByType[type] || 0;
      typeStats[type] = {
        hits,
        misses,
        total: hits + misses,
        hitRate: hits / (hits + misses) * 100
      };
    });
    
    return Object.entries(typeStats)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5)
      .map(([type, stats]) => ({ type, ...stats }));
  }
  
  // 🔄 캐시 초기화
  clear(type = null) {
    if (type) {
      this.invalidate(type);
    } else {
      this.memoryCache.clear();
      this.sessionCache.clear();
      this.localStorageCache.clear();
      
      // 로컬스토리지에서 캐시 키들 제거
      try {
        Object.keys(localStorage)
          .filter(key => key.startsWith('cache:'))
          .forEach(key => localStorage.removeItem(key));
      } catch (error) {
        console.warn('로컬스토리지 초기화 실패:', error);
      }
    }
    
    this.stats.reset();
    console.log('🔄 클라이언트 캐시 초기화 완료');
  }
}

// 🚀 전역 캐시 인스턴스
const clientCache = new ClientCacheSystem();

// 🔧 편의 함수들
export const useClientCache = () => {
  return {
    get: (key, type) => clientCache.get(key, type),
    set: (key, data, type, options) => clientCache.set(key, data, type, options),
    invalidate: (pattern) => clientCache.invalidate(pattern),
    getStats: () => clientCache.getPerformanceReport(),
    clear: (type) => clientCache.clear(type)
  };
};

export default clientCache;
