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

async function uploadAudioFile(localPath, s3FileName, contentType) {
  try {
    // 파일 존재 확인
    if (!fs.existsSync(localPath)) {
      console.error('❌ 음원 파일을 찾을 수 없습니다:', localPath);
      return null;
    }

    // 파일 읽기
    const fileBuffer = fs.readFileSync(localPath);

    console.log('📤 S3에 음원 파일 업로드 중...');
    console.log('파일명:', s3FileName);
    console.log('크기:', (fileBuffer.length / 1024 / 1024).toFixed(2), 'MB');

    // S3에 업로드
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: `audio/${s3FileName}`,
      Body: fileBuffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000', // 1년 캐싱
    });

    await s3Client.send(command);

    console.log('✅ 업로드 완료!');
    
    const cdnUrl = CLOUDFRONT_DOMAIN 
      ? `https://${CLOUDFRONT_DOMAIN}/audio/${s3FileName}`
      : `https://${S3_BUCKET_NAME}.s3.ap-northeast-2.amazonaws.com/audio/${s3FileName}`;
    
    console.log('  CloudFront URL:', cdnUrl);
    console.log('');
    
    return cdnUrl;

  } catch (error) {
    console.error('❌ 업로드 실패:', error);
    return null;
  }
}

async function uploadAudioToS3() {
  console.log('🎵 음원 파일들을 S3에 업로드합니다...\n');

  const audioFiles = [
    {
      localPath: path.join(__dirname, '../assets/sound/클로에 - Chloe (Neal K).mp3'),
      s3FileName: 'chloe-neal-k.mp3',
      contentType: 'audio/mpeg'
    },
    {
      localPath: path.join(__dirname, '../assets/sound/별안개 - 피아노 연주곡 Ver. (XYNSIA).opus'),
      s3FileName: 'stellar-mist-xynsia.opus',
      contentType: 'audio/opus'
    }
  ];

  const results = [];
  
  for (const audio of audioFiles) {
    const url = await uploadAudioFile(audio.localPath, audio.s3FileName, audio.contentType);
    if (url) {
      results.push({ fileName: audio.s3FileName, url });
    }
  }

  console.log('📋 업로드 완료 요약:');
  console.log('='.repeat(60));
  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.fileName}`);
    console.log(`   URL: ${result.url}`);
  });
  console.log('='.repeat(60));
  console.log('\n💡 AudioPlayer.jsx에서 위 URL들을 사용하세요!');
}

// 실행
uploadAudioToS3();

