const { getFishData, getFishHealthData, getPrefixData } = require('../data/gameData');

class ExpeditionSystem {
    constructor(EtherKeyModel, CompanionStatsModel) {
        this.expeditionRooms = new Map(); // roomId -> room data
        this.playerRooms = new Map(); // playerId -> roomId
        this.roomCounter = 1;
        this.EtherKeyModel = EtherKeyModel; // 에테르 열쇠 모델
        this.CompanionStatsModel = CompanionStatsModel; // 동료 능력치 모델
        
        // 게임 데이터 캐싱
        this.fishData = getFishData();
        this.fishHealthData = getFishHealthData();
        this.prefixData = getPrefixData();
    }

    // 원정 지역별 몬스터 설정
    getExpeditionAreas() {
        return [
            {
                id: 1,
                name: '쓸쓸한 부두',
                description: '안개가 자욱한 쓸쓸한 부두에서 레벨 1-5의 물고기들을 만날 수 있습니다',
                fishRankRange: [1, 5],
                maxMonsters: 4,
                minMonsters: 3
            },
            {
                id: 2,
                name: '노스트라',
                description: '신비로운 노스트라 지역에서 레벨 6-10의 물고기들과 조우할 수 있습니다',
                fishRankRange: [6, 10],
                maxMonsters: 4,
                minMonsters: 3
            },
            {
                id: 3,
                name: '가을초입길',
                description: '단풍이 아름다운 가을초입길에서 레벨 11-15의 강력한 물고기들이 기다립니다',
                fishRankRange: [11, 15],
                maxMonsters: 5,
                minMonsters: 4
            },
            {
                id: 4,
                name: '폭풍이 치는 곳',
                description: '거센 폭풍이 몰아치는 위험한 곳에서 레벨 16-20의 전설적인 물고기들을 만날 수 있습니다',
                fishRankRange: [16, 20],
                maxMonsters: 5,
                minMonsters: 4
            }
        ];
    }

    // 파티 방 생성
    async createExpeditionRoom(hostPlayerId, hostPlayerName, areaId) {
        const area = this.getExpeditionAreas().find(a => a.id === areaId);
        
        if (!area) {
            throw new Error('유효하지 않은 원정 지역입니다.');
        }

         // 에테르 열쇠 확인 및 차감 (지역별 차등 소모)
         if (this.EtherKeyModel) {
             const userEtherKeys = await this.EtherKeyModel.findOne({ userUuid: hostPlayerId });
             const requiredKeys = area.id; // 지역 ID가 곧 필요한 열쇠 개수 (1,2,3,4)
             
             if (!userEtherKeys || userEtherKeys.etherKeys < requiredKeys) {
                 throw new Error(`에테르 열쇠가 부족합니다. (필요: ${requiredKeys}개, 보유: ${userEtherKeys?.etherKeys || 0}개)`);
             }

             // 에테르 열쇠 차감
             userEtherKeys.etherKeys -= requiredKeys;
             await userEtherKeys.save();
             
             console.log(`[EXPEDITION] ${hostPlayerName} used ${requiredKeys} ether keys to create room. Remaining: ${userEtherKeys.etherKeys}`);
         }

        const roomId = `expedition_${this.roomCounter++}`;
        const room = {
            id: roomId,
            hostId: hostPlayerId,
            area: area,
            players: [{
                id: hostPlayerId,
                name: hostPlayerName,
                isHost: true,
                isReady: true
            }],
            status: 'waiting', // waiting, in_progress, completed
            monsters: [],
            createdAt: new Date(),
            maxPlayers: 4,
            etherKeyUsed: true // 에테르 열쇠 사용 여부 기록
        };

        this.expeditionRooms.set(roomId, room);
        this.playerRooms.set(hostPlayerId, roomId);

        return room;
    }

    // 방 목록 조회
    getAvailableRooms() {
        return Array.from(this.expeditionRooms.values())
            .filter(room => room.status === 'waiting' && room.players.length < room.maxPlayers)
            .map(room => ({
                id: room.id,
                hostName: room.players.find(p => p.isHost).name,
                areaName: room.area.name,
                currentPlayers: room.players.length,
                maxPlayers: room.maxPlayers,
                createdAt: room.createdAt
            }));
    }

    // 방 참가
    joinExpeditionRoom(roomId, playerId, playerName) {
        console.log(`[EXPEDITION] Attempting to join room ${roomId}, available rooms:`, Array.from(this.expeditionRooms.keys()));
        
        const room = this.expeditionRooms.get(roomId);
        
        if (!room) {
            console.log(`[EXPEDITION] Room ${roomId} not found`);
            throw new Error('존재하지 않는 방입니다.');
        }

        if (room.status !== 'waiting') {
            throw new Error('참가할 수 없는 상태의 방입니다.');
        }

        if (room.players.length >= room.maxPlayers) {
            throw new Error('방이 가득 찼습니다.');
        }

        if (room.players.some(p => p.id === playerId)) {
            throw new Error('이미 참가한 방입니다.');
        }

        // 기존 방에서 나가기
        this.leaveCurrentRoom(playerId);

        room.players.push({
            id: playerId,
            name: playerName,
            isHost: false,
            isReady: false
        });

        this.playerRooms.set(playerId, roomId);
        
        console.log(`[EXPEDITION] Player ${playerName} joined room ${roomId}. Total players: ${room.players.length}`);
        console.log(`[EXPEDITION] Current players in room:`, room.players.map(p => p.name));
        
        return room;
    }

    // 방 나가기
    async leaveExpeditionRoom(playerId) {
        const roomId = this.playerRooms.get(playerId);
        if (!roomId) return null;

        const room = this.expeditionRooms.get(roomId);
        if (!room) return null;

        const isHost = room.players.find(p => p.id === playerId)?.isHost;

        // 플레이어 제거
        room.players = room.players.filter(p => p.id !== playerId);
        this.playerRooms.delete(playerId);

         // 방장이 나가고 원정이 시작되지 않은 경우 에테르 열쇠 환불
         if (isHost && room.status === 'waiting' && room.etherKeyUsed && this.EtherKeyModel) {
             try {
                 let userEtherKeys = await this.EtherKeyModel.findOne({ userUuid: playerId });
                 const refundKeys = room.area?.id || 1; // 지역 ID만큼 환불
                 
                 if (!userEtherKeys) {
                     // 에테르 열쇠 레코드가 없으면 생성
                     userEtherKeys = new this.EtherKeyModel({
                         userId: 'user',
                         username: room.players.find(p => p.id === playerId)?.name || 'Unknown',
                         userUuid: playerId,
                         etherKeys: refundKeys
                     });
                 } else {
                     userEtherKeys.etherKeys += refundKeys;
                 }
                 
                 await userEtherKeys.save();
                 console.log(`[EXPEDITION] Refunded ${refundKeys} ether keys to ${playerId}. New balance: ${userEtherKeys.etherKeys}`);
             } catch (error) {
                 console.error(`[EXPEDITION] Failed to refund ether keys to ${playerId}:`, error);
             }
         }

        // 방 삭제 조건 개선: 방이 비었거나, (호스트가 없고 보상도 없는 경우), 또는 보상 수령 완료 상태인 경우에만 방 삭제
        const hasRemainingRewards = room.rewards && room.rewards.length > 0;
        const shouldDeleteRoom = room.players.length === 0 || 
                                (!room.players.some(p => p.isHost) && !hasRemainingRewards) || 
                                room.status === 'reward_claimed';
        
        if (shouldDeleteRoom) {
            // 모든 타이머 정리
            this.clearAllTimers(room);
            
            this.expeditionRooms.delete(roomId);
            // 남은 플레이어들을 방에서 제거
            room.players.forEach(p => this.playerRooms.delete(p.id));
            
            const reason = room.players.length === 0 ? 'empty' : 
                          (!room.players.some(p => p.isHost) && !hasRemainingRewards) ? 'no host and no rewards' : 
                          'rewards claimed';
            console.log(`[EXPEDITION] Room ${roomId} deleted. Reason: ${reason}`);
            return { roomDeleted: true };
        }

        // 방장이 나갔지만 보상이 남아있는 경우, 다른 플레이어를 새 방장으로 지정
        if (!room.players.some(p => p.isHost) && room.players.length > 0) {
            room.players[0].isHost = true;
            console.log(`[EXPEDITION] New host assigned: ${room.players[0].name} in room ${roomId}`);
        }

        return { room, roomDeleted: false };
    }

    // 현재 방에서 나가기
    leaveCurrentRoom(playerId) {
        const currentRoomId = this.playerRooms.get(playerId);
        if (currentRoomId) {
            this.leaveExpeditionRoom(playerId);
        }
    }

    // 준비 상태 변경
    toggleReady(playerId) {
        const roomId = this.playerRooms.get(playerId);
        if (!roomId) throw new Error('참가한 방이 없습니다.');

        const room = this.expeditionRooms.get(roomId);
        if (!room) throw new Error('방을 찾을 수 없습니다.');

        const player = room.players.find(p => p.id === playerId);
        if (!player) throw new Error('방에서 플레이어를 찾을 수 없습니다.');

        if (player.isHost) throw new Error('방장은 준비 상태를 변경할 수 없습니다.');

        player.isReady = !player.isReady;
        return room;
    }

    // 플레이어 강퇴 (방장만 가능)
    kickPlayer(hostPlayerId, targetPlayerId) {
        const roomId = this.playerRooms.get(hostPlayerId);
        if (!roomId) throw new Error('참가한 방이 없습니다.');

        const room = this.expeditionRooms.get(roomId);
        if (!room) throw new Error('방을 찾을 수 없습니다.');

        const host = room.players.find(p => p.id === hostPlayerId);
        if (!host || !host.isHost) throw new Error('방장만 플레이어를 강퇴할 수 있습니다.');

        const targetPlayer = room.players.find(p => p.id === targetPlayerId);
        if (!targetPlayer) throw new Error('강퇴할 플레이어를 찾을 수 없습니다.');

        if (targetPlayer.isHost) throw new Error('방장은 강퇴할 수 없습니다.');

        // 플레이어를 방에서 제거
        room.players = room.players.filter(p => p.id !== targetPlayerId);
        this.playerRooms.delete(targetPlayerId);

        console.log(`[EXPEDITION] Player ${targetPlayerId} kicked from room ${roomId} by host ${hostPlayerId}`);
        
        return { room };
    }

