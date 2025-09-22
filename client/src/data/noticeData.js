// 공지사항 데이터
export const NOTICE_DATA = [
  {
    id: 0,
    date: "2025.09.22",
    title: "🎆 게임 시스템 업데이트",
    content: [
      "일일퀴스트 보상 개선: 물고기 10마리 잡기 보상을 별조각 1개로 변경",
      "모바일 백그라운드 쿨타임 멈춤 현상 완전 수정",
      "카카오 로그인 시스템 전면 개선",
      "기존 계정 중복 생성 방지 및 닉네임 동기화 완료",
      "Page Visibility API 적용으로 모바일 쿨타임 정확도 향상"
    ],
    isNew: true,
    type: "update"
  },
  {
    id: 1,
    date: "2025.09.22",
    title: "🔐 JWT 보안 시스템 대폭 강화",
    content: [
      "Bearer 토큰 형식 검증 및 엄격한 인증 절차 도입",
      "IP 주소 추적 및 다중 IP 토큰 사용 자동 탐지",
      "User-Agent 및 Host 헤더 검증으로 봇 공격 차단",
      "실시간 보안 위협 탐지 및 토큰 블랙리스트 시스템",
      "고빈도 요청 탐지 및 DDoS 패턴 인식 강화",
      "보안 헤더 적용 (XSS, 클릭재킹 방어)"
    ],
    isNew: false,
    type: "security"
  },
  {
    id: 2,
    date: "2025.09.22",
    title: "🎉 동료 시스템 업데이트",
    content: [
      "모든 동료의 등급이 일반으로 통일되었습니다",
      "동료 레벨과 경험치가 MongoDB에 영구 저장됩니다",
      "전투 참여 설정이 계정간 동기화됩니다",
      "동료 경험치 NaN 표시 오류 완전 수정"
    ],
    isNew: false,
    type: "update"
  },
  {
    id: 3,
    date: "2025.09.22", 
    title: "🔐 보안 시스템 강화",
    content: [
      "JWT 토큰 기반 인증 시스템 도입",
      "관리자 권한 검증 강화",
      "비밀번호 암호화 저장 (bcrypt)"
    ],
    isNew: false,
    type: "security"
  },
  {
    id: 4,
    date: "2025.09.22",
    title: "⚔️ 전투 시스템 개선", 
    content: [
      "전투 로그 공유 기능 추가",
      "동료 스킬 지속시간 버그 수정",
      "전투 결과 상세 팝업 제공"
    ],
    isNew: false,
    type: "improvement"
  },
  {
    id: 5,
    date: "2025.09.19",
    title: "🦊 여우이야기 Alpha Test 시작",
    content: [
      "여우이야기 알파 테스트를 시작합니다",
      "게임의 기본 기능들을 테스트해보세요",
      "버그 발견 시 관리자에게 신고해주세요"
    ],
    isNew: false,
    type: "announcement"
  }
];

// 버전 정보
export const VERSION_INFO = {
  name: "여우이야기",
  version: "v1.11"
};