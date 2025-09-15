// src/entertainment/hooks/useShootingGame.js
import { useEffect, useRef, useState, useCallback } from "react";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../shared/services/firebase";

export function useShootingGame(roomId, userName) {
  const wsRef = useRef(null);
  const [players, setPlayers] = useState({});
  const [bullets, setBullets] = useState([]);
  const [gameStatus, setGameStatus] = useState("idle");
  const [playerId, setPlayerId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // プレイヤーID生成（ランダム）
  useEffect(() => {
    const generatedId = `${userName}_${Math.random().toString(36).substr(2, 9)}`;
    setPlayerId(generatedId);
  }, [userName]);

  // Firestoreのゲーム状態とタイマー状態を監視
  useEffect(() => {
    if (!roomId) return;

    const roomRef = doc(db, "rooms", roomId);
    const unsubscribe = onSnapshot(roomRef, (doc) => {
      if (doc.exists()) {
        const roomData = doc.data();
        const currentStatus = roomData.game?.status || "idle";
        const timerMode = roomData.timer?.mode || "work";

        setGameStatus(currentStatus);

        // 作業時間に戻ったらゲームを自動終了（ホストのみ）
        if (timerMode === "work" && currentStatus === "playing") {
          console.log("作業時間開始 - ゲームを自動終了");
          // ホストのみがゲームを終了できる
          const roomRef = doc(db, "rooms", roomId);
          updateDoc(roomRef, {
            game: {
              status: "idle",
              startTime: null,
              endTime: serverTimestamp(),
              lastUpdated: serverTimestamp()
            }
          }).catch(error => {
            console.error("ゲーム自動終了エラー:", error);
          });
        }

        console.log("ゲーム状態更新:", currentStatus, "タイマーモード:", timerMode);
      }
    });

    return () => unsubscribe();
  }, [roomId]);

  // WebSocket接続/切断の管理
  useEffect(() => {
    console.log("WebSocket接続管理:", { gameStatus, playerId, isConnected });

    if (gameStatus === "playing" && playerId && !isConnected) {
      console.log("WebSocket接続開始");
      connectWebSocket();
    } else if (gameStatus === "idle" && isConnected) {
      console.log("WebSocket接続終了");
      disconnectWebSocket();
    }
  }, [gameStatus, playerId, isConnected]);

  const connectWebSocket = () => {
    if (wsRef.current) return;

    // Use environment variable for WebSocket URL, fallback to localhost
    const wsUrl = import.meta.env.VITE_WEBSOCKET_URL || "ws://localhost:8080";
    console.log("WebSocket接続先:", wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket 接続成功");
      setIsConnected(true);
      // サーバーに参加通知
      ws.send(
        JSON.stringify({ type: "join", roomId, playerId })
      );
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "stateUpdate") {
        setPlayers(data.players);
        setBullets(data.bullets);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket 接続終了");
      setIsConnected(false);
      wsRef.current = null;
    };

    ws.onerror = (error) => {
      console.error("WebSocket エラー:", error);
      setIsConnected(false);
    };
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setIsConnected(false);
    }
  };

  // プレイヤー移動（速度ベース）
  const move = useCallback((direction) => {
    if (wsRef.current && wsRef.current.readyState === 1 && isConnected) {
      wsRef.current.send(
        JSON.stringify({ type: "move", roomId, playerId, direction })
      );
    }
  }, [roomId, playerId, isConnected]);

  // ゲーム開始
  const startGame = async () => {
    if (!roomId) return;

    try {
      const roomRef = doc(db, "rooms", roomId);
      await updateDoc(roomRef, {
        game: {
          status: "playing",
          startTime: serverTimestamp(),
          endTime: null,
          lastUpdated: serverTimestamp()
        }
      });
      console.log("ゲーム開始");
    } catch (error) {
      console.error("ゲーム開始エラー:", error);
    }
  };

  // ゲーム終了
  const endGame = async () => {
    if (!roomId) return;

    try {
      const roomRef = doc(db, "rooms", roomId);
      await updateDoc(roomRef, {
        game: {
          status: "idle",
          startTime: null,
          endTime: serverTimestamp(),
          lastUpdated: serverTimestamp()
        }
      });
      console.log("ゲーム終了");
    } catch (error) {
      console.error("ゲーム終了エラー:", error);
    }
  };

  // クリーンアップ
  useEffect(() => {
    return () => {
      disconnectWebSocket();
    };
  }, []);

  return {
    players,
    bullets,
    move,
    gameStatus,
    playerId,
    isConnected,
    startGame,
    endGame
  };
}
