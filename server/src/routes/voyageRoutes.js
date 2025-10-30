// 항해 시스템 라우트
const express = require('express');
const router = express.Router();

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
            // 기존 퀘스트 업데이트
            const newVoyageWins = Math.min(dailyQuest.voyageWins + 1, 5);
            const shouldCompleteQuest = newVoyageWins >= 5 && !dailyQuest.questVoyageWin;
            
            await DailyQuestModel.findOneAndUpdate(
              { userUuid },
              {
                $set: {
                  voyageWins: newVoyageWins,
                  ...(shouldCompleteQuest && { questVoyageWin: true })
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

