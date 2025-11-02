# 🏟️ 결투장 PVP 시스템

## 개요
레이드 탭 옆에 새로운 결투장 탭을 추가하여 유저 간 PVP 전투를 즐길 수 있는 시스템입니다.

## 주요 기능

### 1. ELO 기반 랭킹 시스템
- **기본 ELO**: 1000점으로 시작
- **랭킹 조회**: 자신 기준 상위 10명, 하위 10명 표시
- **실시간 순위**: 전체 유저 중 현재 순위 확인 가능

### 2. ELO 점수 계산
#### 승리 시 (순위별 차등)
- 1위 상대: +60점
- 2위 상대: +57점
- 3위 상대: +54점
- 4위 상대: +51점
- ...
- 10위 상대: +33점

#### 패배 시 (순위별 차등)
- 1위 상대: -3점
- 2위 상대: -6점
- 3위 상대: -9점
- 4위 상대: -12점
- ...
- 10위 상대: -30점

### 3. 전투 시스템
- **자동 전투**: 탐사 시스템과 유사한 턴제 자동 전투
- **동료 참여**: 동료모집 탭에서 "전투 참여 중"인 동료들이 자동으로 참여
- **턴 순서**: 플레이어 공격 → 동료 공격 → 상대 플레이어 공격 → 상대 동료 공격
- **전투 로그**: 실시간 전투 상황 표시

### 4. 보상 시스템
- **승점**: 승리 시 10점 획득
- **연승 기록**: 연속 승리 시 연승 카운트 표시
- **최대 연승**: 개인 최대 연승 기록 저장

### 5. 일일 제한
- **하루 10회**: 전투 횟수 제한
- **자동 리셋**: 매일 자정에 자동으로 리셋

## 구현 파일

### 백엔드
1. **server/src/index.js**
   - ArenaEloModel MongoDB 스키마 추가
   - arenaRoutes 라우터 등록

2. **server/src/modules/arenaSystem.js**
   - ArenaSystem 클래스 구현
   - ELO 계산, 랭킹 조회, 전투 처리 로직

3. **server/src/routes/arenaRoutes.js**
   - GET /api/arena/my-stats: 내 스탯 조회
   - GET /api/arena/rankings: 랭킹 조회
   - POST /api/arena/start-battle: 전투 시작
   - POST /api/arena/finish-battle: 전투 종료 및 보상 처리

### 프론트엔드
1. **client/src/components/ArenaTab.jsx**
   - 결투장 메인 UI 컴포넌트
   - 랭킹 리스트, 전투 화면, 결과 화면

2. **client/src/App.jsx**
   - 결투장 탭 버튼 추가 (레이드 옆)
   - ArenaTab 컴포넌트 통합

3. **client/src/data/noticeData.js**
   - v1.412 패치 노트 추가

## 데이터베이스 스키마

```javascript
ArenaEloSchema {
  userUuid: String (unique, indexed)
  username: String
  elo: Number (default: 1000, indexed)
  victorPoints: Number (default: 0)
  dailyBattles: Number (default: 0)
  lastBattleDate: Date
  totalWins: Number (default: 0)
  totalLosses: Number (default: 0)
  winStreak: Number (default: 0)
  maxWinStreak: Number (default: 0)
  lastOpponentUuid: String
}
```

## UI 구성

### 로비 화면
1. **내 정보 패널**
   - ELO 점수
   - 승점
   - 전적 (승/패)
   - 오늘 전투 횟수 (X/10)

2. **상위 랭커 리스트**
   - 상위 10명 표시
   - 각 유저별 예상 점수 변화 표시
   - 전투 시작 버튼

3. **내 위치 (강조 표시)**
   - 전체 순위 표시

4. **하위 유저 리스트**
   - 하위 10명 표시
   - 각 유저별 예상 점수 변화 표시
   - 전투 시작 버튼

### 전투 화면
- 플레이어 vs 상대 HP 바
- 동료 목록 및 상태
- 실시간 전투 로그

### 결과 화면
- 승리/패배 표시
- ELO 변화량 (+/- 표시)
- 새로운 ELO
- 승점 획득 (승리 시)
- 연승 기록 (2연승 이상 시)

## 사용 방법

1. 로비에서 상대 선택 (상위/하위 10명 중 선택)
2. 전투 시작 버튼 클릭
3. 자동 전투 관전
4. 결과 확인 및 로비로 복귀

## 밸런스 특징

- **위험-보상 균형**: 강한 상대와 싸워 이기면 큰 점수 획득, 지면 작은 감점
- **안전한 전투**: 약한 상대와 싸워 이기면 작은 점수 획득, 지면 큰 감점
- **전략적 선택**: 자신의 실력과 상대를 고려한 선택 필요

## 향후 개선 사항

1. 시즌제 도입
2. 등급(티어) 시스템 추가
3. 특별 보상 (주간/월간 랭킹 보상)
4. 관전 모드
5. 리플레이 기능
6. 베팅 시스템 (앰버/골드 베팅)

## 버전
- v1.412 (2025.11.02)


