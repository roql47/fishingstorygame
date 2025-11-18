// 항해 시스템 라우트
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { 
  getVoyageFishByRank, 
  calculateVoyageReward, 
  isValidVoyageRank,
  validateVoyageGold 
} = require('../data/voyageData');

// 🔒 레이어 3: 서버 측 중복 요청 차단 (3초 이내)
const recentClaims = new Map(); // userUuid -> timestamp

// 🔒 전투 세션 관리 (전투 검증)
const battleSessions = new Map(); // sessionToken -> { userUuid, rank, startTime }

// 항해 보상 지급 API
const setupVoyageRoutes = (app, UserMoneyModel, CatchModel, DailyQuestModel, getKSTDate, authenticateJWT, AutoBaitModel) => {
  
  // 🔒 전투 시작 API (전투 세션 발급)
  app.post('/api/voyage/start-battle', authenticateJWT, async (req, res) => {
    try {
      const { userUuid, username } = req.user;
      const { rank } = req.body;

      // rank 검증
      if (!rank || !isValidVoyageRank(rank)) {
        return res.status(400).json({
          success: false,
          error: '유효하지 않은 랭크입니다.'
        });
      }

      // 물고기 데이터 확인
      try {
        getVoyageFishByRank(rank);
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: '존재하지 않는 물고기입니다.'
        });
      }

      // 🎯 보상 미리 계산 (전투 시작 시 확정)
      const reward = calculateVoyageReward(rank);
      console.log(`[VOYAGE] 보상 미리 확정: ${username} - Rank ${rank} (${reward.fishName}) → ${reward.gold}G`);

      // 🔒 전투 세션 토큰 생성
      const sessionToken = crypto.randomBytes(32).toString('hex');
      battleSessions.set(sessionToken, {
        userUuid,
        username,
        rank,
        startTime: Date.now(),
        reward: reward.gold,  // 🎯 확정된 보상 저장
        fishName: reward.fishName
      });

      // 10분 후 세션 자동 만료
      setTimeout(() => {
        battleSessions.delete(sessionToken);
      }, 600000);

      console.log(`[VOYAGE] 🎯 전투 세션 생성: ${username} - Rank ${rank} (Token: ${sessionToken.substring(0, 8)}...)`);

      res.json({
        success: true,
        sessionToken,
        rank,
        rewardGold: reward.gold,  // 🎯 클라이언트에 확정된 보상 알려주기
        fishName: reward.fishName
      });
    } catch (error) {
      console.error('[VOYAGE] 전투 시작 오류:', error);
      res.status(500).json({
        success: false,
        error: '전투 시작 중 오류가 발생했습니다.'
      });
    }
  });

  // 항해 보상 지급
  app.post('/api/voyage/reward', authenticateJWT, async (req, res) => {
    try {
      // 🔐 JWT에서 사용자 정보 추출 (보안 강화)
      const { userUuid, username } = req.user;
      const { rank, autoVoyage, sessionToken } = req.body;

      // 🔒 보안: 전투 세션 검증 (전투 없이 API 호출 방지)
      if (!sessionToken || !battleSessions.has(sessionToken)) {
        console.log(`🚨 [SECURITY] Invalid or missing battle session from ${username}`);
        return res.status(403).json({
          success: false,
          error: '유효하지 않은 전투 세션입니다.'
        });
      }

      const session = battleSessions.get(sessionToken);
      
      // 🔒 보안: 세션 소유자 확인
      if (session.userUuid !== userUuid) {
        console.log(`🚨 [SECURITY] Session owner mismatch: ${username} tried to use ${session.username}'s session`);
        return res.status(403).json({
          success: false,
          error: '다른 사용자의 전투 세션입니다.'
        });
      }

      // 🔒 보안: rank 일치 확인
      if (session.rank !== rank) {
        console.log(`🚨 [SECURITY] Rank mismatch from ${username}: session=${session.rank}, request=${rank}`);
        return res.status(403).json({
          success: false,
          error: '전투 세션과 랭크가 일치하지 않습니다.'
        });
      }

      // 🔒 보안: 전투 시간 검증 (너무 빠른 클리어 차단)
      const battleDuration = Date.now() - session.startTime;
      const MIN_BATTLE_TIME = 3000; // 최소 3초
      if (battleDuration < MIN_BATTLE_TIME) {
        console.log(`🚨 [SECURITY] Suspiciously fast clear from ${username}: ${battleDuration}ms (rank ${rank})`);
        battleSessions.delete(sessionToken); // 세션 삭제
        return res.status(403).json({
          success: false,
          error: '비정상적으로 빠른 클리어입니다.'
        });
      }

      // 🔒 세션 사용 후 삭제 (1회용)
      battleSessions.delete(sessionToken);

      // 🔒 보안: rank 유효성 검증
      if (!rank || !isValidVoyageRank(rank)) {
        console.log(`🚨 [SECURITY] Invalid voyage rank from ${username}: ${rank}`);
        return res.status(400).json({
          success: false,
          error: '유효하지 않은 랭크입니다.'
        });
      }

      // 🎯 세션에 저장된 확정 보상 사용 (전투 시작 시 결정된 값)
      const fishName = session.fishName;
      const gold = session.reward;

      console.log(`[VOYAGE] 🎣 ${username} - Rank ${rank} (${fishName}) 보상 지급: ${gold}G (전투 시작 시 확정)`);

      if (!fishName || !gold) {
        return res.status(400).json({
          success: false,
          error: '세션에 보상 정보가 없습니다.'
        });
      }

      // 🎣 자동항해 모드일 경우 자동미끼 차감
      if (autoVoyage) {
        console.log(`[VOYAGE] 자동항해 모드 - 자동미끼 체크 시작 (userUuid: ${userUuid})`);
        
        if (!AutoBaitModel) {
          console.error('[VOYAGE] ❌ AutoBaitModel이 없습니다!');
          return res.status(500).json({
            success: false,
            error: 'AutoBaitModel 초기화 오류'
          });
        }
        
        const baitDoc = await AutoBaitModel.findOne({ userUuid });
        console.log(`[VOYAGE] 자동미끼 문서 조회 결과:`, baitDoc);
        
        if (!baitDoc) {
          console.warn(`[VOYAGE] ⚠️ ${username}의 자동미끼 문서가 없습니다. 생성합니다.`);
          // 자동미끼 문서가 없으면 생성
          const newBaitDoc = new AutoBaitModel({
            userUuid,
            username,
            autoBaitCount: 0
          });
          await newBaitDoc.save();
          
          return res.status(400).json({
            success: false,
            error: '자동미끼가 부족합니다.',
            autoBaitCount: 0
          });
        }
        
        if (baitDoc.autoBaitCount <= 0) {
          console.warn(`[VOYAGE] ⚠️ ${username}의 자동미끼가 부족합니다 (현재: ${baitDoc.autoBaitCount}개)`);
          return res.status(400).json({
            success: false,
            error: '자동미끼가 부족합니다.',
            autoBaitCount: 0
          });
        }

        // 자동미끼 1개 차감
        baitDoc.autoBaitCount = Math.max(0, baitDoc.autoBaitCount - 1);
        await baitDoc.save();
        console.log(`[VOYAGE] 🎣 자동미끼 차감 성공: ${username} (${baitDoc.autoBaitCount + 1} → ${baitDoc.autoBaitCount}개)`);
      }

      // 🔒 레이어 3: 서버 측 중복 요청 차단 (자동항해 모드에서는 무시)
      if (!autoVoyage) {
        // 일반 모드에서만 1초 중복 차단 적용
        const now = Date.now();
        const lastClaimTime = recentClaims.get(userUuid);
        if (lastClaimTime && now - lastClaimTime < 1000) {
          console.log(`[VOYAGE] 중복 요청 차단 (일반 모드): ${username} (${now - lastClaimTime}ms 전 요청)`);
          return res.status(429).json({
            success: false,
            error: '보상은 1초에 한 번만 받을 수 있습니다. 잠시 후 다시 시도해주세요.'
          });
        }
        
        recentClaims.set(userUuid, now);
        
        // 5분 후 자동 정리 (메모리 누수 방지)
        setTimeout(() => {
          recentClaims.delete(userUuid);
        }, 300000);
      } else {
        console.log(`[VOYAGE] 자동항해 모드 - 중복 차단 무시`);
      }

      // 🎯 골드 지급 (원자적 연산으로 race condition 방지)
      const moneyDoc = await UserMoneyModel.findOneAndUpdate(
        { userUuid },
        {
          $inc: { money: gold },
          $setOnInsert: {
            userUuid,
            username
          }
        },
        { upsert: true, new: true }
      );

      // 🎯 물고기 지급 (원자적 연산으로 race condition 방지)
      // username도 쿼리 조건에 포함하여 unique index 충돌 방지
      const fishDoc = await CatchModel.findOneAndUpdate(
        { userUuid, username, fish: fishName },
        {
          $inc: { count: 1 },
          $setOnInsert: {
            userUuid,
            username,
            fish: fishName,
            probability: 1.0
          }
        },
        { upsert: true, new: true }
      );

      // 🎯 항해 승리 퀘스트 진행도 업데이트
      if (DailyQuestModel && getKSTDate) {
        try {
          const today = getKSTDate();
          let dailyQuest = await DailyQuestModel.findOne({ userUuid });

          // 퀘스트가 없거나 날짜가 다르면 새로 생성/리셋
          if (!dailyQuest || dailyQuest.lastResetDate !== today) {
            dailyQuest = await DailyQuestModel.findOneAndUpdate(
              { userUuid },
              {
                $set: {
                  userUuid,
                  username,
                  fishCaught: 0,
                  explorationWins: 0,
                  fishSold: 0,
                  voyageWins: 1, // 첫 승리
                  expeditionWins: 0,
                  questFishCaught: false,
                  questExplorationWin: false,
                  questFishSold: false,
                  questVoyageWin: false,
                  questExpeditionWin: false,
                  lastResetDate: today
                }
              },
              { upsert: true, new: true }
            );
          } else {
            // 기존 퀘스트 업데이트 (카운트만 증가, 완료 플래그는 보상 수령 시에만 설정)
            const newVoyageWins = Math.min(dailyQuest.voyageWins + 1, 5);
            
            await DailyQuestModel.findOneAndUpdate(
              { userUuid },
              {
                $set: {
                  voyageWins: newVoyageWins
                  // questVoyageWin은 보상 수령 시에만 true로 설정
                }
              },
              { new: true }
            );
          }
        } catch (questError) {
          console.error(`[VOYAGE] Failed to update quest progress for ${username}:`, questError);
          // 퀘스트 업데이트 실패해도 보상은 지급
        }
      }

      // 현재 자동미끼 개수 조회
      let autoBaitCount = null;
      if (AutoBaitModel) {
        const baitDoc = await AutoBaitModel.findOne({ userUuid });
        autoBaitCount = baitDoc?.autoBaitCount || 0;
      }

      res.json({
        success: true,
        gold: moneyDoc.money,
        fishName,
        count: fishDoc.count,
        autoBaitCount
        // 🎯 actualGold 제거: 보상은 전투 시작 시 이미 확정되어 클라이언트가 알고 있음
      });
    } catch (error) {
      console.error('[VOYAGE] 보상 지급 오류:', error);
      res.status(500).json({
        success: false,
        error: '보상 지급 중 오류가 발생했습니다.'
      });
    }
  });
};

module.exports = setupVoyageRoutes;