    // 원정 시작
    startExpedition(hostPlayerId, allPlayerData = {}) {
        console.log(`[ExpeditionSystem] Starting expedition for host: ${hostPlayerId}`);
        
        const roomId = this.playerRooms.get(hostPlayerId);
        if (!roomId) {
            console.log(`[ExpeditionSystem] No room found for player: ${hostPlayerId}`);
            throw new Error('참가한 방이 없습니다.');
        }

        const room = this.expeditionRooms.get(roomId);
        if (!room) {
            console.log(`[ExpeditionSystem] Room ${roomId} not found`);
            throw new Error('방을 찾을 수 없습니다.');
        }

        console.log(`[ExpeditionSystem] Room found, current status: ${room.status}`);

        const host = room.players.find(p => p.id === hostPlayerId);
        if (!host || !host.isHost) {
            console.log(`[ExpeditionSystem] Player ${hostPlayerId} is not host`);
            throw new Error('방장만 원정을 시작할 수 있습니다.');
        }

        // 모든 플레이어가 준비되었는지 확인
        const allReady = room.players.every(p => p.isReady || p.isHost);
        if (!allReady) {
            console.log(`[ExpeditionSystem] Not all players ready:`, room.players.map(p => ({ id: p.id, name: p.name, isReady: p.isReady, isHost: p.isHost })));
            throw new Error('모든 플레이어가 준비되지 않았습니다.');
        }

        // 모든 플레이어 데이터 저장 (동료, 낚시 실력, 악세사리 레벨 등)
        room.playerData = allPlayerData;

        console.log(`[ExpeditionSystem] All player data saved:`, Object.keys(room.playerData));
        console.log(`[ExpeditionSystem] Generating monsters for area: ${room.area.name}`);
        // 몬스터 생성
        room.monsters = this.generateMonsters(room.area);
        
        console.log(`[ExpeditionSystem] Initializing battle state`);
        // 자동 전투 초기화
        room.battleState = this.initializeBattleState(room);
        room.status = 'in_progress';
        room.startedAt = new Date();

        console.log(`[ExpeditionSystem] Expedition started successfully`);
        return room;
    }

    // 전투 상태 초기화 (탐사전투와 동일한 자동 전투 시스템)
    initializeBattleState(room) {
        // 플레이어들의 체력 초기화 (악세사리 레벨 기반)
        const playerHp = {};
        const playerMaxHp = {};
        const companionHp = {};
        const companionMaxHp = {};
        const companionMorale = {};
        const companionBuffs = {};
        const battleLog = [
            `${room.area.name} 원정이 시작되었습니다!`,
            `참가자: ${room.players.map(p => p.name).join(', ')}`,
            `몬스터 ${room.monsters.length}마리가 출현했습니다!`
        ];

        room.players.forEach(player => {
            // 실제 플레이어의 데이터 사용 (악세사리 레벨 기반 체력)
            const playerData = room.playerData?.[player.id];
            const accessoryLevel = playerData?.accessoryLevel || 1;
            const fishingSkill = playerData?.fishingSkill || 1;
            
            // 강화 보너스 계산 (내정보 탭과 동일)
            const accessoryEnhancement = playerData?.accessoryEnhancement || 0;
            const accessoryEnhancementBonus = this.calculateTotalEnhancementBonus(accessoryEnhancement);
            
            // 체력 계산: 내정보 탭과 동일하게 강화 보너스 포함
            const maxHp = this.calculatePlayerMaxHp(accessoryLevel, accessoryEnhancementBonus);
            
            playerHp[player.id] = maxHp;
            playerMaxHp[player.id] = maxHp;
            

            // 동료 체력 초기화
            if (playerData?.companions && playerData.companions.length > 0) {
                playerData.companions.forEach(companion => {
                    const companionStats = this.calculateCompanionStats(companion.companionName, companion.level);
                    if (companionStats) {
                        const companionKey = `${player.id}_${companion.companionName}`;
                        companionHp[companionKey] = companionStats.hp;
                        companionMaxHp[companionKey] = companionStats.hp;
                        companionMorale[companionKey] = 50; // 초기 사기 50
                        companionBuffs[companionKey] = {}; // 버프 초기화
                        
                        battleLog.push(`${companion.companionName}이(가) ${player.name}와 함께 전투에 참여합니다!`);
                    }
                });
            }
        });

        // 턴 순서 계산 (탐사전투와 동일)
        const turnOrder = ['player']; // 플레이어는 항상 첫 번째
        
        // 동료들과 몬스터의 속도 비교하여 턴 순서 결정
        const combatants = [];
        
        // 몬스터들 추가
        room.monsters.forEach(monster => {
            combatants.push({ type: 'monster', id: monster.id, speed: monster.attackPower });
        });
        
        // 동료들 추가
        room.players.forEach(player => {
            const playerData = room.playerData?.[player.id];
            if (playerData?.companions) {
                playerData.companions.forEach(companion => {
                    const companionStats = this.calculateCompanionStats(companion.companionName, companion.level);
                    if (companionStats) {
                        combatants.push({ 
                            type: 'companion', 
                            playerId: player.id,
                            name: companion.companionName, 
                            speed: companionStats.speed 
                        });
                    }
                });
            }
        });
        
        // 속도 순으로 정렬 (높은 속도가 먼저)
        combatants.sort((a, b) => b.speed - a.speed);
        
        // 플레이어 다음 턴 순서 배치
        combatants.forEach(combatant => {
            if (combatant.type === 'monster') {
                turnOrder.push(`monster_${combatant.id}`);
            } else if (combatant.type === 'companion') {
                turnOrder.push(`companion_${combatant.playerId}_${combatant.name}`);
            }
        });

        battleLog.push(`턴제 전투가 시작됩니다!`);
        battleLog.push(`턴 순서: ${turnOrder.map(turn => {
            if (turn === 'player') return '플레이어';
            if (turn.startsWith('monster_')) return `몬스터`;
            if (turn.startsWith('companion_')) return turn.split('_')[2];
            return turn;
        }).join(' → ')}`);
        
        return {
            playerHp: playerHp,
            playerMaxHp: playerMaxHp,
            companionHp: companionHp,
            companionMaxHp: companionMaxHp,
            companionMorale: companionMorale,
            companionBuffs: companionBuffs,
            turnOrder: turnOrder,
            currentTurnIndex: 0,
            currentTurn: 'player',
            autoMode: false, // 턴제 전투 모드
            canFlee: true, // 도망 가능
            battleLog: battleLog,
            round: 1
        };
    }
    
    // 강화 보너스 계산 함수 (3차방정식 - 퍼센트로 표시)
    calculateEnhancementBonus(level) {
        if (level <= 0) return 0;
        return 0.1 * Math.pow(level, 3) - 0.2 * Math.pow(level, 2) + 0.8 * level;
    }
    
    calculateTotalEnhancementBonus(level) {
        let totalBonus = 0;
        for (let i = 1; i <= level; i++) {
            totalBonus += this.calculateEnhancementBonus(i);
        }
        return totalBonus;
    }
    
    // 플레이어 최대 체력 계산 (내정보 탭과 동일한 공식 + 강화 보너스)
    calculatePlayerMaxHp(accessoryLevel, enhancementBonusPercent = 0) {
        // 내정보 탭과 동일한 체력 계산 공식 사용
        if (accessoryLevel === 0 && enhancementBonusPercent === 0) return 50; // 기본 체력
        const baseHp = accessoryLevel === 0 ? 50 : Math.floor(Math.pow(accessoryLevel, 1.325) + 50 * accessoryLevel + 5 * accessoryLevel);
        // 강화 보너스 퍼센트 적용
        return baseHp + (baseHp * enhancementBonusPercent / 100);
    }

    // 동료 능력치 계산 (탐사전투와 동일)
    calculateCompanionStats(companionName, level = 1) {
        const COMPANION_DATA = {
            "실": {
                name: "실",
                baseHp: 54,
                baseAttack: 9,
                baseSpeed: 45,
                growthHp: 10,
                growthAttack: 2,
                growthSpeed: 0.5,
                description: "민첩한 검사",
                rarity: "일반",
                skill: {
                    name: "폭격",
                    description: "강력한 폭격으로 적에게 큰 피해를 입힙니다",
                    damageMultiplier: 1.5,
                    moraleRequired: 100
                }
            },
            "피에나": {
                name: "피에나",
                baseHp: 66,
                baseAttack: 8,
                baseSpeed: 25,
                growthHp: 12,
                growthAttack: 2,
                growthSpeed: 0.5,
                description: "강인한 방패병",
                rarity: "일반",
                skill: {
                    name: "무의태세",
                    description: "3턴 동안 공격력이 25% 상승합니다",
                    damageMultiplier: 1.0,
                    moraleRequired: 100,
                    buffType: "attack",
                    buffMultiplier: 1.25,
                    buffDuration: 3
                }
            },
            "애비게일": {
                name: "애비게일",
                baseHp: 46,
                baseAttack: 12,
                baseSpeed: 40,
                growthHp: 8,
                growthAttack: 3,
                growthSpeed: 0.5,
                description: "화염 마법사",
                rarity: "일반",
                skill: {
                    name: "집중포화",
                    description: "3턴 동안 크리티컬 확률이 20% 상승합니다",
                    damageMultiplier: 1.0,
                    moraleRequired: 100,
                    buffType: "critical",
                    buffMultiplier: 0.20,
                    buffDuration: 3
                }
            },
            "클로에": {
                name: "클로에",
                baseHp: 40,
                baseAttack: 14,
                baseSpeed: 65,
                growthHp: 6,
                growthAttack: 3,
                growthSpeed: 0.5,
                description: "암살자",
                rarity: "일반",
                skill: {
                    name: "에테르축복",
                    description: "체력이 가장 낮은 아군의 체력을 회복시킵니다",
                    damageMultiplier: 0,
                    healMultiplier: 1.85,
                    moraleRequired: 100,
                    skillType: "heal"
                }
            },
            "나하트라": {
                name: "나하트라",
                baseHp: 80,
                baseAttack: 11,
                baseSpeed: 30,
                growthHp: 14,
                growthAttack: 3,
                growthSpeed: 0.5,
                description: "용족 전사",
                rarity: "일반"
            },
            "림스&베리": {
                name: "림스&베리",
                baseHp: 60,
                baseAttack: 9,
                baseSpeed: 50,
                growthHp: 10,
                growthAttack: 2,
                growthSpeed: 0.5,
                description: "쌍둥이 궁수",
                rarity: "희귀"
            }
        };

        const baseData = COMPANION_DATA[companionName];
        if (!baseData) return null;

        const hp = baseData.baseHp + (baseData.growthHp * (level - 1));
        const attack = baseData.baseAttack + (baseData.growthAttack * (level - 1));
        const speed = baseData.baseSpeed + (baseData.growthSpeed * (level - 1));

        return {
            ...baseData,
            level,
            hp,
            attack,
            speed,
            maxHp: hp
        };
    }

