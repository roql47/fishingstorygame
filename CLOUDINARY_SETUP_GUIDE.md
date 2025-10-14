# 📸 Cloudinary 프로필 이미지 저장 가이드

## 문제 상황
Render 무료 플랜은 파일 시스템이 임시적(ephemeral)이어서 서버 재배포 시 `uploads/profiles/` 폴더의 모든 이미지가 삭제됩니다.

## 해결 방법: Cloudinary 사용

### 1️⃣ Cloudinary 계정 생성
1. https://cloudinary.com/ 접속
2. 무료 계정 가입
3. Dashboard에서 아래 정보 확인:
   - Cloud Name
   - API Key
   - API Secret

### 2️⃣ 환경 변수 설정

**Render.com 설정:**
1. Render Dashboard → 프로젝트 선택
2. Environment Variables 추가:
```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

**로컬 개발용 (.env 파일):**
```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 3️⃣ 패키지 설치

```bash
cd server
npm install cloudinary multer-storage-cloudinary
```

### 4️⃣ 서버 코드 수정

**server/src/index.js** 파일의 프로필 이미지 시스템 부분을 아래 코드로 교체:

```javascript
// 📸 프로필 이미지 시스템 - Cloudinary 사용

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Cloudinary 설정
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Cloudinary Storage 설정
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'fishing_game/profiles', // Cloudinary 폴더명
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    transformation: [
      { width: 512, height: 512, crop: 'fill', gravity: 'face' },
      { quality: 'auto:good', fetch_format: 'auto' }
    ]
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB 제한
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'), false);
    }
  }
});

// 프로필 이미지 업로드 API (Cloudinary 버전)
app.post("/api/profile-image/upload", authenticateJWT, upload.single('profileImage'), async (req, res) => {
  try {
    const { userUuid: jwtUserUuid, username: jwtUsername, isAdmin } = req.user;
    
    // 관리자 권한 확인
    if (!isAdmin) {
      return res.status(403).json({ 
        success: false, 
        error: '관리자 권한이 필요합니다.' 
      });
    }
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: '이미지 파일이 필요합니다.' 
      });
    }
    
    // 🎯 대상 사용자 UUID
    const targetUserUuid = req.body.targetUserUuid || jwtUserUuid;
    const targetUsername = req.body.targetUsername || jwtUsername;
    
    const clientIP = getClientIP(req);
    console.log(`📸 [PROFILE-IMAGE] Upload request from ${jwtUsername} (${clientIP}) for target: ${targetUsername} (${targetUserUuid})`);
    
    // Cloudinary URL
    const imageUrl = req.file.path; // Cloudinary가 제공하는 전체 URL
    const fileSize = req.file.size;
    
    // 기존 프로필 이미지 처리
    const existingImage = await ProfileImageModel.findOne({ userUuid: targetUserUuid });
    
    if (existingImage) {
      // 기존 Cloudinary 이미지 삭제
      if (existingImage.cloudinaryPublicId) {
        try {
          await cloudinary.uploader.destroy(existingImage.cloudinaryPublicId);
          console.log(`🗑️ [PROFILE-IMAGE] Old Cloudinary image deleted: ${existingImage.cloudinaryPublicId}`);
        } catch (deleteError) {
          console.error('❌ [PROFILE-IMAGE] Failed to delete old image:', deleteError);
        }
      }
      
      // DB 업데이트
      existingImage.imageUrl = imageUrl;
      existingImage.cloudinaryPublicId = req.file.filename; // Cloudinary public_id
      existingImage.originalName = req.file.originalname;
      existingImage.fileSize = fileSize;
      existingImage.uploadedAt = new Date();
      await existingImage.save();
    } else {
      // 새로운 프로필 이미지 생성
      const newProfileImage = new ProfileImageModel({
        userId: 'user',
        username: targetUsername,
        userUuid: targetUserUuid,
        imageUrl: imageUrl,
        cloudinaryPublicId: req.file.filename,
        originalName: req.file.originalname,
        fileSize: fileSize
      });
      await newProfileImage.save();
    }
    
    console.log(`✅ [PROFILE-IMAGE] Image uploaded to Cloudinary for ${targetUsername}: ${imageUrl}`);
    
    res.json({
      success: true,
      message: `${targetUsername}님의 프로필 이미지가 업로드되었습니다.`,
      imageUrl: imageUrl, // Cloudinary 전체 URL 반환
      fileSize: fileSize,
      targetUserUuid: targetUserUuid
    });
    
  } catch (error) {
    console.error('❌ [PROFILE-IMAGE] Upload error:', error);
    
    // 업로드 실패 시 Cloudinary 이미지 삭제
    if (req.file?.filename) {
      try {
        await cloudinary.uploader.destroy(req.file.filename);
      } catch (cleanupError) {
        console.error('❌ [PROFILE-IMAGE] Cleanup error:', cleanupError);
      }
    }
    
    res.status(500).json({ 
      success: false, 
      error: '이미지 업로드 중 오류가 발생했습니다.' 
    });
  }
});

// 프로필 이미지 조회 API (Cloudinary 버전)
app.get("/api/profile-image/:userUuid", async (req, res) => {
  try {
    const { userUuid } = req.params;
    
    const profileImage = await ProfileImageModel.findOne({ userUuid });
    
    if (!profileImage) {
      return res.status(404).json({ 
        success: false, 
        error: '프로필 이미지를 찾을 수 없습니다.' 
      });
    }
    
    res.json({
      success: true,
      imageUrl: profileImage.imageUrl, // Cloudinary URL 직접 반환
      uploadedAt: profileImage.uploadedAt
    });
    
  } catch (error) {
    console.error('❌ [PROFILE-IMAGE] Fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: '프로필 이미지 조회 중 오류가 발생했습니다.' 
    });
  }
});

// 프로필 이미지 삭제 API (Cloudinary 버전)
app.delete("/api/profile-image/:userUuid", authenticateJWT, async (req, res) => {
  try {
    const { userUuid } = req.params;
    const { userUuid: jwtUserUuid, isAdmin } = req.user;
    
    // 본인 또는 관리자만 삭제 가능
    if (userUuid !== jwtUserUuid && !isAdmin) {
      return res.status(403).json({ 
        success: false, 
        error: '권한이 없습니다.' 
      });
    }
    
    const profileImage = await ProfileImageModel.findOne({ userUuid });
    
    if (!profileImage) {
      return res.status(404).json({ 
        success: false, 
        error: '프로필 이미지를 찾을 수 없습니다.' 
      });
    }
    
    // Cloudinary에서 이미지 삭제
    if (profileImage.cloudinaryPublicId) {
      await cloudinary.uploader.destroy(profileImage.cloudinaryPublicId);
      console.log(`🗑️ [PROFILE-IMAGE] Cloudinary image deleted: ${profileImage.cloudinaryPublicId}`);
    }
    
    // DB에서 삭제
    await ProfileImageModel.deleteOne({ userUuid });
    
    res.json({
      success: true,
      message: '프로필 이미지가 삭제되었습니다.'
    });
    
  } catch (error) {
    console.error('❌ [PROFILE-IMAGE] Delete error:', error);
    res.status(500).json({ 
      success: false, 
      error: '프로필 이미지 삭제 중 오류가 발생했습니다.' 
    });
  }
});
```

