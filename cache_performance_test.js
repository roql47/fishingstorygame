#!/usr/bin/env node

/**
 * 🚀 캐시 시스템 성능 테스트 스크립트
 * 캐시 히트/미스 최적화 효과 측정
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

// 서버 URL 설정
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';

// 테스트 사용자 데이터
const TEST_USERS = [
  { username: 'test_user1', userUuid: 'test-uuid-001' },
  { username: 'test_user2', userUuid: 'test-uuid-002' },
  { username: 'test_user3', userUuid: 'test-uuid-003' }
];

// 테스트 시나리오
const TEST_SCENARIOS = {
  // 🎯 캐시 히트 테스트
  cacheHitTest: {
    name: '캐시 히트 테스트',
    description: '동일한 API를 연속 호출하여 캐시 히트율 측정',
    iterations: 10,
    apis: [
      { url: '/api/inventory/user', type: 'inventory' },
      { url: '/api/materials/user', type: 'materials' },
      { url: '/api/ranking', type: 'ranking' }
    ]
  },
  
  // ⚡ 동시 요청 테스트
  concurrentTest: {
    name: '동시 요청 테스트',
    description: '여러 사용자의 동시 API 호출 성능 측정',
    concurrency: 5,
    iterations: 3,
    apis: [
      { url: '/api/inventory/user', type: 'inventory' },
      { url: '/api/money/user', type: 'money' }
    ]
  },
  
  // 🔄 캐시 무효화 테스트
  invalidationTest: {
    name: '캐시 무효화 테스트',
    description: '데이터 변경 시 캐시 무효화 성능 측정',
    iterations: 5,
    writeApis: [
      { url: '/api/sell-fish', data: { fishName: '일반 물고기', quantity: 1, totalPrice: 100 } }
    ],
    readApis: [
      { url: '/api/inventory/user', type: 'inventory' },
      { url: '/api/money/user', type: 'money' }
    ]
  }
};

/**
 * 📊 성능 측정 클래스
 */
class PerformanceMeasurer {
  constructor() {
    this.results = [];
    this.startTime = 0;
    this.endTime = 0;
  }
  
  start() {
    this.startTime = performance.now();
  }
  
  end() {
    this.endTime = performance.now();
    return this.endTime - this.startTime;
  }
  
  addResult(testName, duration, metadata = {}) {
    this.results.push({
      testName,
      duration,
      timestamp: new Date().toISOString(),
      ...metadata
    });
  }
  
  getStats() {
    if (this.results.length === 0) return null;
    
    const durations = this.results.map(r => r.duration);
    const sum = durations.reduce((a, b) => a + b, 0);
    const avg = sum / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);
    
    // 중앙값 계산
    const sorted = durations.sort((a, b) => a - b);
    const median = sorted.length % 2 === 0 
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    
    return {
      count: this.results.length,
      average: avg.toFixed(2),
      median: median.toFixed(2),
      min: min.toFixed(2),
      max: max.toFixed(2),
      total: sum.toFixed(2)
    };
  }
}

/**
 * 🎯 캐시 히트 테스트
 */
async function runCacheHitTest() {
  console.log('\n🎯 캐시 히트 테스트 시작...');
  const measurer = new PerformanceMeasurer();
  const scenario = TEST_SCENARIOS.cacheHitTest;
  
  for (const api of scenario.apis) {
    console.log(`\n📊 테스트 API: ${api.url}`);
    
    for (let i = 1; i <= scenario.iterations; i++) {
      try {
        measurer.start();
        
        const params = api.url.includes('/user') ? TEST_USERS[0] : {};
        const response = await axios.get(`${SERVER_URL}${api.url}`, { params });
        
        const duration = measurer.end();
        measurer.addResult(`${api.type}_${i}`, duration, {
          api: api.url,
          iteration: i,
          cacheExpected: i > 1, // 첫 번째 요청 이후는 캐시 히트 예상
          dataSize: JSON.stringify(response.data).length
        });
        
        console.log(`  ${i}회차: ${duration.toFixed(2)}ms ${i > 1 ? '(캐시 예상)' : '(DB 조회)'}`);
        
        // 캐시 TTL보다 짧은 간격으로 요청
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`  ${i}회차 실패:`, error.message);
      }
    }
  }
  
  const stats = measurer.getStats();
  console.log('\n📈 캐시 히트 테스트 결과:');
  console.log(`  총 요청: ${stats.count}회`);
  console.log(`  평균 응답시간: ${stats.average}ms`);
  console.log(`  중앙값: ${stats.median}ms`);
  console.log(`  최소/최대: ${stats.min}ms / ${stats.max}ms`);
  
  return { testName: 'cacheHit', stats, results: measurer.results };
}

