// シューティングゲームコンポーネント
import { useEffect, useState } from 'react';
import { Target, Play, RotateCcw, Trophy, Clock, Zap } from 'lucide-react';
import { useShootingGame } from '../hooks/useShootingGame';

function ShootingGame({ targetImage, onGameEnd, gameConfig }) {
  const [showInstructions, setShowInstructions] = useState(true);

  const {
    gameState,
    score,
    timeLeft,
    targets,
    gameAreaRef,
    startGame,
    resetGame,
    hitTarget
  } = useShootingGame(targetImage, gameConfig);

  useEffect(() => {
    if (gameState === 'finished' && onGameEnd) {
      onGameEnd(score);
    }
  }, [gameState, score, onGameEnd]);

  const handleTargetClick = (targetId, event) => {
    event.preventDefault();
    hitTarget(targetId);

    // ヒットエフェクト
    const ripple = document.createElement('div');
    ripple.className = 'hit-effect';
    ripple.style.cssText = `
      position: absolute;
      width: 30px;
      height: 30px;
      background: radial-gradient(circle, #ff6b6b 0%, transparent 70%);
      border-radius: 50%;
      pointer-events: none;
      animation: hit-ripple 0.3s ease-out;
      left: ${event.clientX - 15}px;
      top: ${event.clientY - 15}px;
      z-index: 1000;
    `;
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 300);
  };

  if (showInstructions && gameState === 'waiting') {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-600 text-center">
        <div className="mb-6">
          <Target className="w-16 h-16 text-blue-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">休憩時間ゲーム！</h2>
          <p className="text-gray-300">ターゲットを狙ってシューティングゲームで遊びましょう</p>
        </div>

        <div className="mb-6">
          <div className="inline-block p-2 bg-gray-700 rounded-lg">
            {targetImage ? (
              <img
                src={targetImage.dataUrl}
                alt="ターゲット"
                className="w-24 h-24 rounded-lg object-cover"
              />
            ) : (
              <div className="w-24 h-24 bg-red-500 rounded-lg flex items-center justify-center">
                <Target className="w-12 h-12 text-white" />
              </div>
            )}
          </div>
          <p className="text-gray-400 text-sm mt-2">↑ このターゲットを狙え！</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div className="bg-gray-700 p-3 rounded">
            <Clock className="w-5 h-5 text-blue-400 mx-auto mb-1" />
            <p className="text-gray-300">制限時間</p>
            <p className="text-white font-bold">30秒</p>
          </div>
          <div className="bg-gray-700 p-3 rounded">
            <Trophy className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
            <p className="text-gray-300">得点</p>
            <p className="text-white font-bold">10点/ヒット</p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => {
              setShowInstructions(false);
              startGame();
            }}
            className="w-full py-3 px-6 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            <Play className="w-5 h-5" />
            ゲーム開始
          </button>

          <button
            onClick={() => setShowInstructions(false)}
            className="w-full py-2 px-4 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
          >
            スキップ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-600 overflow-hidden">
      {/* ゲームUI */}
      <div className="bg-gray-900 p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <span className="text-white font-bold text-lg">{score}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            <span className="text-white font-bold text-lg">{timeLeft}s</span>
          </div>
        </div>

        <div className="flex gap-2">
          {gameState === 'waiting' && (
            <button
              onClick={startGame}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              開始
            </button>
          )}

          <button
            onClick={resetGame}
            className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded transition-colors flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            リセット
          </button>
        </div>
      </div>

      {/* ゲームエリア */}
      <div
        ref={gameAreaRef}
        className="relative bg-gradient-to-br from-gray-900 to-blue-900 overflow-hidden cursor-crosshair"
        style={{ height: '400px' }}
      >
        {gameState === 'waiting' && !showInstructions && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-400">ゲームを開始してください</p>
            </div>
          </div>
        )}

        {gameState === 'playing' && targets.map(target => (
          <div
            key={target.id}
            className="absolute cursor-pointer transform hover:scale-110 transition-transform"
            style={{
              left: target.x,
              top: target.y,
              width: target.size,
              height: target.size,
              transform: `rotate(${target.rotation}deg)`
            }}
            onClick={(e) => handleTargetClick(target.id, e)}
          >
            {targetImage ? (
              <img
                src={targetImage.dataUrl}
                alt="Target"
                className="w-full h-full rounded-full border-4 border-red-500 object-cover shadow-lg"
                style={{ filter: 'brightness(0.9) contrast(1.1)' }}
                draggable={false}
              />
            ) : (
              <div className="w-full h-full bg-red-500 rounded-full border-4 border-red-300 flex items-center justify-center">
                <Target className="w-8 h-8 text-white" />
              </div>
            )}

            {/* ヒットエフェクト用のリング */}
            <div className="absolute inset-0 rounded-full border-2 border-yellow-400 opacity-75 animate-ping" />
          </div>
        ))}

        {gameState === 'finished' && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-600 text-center">
              <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-white mb-2">ゲーム終了！</h3>
              <div className="text-4xl font-bold text-yellow-400 mb-4">{score} 点</div>

              <div className="text-gray-300 mb-4">
                {score >= 100 ? '素晴らしい！完璧な射撃手です🎯' :
                 score >= 50 ? 'なかなかの腕前ですね！👍' :
                 score >= 20 ? 'もう少し練習が必要かも💪' :
                 'ドンマイ！次回はもっと頑張りましょう😊'}
              </div>

              <button
                onClick={resetGame}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2 mx-auto"
              >
                <Zap className="w-5 h-5" />
                もう一度挑戦
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ヒットエフェクトのCSS
const style = document.createElement('style');
style.textContent = `
  @keyframes hit-ripple {
    0% {
      transform: scale(0);
      opacity: 1;
    }
    100% {
      transform: scale(3);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

export default ShootingGame;
