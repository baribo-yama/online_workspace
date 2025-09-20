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
  // CORS設定
  verifyClient: (info) => {
    const origin = info.origin;
    console.log(`接続試行 - Origin: ${origin}`);
    
    // 本番環境での許可するオリジン
    const allowedOrigins = [
      'https://online-workspace-1c2a4.web.app',
      'https://online-workspace-1c2a4.firebaseapp.com',
      'http://localhost:5173',
      'http://localhost:4173'
    ];
    
    // 開発環境では全て許可
    if (process.env.NODE_ENV === 'development') {
      return true;
    }
    
    // 本番環境では指定したオリジンのみ許可
    return allowedOrigins.includes(origin);
  }
});

const rooms = {}; // roomIdごとの状態を保持

console.log(`WebSocketサーバーがポート${PORT}で起動しました`);
console.log(`Node環境: ${process.env.NODE_ENV || 'development'}`);
console.log(`プロセスID: ${process.pid}`);

wss.on("connection", (ws) => {
  // 接続ログは削除（冗長なため）

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

// ゲームループ開始
setInterval(() => {
  Object.values(rooms).forEach((room) => handleGameLoop(room));
}, 200); // 200msごとに更新（軽量化）

// 事前に用意した障害物データ（軽量版）
const PREDEFINED_OBSTACLES = [
  {
    color: "#ff6b6b",
    emoji: "😀",
    name: "赤い笑顔"
  },
  {
    color: "#4ecdc4",
    emoji: "😎",
    name: "青緑のサングラス"
  },
  {
    color: "#45b7d1",
    emoji: "🤔",
    name: "青い考え中"
  },
  {
    color: "#96ceb4",
    emoji: "😊",
    name: "緑の微笑み"
  },
  {
    color: "#feca57",
    emoji: "😄",
    name: "黄色の大笑い"
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
    emoji: selectedObstacle.emoji,
    name: selectedObstacle.name,
    x: 100,
    y: 100,
    vx: 3,
    vy: 3,
    width: 60,
    height: 60
  };

  // 全プレイヤーにゲーム開始を通知
  Object.values(room.connections).forEach((ws) => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: "faceGameStart",
        obstacle: room.obstacle,
        gameTime: 5 * 60 * 1000 // 5分
      }));
    }
  });
}

// 最後の起動メッセージは削除
