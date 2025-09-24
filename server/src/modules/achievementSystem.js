const mongoose = require('mongoose');

// 업적 스키마 정의
const achievementSchema = new mongoose.Schema(
  {
    userUuid: { type: String, required: true, index: true },
    username: { type: String, required: true },
    achievementId: { type: String, required: true }, // "fox_location", "fox_gamble", "fish_collector"
    achievementName: { type: String, required: true }, // 업적 이름
    description: { type: String, required: true }, // 업적 설명
    completedAt: { type: Date, default: Date.now }, // 완료 시간
    grantedBy: { type: String }, // 관리자가 부여한 경우 관리자 이름
  },
  { timestamps: true }
);

// 사용자당 업적 중복 방지
achievementSchema.index({ userUuid: 1, achievementId: 1 }, { unique: true });

// 업적 모델
const AchievementModel = mongoose.model("Achievement", achievementSchema);

// 업적 정의
const ACHIEVEMENT_DEFINITIONS = {
  fox_location: {
    id: "fox_location",
    name: "여우가 어디사는지 아니?",
    description: "여우이야기 채팅방 플레이 유저라면 획득",
    autoCheck: false // 관리자가 수동으로 부여
  },
  fox_gamble: {
    id: "fox_gamble", 
    name: "여우는 겜블을 좋아해",
    description: "호감도 100만점이상 달성",
    autoCheck: false // 관리자가 수동으로 부여
  },
  fish_collector: {
    id: "fish_collector",
    name: "너를 위해 준비했어",
    description: "보유물고기 100마리 이상",
    autoCheck: true // 자동으로 체크 가능
  }
};

// 업적 시스템 클래스
class AchievementSystem {
  constructor(CatchModel, FishingSkillModel, UserUuidModel) {
    this.CatchModel = CatchModel;
    this.FishingSkillModel = FishingSkillModel;
    this.UserUuidModel = UserUuidModel;
  }

