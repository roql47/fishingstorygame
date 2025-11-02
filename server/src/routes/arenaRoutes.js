const express = require('express');
const router = express.Router();
const ArenaSystem = require('../modules/arenaSystem');

// 결투장 시스템 인스턴스 (setupArenaRoutes에서 초기화됨)
let arenaSystem = null;

// 결투장 라우트 설정 함수
function setupArenaRoutes(
    io,
    ArenaEloModel,
    CompanionStatsModel,
    UserStatsModel,
    FishingSkillModel,
    authenticateJWT,
    UserUuidModel,
    UserEquipmentModel
) {
    // 결투장 시스템 초기화
    arenaSystem = new ArenaSystem(
        ArenaEloModel,
        CompanionStatsModel,
        UserStatsModel,
        FishingSkillModel,
        UserEquipmentModel
    );

    console.log('🏟️ Arena System initialized');

    // 내 결투장 스탯 조회
    router.get('/my-stats', authenticateJWT, async (req, res) => {
        try {
            const { userUuid, username } = req.user;
            
            const eloData = await arenaSystem.getOrCreateEloData(userUuid, username);
            const limitInfo = await arenaSystem.checkDailyLimit(userUuid);
            
            res.json({
                success: true,
                stats: eloData,
                dailyLimit: limitInfo
            });
        } catch (error) {
            console.error('결투장 스탯 조회 실패:', error);
            res.status(500).json({ error: '결투장 스탯 조회에 실패했습니다.' });
        }
    });

    // 랭킹 조회 (자신 기준 상위/하위 10명)
    router.get('/rankings', authenticateJWT, async (req, res) => {
        try {
            const { userUuid, username } = req.user;
            
            console.log(`[Arena] 랭킹 조회 요청: ${username} (${userUuid})`);
            
            const rankings = await arenaSystem.getEloRankings(userUuid, username);
            
            console.log(`[Arena] 랭킹 조회 완료:`, {
                myRank: rankings.myRank,
                totalUsers: rankings.totalUsers,
                higherCount: rankings.higher.length,
                lowerCount: rankings.lower.length
            });
            
            res.json({
                success: true,
                rankings
            });
        } catch (error) {
            console.error('[Arena] 랭킹 조회 실패:', error);
            console.error('[Arena] 에러 스택:', error.stack);
            res.status(500).json({ 
                success: false,
                error: '랭킹 조회에 실패했습니다.',
                details: error.message 
            });
        }
    });

    // 전투 시작
    router.post('/start-battle', authenticateJWT, async (req, res) => {
        try {
            const { userUuid, username } = req.user;
            const { opponentUuid } = req.body;
            
            if (!opponentUuid) {
                return res.status(400).json({ error: '상대를 선택해주세요.' });
            }
            
            // 자기 자신과는 전투 불가
            if (userUuid === opponentUuid) {
                return res.status(400).json({ error: '자기 자신과는 전투할 수 없습니다.' });
            }
            
            // 일일 제한 확인
            const limitInfo = await arenaSystem.checkDailyLimit(userUuid);
            if (!limitInfo.canBattle) {
                return res.status(400).json({ 
                    error: '오늘의 전투 횟수를 모두 소진했습니다.',
                    dailyLimit: limitInfo
                });
            }
            
            // 내 ELO 데이터 조회
            const myEloData = await arenaSystem.getOrCreateEloData(userUuid, username);
            
            // 상대방 정보 조회
            const opponentUser = await UserUuidModel.findOne({ userUuid: opponentUuid });
            if (!opponentUser) {
                return res.status(404).json({ error: '상대방을 찾을 수 없습니다.' });
            }
            
            const opponentEloData = await arenaSystem.getOrCreateEloData(
                opponentUuid,
                opponentUser.username
            );
            
            // 랭킹 정보로 상대의 순위 계산
            const rankings = await arenaSystem.getEloRankings(userUuid, username);
            const opponentRank = arenaSystem.calculateOpponentRank(
                myEloData.elo,
                opponentEloData.elo,
                rankings.higher,
                rankings.lower,
                opponentUuid
            );
            
            console.log('[Arena] 계산된 opponentRank:', opponentRank);
            
            // 내 전투 데이터 조회
            const myBattleData = await arenaSystem.getOpponentBattleData(userUuid);
            
            // 상대방 전투 데이터 조회
            const opponentBattleData = await arenaSystem.getOpponentBattleData(opponentUuid);
            
            // 전투 ID 생성
            const battleId = `arena_${userUuid}_${opponentUuid}_${Date.now()}`;
            
            // 전투 데이터 생성
            const battle = arenaSystem.createBattle(battleId, {
                userUuid,
                username,
                elo: myEloData.elo,
                ...myBattleData
            }, {
                userUuid: opponentUuid,
                username: opponentUser.username,
                elo: opponentEloData.elo,
                ...opponentBattleData
            });
            
            res.json({
                success: true,
                battleId,
                battle: {
                    player: battle.player,
                    opponent: battle.opponent,
                    opponentRank
                }
            });
        } catch (error) {
            console.error('전투 시작 실패:', error);
            res.status(500).json({ error: '전투 시작에 실패했습니다.' });
        }
    });

    // 전투 종료 및 결과 처리
    router.post('/finish-battle', authenticateJWT, async (req, res) => {
        try {
            const { userUuid, username } = req.user;
            const { battleId, isWin, opponentUuid, opponentUsername, opponentRank } = req.body;
            
            console.log('[Arena] finish-battle 요청:', { userUuid, username, isWin, opponentUuid, opponentRank });
            
            if (!battleId || isWin === undefined || !opponentUuid) {
                return res.status(400).json({ error: '전투 정보가 올바르지 않습니다.' });
            }
            
            // 전투 데이터 확인
            const battle = arenaSystem.getBattle(battleId);
            if (!battle) {
                console.error('[Arena] 전투 데이터를 찾을 수 없음:', battleId);
                return res.status(404).json({ error: '전투 데이터를 찾을 수 없습니다.' });
            }
            
            console.log('[Arena] 전투 데이터:', {
                playerElo: battle.player.elo,
                opponentElo: battle.opponent.elo
            });
            
            // 전투 결과 직접 처리 (간단하고 명확하게)
            let result;
            
            try {
                // 내 데이터 조회
                const myData = await arenaSystem.getOrCreateEloData(userUuid, username);
                const opponentData = await arenaSystem.getOrCreateEloData(opponentUuid, opponentUsername);
                
                console.log('[Arena] ELO 데이터 조회 완료:', {
                    myElo: myData.elo,
                    opponentElo: opponentData.elo
                });
                
                if (isWin) {
                    // 승리 시
                    const eloChange = arenaSystem.calculateEloChange(battle.player.elo, battle.opponent.elo, opponentRank, true);
                    const victorPoints = 10;
                    
                    console.log('[Arena] 승리 처리:', { eloChange, victorPoints });
                    
                    myData.elo += eloChange;
                    myData.victorPoints += victorPoints;
                    myData.dailyBattles += 1;
                    myData.totalWins += 1;
                    myData.winStreak += 1;
                    myData.lastBattleDate = new Date();
                    myData.lastOpponentUuid = opponentUuid;
                    
                    if (myData.winStreak > myData.maxWinStreak) {
                        myData.maxWinStreak = myData.winStreak;
                    }
                    
                    await myData.save();
                    
                    // 패자 업데이트
                    const loserEloChange = arenaSystem.calculateEloChange(battle.opponent.elo, battle.player.elo, opponentRank, false);
                    opponentData.elo = Math.max(0, opponentData.elo + loserEloChange);
                    opponentData.totalLosses += 1;
                    opponentData.winStreak = 0;
                    opponentData.lastOpponentUuid = userUuid;
                    await opponentData.save();
                    
                    result = {
                        winnerEloChange: eloChange,
                        winnerNewElo: myData.elo,
                        winnerVictorPoints: victorPoints,
                        winStreak: myData.winStreak
                    };
                } else {
                    // 패배 시
                    const loserEloChange = arenaSystem.calculateEloChange(battle.player.elo, battle.opponent.elo, opponentRank, false);
                    
                    console.log('[Arena] 패배 처리:', { loserEloChange });
                    
                    myData.elo = Math.max(0, myData.elo + loserEloChange);
                    myData.dailyBattles += 1;
                    myData.totalLosses += 1;
                    myData.winStreak = 0;
                    myData.lastBattleDate = new Date();
                    myData.lastOpponentUuid = opponentUuid;
                    await myData.save();
                    
                    // 승자 업데이트
                    const winnerEloChange = arenaSystem.calculateEloChange(battle.opponent.elo, battle.player.elo, opponentRank, true);
                    opponentData.elo += winnerEloChange;
                    opponentData.victorPoints += 10;
                    opponentData.totalWins += 1;
                    opponentData.winStreak += 1;
                    opponentData.lastOpponentUuid = userUuid;
                    if (opponentData.winStreak > opponentData.maxWinStreak) {
                        opponentData.maxWinStreak = opponentData.winStreak;
                    }
                    await opponentData.save();
                    
                    result = {
                        loserEloChange: loserEloChange,
                        loserNewElo: myData.elo,
                        winnerVictorPoints: 0,
                        winStreak: 0
                    };
                }
            } catch (dbError) {
                console.error('[Arena] DB 처리 중 에러:', dbError);
                throw dbError;
            }
            
            // 전투 종료
            arenaSystem.endBattle(battleId);
            
            // 전체 랭킹 업데이트 알림 (Socket.IO)
            io.emit('arena:ranking:update');
            
            console.log('[Arena] 전투 결과:', result);
            
            // 응답 생성
            const responseResult = isWin ? {
                isWin: true,
                eloChange: result.winnerEloChange,
                newElo: result.winnerNewElo,
                victorPoints: result.winnerVictorPoints,
                winStreak: result.winStreak
            } : {
                isWin: false,
                eloChange: result.loserEloChange,
                newElo: result.loserNewElo,
                victorPoints: 0,
                winStreak: 0
            };
            
            res.json({
                success: true,
                result: responseResult
            });
        } catch (error) {
            console.error('전투 결과 처리 실패:', error);
            console.error('에러 스택:', error.stack);
            res.status(500).json({ error: '전투 결과 처리에 실패했습니다.', details: error.message });
        }
    });

    return router;
}

module.exports = { setupArenaRoutes, getArenaSystem: () => arenaSystem };

