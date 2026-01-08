// server/server.js
const WebSocket = require("ws");
const { handleGameLoop } = require("./gameLoop");
const { createRoomState } = require("./state");
const { addPlayer, removePlayer, movePlayer } = require("./playerManager");

const PORT = process.env.PORT || 8080;
console.log(`環境変数 PORT: ${process.env.PORT}`);
console.log(`使用するポート: ${PORT}`);

// WebSocketサーバー設定（本番環境対応）
const wss = new WebSocket.Server({
  port: PORT,
  perMessageDeflate: false,
});

const rooms = {}; // roomIdごとの状態を保持

// サーバー起動時のログ
console.log(`✅ WebSocketサーバーがポート${PORT}で正常に起動しました`);
console.log(`   - Node.js環境: ${process.env.NODE_ENV || 'development'}`);
console.log(`   - プロセスID: ${process.pid}`);
console.log(`   - 起動時刻: ${new Date().toISOString()}`);
if (process.env.NODE_ENV === 'production') {
  console.log(`   - 本番環境モード`);
} else {
  console.log(`   - サーバーURL: ws://localhost:${PORT}`);
}

// 接続維持のためのPing/Pong
function heartbeat() {
  this.isAlive = true;
}

wss.on("connection", (ws, req) => {
  // オリジンチェック
  const origin = req.headers.origin;
  const userAgent = req.headers['user-agent'];
  const timestamp = new Date().toISOString();

  console.log(`🔌 新しい接続試行 - Origin: ${origin}`);
  console.log(`   - User-Agent: ${userAgent}`);
  console.log(`   - 接続時刻: ${timestamp}`);

  const allowedOrigins = [
    'https://online-workspace-1c2a4.web.app',
    'https://online-workspace-1c2a4.firebaseapp.com',
    'http://localhost:5173',
    'http://localhost:4173',
    'http://localhost:5175'
  ];

  if (process.env.NODE_ENV !== 'development' && !allowedOrigins.includes(origin)) {
    console.log(`❌ 許可されていないオリジンからの接続を拒否: ${origin}`);
    ws.terminate();
    return;
  }
  console.log(`✅ 許可されたオリジンからの接続: ${origin}`);

  // 接続維持
  ws.isAlive = true;
  ws.on('pong', heartbeat);

  ws.on("message", (message) => {
    const data = JSON.parse(message.toString());
    const { type, roomId, playerId, direction } = data;

    // 部屋がなければ作成
    if (!rooms[roomId]) {
      rooms[roomId] = createRoomState(roomId);
    }
    const room = rooms[roomId];

    switch (type) {
      case "join":
        addPlayer(room, playerId, ws);
        break;
      case "move":
        movePlayer(room, playerId, direction);
        break;
      case "startFaceGame":
        // 顔障害物ゲーム開始
        startFaceGame(roomId);
        break;
    }
  });

  ws.on("close", () => {
    // 切断ログは削除（冗長なため）
    // プレイヤー削除処理
    Object.values(rooms).forEach(room => {
      Object.entries(room.connections).forEach(([playerId, connection]) => {
        if (connection === ws) {
          removePlayer(room, playerId);
        }
      });
    });
  });
});

// 定期的な接続確認
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log("💔 Pingタイムアウト。接続を終了します。");
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping(() => {});
  });
}, 30000); // 30秒ごと

wss.on('close', () => {
  clearInterval(interval);
});

// ゲームループ開始
setInterval(() => {
  Object.values(rooms).forEach((room) => handleGameLoop(room));
}, 200); // 200msごとに更新（軽量化）

// 事前に用意した障害物データ（クライアント側と同期）
const PREDEFINED_OBSTACLES = [
  {
    color: "#ff6b6b",
    name: "おじさん1",
    imageUrl: "/images/obstacles/ojisan_32x32.png"
  },
  {
    color: "#4ecdc4",
    name: "おじさん2",
    imageUrl: "/images/obstacles/ojisan_32x32.png"
  },
  {
    color: "#45b7d1",
    name: "おじさん3",
    imageUrl: "/images/obstacles/ojisan_32x32.png"
  }
];

// 顔障害物ゲーム開始
function startFaceGame(roomId) {
  console.log(`🎯 ゲーム開始: 部屋${roomId}`);
  const room = rooms[roomId];

  if (!room) {
    console.log("❌ 部屋が存在しません");
    return;
  }

  // 事前に用意した障害物からランダムで選択
  const selectedObstacle = PREDEFINED_OBSTACLES[Math.floor(Math.random() * PREDEFINED_OBSTACLES.length)];
  console.log(`🎮 障害物生成: ${selectedObstacle.name}`);

  // 障害物を初期化
  room.obstacle = {
    color: selectedObstacle.color,
    name: selectedObstacle.name,
    imageUrl: selectedObstacle.imageUrl,
    x: 100,
    y: 100,
    vx: 3,
    vy: 3,
    width: 60,
    height: 60
  };

  // 全プレイヤーにゲーム開始を通知
  Object.values(room.connections).forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({
          type: "faceGameStart",
          obstacle: room.obstacle,
          gameTime: 5 * 60 * 1000 // 5分
        }));
      } catch (error) {
        console.error("❌ ゲーム開始メッセージ送信エラー:", error);
      }
    }
  });
}

// 最後の起動メッセージは削除
