// 休憩時間統合型のポモドーロタイマー（カメラ機能なし）
import { useState, useEffect } from "react";
import { Clock, Play, Pause, RotateCcw, Coffee, Target } from "lucide-react";
import ShootingGame from "../features/shooting-game/ShootingGame";

function EnhancedPomodoroTimer() {
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25分
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState('work'); // 'work', 'break', 'game'
  const [cycle, setCycle] = useState(0);

  // ポモドーロタイマーロジック
  useEffect(() => {
    let interval = null;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsRunning(false);
      if (mode === 'work') {
        setMode('break');
        setTimeLeft(5 * 60); // 5分休憩
        setCycle(c => c + 1);
      } else if (mode === 'break') {
        setMode('work');
        setTimeLeft(25 * 60); // 25分作業
      }
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft, mode]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startTimer = () => setIsRunning(true);
  const pauseTimer = () => setIsRunning(false);
  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(mode === 'work' ? 25 * 60 : 5 * 60);
  };

  const startTestGame = () => {
    setMode('game');
  };

  const handleGameEnd = (score) => {
    console.log(`ゲーム終了！スコア: ${score}`);
    setMode('break');
  };

  // ゲームモード時の画面
  if (mode === 'game') {
    return (
      <div className="flex flex-col h-full bg-gray-900">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-white mb-2">
            🎯 休憩時間ゲーム
          </h2>
          <p className="text-gray-300 text-lg">
            リフレッシュタイム！ターゲットを撃ってスコアを稼ごう
          </p>
        </div>

        <div className="flex-1">
          <ShootingGame
            targetImage={null} // デフォルトターゲットを使用
            onGameEnd={handleGameEnd}
            gameConfig={{
              gameTime: 30000, // 30秒
              targetCount: 10,
              targetSize: 80,
              spawnRate: 1200
            }}
          />
        </div>

        <div className="text-center mt-4">
          <button
            onClick={() => setMode('break')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ゲームを終了して休憩に戻る
          </button>
        </div>
      </div>
    );
  }

  // 通常のタイマー画面
  return (
    <div className="flex flex-col h-full bg-gray-900 p-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">ポモドーロタイマー</h2>
        <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
          mode === 'work'
            ? 'bg-blue-100 text-blue-800'
            : 'bg-green-100 text-green-800'
        }`}>
          {mode === 'work' ? '🍅 作業時間' : '☕ 休憩時間'}
        </div>
        <p className="text-gray-400 text-sm mt-2">サイクル: {cycle}</p>
      </div>

      <div className="text-center mb-8">
        <div className="text-6xl font-mono text-white mb-4">
          {formatTime(timeLeft)}
        </div>

        <div className={`w-full h-2 rounded-full mb-6 ${
          mode === 'work' ? 'bg-blue-200' : 'bg-green-200'
        }`}>
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              mode === 'work' ? 'bg-blue-500' : 'bg-green-500'
            }`}
            style={{
              width: `${((mode === 'work' ? 25*60 : 5*60) - timeLeft) / (mode === 'work' ? 25*60 : 5*60) * 100}%`
            }}
          />
        </div>
      </div>

      <div className="flex gap-3 justify-center mb-8">
        {!isRunning ? (
          <button
            onClick={startTimer}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            開始
          </button>
        ) : (
          <button
            onClick={pauseTimer}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            <Pause className="w-4 h-4" />
            一時停止
          </button>
        )}

        <button
          onClick={resetTimer}
          className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          リセット
        </button>
      </div>

      {mode === 'break' && (
        <div className="text-center">
          <p className="text-gray-300 mb-4">休憩時間です！ゲームで気分転換しませんか？</p>
          <button
            onClick={startTestGame}
            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2 mx-auto"
          >
            <Target className="w-4 h-4" />
            ゲームで遊ぶ
          </button>
        </div>
      )}

      {mode === 'work' && (
        <div className="text-center">
          <p className="text-gray-300 text-sm">
            集中して作業しましょう！🔥
          </p>
        </div>
      )}
    </div>
  );
}

export default EnhancedPomodoroTimer;
