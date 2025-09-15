// server/state.js
function createRoomState(roomId) {
  return {
    roomId,
    players: {},      // playerId → { x, y, isAlive }
    bullets: [],      // { x, y, speed }
    connections: {},  // playerId → ws
  };
}

module.exports = { createRoomState };
