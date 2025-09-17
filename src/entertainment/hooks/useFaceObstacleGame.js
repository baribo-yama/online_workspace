// src/entertainment/hooks/useFaceObstacleGame.js
import { useEffect, useRef, useState, useCallback } from "react";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../shared/services/firebase";
import { getWebSocketUrl, validateWebSocketUrl } from "../../shared/config/websocket";

export function useFaceObstacleGame(roomId, userName) {
  const wsRef = useRef(null);
  const [players, setPlayers] = useState({});
  const [obstacle, setObstacle] = useState(null);
  const [gameStatus, setGameStatus] = useState("idle");
  const [playerId, setPlayerId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [gameTime, setGameTime] = useState(0);
  const [remainingPlayers, setRemainingPlayers] = useState(0);

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

        // 作業時間に戻ったらゲームを自動終了
        if (timerMode === "work" && currentStatus === "playing") {
          endGame();
        }
      }
    });

    return () => unsubscribe();
  }, [roomId]);

  // WebSocket接続/切断の管理
  useEffect(() => {

    if (gameStatus === "playing" && playerId && !isConnected) {
      connectWebSocket();
    } else if (gameStatus === "idle" && isConnected) {
      disconnectWebSocket();
    }
  }, [gameStatus, playerId, isConnected]);

  // 手動でWebSocket接続を確立する関数
  const ensureWebSocketConnection = async () => {
    console.log("🔄 WebSocket接続確認開始...");

    if (isConnected && wsRef.current && wsRef.current.readyState === 1) {
      console.log("✅ WebSocket既に接続済み");
      return;
    }

    console.log("🔗 新しいWebSocket接続を開始...");
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error("❌ WebSocket接続タイムアウト");
        reject(new Error("WebSocket接続タイムアウト"));
      }, 10000); // 10秒でタイムアウト

      const checkConnection = () => {
        if (wsRef.current && wsRef.current.readyState === 1) {
          console.log("✅ WebSocket接続完了");
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkConnection, 100); // 100msごとにチェック
        }
      };

      connectWebSocket();
      checkConnection();
    });
  };

  const connectWebSocket = () => {
    console.log("🔗 WebSocket接続処理開始...");

    if (wsRef.current && wsRef.current.readyState === 1) {
      console.log("⏭️ 既存の有効な接続があります");
      return;
    }

    // 既存の接続を閉じる
    if (wsRef.current) {
      console.log("🔄 既存の接続をクリーンアップ...");
      wsRef.current.close();
      wsRef.current = null;
    }

    // 環境変数からWebSocket URLを取得
    const wsUrl = getWebSocketUrl();
    console.log("🌐 WebSocket URL:", wsUrl);

    let ws;
    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      console.log("🚀 WebSocket作成完了、接続開始...");
    } catch (error) {
      console.error("❌ WebSocket作成エラー:", error);
      setIsConnected(false);
      return;
    }

    ws.onopen = () => {
      console.log("✅ WebSocket接続成功!");
      setIsConnected(true);
      // サーバーに参加通知
      const joinMessage = { type: "join", roomId, playerId };
      console.log("📤 参加メッセージ送信:", joinMessage);
      ws.send(JSON.stringify(joinMessage));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("🎮 WebSocketメッセージ受信:", data);

      if (data.type === "stateUpdate") {
        console.log("🔄 ゲーム状態更新:", {
          プレイヤー数: Object.keys(data.players).length,
          障害物: data.obstacle ? "あり" : "なし"
        });
        setPlayers(data.players);
        setObstacle(data.obstacle);

        // 生存者数を計算
        const aliveCount = Object.values(data.players).filter(p => p.isAlive).length;
        setRemainingPlayers(aliveCount);
      } else if (data.type === "faceGameStart") {
        console.log("🎯 ゲーム開始受信:", data);
        setObstacle(data.obstacle);
        setGameTime(data.gameTime);
        startCountdown();
      }
    };

    ws.onclose = (event) => {
      console.log("🔌 WebSocket接続終了:", { code: event.code, reason: event.reason });
      setIsConnected(false);
      wsRef.current = null;
    };

    ws.onerror = (error) => {
      console.error("❌ WebSocket エラー:", error);
      console.error("WebSocketサーバーが起動していない可能性があります。");
      console.error("サーバーを起動してください: cd server && node server.js");
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

  // カウントダウン開始
  const startCountdown = () => {
    setCountdown(3);
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // プレイヤー移動（WASD）
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

    console.log("🎮 ゲーム開始処理開始:", { roomId, playerId, isConnected });

    try {
      // WebSocket接続を確実に確立
      await ensureWebSocketConnection();
      console.log("🔗 WebSocket接続確認完了");

      // Firestoreのゲーム状態を更新
      const roomRef = doc(db, "rooms", roomId);
      await updateDoc(roomRef, {
        game: {
          status: "playing",
          startTime: serverTimestamp(),
          endTime: null,
          lastUpdated: serverTimestamp()
        }
      });
      console.log("📝 Firestore更新完了");

      // WebSocketサーバーにゲーム開始を通知
      if (wsRef.current && wsRef.current.readyState === 1) {
        const message = { type: "startFaceGame", roomId };
        console.log("📤 WebSocketメッセージ送信:", message);
        wsRef.current.send(JSON.stringify(message));
      } else {
        console.error("❌ WebSocket接続が無効:", {
          exists: !!wsRef.current,
          readyState: wsRef.current?.readyState
        });
      }
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
    obstacle,
    move,
    gameStatus,
    playerId,
    isConnected,
    startGame,
    endGame,
    countdown,
    gameTime,
    remainingPlayers
  };
}
