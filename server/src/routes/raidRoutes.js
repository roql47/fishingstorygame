const express = require('express');
const router = express.Router();
const RaidSystem = require('../modules/raidSystem');
const { AchievementSystem } = require('../modules/achievementSystem');

// 레이드 시스템 인스턴스 생성
const raidSystem = new RaidSystem();

// 레이드 라우트 설정 함수
function setupRaidRoutes(io, UserUuidModel, authenticateJWT, CompanionModel, FishingSkillModel, CompanionStatsModel, AchievementModel, oldAchievementSystem, AdminModel, CooldownModel, StarPieceModel, RaidDamageModel, RareFishCountModel, CatchModel, RaidKillCountModel, UserEquipmentModel) {
  
  // 🏆 레이드 라우트 전용 업적 시스템 인스턴스 생성 (모든 모델 포함)
  const achievementSystem = new AchievementSystem(
    CatchModel, 
    FishingSkillModel, 
    UserUuidModel, 
    RaidDamageModel, 
    RareFishCountModel
  );
  
  console.log('🏆 [RAID] Achievement system initialized with models:', {
    CatchModel: !!CatchModel,
    FishingSkillModel: !!FishingSkillModel,
    UserUuidModel: !!UserUuidModel,
    RaidDamageModel: !!RaidDamageModel,
    RareFishCountModel: !!RareFishCountModel
  });
  // 레이드 보스 소환 API (관리자 전용)
  router.post("/summon", authenticateJWT, async (req, res) => {
    try {
      const { userUuid } = req.user;
      
      // 관리자 권한 확인 (JWT 토큰과 데이터베이스 양쪽 확인)
      const user = await UserUuidModel.findOne({ userUuid }).lean();
      
      // JWT 토큰에서 관리자 권한 확인
      const jwtIsAdmin = req.user.isAdmin;
      
      // 데이터베이스에서 관리자 권한 확인 (UserUuidModel과 AdminModel 양쪽 확인)
      let dbIsAdmin = user?.isAdmin || false;
      
      // AdminModel에서도 확인 (별도 관리자 컬렉션)
      const adminRecord = await AdminModel.findOne({ userUuid }).lean();
      if (adminRecord?.isAdmin) {
        dbIsAdmin = true;
        
        // AdminModel에 권한이 있지만 UserUuidModel에 없는 경우 동기화
        if (user && !user.isAdmin) {
          console.log(`🔄 [RAID] Syncing admin rights for ${userUuid}: AdminModel -> UserUuidModel`);
          await UserUuidModel.updateOne(
            { userUuid },
            { $set: { isAdmin: true } }
          );
        }
      }
      
      // JWT 토큰 또는 데이터베이스 중 하나라도 관리자면 허용
      const hasAdminRights = jwtIsAdmin || dbIsAdmin;
      
      console.log(`🔍 [RAID] Admin check for ${userUuid}:`, {
        jwtIsAdmin,
        userModelIsAdmin: user?.isAdmin,
        adminModelIsAdmin: adminRecord?.isAdmin,
        finalDecision: hasAdminRights
      });
      
      if (!hasAdminRights) {
        return res.status(403).json({ error: "관리자만 레이드 보스를 소환할 수 있습니다." });
      }
      
      // 레이드 보스 소환 (비동기 처리)
      const boss = await raidSystem.summonBoss();
      
      // 클라이언트 전송용 보스 정보 (Map을 객체로 변환)
      const bossForClient = {
        ...boss,
        participants: Object.fromEntries(boss.participants),
        participantNames: boss.participantNames ? 
          Object.fromEntries(boss.participantNames) : {}
      };
      
      // 모든 클라이언트에게 레이드 보스 정보 전송
      io.emit("raid:boss:update", { boss: bossForClient });
      
      // 채팅에 레이드 시작 알림 (처치 횟수 및 체력 정보 포함)
      const hpFormatted = boss.maxHp.toLocaleString();
      const killCount = boss.killCount || 0;
      let summonMessage = `🐉 레이드 보스 '마르가글레슘'이 나타났습니다! (체력: ${hpFormatted})`;
      
      if (killCount > 0) {
        summonMessage += ` | 처치 횟수: ${killCount}회, 체력 증가율: ${((boss.maxHp / 8000 - 1) * 100).toFixed(1)}%`;
      }
      
      summonMessage += ` 모든 플레이어는 전투에 참여하세요!`;
      
      io.emit("chat:message", {
        system: true,
        username: "system",
        content: summonMessage,
        timestamp: new Date().toISOString()
      });
      
      console.log(`[Raid] 레이드 보스 소환됨 by ${userUuid}`);
      res.json({ success: true, boss: bossForClient });
    } catch (error) {
      console.error("[Raid] 레이드 보스 소환 실패:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // 레이드 보스 공격 API
  router.post("/attack", authenticateJWT, async (req, res) => {
    try {
      const { userUuid } = req.user;
      
      // 사용자 정보 가져오기
      const user = await UserUuidModel.findOne({ userUuid }).lean();
      if (!user) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
      }

      // 🛡️ 서버에서 레이드 공격 쿨타임 검증 (10초)
      const now = new Date();
      const cooldownRecord = await CooldownModel.findOne({ userUuid }).lean();
      
      if (cooldownRecord && cooldownRecord.raidAttackCooldownEnd && cooldownRecord.raidAttackCooldownEnd > now) {
        const remainingTime = Math.ceil((cooldownRecord.raidAttackCooldownEnd.getTime() - now.getTime()) / 1000);
        console.log(`🚨 [RAID] Cooldown bypass attempt by ${user.displayName || user.username} - Remaining: ${remainingTime}s`);
        return res.status(429).json({ 
          error: "레이드 공격 쿨타임이 남아있습니다.",
          remainingTime: remainingTime,
          cooldownEnd: cooldownRecord.raidAttackCooldownEnd.toISOString()
        });
      }
      
      // 낚시 실력 정보 가져오기 (별도 모델에서)
      const fishingSkillData = await FishingSkillModel.findOne({ userUuid }).lean();
      const baseSkill = fishingSkillData?.skill || 1;
      
      // 🏆 업적 보너스 계산 (모듈 사용)
      let achievementBonus = 0;
      try {
        achievementBonus = await achievementSystem.calculateAchievementBonus(userUuid);
      } catch (error) {
        console.error("Failed to calculate achievement bonus in raid:", error);
      }
      
      const fishingSkill = baseSkill + achievementBonus;
      
      console.log(`[Raid] ${user.displayName} 낚시실력 데이터:`, {
        fishingSkillData,
        최종_낚시실력: fishingSkill
      });
      
      // 전투 참전 동료 가져오기 (CompanionStatsModel 사용)
      const companions = await CompanionStatsModel.find({ 
        userUuid, 
        isInBattle: true 
      }).lean();
      
      // 모든 동료도 확인 (디버깅용)
      const allCompanions = await CompanionStatsModel.find({ userUuid }).lean();
      
      console.log(`[Raid] ${user.displayName} 동료 데이터:`, {
        전투_참전_동료: companions.length,
        전체_동료: allCompanions.length,
        동료_목록: allCompanions.map(c => ({ name: c.companionName, isInBattle: c.isInBattle, level: c.level }))
      });
      
      // 사용자 장비 정보 조회 (강화 보너스 계산용)
      const userEquipment = await UserEquipmentModel.findOne({ userUuid }).lean();
      
      // 강화 보너스 계산 함수 (퍼센트)
      const calculateEnhancementBonus = (level) => {
        if (level <= 0) return 0;
        return 0.2 * Math.pow(level, 3) - 0.4 * Math.pow(level, 2) + 1.6 * level;
      };
      
      const calculateTotalEnhancementBonus = (level) => {
        let totalBonus = 0;
        for (let i = 1; i <= level; i++) {
          totalBonus += calculateEnhancementBonus(i);
        }
        return totalBonus; // 퍼센트이므로 소수점 유지
      };
      
      // 탐사 전투와 동일한 calculatePlayerAttack 함수 로직 + 강화 보너스 (퍼센트)
      const calculatePlayerAttack = (skill, enhancementBonusPercent = 0) => {
        // 3차방정식: 0.00225 * skill³ + 0.165 * skill² + 2 * skill + 3
        const baseAttack = 0.00225 * Math.pow(skill, 3) + 0.165 * Math.pow(skill, 2) + 2 * skill + 3;
        // 강화 보너스 퍼센트 적용
        const totalAttack = baseAttack + (baseAttack * enhancementBonusPercent / 100);
        // 랜덤 요소 추가 (±20%)
        const randomFactor = 0.8 + Math.random() * 0.4;
        return Math.floor(totalAttack * randomFactor);
      };
      
      // 낚시대 강화 보너스 계산
      const fishingRodEnhancementBonus = calculateTotalEnhancementBonus(userEquipment?.fishingRodEnhancement || 0);
      const playerDamage = calculatePlayerAttack(fishingSkill, fishingRodEnhancementBonus);
      
      // 동료 공격력 계산
      let companionDamage = 0;
      const companionAttacks = [];
      
      for (const companion of companions) {
        // 동료 공격력 계산 (동료 레벨 기반)
        const companionLevel = companion.level || 1;
        const companionAttack = Math.floor(companionLevel * 2 + Math.random() * 5); // 레벨 * 2 + 0~4 랜덤
        companionDamage += companionAttack;
        companionAttacks.push({
          name: companion.companionName, // CompanionStatsModel에서는 companionName 사용
          attack: companionAttack
        });
      }
      
      const finalDamage = playerDamage + companionDamage;
      
      console.log(`[Raid] ${user.displayName} 데미지 계산:`, { 
        fishingSkill: fishingSkill,  // 올바른 변수 사용
        플레이어_데미지: playerDamage,
        동료_데미지: companionDamage,
        동료_공격: companionAttacks,
        최종_데미지: finalDamage
      });
      
      // 레이드 보스 공격 (이미 계산된 최종 데미지 사용)
      const attackResult = raidSystem.attackBoss(userUuid, user.displayName || user.username, finalDamage);
      
      // ⚔️ 레이드 누적 데미지 업데이트 및 업적 체크
      try {
        console.log(`⚔️ [RAID] Updating raid damage for ${user.displayName || user.username}: ${finalDamage}`);
        const achievementGranted = await achievementSystem.updateRaidDamage(userUuid, user.displayName || user.username, finalDamage);
        if (achievementGranted) {
          console.log(`🏆 [RAID] Achievement granted to ${user.displayName || user.username} after raid attack!`);
        }
      } catch (error) {
        console.error("❌ [RAID] Failed to update raid damage:", error);
        console.error("❌ [RAID] Error stack:", error.stack);
      }
      
      // 🛡️ 서버에서 레이드 공격 쿨타임 설정 (10초)
      const raidCooldownDuration = 10 * 1000; // 10초
      const raidCooldownEnd = new Date(now.getTime() + raidCooldownDuration);
      
      const cooldownUpdateData = {
        userId: 'user',
        username: user.displayName || user.username,
        userUuid: userUuid,
        raidAttackCooldownEnd: raidCooldownEnd
      };
      
      // 쿨타임 설정 (병렬 처리)
      const cooldownPromises = [
        CooldownModel.findOneAndUpdate({ userUuid }, cooldownUpdateData, { upsert: true, new: true })
      ];
      
      // UserUuidModel에도 쿨타임 업데이트
      cooldownPromises.push(
        UserUuidModel.updateOne(
          { userUuid },
          { raidAttackCooldownEnd: raidCooldownEnd }
        )
      );
      
      await Promise.all(cooldownPromises);
      
      // 클라이언트 전송용 보스 정보 (Map을 객체로 변환)
      const bossForClient = {
        ...raidSystem.raidBoss,
        participants: Object.fromEntries(raidSystem.raidBoss.participants),
        participantNames: raidSystem.raidBoss.participantNames ? 
          Object.fromEntries(raidSystem.raidBoss.participantNames) : {}
      };
      
      // 모든 클라이언트에게 업데이트 전송
      io.emit("raid:boss:update", { boss: bossForClient });
      io.emit("raid:log:update", { log: attackResult.log });
      
      console.log(`[Raid] ${user.displayName} 공격: ${attackResult.damage} 데미지, 보스 체력: ${raidSystem.raidBoss.hp}/${raidSystem.raidBoss.maxHp}`);
      
      // 보스가 죽었는지 확인
      if (attackResult.isDefeated) {
        await handleRaidBossDefeated(io, UserUuidModel);
      }
      
      // 개별 데미지 정보를 클라이언트에 전송
      res.json({ 
        success: true, 
        damage: attackResult.damage,
        damageBreakdown: {
          playerDamage,
          companionDamage,
          companionAttacks,
          totalDamage: finalDamage
        }
      });
    } catch (error) {
      console.error("[Raid] 레이드 공격 실패:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // 레이드 상태 조회 API
  router.get("/status", authenticateJWT, (req, res) => {
    const status = raidSystem.getRaidStatus();
    
    // 클라이언트 전송용으로 Map을 객체로 변환
    const responseStatus = {
      ...status,
      boss: status.boss ? {
        ...status.boss,
        participants: Object.fromEntries(status.boss.participants),
        participantNames: status.boss.participantNames ? 
          Object.fromEntries(status.boss.participantNames) : {}
      } : null
    };
    
    res.json({ success: true, ...responseStatus });
  });

  // 레이드 보스 처치 처리 함수
  const handleRaidBossDefeated = async (io, UserUuidModel) => {
    try {
      console.log("[Raid] 레이드 보스 처치됨!");
      
      // 🔧 처치 횟수 증가 (다음 보스 체력 계산용)
      const killCountResult = await raidSystem.incrementKillCount();
      
      // 보상 계산
      const rewards = raidSystem.calculateRewards();
      
      // 보상 지급
      for (const reward of rewards) {
        const { userUuid, username, damage, rank, reward: rewardAmount, isLastAttacker } = reward;
        
        // 호박석 지급
        const mongoose = require('mongoose');
        const UserAmberModel = mongoose.model('UserAmber');
        
        let userAmber = await UserAmberModel.findOne({ userUuid });
        if (!userAmber) {
          // 새 사용자인 경우 생성
          userAmber = new UserAmberModel({
            userId: 'user',
            username: username,
            userUuid: userUuid,
            amber: rewardAmount
          });
        } else {
          userAmber.amber = (userAmber.amber || 0) + rewardAmount;
        }
        await userAmber.save();
        
        // 개별 보상 알림
        const userSocket = Array.from(io.sockets.sockets.values())
          .find(s => s.userUuid === userUuid);
        if (userSocket) {
          userSocket.emit("raid:boss:defeated", { reward: { amount: rewardAmount } });
        }
        
        console.log(`[Raid] 보상 지급: ${userUuid} - 순위 ${rank}, 데미지 ${damage}, 보상 ${rewardAmount}${isLastAttacker ? ' (막타 보너스 포함)' : ''}`);
      }
      
      // 마지막 공격자에게 별조각 1개 추가 지급
      if (rewards.length > 0) {
        const lastAttacker = rewards.find(r => r.isLastAttacker);
        if (lastAttacker) {
          // StarPieceModel을 사용하여 별조각 지급
          let userStarPieces = await StarPieceModel.findOne({ userUuid: lastAttacker.userUuid });
          
          if (!userStarPieces) {
            // 새 사용자인 경우 생성
            const createData = {
              userId: 'user',
              username: lastAttacker.username,
              userUuid: lastAttacker.userUuid,
              starPieces: 1
            };
            userStarPieces = new StarPieceModel(createData);
          } else {
            userStarPieces.starPieces = (userStarPieces.starPieces || 0) + 1;
          }
          
          await userStarPieces.save();
          
          // 🏆 레이드 마지막 공격 업적 체크 및 부여
          try {
            const user = await UserUuidModel.findOne({ userUuid: lastAttacker.userUuid }).lean();
            if (user) {
              const achievementGranted = await achievementSystem.checkRaidFinisherAchievement(
                lastAttacker.userUuid, 
                user.displayName || user.username
              );
              if (achievementGranted) {
                console.log(`🏆 Raid finisher achievement granted to ${user.displayName || user.username}!`);
              }
            }
          } catch (achievementError) {
            console.error(`[Raid] Failed to check raid finisher achievement for ${lastAttacker.userUuid}:`, achievementError);
          }
          
          // 막타 보상 알림
          const lastAttackerSocket = Array.from(io.sockets.sockets.values())
            .find(s => s.userUuid === lastAttacker.userUuid);
          if (lastAttackerSocket) {
            lastAttackerSocket.emit("raid:boss:defeated", { 
              reward: { amount: 0 }, 
              lastAttackBonus: { starPieces: 1 } 
            });
          }
          
          console.log(`[Raid] 막타 보너스: ${lastAttacker.userUuid} - 별조각 1개 (총 ${userStarPieces.starPieces}개)`);
        }
      }
      
      // 전체 채팅에 결과 알림
      if (rewards.length > 0) {
        const topPlayer = rewards[0];
        const lastAttacker = rewards.find(r => r.isLastAttacker);
        
        const topPlayerData = await UserUuidModel.findOne({ userUuid: topPlayer.userUuid }).lean();
        const lastAttackerData = await UserUuidModel.findOne({ userUuid: lastAttacker?.userUuid }).lean();
        
        // 🔧 다음 보스 정보 포함한 알림
        let defeatMessage = `🎉 레이드 보스 '마르가글레슘'이 처치되었습니다! MVP: ${topPlayerData?.displayName || topPlayerData?.username} (${topPlayer.damage} 데미지), 막타: ${lastAttackerData?.displayName || lastAttackerData?.username} (별조각 +1)`;
        
        if (killCountResult) {
          const nextHpFormatted = killCountResult.nextHp.toLocaleString();
          defeatMessage += ` | 다음 보스 체력: ${nextHpFormatted} (처치 횟수: ${killCountResult.totalKills})`;
        }
        
        io.emit("chat:message", {
          system: true,
          username: "system",
          content: defeatMessage,
          timestamp: new Date().toISOString()
        });
      }
      
      // 레이드 상태 초기화
      raidSystem.resetRaid();
      
      // 모든 클라이언트에게 레이드 종료 알림
      io.emit("raid:boss:update", { boss: null });
      
    } catch (error) {
      console.error("[Raid] 레이드 보스 처치 처리 실패:", error);
    }
  };

  return router;
}

// WebSocket 이벤트 설정 함수
function setupRaidWebSocketEvents(socket, UserUuidModel) {
  // 레이드 상태 요청 처리
  socket.on("raid:status:request", async () => {
    const status = raidSystem.getRaidStatus();
    if (status.boss) {
      // 클라이언트 전송용 보스 정보 (Map을 객체로 변환)
      const bossForClient = {
        ...status.boss,
        participants: Object.fromEntries(status.boss.participants),
        participantNames: status.boss.participantNames ? 
          Object.fromEntries(status.boss.participantNames) : {}
      };
      
      socket.emit("raid:boss:update", { boss: bossForClient });
      
      // 최근 로그 전송 시 UUID를 사용자명으로 변환
      const recentLogs = status.logs.slice(-20); // 최근 20개 로그만
      for (const log of recentLogs) {
        let displayUsername = log.username;
        
        // username이 UUID 형태인지 확인 (예: #0001, #0002 등)
        if (log.username && log.username.startsWith('#')) {
          try {
            // userUuid로 실제 사용자명 조회
            const user = await UserUuidModel.findOne({ userUuid: log.userUuid }).lean();
            if (user) {
              displayUsername = user.displayName || user.username;
            }
          } catch (error) {
            console.error(`[Raid] 사용자명 조회 실패 for ${log.userUuid}:`, error);
          }
        }
        
        // 수정된 로그 전송
        const correctedLog = {
          ...log,
          username: displayUsername
        };
        
        socket.emit("raid:log:update", { log: correctedLog });
      }
    }
  });
}

module.exports = {
  setupRaidRoutes,
  setupRaidWebSocketEvents,
  raidSystem
};
