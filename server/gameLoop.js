// server/gameLoop.js
function handleGameLoop(room) {
  // 顔障害物ゲームの場合のみ処理
  if (room.obstacle) {
    handleFaceObstacleGame(room);
  }
}

function handleFaceObstacleGame(room) {
  let stateChanged = false;

  // 障害物の動きを更新
  if (room.obstacle) {
    const oldX = room.obstacle.x;
    const oldY = room.obstacle.y;

    room.obstacle.x += room.obstacle.vx;
    room.obstacle.y += room.obstacle.vy;

    console.log(`障害物位置更新: (${room.obstacle.x}, ${room.obstacle.y})`);

    // 壁に当たったら反射
    if (room.obstacle.x <= 0 || room.obstacle.x + room.obstacle.width >= 500) {
      room.obstacle.vx = -room.obstacle.vx;
      stateChanged = true;
    }
    if (room.obstacle.y <= 0 || room.obstacle.y + room.obstacle.height >= 500) {
      room.obstacle.vy = -room.obstacle.vy;
      stateChanged = true;
    }

    // 境界内に制限
    room.obstacle.x = Math.max(0, Math.min(500 - room.obstacle.width, room.obstacle.x));
    room.obstacle.y = Math.max(0, Math.min(500 - room.obstacle.height, room.obstacle.y));

    // 位置が変更されたかチェック
    if (oldX !== room.obstacle.x || oldY !== room.obstacle.y) {
      stateChanged = true;
    }
  }

  // プレイヤーと障害物の衝突判定
  Object.entries(room.players).forEach(([playerId, player]) => {
    if (!player.isAlive || !room.obstacle) return;

    if (isColliding(player, room.obstacle)) {
      player.isAlive = false;
      stateChanged = true;
      console.log(`💥 ${playerId} が障害物に当たりました!`);
    }
  });

  // 状態が変更された場合のみ送信
  if (stateChanged) {
    console.log("状態変更検出 - 送信中");
    broadcast(room);
  }
}


// 矩形衝突判定
function isColliding(player, target) {
  const playerSize = 20;
  const targetWidth = target.width || target.size || 10;
  const targetHeight = target.height || target.size || 10;

  return !(
    target.x > player.x + playerSize || // 右に外れてる
    target.x + targetWidth < player.x || // 左に外れてる
    target.y > player.y + playerSize || // 下に外れてる
    target.y + targetHeight < player.y    // 上に外れてる
  );
}

function broadcast(room) {
  // 描画に必要なデータを送信
  const state = {
    type: "stateUpdate",
    players: room.players,
    obstacle: room.obstacle ? {
      x: room.obstacle.x,
      y: room.obstacle.y,
      vx: room.obstacle.vx,
      vy: room.obstacle.vy,
      width: room.obstacle.width,
      height: room.obstacle.height,
      color: room.obstacle.color,
      emoji: room.obstacle.emoji,
      name: room.obstacle.name
    } : null,
  };

  console.log("送信データ:", JSON.stringify(state, null, 2));
  const stateString = JSON.stringify(state);

  Object.values(room.connections).forEach((ws) => {
    if (ws.readyState === 1) {
      ws.send(stateString);
    }
  });
}

module.exports = { handleGameLoop };
