/**
 * Render MongoDB 클러스터 모든 게스트 계정 완전 삭제 스크립트
 * isGuest: true인 모든 게스트와 관련 데이터 완전 제거
 * 
 * 사용법: node delete_all_guests_complete.js "mongodb+srv://..."
 */

const mongoose = require('mongoose');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 명령어 인자에서 URL 가져오기
const mongodb_url = process.argv[2];

if (!mongodb_url) {
  console.error('❌ 오류: MONGODB_URL이 필요합니다!');
  console.error('사용법: node delete_all_guests_complete.js "mongodb+srv://..."');
  rl.close();
  process.exit(1);
}

if (!mongodb_url.includes('mongodb+srv://')) {
  console.error('❌ 유효하지 않은 URL입니다. mongodb+srv://로 시작해야 합니다.');
  rl.close();
  process.exit(1);
}

console.log('📍 입력된 URL (마스킹됨):', mongodb_url.substring(0, 20) + '...' + mongodb_url.substring(mongodb_url.length - 20));

async function deleteAllGuests() {
  try {
    console.log('\n🔌 MongoDB 연결 중...');
    await mongoose.connect(mongodb_url, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB 연결 성공');

    // 현재 연결된 데이터베이스 정보 확인
    const dbName = mongoose.connection.name;
    const dbHost = mongoose.connection.host;
    console.log(`📊 데이터베이스: ${dbName} @ ${dbHost}`);

    // 모든 모델 정의
    const userUuidSchema = new mongoose.Schema({
      userUuid: { type: String, required: true, unique: true },
      username: { type: String, required: true },
      displayName: { type: String, required: true },
      isGuest: { type: Boolean, default: false },
      passwordHash: { type: String },
    });
    const UserUuidModel = mongoose.model('UserUuid', userUuidSchema);

    // 모든 게스트 조회 (passwordHash 상관없이)
    console.log('\n🔍 모든 게스트 계정 검색 중...');
    const allGuests = await UserUuidModel.find({
      isGuest: true
    });

    console.log(`\n찾은 모든 게스트 계정: ${allGuests.length}개`);
    
    if (allGuests.length === 0) {
      console.log('✅ 삭제할 게스트 계정이 없습니다.');
      rl.close();
      await mongoose.connection.close();
      return;
    }

    // 계정 정보 출력
    console.log('\n삭제될 계정 목록 (최대 30개 표시):');
    allGuests.slice(0, 30).forEach((guest, index) => {
      const hasPassword = guest.passwordHash ? '✓' : '✗';
      console.log(`  ${index + 1}. ${guest.username} (UUID: ${guest.userUuid}) [비밀번호: ${hasPassword}]`);
    });
    
    if (allGuests.length > 30) {
      console.log(`  ... 외 ${allGuests.length - 30}개 더`);
    }

    // 사용자 확인
    rl.question('\n⚠️  정말로 위의 모든 게스트 계정과 관련 데이터를 삭제하시겠습니까? (yes/no): ', async (answer) => {
      if (answer.toLowerCase() !== 'yes') {
        console.log('❌ 작업이 취소되었습니다.');
        rl.close();
        await mongoose.connection.close();
        return;
      }

      try {
        // 삭제할 userUuid 목록
        const userUuidsToDelete = allGuests.map(guest => guest.userUuid);
        console.log(`\n🗑️  ${userUuidsToDelete.length}개 계정 관련 데이터 삭제 중...\n`);

        // 모든 관련 컬렉션에서 데이터 삭제
        const deleteOperations = [
          { name: 'Catch', query: { userUuid: { $in: userUuidsToDelete } } },
          { name: 'UserMoney', query: { userUuid: { $in: userUuidsToDelete } } },
          { name: 'UserAmber', query: { userUuid: { $in: userUuidsToDelete } } },
          { name: 'UserEquipment', query: { userUuid: { $in: userUuidsToDelete } } },
          { name: 'Material', query: { userUuid: { $in: userUuidsToDelete } } },
          { name: 'FishingSkill', query: { userUuid: { $in: userUuidsToDelete } } },
          { name: 'StarPiece', query: { userUuid: { $in: userUuidsToDelete } } },
          { name: 'Companion', query: { userUuid: { $in: userUuidsToDelete } } },
          { name: 'CompanionStats', query: { userUuid: { $in: userUuidsToDelete } } },
          { name: 'ClickerStage', query: { userUuid: { $in: userUuidsToDelete } } },
          { name: 'RaidKillCount', query: { userUuid: { $in: userUuidsToDelete } } },
          { name: 'EtherKey', query: { userUuid: { $in: userUuidsToDelete } } },
          { name: 'AlchemyPotion', query: { userUuid: { $in: userUuidsToDelete } } },
          { name: 'CouponUsage', query: { userUuid: { $in: userUuidsToDelete } } },
          { name: 'FishDiscovery', query: { userUuid: { $in: userUuidsToDelete } } },
          { name: 'ExpeditionRewardClaim', query: { userUuid: { $in: userUuidsToDelete } } },
          { name: 'ProfileImage', query: { userUuid: { $in: userUuidsToDelete } } },
          { name: 'Cooldown', query: { userUuid: { $in: userUuidsToDelete } } },
          { name: 'RaidDamage', query: { userUuid: { $in: userUuidsToDelete } } },
          { name: 'RareFishCount', query: { userUuid: { $in: userUuidsToDelete } } },
          { name: 'DailyQuest', query: { userUuid: { $in: userUuidsToDelete } } },
          { name: 'MarketListing', query: { userUuid: { $in: userUuidsToDelete } } },
          { name: 'MarketTradeHistory', query: { userUuid: { $in: userUuidsToDelete } } },
          { name: 'Mail', query: { userUuid: { $in: userUuidsToDelete } } },
          { name: 'Admin', query: { userUuid: { $in: userUuidsToDelete } } }
        ];

        let totalDeleted = 0;

        for (const op of deleteOperations) {
          try {
            const result = await mongoose.connection.collection(op.name).deleteMany(op.query);
            if (result.deletedCount > 0) {
              console.log(`  ✅ ${op.name}: ${result.deletedCount}개 삭제됨`);
              totalDeleted += result.deletedCount;
            }
          } catch (err) {
            // 컬렉션이 없으면 무시
            if (!err.message.includes('does not exist')) {
              console.log(`  ⚠️  ${op.name}: ${err.message}`);
            }
          }
        }

        // 마지막으로 UserUuid 컬렉션에서 모든 게스트 계정 삭제
        console.log(`\n🗑️  UserUuid 컬렉션에서 모든 게스트 계정 삭제 중...`);
        const userUuidResult = await UserUuidModel.deleteMany({
          isGuest: true
        });
        console.log(`  ✅ UserUuid: ${userUuidResult.deletedCount}개 삭제됨`);
        totalDeleted += userUuidResult.deletedCount;

        console.log(`\n✅ 총 ${totalDeleted}개의 데이터가 삭제되었습니다!`);
        console.log('🎉 모든 게스트 계정이 완전히 제거되었습니다.');

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
deleteAllGuests();
