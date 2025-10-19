# 🚀 AWS S3 + CloudFront 설정 가이드

## 📋 목차
1. [AWS 계정 생성](#1-aws-계정-생성)
2. [S3 버킷 생성](#2-s3-버킷-생성)
3. [CloudFront 배포 생성](#3-cloudfront-배포-생성)
4. [IAM 사용자 생성](#4-iam-사용자-생성)
5. [환경 변수 설정](#5-환경-변수-설정)
6. [비용 알림 설정](#6-비용-알림-설정)

---

## 1. AWS 계정 생성

### 가입하기
1. https://aws.amazon.com/ko/ 접속
2. **AWS 계정 생성** 클릭
3. 이메일, 비밀번호 입력
4. 계정 유형: **개인** 선택
5. 결제 정보 입력 (신용/체크카드)
   - ⚠️ 무료 티어 범위 내에서는 청구되지 않습니다
6. 전화번호 인증
7. 지원 플랜: **기본 지원 - 무료** 선택

### 로그인
- https://console.aws.amazon.com/
- 루트 사용자로 로그인

---

## 2. S3 버킷 생성

### 2.1 버킷 만들기

1. AWS 콘솔에서 **S3** 검색하여 이동
2. **버킷 만들기** 클릭

### 2.2 버킷 설정

#### 기본 설정
- **버킷 이름**: `fishing-game-assets` (고유한 이름, 전 세계에서 유일해야 함)
- **AWS 리전**: `아시아 태평양(서울) ap-northeast-2`

#### 객체 소유권
- ✅ **ACL 비활성화됨 (권장)**

#### 이 버킷의 퍼블릭 액세스 차단 설정
- ✅ **모든 퍼블릭 액세스 차단** 체크 (CloudFront를 통해서만 접근)

#### 나머지 설정
- 버킷 버전 관리: 비활성화
- 기본 암호화: 활성화 (SSE-S3)

3. **버킷 만들기** 클릭

### 2.3 CORS 설정

1. 생성한 버킷 클릭
2. **권한** 탭으로 이동
3. **CORS(Cross-Origin Resource Sharing)** 섹션에서 **편집** 클릭
4. 아래 JSON 입력:

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT",
            "POST",
            "DELETE",
            "HEAD"
        ],
        "AllowedOrigins": [
            "*"
        ],
        "ExposeHeaders": [
            "ETag"
        ],
        "MaxAgeSeconds": 3000
    }
]
```

5. **변경 사항 저장** 클릭

---

## 3. CloudFront 배포 생성

### 3.1 배포 만들기

1. AWS 콘솔에서 **CloudFront** 검색하여 이동
2. **배포 생성** 클릭

### 3.2 원본 설정

#### 원본 도메인
- 드롭다운에서 생성한 S3 버킷 선택: `fishing-game-assets.s3.ap-northeast-2.amazonaws.com`

#### 원본 액세스
- ✅ **Origin access control settings (recommended)** 선택
- **원본 액세스 제어 생성** 클릭
  - 이름: `fishing-game-OAC` (자동 생성됨)
  - 서명 요청(권장): AWS 서명 버전 4
  - **생성** 클릭

### 3.3 기본 캐시 동작

#### 뷰어 프로토콜 정책
- ✅ **Redirect HTTP to HTTPS**

#### 허용된 HTTP 메서드
- ✅ **GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE**

#### 캐시 키 및 원본 요청
- ✅ **Cache policy and origin request policy (recommended)**
- **캐시 정책**: `CachingOptimized`
- **원본 요청 정책**: `CORS-S3Origin`

### 3.4 설정

#### 가격 분류
- ✅ **북아메리카, 유럽, 아시아, 중동 및 아프리카 사용**

#### 대체 도메인 이름(CNAME)
- 비워두기 (CloudFront 기본 도메인 사용)

3. **배포 생성** 클릭

### 3.5 S3 버킷 정책 업데이트

배포 생성 후 상단에 파란색 배너가 나타납니다:

> "정책을 업데이트해야 합니다"

1. **정책 복사** 버튼 클릭
2. S3 버킷으로 이동
3. **권한** 탭 → **버킷 정책** → **편집**
4. 복사한 정책 붙여넣기
5. **변경 사항 저장**

### 3.6 배포 도메인 이름 확인

1. CloudFront 배포 목록에서 생성한 배포 클릭
2. **배포 도메인 이름** 복사 (예: `d1234abcd5678.cloudfront.net`)
3. 이 값을 환경 변수에 사용합니다

⚠️ **배포 상태가 "Deploying"에서 "Enabled"로 변경될 때까지 5-10분 소요**

---

## 4. IAM 사용자 생성

### 4.1 사용자 만들기

1. AWS 콘솔에서 **IAM** 검색하여 이동
2. 왼쪽 메뉴에서 **사용자** 클릭
3. **사용자 생성** 클릭

### 4.2 사용자 세부 정보

- **사용자 이름**: `fishing-game-server`
- **AWS 자격 증명 유형**: ✅ **액세스 키 - 프로그래밍 방식 액세스**
- **다음** 클릭

### 4.3 권한 설정

1. ✅ **직접 정책 연결** 선택
2. **정책 생성** 클릭 (새 탭 열림)

#### 정책 생성 (새 탭)

1. **JSON** 탭 클릭
2. 아래 정책 입력 (버킷 이름을 본인의 버킷으로 변경):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "S3ProfileImageAccess",
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:PutObjectAcl"
            ],
            "Resource": "arn:aws:s3:::fishing-game-assets/profiles/*"
        },
        {
            "Sid": "S3BucketAccess",
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket"
            ],
            "Resource": "arn:aws:s3:::fishing-game-assets"
        }
    ]
}
```

3. **다음** 클릭
4. **정책 이름**: `FishingGameS3Access`
5. **정책 생성** 클릭
6. 탭 닫고 원래 탭으로 돌아가기

### 4.4 권한 연결

1. 🔄 새로고침 버튼 클릭
2. 검색창에 `FishingGameS3Access` 입력
3. ✅ 체크박스 선택
4. **다음** 클릭
5. **사용자 생성** 클릭

### 4.5 액세스 키 생성

1. 생성한 사용자(`fishing-game-server`) 클릭
2. **보안 자격 증명** 탭
3. **액세스 키 만들기** 클릭
4. **사용 사례**: ✅ **서드 파티 서비스**
5. 확인 체크박스 체크
6. **다음** 클릭
7. 설명 태그: `Fishing Game Server` (선택사항)
8. **액세스 키 만들기** 클릭

### 4.6 키 저장 ⚠️ 중요!

- **액세스 키 ID**: `AKIA...` 형식 (복사)
- **비밀 액세스 키**: 한 번만 표시됩니다! (복사)

⚠️ **.csv 파일 다운로드** 또는 안전한 곳에 복사해두세요!

---

## 5. 환경 변수 설정

### 5.1 로컬 개발 환경 (.env 파일)

`fishing_version1/server/.env` 파일 생성 또는 수정:

```env
# MongoDB
MONGODB_URI=your_mongodb_uri

# JWT
JWT_SECRET=your_jwt_secret

# AWS S3 + CloudFront
AWS_REGION=ap-northeast-2
AWS_S3_BUCKET_NAME=fishing-game-assets
AWS_ACCESS_KEY_ID=AKIA...your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
CLOUDFRONT_DOMAIN=d1234abcd5678.cloudfront.net
```

### 5.2 Render 배포 환경

1. Render Dashboard 접속
2. 서버 프로젝트 선택
3. **Environment** 탭 클릭
4. 아래 환경 변수 추가:

| Key | Value |
|-----|-------|
| `AWS_REGION` | `ap-northeast-2` |
| `AWS_S3_BUCKET_NAME` | `fishing-game-assets` |
| `AWS_ACCESS_KEY_ID` | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | `your_secret_key` |
| `CLOUDFRONT_DOMAIN` | `d1234abcd5678.cloudfront.net` |

5. **Save Changes** 클릭

---

## 6. 비용 알림 설정

### 6.1 예산 생성

1. AWS 콘솔에서 **Billing and Cost Management** 검색
2. 왼쪽 메뉴 **예산(Budgets)** 클릭
3. **예산 생성** 클릭
4. **사용자 지정(고급)** 선택
5. **비용 예산** 선택
6. **다음** 클릭

### 6.2 예산 설정

- **이름**: `Free Tier Alert`
- **기간**: 월별
- **예산 금액**: `$1.00`
- **다음** 클릭

### 6.3 알림 설정

- **임계값**: `80%` (실제 $0.80)
- **이메일 주소**: 본인 이메일 입력
- **다음** 클릭
- **예산 생성** 클릭

이제 무료 티어를 초과할 위험이 있으면 이메일로 알림을 받습니다!

---

## 7. 테스트

### 7.1 S3 업로드 테스트

AWS CLI 또는 콘솔에서 테스트 이미지 업로드:

1. S3 버킷으로 이동
2. **업로드** 클릭
3. `profiles/test.jpg` 업로드

### 7.2 CloudFront 접근 테스트

브라우저에서:
```
https://d1234abcd5678.cloudfront.net/profiles/test.jpg
```

✅ 이미지가 표시되면 성공!

---

## 📊 무료 티어 사용량 모니터링

### S3 사용량 확인
1. S3 → 버킷 선택
2. **지표(Metrics)** 탭

### CloudFront 사용량 확인
1. CloudFront → 배포 선택
2. **모니터링** 탭

### 전체 비용 확인
1. **Billing and Cost Management**
2. **청구서** 메뉴

---

## 🔒 보안 권장사항

1. ✅ IAM 사용자 사용 (루트 계정 직접 사용 금지)
2. ✅ MFA(다단계 인증) 활성화
3. ✅ 액세스 키를 Git에 커밋하지 않기 (`.env` → `.gitignore`)
4. ✅ 최소 권한 원칙 (S3 특정 폴더만 접근)
5. ✅ CloudFront OAC로 S3 직접 접근 차단

---

## ⚠️ 주의사항

1. **배포 시간**: CloudFront 배포는 5-10분 소요
2. **캐시 무효화**: 이미지 업데이트 시 캐시 무효화 필요 (무료 티어: 월 1,000회)
3. **버킷 이름**: 전 세계에서 고유해야 함
4. **리전 선택**: 서울(`ap-northeast-2`) 권장

---

## 🎉 완료!

이제 코드 구현 단계로 넘어갑니다:
1. 서버에 AWS SDK 설치
2. Pre-signed URL API 구현
3. 클라이언트 업로드 로직 수정

**다음 단계**: `server/` 디렉토리에서 `npm install` 실행

