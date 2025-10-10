/**
 * 동료 경험치 마이그레이션 스크립트
 * 
 * 기존 경험치 공식에서 새로운 공식으로 전환
 * 새 공식: 레벨당 필요 경험치 = Math.floor(100 + level^2.1 * 25)
 * 
 * 실행 방법: node server/migrate_companion_exp.js
 */

const mongoose = require('mongoose');

// MongoDB 연결 설정
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fishing_game';

// 새로운 경험치 공식
const calculateExpToNextLevel = (level) => {
  return Math.floor(100 + Math.pow(level, 2.1) * 25);
};

// 이전 경험치 공식
const calculateOldExpToNextLevel = (level) => {
  // 이전 공식: level^1.8 (더 쉬웠음)
  return Math.floor(100 + Math.pow(level, 1.8) * 25);
};

// 레벨 1부터 특정 레벨까지 필요한 총 경험치 계산 (새 공식)
const calculateTotalExpForLevel = (targetLevel) => {
  let totalExp = 0;
  for (let level = 1; level < targetLevel; level++) {
    totalExp += calculateExpToNextLevel(level);
  }
  return totalExp;
};

// 레벨 1부터 특정 레벨까지 필요한 총 경험치 계산 (구 공식)
const calculateOldTotalExpForLevel = (targetLevel) => {
  let totalExp = 0;
  for (let level = 1; level < targetLevel; level++) {
    totalExp += calculateOldExpToNextLevel(level);
  }
  return totalExp;
};

// 총 경험치로부터 레벨 계산 (새 공식)
const calculateLevelFromTotalExp = (totalExp) => {
  let level = 1;
  let expUsed = 0;
  
  while (level < 100) {
    const expNeeded = calculateExpToNextLevel(level);
    if (expUsed + expNeeded > totalExp) {
      // 현재 레벨의 남은 경험치
      const remainingExp = totalExp - expUsed;
      return { level, experience: remainingExp };
    }
    expUsed += expNeeded;
    level++;
  }
  
  // 최대 레벨 도달
  return { level: 100, experience: totalExp - expUsed };
};

