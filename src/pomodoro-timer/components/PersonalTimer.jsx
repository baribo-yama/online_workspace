// 個人用ポモドーロタイマーコンポーネント
import { Clock, Play, Pause, RotateCcw, Coffee, ZapOff } from "lucide-react";
import { usePersonalTimer, TIMER_STATE } from "../hooks/usePersonalTimer";

// 円形タイマーコンポーネント
const CircularTimer = ({ timeLeft, progress, formatTime }) => (
  <div className="relative">
    <div className="w-72 h-72 rounded-full border-8 border-gray-700 flex items-center justify-center relative overflow-hidden shadow-2xl shadow-blue-500/20">
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
);

// 棒状タイマーコンポーネント
const BarTimer = ({ timeLeft, progress, overProgress, formatTime }) => (
    <div className="w-full max-w-md mx-auto space-y-4">
        <div className="relative h-8 bg-gray-700 rounded-full overflow-hidden border-2 border-gray-600">
            <div 
                className="absolute top-0 left-0 h-full bg-green-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
            />
            <div 
                className="absolute top-0 left-0 h-full bg-red-500 transition-all duration-500"
                style={{ width: `${overProgress}%` }}
            />
        </div>
        <div className="text-5xl font-mono font-bold text-white z-10 drop-shadow-lg">
            {formatTime(timeLeft)}
        </div>
    </div>
);


function PersonalTimer() {
  const { 
    state,
    timeLeft,
    cycle,
    progress,
    overProgress,
    formatTime,
    startFocus,
    pause,
    resume,
    finishFocus,
    startRest,
    endSession,
    resetTimer,
  } = usePersonalTimer();

  const renderControls = () => {
    switch (state) {
      case TIMER_STATE.INIT:
        return (
          <button onClick={startFocus} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg font-semibold rounded-lg shadow-lg hover:shadow-blue-500/25 transition-all duration-200 flex items-center gap-2">
            <Play className="w-5 h-5" />
            開始
          </button>
        );
      case TIMER_STATE.FOCUS:
        return (
          <div className="flex gap-4 justify-center">
            <button onClick={pause} className="bg-yellow-500 hover:bg-yellow-600 text-white px-8 py-3 text-lg font-semibold rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2">
              <Pause className="w-5 h-5" />
              一時停止
            </button>
            <button onClick={finishFocus} className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-lg font-semibold rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2">
              <ZapOff className="w-5 h-5" />
              終了
            </button>
          </div>
        );
      case TIMER_STATE.POSE:
        return (
          <button onClick={resume} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg font-semibold rounded-lg shadow-lg hover:shadow-blue-500/25 transition-all duration-200 flex items-center gap-2">
            <Play className="w-5 h-5" />
            再開
          </button>
        );
      case TIMER_STATE.REST_OR_INIT:
        return (
          <div className="flex gap-4 justify-center">
            <button onClick={startRest} className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg font-semibold rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2">
              <Coffee className="w-5 h-5" />
              休憩
            </button>
            <button onClick={endSession} className="bg-gray-700 hover:bg-gray-600 text-white px-8 py-3 text-lg font-semibold rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2">
              <ZapOff className="w-5 h-5" />
              終了
            </button>
          </div>
        );
      case TIMER_STATE.REST:
      case TIMER_STATE.REST_OVER:
        return (
          <button onClick={endSession} className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-lg font-semibold rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2">
            <ZapOff className="w-5 h-5" />
            終了
          </button>
        );
      default:
        return null;
    }
  };
  
  const getStatusMessage = () => {
      switch(state) {
          case TIMER_STATE.INIT: return "準備完了";
          case TIMER_STATE.FOCUS: return "集中時間中...";
          case TIMER_STATE.POSE: return "一時停止中";
          case TIMER_STATE.REST_OR_INIT: return "集中時間完了！";
          case TIMER_STATE.REST: return "休憩中...";
          case TIMER_STATE.REST_OVER: return "休憩時間超過中！";
          default: return "";
      }
  }

  return (
    <div className="text-center space-y-8">
      <div>
        <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
          ポモドーロタイマー
        </h2>
        <p className="text-gray-300 text-lg">25分間集中して学習しましょう</p>
      </div>

      {state === TIMER_STATE.REST || state === TIMER_STATE.REST_OVER ? (
        <BarTimer timeLeft={timeLeft} progress={progress} overProgress={overProgress} formatTime={formatTime} />
      ) : (
        <CircularTimer timeLeft={timeLeft} progress={progress} formatTime={formatTime} />
      )}

      <div className="flex gap-4 justify-center">
        {renderControls()}
        <button
          onClick={resetTimer}
          className="bg-gray-700 hover:bg-gray-600 border border-gray-600 text-white px-8 py-3 text-lg font-semibold rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2"
        >
          <RotateCcw className="w-5 h-5" />
          リセット
        </button>
      </div>

      <div className="flex items-center justify-center gap-2 text-gray-300 text-lg">
        <Clock className="w-5 h-5" />
        <span className="font-medium">{getStatusMessage()}</span>
      </div>

      <div className="flex items-center justify-center gap-4 text-gray-400">
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
          state === TIMER_STATE.FOCUS || state === TIMER_STATE.POSE ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
        }`}>
          {state === TIMER_STATE.FOCUS || state === TIMER_STATE.POSE ? '🍅 作業時間' : '☕ 休憩時間'}
        </div>
        <div className="text-sm">
          サイクル: {cycle}
        </div>
      </div>
    </div>
  );
}

export default PersonalTimer;