    // 접두어 선택 함수 (탐사와 동일)
    selectFishPrefix() {
        if (!this.prefixData.length) {
            return { name: '거대한', hpMultiplier: 1.0, amberMultiplier: 1.0 };
        }
        
        const random = Math.random() * 100;
        let cumulative = 0;
        
        for (const prefix of this.prefixData) {
            cumulative += prefix.probability;
            if (random <= cumulative) {
                return prefix;
            }
        }
        
        return this.prefixData[0]; // 기본값
    }

    // 플레이어 공격력 계산 함수 (탐사와 동일) + 강화 보너스 (퍼센트)
    calculatePlayerAttack(fishingSkill, enhancementBonusPercent = 0) {
        // 3차방정식: 0.00225 * skill³ + 0.165 * skill² + 2 * skill + 3
        const baseAttack = 0.00225 * Math.pow(fishingSkill, 3) + 0.165 * Math.pow(fishingSkill, 2) + 2 * fishingSkill + 3;
        // 강화 보너스 퍼센트 적용
        const totalAttack = baseAttack + (baseAttack * enhancementBonusPercent / 100);
        // 랜덤 요소 추가 (±20%)
        const randomFactor = 0.8 + Math.random() * 0.4;
        return Math.floor(totalAttack * randomFactor);
    }

    // 동료 기본 데이터 가져오기
    getCompanionBaseData(companionName) {
        const COMPANION_DATA = {
            "실": { baseHp: 54, baseAttack: 9, baseSpeed: 45, growthHp: 10, growthAttack: 2, growthSpeed: 0.5 },
            "피에나": { baseHp: 66, baseAttack: 8, baseSpeed: 25, growthHp: 12, growthAttack: 2, growthSpeed: 0.5 },
            "애비게일": { baseHp: 46, baseAttack: 12, baseSpeed: 40, growthHp: 8, growthAttack: 3, growthSpeed: 0.5 },
            "림스&베리": { baseHp: 60, baseAttack: 9, baseSpeed: 50, growthHp: 10, growthAttack: 2, growthSpeed: 0.5 },
            "클로에": { baseHp: 40, baseAttack: 14, baseSpeed: 65, growthHp: 6, growthAttack: 3, growthSpeed: 0.5 },
            "나하트라": { baseHp: 80, baseAttack: 11, baseSpeed: 30, growthHp: 14, growthAttack: 3, growthSpeed: 0.5 }
        };
        return COMPANION_DATA[companionName];
    }

    // 동료 공격력 계산 함수
    calculateCompanionAttack(companion) {
        const companionData = this.getCompanionBaseData(companion.companionName);
        const level = companion.level || 1;
        
        if (companionData) {
            return companionData.baseAttack + (companionData.growthAttack * (level - 1));
        } else {
            // 기본 계산 (호환성)
            return level * 8 + Math.floor(Math.random() * 10) + 5;
        }
    }

    // 크리티컬 히트 계산 함수 (버프 적용)
    calculateCriticalHit(baseDamage, companionKey = null, battleState = null) {
        let criticalChance = 0.05; // 기본 5% 크리티컬 확률
        let attackMultiplier = 1.0; // 기본 공격력 배수
        
        // 동료 버프 적용
        if (companionKey && battleState?.companionBuffs?.[companionKey]) {
            const buffs = battleState.companionBuffs[companionKey];
            
            // 크리티컬 버프 적용
            if (buffs.critical && buffs.critical.turnsLeft > 0) {
                criticalChance += buffs.critical.multiplier;
            }
            
            // 공격력 버프 적용
            if (buffs.attack && buffs.attack.turnsLeft > 0) {
                attackMultiplier *= buffs.attack.multiplier;
            }
        }
        
        const isCritical = Math.random() < criticalChance;
        let damage = Math.floor(baseDamage * attackMultiplier);
        
        if (isCritical) {
            damage = Math.floor(damage * 1.5);
        }
        
        return { damage, isCritical };
    }

    // 물고기 공격력 계산 함수 (탐사와 동일)
    calculateEnemyAttack(fishRank) {
        if (fishRank === 0) return Math.floor(Math.random() * 3) + 8; // 스타피쉬 특별 처리
        return Math.floor(Math.pow(fishRank, 1.65) + fishRank * 1.3 + 10 + Math.random() * 5);
    }

    // 랭크 범위에서 랜덤 물고기 선택
    getRandomFishInRankRange(minRank, maxRank) {
        const availableFish = this.fishData.filter(fish => 
            fish.rank >= minRank && fish.rank <= maxRank && fish.name !== "스타피쉬"
        );
        
        if (availableFish.length === 0) {
            // 범위에 물고기가 없으면 기본값 반환
            return { name: "타코문어", rank: 1 };
        }
        
        const randomIndex = Math.floor(Math.random() * availableFish.length);
        return availableFish[randomIndex];
    }

    // 접두어별 속도 배율 반환
    getPrefixSpeedMultiplier(prefixName) {
        switch (prefixName) {
            case '거대한': return 1.0;
            case '변종': return 1.1;
            case '심연의': return 1.2;
            case '깊은어둠의': return 1.3;
            default: return 1.0;
        }
    }

    // 몬스터 생성 (탐사와 동일한 시스템)
    generateMonsters(area) {
        // 지역별 몬스터 수량 범위에서 랜덤 선택
        const monsterCount = Math.floor(Math.random() * (area.maxMonsters - area.minMonsters + 1)) + area.minMonsters;
        const monsters = [];

        for (let i = 0; i < monsterCount; i++) {
            // 랭크 범위에서 랜덤 물고기 선택
            const baseFish = this.getRandomFishInRankRange(area.fishRankRange[0], area.fishRankRange[1]);
            
            // 접두어 선택
            const selectedPrefix = this.selectFishPrefix();
            const fishName = `${selectedPrefix.name} ${baseFish.name}`;
            
            // 물고기 체력 계산 (접두어 배율 적용)
            const baseHp = this.fishHealthData[baseFish.name] || (baseFish.rank * 50 + 50);
            const maxHp = Math.floor(baseHp * selectedPrefix.hpMultiplier);
            
            // 공격력 계산 (랭크 기반)
            const attackPower = this.calculateEnemyAttack(baseFish.rank);
            
            // 속도 계산 (새로운 공식: 25 + (물고기인덱스 * 0.5) * 접두어배율)
            const baseSpeed = 25 + (baseFish.rank * 0.5);
            const prefixMultiplier = this.getPrefixSpeedMultiplier(selectedPrefix.name);
            const speed = baseSpeed * prefixMultiplier;
            
            const monster = {
                id: `monster_${i + 1}`,
                name: fishName,
                baseFish: baseFish.name,
                prefix: selectedPrefix,
                rank: baseFish.rank,
                maxHp: maxHp,
                currentHp: maxHp,
                attackPower: attackPower,
                speed: speed,
                isAlive: true
            };

            monsters.push(monster);
        }

        return monsters;
    }

    // 속도 기반 전투 시작
    startSpeedBasedBattle(room, io) {
        // 즉시 전투 상태를 클라이언트에 전송
        if (io) {
            const roomData = this.getRoomForSocket(room);
            io.emit('expeditionBattleUpdate', {
                type: 'battleStarted',
                room: roomData
            });
            io.emit('expeditionStarted', roomData);
        }
        
        // 각 참가자의 개별 타이머 시작
        this.startIndividualTimers(room, io);
    }
    
    // 개별 타이머 시스템
    startIndividualTimers(room, io) {
        // 플레이어 타이머
            room.players.forEach(player => {
            if (room.battleState.playerHp[player.id] > 0) {
                const playerData = room.playerData?.[player.id];
                const speed = 100; // 기본 플레이어 속도
                const interval = (250 / speed) * 1000; // 250/속도 초 (클라이언트와 동일)
                
                this.startPlayerTimer(room, player, interval, io);
            }
        });
        
        // 동료 타이머
        Object.entries(room.playerData || {}).forEach(([playerId, playerData]) => {
            playerData.companions?.forEach(companion => {
                const companionKey = `${playerId}_${companion.companionName}`;
                if (room.battleState.companionHp[companionKey] > 0) {
                    // 동료 속도 계산: baseSpeed + (growthSpeed * (level - 1))
                    const companionData = this.getCompanionBaseData(companion.companionName);
                    const level = companion.level || 1;
                    const speed = companionData ?
                        companionData.baseSpeed + (companionData.growthSpeed * (level - 1)) : 150;
                    const interval = (250 / speed) * 1000; // 250/속도 초 (클라이언트와 동일)
                    
                    this.startCompanionTimer(room, playerId, companion, interval, io);
                }
            });
        });
        
        // 몬스터 타이머
        room.monsters.forEach(monster => {
            if (monster.isAlive) {
                const speed = monster.speed || 80; // 몬스터 속도
                const interval = (250 / speed) * 1000; // 250/속도 초 (클라이언트와 동일)
                
                this.startMonsterTimer(room, monster, interval, io);
            }
        });
    }
    
    // 플레이어 개별 타이머
    startPlayerTimer(room, player, interval, io) {
        const timerId = setInterval(async () => {
            if (!room.battleState || room.battleState.playerHp[player.id] <= 0) {
                clearInterval(timerId);
                    return;
                }
                
            // 전투 종료 체크
            if (await this.checkBattleEnd(room, io)) {
                clearInterval(timerId);
                return;
            }
            
            // 플레이어 공격 실행
            this.executePlayerAttack(room, player, io);
            
            // 사기 15 증가
            this.increaseMorale(room, player.id, 15);
            
            // 클라이언트에 속도바 리셋 신호 전송
            io.emit('expeditionSpeedBarReset', {
                roomId: room.id,
                characterId: `player_${player.id}`,
                characterType: 'player'
            });
            
        }, interval);
        
        // 타이머 저장 (나중에 정리용)
        if (!room.timers) room.timers = {};
        room.timers[`player_${player.id}`] = timerId;
    }
    
