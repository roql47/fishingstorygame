const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");

// 🚀 강화된 캐시 시스템 임포트
const {
  getCachedData,
  setCachedData,
  invalidateCache,
  warmupCache,
  startCacheMonitoring,
  startDailyReset,
  cacheStats
} = require('./cache-system');

// 🚀 성능 최적화: 프로덕션 환경에서 로깅 축소
const isProduction = process.env.NODE_ENV === 'production';
const debugLog = isProduction ? () => {} : console.log;
const infoLog = console.log;
const errorLog = console.error;

// 🔍 DB 쿼리 성능 측정 헬퍼 함수 (캐시 통합)
const measureDBQuery = async (queryName, queryFunction, cacheKey = null, cacheType = 'aggregation') => {
  const startTime = Date.now();
  
  // 캐시 확인
  if (cacheKey) {
    const cached = getCachedData(cacheType, cacheKey);
    if (cached) {
      const duration = Date.now() - startTime;
      debugLog(`✅ DB 쿼리 캐시 히트: ${queryName} - ${duration}ms`);
      return cached;
    }
  }
  
  try {
    const result = await queryFunction();
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // 캐시 저장
    if (cacheKey && result) {
      setCachedData(cacheType, cacheKey, result);
    }
    
    // 느린 쿼리 감지
    if (duration > 200) {
      console.warn(`⚠️ 느린 DB 쿼리 감지: ${queryName} - ${duration}ms`);
    } else if (duration > 100) {
      debugLog(`🟡 보통 속도 쿼리: ${queryName} - ${duration}ms`);
    } else {
      debugLog(`✅ DB 쿼리 완료: ${queryName} - ${duration}ms`);
    }
    
    return result;
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.error(`❌ DB 쿼리 실패: ${queryName} - ${duration}ms`, error.message);
    throw error;
  }
};

// 🚀 캐시 최적화된 데이터 조회 함수들
async function getInventoryDataCached(userUuid) {
  return await measureDBQuery(
    "인벤토리조회", 
    async () => {
      const catches = await CatchModel.aggregate([
        { $match: { userUuid: userUuid } },
        { $project: { fish: 1, _id: 0 } },
        { $group: { _id: "$fish", count: { $sum: 1 } } },
        { $project: { _id: 0, fish: "$_id", count: 1 } },
        { $sort: { fish: 1 } }
      ], {
        allowDiskUse: false,
        cursor: { batchSize: 100 },
        maxTimeMS: 5000,
        collation: { locale: "simple" }
      });
      return catches;
    },
    `inventory:${userUuid}`,
    'inventory'
  );
}

async function getMaterialsDataCached(userUuid) {
  return await measureDBQuery(
    "재료조회",
    async () => {
      const materials = await MaterialModel.aggregate([
        { $match: { userUuid: userUuid } },
        { $project: { material: 1, _id: 0 } },
        { $group: { _id: "$material", count: { $sum: 1 } } },
        { $project: { _id: 0, material: "$_id", count: 1 } },
        { $sort: { material: 1 } }
      ], {
        allowDiskUse: false,
        cursor: { batchSize: 100 },
        maxTimeMS: 5000,
        collation: { locale: "simple" }
      });
      return materials;
    },
    `materials:${userUuid}`,
    'materials'
  );
}

async function getMoneyDataCached(userUuid) {
  const cached = getCachedData('userMoney', 'userMoney', userUuid);
  if (cached) return cached;

  const result = await measureDBQuery(
    "돈조회", 
    async () => {
      const userMoney = await UserMoneyModel.findOne(
        { userUuid }, 
        { money: 1, _id: 0 }
      ).lean();
      return { money: userMoney?.money || 0 };
    }
  );
  
  setCachedData('userMoney', 'userMoney', result, userUuid);
  return result;
}

async function getRankingDataCached() {
  return await measureDBQuery(
    "랭킹조회",
    async () => {
      const rankings = await UserUuidModel.aggregate([
        { $match: { totalFishCaught: { $gt: 0 } } },
        { $project: { 
          username: 1, 
          displayName: 1, 
          totalFishCaught: 1, 
          _id: 0 
        }},
        { $sort: { totalFishCaught: -1 } },
        { $limit: 50 }
      ]).exec();
      
      return rankings.map((user, index) => ({
        rank: index + 1,
        username: user.displayName || user.username,
        totalCatches: user.totalFishCaught
      }));
    },
    'global_ranking',
    'ranking'
  );
}

