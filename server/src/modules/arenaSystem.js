// 🏟️ 결투장 시스템 모듈
class ArenaSystem {
    constructor(ArenaEloModel, CompanionStatsModel, UserStatsModel, FishingSkillModel, UserEquipmentModel) {
        this.ArenaEloModel = ArenaEloModel;
        this.CompanionStatsModel = CompanionStatsModel;
        this.UserStatsModel = UserStatsModel;
        this.FishingSkillModel = FishingSkillModel;
        this.UserEquipmentModel = UserEquipmentModel;
        this.ongoingBattles = new Map(); // battleId -> battle data
    }

    // 유저의 ELO 데이터 초기화 또는 조회
    async getOrCreateEloData(userUuid, username) {
        let eloData = await this.ArenaEloModel.findOne({ userUuid });
        
        if (!eloData) {
            eloData = new this.ArenaEloModel({
                userUuid,
                username,
                elo: 1000,
                victorPoints: 0,
                dailyBattles: 0,
                lastBattleDate: null,
                totalWins: 0,
                totalLosses: 0,
                winStreak: 0,
                maxWinStreak: 0
            });
            await eloData.save();
        }
        
        // 일일 리셋 확인
        await this.checkDailyReset(eloData);
        
        return eloData;
    }

    // 일일 리셋 확인 (날짜가 바뀌면 dailyBattles 초기화)
    async checkDailyReset(eloData) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        if (!eloData.lastBattleDate) {
            return;
        }
        
        const lastBattleDay = new Date(
            eloData.lastBattleDate.getFullYear(),
            eloData.lastBattleDate.getMonth(),
            eloData.lastBattleDate.getDate()
        );
        