/**
 * ⚡ 동시 요청 테스트
 */
async function runConcurrentTest() {
  console.log('\n⚡ 동시 요청 테스트 시작...');
  const scenario = TEST_SCENARIOS.concurrentTest;
  
  const allResults = [];
  
  for (let iteration = 1; iteration <= scenario.iterations; iteration++) {
    console.log(`\n🔄 ${iteration}번째 동시 요청 테스트`);
    
    const promises = [];
    const startTime = performance.now();
    
    // 동시 요청 생성
    for (let i = 0; i < scenario.concurrency; i++) {
      for (const api of scenario.apis) {
        const measurer = new PerformanceMeasurer();
        const userIndex = i % TEST_USERS.length;
        const params = api.url.includes('/user') ? TEST_USERS[userIndex] : {};
        
        const promise = (async () => {
          try {
            measurer.start();
            const response = await axios.get(`${SERVER_URL}${api.url}`, { params });
            const duration = measurer.end();
            
            return {
              api: api.url,
              user: userIndex,
              duration,
              success: true,
              dataSize: JSON.stringify(response.data).length
            };
          } catch (error) {
            const duration = measurer.end();
            return {
              api: api.url,
              user: userIndex,
              duration,
              success: false,
              error: error.message
            };
          }
        })();
        
        promises.push(promise);
      }
    }
    
    // 모든 요청 완료 대기
    const results = await Promise.all(promises);
    const totalTime = performance.now() - startTime;
    
    // 결과 분석
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`  동시 요청 ${results.length}개 완료: ${totalTime.toFixed(2)}ms`);
    console.log(`  성공: ${successful.length}개, 실패: ${failed.length}개`);
    
    if (successful.length > 0) {
      const avgDuration = successful.reduce((sum, r) => sum + r.duration, 0) / successful.length;
      console.log(`  평균 응답시간: ${avgDuration.toFixed(2)}ms`);
    }
    
    allResults.push({
      iteration,
      totalTime,
      results,
      successRate: (successful.length / results.length * 100).toFixed(2) + '%'
    });
    
    // 다음 테스트 전 잠시 대기
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return { testName: 'concurrent', results: allResults };
}

/**
 * 🔄 캐시 무효화 테스트
 */
