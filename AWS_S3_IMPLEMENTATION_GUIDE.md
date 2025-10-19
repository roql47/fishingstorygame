# 🚀 AWS S3 + CloudFront 구현 완료 가이드

## ✅ 구현 완료 사항

### 서버 (Server)
- ✅ AWS SDK 패키지 추가 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)
- ✅ S3 클라이언트 설정
- ✅ Pre-signed URL 생성 API (`POST /api/profile-image/get-upload-url`)
- ✅ 메타데이터 저장 API (`POST /api/profile-image/save-metadata`)
- ✅ 이미지 조회 API (CloudFront URL 반환)
- ✅ 이미지 삭제 API (S3에서 삭제)

### 클라이언트 (Client)
- ✅ 이미지 리사이징 함수 (Canvas API, 512x512, WebP)
- ✅ S3 직접 업로드 로직
- ✅ CloudFront URL 처리
- ✅ 캐시 시스템 업데이트

---

## 📦 1. 패키지 설치

### 서버 패키지 설치

```cmd
cd fishing_version1/server
npm install
```

이 명령어가 `package.json`에 추가된 AWS SDK 패키지를 자동으로 설치합니다:
- `@aws-sdk/client-s3@^3.700.0`
- `@aws-sdk/s3-request-presigner@^3.700.0`

---

## 🔧 2. AWS 설정

**자세한 AWS 설정 방법은 `AWS_SETUP_GUIDE.md` 파일을 참고하세요!**

### 필요한 작업 요약

1. **AWS 계정 생성** (무료 티어)
2. **S3 버킷 생성** (예: `fishing-game-assets`)
3. **CloudFront 배포 생성** (S3를 원본으로 설정)
4. **IAM 사용자 생성** (S3 접근 권한)
5. **환경 변수 설정**

---

## 🔐 3. 환경 변수 설정

### 로컬 개발 (.env 파일)

`fishing_version1/server/.env` 파일에 추가:

```env
# 기존 환경 변수...
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret

# AWS S3 + CloudFront (추가)
AWS_REGION=ap-northeast-2
AWS_S3_BUCKET_NAME=fishing-game-assets
AWS_ACCESS_KEY_ID=AKIA...your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_access_key
CLOUDFRONT_DOMAIN=d1234abcd5678.cloudfront.net
```

### Render 배포 환경

Render Dashboard → 프로젝트 → Environment 탭에서 추가:

| Key | Value |
|-----|-------|
| `AWS_REGION` | `ap-northeast-2` |
| `AWS_S3_BUCKET_NAME` | `fishing-game-assets` |
| `AWS_ACCESS_KEY_ID` | `AKIA...` (IAM 사용자 키) |
| `AWS_SECRET_ACCESS_KEY` | `your_secret_key` |
| `CLOUDFRONT_DOMAIN` | `d1234abcd5678.cloudfront.net` |

---

## 🧪 4. 로컬 테스트

### 서버 시작

```cmd
cd fishing_version1/server
npm run dev
```

### 클라이언트 시작 (다른 터미널)

```cmd
cd fishing_version1/client
npm run dev
```

### 테스트 절차

1. ✅ 브라우저에서 `http://localhost:5173` 접속
2. ✅ 로그인
3. ✅ 관리자 권한으로 프로필 이미지 업로드
4. ✅ 콘솔에서 S3 업로드 로그 확인:
   ```
   📸 [Step 1] Resizing image...
   ✅ [Step 1] Image resized: 45.2KB
   🔑 [Step 2] Requesting pre-signed URL...
   ✅ [Step 2] Pre-signed URL received
   ☁️ [Step 3] Uploading to S3...
   ✅ [Step 3] Successfully uploaded to S3
   💾 [Step 4] Saving metadata to database...
   ✅ [Step 4] Metadata saved to database
   🖼️ [Step 5] Updating UI...
   ```
5. ✅ 이미지가 CloudFront URL로 표시되는지 확인

---

## 🌐 5. 배포

### 빌드

```cmd
cd fishing_version1/server
npm run build
```

이 명령어가:
1. 클라이언트 빌드 (`client/dist/`)
2. 정적 파일을 서버로 복사 (`server/dist/`)

### Render 배포

1. ✅ 환경 변수 설정 (위 3번 참고)
2. ✅ GitHub에 푸시
3. ✅ Render가 자동으로 재배포

---

## 🔍 6. 동작 원리

### 업로드 플로우

```
[클라이언트]                    [서버]                    [AWS S3]           [CloudFront]
    |                            |                          |                    |
    | 1. 이미지 선택              |                          |                    |
    | (512x512, WebP 변환)       |                          |                    |
    |                            |                          |                    |
    | 2. Pre-signed URL 요청 --> |                          |                    |
    |                            | 3. Pre-signed URL 생성   |                    |
    | <-- 4. URL 반환            |                          |                    |
    |                            |                          |                    |
    | 5. S3 직접 업로드 -----------------------> PUT       |                    |
    |                            |                          |                    |
    | 6. 메타데이터 저장 요청 --> |                          |                    |
    |                            | 7. DB에 CloudFront URL 저장                    |
    | <-- 8. 완료                |                          |                    |
    |                            |                          |                    |
    | 9. 이미지 조회 --------------------------------> CDN 캐시 ---> 이미지 표시
```

### 주요 특징

1. **서버 부하 제로**: 이미지가 서버를 거치지 않고 S3로 직접 업로드
2. **자동 리사이징**: 클라이언트에서 Canvas API로 512x512 WebP 변환
3. **CDN 가속**: CloudFront를 통해 전세계 빠른 로딩
4. **영구 저장**: 서버 재배포해도 이미지 유지

