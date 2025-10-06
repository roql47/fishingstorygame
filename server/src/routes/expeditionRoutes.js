const express = require('express');
const ExpeditionSystem = require('../modules/expeditionSystem');

// 원정 라우트 설정 함수
function setupExpeditionRoutes(authenticateJWT, CompanionStatsModel, FishingSkillModel, UserEquipmentModel, EtherKeyModel) {
    const router = express.Router();
    const expeditionSystem = new ExpeditionSystem(EtherKeyModel);

// 원정 지역 목록 조회
router.get('/areas', (req, res) => {
    try {
        const areas = expeditionSystem.getExpeditionAreas();
        res.json({ success: true, areas });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 사용 가능한 방 목록 조회
router.get('/rooms', (req, res) => {
    try {
        const rooms = expeditionSystem.getAvailableRooms();
        res.json({ success: true, rooms });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 방 생성
router.post('/rooms/create', authenticateJWT, async (req, res) => {
    try {
        const { areaId } = req.body;
        const { userUuid, username } = req.user; // JWT에서 사용자 정보 추출
        
        if (!areaId) {
            return res.status(400).json({ 
                success: false, 
                error: '원정 지역을 선택해주세요.' 
            });
        }

        const room = await expeditionSystem.createExpeditionRoom(userUuid, username, areaId);
        
        // 소켓을 통해 방 생성 알림
        if (req.io) {
            req.io.emit('expeditionRoomCreated', room);
        }
        
        res.json({ success: true, room });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// 방 참가
router.post('/rooms/:roomId/join', authenticateJWT, (req, res) => {
    try {
        const { roomId } = req.params;
        const { userUuid, username } = req.user; // JWT에서 사용자 정보 추출

        console.log(`[EXPEDITION] Join attempt - roomId: ${roomId}, user: ${username} (${userUuid})`);
        
        const room = expeditionSystem.joinExpeditionRoom(roomId, userUuid, username);
        
        // 소켓을 통해 방 참가 알림
        if (req.io) {
            console.log(`[EXPEDITION] Broadcasting room update for ${roomId}`);
            console.log(`[EXPEDITION] Room players after join:`, room.players);
            
            // 방 정보를 소켓용으로 변환
            const socketRoom = expeditionSystem.getRoomForSocket(room);
            
            // 모든 클라이언트에게 방 업데이트 알림
            req.io.emit('expeditionRoomUpdated', socketRoom);
            
            // 전체 브로드캐스트로 플레이어 참가 알림
            req.io.emit('expeditionPlayerJoined', { 
                roomId: roomId, 
                player: { id: userUuid, name: username },
                room: socketRoom 
            });
            
            // 전체 방 목록 업데이트
            req.io.emit('expeditionRoomsRefresh');
            
            console.log(`[EXPEDITION] Broadcasted events for room ${roomId} with ${socketRoom.players.length} players`);
        }
        
        res.json({ success: true, room });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// 방 나가기
router.post('/rooms/leave', authenticateJWT, async (req, res) => {
    try {
        const { userUuid } = req.user; // JWT에서 사용자 정보 추출

        const result = await expeditionSystem.leaveExpeditionRoom(userUuid);
        
        // 소켓을 통해 방 업데이트 또는 삭제 알림
        if (req.io) {
            if (result && result.roomDeleted) {
                req.io.emit('expeditionRoomDeleted', { playerId: userUuid });
                req.io.emit('expeditionHostLeft'); // 방장이 나가서 방이 삭제됨을 알림
                req.io.emit('expeditionRoomsRefresh');
            } else if (result && result.room) {
                req.io.emit('expeditionRoomUpdated', result.room);
                req.io.emit('expeditionRoomsRefresh');
            }
        }
        
        res.json({ success: true, result });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// 준비 상태 토글
router.post('/rooms/ready', authenticateJWT, (req, res) => {
    try {
        const { userUuid } = req.user; // JWT에서 사용자 정보 추출

        const room = expeditionSystem.toggleReady(userUuid);
        
        // 소켓을 통해 방 업데이트 알림
        if (req.io) {
            req.io.emit('expeditionRoomUpdated', room);
            req.io.emit('expeditionPlayerReady', { 
                roomId: room.id, 
                playerId: userUuid,
                room: room 
            });
            req.io.emit('expeditionRoomsRefresh');
        }
        
        res.json({ success: true, room });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// 플레이어 강퇴 (방장만 가능)
router.post('/rooms/kick', authenticateJWT, (req, res) => {
    try {
        const { userUuid } = req.user; // JWT에서 방장 정보 추출
        const { targetPlayerId } = req.body;

        if (!targetPlayerId) {
            return res.status(400).json({ 
                success: false, 
                error: '강퇴할 플레이어를 선택해주세요.' 
            });
        }

        const result = expeditionSystem.kickPlayer(userUuid, targetPlayerId);
        
        // 소켓을 통해 강퇴 알림
        if (req.io) {
            // 강퇴당한 플레이어에게 알림
            req.io.emit('expeditionPlayerKicked', { 
                kickedPlayerId: targetPlayerId,
                roomId: result.room.id
            });
            
            // 방 업데이트 알림
            req.io.emit('expeditionRoomUpdated', result.room);
            req.io.emit('expeditionRoomsRefresh');
        }
        
        res.json({ success: true, room: result.room });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// 원정 시작
router.post('/rooms/start', authenticateJWT, async (req, res) => {
    try {
        const { userUuid } = req.user; // JWT에서 사용자 정보 추출
        console.log(`[EXPEDITION] Starting expedition for user: ${userUuid}`);

        // 방의 모든 플레이어 정보 가져오기
        const room = expeditionSystem.expeditionRooms.get(expeditionSystem.playerRooms.get(userUuid));
        if (!room) {
            return res.status(400).json({ success: false, error: '참가한 방이 없습니다.' });
        }

        // 모든 플레이어의 동료, 낚시 실력, 장비 정보 가져오기
        const allPlayerData = {};
        
        // 업적 시스템 인스턴스 가져오기 (index.js에서 정의된 것과 동일)
        const mongoose = require('mongoose');
        const AchievementSystem = require('../modules/achievementSystem').AchievementSystem;
        const achievementSystem = new AchievementSystem(
            mongoose.model('Catch'),
            FishingSkillModel,
            mongoose.model('UserUuid'),
            mongoose.model('RaidDamage'),
            mongoose.model('RareFishCount')
        );
        
        for (const player of room.players) {
            const [companions, fishingSkillData, userEquipment] = await Promise.all([
                CompanionStatsModel.find({ userUuid: player.id, isInBattle: true }).lean(),
                FishingSkillModel.findOne({ userUuid: player.id }).lean(),
                UserEquipmentModel.findOne({ userUuid: player.id }).lean()
            ]);

            // 기본 낚시실력 + 업적 보너스 계산 (내정보 탭과 동일)
            const baseFishingSkill = fishingSkillData?.skill || 1;
            let achievementBonus = 0;
            try {
                achievementBonus = await achievementSystem.calculateAchievementBonus(player.id);
            } catch (error) {
                console.error(`Failed to calculate achievement bonus for ${player.name}:`, error);
            }
            const fishingSkill = baseFishingSkill + achievementBonus;
            // 악세사리 레벨 계산 (내정보 탭과 동일한 방식)
            const getAccessoryLevel = (accessoryName) => {
                if (!accessoryName) return 0;
                const accessories = [
                    '오래된반지', '은목걸이', '금귀걸이', '마법의펜던트', '에메랄드브로치',
                    '토파즈이어링', '자수정팔찌', '백금티아라', '만드라고라허브', '에테르나무묘목',
                    '몽마의조각상', '마카롱훈장', '빛나는마력순환체'
                ];
                const level = accessories.indexOf(accessoryName);
                return level >= 0 ? level + 1 : 0;
            };
            
            const accessoryLevel = getAccessoryLevel(userEquipment?.accessory) || 1;
            
            // 강화 정보도 포함 (내정보 탭과 동일한 능력치를 참조하도록)
            allPlayerData[player.id] = {
                companions: companions,
                fishingSkill: fishingSkill,
                accessoryLevel: accessoryLevel,
                fishingRodEnhancement: userEquipment?.fishingRodEnhancement || 0,
                accessoryEnhancement: userEquipment?.accessoryEnhancement || 0
            };
            
            console.log(`[EXPEDITION] Player ${player.name} data:`, {
                baseFishingSkill: baseFishingSkill,
                achievementBonus: achievementBonus,
                finalFishingSkill: fishingSkill,
                accessoryName: userEquipment?.accessory || 'none',
                accessoryLevel: accessoryLevel,
                companions: companions.length
            });
        }
        
        const finalRoom = expeditionSystem.startExpedition(userUuid, allPlayerData);
        console.log(`[EXPEDITION] Expedition started, room status: ${finalRoom.status}`);
        
        // 턴제 전투 시작 (탐사전투와 동일)
        if (req.io) {
            console.log(`[EXPEDITION] Starting turn-based battle`);
            expeditionSystem.startSpeedBasedBattle(finalRoom, req.io);
        }
        
        // 소켓을 통해 원정 시작 알림
        if (req.io) {
            const safeRoom = expeditionSystem.getRoomForSocket(finalRoom);
            req.io.emit('expeditionStarted', safeRoom);
            req.io.emit('expeditionRoomsRefresh'); // 방 목록에서 시작된 방 제거
        }
        
        res.json({ success: true, room: expeditionSystem.getRoomForSocket(finalRoom) });
    } catch (error) {
        console.error('[EXPEDITION] Start error:', error.message);
        console.error('[EXPEDITION] Full error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// 플레이어 공격 (속도바 기반)
router.post('/attack/player', authenticateJWT, (req, res) => {
    try {
        const { userUuid } = req.user;
        const { targetMonsterId } = req.body;

        const result = expeditionSystem.playerAttack(userUuid, targetMonsterId);
        
        // 전투 종료 체크
        if (req.io) {
            expeditionSystem.checkBattleEnd(result.room, req.io);
        }
        
        // 소켓을 통해 공격 결과 알림
        if (req.io) {
            req.io.emit('expeditionBattleUpdate', {
                type: 'playerAttack',
                room: expeditionSystem.getRoomForSocket(result.room)
            });
        }
        
        res.json({ success: true, result });
    } catch (error) {
        console.error('[EXPEDITION] Player attack error:', error.message);
        res.status(400).json({ success: false, error: error.message });
    }
});

// 동료 공격 (속도바 기반)
router.post('/attack/companion', authenticateJWT, (req, res) => {
    try {
        const { userUuid } = req.user;
        const { companionName, targetMonsterId } = req.body;

        const result = expeditionSystem.companionAttackSpeedBased(userUuid, companionName, targetMonsterId);
        
        // 전투 종료 체크
        if (req.io) {
            expeditionSystem.checkBattleEnd(result.room, req.io);
        }
        
        // 소켓을 통해 공격 결과 알림
        if (req.io) {
            req.io.emit('expeditionBattleUpdate', {
                type: 'companionAttack',
                room: expeditionSystem.getRoomForSocket(result.room)
            });
        }
        
        res.json({ success: true, result });
    } catch (error) {
        console.error('[EXPEDITION] Companion attack error:', error.message);
        res.status(400).json({ success: false, error: error.message });
    }
});

// 몬스터 공격 (속도바 기반)
router.post('/attack/monster', authenticateJWT, (req, res) => {
    try {
        const { monsterId } = req.body;

        const result = expeditionSystem.monsterAttackSpeedBased(monsterId);
        
        // 전투 종료 체크
        if (req.io) {
            expeditionSystem.checkBattleEnd(result.room, req.io);
        }
        
        // 소켓을 통해 공격 결과 알림
        if (req.io) {
            req.io.emit('expeditionBattleUpdate', {
                type: 'monsterAttack',
                room: expeditionSystem.getRoomForSocket(result.room)
            });
        }
        
        res.json({ success: true, result });
    } catch (error) {
        console.error('[EXPEDITION] Monster attack error:', error.message);
        res.status(400).json({ success: false, error: error.message });
    }
});

// 기존 플레이어 공격 API (하위 호환성)
router.post('/attack', authenticateJWT, (req, res) => {
    try {
        const { userUuid } = req.user;
        const { targetMonsterId } = req.body;

        const result = expeditionSystem.playerAttack(userUuid, targetMonsterId);
        
        if (req.io) {
            expeditionSystem.checkBattleEnd(result.room, req.io);
            req.io.emit('expeditionBattleUpdate', {
                type: 'playerAttack',
                room: expeditionSystem.getRoomForSocket(result.room)
            });
        }
        
        res.json({ success: true, result });
    } catch (error) {
        console.error('[EXPEDITION] Attack error:', error.message);
        res.status(400).json({ success: false, error: error.message });
    }
});

// 다음 턴 진행
router.post('/next-turn', authenticateJWT, (req, res) => {
    try {
        const { userUuid } = req.user;

        const roomId = expeditionSystem.playerRooms.get(userUuid);
        if (!roomId) {
            return res.status(400).json({ success: false, error: '참가한 방이 없습니다.' });
        }

        const room = expeditionSystem.expeditionRooms.get(roomId);
        if (!room || room.status !== 'in_progress') {
            return res.status(400).json({ success: false, error: '진행 중인 원정이 없습니다.' });
        }

        // 다음 턴으로 진행
        expeditionSystem.nextTurn(room, req.io);
        
        res.json({ success: true });
    } catch (error) {
        console.error('[EXPEDITION] Next turn error:', error.message);
        res.status(400).json({ success: false, error: error.message });
    }
});

// 보상 수령
router.post('/claim-rewards', authenticateJWT, async (req, res) => {
    try {
        const { userUuid, username } = req.user; // JWT에서 사용자 정보 추출

        const room = expeditionSystem.getRoomInfo(userUuid);
        if (!room || room.status !== 'completed' || !room.rewards) {
            return res.status(400).json({ 
                success: false, 
                error: '수령할 보상이 없습니다.' 
            });
        }

        // 플레이어의 보상 찾기
        const playerRewards = room.rewards.filter(reward => reward.playerId === userUuid);
        if (playerRewards.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: '수령할 보상이 없습니다.' 
            });
        }

        // 인벤토리에 물고기 추가 - index.js에서 정의된 모델 사용
        const mongoose = require('mongoose');
        const CatchModel = mongoose.model('Catch');
        const FishDiscoveryModel = mongoose.model('FishDiscovery');
        
        for (const reward of playerRewards) {
            // 물고기 발견 기록 저장 (중복 방지)
            try {
                await FishDiscoveryModel.create({
                    userUuid: userUuid,
                    username: username,
                    fishName: reward.fishName
                });
                console.log(`🎣 New fish discovered from expedition: ${reward.fishName} by ${username}`);
            } catch (error) {
                // 이미 발견한 물고기인 경우 무시 (unique index 에러)
                if (error.code !== 11000) {
                    console.error("Failed to save fish discovery from expedition:", error);
                }
            }
            
            // CatchModel 스키마에 맞게 각 물고기를 개별적으로 추가
            for (let i = 0; i < reward.quantity; i++) {
                const newCatch = new CatchModel({
                    userUuid: userUuid,
                    username: username,
                    fish: reward.fishName, // String 타입
                    weight: Math.floor(Math.random() * 100) + 50, // 50-149 랜덤 무게
                    probability: 1.0 // 기본 확률
                });
                await newCatch.save();
            }
        }

        // 보상 수령 완료 표시
        console.log(`[EXPEDITION] Before markRewardsClaimed - Room rewards count: ${room.rewards?.length}`);
        expeditionSystem.markRewardsClaimed(userUuid);
        
        // 보상 제거 후 상태 확인
        const roomAfterClaim = expeditionSystem.getRoomInfo(userUuid);
        console.log(`[EXPEDITION] After markRewardsClaimed - Room rewards count: ${roomAfterClaim?.rewards?.length}`);
        console.log(`[EXPEDITION] Remaining rewards:`, roomAfterClaim?.rewards?.map(r => `${r.playerId}: ${r.fishName}`));
        
        // 🚀 소켓을 통해 해당 플레이어에게 인벤토리 업데이트 알림
        if (req.io) {
            console.log(`🔄 Sending inventory update notification to ${username} (${userUuid})`);
            req.io.emit('inventoryUpdated', { 
                userUuid: userUuid,
                reason: 'expedition_rewards',
                rewards: playerRewards 
            });
        }
        
        // 보상 수령 후 방 상태 확인 (즉시 나가지 않음)
        const updatedRoom = expeditionSystem.getRoomInfo(userUuid);
        if (updatedRoom) {
            // 모든 보상이 수령되었는지 확인
            const remainingRewards = updatedRoom.rewards ? updatedRoom.rewards.filter(reward => 
                updatedRoom.players.some(player => player.id === reward.playerId)
            ) : [];
            
            console.log(`[EXPEDITION] Remaining rewards after ${username} claimed: ${remainingRewards.length}`);
            
            // 모든 보상이 수령되었으면 방 정리
            if (remainingRewards.length === 0) {
                console.log(`[EXPEDITION] All rewards claimed, cleaning up room for ${username}`);
                const leaveResult = await expeditionSystem.leaveExpeditionRoom(userUuid);
                
                // 소켓을 통해 방 업데이트 또는 삭제 알림
                if (req.io) {
                    if (leaveResult && leaveResult.roomDeleted) {
                        req.io.emit('expeditionRoomDeleted', { playerId: userUuid });
                        req.io.emit('expeditionRoomsRefresh');
                    } else if (leaveResult && leaveResult.room) {
                        req.io.emit('expeditionRoomUpdated', leaveResult.room);
                        req.io.emit('expeditionRoomsRefresh');
                    }
                }
            } else {
                // 아직 보상을 받지 않은 플레이어가 있으면 방 상태만 업데이트
                if (req.io) {
                    req.io.emit('expeditionRoomUpdated', updatedRoom);
                    req.io.emit('expeditionRoomsRefresh');
                }
            }
        }

        res.json({ 
            success: true, 
            rewards: playerRewards,
            message: '보상을 수령했습니다!' 
        });
    } catch (error) {
        console.error('보상 수령 오류:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// 현재 방 정보 조회
router.get('/rooms/current', authenticateJWT, (req, res) => {
    try {
        const { userUuid } = req.user; // JWT에서 사용자 정보 추출
        console.log(`[EXPEDITION] Getting current room for user: ${userUuid}`);
        
        const room = expeditionSystem.getRoomInfo(userUuid);
        
        if (room) {
            console.log(`[EXPEDITION] Found room for user ${userUuid}: ${room.id}, status: ${room.status}`);
            res.json({ success: true, room: expeditionSystem.getRoomForSocket(room) });
        } else {
            console.log(`[EXPEDITION] No room found for user: ${userUuid}`);
            res.json({ success: true, room: null });
        }
    } catch (error) {
        console.error('[EXPEDITION] Get current room error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 특정 방 정보 조회
router.get('/rooms/:roomId', (req, res) => {
    try {
        const { roomId } = req.params;
        const room = expeditionSystem.getRoomById(roomId);
        
        if (!room) {
            return res.status(404).json({ 
                success: false, 
                error: '방을 찾을 수 없습니다.' 
            });
        }
        
        res.json({ success: true, room });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

    return router;
}

module.exports = setupExpeditionRoutes;
