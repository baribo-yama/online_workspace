// server/playerManager.js
function addPlayer(room, playerId, ws) {
  // ランダムな初期位置を設定
  const x = Math.random() * 460 + 20; // 20-480の範囲
  const y = Math.random() * 460 + 20; // 20-480の範囲

  room.players[playerId] = {
    x: x,
    y: y,
    isAlive: true,
    velocity: 0,
    lastMove: Date.now()
  };
  room.connections[playerId] = ws;
  console.log(`👤 プレイヤー参加: ${playerId}`);
}

function removePlayer(room, playerId) {
  delete room.players[playerId];
  delete room.connections[playerId];
  console.log(`👋 プレイヤー退出: ${playerId}`);
}

function movePlayer(room, playerId, direction) {
  if (room.players[playerId] && room.players[playerId].isAlive) {
    const player = room.players[playerId];
    const moveSpeed = 3; // 移動速度

    // 従来の左右移動
    if (direction === "left") {
      player.x = Math.max(0, player.x - moveSpeed);
    } else if (direction === "right") {
      player.x = Math.min(480, player.x + moveSpeed);
    }

    // WASD移動（顔障害物ゲーム用）
    if (direction === "up") {
      player.y = Math.max(0, player.y - moveSpeed);
    } else if (direction === "down") {
      player.y = Math.min(480, player.y + moveSpeed);
    } else if (direction === "left") {
      player.x = Math.max(0, player.x - moveSpeed);
    } else if (direction === "right") {
      player.x = Math.min(480, player.x + moveSpeed);
    }

    player.lastMove = Date.now();
  }
}

module.exports = { addPlayer, removePlayer, movePlayer };
