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

      // 골드 지급
      let moneyDoc = await UserMoneyModel.findOne({ userUuid });
      
      if (!moneyDoc) {
        // 문서가 없으면 새로 생성
        moneyDoc = new UserMoneyModel({
          userUuid,
          username,
          money: gold
        });
      } else {
        moneyDoc.money += gold;
      }
      
      await moneyDoc.save();

      // 물고기 지급 (이미 있으면 count 증가, 없으면 새로 생성)
      let fishDoc = await CatchModel.findOne({ userUuid, fish: fishName });
      
      if (fishDoc) {
        // 이미 존재하면 count 증가
        fishDoc.count += 1;
        await fishDoc.save();
      } else {
        // 없으면 새로 생성
        fishDoc = new CatchModel({
          userUuid,
          username,
          fish: fishName,
          count: 1
        });
        await fishDoc.save();
      }

      console.log(`[VOYAGE] ${username} - ${fishName} 전투 완료: +${gold}G, +1 ${fishName}`);

      res.json({
        success: true,
        gold: moneyDoc.money,
        fishName,
        count: 1
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

