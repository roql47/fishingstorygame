# 📱 모바일 백그라운드 쿨타임 수정 가이드

## 🚨 현재 문제점

**모바일에서 백그라운드로 실행되면 쿨타임이 멈춰있는 현상:**
- ❌ **JavaScript Timer 중단**: 모바일 브라우저는 백그라운드에서 `setInterval` 실행을 제한
- ❌ **Page Visibility API 미사용**: 백그라운드/포그라운드 전환 감지 없음
- ❌ **시간 기반 계산 부족**: 1초씩 차감하는 방식으로 실제 경과 시간 반영 안됨

## 🔧 해결 방안

### 1. Page Visibility API 활용
- **백그라운드 진입**: 현재 시간 저장
- **포그라운드 복귀**: 경과 시간 계산 후 쿨타임 차감
- **localStorage 기준 계산**: 정확한 종료 시간 기반으로 계산

### 2. 시간 기반 정확한 계산
- **기존**: `setInterval`로 1초씩 차감
- **개선**: 매초 localStorage의 종료 시간과 현재 시간 비교

## 📋 적용 방법

### 클라이언트 수정 (client/src/App.jsx)

#### 675-696라인 교체
`client/mobile-cooldown-fix.js` 파일의 내용으로 기존 쿨타임 타이머 로직 교체

**주요 변경사항:**
```javascript
// 기존 (문제 있는 방식)
setInterval(() => {
  setFishingCooldown(prev => Math.max(0, prev - 1000));
}, 1000);

// 개선 (정확한 시간 계산)
setInterval(() => {
  const storedEnd = localStorage.getItem('fishingCooldownEnd');
  if (storedEnd) {
    const remaining = Math.max(0, new Date(storedEnd) - Date.now());
    setFishingCooldown(remaining);
  }
}, 1000);

// Page Visibility API 추가
document.addEventListener('visibilitychange', handleVisibilityChange);
```

## 🔄 개선된 동작 방식

### 1. 정상적인 사용 (포그라운드)
```
1. 낚시 실행 → 쿨타임 시작
2. localStorage에 종료 시간 저장
3. 1초마다 localStorage 기준으로 남은 시간 계산
4. UI에 정확한 쿨타임 표시
```

### 2. 백그라운드 전환 시
```
1. 앱이 백그라운드로 이동
2. visibilitychange 이벤트 감지
3. 현재 시간을 lastUpdateTime에 저장
4. JavaScript 타이머는 멈출 수 있음 (문제없음)
```

### 3. 포그라운드 복귀 시
```
1. 앱이 포그라운드로 복귀
2. visibilitychange 이벤트 감지
3. 경과 시간 = 현재 시간 - lastUpdateTime
4. 쿨타임에서 경과 시간만큼 차감
5. localStorage 기준으로 정확한 시간 재계산
```

## 📊 테스트 시나리오

### 시나리오 1: 짧은 백그라운드 (30초)
```
1. 쿨타임 5분 시작
2. 30초 후 백그라운드로 이동
3. 1분 후 포그라운드로 복귀
4. 예상 결과: 쿨타임 3분 30초 남음 ✅
```

### 시나리오 2: 긴 백그라운드 (10분)
```
1. 쿨타임 5분 시작
2. 즉시 백그라운드로 이동
3. 10분 후 포그라운드로 복귀
4. 예상 결과: 쿨타임 0초 (완료됨) ✅
```

### 시나리오 3: 앱 완전 종료 후 재시작
```
1. 쿨타임 5분 시작
2. 앱 완전 종료
3. 3분 후 앱 재시작
4. 예상 결과: localStorage 기준으로 2분 남음 ✅
```

## 🚀 추가 개선사항

### 1. 서버 동기화 강화
- 포그라운드 복귀 시 서버와 쿨타임 동기화
- 클라이언트-서버 시간 차이 보정

### 2. 네트워크 연결 확인
- 오프라인 상태에서도 로컬 쿨타임 정확 계산
- 온라인 복귀 시 서버와 동기화

### 3. 사용자 경험 개선
```javascript
// 백그라운드 복귀 시 사용자 알림
if (timeElapsed > 60000) { // 1분 이상 백그라운드였다면
  console.log(`📱 Welcome back! You were away for ${Math.round(timeElapsed/1000)}s`);
}
```

## ⚠️ 주의사항

### 1. 브라우저별 차이
- **iOS Safari**: 백그라운드에서 타이머 완전 중단
- **Android Chrome**: 제한적 타이머 실행
- **PWA 모드**: 더 나은 백그라운드 지원

### 2. 배터리 최적화
- **시스템 설정**: 앱이 배터리 최적화 대상이면 백그라운드 제한
- **사용자 안내**: 배터리 최적화 예외 설정 권장

### 3. 메모리 관리
```javascript
// 이벤트 리스너 정리 필수
return () => {
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('focus', handleFocus);
};
```

## ✅ 적용 후 효과

### 이전 (문제 상황)
- 😞 백그라운드에서 쿨타임 멈춤
- 😞 포그라운드 복귀 시 부정확한 시간
- 😞 사용자 혼란 및 불편

### 이후 (개선된 상황)
- ✅ **정확한 쿨타임**: 백그라운드 시간도 정확히 계산
- ✅ **끊김 없는 경험**: 앱 전환과 관계없이 일관된 타이머
- ✅ **서버 동기화**: localStorage와 서버 쿨타임 일치

이제 **모바일에서도 PC와 동일한 쿨타임 경험**을 제공합니다! 📱⏰

## 🔄 추가 권장사항

1. **PWA 설치 권장**: 홈 화면에 추가하면 백그라운드 처리 개선
2. **배터리 최적화 해제**: 앱 설정에서 배터리 최적화 예외 설정
3. **알림 권한**: 쿨타임 완료 시 푸시 알림 (향후 구현)