async function migrateCompanionExp() {
  try {
    console.log('🔄 동료 경험치 마이그레이션 시작...');
    console.log(`📡 MongoDB 연결 중: ${MONGODB_URI}`);
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB 연결 완료\n');
    
    // CompanionStats 스키마
    const companionStatsSchema = new mongoose.Schema({}, { strict: false, collection: 'companionstats' });
    const CompanionStatsModel = mongoose.model('CompanionStats', companionStatsSchema);
    
    // 1단계: 기존 데이터 분석
    console.log('📊 [1단계] 기존 데이터 분석 중...');
    const totalCompanions = await CompanionStatsModel.countDocuments();
    console.log(`   총 동료 수: ${totalCompanions.toLocaleString()}개\n`);
    
    if (totalCompanions === 0) {
      console.log('   ⚠️  마이그레이션할 데이터가 없습니다.');
      await mongoose.disconnect();
      return;
    }
    
    // 2단계: 모든 동료 데이터 가져오기
    console.log('📊 [2단계] 동료 데이터 가져오는 중...');
    const companions = await CompanionStatsModel.find({}).lean();
    console.log(`   ✅ ${companions.length.toLocaleString()}개 동료 데이터 로드 완료\n`);
    
    // 3단계: 백업
    console.log('💾 [3단계] 백업 생성 중...');
    const backupCollectionName = `companionstats_backup_${Date.now()}`;
    const db = mongoose.connection.db;
    
    try {
      await db.collection('companionstats').aggregate([
        { $match: {} },
        { $out: backupCollectionName }
      ]).toArray();
      console.log(`   ✅ 백업 완료: ${backupCollectionName}\n`);
    } catch (error) {
      console.error('   ❌ 백업 실패:', error.message);
      console.log('   ⚠️  백업 없이 계속 진행할까요? (Ctrl+C로 중단)');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // 4단계: 경험치 재계산
    console.log('🔄 [4단계] 경험치 재계산 중...');
    let updatedCount = 0;
    let unchangedCount = 0;
    const updates = [];
    
    for (const companion of companions) {
      const oldLevel = companion.level || 1;
      const oldExp = companion.experience || 0;
      
      // 현재 총 경험치 계산 (구 공식 기준)
      const oldTotalExpToLevel = calculateOldTotalExpForLevel(oldLevel);
      const totalExp = oldTotalExpToLevel + oldExp;
      
      // 새 공식으로 레벨 재계산
      const { level: newLevel, experience: newExp } = calculateLevelFromTotalExp(totalExp);
      
      if (oldLevel !== newLevel || oldExp !== newExp) {
        updates.push({
          companionName: companion.companionName,
          userUuid: companion.userUuid,
          username: companion.username,
          oldLevel,
          oldExp,
          newLevel,
          newExp,
          totalExp
        });
        updatedCount++;
      } else {
        unchangedCount++;
      }
    }
    
    console.log(`   분석 완료:`);
    console.log(`   - 변경 필요: ${updatedCount.toLocaleString()}개`);
    console.log(`   - 변경 불필요: ${unchangedCount.toLocaleString()}개\n`);
    
    if (updatedCount === 0) {
      console.log('✅ 변경할 데이터가 없습니다. 마이그레이션을 종료합니다.');
      await mongoose.disconnect();
      return;
    }
    
    // 상위 10개 변경사항 출력
    console.log('   📦 주요 변경사항 TOP 10:');
    updates.slice(0, 10).forEach((update, index) => {
      console.log(`      ${index + 1}. ${update.username} - ${update.companionName}:`);
      console.log(`         Lv.${update.oldLevel} (${update.oldExp}exp) → Lv.${update.newLevel} (${update.newExp}exp)`);
      console.log(`         총 경험치: ${update.totalExp.toLocaleString()}`);
    });
    console.log();
    
    // 5단계: 데이터베이스 업데이트
    console.log('💾 [5단계] 데이터베이스 업데이트 중...');
    
    const batchSize = 100;
    let processedCount = 0;
    
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      const bulkOps = batch.map(update => ({
        updateOne: {
          filter: { 
            userUuid: update.userUuid, 
            companionName: update.companionName 
          },
          update: { 
            $set: { 
              level: update.newLevel, 
              experience: update.newExp 
            } 
          }
        }
      }));
      
      try {
        const result = await CompanionStatsModel.bulkWrite(bulkOps);
        processedCount += result.modifiedCount;
        
        const progress = ((i + batch.length) / updates.length * 100).toFixed(1);
        process.stdout.write(`\r   진행률: ${progress}% (${processedCount.toLocaleString()}/${updates.length.toLocaleString()})`);
      } catch (error) {
        console.error(`\n   ⚠️  배치 ${i / batchSize + 1} 업데이트 중 오류:`, error.message);
      }
    }
    
    console.log(`\n   ✅ ${processedCount.toLocaleString()}개 동료 업데이트 완료\n`);
    
    // 6단계: 결과 검증
    console.log('✅ [6단계] 결과 검증 중...');
    
    // 샘플 데이터 확인
    if (updates.length > 0) {
      const sampleUpdate = updates[0];
      const verifyDoc = await CompanionStatsModel.findOne({
        userUuid: sampleUpdate.userUuid,
        companionName: sampleUpdate.companionName
      });
      
      console.log('   샘플 검증:', {
        companionName: sampleUpdate.companionName,
        username: sampleUpdate.username,
        이전: `Lv.${sampleUpdate.oldLevel} (${sampleUpdate.oldExp}exp)`,
        이후: `Lv.${verifyDoc.level} (${verifyDoc.experience}exp)`,
        예상: `Lv.${sampleUpdate.newLevel} (${sampleUpdate.newExp}exp)`,
        일치: verifyDoc.level === sampleUpdate.newLevel && verifyDoc.experience === sampleUpdate.newExp ? '✅' : '❌'
      });
    }
    
    console.log('\n🎉 마이그레이션 완료!');
    console.log(`📦 백업 컬렉션: ${backupCollectionName}`);
    console.log('💡 백업을 확인한 후 다음 명령으로 삭제할 수 있습니다:');
    console.log(`   db.${backupCollectionName}.drop()`);
    
  } catch (error) {
    console.error('\n❌ 마이그레이션 실패:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ MongoDB 연결 종료');
  }
}

// 스크립트 실행
if (require.main === module) {
  console.log('='.repeat(60));
  console.log('🔄 동료 경험치 마이그레이션 스크립트');
  console.log('='.repeat(60));
  console.log();
  
  migrateCompanionExp()
    .then(() => {
      console.log('\n✅ 스크립트 실행 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 스크립트 실행 실패:', error);
      process.exit(1);
    });
}

module.exports = { migrateCompanionExp };

