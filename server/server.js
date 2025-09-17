// server/server.js
const WebSocket = require("ws");
const { handleGameLoop } = require("./gameLoop");
const { createRoomState } = require("./state");
const { addPlayer, removePlayer, movePlayer } = require("./playerManager");

const wss = new WebSocket.Server({ port: 8080 });
const rooms = {}; // roomIdごとの状態を保持

wss.on("connection", (ws) => {
  console.log("クライアント接続");

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
    console.log("クライアント切断");
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
  console.log(`顔障害物ゲーム開始要求: ${roomId}`);
  const room = rooms[roomId];

  console.log(`部屋状態: ${room ? '存在' : '不存在'}`);

  if (!room) {
    console.log("部屋が存在しません");
    return;
  }

  // 事前に用意した障害物からランダムで選択
  const selectedObstacle = PREDEFINED_OBSTACLES[Math.floor(Math.random() * PREDEFINED_OBSTACLES.length)];
  console.log(`選択された障害物: ${selectedObstacle.name}`);

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

  console.log(`障害物初期化完了: 位置(${room.obstacle.x}, ${room.obstacle.y})`);

  // 全プレイヤーにゲーム開始を通知
  Object.values(room.connections).forEach((ws) => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: "faceGameStart",
        obstacle: room.obstacle,
        gameTime: 5 * 60 * 1000 // 5分
      }));
      console.log("ゲーム開始通知を送信");
    }
  });
}

console.log("WebSocket サーバー起動: ws://localhost:8080");
