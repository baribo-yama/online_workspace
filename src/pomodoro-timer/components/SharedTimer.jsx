// 共有ポモドーロタイマーコンポーネント
import { Clock, Play, Pause, RotateCcw, Coffee } from "lucide-react";
import { useSharedTimer } from "../hooks/useSharedTimer";

function SharedTimer({ roomId }) {
  const { timer, isLoading, startTimer, resetTimer, switchMode } = useSharedTimer(roomId);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = ((timer?.mode === 'work' ? 25*60 : 5*60) - (timer?.timeLeft || 0)) / (timer?.mode === 'work' ? 25*60 : 5*60) * 100;

  if (isLoading) {
    return (
      <div className="flex h-full bg-gray-900 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">タイマーを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 p-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">共有ポモドーロタイマー</h2>
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
            style={{ width: `${progress}%` }}
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
            onClick={startTimer}
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

      {/* モード切り替えボタン */}
      <div className="flex gap-2 justify-center mb-4">
        <button
          onClick={() => switchMode('work')}
          className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm ${
            timer?.mode === 'work'
              ? 'bg-blue-600 text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          <Clock className="w-4 h-4" />
          作業モード
        </button>
        <button
          onClick={() => switchMode('break')}
          className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm ${
            timer?.mode === 'break'
              ? 'bg-green-600 text-white'
              : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
        >
          <Coffee className="w-4 h-4" />
          休憩モード
        </button>
      </div>

      {timer?.mode === 'work' && (
        <div className="text-center">
          <p className="text-gray-300 text-sm">
            集中して作業しましょう！🔥
          </p>
        </div>
      )}

      {timer?.mode === 'break' && (
        <div className="text-center">
          <p className="text-gray-300 text-sm">
            休憩時間です！リフレッシュしましょう ☕
          </p>
        </div>
      )}
    </div>
  );
}

export default SharedTimer;
