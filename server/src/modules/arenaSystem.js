class ArenaSystem {
    constructor(ArenaEloModel, CompanionStatsModel, UserStatsModel, FishingSkillModel, UserEquipmentModel) {
        this.ArenaEloModel = ArenaEloModel;
        this.CompanionStatsModel = CompanionStatsModel;
        this.UserStatsModel = UserStatsModel;
        this.FishingSkillModel = FishingSkillModel;
        this.UserEquipmentModel = UserEquipmentModel;
        
        // 진행 중인 전투 데이터 저장
        this.activeBattles = new Map();
        
        console.log('🏟️ ArenaSystem 초기화 완료');
    }
    
    // ELO 데이터 조회 또는 생성
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
                maxWinStreak: 0,
                lastOpponentUuid: null
            });
            await eloData.save();
            console.log(`✨ 새로운 결투장 유저 생성: ${username} (ELO: 1000)`);
        }
        
        return eloData;
    }
    
    // 일일 제한 확인
    async checkDailyLimit(userUuid) {
        const eloData = await this.getOrCreateEloData(userUuid, '');
        
        // 날짜 변경 확인 (한국 시간 기준 자정)
        const now = new Date();
        const kstOffset = 9 * 60 * 60 * 1000; // 한국 시간 +9시간
        const kstNow = new Date(now.getTime() + kstOffset);
        const today = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate());
        
        let lastBattleDate = null;
        if (eloData.lastBattleDate) {
            const lastBattle = new Date(eloData.lastBattleDate.getTime() + kstOffset);
            lastBattleDate = new Date(lastBattle.getFullYear(), lastBattle.getMonth(), lastBattle.getDate());
        }
        
        // 날짜가 바뀌었으면 카운트 리셋
        if (!lastBattleDate || lastBattleDate.getTime() !== today.getTime()) {
            eloData.dailyBattles = 0;
            await eloData.save();
        }
        
        const maxDailyBattles = 10;
        const remaining = Math.max(0, maxDailyBattles - eloData.dailyBattles);
        
        return {
            current: eloData.dailyBattles,
            max: maxDailyBattles,
            remaining,
            canBattle: remaining > 0
        };
    }
    
    // 랭킹 조회 (자신 기준 상위/하위 10명)
    async getEloRankings(userUuid, username) {
        // 내 ELO 조회
        const myEloData = await this.getOrCreateEloData(userUuid, username);
        const myElo = myEloData.elo;
        
        // 전체 유저 중에서 내 순위 계산
        const totalUsers = await this.ArenaEloModel.countDocuments();
        const higherRanked = await this.ArenaEloModel.countDocuments({ 
            elo: { $gt: myElo } 
        });
        const myRank = higherRanked + 1;
        
        // 상위 10명 조회 (나보다 ELO가 높은 사람들)
        const higher = await this.ArenaEloModel.find({ 
            elo: { $gte: myElo },
            userUuid: { $ne: userUuid }
        })
        .sort({ elo: -1, username: 1 })
        .limit(10)
        .lean();
        
        // 하위 10명 조회 (나보다 ELO가 낮은 사람들)
        const lower = await this.ArenaEloModel.find({ 
            elo: { $lt: myElo } 
        })
        .sort({ elo: -1, username: 1 })
        .limit(10)
        .lean();
        
        return {
            myRank,
            totalUsers,
            myElo,
            higher,
            lower,
            myData: {
                rank: myRank,
                elo: myEloData.elo,
                totalWins: myEloData.totalWins,
                totalLosses: myEloData.totalLosses,
                winStreak: myEloData.winStreak,
                victorPoints: myEloData.victorPoints
            }
        };
    }
    
    // 상대방의 순위 계산 (예상 ELO 변화량 계산용)
    calculateOpponentRank(myElo, opponentElo, higherList, lowerList, opponentUuid) {
        // 상위 리스트에서 찾기
        const higherIndex = higherList.findIndex(u => u.userUuid === opponentUuid);
        if (higherIndex !== -1) {
            return higherIndex + 1; // 1위부터 시작
        }
        
        // 하위 리스트에서 찾기
        const lowerIndex = lowerList.findIndex(u => u.userUuid === opponentUuid);
        if (lowerIndex !== -1) {
            return higherList.length + 2 + lowerIndex; // 내 순위 다음부터
        }
        
        // 리스트에 없으면 대략적인 순위 계산
        if (opponentElo > myElo) {
            return Math.max(1, Math.floor((myElo - opponentElo) / 50) + 5);
        } else {
            return Math.min(20, higherList.length + 2 + Math.floor((myElo - opponentElo) / 50));
        }
    }
    
    // ELO 변화량 계산
    calculateEloChange(myElo, opponentElo, opponentRank, isWin) {
        if (isWin) {
            // 승리 시: 순위가 높을수록 큰 보상
            const baseReward = 60;
            const rankPenalty = (opponentRank - 1) * 3;
            return Math.max(30, baseReward - rankPenalty);
        } else {
            // 패배 시: 순위가 낮을수록 큰 감점
            const basePenalty = -3;
            const rankPenalty = (opponentRank - 1) * 3;
            return Math.min(-3, basePenalty - rankPenalty);
        }
    }
    
    // 상대방의 전투 데이터 조회
    async getOpponentBattleData(userUuid) {
        // 유저 기본 스탯
        const userStats = await this.UserStatsModel.findOne({ userUuid });
        const fishingSkill = await this.FishingSkillModel.findOne({ userUuid });
        const equipment = await this.UserEquipmentModel.findOne({ userUuid });
        
        // 동료 스탯 (전투 참여 중인 동료만)
        const companions = await this.CompanionStatsModel.find({
            userUuid,
            inBattle: true
        }).lean();
        
        // HP 계산 (기본 HP + 장비 보너스)
        let baseHp = 100;
        let equipmentBonus = 0;
        
        if (equipment) {
            if (equipment.weapon) equipmentBonus += equipment.weapon.hp || 0;
            if (equipment.armor) equipmentBonus += equipment.armor.hp || 0;
            if (equipment.accessory) equipmentBonus += equipment.accessory.hp || 0;
        }
        
        const totalHp = baseHp + equipmentBonus + (userStats?.hp || 0);
        
        // 공격력 계산 (스킬 레벨 + 장비)
        let baseAttack = (fishingSkill?.level || 1) * 2;
        let weaponAttack = 0;
        
        if (equipment?.weapon) {
            weaponAttack = equipment.weapon.attack || 0;
        }
        
        const totalAttack = baseAttack + weaponAttack;
        
        return {
            hp: totalHp,
            maxHp: totalHp,
            attack: totalAttack,
            companions: companions.map(c => ({
                id: c.companionId,
                name: c.companionName,
                level: c.level,
                hp: c.hp,
                maxHp: c.maxHp,
                attack: c.attack
            }))
        };
    }
    
    // 전투 생성
    createBattle(battleId, playerData, opponentData) {
        const battle = {
            battleId,
            player: playerData,
            opponent: opponentData,
            createdAt: Date.now()
        };
        
        this.activeBattles.set(battleId, battle);
        console.log(`⚔️ 전투 생성: ${playerData.username} vs ${opponentData.username}`);
        
        return battle;
    }
    
    // 전투 데이터 조회
    getBattle(battleId) {
        return this.activeBattles.get(battleId);
    }
    
    // 전투 종료
    endBattle(battleId) {
        const battle = this.activeBattles.get(battleId);
        if (battle) {
            console.log(`🏁 전투 종료: ${battle.player.username} vs ${battle.opponent.username}`);
            this.activeBattles.delete(battleId);
            return true;
        }
        return false;
    }
    
    // 진행 중인 전투 정리 (1시간 이상 된 전투 삭제)
    cleanupOldBattles() {
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        let cleaned = 0;
        
        for (const [battleId, battle] of this.activeBattles.entries()) {
            if (battle.createdAt < oneHourAgo) {
                this.activeBattles.delete(battleId);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            console.log(`🧹 오래된 전투 ${cleaned}개 정리 완료`);
        }
    }
}

module.exports = ArenaSystem;