    // 동료 개별 타이머
    startCompanionTimer(room, playerId, companion, interval, io) {
        const companionKey = `${playerId}_${companion.companionName}`;
        
        const timerId = setInterval(async () => {
            if (!room.battleState || room.battleState.companionHp[companionKey] <= 0) {
                clearInterval(timerId);
                return;
            }
            
            // 전투 종료 체크
            if (await this.checkBattleEnd(room, io)) {
                clearInterval(timerId);
                return;
            }
            
            // 사기 15 증가 (공격 전에)
            const moraleBeforeIncrease = room.battleState.companionMorale[companionKey] || 0;
            this.increaseMorale(room, playerId, 15, companionKey);
            const moraleAfterIncrease = room.battleState.companionMorale[companionKey] || 0;
            console.log(`[MORALE] ${companion.companionName}: ${moraleBeforeIncrease} → ${moraleAfterIncrease}`);
            
            // 동료 공격 실행
            this.executeCompanionAttack(room, playerId, companion, io);
            
            // 클라이언트에 속도바 리셋 신호 전송
            io.emit('expeditionSpeedBarReset', {
                roomId: room.id,
                characterId: `companion_${companionKey}`,
                characterType: 'companion'
            });
            
        }, interval);
        
        // 타이머 저장
        if (!room.timers) room.timers = {};
        room.timers[`companion_${companionKey}`] = timerId;
    }
    
    // 몬스터 개별 타이머
    startMonsterTimer(room, monster, interval, io) {
        const timerId = setInterval(async () => {
            if (!room.battleState || !monster.isAlive) {
                clearInterval(timerId);
                return;
            }
            
            // 전투 종료 체크
            if (await this.checkBattleEnd(room, io)) {
                clearInterval(timerId);
                return;
            }
            
            // 몬스터 공격 실행
            this.executeMonsterAttack(room, monster, io);
            
            // 클라이언트에 속도바 리셋 신호 전송
            io.emit('expeditionSpeedBarReset', {
                roomId: room.id,
                characterId: `monster_${monster.id}`,
                characterType: 'monster'
            });
            
        }, interval);
        
        // 타이머 저장
        if (!room.timers) room.timers = {};
        room.timers[`monster_${monster.id}`] = timerId;
    }
    
    // 개별 플레이어 공격 실행
    executePlayerAttack(room, player, io) {
        const battleState = room.battleState;
        
        // 살아있는 몬스터 중 랜덤 선택
        const aliveMonsters = room.monsters.filter(m => m.isAlive);
        if (aliveMonsters.length === 0) return;
        
        const targetMonster = aliveMonsters[Math.floor(Math.random() * aliveMonsters.length)];
        
        // 플레이어 공격력 계산 (강화 보너스 포함)
                const playerData = room.playerData?.[player.id];
        const fishingSkill = playerData?.fishingSkill || 1;
        const fishingRodEnhancement = playerData?.fishingRodEnhancement || 0;
        const fishingRodEnhancementBonus = this.calculateTotalEnhancementBonus(fishingRodEnhancement);
        const baseDamage = this.calculatePlayerAttack(fishingSkill, fishingRodEnhancementBonus);
        const { damage: finalDamage, isCritical } = this.calculateCriticalHit(baseDamage);
        
        // 몬스터에게 데미지 적용
        targetMonster.currentHp = Math.max(0, targetMonster.currentHp - finalDamage);
        if (targetMonster.currentHp === 0) {
            targetMonster.isAlive = false;
            
            // 몬스터가 죽으면 속도바 리셋 신호 전송
            if (io) {
                io.emit('expeditionSpeedBarReset', {
                    roomId: room.id,
                    characterId: `monster_${targetMonster.id}`,
                    characterType: 'monster'
                });
            }
        }
        
        // 전투 로그 추가
        const criticalText = isCritical ? ' (치명타!)' : '';
        battleState.battleLog.push(`${player.name}이(가) ${targetMonster.name}에게 ${finalDamage} 데미지!${criticalText}`);
        
        if (targetMonster.currentHp === 0) {
            battleState.battleLog.push(`${targetMonster.name}이(가) 쓰러졌습니다!`);
        }
        
        // 소켓으로 전투 업데이트 알림
                if (io) {
                    io.emit('expeditionBattleUpdate', {
                type: 'playerAttack',
                        room: this.getRoomForSocket(room)
                    });
                }
    }
    
    // 개별 동료 공격 실행
    executeCompanionAttack(room, playerId, companion, io) {
        const battleState = room.battleState;
        const companionKey = `${playerId}_${companion.companionName}`;
        
        // 살아있는 몬스터 중 랜덤 선택
        const aliveMonsters = room.monsters.filter(m => m.isAlive);
        if (aliveMonsters.length === 0) return;
        
        const targetMonster = aliveMonsters[Math.floor(Math.random() * aliveMonsters.length)];
        
        // 동료 스탯 계산
        const companionStats = this.calculateCompanionStats(companion.companionName, companion.level);
        const currentMorale = battleState.companionMorale[companionKey] || 0;
        
        // 스킬 사용 가능 여부 확인
        const canUseSkill = companionStats.skill && currentMorale >= companionStats.skill.moraleRequired;
        
        // 디버깅 로그
        if (companionStats.skill) {
            console.log(`[COMPANION] ${companion.companionName}: 사기=${currentMorale}, 필요=${companionStats.skill.moraleRequired}, 스킬사용=${canUseSkill}`);
        }
        
        
        let finalDamage = 0;
        let isCritical = false;
        let isSkillUsed = false;
        
        if (canUseSkill) {
            // 스킬 사용
            const skill = companionStats.skill;
            battleState.companionMorale[companionKey] = 0; // 사기 소모
            isSkillUsed = true;
            
            if (skill.skillType === 'heal') {
                // 힐 스킬 - 체력이 가장 낮은 아군 회복
                const healAmount = Math.floor(companionStats.attack * skill.healMultiplier);
                
                // 체력이 가장 낮은 플레이어 찾기
                let lowestHpTarget = null;
                let lowestHpRatio = 1;
                
                room.players.forEach(player => {
                    const currentHp = battleState.playerHp[player.id] || 0;
                    const playerData = room.playerData[player.id];
                    const accessoryLevel = playerData?.accessoryLevel || 0;
                    const accessoryEnhancement = playerData?.accessoryEnhancement || 0;
                    const accessoryEnhancementBonus = this.calculateTotalEnhancementBonus(accessoryEnhancement);
                    const maxHp = this.calculatePlayerMaxHp(accessoryLevel, accessoryEnhancementBonus);
                    const hpRatio = currentHp / maxHp;
                    
                    if (currentHp > 0 && hpRatio < lowestHpRatio) {
                        lowestHpRatio = hpRatio;
                        lowestHpTarget = { type: 'player', id: player.id, name: player.name, currentHp, maxHp };
                    }
                });
                
                // 동료들도 체크
                Object.entries(room.playerData || {}).forEach(([pId, playerData]) => {
                    playerData.companions?.forEach(comp => {
                        const compKey = `${pId}_${comp.companionName}`;
                        const currentHp = battleState.companionHp[compKey] || 0;
                        const compStats = this.calculateCompanionStats(comp.companionName, comp.level);
                        const maxHp = compStats.hp;
                        const hpRatio = currentHp / maxHp;
                        
                        if (currentHp > 0 && hpRatio < lowestHpRatio) {
                            lowestHpRatio = hpRatio;
                            lowestHpTarget = { type: 'companion', id: compKey, name: comp.companionName, currentHp, maxHp };
                        }
                    });
                });
                
                if (lowestHpTarget) {
                    const newHp = Math.min(lowestHpTarget.maxHp, lowestHpTarget.currentHp + healAmount);
                    
                    if (lowestHpTarget.type === 'player') {
                        battleState.playerHp[lowestHpTarget.id] = newHp;
                    } else {
                        battleState.companionHp[lowestHpTarget.id] = newHp;
                    }
                    
                    battleState.battleLog.push(`${companion.companionName}이(가) ${skill.name}을(를) 사용하여 ${lowestHpTarget.name}을(를) ${healAmount} 회복시켰습니다!`);
                }
                
                finalDamage = 0; // 힐 스킬은 데미지 없음
            } else if (skill.buffType) {
                // 버프 스킬
                const baseDamage = Math.floor(companionStats.attack * (skill.damageMultiplier || 1.0));
                const criticalResult = this.calculateCriticalHit(baseDamage, companionKey, battleState);
                finalDamage = criticalResult.damage;
                isCritical = criticalResult.isCritical;
                
                // 버프 적용
                if (!battleState.companionBuffs) {
                    battleState.companionBuffs = {};
                }
                if (!battleState.companionBuffs[companionKey]) {
                    battleState.companionBuffs[companionKey] = {};
                }
                
                battleState.companionBuffs[companionKey][skill.buffType] = {
                    multiplier: skill.buffMultiplier,
                    duration: skill.buffDuration,
                    turnsLeft: skill.buffDuration
                };
                
                battleState.battleLog.push(`${companion.companionName}이(가) ${skill.name}을(를) 사용했습니다!`);
                
                // 버프 메시지
                if (skill.buffType === 'attack') {
                    battleState.battleLog.push(`🔥 3턴 동안 공격력이 25% 상승합니다!`);
                } else if (skill.buffType === 'critical') {
                    battleState.battleLog.push(`🎯 3턴 동안 크리티컬 확률이 20% 상승합니다!`);
                }
                
                // 데미지 표시
                if (finalDamage > 0) {
                    const criticalText = isCritical ? ' (치명타!)' : '';
                    battleState.battleLog.push(`${targetMonster.name}에게 ${finalDamage} 데미지!${criticalText}`);
                }
            } else {
                // 데미지 스킬 (실의 폭격)
                const baseDamage = Math.floor(companionStats.attack * skill.damageMultiplier);
                const criticalResult = this.calculateCriticalHit(baseDamage, companionKey, battleState);
                finalDamage = criticalResult.damage;
                isCritical = criticalResult.isCritical;
                
                battleState.battleLog.push(`${companion.companionName}이(가) ${skill.name}을(를) 사용했습니다!`);
                
                // 데미지 표시
                if (finalDamage > 0) {
                    const criticalText = isCritical ? ' (치명타!)' : '';
                    battleState.battleLog.push(`${targetMonster.name}에게 ${finalDamage} 데미지!${criticalText}`);
                }
            }
        } else {
            // 일반 공격
            const baseDamage = this.calculateCompanionAttack(companion);
            const criticalResult = this.calculateCriticalHit(baseDamage, companionKey, battleState);
            finalDamage = criticalResult.damage;
            isCritical = criticalResult.isCritical;
        }
        
        // 몬스터에게 데미지 적용 (힐 스킬이 아닌 경우)
        if (finalDamage > 0) {
            targetMonster.currentHp = Math.max(0, targetMonster.currentHp - finalDamage);
            if (targetMonster.currentHp === 0) {
                targetMonster.isAlive = false;
                
                // 몬스터가 죽으면 속도바 리셋 신호 전송
                if (io) {
                    io.to(`expedition_${room.id}`).emit('expeditionSpeedBarReset', {
                        roomId: room.id,
                        characterId: `monster_${targetMonster.id}`,
                        characterType: 'monster'
                    });
                }
            }
            
            // 일반 공격 로그 추가 (스킬이 아닌 경우만)
            if (!isSkillUsed && finalDamage > 0) {
                const criticalText = isCritical ? ' (치명타!)' : '';
                battleState.battleLog.push(`${companion.companionName}이(가) ${targetMonster.name}에게 ${finalDamage} 데미지!${criticalText}`);
            }
            
            if (targetMonster.currentHp === 0) {
                battleState.battleLog.push(`${targetMonster.name}이(가) 쓰러졌습니다!`);
            }
        }
        
        // 소켓으로 전투 업데이트 알림
                if (io) {
                    io.emit('expeditionBattleUpdate', {
                type: 'companionAttack',
                        room: this.getRoomForSocket(room)
                    });
                }
    }
    
