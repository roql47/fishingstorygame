/**
 * 동료 백업 데이터 복원 스크립트
 */

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fishing_game';
const BACKUP_NAME = 'companionstats_backup_1760106943700';

async function restoreBackup() {
  try {
    console.log('🔄 백업 데이터 복원 중...');
    console.log(`📡 MongoDB 연결 중: ${MONGODB_URI}`);
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB 연결 완료\n');
    
    const db = mongoose.connection.db;
    
    // 1. 백업 데이터 확인
    const backupCount = await db.collection(BACKUP_NAME).countDocuments();
    console.log(`📦 백업 데이터: ${backupCount}개 documents\n`);
    
    if (backupCount === 0) {
      console.log('❌ 백업 데이터가 없습니다.');
      await mongoose.disconnect();
      return;
    }
    
    // 2. 현재 companionstats 삭제
    console.log('🗑️  현재 companionstats 삭제 중...');
    await db.collection('companionstats').drop().catch(() => console.log('   (컬렉션이 없습니다)'));
    
    // 3. 백업에서 복원
    console.log('📥 백업에서 복원 중...');
    const backupDocs = await db.collection(BACKUP_NAME).find({}).toArray();
    await db.collection('companionstats').insertMany(backupDocs);
    
    console.log(`✅ ${backupDocs.length}개 documents 복원 완료\n`);
    
    // 4. 샘플 데이터 확인
    const sample = backupDocs[0];
    console.log('샘플 데이터:', {
      username: sample.username,
      companionName: sample.companionName,
      level: sample.level,
      experience: sample.experience
    });
    
    console.log('\n🎉 복원 완료!');
    
  } catch (error) {
    console.error('\n❌ 복원 실패:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ MongoDB 연결 종료');
  }
}

restoreBackup();

