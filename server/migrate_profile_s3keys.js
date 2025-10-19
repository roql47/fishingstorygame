// MongoDB 프로필 이미지 s3Key 마이그레이션 스크립트
const mongoose = require('mongoose');
require('dotenv').config();

const ProfileImageSchema = new mongoose.Schema({
  userId: String,
  username: String,
  userUuid: String,
  imageUrl: String,
  s3Key: String,
  originalName: String,
  fileSize: Number,
  uploadedAt: Date
});

const ProfileImageModel = mongoose.model('ProfileImage', ProfileImageSchema);

async function migrateS3Keys() {
  try {
    console.log('🔄 MongoDB 연결 중...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB 연결 성공');

    // s3Key가 없는 레코드 찾기
    const imagesWithoutS3Key = await ProfileImageModel.find({
      $or: [
        { s3Key: { $exists: false } },
        { s3Key: null },
        { s3Key: '' }
      ]
    });

    console.log(`📊 s3Key가 없는 레코드: ${imagesWithoutS3Key.length}개`);

    for (const image of imagesWithoutS3Key) {
      // CloudFront URL에서 s3Key 추출
      if (image.imageUrl && image.imageUrl.includes('cloudfront.net')) {
        const urlParts = image.imageUrl.split('/');
        const s3Key = `${urlParts[urlParts.length - 2]}/${urlParts[urlParts.length - 1].split('?')[0]}`;
        
        image.s3Key = s3Key;
        await image.save();
        
        console.log(`✅ ${image.username}: s3Key 추가 (${s3Key})`);
      } else {
        console.log(`⚠️ ${image.username}: CloudFront URL이 아님, 건너뜀`);
      }
    }

    console.log('🎉 마이그레이션 완료!');
    process.exit(0);
  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  }
}

migrateS3Keys();

