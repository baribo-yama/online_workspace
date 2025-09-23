// src/entertainment/hooks/useFaceObstacleGame.js
import { useEffect, useRef, useState, useCallback } from "react";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../shared/services/firebase";
import { getWebSocketUrl, validateWebSocketUrl, isProduction } from "../../shared/config/websocket";

// ゲーム設定定数
const GAME_CONFIG = {
  // 障害物の初期設定
  OBSTACLE_INITIAL_X: 100,
  OBSTACLE_INITIAL_Y: 100,
  OBSTACLE_VELOCITY_X: 3,
  OBSTACLE_VELOCITY_Y: 3,
  OBSTACLE_WIDTH: 60,
  OBSTACLE_HEIGHT: 60,

  // ゲーム時間設定
  GAME_DURATION: 30000, // 30秒（ミリ秒）

  // WebSocket設定（本番環境対応）
  CONNECTION_TIMEOUT: isProduction() ? 30000 : 10000, // 本番環境では30秒
  MAX_CONNECTION_RETRIES: isProduction() ? 20 : 100, // 本番環境では20回
  RETRY_INTERVAL: isProduction() ? 2000 : 100, // 本番環境では2秒間隔
  CONNECTION_CHECK_DELAY: 5000, // 5秒
  LOG_INTERVAL: 5 // ログ出力間隔（n回ごと）
};

