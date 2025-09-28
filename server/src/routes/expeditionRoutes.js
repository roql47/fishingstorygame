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
        for (const player of room.players) {
            const [companions, fishingSkillData, userEquipment] = await Promise.all([
                CompanionStatsModel.find({ userUuid: player.id, isInBattle: true }).lean(),
                FishingSkillModel.findOne({ userUuid: player.id }).lean(),
                UserEquipmentModel.findOne({ userUuid: player.id }).lean()
            ]);

            const fishingSkill = fishingSkillData?.skill || 1;
            const accessoryLevel = userEquipment?.accessory ? 
                (parseInt(userEquipment.accessory.match(/\d+/)?.[0]) || 0) + 1 : 1;
            
            allPlayerData[player.id] = {
                companions: companions,
                fishingSkill: fishingSkill,
                accessoryLevel: accessoryLevel
            };
            
            console.log(`[EXPEDITION] Player ${player.name} data:`, {
                fishingSkill: fishingSkill,
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

// 플레이어 공격
router.post('/attack', authenticateJWT, (req, res) => {
    try {
        const { userUuid } = req.user;
        const { targetMonsterId } = req.body;

        const result = expeditionSystem.playerAttack(userUuid, targetMonsterId);
        
        // 소켓을 통해 공격 결과 알림
        if (req.io) {
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
        
        for (const reward of playerRewards) {
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
        expeditionSystem.markRewardsClaimed(userUuid);

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