// 🚀 캐시 워밍업 함수들
const cacheWarmupFunctions = {
  gameData: async () => {
    // 정적 게임 데이터 캐시
    const gameDataTypes = ['fish', 'materials', 'equipment', 'probabilities'];
    for (const type of gameDataTypes) {
      setCachedData('gameData', type, await loadGameDataByType(type));
    }
  },
  
  ranking: async () => {
    // 랭킹 데이터 미리 로드
    await getRankingDataCached();
  },
  
  staticCalculations: async () => {
    // 자주 사용되는 계산 결과 캐시
    const commonFish = ['일반 물고기', '희귀 물고기', '전설 물고기'];
    for (const fish of commonFish) {
      const price = calculateFishPrice(fish);
      setCachedData('fishPrice', fish, price);
    }
  }
};

async function loadGameDataByType(type) {
  // 실제 게임 데이터 로딩 로직
  switch (type) {
    case 'fish':
      return require('./data/gameData').getFishData();
    case 'materials':
      return require('./data/gameData').getMaterialData();
    // ... 다른 타입들
    default:
      return null;
  }
}

function calculateFishPrice(fishName) {
  // 물고기 가격 계산 로직 (예시)
  const basePrices = {
    '일반 물고기': 100,
    '희귀 물고기': 500,
    '전설 물고기': 2000
  };
  return basePrices[fishName] || 50;
}

// 🚀 캐시 시스템 초기화
async function initializeCacheSystem() {
  console.log('🚀 강화된 캐시 시스템 초기화...');
  
  // 캐시 모니터링 시작
  startCacheMonitoring(3 * 60 * 1000); // 3분마다 리포트
  
  // 일일 통계 리셋
  startDailyReset();
  
  // 캐시 워밍업
  await warmupCache(cacheWarmupFunctions);
  
  console.log('✅ 캐시 시스템 초기화 완료');
}

// 🚀 캐시 무효화 트리거 함수들
function invalidateUserCache(userUuid, dataTypes = []) {
  if (dataTypes.length === 0) {
    // 모든 사용자 데이터 무효화
    invalidateCache('', userUuid);
  } else {
    // 특정 데이터 타입만 무효화
    dataTypes.forEach(type => {
      invalidateCache(`${type}:`, userUuid);
    });
  }
}

function invalidateGlobalCache(cacheTypes = []) {
  cacheTypes.forEach(type => {
    invalidateCache(type);
  });
}

// 📊 캐시 성능 API 엔드포인트
app.get("/api/cache-stats", (req, res) => {
  try {
    const report = cacheStats.getReport();
    res.json({
      success: true,
      ...report,
      recommendations: getCacheRecommendations(report)
    });
  } catch (error) {
    console.error("Failed to get cache stats:", error);
    res.status(500).json({ error: "Failed to get cache stats" });
  }
});

function getCacheRecommendations(report) {
  const recommendations = [];
  const hitRate = parseFloat(report.overall.hitRate);
  
  if (hitRate < 50) {
    recommendations.push("캐시 히트율이 매우 낮습니다. TTL 설정을 검토하세요.");
  } else if (hitRate < 70) {
    recommendations.push("캐시 히트율이 낮습니다. 자주 사용되는 데이터의 캐시 시간을 늘려보세요.");
  }
  
  if (report.cacheSize.dataCache > 800) {
    recommendations.push("데이터 캐시 크기가 큽니다. 캐시 정리 주기를 단축하세요.");
  }
  
  return recommendations;
}

// 🚀 메인 서버 시작 시 캐시 시스템 초기화
async function startServerWithCache() {
  try {
    // 기존 서버 초기화 코드...
    
    // 캐시 시스템 초기화
    await initializeCacheSystem();
    
    // 서버 시작
    const PORT = process.env.PORT || 4000;
    server.listen(PORT, () => {
      console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다`);
      console.log(`📊 캐시 시스템 활성화됨`);
    });
    
  } catch (error) {
    console.error("서버 시작 실패:", error);
    process.exit(1);
  }
}

// 캐시 최적화된 함수들 내보내기
module.exports = {
  measureDBQuery,
  getInventoryDataCached,
  getMaterialsDataCached,
  getMoneyDataCached,
  getRankingDataCached,
  invalidateUserCache,
  invalidateGlobalCache,
  startServerWithCache
};

// 서버가 메인 모듈로 실행될 때
if (require.main === module) {
  startServerWithCache();
}
