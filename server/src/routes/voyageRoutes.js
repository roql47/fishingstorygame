// 항해 시스템 라우트
const express = require('express');
const router = express.Router();

// 🔒 레이어 3: 서버 측 중복 요청 차단 (3초 이내)
const recentClaims = new Map(); // userUuid -> timestamp

// 항해 보상 지급 API
const setupVoyageRoutes = (app, UserMoneyModel, CatchModel, DailyQuestModel, getKSTDate) => {
  // 항해 보상 지급
  app.post('/api/voyage/reward', async (req, res) => {
    try {
      const { username, userUuid, fishName, gold, rank } = req.body;

      if (!username || !userUuid || !fishName || !gold) {
        return res.status(400).json({
          success: false,
          error: '필수 정보가 누락되었습니다.'
        });
      }

      // 🔒 레이어 3: 서버 측 중복 요청 차단 (3초 이내 재요청 차단)
      const now = Date.now();
      const lastClaimTime = recentClaims.get(userUuid);
      if (lastClaimTime && now - lastClaimTime < 3000) {
        console.log(`[VOYAGE] 중복 요청 차단: ${username} (${now - lastClaimTime}ms 전 요청)`);
        return res.status(429).json({
          success: false,
          error: '보상은 3초에 한 번만 받을 수 있습니다. 잠시 후 다시 시도해주세요.'
        });
      }
      
      recentClaims.set(userUuid, now);
      
      // 5분 후 자동 정리 (메모리 누수 방지)
      setTimeout(() => {
        recentClaims.delete(userUuid);
      }, 300000);

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
                  questFishCaught: false,
                  questExplorationWin: false,
                  questFishSold: false,
                  questVoyageWin: false,
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

      res.json({
        success: true,
        gold: moneyDoc.money,
        fishName,
        count: fishDoc.count
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

