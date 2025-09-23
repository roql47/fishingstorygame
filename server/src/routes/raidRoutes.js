const express = require('express');
const router = express.Router();
const RaidSystem = require('../modules/raidSystem');

// 레이드 시스템 인스턴스 생성
const raidSystem = new RaidSystem();

// 레이드 라우트 설정 함수
function setupRaidRoutes(io, UserUuidModel, authenticateJWT, CompanionModel, FishingSkillModel) {
  // 레이드 보스 소환 API
  router.post("/summon", authenticateJWT, async (req, res) => {
    try {
      const { userUuid } = req.user;
      
      // 레이드 보스 소환
      const boss = raidSystem.summonBoss();
      
      // 클라이언트 전송용 보스 정보 (Map을 객체로 변환)
      const bossForClient = {
        ...boss,
        participants: Object.fromEntries(boss.participants)
      };
      
      // 모든 클라이언트에게 레이드 보스 정보 전송
      io.emit("raid:boss:update", { boss: bossForClient });
      
      // 채팅에 레이드 시작 알림
      io.emit("chat:message", {
        system: true,
        username: "system",
        content: "🐉 레이드 보스 '마르가글레슘'이 나타났습니다! 모든 플레이어는 전투에 참여하세요!",
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
      
      // 낚시 실력 정보 가져오기 (별도 모델에서)
      const fishingSkillData = await FishingSkillModel.findOne({ userUuid }).lean();
      const fishingSkill = fishingSkillData?.skill || 1;
      
      console.log(`[Raid] ${user.displayName} 낚시실력 데이터:`, {
        fishingSkillData,
        최종_낚시실력: fishingSkill
      });
      
      // 전투 참전 동료 가져오기
      const companions = await CompanionModel.find({ 
        userUuid, 
        isInBattle: true 
      }).lean();
      
      // 모든 동료도 확인 (디버깅용)
      const allCompanions = await CompanionModel.find({ userUuid }).lean();
      
      console.log(`[Raid] ${user.displayName} 동료 데이터:`, {
        전투_참전_동료: companions.length,
        전체_동료: allCompanions.length,
        동료_목록: allCompanions.map(c => ({ name: c.name, isInBattle: c.isInBattle, level: c.level }))
      });
      
      // 탐사 전투와 동일한 calculatePlayerAttack 함수 로직
      const calculatePlayerAttack = (skill) => {
        // 3차방정식: 0.00225 * skill³ + 0.165 * skill² + 2 * skill + 3
        const baseAttack = 0.00225 * Math.pow(skill, 3) + 0.165 * Math.pow(skill, 2) + 2 * skill + 3;
        // 랜덤 요소 추가 (±20%)
        const randomFactor = 0.8 + Math.random() * 0.4;
        return Math.floor(baseAttack * randomFactor);
      };
      
      const playerDamage = calculatePlayerAttack(fishingSkill);
      
      // 동료 공격력 계산
      let companionDamage = 0;
      const companionAttacks = [];
      
      for (const companion of companions) {
        // 동료 공격력 계산 (동료 레벨 기반)
        const companionLevel = companion.level || 1;
        const companionAttack = Math.floor(companionLevel * 2 + Math.random() * 5); // 레벨 * 2 + 0~4 랜덤
        companionDamage += companionAttack;
        companionAttacks.push({
          name: companion.name,
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
      
      // 클라이언트 전송용 보스 정보 (Map을 객체로 변환)
      const bossForClient = {
        ...raidSystem.raidBoss,
        participants: Object.fromEntries(raidSystem.raidBoss.participants)
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
        participants: Object.fromEntries(status.boss.participants)
      } : null
    };
    
    res.json({ success: true, ...responseStatus });
  });

  // 레이드 보스 처치 처리 함수
  const handleRaidBossDefeated = async (io, UserUuidModel) => {
    try {
      console.log("[Raid] 레이드 보스 처치됨!");
      
      // 보상 계산
      const rewards = raidSystem.calculateRewards();
      
      // 보상 지급
      for (const reward of rewards) {
        const { userUuid, damage, rank, reward: rewardAmount, isLastAttacker } = reward;
        
        // 호박석 지급
        await UserUuidModel.findOneAndUpdate(
          { userUuid },
          { $inc: { amberStones: rewardAmount } }
        );
        
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
          await UserUuidModel.findOneAndUpdate(
            { userUuid: lastAttacker.userUuid },
            { $inc: { starPieces: 1 } }
          );
          
          // 막타 보상 알림
          const lastAttackerSocket = Array.from(io.sockets.sockets.values())
            .find(s => s.userUuid === lastAttacker.userUuid);
          if (lastAttackerSocket) {
            lastAttackerSocket.emit("raid:boss:defeated", { 
              reward: { amount: 0 }, 
              lastAttackBonus: { starPieces: 1 } 
            });
          }
          
          console.log(`[Raid] 막타 보너스: ${lastAttacker.userUuid} - 별조각 1개`);
        }
      }
      
      // 전체 채팅에 결과 알림
      if (rewards.length > 0) {
        const topPlayer = rewards[0];
        const lastAttacker = rewards.find(r => r.isLastAttacker);
        
        const topPlayerData = await UserUuidModel.findOne({ userUuid: topPlayer.userUuid }).lean();
        const lastAttackerData = await UserUuidModel.findOne({ userUuid: lastAttacker?.userUuid }).lean();
        
        io.emit("chat:message", {
          system: true,
          username: "system",
          content: `🎉 레이드 보스 '마르가글레슘'이 처치되었습니다! MVP: ${topPlayerData?.displayName || topPlayerData?.username} (${topPlayer.damage} 데미지), 막타: ${lastAttackerData?.displayName || lastAttackerData?.username} (별조각 +1)`,
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
function setupRaidWebSocketEvents(socket) {
  // 레이드 상태 요청 처리
  socket.on("raid:status:request", () => {
    const status = raidSystem.getRaidStatus();
    if (status.boss) {
      // 클라이언트 전송용 보스 정보 (Map을 객체로 변환)
      const bossForClient = {
        ...status.boss,
        participants: Object.fromEntries(status.boss.participants)
      };
      
      socket.emit("raid:boss:update", { boss: bossForClient });
      // 최근 로그 전송
      status.logs.forEach(log => {
        socket.emit("raid:log:update", { log });
      });
    }
  });
}

module.exports = {
  setupRaidRoutes,
  setupRaidWebSocketEvents,
  raidSystem
};
