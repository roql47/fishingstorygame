/**
 * 물고기 데이터 마이그레이션 스크립트
 * 
 * 기존: 각 물고기마다 개별 document (참치 1000마리 = document 1000개)
 * 신규: 물고기당 1개 document + count 필드 (참치 1000마리 = document 1개, count: 1000)
 * 추가: weight 필드 제거
 * 
 * 실행 방법: node server/migrate_fish.js
 */

const mongoose = require('mongoose');

// MongoDB 연결 설정
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fishing_game';

// Catch Schema (신규)
const catchSchema = new mongoose.Schema(
  {
    userUuid: { type: String, index: true },
    username: { type: String, required: true, index: true },
    fish: { type: String, required: true },
    count: { type: Number, default: 1, min: 0 },
    userId: { type: String, index: true },
    displayName: { type: String },
    probability: { type: Number },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

catchSchema.index({ userUuid: 1, fish: 1 }, { unique: true, sparse: true });
catchSchema.index({ username: 1, fish: 1 }, { unique: true, sparse: true });

// 기존 데이터를 위한 모델 (unique index 없음)
const OldCatchModel = mongoose.model('OldCatch', new mongoose.Schema({}, { strict: false, collection: 'catches' }));

async function migrateFish() {
  try {
    console.log('🔄 물고기 데이터 마이그레이션 시작...');
    console.log(`📡 MongoDB 연결 중: ${MONGODB_URI}`);
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB 연결 완료\n');
    
    // 1단계: 기존 데이터 분석
    console.log('📊 [1단계] 기존 데이터 분석 중...');
    const totalDocs = await OldCatchModel.countDocuments();
    console.log(`   총 document 수: ${totalDocs.toLocaleString()}개`);
    
    if (totalDocs === 0) {
      console.log('   ⚠️  마이그레이션할 데이터가 없습니다.');
      await mongoose.disconnect();
      return;
    }
    
    // 샘플 데이터 확인
    const sampleDoc = await OldCatchModel.findOne();
    console.log('   샘플 document:', {
      userUuid: sampleDoc.userUuid,
      username: sampleDoc.username,
      fish: sampleDoc.fish,
      weight: sampleDoc.weight || '(없음)',
      count: sampleDoc.count || '(없음 - 마이그레이션 필요)',
      _id: sampleDoc._id
    });
    
    // count 필드가 이미 있는지 확인
    const docsWithCount = await OldCatchModel.countDocuments({ count: { $exists: true, $gt: 0 } });
    console.log(`   count 필드가 있는 documents: ${docsWithCount}개`);
    
    if (docsWithCount === totalDocs) {
      console.log('   ✅ 모든 documents에 이미 count 필드가 있습니다.');
      console.log('   ℹ️  중복 제거와 weight 필드 제거만 수행합니다.\n');
    } else {
      console.log(`   ⚠️  ${totalDocs - docsWithCount}개 documents에 count 필드가 없습니다.\n`);
    }
    
    // 2단계: 사용자별 물고기별 그룹화
    console.log('📊 [2단계] 데이터 그룹화 중...');
    const groupedFish = await OldCatchModel.aggregate([
      {
        $group: {
          _id: {
            userUuid: '$userUuid',
            username: '$username',
            userId: '$userId',
            fish: '$fish'
          },
          totalCount: { $sum: { $ifNull: ['$count', 1] } }, // count 필드가 없으면 1로 간주
          displayName: { $first: '$displayName' },
          probability: { $first: '$probability' },
          createdAt: { $first: '$createdAt' },
          docIds: { $push: '$_id' }
        }
      },
      {
        $sort: { totalCount: -1 }
      }
    ]);
    
    console.log(`   그룹화 결과: ${groupedFish.length.toLocaleString()}개 고유 물고기`);
    
    // 상위 10개 물고기 출력
    console.log('\n   🐟 가장 많은 물고기 TOP 10:');
    groupedFish.slice(0, 10).forEach((item, index) => {
      console.log(`      ${index + 1}. ${item._id.username || item._id.userUuid} - ${item._id.fish}: ${item.totalCount.toLocaleString()}마리 (documents: ${item.docIds.length}개)`);
    });
    
    // 3단계: 백업 컬렉션 생성
    console.log('\n💾 [3단계] 백업 생성 중...');
    const backupCollectionName = `catches_backup_${Date.now()}`;
    const db = mongoose.connection.db;
    
    try {
      await db.collection('catches').aggregate([
        { $match: {} },
        { $out: backupCollectionName }
      ]).toArray();
      console.log(`   ✅ 백업 완료: ${backupCollectionName}`);
    } catch (error) {
      console.error('   ❌ 백업 실패:', error.message);
      console.log('   ⚠️  백업 없이 계속 진행할까요? (Ctrl+C로 중단)');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // 4단계: 기존 데이터 삭제
    console.log('\n🗑️  [4단계] 기존 데이터 삭제 중...');
    const deleteResult = await OldCatchModel.deleteMany({});
    console.log(`   ✅ ${deleteResult.deletedCount.toLocaleString()}개 documents 삭제 완료`);
    
    // 5단계: 신규 형식으로 데이터 삽입
    console.log('\n📝 [5단계] 신규 형식으로 데이터 삽입 중...');
    
    // 기존 인덱스 삭제 (충돌 방지)
    try {
      const existingIndexes = await db.collection('catches').indexes();
      console.log('   기존 인덱스:', existingIndexes.map(idx => idx.name).join(', '));
      
      for (const index of existingIndexes) {
        if (index.name !== '_id_') { // _id 인덱스는 삭제하면 안 됨
          await db.collection('catches').dropIndex(index.name);
          console.log(`   🗑️  인덱스 삭제: ${index.name}`);
        }
      }
    } catch (error) {
      console.log('   ⚠️  인덱스 삭제 중 오류 (무시):', error.message);
    }
    
    // 신규 인덱스 생성
    await db.collection('catches').createIndex({ userUuid: 1, fish: 1 }, { unique: true, sparse: true });
    await db.collection('catches').createIndex({ username: 1, fish: 1 }, { unique: true, sparse: true });
    console.log('   ✅ 신규 인덱스 생성 완료');
    
    const batchSize = 1000;
    let insertedCount = 0;
    
    for (let i = 0; i < groupedFish.length; i += batchSize) {
      const batch = groupedFish.slice(i, i + batchSize);
      
      const newDocs = batch.map(item => ({
        userUuid: item._id.userUuid,
        username: item._id.username,
        userId: item._id.userId,
        fish: item._id.fish,
        count: item.totalCount,
        displayName: item.displayName,
        probability: item.probability,
        createdAt: item.createdAt || new Date()
        // weight 필드는 제거됨
      }));
      
      try {
        await db.collection('catches').insertMany(newDocs, { ordered: false });
        insertedCount += newDocs.length;
        
        // 진행률 출력
        const progress = ((i + batch.length) / groupedFish.length * 100).toFixed(1);
        process.stdout.write(`\r   진행률: ${progress}% (${insertedCount.toLocaleString()}/${groupedFish.length.toLocaleString()})`);
      } catch (error) {
        console.error(`\n   ⚠️  배치 ${i / batchSize + 1} 삽입 중 오류:`, error.message);
      }
    }
    
    console.log(`\n   ✅ ${insertedCount.toLocaleString()}개 documents 삽입 완료`);
    
    // 6단계: 결과 검증
    console.log('\n✅ [6단계] 결과 검증 중...');
    const newTotalDocs = await db.collection('catches').countDocuments();
    const totalCountSum = await db.collection('catches').aggregate([
      { $group: { _id: null, total: { $sum: '$count' } } }
    ]).toArray();
    
    console.log(`   신규 document 수: ${newTotalDocs.toLocaleString()}개`);
    console.log(`   총 물고기 개수: ${totalCountSum[0]?.total.toLocaleString()}마리`);
    console.log(`   압축률: ${((1 - newTotalDocs / totalDocs) * 100).toFixed(1)}% (${totalDocs.toLocaleString()} → ${newTotalDocs.toLocaleString()})`);
    
    // 샘플 검증
    const sampleNewDoc = await db.collection('catches').findOne();
    console.log('\n   샘플 신규 document:', {
      userUuid: sampleNewDoc.userUuid,
      username: sampleNewDoc.username,
      fish: sampleNewDoc.fish,
      count: sampleNewDoc.count,
      weight: sampleNewDoc.weight || '(제거됨 ✓)',
      _id: sampleNewDoc._id
    });
    
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
  console.log('🔄 물고기 데이터 마이그레이션 스크립트');
  console.log('='.repeat(60));
  console.log();
  
  migrateFish()
    .then(() => {
      console.log('\n✅ 스크립트 실행 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 스크립트 실행 실패:', error);
      process.exit(1);
    });
}

module.exports = { migrateFish };

