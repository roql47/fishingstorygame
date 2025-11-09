const express = require('express');
const router = express.Router();
const RaidSystem = require('../modules/raidSystem');
const { AchievementSystem } = require('../modules/achievementSystem');
const RaidScheduler = require('../modules/raidScheduler');

// 레이드 시스템 인스턴스 생성
const raidSystem = new RaidSystem();

// 레이드 라우트 설정 함수
function setupRaidRoutes(io, UserUuidModel, authenticateJWT, CompanionModel, FishingSkillModel, CompanionStatsModel, AchievementModel, oldAchievementSystem, AdminModel, CooldownModel, StarPieceModel, RaidDamageModel, RareFishCountModel, CatchModel, RaidKillCountModel, UserEquipmentModel, UserStatsModel) {
  
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
      const { bossType = 'beginner' } = req.body; // 보스 타입 선택 (기본: beginner)
      
      // 관리자 권한 확인
      const user = await UserUuidModel.findOne({ userUuid }).lean();
      if (!user) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
      }
      
      const jwtIsAdmin = req.user.isAdmin;
      let dbIsAdmin = user.isAdmin || false;
      
      // AdminModel 확인 (선택적)
      try {
        if (AdminModel) {
          const adminRecord = await AdminModel.findOne({ userUuid }).lean();
          if (adminRecord?.isAdmin) {
            dbIsAdmin = true;
            if (user && !user.isAdmin) {
              await UserUuidModel.updateOne({ userUuid }, { $set: { isAdmin: true } });
            }
          }
        }
      } catch (adminError) {
        console.log('[RAID] AdminModel check skipped:', adminError.message);
      }
      
      const hasAdminRights = jwtIsAdmin || dbIsAdmin;
      
      if (!hasAdminRights) {
        return res.status(403).json({ error: "관리자만 레이드 보스를 소환할 수 있습니다." });
      }
      
      // 보스 타입 유효성 검증
      if (!['beginner', 'intermediate', 'advanced', 'legendary'].includes(bossType)) {
        return res.status(400).json({ error: "잘못된 보스 타입입니다." });
      }
      
      // 레이드 보스 소환 (보스 타입 전달)
      const boss = raidSystem.summonBoss(bossType);
      
      // 클라이언트 전송용 보스 정보 (Map을 객체로 변환)
      const bossForClient = {
        ...boss,
        participants: Object.fromEntries(boss.participants),
        participantNames: boss.participantNames ? 
          Object.fromEntries(boss.participantNames) : {}
      };
      
      // 모든 클라이언트에게 레이드 보스 정보 전송 (보스 타입 포함)
      io.emit("raid:boss:update", { bossType, boss: bossForClient });
      
      // 채팅에 레이드 시작 알림
      const hpFormatted = boss.maxHp.toLocaleString();
      const requiredSkill = boss.requiredSkill;
      let summonMessage = `🐉 레이드 보스 '${boss.name}'이(가) 나타났습니다! (체력: ${hpFormatted})`;
      
      // 참여 조건 표시
      if (requiredSkill) {
        if (requiredSkill.max === 999) {
          summonMessage += ` | 참여 조건: 낚시 실력 ${requiredSkill.min} 이상`;
        } else {
          summonMessage += ` | 참여 조건: 낚시 실력 ${requiredSkill.min}~${requiredSkill.max}`;
        }
      }
      
      io.emit("chat:message", {
        system: true,
        username: "system",
        content: summonMessage,
        timestamp: new Date().toISOString()
      });
      
      console.log(`[Raid] 레이드 보스 소환됨: ${boss.name} (타입: ${bossType}) by ${userUuid}`);
      res.json({ success: true, bossType, boss: bossForClient });
    } catch (error) {
      console.error("[Raid] 레이드 보스 소환 실패:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // 레이드 보스 공격 API (캐시 최적화)
  router.post("/attack", authenticateJWT, async (req, res) => {
    const startTime = Date.now();
    
    try {
      const { userUuid } = req.user;
      const { bossType, battleCompanions } = req.body;
      
      if (!bossType || !['beginner', 'intermediate', 'advanced', 'legendary'].includes(bossType)) {
        return res.status(400).json({ error: "유효하지 않은 보스 타입입니다." });
      }

      // 캐시에서 사용자 정보 가져오기
      const cacheSystem = require('../cache-system');
      let user = cacheSystem.getCachedData('raidUserData', 'user', userUuid);
      
      if (!user) {
        user = await UserUuidModel.findOne({ userUuid }).lean();
        if (!user) {
          return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
        }
        cacheSystem.setCachedData('raidUserData', 'user', user, userUuid);
      }

      // 쿨타임을 메모리에서 먼저 확인 (캐시)
      const now = new Date();
      let cooldownEnd = cacheSystem.getCachedData('raidCooldown', 'cooldown', userUuid);
      
      if (!cooldownEnd) {
        // 캐시 미스 - DB에서 조회
        const cooldownRecord = await CooldownModel.findOne({ userUuid }).lean();
        cooldownEnd = cooldownRecord?.raidAttackCooldownEnd;
        // 5초만 캐시 (짧은 TTL)
        if (cooldownEnd) {
          cacheSystem.setCachedData('raidCooldown', 'cooldown', cooldownEnd, userUuid);
        }
      }
      
      if (cooldownEnd && new Date(cooldownEnd) > now) {
        const remainingTime = Math.ceil((new Date(cooldownEnd).getTime() - now.getTime()) / 1000);
        return res.status(429).json({ 
          error: "레이드 공격 쿨타임이 남아있습니다.",
          remainingTime: remainingTime
        });
      }
      
      // 캐시에서 낚시 실력 가져오기
      let fishingSkillData = cacheSystem.getCachedData('raidFishingSkill', 'skill', userUuid);
      
      if (!fishingSkillData) {
        fishingSkillData = await FishingSkillModel.findOne({ userUuid }).lean();
        if (fishingSkillData) {
          cacheSystem.setCachedData('raidFishingSkill', 'skill', fishingSkillData, userUuid);
        }
      }
      
      const baseSkill = fishingSkillData?.skill || 1;
      
      // 캐시에서 업적 보너스 가져오기
      let achievementBonus = cacheSystem.getCachedData('raidAchievements', 'achievement', userUuid);
      
      if (achievementBonus === null || achievementBonus === undefined) {
        try {
          achievementBonus = await achievementSystem.calculateAchievementBonus(userUuid);
          cacheSystem.setCachedData('raidAchievements', 'achievement', achievementBonus, userUuid);
        } catch (error) {
          achievementBonus = 0;
        }
      }
      
      const fishingSkill = baseSkill + achievementBonus;
      
      // 레이드 보스 존재 및 참여 조건 확인
      const currentRaidBoss = raidSystem.getBoss(bossType);
      if (!currentRaidBoss || !currentRaidBoss.isActive) {
        return res.status(400).json({ error: "활성화된 레이드 보스가 없습니다." });
      }
      
      // 낚시 실력 조건 검증
      const requiredSkill = currentRaidBoss.requiredSkill;
      if (requiredSkill) {
        if (fishingSkill < requiredSkill.min || fishingSkill > requiredSkill.max) {
          return res.status(403).json({ 
            error: `이 레이드는 낚시 실력 ${requiredSkill.min}~${requiredSkill.max === 999 ? '이상' : requiredSkill.max}인 플레이어만 참여할 수 있습니다. (현재: ${fishingSkill})`,
            currentSkill: fishingSkill,
            requiredSkill: requiredSkill
          });
        }
      }
      
      console.log(`[Raid][${bossType}] ${user.displayName} 낚시실력: ${fishingSkill} - 참여 허용`);
      
      // 동료 정보 가져오기 (최대 3명 제한 + 레이드 중 캐시 사용)
      let companions = [];
      
      if (battleCompanions && Array.isArray(battleCompanions) && battleCompanions.length > 0) {
        // 레이드 중에는 캐시 사용 (동일 보스 전투 중에는 동료 데이터 변경 없음)
        const cacheKey = `raid_companions_${bossType}_${userUuid}`;
        let cachedCompanions = cacheSystem.getCachedData('raidCompanionsBattle', cacheKey, userUuid);
        
        if (!cachedCompanions) {
          // 첫 타격 시 DB에서 가져와서 캐시
          const allCompanions = await CompanionStatsModel.find({ userUuid }).lean();
          const filteredCompanions = allCompanions?.filter(c => battleCompanions.includes(c.companionName)) || [];
          cachedCompanions = filteredCompanions.slice(0, 3);
          cacheSystem.setCachedData('raidCompanionsBattle', cacheKey, cachedCompanions, userUuid);
        }
        companions = cachedCompanions;
      }
      
      // 캐시에서 장비 정보 가져오기
      let userEquipment = cacheSystem.getCachedData('raidEquipment', 'equipment', userUuid);
      
      if (!userEquipment) {
        userEquipment = await UserEquipmentModel.findOne({ userUuid }).lean();
        if (userEquipment) {
          cacheSystem.setCachedData('raidEquipment', 'equipment', userEquipment, userUuid);
        }
      }
      
      // 🌟 유저 성장 스탯 가져오기
      let userStats = null;
      if (UserStatsModel) {
        let cachedStats = cacheSystem.getCachedData('raidUserStats', 'stats', userUuid);
        
        if (!cachedStats) {
          cachedStats = await UserStatsModel.findOne({ userUuid }).lean();
          if (cachedStats) {
            cacheSystem.setCachedData('raidUserStats', 'stats', cachedStats, userUuid);
          }
        }
        userStats = cachedStats;
      }
      
      // 강화 보너스 계산 함수 (3차방정식 - 퍼센트로 표시)
      const calculateEnhancementBonus = (level) => {
        if (level <= 0) return 0;
        return 0.0015 * Math.pow(level, 3) + 0.07 * Math.pow(level, 2) + 1.6 * level;
      };
      
      const calculateTotalEnhancementBonus = (level) => {
        let totalBonus = 0;
        for (let i = 1; i <= level; i++) {
          totalBonus += calculateEnhancementBonus(i);
        }
        return totalBonus; // 퍼센트이므로 소수점 유지
      };
      
      // 탐사 전투와 동일한 calculatePlayerAttack 함수 로직 + 강화 보너스 (퍼센트) + 유저 스탯
      const calculatePlayerAttack = (skill, enhancementBonusPercent = 0, attackStatBonus = 0) => {
        // 3차방정식: 0.00225 * skill³ + 0.165 * skill² + 2 * skill + 3
        const baseAttack = 0.00225 * Math.pow(skill, 3) + 0.165 * Math.pow(skill, 2) + 2 * skill + 3;
        // 강화 보너스 퍼센트 적용
        const totalAttack = baseAttack + (baseAttack * enhancementBonusPercent / 100);
        // 🌟 유저 스탯 공격력 보너스 추가 (레벨당 +5 공격력)
        const attackWithStatBonus = totalAttack + attackStatBonus;
        // 랜덤 요소 추가 (±20%)
        const randomFactor = 0.8 + Math.random() * 0.4;
        return Math.floor(attackWithStatBonus * randomFactor);
      };
      
      // 낚시대 강화 보너스 계산
      const fishingRodEnhancementBonus = calculateTotalEnhancementBonus(userEquipment?.fishingRodEnhancement || 0);
      
      // 플레이어 공격력 계산 (레이드 중 캐시 사용)
      const playerCacheKey = `raid_player_attack_${bossType}_${userUuid}`;
      let playerDamage = cacheSystem.getCachedData('raidPlayerAttack', playerCacheKey, userUuid);
      
      if (!playerDamage) {
        // 첫 타격 시 계산하고 캐시
        const fishingRods = [
          '나무낚시대', '낡은낚시대', '기본낚시대', '단단한낚시대', '은낚시대', '금낚시대',
          '강철낚시대', '사파이어낚시대', '루비낚시대', '다이아몬드낚시대', '레드다이아몬드낚시대',
          '벚꽃낚시대', '꽃망울낚시대', '호롱불낚시대', '산호등낚시대', '피크닉', '마녀빗자루',
          '에테르낚시대', '별조각낚시대', '여우꼬리낚시대', '초콜릿롤낚시대', '호박유령낚시대',
          '핑크버니낚시대', '할로우낚시대', '여우불낚시대'
        ];
        const fishingRodIndex = fishingRods.indexOf(userEquipment?.fishingRod) >= 0 ? fishingRods.indexOf(userEquipment?.fishingRod) : 0;
        const attackStatBonus = fishingRodIndex * (userStats?.attack || 0);
        
        // 기본 공격력 계산 (랜덤 제외한 고정값)
        const baseAttack = 0.00225 * Math.pow(fishingSkill, 3) + 0.165 * Math.pow(fishingSkill, 2) + 2 * fishingSkill + 3;
        const totalAttack = baseAttack + (baseAttack * fishingRodEnhancementBonus / 100);
        playerDamage = totalAttack + attackStatBonus;
        
        cacheSystem.setCachedData('raidPlayerAttack', playerCacheKey, playerDamage, userUuid);
      }
      
      // 랜덤 요소는 매번 새로 적용 (±20%)
      const randomFactor = 0.8 + Math.random() * 0.4;
      const finalPlayerDamage = Math.floor(playerDamage * randomFactor);
      
      // 동료 공격력 계산 (레이드 중 캐시 사용)
      const companionCacheKey = `raid_companion_attacks_${bossType}_${userUuid}`;
      let cachedCompanionAttacks = cacheSystem.getCachedData('raidCompanionAttacks', companionCacheKey, userUuid);
      
      let companionDamage = 0;
      const companionAttacks = [];
      
      if (!cachedCompanionAttacks && companions.length > 0) {
        // 첫 타격 시 동료 공격력 계산하고 캐시
        const COMPANION_DATA = {
          "실": { baseAttack: 9, growthAttack: 2 },
          "피에나": { baseAttack: 8, growthAttack: 2 },
          "애비게일": { baseAttack: 12, growthAttack: 3 },
          "클로에": { baseAttack: 14, growthAttack: 3 },
          "나하트라": { baseAttack: 11, growthAttack: 3 },
          "림스&베리": { baseAttack: 9, growthAttack: 2 },
          "메이델": { baseAttack: 12, growthAttack: 3 },
          "아이란": { baseAttack: 10, growthAttack: 2.5 },
          "리무": { baseAttack: 13, growthAttack: 3.2 },
          "셰리": { baseAttack: 13, growthAttack: 3.1 }
        };
        
        cachedCompanionAttacks = [];
        
        for (const companion of companions) {
          const companionLevel = companion.level || 1;
          const companionName = companion.companionName;
          const tier = companion.tier || 0;
          const breakthroughStats = companion.breakthroughStats || { bonusGrowthHp: 0, bonusGrowthAttack: 0, bonusGrowthSpeed: 0 };
          
          const baseData = COMPANION_DATA[companionName];
          if (baseData) {
            const bonusGrowthAttack = breakthroughStats.bonusGrowthAttack || 0;
            const enhancedGrowthAttack = baseData.growthAttack + bonusGrowthAttack;
            let attack = baseData.baseAttack + (enhancedGrowthAttack * (companionLevel - 1));
            
            const TIER_MULTIPLIERS = { 0: 1.0, 1: 1.3, 2: 1.6 };
            const tierMultiplier = TIER_MULTIPLIERS[tier] || 1.0;
            attack = Math.floor(attack * tierMultiplier);
            
            cachedCompanionAttacks.push({
              name: companionName,
              baseAttack: attack
            });
          }
        }
        
        cacheSystem.setCachedData('raidCompanionAttacks', companionCacheKey, cachedCompanionAttacks, userUuid);
      }
      
      // 캐시된 동료 공격력에 매번 랜덤 적용
      if (cachedCompanionAttacks) {
        for (const companionData of cachedCompanionAttacks) {
          const randomFactor = 0.8 + Math.random() * 0.4;
          const companionAttack = Math.floor(companionData.baseAttack * randomFactor);
          
          companionDamage += companionAttack;
          companionAttacks.push({
            name: companionData.name,
            attack: companionAttack
          });
        }
      }
      
      const finalDamage = finalPlayerDamage + companionDamage;
      
      console.log(`[Raid] ${user.displayName} 데미지 계산:`, { 
        fishingSkill: fishingSkill,
        플레이어_데미지: finalPlayerDamage,
        동료_데미지: companionDamage,
        동료_공격: companionAttacks,
        최종_데미지: finalDamage
      });
      
      // 레이드 보스 공격 (이미 계산된 최종 데미지 사용, 보스 타입 전달)
      const attackResult = raidSystem.attackBoss(bossType, userUuid, user.displayName || user.username, finalDamage);
      
      // ⚔️ 레이드 누적 데미지 업데이트 및 업적 체크
      try {
        console.log(`⚔️ [RAID][${bossType}] Updating raid damage for ${user.displayName || user.username}: ${finalDamage}`);
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
      
      // 쿨타임 캐시 업데이트
      cacheSystem.setCachedData('raidCooldown', 'cooldown', raidCooldownEnd, userUuid);
      
      // 클라이언트 전송용 보스 정보 (Map을 객체로 변환)
      const updatedBoss = raidSystem.getBoss(bossType);
      const bossForClient = {
        ...updatedBoss,
        participants: Object.fromEntries(updatedBoss.participants),
        participantNames: updatedBoss.participantNames ? 
          Object.fromEntries(updatedBoss.participantNames) : {}
      };
      
      // 모든 클라이언트에게 업데이트 전송 (보스 타입 포함)
      io.emit("raid:boss:update", { bossType, boss: bossForClient });
      io.emit("raid:log:update", { bossType, log: attackResult.log });
      
      const responseTime = Date.now() - startTime;
      console.log(`[Raid][${bossType}] ${user.displayName}: ${attackResult.damage} DMG (${responseTime}ms)`);
      
      // 보스가 죽었는지 확인
      if (attackResult.isDefeated) {
        // 보스 처치 시 캐시 무효화
        cacheSystem.invalidateCache('user', userUuid);
        cacheSystem.invalidateCache('achievement', userUuid);
        
        // 레이드 전투 캐시 무효화 (모든 참가자의 캐시 삭제)
        const boss = raidSystem.getBoss(bossType);
        if (boss && boss.participants) {
          for (const participantUuid of boss.participants.keys()) {
            cacheSystem.invalidateCache('raidCompanionsBattle', participantUuid);
            cacheSystem.invalidateCache('raidPlayerAttack', participantUuid);
            cacheSystem.invalidateCache('raidCompanionAttacks', participantUuid);
          }
        }
        
        await handleRaidBossDefeated(io, UserUuidModel, bossType);
      }
      
      // 개별 데미지 정보를 클라이언트에 전송
      res.json({ 
        success: true, 
        damage: attackResult.damage,
        damageBreakdown: {
          playerDamage: finalPlayerDamage,
          companionDamage,
          companionAttacks,
          totalDamage: finalDamage
        },
        _cachePerformance: {
          responseTime: Date.now() - startTime,
          cacheHitRate: cacheSystem.cacheStats?.getHitRate() || 'N/A'
        }
      });
    } catch (error) {
      console.error("[Raid] 레이드 공격 실패:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // 레이드 상태 조회 API (모든 보스)
  router.get("/status", authenticateJWT, (req, res) => {
    const allStatus = raidSystem.getAllRaidStatus();
    
    // 클라이언트 전송용으로 Map을 객체로 변환
    const responseStatus = {};
    
    for (const [bossType, status] of Object.entries(allStatus)) {
      responseStatus[bossType] = {
        ...status,
        boss: status.boss ? {
          ...status.boss,
          participants: Object.fromEntries(status.boss.participants),
          participantNames: status.boss.participantNames ? 
            Object.fromEntries(status.boss.participantNames) : {}
        } : null
      };
    }
    
    res.json({ success: true, raids: responseStatus });
  });

  // 레이드 보스 처치 처리 함수
  const handleRaidBossDefeated = async (io, UserUuidModel, bossType) => {
    try {
      console.log(`[Raid][${bossType}] 레이드 보스 처치됨!`);
      
      // 보스 정보 가져오기
      const boss = raidSystem.getBoss(bossType);
      const bossName = boss?.name || '알 수 없는 보스';
      
      // 보상 계산
      const rewards = raidSystem.calculateRewards(bossType);
      
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
          userSocket.emit("raid:boss:defeated", { bossType, reward: { amount: rewardAmount } });
        }
        
        console.log(`[Raid][${bossType}] 보상 지급: ${userUuid} - 순위 ${rank}, 데미지 ${damage}, 보상 ${rewardAmount}${isLastAttacker ? ' (막타 보너스 포함)' : ''}`);
      }
      
      // 마지막 공격자에게 별조각 추가 지급 (폭주하는 해신, 임포머스: 2개 / 나머지: 1개)
      if (rewards.length > 0) {
        const lastAttacker = rewards.find(r => r.isLastAttacker);
        if (lastAttacker) {
          // 보스 타입에 따른 별조각 보상 개수 결정
          const starPieceReward = (bossType === 'advanced' || bossType === 'legendary') ? 2 : 1;
          
          // StarPieceModel을 사용하여 별조각 지급
          let userStarPieces = await StarPieceModel.findOne({ userUuid: lastAttacker.userUuid });
          
          if (!userStarPieces) {
            // 새 사용자인 경우 생성
            const createData = {
              userId: 'user',
              username: lastAttacker.username,
              userUuid: lastAttacker.userUuid,
              starPieces: starPieceReward
            };
            userStarPieces = new StarPieceModel(createData);
          } else {
            userStarPieces.starPieces = (userStarPieces.starPieces || 0) + starPieceReward;
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
              bossType,
              reward: { amount: 0 }, 
              lastAttackBonus: { starPieces: starPieceReward } 
            });
          }
          
          console.log(`[Raid][${bossType}] 막타 보너스: ${lastAttacker.userUuid} - 별조각 ${starPieceReward}개 (총 ${userStarPieces.starPieces}개)`);
        }
      }
      
      // 전체 채팅에 결과 알림
      if (rewards.length > 0) {
        const topPlayer = rewards[0];
        const lastAttacker = rewards.find(r => r.isLastAttacker);
        
        const topPlayerData = await UserUuidModel.findOne({ userUuid: topPlayer.userUuid }).lean();
        const lastAttackerData = await UserUuidModel.findOne({ userUuid: lastAttacker?.userUuid }).lean();
        
        // 보스 타입에 따른 막타 별조각 보상 개수
        const starPieceReward = (bossType === 'advanced' || bossType === 'legendary') ? 2 : 1;
        let defeatMessage = `🎉 레이드 보스 '${bossName}'이(가) 처치되었습니다! MVP: ${topPlayerData?.displayName || topPlayerData?.username} (${topPlayer.damage} 데미지), 막타: ${lastAttackerData?.displayName || lastAttackerData?.username} (별조각 +${starPieceReward})`;
        
        io.emit("chat:message", {
          system: true,
          username: "system",
          content: defeatMessage,
          timestamp: new Date().toISOString()
        });
      }
      
      // 레이드 상태 초기화 (해당 보스 타입만)
      raidSystem.resetRaid(bossType);
      
      // 모든 클라이언트에게 레이드 종료 알림 (보스 타입 포함)
      io.emit("raid:boss:update", { bossType, boss: null });
      
    } catch (error) {
      console.error("[Raid] 레이드 보스 처치 처리 실패:", error);
    }
  };

  // 🕛 레이드 스케줄러 상태 조회 API
  router.get("/scheduler/status", authenticateJWT, async (req, res) => {
    try {
      const { userUuid } = req.user;
      
      // 관리자 권한 확인
      const user = await UserUuidModel.findOne({ userUuid }).lean();
      if (!user) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
      }
      
      const jwtIsAdmin = req.user.isAdmin;
      let dbIsAdmin = user.isAdmin || false;
      
      if (!jwtIsAdmin && !dbIsAdmin) {
        return res.status(403).json({ error: "관리자 권한이 필요합니다." });
      }
      
      // 스케줄러 상태 반환 (전역 스케줄러 인스턴스가 있다면)
      if (global.raidScheduler) {
        const status = global.raidScheduler.getStatus();
        res.json({ success: true, status });
      } else {
        res.json({ success: false, error: "스케줄러가 초기화되지 않았습니다." });
      }
    } catch (error) {
      console.error("[Raid] 스케줄러 상태 조회 실패:", error);
      res.status(500).json({ error: "스케줄러 상태 조회에 실패했습니다." });
    }
  });

  // 🕛 수동 레이드 소환 API (관리자 전용)
  router.post("/scheduler/manual-summon", authenticateJWT, async (req, res) => {
    try {
      const { userUuid } = req.user;
      
      // 관리자 권한 확인
      const user = await UserUuidModel.findOne({ userUuid }).lean();
      if (!user) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
      }
      
      const jwtIsAdmin = req.user.isAdmin;
      let dbIsAdmin = user.isAdmin || false;
      
      if (!jwtIsAdmin && !dbIsAdmin) {
        return res.status(403).json({ error: "관리자 권한이 필요합니다." });
      }
      
      // 수동 레이드 소환 실행
      if (global.raidScheduler) {
        const results = await global.raidScheduler.triggerManualSummon();
        res.json({ success: true, results });
      } else {
        res.status(500).json({ error: "스케줄러가 초기화되지 않았습니다." });
      }
    } catch (error) {
      console.error("[Raid] 수동 레이드 소환 실패:", error);
      res.status(500).json({ error: "수동 레이드 소환에 실패했습니다." });
    }
  });

  return router;
}

