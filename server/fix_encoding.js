const mongoose = require("mongoose");
require("dotenv").config();

// MongoDB 연결
const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL;

// User 스키마 정의 (간단한 버전)
const UserSchema = new mongoose.Schema({
  userUuid: String,
  username: String,
  displayName: String,
  originalGoogleId: String,
  originalKakaoId: String,
  isGuest: Boolean,
});

const UserModel = mongoose.model("User", UserSchema, "users");

// UTF-8 인코딩 수정 함수
function fixEncoding(str) {
  if (!str) return str;
  
  try {
    // 이미 올바른 UTF-8이면 그대로 반환
    if (!/[\x80-\xFF]/.test(str)) {
      return str; // ASCII만 있으면 문제없음
    }
    
    // Latin-1(ISO-8859-1)로 잘못 인코딩된 UTF-8 바이트를 복구
    const buffer = Buffer.from(str, 'latin1');
    const decoded = buffer.toString('utf8');
    
    return decoded;
  } catch (error) {
    console.error('Encoding fix failed:', error);
    return str; // 실패하면 원본 반환
  }
}

// 메인 수정 함수
async function fixAllUserEncodings() {
  try {
    console.log("🔗 MongoDB 연결 중...");
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
    });
    console.log("✅ MongoDB 연결 성공!");

    // 모든 사용자 조회
    const users = await UserModel.find({});
    console.log(`📊 총 ${users.length}명의 사용자 발견`);

    let fixedCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      let needsUpdate = false;
      const updates = {};

      // username 확인 및 수정
      if (user.username && /[\x80-\xFF]/.test(user.username)) {
        const fixed = fixEncoding(user.username);
        if (fixed !== user.username) {
          console.log(`\n🔧 사용자 ${user.userUuid}:`);
          console.log(`  Username: "${user.username}" -> "${fixed}"`);
          updates.username = fixed;
          needsUpdate = true;
        }
      }

      // displayName 확인 및 수정
      if (user.displayName && /[\x80-\xFF]/.test(user.displayName)) {
        const fixed = fixEncoding(user.displayName);
        if (fixed !== user.displayName) {
          console.log(`\n🔧 사용자 ${user.userUuid}:`);
          console.log(`  DisplayName: "${user.displayName}" -> "${fixed}"`);
          updates.displayName = fixed;
          needsUpdate = true;
        }
      }

      // 업데이트 필요한 경우
      if (needsUpdate) {
        await UserModel.updateOne(
          { _id: user._id },
          { $set: updates }
        );
        fixedCount++;
        console.log(`✅ 수정 완료`);
      } else {
        skippedCount++;
      }
    }

    console.log(`\n📊 처리 완료:`);
    console.log(`  ✅ 수정됨: ${fixedCount}명`);
    console.log(`  ⏭️  스킵됨: ${skippedCount}명`);
    console.log(`  📊 총: ${users.length}명`);

    await mongoose.connection.close();
    console.log("🔌 MongoDB 연결 종료");
    
  } catch (error) {
    console.error("❌ 에러 발생:", error);
    process.exit(1);
  }
}

// 스크립트 실행
console.log("🚀 인코딩 수정 스크립트 시작...");
fixAllUserEncodings();