    // 개별 몬스터 공격 실행
    executeMonsterAttack(room, monster, io) {
        const battleState = room.battleState;
        
        // 공격 대상 선택 (플레이어 + 동료)
        const targets = [];
        room.players.forEach(player => {
            if (battleState.playerHp[player.id] > 0) {
                targets.push({ type: 'player', id: player.id, name: player.name });
            }
        });
        
        // 동료들도 대상에 추가
        Object.entries(room.playerData || {}).forEach(([playerId, playerData]) => {
            playerData.companions?.forEach(companion => {
                const companionKey = `${playerId}_${companion.companionName}`;
                if (battleState.companionHp[companionKey] > 0) {
                    targets.push({ 
                        type: 'companion', 
                        id: companionKey, 
                        name: companion.companionName 
                    });
                }
            });
        });
        
        if (targets.length === 0) return;
        
        // 랜덤 대상 선택
        const target = targets[Math.floor(Math.random() * targets.length)];
        const damage = monster.attackPower;
        
        // 데미지 적용
        if (target.type === 'player') {
            battleState.playerHp[target.id] = Math.max(0, battleState.playerHp[target.id] - damage);
            battleState.battleLog.push(`${monster.name}이(가) ${target.name}에게 ${damage} 데미지!`);
            
            if (battleState.playerHp[target.id] <= 0) {
                battleState.battleLog.push(`${target.name}이(가) 쓰러졌습니다!`);
            }
        } else if (target.type === 'companion') {
            battleState.companionHp[target.id] = Math.max(0, battleState.companionHp[target.id] - damage);
            battleState.battleLog.push(`${monster.name}이(가) ${target.name}에게 ${damage} 데미지!`);
            
            if (battleState.companionHp[target.id] <= 0) {
                battleState.battleLog.push(`${target.name}이(가) 쓰러졌습니다!`);
            }
        }
        
        // 소켓으로 전투 업데이트 알림
        if (io) {
            io.emit('expeditionBattleUpdate', {
                type: 'monsterAttack',
                room: this.getRoomForSocket(room)
            });
        }
    }
    
    // 사기 증가 함수
    increaseMorale(room, playerId, amount, companionKey = null) {
        const battleState = room.battleState;
        
        if (companionKey) {
            // 동료 사기 증가
            if (!battleState.companionMorale[companionKey]) {
                battleState.companionMorale[companionKey] = 0;
            }
            const oldMorale = battleState.companionMorale[companionKey];
            battleState.companionMorale[companionKey] = Math.min(100, 
                battleState.companionMorale[companionKey] + amount);
            
        } else {
            // 플레이어의 모든 동료 사기 증가
            const playerData = room.playerData?.[playerId];
            if (playerData?.companions) {
                playerData.companions.forEach(companion => {
                    const key = `${playerId}_${companion.companionName}`;
                    if (!battleState.companionMorale[key]) {
                        battleState.companionMorale[key] = 0;
                    }
                    battleState.companionMorale[key] = Math.min(100, 
                        battleState.companionMorale[key] + amount);
                });
            }
        }
    }
    
    // 플레이어 자동 공격 (플레이어 + 동료)
    autoPlayerAttack(room, io) {
        const battleState = room.battleState;
        const alivePlayers = room.players.filter(p => battleState.playerHp[p.id] > 0);
        
        if (alivePlayers.length === 0) return;
        
        // 각 살아있는 플레이어가 공격
        alivePlayers.forEach(player => {
            // 살아있는 몬스터 중 랜덤 선택
            const aliveMonsters = room.monsters.filter(m => m.isAlive);
            if (aliveMonsters.length === 0) return;
            
            const targetMonster = aliveMonsters[Math.floor(Math.random() * aliveMonsters.length)];
            
            // 플레이어 공격력 계산 (탐사전투와 동일, 강화 보너스 포함)
            const playerData = room.playerData?.[player.id];
            const fishingSkill = playerData?.fishingSkill || 1;
            const fishingRodEnhancement = playerData?.fishingRodEnhancement || 0;
            const fishingRodEnhancementBonus = this.calculateTotalEnhancementBonus(fishingRodEnhancement);
            const baseDamage = this.calculatePlayerAttack(fishingSkill, fishingRodEnhancementBonus);
            const { damage: finalDamage, isCritical } = this.calculateCriticalHit(baseDamage);
            
            // 몬스터에게 데미지 적용
            targetMonster.currentHp = Math.max(0, targetMonster.currentHp - finalDamage);
            if (targetMonster.currentHp === 0) {
                targetMonster.isAlive = false;
                
                // 몬스터가 죽으면 속도바 리셋 신호 전송
                if (io) {
                    io.to(`expedition_${room.id}`).emit('expeditionSpeedBarReset', {
                        roomId: room.id,
                        characterId: `monster_${targetMonster.id}`,
                        characterType: 'monster'
                    });
                }
            }
            
            // 전투 로그 추가
            const attackMessage = isCritical 
                ? `💥 크리티컬! ${player.name}이(가) ${targetMonster.name}에게 ${finalDamage} 데미지!`
                : `${player.name}이(가) ${targetMonster.name}에게 ${finalDamage} 데미지!`;
            
            battleState.battleLog.push(attackMessage);
            
            if (!targetMonster.isAlive) {
                battleState.battleLog.push(`${targetMonster.name}이(가) 쓰러졌습니다!`);
            }
            
            // 동료들 공격
            if (playerData?.companions) {
                playerData.companions.forEach(companion => {
                    const companionKey = `${player.id}_${companion.companionName}`;
                    
                    // 동료가 살아있는지 확인
                    if (battleState.companionHp[companionKey] > 0) {
                        const aliveMonsters = room.monsters.filter(m => m.isAlive);
                        if (aliveMonsters.length === 0) return;
                        
                        // 랜덤 몬스터 선택
                        const companionTarget = aliveMonsters[Math.floor(Math.random() * aliveMonsters.length)];
                        
                        // 동료 공격력 계산
                        const companionStats = this.calculateCompanionStats(companion.companionName, companion.level);
                        const companionDamage = companionStats ? Math.floor(companionStats.attack * (0.8 + Math.random() * 0.4)) : 10;
                        
                        // 몬스터에게 데미지 적용
                        companionTarget.currentHp = Math.max(0, companionTarget.currentHp - companionDamage);
                        if (companionTarget.currentHp <= 0) {
                            companionTarget.isAlive = false;
                            
                            // 몬스터가 죽으면 속도바 리셋 신호 전송
                            if (io) {
                                io.emit('expeditionSpeedBarReset', {
                                    roomId: room.id,
                                    characterId: `monster_${companionTarget.id}`,
                                    characterType: 'monster'
                                });
                            }
                        }
                        
                        // 전투 로그 추가
                        battleState.battleLog.push(`${companion.companionName}이(가) ${companionTarget.name}에게 ${companionDamage} 데미지!`);
                        if (!companionTarget.isAlive) {
                            battleState.battleLog.push(`${companionTarget.name}이(가) 쓰러졌습니다!`);
                        }
                    }
                });
            }
        });
        
        // 소켓으로 전투 업데이트 알림
        if (io) {
            io.emit('expeditionBattleUpdate', {
                type: 'playerAttack',
                room: this.getRoomForSocket(room)
            });
        }
    }

    // 턴 처리 함수 (탐사전투와 동일한 자동 진행 방식)
    async processTurn(room, io) {
        const battleState = room.battleState;
        const currentTurn = battleState.currentTurn;
        
        // 전투 종료 조건 확인
        if (await this.checkBattleEnd(room, io)) {
            return;
        }
        
        // 현재 턴에 따른 행동 처리
        if (currentTurn === 'player') {
            // 플레이어 턴 - 자동으로 랜덤 몬스터 공격 (탐사전투와 동일)
            setTimeout(() => {
                this.autoPlayerAttack(room, io);
                // 플레이어 턴 후 3초 뒤 다음 턴으로 진행
                setTimeout(() => {
                    this.nextTurn(room, io);
                }, 3000);
            }, 500);
        } else if (currentTurn.startsWith('monster_')) {
            // 몬스터 턴 - 자동 공격
            const monsterId = currentTurn.replace('monster_', '');
            setTimeout(() => {
                this.monsterTurn(room, monsterId, io);
                // 몬스터 턴 후 3초 뒤 다음 턴으로 진행
                setTimeout(() => {
                    this.nextTurn(room, io);
                }, 3000);
            }, 500);
        } else if (currentTurn.startsWith('companion_')) {
            // 동료 턴 - 자동 공격 및 스킬 사용
            const parts = currentTurn.split('_');
            const playerId = parts[1];
            const companionName = parts[2];
            setTimeout(() => {
                this.companionTurn(room, playerId, companionName, io);
                // 동료 턴 후 3초 뒤 다음 턴으로 진행
                setTimeout(() => {
                    this.nextTurn(room, io);
                }, 3000);
            }, 500);
        }
    }

    // 턴 진행 처리 (라우트에서 호출)
    processNextTurn(roomId, io) {
        const room = this.expeditionRooms.get(roomId);
        if (!room) return;
        
        this.nextTurn(room, io);
    }

