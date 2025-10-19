# ☁️ AWS S3 + CloudFront 이미지 시스템

프로필 이미지를 AWS S3에 저장하고 CloudFront CDN을 통해 전세계적으로 빠르게 제공하는 시스템입니다.

## 📚 문서 가이드

### 1. [AWS_SETUP_GUIDE.md](./AWS_SETUP_GUIDE.md)
AWS 계정 생성부터 S3, CloudFront, IAM 설정까지 **단계별 상세 가이드**

**포함 내용:**
- AWS 계정 생성 (무료 티어)
- S3 버킷 생성 및 CORS 설정
- CloudFront 배포 생성 및 OAC 설정
- IAM 사용자 생성 및 권한 설정
- 환경 변수 설정
- 비용 알림 설정

### 2. [AWS_S3_IMPLEMENTATION_GUIDE.md](./AWS_S3_IMPLEMENTATION_GUIDE.md)
코드 구현 완료 및 **설치/테스트/배포 가이드**

**포함 내용:**
- 패키지 설치 방법
- 환경 변수 설정
- 로컬 테스트 방법
- 배포 방법
- 동작 원리 설명
- 문제 해결 가이드

---

## 🚀 빠른 시작

### 1단계: AWS 설정
```
📖 AWS_SETUP_GUIDE.md 파일을 따라 AWS 설정을 완료하세요
```

### 2단계: 패키지 설치
```cmd
cd fishing_version1/server
npm install
```

### 3단계: 환경 변수 설정
```
server/.env 파일에 AWS 키 추가
(자세한 내용은 AWS_S3_IMPLEMENTATION_GUIDE.md 참고)
```

### 4단계: 테스트
```cmd
npm run dev
```

---

## ✨ 주요 기능

### 클라이언트 직접 업로드
- ✅ 서버를 거치지 않고 S3로 직접 업로드
- ✅ Pre-signed URL로 보안 유지
- ✅ 자동 이미지 리사이징 (512x512, WebP)

### CDN 가속
- ✅ CloudFront로 전세계 빠른 로딩
- ✅ 자동 캐싱 및 최적화
- ✅ HTTPS 기본 지원

### 영구 저장
- ✅ 서버 재배포해도 이미지 유지
- ✅ 무료 티어로 충분한 용량
- ✅ 자동 백업 (S3 버전 관리 활성화 시)

---

## 💰 비용

### 무료 티어 (충분함!)
- **S3**: 5GB 저장, 20,000 조회/월, 2,000 업로드/월 (12개월)
- **CloudFront**: 50GB 전송/월, 2백만 요청/월 **(영구 무료!)**

### 예상 사용량
- 프로필 이미지 100명 ≈ 50MB (5GB 중 1%)
- 이미지 조회 1,000회/월 (20,000회 중 5%)
- ✅ **결론: 무료 범위 내 충분**

---

## 🔒 보안

### 업로드 보안
- ✅ JWT 인증 필수
- ✅ 관리자 권한 확인
- ✅ Pre-signed URL 5분 만료

### 저장소 보안
- ✅ S3 퍼블릭 액세스 차단
- ✅ CloudFront OAC로만 접근
- ✅ IAM 최소 권한 원칙

---

## 🎯 기술 스택

### 서버
- `@aws-sdk/client-s3` - S3 작업
- `@aws-sdk/s3-request-presigner` - Pre-signed URL 생성
- Express.js + MongoDB

### 클라이언트
- React + Axios
- Canvas API (이미지 리사이징)
- WebP 변환

### 인프라
- AWS S3 (저장소)
- AWS CloudFront (CDN)
- AWS IAM (보안)

---

## 📊 업로드 플로우

```
1. 클라이언트: 이미지 선택 및 리사이징 (512x512, WebP)
   ↓
2. 서버: Pre-signed URL 생성 (5분 유효)
   ↓
3. 클라이언트: S3에 직접 PUT 요청
   ↓
4. 서버: DB에 메타데이터 저장 (CloudFront URL)
   ↓
5. 클라이언트: CloudFront URL로 이미지 표시
```

---

## 🐛 문제 해결

### Access Denied 오류
- CloudFront OAC 정책이 S3에 적용되었는지 확인
- IAM 권한 확인

### 이미지가 표시되지 않음
- CloudFront 배포 상태 확인 (5-10분 소요)
- 브라우저 캐시 삭제

### CORS 오류
- S3 CORS 설정 확인
- `AWS_SETUP_GUIDE.md` 참고

**자세한 문제 해결:** `AWS_S3_IMPLEMENTATION_GUIDE.md` 9번 섹션

---

## 🎵 BGM 추가 (향후)

같은 S3 버킷을 사용하여 BGM도 저장 가능:

```
fishing-game-assets/
  ├── profiles/    (프로필 이미지)
  └── bgm/         (BGM 파일)
```

**장점:**
- ✅ 같은 CDN으로 빠른 로딩
- ✅ 스트리밍 지원
- ✅ 무료 티어 공유

---

## 📞 지원

1. **서버 로그**: 콘솔에서 AWS 관련 오류 확인
2. **클라이언트 로그**: 브라우저 개발자 도구에서 업로드 단계 확인
3. **AWS 콘솔**: CloudWatch Logs에서 상세 로그 확인

---

## 📝 라이선스

이 프로젝트는 MIT 라이선스 하에 제공됩니다.

---

## 🎉 완료!

이제 프로필 이미지 시스템이 AWS S3 + CloudFront로 업그레이드되었습니다!

**다음 단계:**
1. `AWS_SETUP_GUIDE.md`로 AWS 설정
2. `AWS_S3_IMPLEMENTATION_GUIDE.md`로 배포
3. 프로필 이미지 업로드 테스트

**Happy Coding! 🚀**

