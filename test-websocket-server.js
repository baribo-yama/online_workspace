// WebSocketサーバー（テスト用）
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

// ゲーム状態
const gameState = {
  rooms: {}
};

wss.on('connection', (ws) => {
  console.log('新しいクライアントが接続しました');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('受信:', data);

      switch (data.type) {
        case 'join':
          handleJoin(ws, data);
          break;
        case 'move':
          handleMove(ws, data);
          break;
        default:
          console.log('不明なメッセージタイプ:', data.type);
      }
    } catch (error) {
      console.error('メッセージ解析エラー:', error);
    }
  });

  ws.on('close', () => {
    console.log('クライアントが切断しました');
  });
});

function handleJoin(ws, data) {
  const { roomId, playerId } = data;

  // 部屋が存在しない場合は作成
  if (!gameState.rooms[roomId]) {
    gameState.rooms[roomId] = {
      players: {},
      bullets: []
    };
  }

  // プレイヤーを追加
  gameState.rooms[roomId].players[playerId] = {
    id: playerId,
    x: 200,
    y: 400,
    isAlive: true,
    ws: ws
  };

  // クライアントに現在の状態を送信
  broadcastToRoom(roomId);
}

function handleMove(ws, data) {
  const { roomId, playerId, x } = data;

  if (gameState.rooms[roomId] && gameState.rooms[roomId].players[playerId]) {
    gameState.rooms[roomId].players[playerId].x = x;
    broadcastToRoom(roomId);
  }
}

function broadcastToRoom(roomId) {
  if (!gameState.rooms[roomId]) return;

  const room = gameState.rooms[roomId];
  const stateUpdate = {
    type: 'stateUpdate',
    players: {},
    bullets: room.bullets
  };

  // WebSocket参照を除いてプレイヤー情報をコピー
  Object.keys(room.players).forEach(playerId => {
    const player = room.players[playerId];
    stateUpdate.players[playerId] = {
      id: player.id,
      x: player.x,
      y: player.y,
      isAlive: player.isAlive
    };
  });

  // 部屋内の全プレイヤーに送信
  Object.values(room.players).forEach(player => {
    if (player.ws && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(JSON.stringify(stateUpdate));
    }
  });
}

console.log('WebSocketサーバーがポート8080で起動しました');