  // 업적 자동 체크 및 부여
  async checkAndGrantAchievements(userUuid, username) {
    try {
      console.log(`🏆 Checking achievements for ${username} (${userUuid})`);
      
      // 보유 물고기 수 체크
      const totalFish = await this.CatchModel.countDocuments({ userUuid });
      console.log(`🐟 Total fish for ${username}: ${totalFish}`);
      
      if (totalFish >= 100) {
        // 이미 업적을 가지고 있는지 확인
        const existingAchievement = await AchievementModel.findOne({
          userUuid,
          achievementId: "fish_collector"
        });
        
        if (!existingAchievement) {
          // 업적 부여
          const achievement = new AchievementModel({
            userUuid,
            username,
            achievementId: "fish_collector",
            achievementName: ACHIEVEMENT_DEFINITIONS.fish_collector.name,
            description: ACHIEVEMENT_DEFINITIONS.fish_collector.description
          });
          
          await achievement.save();
          console.log(`🏆 Achievement granted to ${username}: fish_collector`);
          
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error("Failed to check achievements:", error);
      return false;
    }
  }

  // 관리자 업적 해제
  async revokeAchievement(targetUsername, achievementId, revokedBy) {
    try {
      // 업적 정의 확인
      if (!ACHIEVEMENT_DEFINITIONS[achievementId]) {
        throw new Error("Invalid achievement ID");
      }
      
      // 대상 사용자 찾기
      const targetUser = await this.UserUuidModel.findOne({ username: targetUsername }).lean();
      if (!targetUser) {
        throw new Error("Target user not found");
      }
      
      // 업적을 가지고 있는지 확인
      const existingAchievement = await AchievementModel.findOne({
        userUuid: targetUser.userUuid,
        achievementId
      });
      
      if (!existingAchievement) {
        throw new Error("User does not have this achievement");
      }
      
      // 업적 제거
      await AchievementModel.deleteOne({
        userUuid: targetUser.userUuid,
        achievementId
      });
      
      const achievementDef = ACHIEVEMENT_DEFINITIONS[achievementId];
      console.log(`🏆 Admin ${revokedBy} revoked achievement ${achievementId} from ${targetUsername}`);
      
      return {
        success: true,
        message: `Achievement '${achievementDef.name}' revoked from ${targetUsername}`
      };
    } catch (error) {
      console.error("Failed to revoke achievement:", error);
      throw error;
    }
  }

  // 관리자 업적 부여
  async grantAchievement(targetUsername, achievementId, grantedBy) {
    try {
      // 업적 정의 확인
      if (!ACHIEVEMENT_DEFINITIONS[achievementId]) {
        throw new Error("Invalid achievement ID");
      }
      
      // 대상 사용자 찾기
      const targetUser = await this.UserUuidModel.findOne({ username: targetUsername }).lean();
      if (!targetUser) {
        throw new Error("Target user not found");
      }
      
      // 이미 업적을 가지고 있는지 확인
      const existingAchievement = await AchievementModel.findOne({
        userUuid: targetUser.userUuid,
        achievementId
      });
      
      if (existingAchievement) {
        throw new Error("User already has this achievement");
      }
      
      // 업적 부여
      const achievementDef = ACHIEVEMENT_DEFINITIONS[achievementId];
      const achievement = new AchievementModel({
        userUuid: targetUser.userUuid,
        username: targetUser.username,
        achievementId,
        achievementName: achievementDef.name,
        description: achievementDef.description,
        grantedBy: grantedBy
      });
      
      await achievement.save();
      
      console.log(`🏆 Admin ${grantedBy} granted achievement ${achievementId} to ${targetUsername}`);
      
      return {
        success: true,
        message: `Achievement '${achievementDef.name}' granted to ${targetUsername}`
      };
    } catch (error) {
      console.error("Failed to grant achievement:", error);
      throw error;
    }
  }

  // 사용자 업적 목록 조회
  async getUserAchievements(userUuid) {
    try {
      // 사용자의 완료된 업적 조회
      const completedAchievements = await AchievementModel.find({ 
        userUuid 
      }).lean();
      
      // 모든 업적 정의와 완료 상태 매핑
      const achievements = Object.values(ACHIEVEMENT_DEFINITIONS).map(def => {
        const completed = completedAchievements.find(a => a.achievementId === def.id);
        return {
          id: def.id,
          name: def.name,
          description: def.description,
          completed: !!completed,
          completedAt: completed?.completedAt || null,
          grantedBy: completed?.grantedBy || null
        };
      });
      
      return {
        success: true,
        achievements,
        totalAchievements: achievements.length,
        completedCount: completedAchievements.length
      };
    } catch (error) {
      console.error("Failed to fetch user achievements:", error);
      throw error;
    }
  }

  // 업적 보너스 계산
  async calculateAchievementBonus(userUuid) {
    try {
      const achievementCount = await AchievementModel.countDocuments({ userUuid });
      return achievementCount;
    } catch (error) {
      console.error("Failed to calculate achievement bonus:", error);
      return 0;
    }
  }

  // 낚시실력에 업적 보너스 적용 (로깅용)
  async logAchievementBonus(userUuid) {
    try {
      const achievementCount = await this.calculateAchievementBonus(userUuid);
      const fishingSkill = await this.FishingSkillModel.findOne({ userUuid });
      const baseSkill = fishingSkill?.skill || 0;
      const finalSkill = baseSkill + achievementCount;
      
      console.log(`🏆 Achievement bonus applied for ${userUuid}: base ${baseSkill} + achievements ${achievementCount} = ${finalSkill}`);
      
      return { baseSkill, achievementCount, finalSkill };
    } catch (error) {
      console.error("Failed to calculate achievement bonus:", error);
      return { baseSkill: 0, achievementCount: 0, finalSkill: 0 };
    }
  }
}

module.exports = {
  AchievementModel,
  ACHIEVEMENT_DEFINITIONS,
  AchievementSystem
};