### 5️⃣ MongoDB 스키마 수정

**ProfileImage 모델에 `cloudinaryPublicId` 필드 추가:**

기존 스키마 찾아서 아래 필드 추가:
```javascript
cloudinaryPublicId: String // Cloudinary public_id 저장
```

### 6️⃣ 클라이언트 코드 수정

**client/src/App.jsx**의 `handleProfileImageUpload` 함수 수정:

```javascript
// 📸 프로필 이미지 업로드 함수 (Cloudinary 버전)
const handleProfileImageUpload = async (event, targetUserUuid = null, targetUsername = null) => {
  const file = event.target.files?.[0];
  if (!file) return;

  // 파일 크기 확인 (2MB)
  if (file.size > 2 * 1024 * 1024) {
    alert('⚠️ 이미지 크기는 2MB 이하여야 합니다.');
    return;
  }

  if (!file.type.startsWith('image/')) {
    alert('⚠️ 이미지 파일만 업로드할 수 있습니다.');
    return;
  }

  const finalTargetUserUuid = targetUserUuid || userUuid;
  const finalTargetUsername = targetUsername || username;

  try {
    setUploadingImage(true);

    const formData = new FormData();
    formData.append('profileImage', file);
    formData.append('targetUserUuid', finalTargetUserUuid);
    formData.append('targetUsername', finalTargetUsername);

    const response = await authenticatedRequest.post(
      `${serverUrl}/api/profile-image/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    if (response.data.success) {
      console.log('📸 Upload response:', response.data);
      
      // Cloudinary URL은 전체 경로로 오므로 그대로 사용 (캐시 버스팅 추가)
      const cloudinaryUrl = response.data.imageUrl;
      const finalUrl = cloudinaryUrl + '?t=' + Date.now();
      
      console.log('📸 Cloudinary image URL:', cloudinaryUrl);
      console.log('📸 Final URL with cache busting:', finalUrl);
      
      // 내 프로필 이미지인 경우
      if (finalTargetUserUuid === userUuid) {
        setProfileImage(finalUrl);
        localStorage.setItem('profileImage', finalUrl);
      }
      
      // 캐시에 저장
      const newCache = {
        ...userProfileImages,
        [finalTargetUserUuid]: finalUrl
      };
      setUserProfileImages(newCache);
      localStorage.setItem('userProfileImages', JSON.stringify(newCache));
      console.log('💾 Image saved to cache for userUuid:', finalTargetUserUuid);
      
      // 모달 업데이트
      if (showProfile) {
        const currentModalUserUuid = selectedUserProfile ? otherUserData?.userUuid : userUuid;
        
        if (currentModalUserUuid === finalTargetUserUuid) {
          if (selectedUserProfile) {
            setOtherUserData(prev => ({
              ...prev,
              profileImage: finalUrl
            }));
          } else {
            setProfileImage(finalUrl);
          }
        }
      }
      
      alert(`✅ ${finalTargetUsername}님의 프로필 이미지가 업데이트되었습니다!`);
    }
  } catch (error) {
    console.error('❌ [PROFILE-IMAGE] Upload error:', error);
    alert('⚠️ 이미지 업로드에 실패했습니다.');
  } finally {
    setUploadingImage(false);
  }
};
```

## 📌 주요 변경 사항

### Before (로컬 파일 시스템)
```javascript
const imageUrl = `/uploads/profiles/${filename}`;
// 문제: Render 재배포 시 파일 삭제됨
```

### After (Cloudinary)
```javascript
const imageUrl = req.file.path; // Cloudinary 전체 URL
// 예: https://res.cloudinary.com/your-cloud/image/upload/v1234/fishing_game/profiles/abc.jpg
// ✅ 재배포해도 이미지 유지됨
```

## 🚀 배포 순서

1. **Cloudinary 계정 생성 및 정보 확인**
2. **Render 환경 변수 추가**
3. **서버 패키지 설치**
4. **서버 코드 수정 및 커밋**
5. **클라이언트 코드 수정 및 커밋**
6. **빌드 및 배포**
7. **테스트: 프로필 이미지 업로드 후 재배포하여 확인**

## ⚠️ 주의사항

1. **기존 업로드된 이미지는 이동되지 않음**
   - 새로 업로드된 이미지부터 Cloudinary에 저장됨
   - 필요시 기존 이미지를 수동으로 Cloudinary에 업로드

2. **환경 변수 보안**
   - `.env` 파일은 절대 Git에 커밋하지 마세요
   - `.gitignore`에 `.env` 추가 확인

3. **Cloudinary 무료 플랜 제한**
   - 저장공간: 25GB
   - 월 대역폭: 25GB
   - 충분한 용량이지만 모니터링 필요

## 🔍 테스트 방법

1. 프로필 이미지 업로드
2. Cloudinary Dashboard에서 이미지 확인
3. Render에서 서버 재배포
4. 이미지가 여전히 표시되는지 확인

## 💡 추가 개선 사항

### 자동 이미지 최적화
Cloudinary는 자동으로:
- WebP 포맷으로 변환
- 디바이스에 맞는 크기로 리사이징
- 압축 최적화

### CDN 캐싱
- 전 세계 CDN을 통해 빠른 이미지 로딩
- 서버 부하 감소

## 📚 참고 문서

- [Cloudinary Node.js SDK](https://cloudinary.com/documentation/node_integration)
- [multer-storage-cloudinary](https://www.npmjs.com/package/multer-storage-cloudinary)
- [Render Persistent Storage](https://render.com/docs/disks)


