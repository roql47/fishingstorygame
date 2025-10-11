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
  },
  rare_fish_hunter: {
    id: "rare_fish_hunter",
    name: "이제 입질이 오기 시작했어",
    description: "0.3% 물고기 10번 낚시하기",
    autoCheck: true // 자동으로 체크 가능
  },
  raid_finisher: {
    id: "raid_finisher",
    name: "전장의 지배자",
    description: "레이드 물고기 마지막 공격으로 처치",
    autoCheck: true // 자동으로 체크 가능
  },
  raid_damage_master: {
    id: "raid_damage_master",
    name: "마음을 불태워라",
    description: "레이드 누적데미지 1000000달성",
    autoCheck: true // 자동으로 체크 가능
  }
};

// 업적 시스템 클래스
class AchievementSystem {
  constructor(CatchModel, FishingSkillModel, UserUuidModel, RaidDamageModel, RareFishCountModel) {
    this.CatchModel = CatchModel;
    this.FishingSkillModel = FishingSkillModel;
    this.UserUuidModel = UserUuidModel;
    this.RaidDamageModel = RaidDamageModel;
    this.RareFishCountModel = RareFishCountModel;
  }

  // 업적 자동 체크 및 부여
  async checkAndGrantAchievements(userUuid, username) {
    try {
      console.log(`🏆 Checking achievements for ${username} (${userUuid})`);
      let achievementGranted = false;
      
      // 1. 보유 물고기 수 체크 (기존 업적)
      const totalFish = await this.CatchModel.countDocuments({ userUuid });
      console.log(`🐟 Total fish for ${username}: ${totalFish}`);
      
      if (totalFish >= 100) {
        const existingAchievement = await AchievementModel.findOne({
          userUuid,
          achievementId: "fish_collector"
        });
        
        if (!existingAchievement) {
          await this.grantSingleAchievement(userUuid, username, "fish_collector");
          achievementGranted = true;
        }
      }
      
      // 2. 0.3% 물고기 10번 낚시 체크 (새로운 업적)
      const rareFishRecord = await this.RareFishCountModel.findOne({ userUuid });
      const rareFishCount = rareFishRecord?.rareFishCount || 0;
      console.log(`🎣 0.3% 물고기 낚은 횟수 for ${username}: ${rareFishCount}`);
      
      if (rareFishCount >= 10) {
        const existingRareFishAchievement = await AchievementModel.findOne({
          userUuid,
          achievementId: "rare_fish_hunter"
        });
        
        if (!existingRareFishAchievement) {
          await this.grantSingleAchievement(userUuid, username, "rare_fish_hunter");
          achievementGranted = true;
        }
      }
      
      // 3. 레이드 누적 데미지 1000000 체크 (새로운 업적)
      const raidDamageRecord = await this.RaidDamageModel.findOne({ userUuid });
      const totalRaidDamage = raidDamageRecord?.totalDamage || 0;
      console.log(`⚔️ 레이드 누적 데미지 for ${username}: ${totalRaidDamage}`);
      
      if (totalRaidDamage >= 1000000) {
        const existingRaidDamageAchievement = await AchievementModel.findOne({
          userUuid,
          achievementId: "raid_damage_master"
        });
        
        if (!existingRaidDamageAchievement) {
          await this.grantSingleAchievement(userUuid, username, "raid_damage_master");
          achievementGranted = true;
        }
      }
      
      return achievementGranted;
    } catch (error) {
      console.error("Failed to check achievements:", error);
      return false;
    }
  }

  // 단일 업적 부여 헬퍼 함수
  async grantSingleAchievement(userUuid, username, achievementId) {
    const achievementDef = ACHIEVEMENT_DEFINITIONS[achievementId];
    const achievement = new AchievementModel({
      userUuid,
      username,
      achievementId,
      achievementName: achievementDef.name,
      description: achievementDef.description
    });
    
    await achievement.save();
    console.log(`🏆 Achievement granted to ${username}: ${achievementId}`);
  }

