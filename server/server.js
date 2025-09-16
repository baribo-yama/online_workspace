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
}, 100); // 100msごとに更新

console.log("WebSocket サーバー起動: ws://localhost:8080");
