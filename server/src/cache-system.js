/**
 * 🚀 강화된 다중 레벨 캐시 시스템
 * 캐시 미스/히트 최적화를 통한 레이턴시 대폭 개선
 */

// 🎯 다중 캐시 저장소
const dataCache = new Map();        // 사용자 데이터 캐시
const queryCache = new Map();       // DB 쿼리 결과 캐시
const staticDataCache = new Map();  // 정적 데이터 캐시 (게임 데이터 등)
const computedCache = new Map();    // 계산 결과 캐시

// ⏰ 캐시 TTL 설정 (밀리초)
const CACHE_TTL = {
  // 사용자 데이터
  fishingSkill: 5 * 60 * 1000,      // 5분
  userMoney: 30 * 1000,             // 30초
  userAmber: 30 * 1000,             // 30초
  starPieces: 30 * 1000,            // 30초
  inventory: 10 * 1000,             // 10초 (자주 변경됨)
  materials: 15 * 1000,             // 15초
  equipment: 2 * 60 * 1000,         // 2분
  companions: 10 * 60 * 1000,       // 10분
  
  // 레이드 전용 캐시 (짧은 TTL로 실시간성 유지)
  raidUserData: 5 * 1000,           // 5초 (사용자 기본 정보)
  raidFishingSkill: 10 * 1000,      // 10초 (낚시 실력)
  raidCompanions: 15 * 1000,        // 15초 (동료 정보)
  raidEquipment: 15 * 1000,         // 15초 (장비 정보)
  raidAchievements: 30 * 1000,      // 30초 (업적 보너스)
  
  // 시스템 데이터
  ranking: 60 * 1000,               // 1분
  connectedUsers: 5 * 1000,         // 5초
  
  // 정적 데이터
  staticData: 24 * 60 * 60 * 1000,  // 24시간
  gameData: 12 * 60 * 60 * 1000,    // 12시간
  
  // 계산 결과
  fishPrice: 5 * 60 * 1000,         // 5분
  battleStats: 2 * 60 * 1000,       // 2분
  
  // DB 쿼리
  aggregation: 3 * 60 * 1000,       // 3분
  count: 1 * 60 * 1000              // 1분
};

// 📊 캐시 성능 모니터링
const cacheStats = {
  hits: 0,
  misses: 0,
  totalRequests: 0,
  hitsByType: {},
  missesByType: {},
  
  getHitRate() {
    return this.totalRequests > 0 ? (this.hits / this.totalRequests * 100).toFixed(2) + '%' : '0%';
  },
  
  getTypeStats(type) {
    const hits = this.hitsByType[type] || 0;
    const misses = this.missesByType[type] || 0;
    const total = hits + misses;
    const rate = total > 0 ? (hits / total * 100).toFixed(2) + '%' : '0%';
    return { hits, misses, total, rate };
  },
  
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
  
  reset() {
    this.hits = 0;
    this.misses = 0;
    this.totalRequests = 0;
    this.hitsByType = {};
    this.missesByType = {};
  },
  
  getReport() {
    return {
      overall: {
        hits: this.hits,
        misses: this.misses,
        total: this.totalRequests,
        hitRate: this.getHitRate()
      },
      byType: Object.keys({...this.hitsByType, ...this.missesByType}).map(type => ({
        type,
        ...this.getTypeStats(type)
      })),
      cacheSize: {
        dataCache: dataCache.size,
        queryCache: queryCache.size,
        staticDataCache: staticDataCache.size,
        computedCache: computedCache.size
      }
    };
  }
};

// 🎯 스마트 캐시 조회 (다중 레벨)
function getCachedData(cacheType, cacheKey, userKey) {
  const key = userKey ? `${cacheKey}:${userKey}` : cacheKey;
  const ttl = CACHE_TTL[cacheType] || 60000; // 기본 1분
  
  let cache;
  switch (cacheType) {
    case 'staticData':
    case 'gameData':
      cache = staticDataCache;
      break;
    case 'aggregation':
    case 'count':
      cache = queryCache;
      break;
    case 'fishPrice':
    case 'battleStats':
      cache = computedCache;
      break;
    default:
      cache = dataCache;
  }
  
  const cached = cache.get(key);
  
  if (cached && Date.now() - cached.timestamp < ttl) {
    cacheStats.recordHit(cacheType);
    console.log(`🎯 캐시 히트: ${cacheType}:${key} (${Date.now() - cached.timestamp}ms ago)`);
    return cached.data;
  }
  
  cacheStats.recordMiss(cacheType);
  if (cached) {
    console.log(`⏰ 캐시 만료: ${cacheType}:${key} (${Date.now() - cached.timestamp}ms old, TTL: ${ttl}ms)`);
  } else {
    console.log(`❌ 캐시 미스: ${cacheType}:${key}`);
  }
  
  return null;
}