  // 레이드 데미지 업데이트 및 업적 체크
  async updateRaidDamage(userUuid, username, damage) {
    try {
      console.log(`⚔️ [ACHIEVEMENT] Starting raid damage update for ${username} (${userUuid}): +${damage}`);
      
      // RaidDamageModel 존재 확인
      if (!this.RaidDamageModel) {
        console.error("❌ [ACHIEVEMENT] RaidDamageModel is not initialized!");
        return false;
      }
      
      // 레이드 데미지 누적
      const result = await this.RaidDamageModel.findOneAndUpdate(
        { userUuid },
        { 
          $inc: { totalDamage: damage },
          username: username // 닉네임 업데이트
        },
        { upsert: true, new: true }
      );
      
      console.log(`⚔️ [ACHIEVEMENT] ${username} 레이드 데미지 ${damage} 추가됨, 총 누적: ${result.totalDamage}`);
      
      // 업적 체크
      const achievementGranted = await this.checkAndGrantAchievements(userUuid, username);
      console.log(`🏆 [ACHIEVEMENT] Achievement check result: ${achievementGranted}`);
      
      return achievementGranted;
    } catch (error) {
      console.error("❌ [ACHIEVEMENT] Failed to update raid damage:", error);
      console.error("❌ [ACHIEVEMENT] Error details:", error.message);
      console.error("❌ [ACHIEVEMENT] Error stack:", error.stack);
      return false;
    }
  }

  // 희귀 물고기 카운트 업데이트 및 업적 체크
  async updateRareFishCount(userUuid, username) {
    try {
      // 희귀 물고기 카운트 증가
      const result = await this.RareFishCountModel.findOneAndUpdate(
        { userUuid },
        { 
          $inc: { rareFishCount: 1 },
          username: username // 닉네임 업데이트
        },
        { upsert: true, new: true }
      );
      
      console.log(`🎣 ${username} 희귀 물고기 카운트 증가, 총 개수: ${result.rareFishCount}`);
      
      // 업적 체크
      return await this.checkAndGrantAchievements(userUuid, username);
    } catch (error) {
      console.error("Failed to update rare fish count:", error);
      return false;
    }
  }

  // 레이드 마지막 공격 업적 체크 및 부여
  async checkRaidFinisherAchievement(userUuid, username) {
    try {
      console.log(`🏆 Checking raid finisher achievement for ${username} (${userUuid})`);
      
      // 이미 업적을 가지고 있는지 확인
      const existingAchievement = await AchievementModel.findOne({
        userUuid,
        achievementId: "raid_finisher"
      });
      
      if (!existingAchievement) {
        await this.grantSingleAchievement(userUuid, username, "raid_finisher");
        console.log(`🏆 Raid finisher achievement granted to ${username}!`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("Failed to check raid finisher achievement:", error);
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

  // 사용자 업적 목록 조회 (진행상황 포함)
  async getUserAchievements(userUuid) {
    try {
      // 사용자의 완료된 업적 조회
      const completedAchievements = await AchievementModel.find({ 
        userUuid 
      }).lean();
      
      // 진행상황 데이터 조회
      const [totalFish, rareFishRecord, raidDamageRecord] = await Promise.all([
        this.CatchModel.countDocuments({ userUuid }),
        this.RareFishCountModel.findOne({ userUuid }).lean(),
        this.RaidDamageModel.findOne({ userUuid }).lean()
      ]);
      
      const rareFishCount = rareFishRecord?.rareFishCount || 0;
      const totalRaidDamage = raidDamageRecord?.totalDamage || 0;
      
      // 모든 업적 정의와 완료 상태 및 진행상황 매핑
      const achievements = Object.values(ACHIEVEMENT_DEFINITIONS).map(def => {
        const completed = completedAchievements.find(a => a.achievementId === def.id);
        
        // 진행상황 계산
        let progress = null;
        let maxProgress = null;
        
        if (def.id === "fish_collector") {
          progress = totalFish;
          maxProgress = 100;
        } else if (def.id === "rare_fish_hunter") {
          progress = rareFishCount;
          maxProgress = 10;
        } else if (def.id === "raid_damage_master") {
          progress = totalRaidDamage;
          maxProgress = 1000000;
        }
        
        return {
          id: def.id,
          name: def.name,
          description: def.description,
          completed: !!completed,
          completedAt: completed?.completedAt || null,
          grantedBy: completed?.grantedBy || null,
          progress: progress,
          maxProgress: maxProgress,
          progressPercentage: maxProgress ? Math.min(100, Math.round((progress / maxProgress) * 100)) : null
        };
      });
      
      const result = {
        success: true,
        achievements,
        totalAchievements: achievements.length,
        completedCount: completedAchievements.length
      };
      
      console.log(`🏆 [${userUuid}] 업적 조회 완료: ${completedAchievements.length}/${achievements.length} 달성`);
      
      return result;
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
