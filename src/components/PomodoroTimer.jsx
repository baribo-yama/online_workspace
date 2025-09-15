import { useState, useEffect } from "react";
import { Clock, Play, Pause, RotateCcw } from "lucide-react";

// 状態を管理するためのenum（のようなオブジェクト）を定義
const TimerState = {
  IDLE: "IDLE", // 停止中
  RUNNING: "RUNNING", // 実行中
  PAUSED: "PAUSED", // 一時停止中
};

const POMODORO_DURATION = 25 * 60; // 25分

function PomodoroTimer() {
  const [timeLeft, setTimeLeft] = useState(POMODORO_DURATION);
  // isRunningの代わりに、新しい状態管理変数を導入
  const [timerState, setTimerState] = useState(TimerState.IDLE);

  // ポモドーロタイマーロジック
  useEffect(() => {
    let interval = null;

    // timerStateがRUNNINGの時だけタイマーを進める
    if (timerState === TimerState.RUNNING && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      // 時間が0になったら停止中にする
      setTimerState(TimerState.IDLE);
    }

    // コンポーネントがアンマウントされるか、依存配列の値が変わる時にクリーンアップ
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerState, timeLeft]); // timerStateを依存配列に追加

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // 各ボタンに対応するハンドラ関数を定義
  const handleStart = () => setTimerState(TimerState.RUNNING);
  const handlePause = () => setTimerState(TimerState.PAUSED);
  const handleResume = () => setTimerState(TimerState.RUNNING);
  const handleReset = () => {
    setTimerState(TimerState.IDLE);
    setTimeLeft(POMODORO_DURATION);
  };

  const progress = ((POMODORO_DURATION - timeLeft) / POMODORO_DURATION) * 100;

  // 状態に応じたステータスメッセージを返すヘルパー関数
  const getStatusMessage = () => {
    switch (timerState) {
      case TimerState.RUNNING:
        return "集中時間中...";
      case TimerState.PAUSED:
        return "一時停止中";
      case TimerState.IDLE:
        return timeLeft === 0 ? "完了！" : "準備完了";
      default:
        return "準備完了";
    }
  };

  return (
    <div className="w-1/2 flex flex-col items-center justify-center p-8 bg-gradient-to-br from-gray-900 via-gray-800 to-blue-900">
      <div className="text-center space-y-8">
        <div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
            ポモドーロタイマー
          </h2>
          <p className="text-gray-300 text-lg">25分間集中して学習しましょう</p>
        </div>

        {/* タイマー表示 */}
        <div className="relative">
          <div className="w-72 h-72 rounded-full border-8 border-gray-700 flex items-center justify-center relative overflow-hidden shadow-2xl shadow-blue-500/20">
            {/* プログレスリング */}
            <div
              className="absolute inset-0 rounded-full border-8 border-transparent"
              style={{
                background: `conic-gradient(from 0deg, #3b82f6 ${progress}%, transparent ${progress}%)`,
                mask: "radial-gradient(circle, transparent 50%, black 50%)",
                WebkitMask: "radial-gradient(circle, transparent 50%, black 50%)",
              }}
            />
            <div className="text-7xl font-mono font-bold text-white z-10 drop-shadow-lg filter drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]">
              {formatTime(timeLeft)}
            </div>
          </div>
        </div>

        {/* タイマーコントロール */}
        <div className="flex gap-4 justify-center h-14">
          {/* 停止中の場合 */}
          {timerState === TimerState.IDLE && (
            <button
              onClick={handleStart}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg font-semibold rounded-lg shadow-lg hover:shadow-blue-500/25 transition-all duration-200 flex items-center gap-2"
            >
              <Play className="w-5 h-5" />
              開始
            </button>
          )}

          {/* 実行中の場合 */}
          {timerState === TimerState.RUNNING && (
            <>
              <button
                onClick={handlePause}
                className="bg-yellow-500 hover:bg-yellow-600 text-white px-8 py-3 text-lg font-semibold rounded-lg shadow-lg hover:shadow-yellow-500/25 transition-all duration-200 flex items-center gap-2"
              >
                <Pause className="w-5 h-5" />
                一時停止
              </button>
              <button
                onClick={handleReset}
                className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-lg font-semibold rounded-lg shadow-lg hover:shadow-red-500/25 transition-all duration-200 flex items-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                終了
              </button>
            </>
          )}

          {/* 一時停止中の場合 */}
          {timerState === TimerState.PAUSED && (
            <>
              <button
                onClick={handleResume}
                className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 text-lg font-semibold rounded-lg shadow-lg hover:shadow-green-500/25 transition-all duration-200 flex items-center gap-2"
              >
                <Play className="w-5 h-5" />
                再開
              </button>
              <button
                onClick={handleReset}
                className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-lg font-semibold rounded-lg shadow-lg hover:shadow-red-500/25 transition-all duration-200 flex items-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                終了
              </button>
            </>
          )}
        </div>

        {/* タイマーステータス */}
        <div className="flex items-center justify-center gap-2 text-gray-300 text-lg">
          <Clock className="w-5 h-5" />
          <span className="font-medium">{getStatusMessage()}</span>
        </div>
      </div>
    </div>
  );
}

export default PomodoroTimer;