// WebSocket 이벤트 설정 함수
function setupRaidWebSocketEvents(socket, UserUuidModel) {
  // 레이드 상태 요청 처리 (모든 보스 타입)
  socket.on("raid:status:request", async () => {
    const allStatus = raidSystem.getAllRaidStatus();
    
    for (const [bossType, status] of Object.entries(allStatus)) {
      if (status.boss) {
        // 클라이언트 전송용 보스 정보 (Map을 객체로 변환)
        const bossForClient = {
          ...status.boss,
          participants: Object.fromEntries(status.boss.participants),
          participantNames: status.boss.participantNames ? 
            Object.fromEntries(status.boss.participantNames) : {}
        };
        
        socket.emit("raid:boss:update", { bossType, boss: bossForClient });
        
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
          
          socket.emit("raid:log:update", { bossType, log: correctedLog });
        }
      }
    }
  });

  // 🕛 레이드 자동 소환 알림 이벤트
  socket.on("raid:auto-summon:subscribe", () => {
    console.log(`[Raid] 사용자가 레이드 자동 소환 알림을 구독했습니다: ${socket.id}`);
    socket.join('raid-auto-summon');
  });
}

module.exports = {
  setupRaidRoutes,
  setupRaidWebSocketEvents,
  raidSystem
};
