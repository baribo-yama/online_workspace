// 休憩時間統合型のポモドーロタイマー（カメラ機能なし）
import { useState, useEffect, useRef } from "react";
import { Clock, Play, Pause, RotateCcw, Coffee, Target } from "lucide-react";
// import ShootingGame from "../features/shooting-game/ShootingGame"; // 未実装のため一時的にコメントアウト

function EnhancedPomodoroTimer({
  timer,
  onStart,
  onPause,
  onReset,
  onModeChange,
  onGameStart
}) {
  const [localMode, setLocalMode] = useState('work'); // ゲームモード用のローカル状態

  // タイマーが0になった時の処理
  useEffect(() => {
    if (timer && timer.timeLeft === 0 && timer.isRunning) {
      console.log('EnhancedPomodoroTimer: タイマーが0になりました。モード切り替え:', timer.mode);
      if (timer.mode === 'work') {
        console.log('作業時間終了 -> 休憩時間に切り替え');
        onModeChange('break');
      } else if (timer.mode === 'break') {
        console.log('休憩時間終了 -> 作業時間に切り替え');
        onModeChange('work');
      }
    }
  }, [timer, onModeChange]);

  // デバッグ用：タイマー状態のログ出力（削減）
  const logCountRef = useRef(0);
  useEffect(() => {
    if (timer && logCountRef.current < 3) {
      logCountRef.current++;
      console.log('EnhancedPomodoroTimer タイマー状態:', {
        timeLeft: timer.timeLeft,
        isRunning: timer.isRunning,
        mode: timer.mode,
        cycle: timer.cycle
      });
    }
  }, [timer]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startTimer = () => {
    console.log('EnhancedPomodoroTimer: タイマー開始ボタンが押されました');
    onStart();
  };
  const pauseTimer = () => {
    console.log('EnhancedPomodoroTimer: タイマー一時停止ボタンが押されました');
    onPause();
  };
  const resetTimer = () => {
    console.log('EnhancedPomodoroTimer: タイマーリセットボタンが押されました');
    onReset();
  };

  const startTestGame = () => {
    setLocalMode('game');
    onGameStart();
  };

  const handleGameEnd = (score) => {
    console.log(`ゲーム終了！スコア: ${score}`);
    setLocalMode('work');
    onModeChange('break');
  };

  // ゲームモード時の画面（ShootingGameが未実装のため一時的に無効化）
  if (localMode === 'game') {
    return (
      <div className="flex flex-col h-full bg-gray-900">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-white mb-2">
            🎯 休憩時間ゲーム
          </h2>
          <p className="text-gray-300 text-lg">
            ゲーム機能は現在開発中です
          </p>
        </div>

        <div className="text-center mt-4">
          <button
            onClick={() => setLocalMode('work')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            戻る
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
          timer?.mode === 'work'
            ? 'bg-blue-100 text-blue-800'
            : 'bg-green-100 text-green-800'
        }`}>
          {timer?.mode === 'work' ? '🍅 作業時間' : '☕ 休憩時間'}
        </div>
        <p className="text-gray-400 text-sm mt-2">サイクル: {timer?.cycle || 0}</p>
      </div>

      <div className="text-center mb-8">
        <div className="text-6xl font-mono text-white mb-4">
          {formatTime(timer?.timeLeft || 0)}
        </div>

        <div className={`w-full h-2 rounded-full mb-6 ${
          timer?.mode === 'work' ? 'bg-blue-200' : 'bg-green-200'
        }`}>
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              timer?.mode === 'work' ? 'bg-blue-500' : 'bg-green-500'
            }`}
            style={{
              width: `${((timer?.mode === 'work' ? 25*60 : 5*60) - (timer?.timeLeft || 0)) / (timer?.mode === 'work' ? 25*60 : 5*60) * 100}%`
            }}
          />
        </div>
      </div>

      <div className="flex gap-3 justify-center mb-8">
        {!timer?.isRunning ? (
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

      {/* デバッグ用ボタン */}
      <div className="flex gap-2 justify-center mb-4">
        <button
          onClick={() => onModeChange('work')}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm"
        >
          <Clock className="w-4 h-4" />
          作業モード
        </button>
        <button
          onClick={() => onModeChange('break')}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm"
        >
          <Coffee className="w-4 h-4" />
          休憩モード
        </button>
      </div>

      {timer?.mode === 'break' && (
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

      {timer?.mode === 'work' && (
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
