// 원정 보상 수령 기록 삭제 스크립트
// 사용법: node clear_expedition_claim.js [userUuid]

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://wlstjd3398:Trr6fQK5p0oTSEGo@fishingcluster.uqvln.mongodb.net/fishing_game?retryWrites=true&w=majority";

// 스키마 정의
const expeditionRewardClaimSchema = new mongoose.Schema({
  userUuid: { type: String, required: true },
  username: { type: String, required: true },
  roomId: { type: String, required: true },
  rewards: [{
    fishName: String,
    quantity: Number
  }],
  claimedAt: { type: Date, default: Date.now }
}, {
  collection: 'expeditionrewardclaims'
});

// Unique index 설정
expeditionRewardClaimSchema.index({ userUuid: 1, roomId: 1 }, { unique: true });

const ExpeditionRewardClaim = mongoose.model('ExpeditionRewardClaim', expeditionRewardClaimSchema);

async function clearExpeditionClaim(userUuid) {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    
    console.log('MongoDB 연결 성공');
    
    if (userUuid) {
      // 특정 사용자의 가장 최근 기록 삭제
      const recentClaim = await ExpeditionRewardClaim.findOne({ userUuid })
        .sort({ claimedAt: -1 });
      
      if (recentClaim) {
        console.log(`\n삭제할 기록:`, {
          userUuid: recentClaim.userUuid,
          username: recentClaim.username,
          roomId: recentClaim.roomId,
          claimedAt: recentClaim.claimedAt,
          rewards: recentClaim.rewards
        });
        
        const confirm = process.argv[2] === userUuid && process.argv[3] === 'confirm';
        
        if (confirm) {
          await ExpeditionRewardClaim.deleteOne({ _id: recentClaim._id });
          console.log('\n✅ 기록이 삭제되었습니다.');
        } else {
          console.log('\n⚠️  삭제하려면 다음 명령어를 실행하세요:');
          console.log(`node clear_expedition_claim.js ${userUuid} confirm`);
        }
      } else {
        console.log(`\n❌ ${userUuid}의 보상 수령 기록을 찾을 수 없습니다.`);
      }
    } else {
      // 모든 기록 조회
      const allClaims = await ExpeditionRewardClaim.find().sort({ claimedAt: -1 }).limit(10);
      
      console.log('\n최근 10개의 보상 수령 기록:');
      allClaims.forEach((claim, index) => {
        console.log(`\n[${index + 1}]`, {
          userUuid: claim.userUuid,
          username: claim.username,
          roomId: claim.roomId,
          claimedAt: claim.claimedAt,
          rewards: claim.rewards
        });
      });
      
      console.log('\n사용법:');
      console.log('node clear_expedition_claim.js [userUuid]         # 특정 사용자의 최근 기록 확인');
      console.log('node clear_expedition_claim.js [userUuid] confirm # 특정 사용자의 최근 기록 삭제');
    }
    
    await mongoose.disconnect();
    console.log('\nMongoDB 연결 종료');
    
  } catch (error) {
    console.error('❌ 오류 발생:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// 실행
const userUuid = process.argv[2];
clearExpeditionClaim(userUuid);