// 💾 스마트 캐시 저장 (다중 레벨)
function setCachedData(cacheType, cacheKey, data, userKey = null) {
  const key = userKey ? `${cacheKey}:${userKey}` : cacheKey;
  
  let cache;
  switch (cacheType) {
    case 'staticData':
    case 'gameData':
      cache = staticDataCache;
      break;
    case 'aggregation':
    case 'count':
      cache = queryCache;
      break;
    case 'fishPrice':
    case 'battleStats':
      cache = computedCache;
      break;
    default:
      cache = dataCache;
  }
  
  cache.set(key, { 
    data, 
    timestamp: Date.now(),
    type: cacheType,
    accessCount: 1
  });
  
  console.log(`💾 캐시 저장: ${cacheType}:${key}`);
  
  // 캐시 크기 제한 (메모리 관리)
  const maxSize = getMaxCacheSize(cacheType);
  if (cache.size > maxSize) {
    cleanupCache(cache, Math.floor(maxSize * 0.8)); // 80%로 정리
  }
}

// 🧹 지능형 캐시 정리 (LRU + 접근 빈도 고려)
function cleanupCache(cache, targetSize) {
  const entries = Array.from(cache.entries())
    .map(([key, value]) => ({
      key,
      ...value,
      score: calculateCacheScore(value)
    }))
    .sort((a, b) => a.score - b.score); // 낮은 점수부터 제거
  
  const toRemove = entries.slice(0, cache.size - targetSize);
  toRemove.forEach(entry => cache.delete(entry.key));
  
  console.log(`🧹 캐시 정리 완료: ${toRemove.length}개 항목 제거`);
}

// 📊 캐시 점수 계산 (최근성 + 접근 빈도)
function calculateCacheScore(cacheEntry) {
  const age = Date.now() - cacheEntry.timestamp;
  const accessCount = cacheEntry.accessCount || 1;
  
  // 점수가 낮을수록 제거 우선순위 높음
  return age / Math.log(accessCount + 1);
}

// 📏 캐시 타입별 최대 크기
function getMaxCacheSize(cacheType) {
  switch (cacheType) {
    case 'staticData':
    case 'gameData':
      return 100;   // 정적 데이터는 적게
    case 'aggregation':
    case 'count':
      return 500;   // 쿼리 결과는 중간
    case 'fishPrice':
    case 'battleStats':
      return 200;   // 계산 결과는 적당히
    default:
      return 1000;  // 사용자 데이터는 많이
  }
}

// 🗑️ 캐시 무효화 (스마트 패턴 매칭)
function invalidateCache(pattern, userKey = null) {
  const caches = [dataCache, queryCache, staticDataCache, computedCache];
  let totalInvalidated = 0;
  
  caches.forEach(cache => {
    const keysToDelete = [];
    
    for (const key of cache.keys()) {
      if (matchesCachePattern(key, pattern, userKey)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      cache.delete(key);
      totalInvalidated++;
    });
  });
  
  console.log(`🗑️ 캐시 무효화: ${pattern} (${totalInvalidated}개 항목)`);
  return totalInvalidated;
}

// 🔍 캐시 패턴 매칭
function matchesCachePattern(cacheKey, pattern, userKey) {
  if (userKey && cacheKey.includes(`:${userKey}`)) {
    return true;
  }
  
  if (typeof pattern === 'string') {
    return cacheKey.includes(pattern);
  }
  
  if (pattern instanceof RegExp) {
    return pattern.test(cacheKey);
  }
  
  return false;
}

// 🚀 캐시 워밍업 (자주 사용되는 데이터 미리 로드)
async function warmupCache(warmupFunctions = {}) {
  console.log('🚀 캐시 워밍업 시작...');
  
  const warmupTasks = Object.entries(warmupFunctions).map(async ([type, func]) => {
    try {
      const startTime = Date.now();
      await func();
      const duration = Date.now() - startTime;
      console.log(`✅ ${type} 워밍업 완료: ${duration}ms`);
    } catch (error) {
      console.error(`❌ ${type} 워밍업 실패:`, error.message);
    }
  });
  
  await Promise.all(warmupTasks);
  console.log('🚀 캐시 워밍업 완료');
}

// 📈 캐시 성능 리포트 (주기적 실행)
function startCacheMonitoring(intervalMs = 5 * 60 * 1000) { // 5분마다
  setInterval(() => {
    const report = cacheStats.getReport();
    console.log('📈 캐시 성능 리포트:', JSON.stringify(report, null, 2));
    
    // 히트율이 낮으면 경고
    const hitRate = parseFloat(report.overall.hitRate);
    if (hitRate < 70) {
      console.warn(`⚠️ 캐시 히트율 낮음: ${report.overall.hitRate} (목표: 70% 이상)`);
    }
  }, intervalMs);
}

// 🔄 캐시 통계 리셋 (일일 리셋)
function startDailyReset() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const msUntilMidnight = tomorrow.getTime() - now.getTime();
  
  setTimeout(() => {
    console.log('🔄 일일 캐시 통계 리셋');
    cacheStats.reset();
    
    // 매일 자정마다 리셋
    setInterval(() => {
      console.log('🔄 일일 캐시 통계 리셋');
      cacheStats.reset();
    }, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);
}

module.exports = {
  getCachedData,
  setCachedData,
  invalidateCache,
  warmupCache,
  startCacheMonitoring,
  startDailyReset,
  cacheStats,
  
  // 캐시 인스턴스 (디버깅용)
  dataCache,
  queryCache,
  staticDataCache,
  computedCache,
  CACHE_TTL
};