async function runInvalidationTest() {
  console.log('\n🔄 캐시 무효화 테스트 시작...');
  const scenario = TEST_SCENARIOS.invalidationTest;
  const testUser = TEST_USERS[0];
  
  const results = [];
  
  for (let iteration = 1; iteration <= scenario.iterations; iteration++) {
    console.log(`\n${iteration}번째 무효화 테스트`);
    
    // 1. 읽기 요청으로 캐시 생성
    console.log('  1️⃣ 캐시 생성을 위한 읽기 요청...');
    const initialReads = [];
    
    for (const readApi of scenario.readApis) {
      const measurer = new PerformanceMeasurer();
      measurer.start();
      
      try {
        await axios.get(`${SERVER_URL}${readApi.url}`, { params: testUser });
        const duration = measurer.end();
        initialReads.push({ api: readApi.url, duration, phase: 'cache_creation' });
        console.log(`    ${readApi.type}: ${duration.toFixed(2)}ms`);
      } catch (error) {
        console.error(`    ${readApi.type} 실패:`, error.message);
      }
    }
    
    // 2. 쓰기 요청으로 캐시 무효화
    console.log('  2️⃣ 쓰기 요청으로 캐시 무효화...');
    const writeResults = [];
    
    for (const writeApi of scenario.writeApis) {
      const measurer = new PerformanceMeasurer();
      measurer.start();
      
      try {
        await axios.post(`${SERVER_URL}${writeApi.url}`, writeApi.data, { params: testUser });
        const duration = measurer.end();
        writeResults.push({ api: writeApi.url, duration, phase: 'invalidation' });
        console.log(`    쓰기 요청: ${duration.toFixed(2)}ms`);
      } catch (error) {
        console.error(`    쓰기 요청 실패:`, error.message);
      }
    }
    
    // 3. 읽기 요청으로 캐시 재생성 확인
    console.log('  3️⃣ 캐시 재생성 확인...');
    const revalidationReads = [];
    
    for (const readApi of scenario.readApis) {
      const measurer = new PerformanceMeasurer();
      measurer.start();
      
      try {
        await axios.get(`${SERVER_URL}${readApi.url}`, { params: testUser });
        const duration = measurer.end();
        revalidationReads.push({ api: readApi.url, duration, phase: 'revalidation' });
        console.log(`    ${readApi.type}: ${duration.toFixed(2)}ms (재생성)`);
      } catch (error) {
        console.error(`    ${readApi.type} 실패:`, error.message);
      }
    }
    
    results.push({
      iteration,
      initialReads,
      writeResults,
      revalidationReads
    });
    
    // 다음 테스트 전 대기
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  return { testName: 'invalidation', results };
}

/**
 * 📊 캐시 통계 조회
 */
async function getCacheStats() {
  try {
    const response = await axios.get(`${SERVER_URL}/api/cache-stats`);
    return response.data;
  } catch (error) {
    console.warn('캐시 통계 조회 실패:', error.message);
    return null;
  }
}

/**
 * 📈 종합 리포트 생성
 */
function generateReport(testResults, initialStats, finalStats) {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 캐시 성능 테스트 종합 리포트');
  console.log('='.repeat(60));
  
  // 서버 캐시 통계 변화
  if (initialStats && finalStats) {
    console.log('\n📊 서버 캐시 통계 변화:');
    console.log(`  히트율: ${initialStats.overall?.hitRate || 'N/A'} → ${finalStats.overall?.hitRate || 'N/A'}`);
    console.log(`  총 요청: ${initialStats.overall?.total || 0} → ${finalStats.overall?.total || 0}`);
    
    const improvement = finalStats.overall?.hitRate && initialStats.overall?.hitRate
      ? (parseFloat(finalStats.overall.hitRate) - parseFloat(initialStats.overall.hitRate)).toFixed(2)
      : 'N/A';
    
    if (improvement !== 'N/A') {
      console.log(`  히트율 개선: ${improvement > 0 ? '+' : ''}${improvement}%`);
    }
  }
  
  // 테스트별 결과 요약
  testResults.forEach(result => {
    console.log(`\n🎯 ${result.testName.toUpperCase()} 테스트 결과:`);
    
    switch (result.testName) {
      case 'cacheHit':
        console.log(`  총 요청: ${result.stats.count}회`);
        console.log(`  평균 응답시간: ${result.stats.average}ms`);
        console.log(`  성능 개선 예상: 캐시 히트 시 ${((result.results[0]?.duration || 0) / (result.stats.average || 1) * 100 - 100).toFixed(1)}% 빨라짐`);
        break;
        
      case 'concurrent':
        const avgSuccessRate = result.results.reduce((sum, r) => sum + parseFloat(r.successRate), 0) / result.results.length;
        console.log(`  평균 성공률: ${avgSuccessRate.toFixed(2)}%`);
        console.log(`  동시 처리 성능: ${result.results.length}회 테스트 완료`);
        break;
        
      case 'invalidation':
        console.log(`  무효화 테스트: ${result.results.length}회 완료`);
        console.log(`  캐시 무효화 → 재생성 사이클 검증`);
        break;
    }
  });
  
  // 권장사항
  console.log('\n💡 최적화 권장사항:');
  
  if (finalStats?.recommendations) {
    finalStats.recommendations.forEach(rec => {
      console.log(`  • ${rec}`);
    });
  } else {
    console.log('  • 캐시 히트율 70% 이상 유지');
    console.log('  • 자주 변경되는 데이터의 TTL 단축');
    console.log('  • 정적 데이터의 TTL 연장');
    console.log('  • 주기적 캐시 성능 모니터링');
  }
  
  console.log('\n✅ 캐시 최적화 테스트 완료');
}

/**
 * 🚀 메인 테스트 실행
 */
async function runCachePerformanceTest() {
  console.log('🚀 캐시 시스템 성능 테스트 시작');
  console.log('=====================================');
  console.log(`서버 URL: ${SERVER_URL}`);
  console.log(`테스트 시작 시간: ${new Date().toLocaleString()}`);
  
  try {
    // 초기 캐시 통계
    const initialStats = await getCacheStats();
    
    // 테스트 실행
    const testResults = [];
    
    testResults.push(await runCacheHitTest());
    testResults.push(await runConcurrentTest());
    testResults.push(await runInvalidationTest());
    
    // 최종 캐시 통계
    const finalStats = await getCacheStats();
    
    // 종합 리포트
    generateReport(testResults, initialStats, finalStats);
    
  } catch (error) {
    console.error('❌ 테스트 실행 중 오류 발생:', error.message);
    console.log('\n💡 해결 방법:');
    console.log('1. 서버가 실행 중인지 확인하세요');
    console.log('2. 캐시 시스템이 활성화되어 있는지 확인하세요');
    console.log('3. 네트워크 연결을 확인하세요');
  }
}

// 스크립트가 직접 실행될 때만 테스트 실행
if (require.main === module) {
  runCachePerformanceTest();
}

module.exports = {
  runCachePerformanceTest,
  runCacheHitTest,
  runConcurrentTest,
  runInvalidationTest,
  getCacheStats
};
