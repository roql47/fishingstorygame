// 원정 전투 관련 유틸리티 (탐사전투와 동일한 구조)

/**
 * 원정 전투 - 플레이어 공격 처리 (클라이언트 측 즉시 반영)
 */
export const processExpeditionPlayerAttack = ({
  playerId,
  currentRoom,
  socket
}) => {
  // 서버에 공격 요청만 전송 (실제 계산은 서버에서)
  socket.emit('expeditionPlayerAttack', { playerId });
};

/**
 * 원정 전투 - 동료 공격 처리 (클라이언트 측 즉시 반영)
 */
export const processExpeditionCompanionAttack = ({
  playerId,
  companionName,
  currentRoom,
  socket
}) => {
  // 서버에 공격 요청만 전송 (실제 계산은 서버에서)
  socket.emit('expeditionCompanionAttack', { playerId, companionName });
};

/**
 * 원정 전투 - 몬스터 공격 처리 (클라이언트 측 즉시 반영)
 */
export const processExpeditionMonsterAttack = ({
  monsterId,
  currentRoom,
  socket
}) => {
  // 서버에 공격 요청만 전송 (실제 계산은 서버에서)
  socket.emit('expeditionMonsterAttack', { monsterId });
};

