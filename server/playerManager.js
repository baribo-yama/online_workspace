// server/playerManager.js
function addPlayer(room, playerId, ws) {
  room.players[playerId] = {
    x: 200,
    y: 400,
    isAlive: true,
    velocity: 0,
    lastMove: Date.now()
  };
  room.connections[playerId] = ws;
  console.log(`プレイヤー参加: ${playerId}`);
}

function removePlayer(room, playerId) {
  delete room.players[playerId];
  delete room.connections[playerId];
  console.log(`プレイヤー退出: ${playerId}`);
}

function movePlayer(room, playerId, direction) {
  if (room.players[playerId] && room.players[playerId].isAlive) {
    const player = room.players[playerId];
    const moveSpeed = 3; // 移動速度

    if (direction === "left") {
      player.x = Math.max(0, player.x - moveSpeed);
    } else if (direction === "right") {
      player.x = Math.min(480, player.x + moveSpeed);
    }

    player.lastMove = Date.now();
  }
}

module.exports = { addPlayer, removePlayer, movePlayer };
