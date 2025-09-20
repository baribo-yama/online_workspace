// 共有ポモドーロタイマーコンポーネント
import { memo } from "react";
import { Clock, Play, Pause, RotateCcw, Coffee } from "lucide-react";
import { useSharedTimer } from "../hooks/useSharedTimer";
import { formatTime, calculateProgress } from "../../shared/utils/timer";

const SharedTimer = memo(function SharedTimer({ roomId, isHost = false }) {
  const { timer, isLoading, startTimer, resetTimer, switchMode, isAutoCycle } = useSharedTimer(roomId);

  const duration = timer?.mode === 'work' ? 25*60 : 5*60;
  const progress = calculateProgress(timer?.timeLeft || 0, duration);

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
        {isAutoCycle && (
          <div className="mt-2">
            <div className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
              🔄 自動サイクル中
            </div>
          </div>
        )}
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
        {isHost ? (
          <>
            {!timer?.isRunning ? (
              <button
                onClick={startTimer}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                {isAutoCycle ? "自動サイクル開始" : "開始"}
              </button>
            ) : (
              <button
                onClick={startTimer}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                <Pause className="w-4 h-4" />
                {isAutoCycle ? "自動サイクル停止" : "一時停止"}
              </button>
            )}

            <button
              onClick={resetTimer}
              className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              リセット
            </button>
          </>
        ) : (
          <div className="text-center text-gray-400">
            <p className="text-sm">ホストのみタイマーを操作できます</p>
          </div>
        )}
      </div>

      {/* モード切り替えボタン（ホストのみ） */}
      {isHost && (
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
      )}

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
});

export default SharedTimer;