// 障害物の種類定義
const OBSTACLE_TYPES = [
  { color: "#ff6b6b", emoji: "😀", name: "赤い笑顔" },
  { color: "#4ecdc4", emoji: "😎", name: "青緑のサングラス" },
  { color: "#45b7d1", emoji: "🤔", name: "青い考え中" },
];

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
    // ゲーム中かつplayerIdが設定されている場合にのみWebSocket接続
    if (gameStatus === "playing" && playerId && !isConnected) {
      console.log("🔗 ゲーム開始に伴うWebSocket接続開始");
      connectWebSocket();
    } 
    // ゲームが終了した場合のみ切断（アイドル状態への変更では切断しない）
    else if (gameStatus === "idle" && isConnected) {
      console.log("🔌 ゲーム終了に伴うWebSocket切断");
      disconnectWebSocket();
    }
  }, [gameStatus, playerId, isConnected]);

  // 手動でWebSocket接続を確立する関数
  const ensureWebSocketConnection = async () => {
    console.log("🔄 WebSocket接続確認開始...");

    // 既に接続済みの場合は即座に完了
    if (isConnected && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log("✅ WebSocket既に接続済み");
      return Promise.resolve();
    }

    console.log("🔗 新しいWebSocket接続を開始...");
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error("❌ WebSocket接続タイムアウト");
        // 本番環境では接続失敗時に詳細ログを出力
        if (isProduction()) {
          console.error("📊 本番環境接続失敗詳細:");
          console.error("  - WebSocket URL:", getWebSocketUrl());
          console.error("  - タイムアウト時間:", GAME_CONFIG.CONNECTION_TIMEOUT);
          console.error("  - 環境:", import.meta.env.MODE);
          console.error("  - 現在時刻:", new Date().toISOString());
        }
        reject(new Error("WebSocket接続タイムアウト"));
      }, GAME_CONFIG.CONNECTION_TIMEOUT);

      let retryCount = 0;
      const maxRetries = GAME_CONFIG.MAX_CONNECTION_RETRIES;

      const checkConnection = () => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          console.log("✅ WebSocket接続完了");
          clearTimeout(timeout);
          resolve();
        } else if (retryCount < maxRetries) {
          retryCount++;
          if (retryCount % GAME_CONFIG.LOG_INTERVAL === 0) { // LOG_INTERVAL回ごとにログ出力
            console.log(`🔄 WebSocket接続確認中... (${retryCount}/${maxRetries})`);
          }
          setTimeout(checkConnection, GAME_CONFIG.RETRY_INTERVAL);
        } else {
          console.error("❌ WebSocket接続リトライ上限到達");
          clearTimeout(timeout);
          reject(new Error("WebSocket接続リトライ上限到達"));
        }
      };

      // 既に接続中でない場合のみ新しい接続を開始
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        connectWebSocket();
      }
      checkConnection();
    });
  };

  const connectWebSocket = () => {
    console.log("🔗 WebSocket接続処理開始...");

    // 既に有効な接続がある場合は何もしない
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log("⏭️ 既存の有効な接続があります - 接続処理をスキップ");
      setIsConnected(true);
      return;
    }

    // 接続中の場合は待機
    if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
      console.log("⏳ 既に接続中です - 処理をスキップ");
      return;
    }

    // 既存の接続を閉じる（無効な状態の場合のみ）
    if (wsRef.current && wsRef.current.readyState !== WebSocket.OPEN) {
      console.log("🔄 無効な接続をクリーンアップ...");
      wsRef.current.close();
      wsRef.current = null;
    }

    // 環境変数からWebSocket URLを取得
    const wsUrl = getWebSocketUrl();
    console.log("🌐 WebSocket URL:", wsUrl);
    console.log("🌐 環境:", import.meta.env.MODE);
    console.log("🌐 本番環境判定:", isProduction());

    // URLの形式チェック
    if (!wsUrl.startsWith('wss://') && !wsUrl.startsWith('ws://')) {
      console.error("❌ 無効なWebSocket URL形式:", wsUrl);
      setIsConnected(false);
      return;
    }

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
      console.log("🔌 WebSocket接続終了:", {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      });
      setIsConnected(false);
      wsRef.current = null;
    };

    ws.onerror = (error) => {
      console.error("❌ WebSocket エラー:", error);
      console.error("📊 エラー詳細:");
      console.error("  - URL:", wsUrl);
      console.error("  - ReadyState:", ws.readyState);
      console.error("  - 環境:", import.meta.env.MODE);
      console.error("  - User Agent:", navigator.userAgent);
      
      if (isProduction()) {
        console.error("🏭 本番環境エラー詳細:");
        console.error("  - サーバー状態確認が必要");
        console.error("  - SSL証明書の確認が必要");
        console.error("  - ネットワーク接続の確認が必要");
        console.error("  - CORS設定の確認が必要");
      } else {
        console.error("  - 可能な原因: サーバーが起動していない、SSL証明書問題、CORS問題、ネットワーク問題");
      }
      
      setIsConnected(false);
    };

    // 接続状態の監視（デバッグ用）
    const connectionCheckTimeout = setTimeout(() => {
      if (ws && ws.readyState === WebSocket.CONNECTING) {
        console.log("⏳ まだ接続中... readyState:", ws.readyState);
      }
    }, GAME_CONFIG.CONNECTION_CHECK_DELAY);

    // WebSocketが閉じられた時やエラー時にタイムアウトもクリア
    const originalOnClose = ws.onclose;
    ws.onclose = (event) => {
      clearTimeout(connectionCheckTimeout);
      originalOnClose.call(ws, event);
    };

    const originalOnError = ws.onerror;
    ws.onerror = (error) => {
      clearTimeout(connectionCheckTimeout);
      originalOnError.call(ws, error);
    };
  };  const disconnectWebSocket = () => {
    console.log("🔌 WebSocket切断処理開始");
    if (wsRef.current) {
      console.log(`📊 切断前の状態: readyState=${wsRef.current.readyState}`);
      
      // 接続が開いている場合のみ明示的に閉じる
      if (wsRef.current.readyState === WebSocket.OPEN || 
          wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      
      wsRef.current = null;
      setIsConnected(false);
      console.log("✅ WebSocket切断完了");
    } else {
      console.log("ℹ️ WebSocket接続なし - 切断処理スキップ");
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
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && isConnected) {
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
      // Firestoreのゲーム状態を更新（最優先）
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

      // WebSocket接続を試行（エラーでも続行）
      try {
        await ensureWebSocketConnection();
        console.log("🔗 WebSocket接続確認完了");

        // WebSocketサーバーにゲーム開始を通知
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const message = { type: "startFaceGame", roomId };
          console.log("📤 WebSocketメッセージ送信:", message);
          wsRef.current.send(JSON.stringify(message));
        } else {
          console.warn("⚠️ WebSocket未接続、シングルプレイヤーモード");
          generateLocalObstacle();
          generateLocalPlayer();
        }
      } catch (wsError) {
        console.warn("⚠️ WebSocket接続失敗、シングルプレイヤーモードで続行:", wsError.message);
        
        if (isProduction()) {
          console.warn("🏭 本番環境でのWebSocket接続失敗:");
          console.warn("  - サーバーが起動中の可能性があります");
          console.warn("  - しばらく待ってから再試行してください");
          console.warn("  - 現在はシングルプレイヤーモードで動作します");
        }
        
        // シングルプレイヤーモード用の障害物生成
        generateLocalObstacle();
        generateLocalPlayer();
      }
    } catch (error) {
      console.error("❌ ゲーム開始エラー:", error);
    }
  };

  // ローカル障害物生成（Fallback用）
  const generateLocalObstacle = () => {
    const selected = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];

    setObstacle({
      ...selected,
      x: GAME_CONFIG.OBSTACLE_INITIAL_X,
      y: GAME_CONFIG.OBSTACLE_INITIAL_Y,
      vx: GAME_CONFIG.OBSTACLE_VELOCITY_X,
      vy: GAME_CONFIG.OBSTACLE_VELOCITY_Y,
      width: GAME_CONFIG.OBSTACLE_WIDTH,
      height: GAME_CONFIG.OBSTACLE_HEIGHT
    });

    setGameTime(GAME_CONFIG.GAME_DURATION);
    startCountdown();
    console.log("🎮 ローカル障害物生成:", selected.name);
  };

  // ローカルプレイヤー生成（Fallback用）
  const generateLocalPlayer = () => {
    if (!playerId) return;

    const localPlayer = {
      x: 250, // 中央位置
      y: 250,
      isAlive: true,
      id: playerId
    };

    setPlayers({ [playerId]: localPlayer });
    setRemainingPlayers(1);
    console.log("🎮 ローカルプレイヤー生成:", playerId);
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