    // 다음 턴으로 진행 (탐사전투와 동일한 시스템)
    nextTurn(room, io = null) {
        const battleState = room.battleState;
        battleState.currentTurnIndex = (battleState.currentTurnIndex + 1) % battleState.turnOrder.length;
        
        // 새로운 라운드 시작
        if (battleState.currentTurnIndex === 0) {
            battleState.round++;
            
            // 버프 지속시간 감소 (라운드 완료 시)
            this.decreaseBuffDuration(battleState);
        }

        const currentTurnType = battleState.turnOrder[battleState.currentTurnIndex];
        battleState.currentTurn = currentTurnType;
        
        // 다음 턴 처리
        setTimeout(() => {
            this.processTurn(room, io);
        }, 1000);
    }

    // 전투 종료 조건 확인
    async checkBattleEnd(room, io) {
        const battleState = room.battleState;
        
        // 모든 몬스터가 죽었는지 확인
        const allMonstersDefeated = room.monsters.every(m => !m.isAlive);
        if (allMonstersDefeated) {
            this.clearAllTimers(room);
            await this.handleVictory(room);
        if (io) {
                const roomData = this.getRoomForSocket(room);
                io.emit('expeditionCompleted', roomData);
            io.emit('expeditionBattleUpdate', {
                    type: 'victory',
                    room: roomData
                });
            }
            return true;
        }
        
        // 모든 플레이어와 동료가 죽었는지 확인
        let allPlayersDead = true;
        room.players.forEach(player => {
            if (battleState.playerHp[player.id] > 0) {
                allPlayersDead = false;
                return;
            }
            
            const playerData = room.playerData?.[player.id];
            if (playerData?.companions) {
                playerData.companions.forEach(companion => {
                    const companionKey = `${player.id}_${companion.companionName}`;
                    if (battleState.companionHp[companionKey] > 0) {
                        allPlayersDead = false;
                    }
                });
            }
        });
        
        if (allPlayersDead) {
            this.clearAllTimers(room);
            this.handleDefeat(room);
        if (io) {
            io.emit('expeditionBattleUpdate', {
                    type: 'defeat',
                    room: this.getRoomForSocket(room)
                });
            }
            return true;
        }

        return false;
    }
    
    // 모든 타이머 정리
    clearAllTimers(room) {
        if (room.timers) {
            Object.values(room.timers).forEach(timerId => {
                clearInterval(timerId);
            });
            room.timers = {};
        }
    }

    // 몬스터 턴 처리
    monsterTurn(room, monsterId, io) {
            const monster = room.monsters.find(m => m.id === monsterId);
        const battleState = room.battleState;
            
        if (!monster || !monster.isAlive) {
            return;
        }
        
        // 공격 대상 선택 (플레이어 + 동료)
        const targets = [];
        room.players.forEach(player => {
            if (battleState.playerHp[player.id] > 0) {
                targets.push({ type: 'player', id: player.id, name: player.name });
            }
            
            const playerData = room.playerData?.[player.id];
            if (playerData?.companions) {
                playerData.companions.forEach(companion => {
                    const companionKey = `${player.id}_${companion.companionName}`;
                    if (battleState.companionHp[companionKey] > 0) {
                        targets.push({
                            type: 'companion',
                            id: companionKey,
                            name: companion.companionName,
                            playerId: player.id
                        });
                    }
                });
            }
        });
        
        if (targets.length === 0) {
            this.nextTurn(room, io);
            return;
        }
        
        const target = targets[Math.floor(Math.random() * targets.length)];
        const damage = Math.floor(monster.attackPower * (0.8 + Math.random() * 0.4));
        
        if (target.type === 'player') {
            battleState.playerHp[target.id] = Math.max(0, battleState.playerHp[target.id] - damage);
            battleState.battleLog.push(`${monster.name}이(가) ${target.name}에게 ${damage} 데미지!`);
            
            if (battleState.playerHp[target.id] <= 0) {
                battleState.battleLog.push(`${target.name}이(가) 쓰러졌습니다!`);
            }
        } else if (target.type === 'companion') {
            battleState.companionHp[target.id] = Math.max(0, battleState.companionHp[target.id] - damage);
            battleState.battleLog.push(`${monster.name}이(가) ${target.name}에게 ${damage} 데미지!`);
            
            if (battleState.companionHp[target.id] <= 0) {
                battleState.battleLog.push(`${target.name}이(가) 쓰러졌습니다!`);
            }
        }
        
        // 몬스터 공격 후 상태 업데이트 전송
        if (io) {
            io.emit('expeditionBattleUpdate', {
                type: 'monsterAttack',
                room: this.getRoomForSocket(room)
            });
        }
        
        // processTurn에서 nextTurn을 처리하므로 여기서는 호출하지 않음
    }

    // 동료 턴 처리 (스킬 포함)
    companionTurn(room, playerId, companionName, io) {
        const battleState = room.battleState;
        const companionKey = `${playerId}_${companionName}`;
        
        // 동료가 죽었으면 턴 넘김
        if (battleState.companionHp[companionKey] <= 0) {
            battleState.battleLog.push(`${companionName}이(가) 쓰러져서 행동할 수 없습니다.`);
            this.nextTurn(room, io);
            return;
        }

        // 사기 증가 (턴마다 +15)
        if (battleState.companionMorale[companionKey] !== undefined) {
            battleState.companionMorale[companionKey] = Math.min(100, battleState.companionMorale[companionKey] + 15);
        }
        
        // 살아있는 몬스터 찾기
        const aliveMonsters = room.monsters.filter(m => m.isAlive);
        if (aliveMonsters.length === 0) {
            this.nextTurn(room, io);
            return;
        }
        
        // 랜덤 몬스터 선택
        const targetMonster = aliveMonsters[Math.floor(Math.random() * aliveMonsters.length)];
        
        // 동료 능력치 가져오기
        const playerData = room.playerData?.[playerId];
        const companion = playerData?.companions?.find(c => c.companionName === companionName);
        const companionStats = this.calculateCompanionStats(companionName, companion?.level || 1);
        
        if (!companionStats) {
            this.nextTurn(room, io);
            return;
        }

        // 스킬 사용 가능 여부 확인
        const currentMorale = battleState.companionMorale[companionKey] || 0;
        const canUseSkill = companionStats.skill && currentMorale >= companionStats.skill.moraleRequired;
        
        let damage = 0;
        let healAmount = 0;
        
        if (canUseSkill) {
            // 스킬 사용
            const skill = companionStats.skill;
            battleState.companionMorale[companionKey] = 0; // 사기 소모
            
            if (skill.skillType === 'heal') {
                // 힐 스킬
                healAmount = Math.floor(companionStats.attack * skill.healMultiplier);
                this.healLowestAlly(room, playerId, companionName, healAmount, battleState);
                battleState.battleLog.push(`${companionName}이(가) 스킬 '${skill.name}'을(를) 사용했습니다!`);
            } else if (skill.buffType) {
                // 버프 스킬
                damage = Math.floor(companionStats.attack * skill.damageMultiplier * (0.8 + Math.random() * 0.4));
                this.applyCompanionBuff(battleState, companionKey, skill);
                battleState.battleLog.push(`${companionName}이(가) 스킬 '${skill.name}'을(를) 사용했습니다!`);
                
                if (skill.buffType === 'attack') {
                    battleState.battleLog.push(`🔥 3턴 동안 공격력이 25% 상승합니다!`);
                } else if (skill.buffType === 'critical') {
                    battleState.battleLog.push(`🎯 3턴 동안 크리티컬 확률이 20% 상승합니다!`);
                }
            } else {
                // 데미지 스킬
                damage = Math.floor(companionStats.attack * skill.damageMultiplier * (0.8 + Math.random() * 0.4));
                battleState.battleLog.push(`${companionName}이(가) 스킬 '${skill.name}'을(를) 사용했습니다!`);
            }
        } else {
            // 일반 공격
            const effectiveAttack = this.getEffectiveAttack(companionStats.attack, battleState.companionBuffs[companionKey]);
            damage = Math.floor(effectiveAttack * (0.8 + Math.random() * 0.4));
        }
        
        // 몬스터에게 데미지 적용
        if (damage > 0) {
            targetMonster.currentHp = Math.max(0, targetMonster.currentHp - damage);
            if (targetMonster.currentHp <= 0) {
                targetMonster.isAlive = false;
                
                // 몬스터가 죽으면 속도바 리셋 신호 전송
                if (io) {
                    io.to(`expedition_${room.id}`).emit('expeditionSpeedBarReset', {
                        roomId: room.id,
                        characterId: `monster_${targetMonster.id}`,
                        characterType: 'monster'
                    });
                }
            }
            
            battleState.battleLog.push(`${companionName}이(가) ${targetMonster.name}에게 ${damage} 데미지!`);
            if (!targetMonster.isAlive) {
                battleState.battleLog.push(`${targetMonster.name}이(가) 쓰러졌습니다!`);
            }
        }
        
        // 소켓으로 동료 공격 알림
        if (io) {
            io.emit('expeditionBattleUpdate', {
                type: 'companionAttack',
                room: this.getRoomForSocket(room)
            });
        }
        
        // processTurn에서 nextTurn을 처리하므로 여기서는 호출하지 않음
    }

