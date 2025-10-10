/**
 * 재료 데이터 마이그레이션 스크립트
 * 
 * 기존: 각 재료마다 개별 document (휘핑크림 1000개 = document 1000개)
 * 신규: 재료당 1개 document + count 필드 (휘핑크림 1000개 = document 1개, count: 1000)
 * 
 * 실행 방법: node server/migrate_materials.js
 */

const mongoose = require('mongoose');

// MongoDB 연결 설정
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fishing_game';

// Material Schema (신규)
const materialSchema = new mongoose.Schema(
  {
    userUuid: { type: String, index: true },
    username: { type: String, required: true, index: true },
    userId: { type: String, index: true },
    material: { type: String, required: true },
    count: { type: Number, default: 1, min: 0 },
    displayName: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

materialSchema.index({ userUuid: 1, material: 1 }, { unique: true, sparse: true });
materialSchema.index({ username: 1, material: 1 }, { unique: true, sparse: true });

// 기존 데이터를 위한 모델 (unique index 없음)
const OldMaterialModel = mongoose.model('OldMaterial', new mongoose.Schema({}, { strict: false, collection: 'materials' }));

async function migrateMaterials() {
  try {
    console.log('🔄 재료 데이터 마이그레이션 시작...');
    console.log(`📡 MongoDB 연결 중: ${MONGODB_URI}`);
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB 연결 완료\n');
    
    // 1단계: 기존 데이터 분석
    console.log('📊 [1단계] 기존 데이터 분석 중...');
    const totalDocs = await OldMaterialModel.countDocuments();
    console.log(`   총 document 수: ${totalDocs.toLocaleString()}개`);
    
    if (totalDocs === 0) {
      console.log('   ⚠️  마이그레이션할 데이터가 없습니다.');
      await mongoose.disconnect();
      return;
    }
    
    // 샘플 데이터 확인
    const sampleDoc = await OldMaterialModel.findOne();
    console.log('   샘플 document:', {
      userUuid: sampleDoc.userUuid,
      username: sampleDoc.username,
      material: sampleDoc.material,
      count: sampleDoc.count || '(없음 - 마이그레이션 필요)',
      _id: sampleDoc._id
    });
    
    // count 필드가 이미 있는지 확인
    const docsWithCount = await OldMaterialModel.countDocuments({ count: { $exists: true, $gt: 0 } });
    console.log(`   count 필드가 있는 documents: ${docsWithCount}개`);
    
    if (docsWithCount === totalDocs) {
      console.log('   ✅ 모든 documents에 이미 count 필드가 있습니다.');
      console.log('   ℹ️  중복 제거만 수행합니다.\n');
    } else {
      console.log(`   ⚠️  ${totalDocs - docsWithCount}개 documents에 count 필드가 없습니다.\n`);
    }
    
    // 2단계: 사용자별 재료별 그룹화
    console.log('📊 [2단계] 데이터 그룹화 중...');
    const groupedMaterials = await OldMaterialModel.aggregate([
      {
        $group: {
          _id: {
            userUuid: '$userUuid',
            username: '$username',
            userId: '$userId',
            material: '$material'
          },
          totalCount: { $sum: { $ifNull: ['$count', 1] } }, // count 필드가 없으면 1로 간주
          displayName: { $first: '$displayName' },
          createdAt: { $first: '$createdAt' },
          docIds: { $push: '$_id' }
        }
      },
      {
        $sort: { totalCount: -1 }
      }
    ]);
    
    console.log(`   그룹화 결과: ${groupedMaterials.length.toLocaleString()}개 고유 재료`);
    
    // 상위 10개 재료 출력
    console.log('\n   📦 가장 많은 재료 TOP 10:');
    groupedMaterials.slice(0, 10).forEach((item, index) => {
      console.log(`      ${index + 1}. ${item._id.username || item._id.userUuid} - ${item._id.material}: ${item.totalCount.toLocaleString()}개 (documents: ${item.docIds.length}개)`);
    });
    
    // 3단계: 백업 컬렉션 생성
    console.log('\n💾 [3단계] 백업 생성 중...');
    const backupCollectionName = `materials_backup_${Date.now()}`;
    const db = mongoose.connection.db;
    
    try {
      await db.collection('materials').aggregate([
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
    const deleteResult = await OldMaterialModel.deleteMany({});
    console.log(`   ✅ ${deleteResult.deletedCount.toLocaleString()}개 documents 삭제 완료`);
    
    // 5단계: 신규 형식으로 데이터 삽입
    console.log('\n📝 [5단계] 신규 형식으로 데이터 삽입 중...');
    
    // 🔧 기존 인덱스 삭제 (충돌 방지)
    try {
      const existingIndexes = await db.collection('materials').indexes();
      console.log('   기존 인덱스:', existingIndexes.map(idx => idx.name).join(', '));
      
      for (const index of existingIndexes) {
        if (index.name !== '_id_') { // _id 인덱스는 삭제하면 안 됨
          await db.collection('materials').dropIndex(index.name);
          console.log(`   🗑️  인덱스 삭제: ${index.name}`);
        }
      }
    } catch (error) {
      console.log('   ⚠️  인덱스 삭제 중 오류 (무시):', error.message);
    }
    
    // 신규 인덱스 생성
    await db.collection('materials').createIndex({ userUuid: 1, material: 1 }, { unique: true, sparse: true });
    await db.collection('materials').createIndex({ username: 1, material: 1 }, { unique: true, sparse: true });
    console.log('   ✅ 신규 인덱스 생성 완료');
    
    const batchSize = 1000;
    let insertedCount = 0;
    
    for (let i = 0; i < groupedMaterials.length; i += batchSize) {
      const batch = groupedMaterials.slice(i, i + batchSize);
      
      const newDocs = batch.map(item => ({
        userUuid: item._id.userUuid,
        username: item._id.username,
        userId: item._id.userId,
        material: item._id.material,
        count: item.totalCount,
        displayName: item.displayName,
        createdAt: item.createdAt || new Date()
      }));
      
      try {
        await db.collection('materials').insertMany(newDocs, { ordered: false });
        insertedCount += newDocs.length;
        
        // 진행률 출력
        const progress = ((i + batch.length) / groupedMaterials.length * 100).toFixed(1);
        process.stdout.write(`\r   진행률: ${progress}% (${insertedCount.toLocaleString()}/${groupedMaterials.length.toLocaleString()})`);
      } catch (error) {
        console.error(`\n   ⚠️  배치 ${i / batchSize + 1} 삽입 중 오류:`, error.message);
      }
    }
    
    console.log(`\n   ✅ ${insertedCount.toLocaleString()}개 documents 삽입 완료`);
    
    // 6단계: 결과 검증
    console.log('\n✅ [6단계] 결과 검증 중...');
    const newTotalDocs = await db.collection('materials').countDocuments();
    const totalCountSum = await db.collection('materials').aggregate([
      { $group: { _id: null, total: { $sum: '$count' } } }
    ]).toArray();
    
    console.log(`   신규 document 수: ${newTotalDocs.toLocaleString()}개`);
    console.log(`   총 재료 개수: ${totalCountSum[0]?.total.toLocaleString()}개`);
    console.log(`   압축률: ${((1 - newTotalDocs / totalDocs) * 100).toFixed(1)}% (${totalDocs.toLocaleString()} → ${newTotalDocs.toLocaleString()})`);
    
    // 샘플 검증
    const sampleNewDoc = await db.collection('materials').findOne();
    console.log('\n   샘플 신규 document:', {
      userUuid: sampleNewDoc.userUuid,
      username: sampleNewDoc.username,
      material: sampleNewDoc.material,
      count: sampleNewDoc.count,
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
  console.log('🔄 재료 데이터 마이그레이션 스크립트');
  console.log('='.repeat(60));
  console.log();
  
  migrateMaterials()
    .then(() => {
      console.log('\n✅ 스크립트 실행 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 스크립트 실행 실패:', error);
      process.exit(1);
    });
}

module.exports = { migrateMaterials };

