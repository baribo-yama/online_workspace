// 個人用ポモドーロタイマーコンポーネント
import { Clock, Play, Pause, RotateCcw } from "lucide-react";
import { usePersonalTimer } from "../hooks/usePersonalTimer";

function PersonalTimer() {
  const { timeLeft, isRunning, mode, cycle, progress, formatTime, startTimer, resetTimer } = usePersonalTimer();

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
          onClick={startTimer}
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
          onClick={resetTimer}
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

      {/* モードとサイクル表示 */}
      <div className="flex items-center justify-center gap-4 text-gray-400">
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
          mode === 'work' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
        }`}>
          {mode === 'work' ? '🍅 作業時間' : '☕ 休憩時間'}
        </div>
        <div className="text-sm">
          サイクル: {cycle}
        </div>
      </div>
    </div>
  );
}

export default PersonalTimer;
