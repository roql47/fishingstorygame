#!/usr/bin/env node

/**
 * 🚀 병렬화 최적화 성능 테스트 스크립트
 * 
 * 이 스크립트는 최적화된 API들의 성능을 측정합니다.
 */

const axios = require('axios');

// 서버 URL 설정
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';

// 테스트 사용자 데이터
const TEST_USER = {
  username: 'test_user',
  userUuid: 'test-uuid-12345'
};

/**
 * API 호출 성능 측정 함수
 */
async function measureApiPerformance(apiName, apiCall) {
  const startTime = Date.now();
  
  try {
    const result = await apiCall();
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`✅ ${apiName}: ${duration}ms`);
    return { success: true, duration, result };
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`❌ ${apiName}: ${duration}ms (실패: ${error.message})`);
    return { success: false, duration, error: error.message };
  }
}

/**
 * 병렬 처리 vs 순차 처리 성능 비교
 */
async function comparePerformance() {
  console.log('🔄 성능 비교 테스트 시작...\n');

  // 1. 순차 처리 시뮬레이션 (기존 방식)
  console.log('📊 순차 처리 테스트:');
  const sequentialStart = Date.now();
  
  const sequential1 = await measureApiPerformance('인벤토리 조회', async () => {
    return axios.get(`${SERVER_URL}/api/inventory/user`, {
      params: TEST_USER
    });
  });
  
  const sequential2 = await measureApiPerformance('재료 조회', async () => {
    return axios.get(`${SERVER_URL}/api/materials/user`, {
      params: TEST_USER
    });
  });
  
  const sequential3 = await measureApiPerformance('랭킹 조회', async () => {
    return axios.get(`${SERVER_URL}/api/ranking`);
  });
  
  const sequentialTotal = Date.now() - sequentialStart;
  console.log(`🔢 순차 처리 총 시간: ${sequentialTotal}ms\n`);

  // 2. 병렬 처리 테스트 (최적화된 방식)
  console.log('⚡ 병렬 처리 테스트:');
  const parallelStart = Date.now();
  
  const [parallel1, parallel2, parallel3] = await Promise.all([
    measureApiPerformance('인벤토리 조회 (병렬)', async () => {
      return axios.get(`${SERVER_URL}/api/inventory/user`, {
        params: TEST_USER
      });
    }),
    measureApiPerformance('재료 조회 (병렬)', async () => {
      return axios.get(`${SERVER_URL}/api/materials/user`, {
        params: TEST_USER
      });
    }),
    measureApiPerformance('랭킹 조회 (병렬)', async () => {
      return axios.get(`${SERVER_URL}/api/ranking`);
    })
  ]);
  
  const parallelTotal = Date.now() - parallelStart;
  console.log(`🔢 병렬 처리 총 시간: ${parallelTotal}ms\n`);

  // 3. 성능 개선 결과 출력
  const improvement = ((sequentialTotal - parallelTotal) / sequentialTotal * 100).toFixed(1);
  const speedup = (sequentialTotal / parallelTotal).toFixed(1);
  
  console.log('📈 성능 개선 결과:');
  console.log(`🚀 속도 개선: ${improvement}% (${speedup}배 빨라짐)`);
  console.log(`⏱️  시간 절약: ${sequentialTotal - parallelTotal}ms`);
  
  if (improvement > 0) {
    console.log('✅ 병렬 처리 최적화 성공!');
  } else {
    console.log('⚠️  성능 개선이 미미하거나 네트워크 지연이 낮습니다.');
  }
}

/**
 * 메인 테스트 실행
 */
async function runPerformanceTest() {
  console.log('🚀 병렬화 최적화 성능 테스트');
  console.log('=====================================');
  console.log(`서버 URL: ${SERVER_URL}`);
  console.log(`테스트 사용자: ${TEST_USER.username}\n`);

  try {
    await comparePerformance();
  } catch (error) {
    console.error('❌ 테스트 실행 중 오류 발생:', error.message);
    console.log('\n💡 해결 방법:');
    console.log('1. 서버가 실행 중인지 확인하세요');
    console.log('2. 서버 URL이 올바른지 확인하세요');
    console.log('3. 네트워크 연결을 확인하세요');
  }
}

// 스크립트가 직접 실행될 때만 테스트 실행
if (require.main === module) {
  runPerformanceTest();
}

module.exports = {
  measureApiPerformance,
  comparePerformance,
  runPerformanceTest
};