        // 날짜가 바뀌었으면 리셋
        if (today.getTime() > lastBattleDay.getTime()) {
            eloData.dailyBattles = 0;
            await eloData.save();
        }
    }

    // 일일 제한 확인 (10회)
    async checkDailyLimit(userUuid) {
        const eloData = await this.ArenaEloModel.findOne({ userUuid });
        if (!eloData) {
            return { canBattle: true, remaining: 10 };
        }
        
        await this.checkDailyReset(eloData);
        
        const remaining = Math.max(0, 10 - eloData.dailyBattles);
        return {
            canBattle: eloData.dailyBattles < 10,
            remaining,
            dailyBattles: eloData.dailyBattles
        };
    }

    // 랭킹 조회 (자신 기준 상위 10명, 하위 10명)
    async getEloRankings(userUuid, username) {
        // 유저 ELO 데이터 조회 또는 생성
        const myEloData = await this.getOrCreateEloData(userUuid, username);
        const myElo = myEloData.elo;
        
        // 전체 랭킹 조회 (ELO 내림차순)
        const allRankings = await this.ArenaEloModel.find({})
            .sort({ elo: -1 })
            .lean();
        
        // 내 순위 찾기
        const myRank = allRankings.findIndex(r => r.userUuid === userUuid) + 1;
        
        // 상위 10명 (나보다 ELO가 높은 유저들)
        const higher = allRankings
            .filter(r => r.elo > myElo || (r.elo === myElo && r.userUuid !== userUuid))
            .slice(0, 10);
        
        // 하위 10명 (나보다 ELO가 낮은 유저들)
        const lower = allRankings
            .filter(r => r.elo < myElo || (r.elo === myElo && r.userUuid !== userUuid))
            .slice(0, 10);
        
        return {
            myData: {
                ...myEloData.toObject(),
                rank: myRank
            },
            higher,
            lower,
            totalPlayers: allRankings.length
        };
    }

    // 전체 랭킹 조회 (페이지네이션용)
    async getAllRankings() {
        try {
            // 전체 랭킹 조회 (ELO 내림차순)
            const allRankings = await this.ArenaEloModel.find({})
                .sort({ elo: -1 })
                .lean();
            
            return allRankings;
        } catch (error) {
            console.error('전체 랭킹 조회 실패:', error);
            throw error;
        }
    }

    // ELO 변화량 계산
    calculateEloChange(myElo, opponentElo, rank, isWin) {
        // rank 값 검증 (1-10 사이)
        const validRank = (rank && !isNaN(rank) && rank >= 1 && rank <= 10) ? rank : 1;
        
        console.log('[Arena] ELO 변화 계산:', { myElo, opponentElo, rank, validRank, isWin });
        
        if (isWin) {
            // 승리: 가장 강한 상대 +60, 2번째 +57, 3번째 +54... (3점씩 감소)
            return 60 - (validRank - 1) * 3;
        } else {
            // 패배: 가장 강한 상대 -3, 2번째 -6, 3번째 -9... (3점씩 증가)
            return -3 - (validRank - 1) * 3;
        }
    }

    // 상대방의 순위 계산 (상위/하위 목록에서의 순위)
    calculateOpponentRank(myElo, opponentElo, higherList, lowerList, opponentUuid) {
        // 상위 목록에 있는지 확인
        const higherIndex = higherList.findIndex(r => r.userUuid === opponentUuid);
        if (higherIndex !== -1) {
            return higherIndex + 1; // 1번부터 시작
        }
        
        // 하위 목록에 있는지 확인
        const lowerIndex = lowerList.findIndex(r => r.userUuid === opponentUuid);
        if (lowerIndex !== -1) {
            return lowerIndex + 1; // 1번부터 시작
        }
        
        // 못 찾으면 기본값
        return 1;
    }

    // 상대방의 전투 데이터 조회
    async getOpponentBattleData(opponentUuid) {
        try {
            // 낚시 레벨 조회
            const fishingSkill = await this.FishingSkillModel.findOne({ userUuid: opponentUuid });
            
            // 성장 스탯 조회
            const userStats = await this.UserStatsModel.findOne({ userUuid: opponentUuid });
            
            // 장비 정보 조회 (공격력, 체력 계산에 필요)
            const equipment = await this.UserEquipmentModel.findOne({ userUuid: opponentUuid });
            
            // 동료 조회 (전투 참여 중인 동료만)
            const companions = await this.CompanionStatsModel.find({
                userUuid: opponentUuid,
                isBattleActive: true
            }).lean();
            
            console.log(`[Arena] ${opponentUuid} 데이터:`, {
                fishingSkill: fishingSkill?.fishingSkill,
                equipment: equipment,
                userStats: userStats,
                companionsCount: companions.length
            });
            
            return {
                fishingSkill: fishingSkill?.fishingSkill || 1,
                userStats: {
                    attack: userStats?.attack || 0,
                    health: userStats?.health || 0,
                    critical: userStats?.critical || 0,
                    // 장비 정보 포함
                    fishingRod: equipment?.fishingRod,
                    fishingRodEnhancement: equipment?.fishingRodEnhancement || 0,
                    accessory: equipment?.accessory,
                    accessoryEnhancement: equipment?.accessoryEnhancement || 0
                },
                companions: companions || []
            };
        } catch (error) {
            console.error('상대방 전투 데이터 조회 실패:', error);
            return {
                fishingSkill: 1,
                userStats: {
                    attack: 0,
                    health: 0,
                    critical: 0,
                    fishingRod: null,
                    fishingRodEnhancement: 0,
                    accessory: null,
                    accessoryEnhancement: 0
                },
                companions: []
            };
        }
    }

    // 전투 결과 처리
    async processArenaResult(winnerUuid, winnerUsername, loserUuid, loserUsername, myElo, opponentElo, opponentRank) {
        try {
            // 승자 데이터 업데이트
            const winnerData = await this.getOrCreateEloData(winnerUuid, winnerUsername);
            const eloChange = this.calculateEloChange(myElo, opponentElo, opponentRank, true);
            const victorPointsGain = 10; // 승리 시 10점
            
            winnerData.elo += eloChange;
            winnerData.victorPoints += victorPointsGain;
            winnerData.dailyBattles += 1;
            winnerData.totalWins += 1;
            winnerData.winStreak += 1;
            winnerData.lastBattleDate = new Date();
            winnerData.lastOpponentUuid = loserUuid;
            
            // 최대 연승 기록 갱신
            if (winnerData.winStreak > winnerData.maxWinStreak) {
                winnerData.maxWinStreak = winnerData.winStreak;
            }
            
            await winnerData.save();
            
            // 패자 데이터 업데이트
            const loserData = await this.getOrCreateEloData(loserUuid, loserUsername);
            const loserEloChange = this.calculateEloChange(opponentElo, myElo, opponentRank, false);
            
            loserData.elo = Math.max(0, loserData.elo + loserEloChange); // ELO는 0 이하로 떨어지지 않음
            loserData.dailyBattles += 1; // 패자도 일일 전투 횟수 증가
            loserData.totalLosses += 1;
            loserData.winStreak = 0; // 연승 초기화
            loserData.lastBattleDate = new Date();
            loserData.lastOpponentUuid = winnerUuid;
            
            await loserData.save();
            
            return {
                winnerEloChange: eloChange,
                winnerNewElo: winnerData.elo,
                winnerVictorPoints: victorPointsGain,
                loserEloChange: loserEloChange,
                loserNewElo: loserData.elo,
                winStreak: winnerData.winStreak
            };
        } catch (error) {
            console.error('전투 결과 처리 실패:', error);
            throw error;
        }
    }

    // 전투 시작
    createBattle(battleId, playerData, opponentData) {
        const battle = {
            id: battleId,
            player: playerData,
            opponent: opponentData,
            createdAt: Date.now()
        };
        
        this.ongoingBattles.set(battleId, battle);
        
        return battle;
    }

    // 전투 데이터 조회
    getBattle(battleId) {
        return this.ongoingBattles.get(battleId);
    }

    // 전투 종료
    endBattle(battleId) {
        this.ongoingBattles.delete(battleId);
    }
}

module.exports = ArenaSystem;

