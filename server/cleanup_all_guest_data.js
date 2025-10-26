/**
 * MongoDB 클러스터 모든 게스트 데이터 완전 정리 스크립트
 * 각 컬렉션에서 "Guest#"으로 시작하는 모든 데이터 삭제
 * 
 * 사용법: node cleanup_all_guest_data.js "mongodb+srv://..."
 */

const mongoose = require('mongoose');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const mongodb_url = process.argv[2];

if (!mongodb_url) {
  console.error('❌ 오류: MONGODB_URL이 필요합니다!');
  console.error('사용법: node cleanup_all_guest_data.js "mongodb+srv://..."');
  rl.close();
  process.exit(1);
}

if (!mongodb_url.includes('mongodb+srv://')) {
  console.error('❌ 유효하지 않은 URL입니다.');
  rl.close();
  process.exit(1);
}

console.log('📍 입력된 URL (마스킹됨):', mongodb_url.substring(0, 20) + '...' + mongodb_url.substring(mongodb_url.length - 20));

async function cleanupAllGuestData() {
  try {
    console.log('\n🔌 MongoDB 연결 중...');
    await mongoose.connect(mongodb_url, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB 연결 성공');

    const dbName = mongoose.connection.name;
    const dbHost = mongoose.connection.host;
    console.log(`📊 데이터베이스: ${dbName} @ ${dbHost}`);

    // 검색할 컬렉션 목록 (username 또는 displayName 필드가 있는 것들)
    const collectionsToClean = [
      { name: 'useruuids', query: { isGuest: true } },
      { name: 'catches', query: { username: { $regex: '^Guest#' } } },
      { name: 'usermoneys', query: { username: { $regex: '^Guest#' } } },
      { name: 'userambers', query: { username: { $regex: '^Guest#' } } },
      { name: 'userequipments', query: { username: { $regex: '^Guest#' } } },
      { name: 'materials', query: { username: { $regex: '^Guest#' } } },
      { name: 'fishingskills', query: { username: { $regex: '^Guest#' } } },
      { name: 'starpieces', query: { username: { $regex: '^Guest#' } } },
      { name: 'companions', query: { username: { $regex: '^Guest#' } } },
      { name: 'companionsstats', query: { username: { $regex: '^Guest#' } } },
      { name: 'clickerstages', query: { username: { $regex: '^Guest#' } } },
      { name: 'raidkillcounts', query: { username: { $regex: '^Guest#' } } },
      { name: 'etherkeys', query: { username: { $regex: '^Guest#' } } },
      { name: 'alchemypotions', query: { username: { $regex: '^Guest#' } } },
      { name: 'couponusages', query: { username: { $regex: '^Guest#' } } },
      { name: 'fishdiscoveries', query: { username: { $regex: '^Guest#' } } },
      { name: 'expeditionrewardclaims', query: { username: { $regex: '^Guest#' } } },
      { name: 'profileimages', query: { username: { $regex: '^Guest#' } } },
      { name: 'cooldowns', query: { username: { $regex: '^Guest#' } } },
      { name: 'raiddamages', query: { username: { $regex: '^Guest#' } } },
      { name: 'rarefishcounts', query: { username: { $regex: '^Guest#' } } },
      { name: 'dailyquests', query: { username: { $regex: '^Guest#' } } },
      { name: 'marketlistings', query: { username: { $regex: '^Guest#' } } },
      { name: 'markettradehistories', query: { username: { $regex: '^Guest#' } } },
      { name: 'mails', query: { senderUsername: { $regex: '^Guest#' } } },
      { name: 'admins', query: { username: { $regex: '^Guest#' } } }
    ];

    console.log('\n🔍 각 컬렉션에서 게스트 데이터 검색 중...\n');

    let totalFound = 0;
    const findings = [];

    // 모든 컬렉션에서 게스트 데이터 개수 확인
    for (const collection of collectionsToClean) {
      try {
        const count = await mongoose.connection.collection(collection.name).countDocuments(collection.query);
        if (count > 0) {
          console.log(`  📊 ${collection.name}: ${count}개 발견`);
          findings.push({ ...collection, count });
          totalFound += count;
        }
      } catch (err) {
        // 컬렉션이 없으면 무시
      }
    }

    console.log(`\n💾 총 ${totalFound}개의 게스트 데이터 발견`);

    if (totalFound === 0) {
      console.log('✅ 삭제할 게스트 데이터가 없습니다.');
      rl.close();
      await mongoose.connection.close();
      return;
    }

    // 사용자 확인
    rl.question('\n⚠️  위의 모든 게스트 데이터를 완전히 삭제하시겠습니까? (yes/no): ', async (answer) => {
      if (answer.toLowerCase() !== 'yes') {
        console.log('❌ 작업이 취소되었습니다.');
        rl.close();
        await mongoose.connection.close();
        return;
      }

      try {
        console.log(`\n🗑️  게스트 데이터 삭제 중...\n`);

        let totalDeleted = 0;

        // 모든 컬렉션에서 데이터 삭제
        for (const collection of findings) {
          try {
            const result = await mongoose.connection.collection(collection.name).deleteMany(collection.query);
            console.log(`  ✅ ${collection.name}: ${result.deletedCount}개 삭제됨`);
            totalDeleted += result.deletedCount;
          } catch (err) {
            console.log(`  ❌ ${collection.name}: ${err.message}`);
          }
        }

        console.log(`\n✅ 총 ${totalDeleted}개의 게스트 데이터가 삭제되었습니다!`);
        console.log('🎉 모든 게스트 데이터가 완전히 제거되었습니다.');

      } catch (error) {
        console.error('❌ 삭제 중 오류 발생:', error);
      } finally {
        rl.close();
        await mongoose.connection.close();
      }
    });

  } catch (error) {
    console.error('❌ 연결 오류:', error.message);
    rl.close();
    process.exit(1);
  }
}

// 실행
cleanupAllGuestData();
