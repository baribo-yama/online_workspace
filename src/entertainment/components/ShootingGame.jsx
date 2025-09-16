// src/entertainment/components/ShootingGame.jsx
import React, { useEffect, useRef, useState } from "react";
import { useShootingGame } from "../hooks/useShootingGame";

export default function ShootingGame({ roomId, userName, isHost = false }) {
  const {
    players,
    bullets,
    move,
    gameStatus,
    playerId,
    isConnected,
    startGame,
    endGame
  } = useShootingGame(roomId, userName);

  const canvasRef = useRef(null);
  const [keys, setKeys] = useState({ left: false, right: false });
  const [gameTime, setGameTime] = useState(0);

  // 描画ループ
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    function draw() {
      // 背景をクリア
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, 500, 500);

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

      // 弾描画
      bullets.forEach((b) => {
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(b.x, b.y, 10, 10);
      });

      // ゲーム情報表示
      ctx.fillStyle = "white";
      ctx.font = "16px Arial";
      ctx.fillText(`接続状態: ${isConnected ? "接続中" : "未接続"}`, 10, 30);
      ctx.fillText(`プレイヤー数: ${Object.keys(players).length}`, 10, 50);
      ctx.fillText(`ゲーム時間: ${Math.floor(gameTime / 1000)}秒`, 10, 70);

      requestAnimationFrame(draw);
    }

    draw();
  }, [players, bullets, playerId, isConnected, gameTime]);

  // キーボード操作（滑らかな移動）
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "ArrowLeft") {
        setKeys(prev => ({ ...prev, left: true }));
      }
      if (e.key === "ArrowRight") {
        setKeys(prev => ({ ...prev, right: true }));
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === "ArrowLeft") {
        setKeys(prev => ({ ...prev, left: false }));
      }
      if (e.key === "ArrowRight") {
        setKeys(prev => ({ ...prev, right: false }));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // 移動処理（キーが押されている間は連続移動）
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      if (keys.left) move("left");
      if (keys.right) move("right");
    }, 50); // 50msごとに移動

    return () => clearInterval(interval);
  }, [keys, move, isConnected]);

  // ゲーム時間の計測
  useEffect(() => {
    if (gameStatus === "playing") {
      const startTime = Date.now();
      const timer = setInterval(() => {
        setGameTime(Date.now() - startTime);
      }, 100);

      return () => clearInterval(timer);
    } else {
      setGameTime(0);
    }
  }, [gameStatus]);

  // 5分でゲーム終了
  useEffect(() => {
    if (gameTime >= 5 * 60 * 1000 && gameStatus === "playing") {
      console.log("5分経過 - ゲーム終了");
      endGame();
    }
  }, [gameTime, gameStatus, endGame]);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* ゲーム状態表示 */}
      <div className="text-center">
        <h3 className="text-xl font-bold text-white mb-2">
          🎯 シューティングゲーム
        </h3>
        <p className="text-gray-300 mb-4">
          左右キーで移動して弾を避けよう！
        </p>

        {/* ゲーム制御ボタン（ホストのみ） */}
        {isHost && (
          <div className="flex gap-4 mb-4">
            {gameStatus === "idle" ? (
              <button
                onClick={startGame}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                ゲーム開始
              </button>
            ) : (
              <button
                onClick={endGame}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                ゲーム終了
              </button>
            )}
          </div>
        )}

        {/* ゲスト向けメッセージ */}
        {!isHost && (
          <div className="mb-4">
            {gameStatus === "playing" ? (
              <div className="text-center">
                <p className="text-green-400 font-medium">🎮 ゲーム中！</p>
                <p className="text-gray-300 text-sm">ホストがゲームを開始しました</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-gray-400">⏳ ゲーム待機中</p>
                <p className="text-gray-300 text-sm">ホストがゲームを開始するまでお待ちください</p>
              </div>
            )}
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
        <p>← → キーで移動</p>
        <p>緑色: あなた | 青色: 他のプレイヤー | 赤色: 弾</p>
      </div>
    </div>
  );
}