    // 플레이어 공격 함수 (속도바 기반 - 턴 체크 제거)
    playerAttack(userUuid, targetMonsterId = null) {
        const roomId = this.playerRooms.get(userUuid);
        if (!roomId) {
            throw new Error('참가한 방이 없습니다.');
        }

        const room = this.expeditionRooms.get(roomId);
        if (!room || room.status !== 'in_progress') {
            throw new Error('진행 중인 원정이 없습니다.');
        }

        const battleState = room.battleState;
        
        // 살아있는 몬스터 찾기
        const aliveMonsters = room.monsters.filter(m => m.isAlive);
        if (aliveMonsters.length === 0) {
            throw new Error('살아있는 몬스터가 없습니다.');
        }

        // 대상 몬스터 선택
        let targetMonster;
        if (targetMonsterId) {
            targetMonster = room.monsters.find(m => m.id === targetMonsterId && m.isAlive);
        }
        if (!targetMonster) {
            targetMonster = aliveMonsters[0]; // 첫 번째 살아있는 몬스터
        }

        // 플레이어 데이터 가져오기
        const playerData = room.playerData?.[userUuid];
        const fishingSkill = playerData?.fishingSkill || 1;
        
        // 공격력 계산 (강화 보너스 포함)
        const fishingRodEnhancement = playerData?.fishingRodEnhancement || 0;
        const fishingRodEnhancementBonus = this.calculateTotalEnhancementBonus(fishingRodEnhancement);
        const baseDamage = this.calculatePlayerAttack(fishingSkill, fishingRodEnhancementBonus);
        const { damage: finalDamage, isCritical } = this.calculateCriticalHit(baseDamage);

        // 몬스터에게 데미지 적용
        targetMonster.currentHp = Math.max(0, targetMonster.currentHp - finalDamage);
        if (targetMonster.currentHp <= 0) {
            targetMonster.isAlive = false;
        }

        // 전투 로그 추가
        const player = room.players.find(p => p.id === userUuid);
        const attackMessage = isCritical 
            ? `💥 크리티컬! ${player?.name || '플레이어'}가 ${targetMonster.name}에게 ${finalDamage} 데미지!`
            : `${player?.name || '플레이어'}가 ${targetMonster.name}에게 ${finalDamage} 데미지!`;
        
        battleState.battleLog.push(attackMessage);
        battleState.battleLog.push(`(${targetMonster.currentHp}/${targetMonster.maxHp})`);
        
        if (!targetMonster.isAlive) {
            battleState.battleLog.push(`${targetMonster.name}이(가) 쓰러졌습니다!`);
        }

        return { room, damage: finalDamage, isCritical, targetMonster };
    }

    // 동료 공격 함수 (속도바 기반)
    companionAttackSpeedBased(playerId, companionName, targetMonsterId = null) {
        const roomId = this.playerRooms.get(playerId);
        if (!roomId) {
            throw new Error('참가한 방이 없습니다.');
        }

        const room = this.expeditionRooms.get(roomId);
        if (!room || room.status !== 'in_progress') {
            throw new Error('진행 중인 원정이 없습니다.');
        }

        const companionKey = `${playerId}_${companionName}`;
        const battleState = room.battleState;
        
        // 동료가 살아있는지 확인
        if (!battleState.companionHp[companionKey] || battleState.companionHp[companionKey] <= 0) {
            throw new Error('동료가 전투 불능 상태입니다.');
        }

        // 살아있는 몬스터 찾기
        const aliveMonsters = room.monsters.filter(m => m.isAlive);
        if (aliveMonsters.length === 0) {
            throw new Error('살아있는 몬스터가 없습니다.');
        }

        // 대상 몬스터 선택
        let targetMonster;
        if (targetMonsterId) {
            targetMonster = room.monsters.find(m => m.id === targetMonsterId && m.isAlive);
        }
        if (!targetMonster) {
            targetMonster = aliveMonsters[Math.floor(Math.random() * aliveMonsters.length)];
        }

        // 동료 능력치 가져오기
        const playerData = room.playerData?.[playerId];
        const companion = playerData?.companions?.find(c => c.companionName === companionName);
        const companionStats = this.calculateCompanionStats(companionName, companion?.level || 1);
        
        if (!companionStats) {
            throw new Error('동료 정보를 찾을 수 없습니다.');
        }

        const baseDamage = Math.floor(companionStats.attack * (0.8 + Math.random() * 0.4));
        const { damage: finalDamage, isCritical } = this.calculateCriticalHit(baseDamage, companionKey, battleState);

        // 몬스터에게 데미지 적용
        targetMonster.currentHp = Math.max(0, targetMonster.currentHp - finalDamage);
        if (targetMonster.currentHp <= 0) {
            targetMonster.isAlive = false;
        }

        // 사기 증가
        this.increaseMorale(room, playerId, 15, companionKey);

        // 전투 로그 추가
        const attackMessage = isCritical
            ? `💥 크리티컬! ${companionName}이(가) ${targetMonster.name}에게 ${finalDamage} 데미지!`
            : `${companionName}이(가) ${targetMonster.name}에게 ${finalDamage} 데미지!`;
        
        battleState.battleLog.push(attackMessage);
        battleState.battleLog.push(`(${targetMonster.currentHp}/${targetMonster.maxHp})`);
        
        if (!targetMonster.isAlive) {
            battleState.battleLog.push(`${targetMonster.name}이(가) 쓰러졌습니다!`);
        }

        return { room, damage: finalDamage, isCritical, targetMonster };
    }

    // 몬스터 공격 함수 (속도바 기반)
    monsterAttackSpeedBased(monsterId) {
        // 몬스터가 속한 방 찾기
        let room = null;
        for (const [roomId, r] of this.expeditionRooms) {
            if (r.monsters.some(m => m.id === monsterId)) {
                room = r;
                break;
            }
        }

        if (!room || room.status !== 'in_progress') {
            throw new Error('진행 중인 원정이 없습니다.');
        }

        const monster = room.monsters.find(m => m.id === monsterId);
        if (!monster || !monster.isAlive) {
            throw new Error('유효하지 않은 몬스터입니다.');
        }

        const battleState = room.battleState;

        // 공격 대상 선택 (플레이어 + 동료)
        const targets = [];
        room.players.forEach(player => {
            if (battleState.playerHp[player.id] > 0) {
                targets.push({ type: 'player', id: player.id, name: player.name });
            }
        });
        
        // 동료들도 대상에 추가
        Object.entries(room.playerData || {}).forEach(([playerId, playerData]) => {
            playerData.companions?.forEach(companion => {
                const companionKey = `${playerId}_${companion.companionName}`;
                if (battleState.companionHp[companionKey] > 0) {
                    targets.push({ 
                        type: 'companion', 
                        id: companionKey, 
                        name: companion.companionName 
                    });
                }
            });
        });

        if (targets.length === 0) {
            throw new Error('공격할 대상이 없습니다.');
        }

        // 랜덤 대상 선택
        const target = targets[Math.floor(Math.random() * targets.length)];
        const damage = Math.floor(monster.attackPower * (0.8 + Math.random() * 0.4));

        // 데미지 적용
        if (target.type === 'player') {
            battleState.playerHp[target.id] = Math.max(0, battleState.playerHp[target.id] - damage);
            battleState.battleLog.push(`${monster.name}이(가) ${target.name}에게 ${damage} 데미지!`);
            
            if (battleState.playerHp[target.id] <= 0) {
                battleState.battleLog.push(`${target.name}이(가) 쓰러졌습니다!`);
            }
        } else if (target.type === 'companion') {
            battleState.companionHp[target.id] = Math.max(0, battleState.companionHp[target.id] - damage);
            battleState.battleLog.push(`${monster.name}이(가) ${target.name}에게 ${damage} 데미지!`);
            
            if (battleState.companionHp[target.id] <= 0) {
                battleState.battleLog.push(`${target.name}이(가) 쓰러졌습니다!`);
            }
        }

        return { room, damage, target };
    }

    // 동료 버프 적용
    applyCompanionBuff(battleState, companionKey, skill) {
        if (!battleState.companionBuffs[companionKey]) {
            battleState.companionBuffs[companionKey] = {};
        }
        
        battleState.companionBuffs[companionKey][skill.buffType] = {
            multiplier: skill.buffMultiplier,
            turnsLeft: skill.buffDuration
        };
    }

    // 효과적인 공격력 계산 (버프 적용)
    getEffectiveAttack(baseAttack, buffs) {
        if (!buffs || !buffs.attack) return baseAttack;
        return Math.floor(baseAttack * buffs.attack.multiplier);
    }

    // 가장 체력이 낮은 아군 힐
    healLowestAlly(room, playerId, healerName, healAmount, battleState) {
        let lowestHpTarget = null;
        let lowestHpPercentage = 1.0;
        
        // 플레이어 체력 확인
        room.players.forEach(player => {
            const currentHp = battleState.playerHp[player.id] || 0;
            const maxHp = battleState.playerMaxHp[player.id] || 100;
            const hpPercentage = currentHp / maxHp;
            
            if (currentHp > 0 && hpPercentage < lowestHpPercentage) {
                lowestHpPercentage = hpPercentage;
                lowestHpTarget = { type: 'player', id: player.id, name: player.name };
            }
        });
        
        // 동료 체력 확인
        Object.keys(battleState.companionHp).forEach(companionKey => {
            const currentHp = battleState.companionHp[companionKey] || 0;
            const maxHp = battleState.companionMaxHp[companionKey] || 100;
            const hpPercentage = currentHp / maxHp;
            
            if (currentHp > 0 && hpPercentage < lowestHpPercentage) {
                lowestHpPercentage = hpPercentage;
                const companionName = companionKey.split('_')[1];
                lowestHpTarget = { type: 'companion', id: companionKey, name: companionName };
            }
        });
        
        // 힐 적용
        if (lowestHpTarget) {
            if (lowestHpTarget.type === 'player') {
                const newHp = Math.min(
                    battleState.playerMaxHp[lowestHpTarget.id],
                    battleState.playerHp[lowestHpTarget.id] + healAmount
                );
                battleState.playerHp[lowestHpTarget.id] = newHp;
                battleState.battleLog.push(`💚 ${lowestHpTarget.name}의 체력이 ${healAmount} 회복되었습니다!`);
            } else if (lowestHpTarget.type === 'companion') {
                const newHp = Math.min(
                    battleState.companionMaxHp[lowestHpTarget.id],
                    battleState.companionHp[lowestHpTarget.id] + healAmount
                );
                battleState.companionHp[lowestHpTarget.id] = newHp;
                battleState.battleLog.push(`💚 ${lowestHpTarget.name}의 체력이 ${healAmount} 회복되었습니다!`);
            }
        }
    }

    // 버프 지속시간 감소
    decreaseBuffDuration(battleState) {
        Object.keys(battleState.companionBuffs).forEach(companionKey => {
            const buffs = battleState.companionBuffs[companionKey];
            Object.keys(buffs).forEach(buffType => {
                if (buffs[buffType].turnsLeft > 0) {
                    buffs[buffType].turnsLeft--;
                    
                    if (buffs[buffType].turnsLeft <= 0) {
                        // 버프 만료
                        const companionName = companionKey.split('_')[1];
                        const buffName = buffType === 'attack' ? '무의태세' : '집중포화';
                        battleState.battleLog.push(`⏰ ${companionName}의 '${buffName}' 효과가 만료되었습니다.`);
                        delete buffs[buffType];
                    }
                }
            });
        });
    }