---

## 🔐 7. 보안 고려사항

### Pre-signed URL 보안
- ✅ 5분 유효 (만료 시간 제한)
- ✅ 관리자 권한 필수
- ✅ JWT 인증 필요

### S3 보안
- ✅ CloudFront OAC로 직접 접근 차단
- ✅ IAM 최소 권한 (profiles 폴더만 접근)
- ✅ 버킷 퍼블릭 액세스 차단

---

## 💰 8. 비용 모니터링

### 무료 티어 한도

**S3 (12개월 무료):**
- 5GB 저장
- 20,000 GET 요청/월
- 2,000 PUT 요청/월

**CloudFront (영구 무료):**
- 50GB 데이터 전송/월
- 2,000,000 HTTP 요청/월

### 사용량 확인 방법

1. AWS 콘솔 → CloudWatch → Billing
2. S3 → 버킷 → Metrics 탭
3. CloudFront → 배포 → Monitoring 탭

### 비용 알림 설정 (권장)

AWS Budgets에서 $1 예산 설정하여 무료 티어 초과 시 이메일 알림 받기

---

## 🐛 9. 문제 해결

### 문제: "Access Denied" 오류

**원인**: S3 버킷 정책 또는 IAM 권한 문제

**해결**:
1. CloudFront OAC 정책이 S3에 적용되었는지 확인
2. IAM 사용자의 `s3:PutObject` 권한 확인
3. 버킷 이름이 환경 변수와 일치하는지 확인

### 문제: 이미지가 표시되지 않음

**원인**: CloudFront 배포 상태가 "Deploying"

**해결**:
1. CloudFront 콘솔에서 배포 상태 확인
2. "Enabled"로 변경될 때까지 5-10분 대기
3. 브라우저 캐시 삭제 후 재시도

### 문제: CORS 오류

**원인**: S3 CORS 설정 누락

**해결**:
1. S3 버킷 → 권한 → CORS 편집
2. `AWS_SETUP_GUIDE.md`의 CORS 설정 복사
3. 저장 후 재시도

### 문제: Pre-signed URL 만료

**원인**: 업로드 시간이 5분 초과

**해결**:
- 이미지 크기 2MB 제한 확인
- 네트워크 연결 상태 확인
- 필요시 `expiresIn` 값 증가 (server/src/index.js:6054)

---

## 📊 10. MongoDB 스키마 변경

기존 `ProfileImage` 모델에 `s3Key` 필드가 자동으로 추가됩니다:

```javascript
{
  userId: String,
  username: String,
  userUuid: String,
  imageUrl: String,        // CloudFront URL (예: https://xxx.cloudfront.net/profiles/...)
  s3Key: String,           // S3 객체 키 (예: profiles/profile_xxx_123.webp)
  originalName: String,
  fileSize: Number,
  uploadedAt: Date
}
```

**기존 이미지 호환성**: 
- `s3Key`가 없는 기존 이미지는 여전히 작동
- 새로 업로드된 이미지부터 S3에 저장됨

---

## 🎯 11. BGM 추가 가이드 (향후)

BGM을 추가하려면 같은 S3 버킷을 사용하세요:

### 폴더 구조
```
fishing-game-assets/
  ├── profiles/          (프로필 이미지)
  │   └── profile_xxx.webp
  └── bgm/               (BGM 파일)
      ├── menu.mp3
      ├── battle.mp3
      └── victory.mp3
```

### HTML5 Audio 사용
```javascript
const bgmUrl = `https://${CLOUDFRONT_DOMAIN}/bgm/menu.mp3`;
const audio = new Audio(bgmUrl);
audio.play();
```

### 장점
- ✅ 같은 CDN으로 빠른 로딩
- ✅ 스트리밍 지원
- ✅ 무료 티어 공유

---

## ✨ 12. 완료 체크리스트

### AWS 설정
- [ ] AWS 계정 생성
- [ ] S3 버킷 생성
- [ ] CORS 설정 완료
- [ ] CloudFront 배포 생성
- [ ] OAC 정책 S3에 적용
- [ ] IAM 사용자 생성
- [ ] 액세스 키 발급

### 환경 변수
- [ ] 로컬 `.env` 파일 설정
- [ ] Render 환경 변수 설정

### 테스트
- [ ] 로컬에서 이미지 업로드 테스트
- [ ] S3 버킷에 이미지 확인
- [ ] CloudFront URL로 이미지 표시 확인
- [ ] 배포 환경에서 테스트

### 모니터링
- [ ] AWS Budgets 예산 알림 설정
- [ ] CloudWatch에서 사용량 확인

---

## 📞 13. 지원

문제가 발생하면:

1. **서버 로그 확인**: 콘솔에서 AWS 관련 오류 확인
2. **클라이언트 로그 확인**: 브라우저 개발자 도구에서 업로드 단계 확인
3. **AWS 콘솔 확인**: CloudWatch Logs에서 S3/CloudFront 로그 확인

---

## 🎉 축하합니다!

AWS S3 + CloudFront 이미지 시스템 구현이 완료되었습니다! 🚀

이제 프로필 이미지가:
- ✅ 서버 재배포해도 유지됩니다
- ✅ 전세계 어디서나 빠르게 로드됩니다
- ✅ 서버 부하 없이 업로드됩니다
- ✅ 무료 티어로 충분히 사용 가능합니다

**다음 단계**: `AWS_SETUP_GUIDE.md`를 따라 AWS 설정을 완료하세요!

