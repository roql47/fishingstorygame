// 항해 시스템 라우트
const express = require('express');
const router = express.Router();

// 항해 보상 지급 API
const setupVoyageRoutes = (app, UserMoneyModel, CatchModel) => {
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
      const fishDoc = await CatchModel.findOneAndUpdate(
        { userUuid, fish: fishName },
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

      console.log(`[VOYAGE] ${username} - ${fishName} 전투 완료: +${gold}G, +1 ${fishName}`);

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