    // 몬스터 자동 공격 (플레이어 + 동료 대상)
    autoMonsterAttack(room, io) {
        console.log(`[EXPEDITION] Monster attack starting for room: ${room.id}`);
        const battleState = room.battleState;
        
        // 살아있는 몬스터들이 각각 공격
        const aliveMonsters = room.monsters.filter(m => m.isAlive);
        const alivePlayers = room.players.filter(p => battleState.playerHp[p.id] > 0);
        
        console.log(`[EXPEDITION] Alive monsters: ${aliveMonsters.length}, Alive players: ${alivePlayers.length}`);
        if (aliveMonsters.length === 0 || alivePlayers.length === 0) return;
        
        aliveMonsters.forEach(monster => {
            // 공격 대상 목록 생성 (플레이어 + 동료)
            const targets = [];
            
            // 살아있는 플레이어들 추가
            alivePlayers.forEach(player => {
                targets.push({
                    type: 'player',
                    id: player.id,
                    name: player.name
                });
                
                // 해당 플레이어의 살아있는 동료들 추가
                const playerData = room.playerData?.[player.id];
                if (playerData?.companions) {
                    playerData.companions.forEach(companion => {
                        const companionKey = `${player.id}_${companion.companionName}`;
                        if (battleState.companionHp[companionKey] > 0) {
                            targets.push({
                                type: 'companion',
                                id: companionKey,
                                name: companion.companionName,
                                playerId: player.id
                            });
                        }
                    });
                }
            });
            
            if (targets.length === 0) return;
            
            // 랜덤 대상 선택
            const target = targets[Math.floor(Math.random() * targets.length)];
            const damage = Math.floor(monster.attackPower * (0.8 + Math.random() * 0.4)); // ±20% 변동
            
            if (target.type === 'player') {
                // 플레이어에게 데미지 적용
                battleState.playerHp[target.id] = Math.max(0, battleState.playerHp[target.id] - damage);
                
                battleState.battleLog.push(`${monster.name}이(가) ${target.name}에게 공격! ${damage} 데미지!`);
                
                if (battleState.playerHp[target.id] === 0) {
                    battleState.battleLog.push(`${target.name}이(가) 쓰러졌습니다!`);
                }
            } else if (target.type === 'companion') {
                // 동료에게 데미지 적용
                battleState.companionHp[target.id] = Math.max(0, battleState.companionHp[target.id] - damage);
                
                battleState.battleLog.push(`${monster.name}이(가) ${target.name}에게 공격! ${damage} 데미지!`);
                
                if (battleState.companionHp[target.id] === 0) {
                    battleState.battleLog.push(`${target.name}이(가) 쓰러졌습니다!`);
                }
            }
        });
        
        // 소켓으로 몬스터 공격 알림
        if (io) {
            io.emit('expeditionBattleUpdate', {
                type: 'monsterAttack',
                room: this.getRoomForSocket(room)
            });
        }
    }

    // 소켓 전송용 안전한 룸 객체 생성 (순환 참조 제거)
    getRoomForSocket(room) {
        return {
            id: room.id,
            hostId: room.hostId,
            area: room.area,
            players: room.players,
            status: room.status,
            monsters: room.monsters,
            createdAt: room.createdAt,
            maxPlayers: room.maxPlayers,
            battleState: room.battleState,
            playerData: room.playerData,
            startedAt: room.startedAt,
            completedAt: room.completedAt,
            rewards: room.rewards
            // battleInterval은 제외 (순환 참조 방지)
        };
    }

    // 승리 처리
    async handleVictory(room) {
        room.status = 'completed';
        room.completedAt = new Date();
        
        // 전투 인터벌 정리
        if (room.battleInterval) {
            clearInterval(room.battleInterval);
            delete room.battleInterval;
        }
        
        // 보상 계산 (각 플레이어에게 물고기 지급)
        const rewards = this.calculateRewards(room);
        room.rewards = rewards;
        
        // 동료 경험치 지급
        await this.grantCompanionExperience(room);
        
        room.battleState.battleLog.push('🎉 승리! 모든 몬스터를 물리쳤습니다!');
        room.battleState.battleLog.push(`보상: ${rewards.map(r => `${r.fishName} x${r.quantity}`).join(', ')}`);
    }
    
    // 동료 경험치 지급 함수
    async grantCompanionExperience(room) {
        if (!this.CompanionStatsModel) {
            console.warn('[EXPEDITION] CompanionStatsModel이 없어 경험치를 지급할 수 없습니다.');
            return;
        }
        
        // 몬스터 총 체력 기반 경험치 계산
        const totalMonsterHp = room.monsters.reduce((sum, monster) => sum + monster.maxHp, 0);
        const baseExpReward = Math.floor(totalMonsterHp / 10) + 20; // 기본 경험치
        
        console.log(`[EXPEDITION] 승리! 동료들에게 경험치 ${baseExpReward} 지급`);
        
        // 각 플레이어의 동료들에게 경험치 지급
        for (const player of room.players) {
            const playerData = room.playerData?.[player.id];
            if (!playerData?.companions || playerData.companions.length === 0) continue;
            
            for (const companion of playerData.companions) {
                try {
                    // 🔧 DB에서 동료 능력치 조회 (최신 것만)
                    const companionStat = await this.CompanionStatsModel.findOne({
                        userUuid: player.id,
                        companionName: companion.companionName
                    }).sort({ updatedAt: -1 });
                    
                    if (!companionStat) {
                        console.warn(`[EXPEDITION] ${player.name}의 ${companion.companionName} 능력치를 찾을 수 없습니다.`);
                        continue;
                    }
                    
                    // 경험치 추가
                    const oldLevel = companionStat.level;
                    let newExp = companionStat.experience + baseExpReward;
                    let newLevel = companionStat.level;
                    
                    // 레벨업 체크 (레벨당 필요 경험치 공식: 100 + level^2.1 * 25)
                    const calculateExpToNextLevel = (level) => {
                        return Math.floor(100 + Math.pow(level, 2.1) * 25);
                    };
                    
                    let expToNextLevel = calculateExpToNextLevel(newLevel + 1);
                    
                    while (newExp >= expToNextLevel && newLevel < 100) {
                        newExp -= expToNextLevel;
                        newLevel++;
                        expToNextLevel = calculateExpToNextLevel(newLevel + 1);
                        console.log(`[EXPEDITION] 🎉 ${companion.companionName} 레벨업! ${newLevel - 1} → ${newLevel}`);
                    }
                    
                    // DB 업데이트
                    companionStat.level = newLevel;
                    companionStat.experience = newExp;
                    await companionStat.save();
                    
                    console.log(`[EXPEDITION] ✅ ${player.name}의 ${companion.companionName}: 레벨 ${newLevel}, 경험치 ${newExp}/${expToNextLevel}`);
                    
                    // 전투 로그에 추가
                    if (newLevel > oldLevel) {
                        room.battleState.battleLog.push(`🎉 ${companion.companionName}이(가) 레벨업! (Lv.${newLevel})`);
                    }
                    
                } catch (error) {
                    console.error(`[EXPEDITION] ${companion.companionName} 경험치 저장 실패:`, error);
                }
            }
        }
    }

    // 패배 처리
    handleDefeat(room) {
        room.status = 'failed';
        room.completedAt = new Date();
        
        // 전투 인터벌 정리
        if (room.battleInterval) {
            clearInterval(room.battleInterval);
            delete room.battleInterval;
        }
        
        room.battleState.battleLog.push('💀 패배... 모든 플레이어가 쓰러졌습니다.');
    }

    // 보상 계산
    calculateRewards(room) {
        const rewards = [];
        
        // 각 플레이어에게 개별 보상 지급
        room.players.forEach(player => {
        // 처치한 몬스터 기반으로 보상 계산
        room.monsters.forEach(monster => {
            if (!monster.isAlive) {
                // 몬스터의 기본 물고기를 보상으로 지급 (1~3개 랜덤)
                const fishName = monster.baseFish;
                const baseQuantity = Math.floor(Math.random() * 3) + 1; // 1~3개 랜덤
                
                // 접두어에 따른 추가 보상
                let bonusQuantity = 0;
                switch (monster.prefix?.name) {
                    case '변종':
                        bonusQuantity = Math.random() < 0.3 ? 1 : 0; // 30% 확률로 +1
                        break;
                    case '심연의':
                        bonusQuantity = Math.random() < 0.5 ? 2 : 0; // 50% 확률로 +2
                        break;
                    case '깊은어둠의':
                        bonusQuantity = Math.random() < 0.7 ? 3 : 0; // 70% 확률로 +3
                        break;
                }
                
                rewards.push({
                        playerId: player.id,
                        playerName: player.name,
                    fishName: fishName,
                    quantity: baseQuantity + bonusQuantity,
                        prefix: monster.prefix?.name || '거대한',
                        rarity: 'common'
                });
            }
            });
        });
        
        return rewards;
    }

    // 보상 수령 완료 표시
    markRewardsClaimed(userUuid) {
        // 해당 플레이어가 속한 방 찾기
        for (let [roomId, room] of this.expeditionRooms) {
            if (room.players.some(player => player.id === userUuid)) {
                // 해당 플레이어의 보상을 수령 완료로 표시
                if (room.rewards) {
                    const originalCount = room.rewards.length;
                    // 문자열 비교를 확실히 하기 위해 String() 변환
                    room.rewards = room.rewards.filter(reward => String(reward.playerId) !== String(userUuid));
                    const newCount = room.rewards.length;
                    
                    console.log(`[EXPEDITION] markRewardsClaimed: ${userUuid}, removed ${originalCount - newCount} rewards`);
                    
                    // 모든 플레이어가 보상을 수령했는지 확인
                    const remainingRewards = room.rewards.filter(reward => 
                        room.players.some(player => String(player.id) === String(reward.playerId))
                    );
                    
                    // 모든 보상이 수령되었으면 방 상태를 'reward_claimed'로 변경
                    if (remainingRewards.length === 0) {
                        room.status = 'reward_claimed';
                        console.log(`[EXPEDITION] All rewards claimed for room ${roomId}, status changed to reward_claimed`);
                    }
                }
                break;
            }
        }
    }

    // 방 정보 조회
    getRoomInfo(playerId) {
        const roomId = this.playerRooms.get(playerId);
        if (!roomId) return null;

        const room = this.expeditionRooms.get(roomId);
        
        // 보상 수령 완료 상태인 방은 null 반환 (로비로 이동시키기 위해)
        if (room && room.status === 'reward_claimed') {
            return null;
        }
        
        return room;
    }

    // 방 정보 조회 (roomId로)
    getRoomById(roomId) {
        return this.expeditionRooms.get(roomId);
    }
}

module.exports = ExpeditionSystem;
