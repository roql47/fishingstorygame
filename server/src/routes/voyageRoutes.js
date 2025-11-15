// 항해 시스템 라우트
const express = require('express');
const router = express.Router();

// 🔒 레이어 3: 서버 측 중복 요청 차단 (3초 이내)
const recentClaims = new Map(); // userUuid -> timestamp

// 항해 보상 지급 API
const setupVoyageRoutes = (app, UserMoneyModel, CatchModel, DailyQuestModel, getKSTDate, authenticateJWT, AutoBaitModel) => {
  // 항해 보상 지급
  app.post('/api/voyage/reward', authenticateJWT, async (req, res) => {
    try {
      // 🔐 JWT에서 사용자 정보 추출 (보안 강화)
      const { userUuid, username } = req.user;
      const { fishName, gold, rank, autoVoyage } = req.body;

      if (!fishName || !gold) {
        return res.status(400).json({
          success: false,
          error: '필수 정보가 누락되었습니다.'
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

