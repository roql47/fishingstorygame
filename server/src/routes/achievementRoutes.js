const express = require('express');
const router = express.Router();
const { AchievementSystem, ACHIEVEMENT_DEFINITIONS } = require('../modules/achievementSystem');

function setupAchievementRoutes(authenticateJWT, UserUuidModel, CatchModel, FishingSkillModel) {
  // 업적 시스템 인스턴스 생성
  const achievementSystem = new AchievementSystem(CatchModel, FishingSkillModel, UserUuidModel);

  // 🏆 업적 조회 API
  router.get("/", authenticateJWT, async (req, res) => {
    try {
      const { userUuid } = req.user;
      const { targetUsername } = req.query;
      
      let targetUserUuid = userUuid;
      
      // 다른 사용자의 업적을 조회하는 경우
      if (targetUsername) {
        const targetUser = await UserUuidModel.findOne({ username: targetUsername }).lean();
        if (!targetUser) {
          return res.status(404).json({ error: "User not found" });
        }
        targetUserUuid = targetUser.userUuid;
      }
      
      const result = await achievementSystem.getUserAchievements(targetUserUuid);
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch achievements:", error);
      res.status(500).json({ error: "Failed to fetch achievements" });
    }
  });

  // 🏆 관리자 업적 해제 API
  router.post("/admin/revoke", authenticateJWT, async (req, res) => {
    try {
      const { userUuid, username, isAdmin } = req.user;
      const { targetUsername, achievementId } = req.body;
      
      // 관리자 권한 확인
      if (!isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      // 업적 정의 확인
      if (!ACHIEVEMENT_DEFINITIONS[achievementId]) {
        return res.status(400).json({ error: "Invalid achievement ID" });
      }
      
      const result = await achievementSystem.revokeAchievement(targetUsername, achievementId, username);
      res.json(result);
    } catch (error) {
      console.error("Failed to revoke achievement:", error);
      
      let statusCode = 500;
      let errorMessage = "Failed to revoke achievement";
      
      if (error.message === "Target user not found") {
        statusCode = 404;
        errorMessage = error.message;
      } else if (error.message === "User does not have this achievement") {
        statusCode = 400;
        errorMessage = error.message;
      } else if (error.message === "Invalid achievement ID") {
        statusCode = 400;
        errorMessage = error.message;
      }
      
      res.status(statusCode).json({ error: errorMessage });
    }
  });

  // 🏆 관리자 업적 부여 API
  router.post("/admin/grant", authenticateJWT, async (req, res) => {
    try {
      const { userUuid, username, isAdmin } = req.user;
      const { targetUsername, achievementId } = req.body;
      
      // 관리자 권한 확인
      if (!isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      // 업적 정의 확인
      if (!ACHIEVEMENT_DEFINITIONS[achievementId]) {
        return res.status(400).json({ error: "Invalid achievement ID" });
      }
      
      const result = await achievementSystem.grantAchievement(targetUsername, achievementId, username);
      res.json(result);
    } catch (error) {
      console.error("Failed to grant achievement:", error);
      
      let statusCode = 500;
      let errorMessage = "Failed to grant achievement";
      
      if (error.message === "Target user not found") {
        statusCode = 404;
        errorMessage = error.message;
      } else if (error.message === "User already has this achievement") {
        statusCode = 400;
        errorMessage = error.message;
      } else if (error.message === "Invalid achievement ID") {
        statusCode = 400;
        errorMessage = error.message;
      }
      
      res.status(statusCode).json({ error: errorMessage });
    }
  });

  // 🏆 업적 자동 체크 API (내부 사용용)
  router.post("/check", authenticateJWT, async (req, res) => {
    try {
      const { userUuid, username } = req.user;
      
      const achievementGranted = await achievementSystem.checkAndGrantAchievements(userUuid, username);
      
      res.json({
        success: true,
        achievementGranted,
        message: achievementGranted ? "Achievement granted!" : "No new achievements"
      });
    } catch (error) {
      console.error("Failed to check achievements:", error);
      res.status(500).json({ error: "Failed to check achievements" });
    }
  });

  // 🏆 업적 보너스 조회 API
  router.get("/bonus/:userUuid", authenticateJWT, async (req, res) => {
    try {
      const { userUuid: requestUserUuid, isAdmin } = req.user;
      const { userUuid } = req.params;
      
      // 본인 데이터이거나 관리자인 경우만 허용
      if (userUuid !== requestUserUuid && !isAdmin) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const bonusInfo = await achievementSystem.logAchievementBonus(userUuid);
      res.json({
        success: true,
        ...bonusInfo
      });
    } catch (error) {
      console.error("Failed to get achievement bonus:", error);
      res.status(500).json({ error: "Failed to get achievement bonus" });
    }
  });

  return { router, achievementSystem };
}

module.exports = {
  setupAchievementRoutes,
  ACHIEVEMENT_DEFINITIONS
};
