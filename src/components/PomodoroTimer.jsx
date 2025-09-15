import { useState, useEffect } from "react";
import { Clock, Play, Pause, RotateCcw } from "lucide-react";

function PomodoroTimer() {
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25分
  const [isRunning, setIsRunning] = useState(false);

  // ポモドーロタイマーロジック
  useEffect(() => {
    let interval = null;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsRunning(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, timeLeft]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStart = () => setIsRunning(!isRunning);
  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(25 * 60);
  };

  const progress = ((25 * 60 - timeLeft) / (25 * 60)) * 100;

  return (
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
        <div className="flex gap-4 justify-center">
          <button
            onClick={handleStart}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg font-semibold rounded-lg shadow-lg hover:shadow-blue-500/25 transition-all duration-200 flex items-center gap-2"
          >
            {isRunning ? (
              <>
                <Pause className="w-5 h-5" />
                一時停止
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                開始
              </>
            )}
          </button>
          <button
            onClick={handleReset}
            className="bg-gray-700 hover:bg-gray-600 border border-gray-600 text-white px-8 py-3 text-lg font-semibold rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            リセット
          </button>
        </div>

        {/* タイマーステータス */}
        <div className="flex items-center justify-center gap-2 text-gray-300 text-lg">
          <Clock className="w-5 h-5" />
          <span className="font-medium">
            {isRunning ? "集中時間中..." : timeLeft === 0 ? "完了！" : "準備完了"}
          </span>
        </div>
      </div>
  );
}

export default PomodoroTimer;
