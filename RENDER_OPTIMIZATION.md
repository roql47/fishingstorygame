# 🚀 렌더(Render) 서버 최적화 가이드

## 현재 적용된 최적화

### 1. MongoDB 연결 최적화
- **연결 풀 크기**: 10개 (기존 5개에서 증가)
- **최소 연결 유지**: 2개 (항상 연결 유지)
- **타임아웃 최적화**: 30초 (더 빠른 실패 처리)
- **하트비트**: 10초마다 (연결 상태 확인)

### 2. 캐시 시스템 강화
- **물고기 가격 캐시**: 10분 (프로덕션 환경)
- **쿨타임 계산 캐시**: 5분 (프로덕션 환경)
- **자동 캐시 무효화**: 악세사리 구매 시

### 3. Keep-Alive 엔드포인트
- `GET /api/ping` - 서버 상태 확인
- 자동 14분마다 자가 핑 (콜드 스타트 방지)

## 추가 최적화 방법

### 1. 외부 Keep-Alive 서비스 설정

**UptimeRobot** (무료) 사용:
1. https://uptimerobot.com 가입
2. 새 모니터 추가:
   - **URL**: `https://fising-master.onrender.com/api/ping`
   - **간격**: 5분
   - **타입**: HTTP(s)

### 2. 렌더 환경변수 설정

```env
NODE_ENV=production
RENDER_EXTERNAL_URL=https://fising-master.onrender.com
```

### 3. MongoDB Atlas 최적화

**지역 설정**:
- MongoDB Atlas 클러스터를 **US-East** 지역에 설정
- 렌더 서버도 같은 지역에 배포

**연결 문자열 최적화**:
```
mongodb+srv://user:pass@cluster.mongodb.net/db?retryWrites=true&w=majority&maxPoolSize=10&minPoolSize=2
```

## 성능 모니터링

### 느린 쿼리 감지
- 200ms 이상 쿼리 자동 경고
- 콘솔에서 성능 로그 확인

### 헬스 체크
- `GET /api/health` - 전체 시스템 상태
- `GET /api/ping` - 간단한 생존 확인

## 예상 성능 향상

- **콜드 스타트**: 99% 제거 (Keep-Alive)
- **DB 쿼리**: 50-70% 속도 향상 (캐싱)
- **API 응답**: 40-60% 속도 향상 (병렬 처리)

## 렌더 배포 시 주의사항

1. **빌드 시간**: 클라이언트 빌드 포함으로 3-5분 소요
2. **메모리 사용량**: 512MB 제한 (모니터링 필요)
3. **슬립 모드**: 15분 비활성 시 자동 슬립 (Keep-Alive로 방지)

## 문제 해결

### 여전히 느린 경우
1. 렌더 로그 확인: `https://dashboard.render.com`
2. MongoDB Atlas 성능 메트릭 확인
3. 외부 Keep-Alive 서비스 상태 확인

### 연결 오류 발생 시
1. MongoDB 연결 문자열 확인
2. 환경변수 `MONGO_URI` 검증
3. Atlas 네트워크 액세스 리스트 확인 (0.0.0.0/0 허용)
