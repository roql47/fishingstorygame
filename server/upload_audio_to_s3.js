require('dotenv').config();
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

// S3 클라이언트 초기화
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'fishing-game-assets';
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN || '';

async function uploadAudioToS3() {
  try {
    // 음원 파일 경로
    const audioPath = path.join(__dirname, '../assets/sound/클로에 - Chloe (Neal K).mp3');
    
    // 파일 존재 확인
    if (!fs.existsSync(audioPath)) {
      console.error('❌ 음원 파일을 찾을 수 없습니다:', audioPath);
      return;
    }

    // 파일 읽기
    const fileBuffer = fs.readFileSync(audioPath);
    const fileName = 'chloe-neal-k.mp3'; // URL에 사용하기 좋은 이름으로 변경

    console.log('📤 S3에 음원 파일 업로드 중...');
    console.log('파일명:', fileName);
    console.log('크기:', (fileBuffer.length / 1024 / 1024).toFixed(2), 'MB');

    // S3에 업로드
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: `audio/${fileName}`,
      Body: fileBuffer,
      ContentType: 'audio/mpeg',
      CacheControl: 'public, max-age=31536000', // 1년 캐싱
    });

    await s3Client.send(command);

    console.log('✅ 업로드 완료!');
    console.log('');
    console.log('📋 파일 정보:');
    console.log('  S3 경로:', `s3://${S3_BUCKET_NAME}/audio/${fileName}`);
    
    if (CLOUDFRONT_DOMAIN) {
      console.log('  CloudFront URL:', `https://${CLOUDFRONT_DOMAIN}/audio/${fileName}`);
      console.log('');
      console.log('💡 AudioPlayer.jsx에서 다음 URL을 사용하세요:');
      console.log(`  src: 'https://${CLOUDFRONT_DOMAIN}/audio/${fileName}'`);
    } else {
      console.log('  S3 URL:', `https://${S3_BUCKET_NAME}.s3.ap-northeast-2.amazonaws.com/audio/${fileName}`);
      console.log('');
      console.log('⚠️  CloudFront 도메인이 설정되지 않았습니다.');
      console.log('💡 더 빠른 성능을 위해 CloudFront를 사용하는 것을 권장합니다.');
    }

  } catch (error) {
    console.error('❌ 업로드 실패:', error);
    console.error('');
    console.error('💡 .env 파일에 다음 환경 변수가 설정되어 있는지 확인하세요:');
    console.error('  - AWS_ACCESS_KEY_ID');
    console.error('  - AWS_SECRET_ACCESS_KEY');
    console.error('  - AWS_S3_BUCKET_NAME');
    console.error('  - CLOUDFRONT_DOMAIN (선택)');
  }
}

// 실행
uploadAudioToS3();

