// 個人用ポモドーロタイマーコンポーネント
import { Clock, Play, Pause, RotateCcw, Coffee, ZapOff, FastForward } from "lucide-react";
import { usePersonalTimer, TIMER_STATE } from "../hooks/usePersonalTimer";
import { motion, AnimatePresence } from "framer-motion";

// 円形タイマーは廃止（棒状タイマーに統一）

// 棒状タイマーコンポーネント
const BarTimer = ({ timeLeft, progress, overProgress, formatTime, state }) => {
  const isRestState = state === TIMER_STATE.REST;
  const timerWidth = isRestState ? "w-48" : "w-96";

  return (
    <div className={`mx-auto space-y-4 transition-all duration-500 ${timerWidth}`}>
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
};


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
    resumeFocusFromRest,
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
          <div className="flex flex-col items-center gap-4">
            <button onClick={pause} className="bg-yellow-500 hover:bg-yellow-600 text-white px-8 py-3 text-lg font-semibold rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2 w-48 justify-center">
              <Pause className="w-5 h-5" />
              一時停止
            </button>
            <button onClick={finishFocus} className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-lg font-semibold rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2 w-48 justify-center">
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
          <div className="flex flex-col items-center gap-4">
            <button onClick={startRest} className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg font-semibold rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2 w-48 justify-center">
              <Coffee className="w-5 h-5" />
              休憩
            </button>
            <button onClick={endSession} className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-lg font-semibold rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2 w-48 justify-center">
              <ZapOff className="w-5 h-5" />
              終了
            </button>
          </div>
        );
      case TIMER_STATE.REST:
        return (
          <div className="flex flex-col items-center gap-4">
            <button 
              onClick={resumeFocusFromRest} 
              disabled={timeLeft > 0}
              className={`px-8 py-3 text-lg font-semibold rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2 w-48 justify-center ${
                timeLeft > 0 
                  ? "bg-gray-500 cursor-not-allowed" 
                  : "bg-blue-600 hover:bg-blue-700 text-white hover:shadow-blue-500/25"
              }`}
            >
              <FastForward className="w-5 h-5" />
              再開
            </button>
            <button onClick={endSession} className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-lg font-semibold rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2 w-48 justify-center">
              <ZapOff className="w-5 h-5" />
              終了
            </button>
          </div>
        );
      default:
        return null;
    }
  };
  
  const getStatusMessage = () => {
      switch(state) {
          case TIMER_STATE.INIT: return "準備完了";
          case TIMER_STATE.FOCUS: return "集中！！";
          case TIMER_STATE.POSE: return "一時停止中";
          case TIMER_STATE.REST_OR_INIT: return "休憩？";
          case TIMER_STATE.REST: return timeLeft > 0 ? "休憩" : "休憩終わり！";
          default: return "";
      }
  }

  return (
    <div className="text-center space-y-8 relative">
      <div className="relative z-10 h-12 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.h2
            key={getStatusMessage()}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"
          >
            {getStatusMessage()}
          </motion.h2>
        </AnimatePresence>
      </div>

      {/* タイマーは常に中央上部に絶対配置で表示 */}
      <div className="relative h-40 flex items-start justify-center">
        <div className="absolute left-1/2 -translate-x-1/2 top-0 z-10">
          <BarTimer state={state} timeLeft={timeLeft} progress={progress} overProgress={overProgress} formatTime={formatTime} />
        </div>
      </div>

      <div className="flex gap-4 justify-center items-center h-32">
        <AnimatePresence mode="wait">
          <motion.div
            key={state}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderControls()}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="text-sm text-gray-400 relative z-10">
        サイクル: {cycle}
      </div>
    </div>
  );
}

export default PersonalTimer;
