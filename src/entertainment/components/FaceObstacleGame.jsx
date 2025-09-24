// src/entertainment/components/FaceObstacleGame.jsx
import React, { useEffect, useRef, useState } from "react";
import { useFaceObstacleGame } from "../hooks/useFaceObstacleGame";

export default function FaceObstacleGame({ roomId, userName, isHost = false }) {
  const {
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
  } = useFaceObstacleGame(roomId, userName);

  const canvasRef = useRef(null);
  const [keys, setKeys] = useState({ w: false, a: false, s: false, d: false });
  const [faceImage, setFaceImage] = useState(null);
  const [obstacleCanvas, setObstacleCanvas] = useState(null);
  const [lastObstaclePos, setLastObstaclePos] = useState({ x: 0, y: 0 });

  // 描画ループ（最適化版）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let animationId;
    let lastDrawTime = 0;
    const drawInterval = 1000 / 30; // 30FPSに制限

    function draw(currentTime) {
      // FPS制限
      if (currentTime - lastDrawTime < drawInterval) {
        animationId = requestAnimationFrame(draw);
        return;
      }
      lastDrawTime = currentTime;

      // 障害物の位置が変更されていない場合は描画をスキップ（デバッグ用に一時的に無効化）
      // if (obstacle &&
      //     Math.abs(obstacle.x - lastObstaclePos.x) < 1 &&
      //     Math.abs(obstacle.y - lastObstaclePos.y) < 1) {
      //   animationId = requestAnimationFrame(draw);
      //   return;
      // }
      // 背景をクリア
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, 500, 500);

      // 障害物描画（最適化版）
      if (obstacle) {
        if (obstacleCanvas) {
          // 事前に描画されたCanvasを使用
          ctx.drawImage(obstacleCanvas, obstacle.x, obstacle.y);
        } else {
          // フォールバック: シンプルな四角形
          ctx.fillStyle = obstacle.color || "#ff6b6b";
          ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
          ctx.strokeStyle = "#333";
          ctx.lineWidth = 2;
          ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
          ctx.fillStyle = "white";
          ctx.font = "24px Arial";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(obstacle.emoji || "😀", obstacle.x + obstacle.width/2, obstacle.y + obstacle.height/2);
          ctx.textAlign = "left";
        }
      }

      // プレイヤー描画
      Object.entries(players).forEach(([id, p]) => {
        if (id === playerId) {
          // 自分のプレイヤーは緑色
          ctx.fillStyle = p.isAlive ? "#4ade80" : "#6b7280";
        } else {
          // 他のプレイヤーは青色
          ctx.fillStyle = p.isAlive ? "#3b82f6" : "#6b7280";
        }
        ctx.fillRect(p.x, p.y, 20, 20);

        // プレイヤー名を表示
        ctx.fillStyle = "white";
        ctx.font = "12px Arial";
        ctx.fillText(id.split('_')[0], p.x, p.y - 5);
      });

      // ゲーム情報表示
      ctx.fillStyle = "white";
      ctx.font = "16px Arial";
      ctx.fillText(`接続状態: ${isConnected ? "接続中" : "未接続"}`, 10, 30);
      ctx.fillText(`プレイヤー数: ${Object.keys(players).length}`, 10, 50);
      ctx.fillText(`生存者: ${remainingPlayers}`, 10, 70);
      ctx.fillText(`残り時間: ${Math.floor(gameTime / 1000)}秒`, 10, 90);

      // カウントダウン表示
      if (countdown > 0) {
        ctx.fillStyle = "red";
        ctx.font = "48px Arial";
        ctx.textAlign = "center";
        ctx.fillText(countdown.toString(), 250, 250);
        ctx.textAlign = "left";
      }

      // 障害物の位置を更新
      if (obstacle) {
        setLastObstaclePos({ x: obstacle.x, y: obstacle.y });
      }

      animationId = requestAnimationFrame(draw);
    }

    animationId = requestAnimationFrame(draw);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [players, obstacle, playerId, isConnected, gameTime, remainingPlayers, countdown, obstacleCanvas, lastObstaclePos]);

  // WASDキー操作
  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(key)) {
        setKeys(prev => ({ ...prev, [key]: true }));
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(key)) {
        setKeys(prev => ({ ...prev, [key]: false }));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // 移動処理（最適化版）
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      if (keys.w) move("up");
      if (keys.s) move("down");
      if (keys.a) move("left");
      if (keys.d) move("right");
    }, 100); // 50ms → 100msに変更（軽量化）

    return () => clearInterval(interval);
  }, [keys, isConnected, move]);

  // 障害物を事前にCanvasに描画（画像対応版）
  useEffect(() => {
    if (obstacle && obstacle.color) {
      // 新しいCanvasを作成
      const canvas = document.createElement('canvas');
      canvas.width = obstacle.width;
      canvas.height = obstacle.height;
      const ctx = canvas.getContext('2d');

      // 背景色で四角形を描画
      ctx.fillStyle = obstacle.color;
      ctx.fillRect(0, 0, obstacle.width, obstacle.height);

      // 枠線を描画
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, obstacle.width, obstacle.height);

      // 画像がある場合は画像を、ない場合は絵文字を描画
      if (obstacle.imageUrl) {
        const img = new Image();
        img.onload = () => {
          // 画像を滑らかでない（ピクセルアート風）描画に設定
          ctx.imageSmoothingEnabled = false;
          // 画像をキャンバスサイズに合わせて描画（少し余白を残す）
          ctx.drawImage(img, 4, 4, obstacle.width - 8, obstacle.height - 8);
          setObstacleCanvas(canvas);
        };
        img.onerror = () => {
          // 画像読み込み失敗時は絵文字をフォールバック
          console.warn(`画像読み込み失敗: ${obstacle.imageUrl}, 絵文字を使用します`);
          drawEmojiOnCanvas(ctx, obstacle);
          setObstacleCanvas(canvas);
        };
        // 画像の読み込みパフォーマンス最適化
        if (/^https?:\/\//.test(obstacle.imageUrl)) {
          img.crossOrigin = 'anonymous';
        }
        img.src = obstacle.imageUrl;
      } else {
        // 絵文字を描画
        drawEmojiOnCanvas(ctx, obstacle);
        setObstacleCanvas(canvas);
      }
    } else {
      setObstacleCanvas(null);
    }
  }, [obstacle]);

  // 絵文字描画のヘルパー関数
  const drawEmojiOnCanvas = (ctx, obstacle) => {
    ctx.fillStyle = "white";
    ctx.font = "24px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(obstacle.emoji || "😀", obstacle.width/2, obstacle.height/2);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* ゲーム状態表示 */}
      <div className="text-center">
        <h3 className="text-xl font-bold text-white mb-2">
          🎭 顔障害物ゲーム
        </h3>
        <p className="text-gray-300 mb-4">
          WASDキーで移動して障害物を避けよう！
        </p>

        {/* ゲーム制御ボタン */}
        <div className="flex gap-4 mb-4">
          {gameStatus === "idle" ? (
            /* ゲーム開始はホストのみ */
            isHost ? (
              <button
                onClick={startGame}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                ゲーム開始
              </button>
            ) : (
              <div className="text-center">
                <p className="text-gray-400">⏳ ゲーム待機中</p>
                <p className="text-gray-300 text-sm">ホストがゲームを開始するまでお待ちください</p>
              </div>
            )
          ) : (
            /* ゲーム終了は参加者全員 */
            <button
              onClick={endGame}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              ゲーム終了
            </button>
          )}
        </div>

        {/* ゲーム状態メッセージ */}
        {gameStatus === "playing" && (
          <div className="mb-4 text-center">
            <p className="text-green-400 font-medium">🎮 ゲーム中！</p>
            <p className="text-gray-300 text-sm">
              {isHost ? "ゲームを開始しました" : "ホストがゲームを開始しました"}
            </p>
            <p className="text-gray-400 text-xs mt-1">
              誰でも「ゲーム終了」ボタンでゲームを終了できます
            </p>
          </div>
        )}

        {/* 接続状態表示 */}
        <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
          isConnected
            ? 'bg-green-100 text-green-800'
            : 'bg-red-100 text-red-800'
        }`}>
          {isConnected ? "🟢 接続中" : "🔴 未接続"}
        </div>
      </div>

      {/* ゲームキャンバス */}
      <canvas
        ref={canvasRef}
        width={500}
        height={500}
        className="border-2 border-gray-600 rounded-lg bg-gray-800"
      />

      {/* 操作説明 */}
      <div className="text-center text-gray-400 text-sm">
        <p>WASDキーで移動</p>
        <p>緑色: あなた | 青色: 他のプレイヤー | 絵文字: 障害物</p>
      </div>
    </div>
  );
}
