const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fishing_game';

async function restoreBackup() {
  try {
    console.log('🔄 백업에서 복원 중...');
    await mongoose.connect(MONGODB_URI);
    
    const db = mongoose.connection.db;
    
    // materials 컬렉션 삭제
    await db.collection('materials').drop().catch(() => console.log('   materials 컬렉션이 없습니다.'));
    
    // 백업에서 복원
    const backupName = 'materials_backup_1760104405214';
    const backupDocs = await db.collection(backupName).find({}).toArray();
    
    if (backupDocs.length > 0) {
      await db.collection('materials').insertMany(backupDocs);
      console.log(`✅ ${backupDocs.length}개 documents 복원 완료`);
    } else {
      console.log('❌ 백업 데이터를 찾을 수 없습니다.');
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ 복원 실패:', error);
    process.exit(1);
  }
}

restoreBackup();

