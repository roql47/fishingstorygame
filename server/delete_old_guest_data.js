/**
 * 기존 게스트 계정 데이터 삭제 스크립트
 * 용도: Guest#숫자 형식의 기존 게스트 계정 및 관련 모든 데이터 삭제
 * 
 * 사용법: node delete_old_guest_data.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// 데이터베이스 연결
const mongodb_url = process.env.MONGODB_URL || 'mongodb://localhost:27017/fishing_game';

async function deleteOldGuestData() {
  try {
    console.log('🔌 MongoDB 연결 중...');
    await mongoose.connect(mongodb_url, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB 연결 성공');

    // 모든 모델 정의
    const userUuidSchema = new mongoose.Schema({
      userUuid: { type: String, required: true, unique: true },
      username: { type: String, required: true },
      displayName: { type: String, required: true },
      isGuest: { type: Boolean, default: false },
      passwordHash: { type: String },
    });
    const UserUuidModel = mongoose.model('UserUuid', userUuidSchema);

    // 기존 게스트 조회 (passwordHash가 null인 게스트)
    console.log('\n🔍 기존 게스트 계정 검색 중...');
    const oldGuests = await UserUuidModel.find({
      isGuest: true,
      passwordHash: { $in: [null, undefined] }
    });

    console.log(`\n찾은 기존 게스트 계정: ${oldGuests.length}개`);
    
    if (oldGuests.length === 0) {
      console.log('✅ 삭제할 기존 게스트 계정이 없습니다.');
      await mongoose.connection.close();
      return;
    }

    // 계정 정보 출력
    console.log('\n삭제될 계정 목록:');
    oldGuests.forEach((guest, index) => {
      console.log(`  ${index + 1}. ${guest.username} (UUID: ${guest.userUuid})`);
    });

    // 사용자 확인
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('\n⚠️  정말로 위의 모든 기존 게스트 계정과 관련 데이터를 삭제하시겠습니까? (yes/no): ', async (answer) => {
      if (answer.toLowerCase() !== 'yes') {
        console.log('❌ 작업이 취소되었습니다.');
        rl.close();
        await mongoose.connection.close();
        return;
      }

      try {
        // 삭제할 userUuid 목록
        const userUuidsToDelete = oldGuests.map(guest => guest.userUuid);
        console.log(`\n🗑️  ${userUuidsToDelete.length}개 계정 관련 데이터 삭제 중...`);

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
          { name: 'Mail', query: { userUuid: { $in: userUuidsToDelete } } }
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

        // 마지막으로 UserUuid 컬렉션에서 기존 게스트 계정 삭제
        console.log(`\n🗑️  UserUuid 컬렉션에서 기존 게스트 계정 삭제 중...`);
        const userUuidResult = await UserUuidModel.deleteMany({
          isGuest: true,
          passwordHash: { $in: [null, undefined] }
        });
        console.log(`  ✅ UserUuid: ${userUuidResult.deletedCount}개 삭제됨`);
        totalDeleted += userUuidResult.deletedCount;

        console.log(`\n✅ 총 ${totalDeleted}개의 데이터가 삭제되었습니다!`);
        console.log('🎉 작업이 완료되었습니다.');

      } catch (error) {
        console.error('❌ 삭제 중 오류 발생:', error);
      } finally {
        rl.close();
        await mongoose.connection.close();
      }
    });

  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  }
}

// 실행
deleteOldGuestData().catch(error => {
  console.error('❌ 예상치 못한 오류:', error);
  process.exit(1);
});
