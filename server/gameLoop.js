// server/gameLoop.js
function handleGameLoop(room) {
  // 一定確率で弾を生成
  if (Math.random() < 0.2) {
    const x = Math.floor(Math.random() * 480);
    room.bullets.push({ x, y: 0, speed: 5, size: 10 });
  }

  // 弾を下に落とす
  room.bullets.forEach((b) => (b.y += b.speed));

  // 衝突判定
  Object.entries(room.players).forEach(([playerId, player]) => {
    if (!player.isAlive) return; // 既に死んでいたらスキップ

    room.bullets.forEach((bullet) => {
      if (isColliding(player, bullet)) {
        player.isAlive = false; // 当たったら死亡
        console.log(`💥 ${playerId} hit!`);
      }
    });
  });

  // 画面外の弾を削除
  room.bullets = room.bullets.filter((b) => b.y < 500);

  // 状態を送信
  broadcast(room);
}

// 矩形衝突判定
function isColliding(player, bullet) {
  const playerSize = 20;
  return !(
    bullet.x > player.x + playerSize || // 右に外れてる
    bullet.x + bullet.size < player.x || // 左に外れてる
    bullet.y > player.y + playerSize || // 下に外れてる
    bullet.y + bullet.size < player.y    // 上に外れてる
  );
}

function broadcast(room) {
  const state = {
    type: "stateUpdate",
    roomId: room.roomId,
    players: room.players,
    bullets: room.bullets,
  };

  Object.values(room.connections).forEach((ws) => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(state));
    }
  });
}

module.exports = { handleGameLoop };
