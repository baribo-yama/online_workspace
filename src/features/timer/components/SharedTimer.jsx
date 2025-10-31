// 共有ポモドーロタイマーコンポーネント
import { memo, useEffect, useRef } from "react";
import { Play, Pause, Coffee, ZapOff} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSharedTimer } from "../hooks/useSharedTimer";
import { formatTime, calculateProgress, TIMER_STATE } from "../../../shared/utils/timer";
import { getModeDuration } from "../../../shared/services/firestore";
import { mapSharedStateToPersonal } from "../hooks/useTimerStateMapping";
import { useNotification } from "../../entertainment/hooks/useNotification";
import { useTips } from "../../entertainment/hooks/useTips";
import { TipsDisplay } from "../../entertainment/components/TipsDisplay";

// 棒状タイマーコンポーネント（PersonalTimerから移植、オーバータイム除外）
const BarTimer = ({ timeLeft, progress, formatTime, state, mode }) => {
  const isBlueColor =
    state === TIMER_STATE.FOCUS ||
    (state === TIMER_STATE.POSE && mode === 'work');

  return (
    <div className="w-full px-[4%] transition-all duration-500">
      <div className="relative h-[clamp(0.4rem,2vh,0.75rem)] bg-gray-700 rounded-full overflow-hidden border-2 border-gray-600 mb-[0vh]">
        <div
          className={`absolute top-0 left-0 h-full transition-all duration-500 ${
            isBlueColor ? "bg-blue-500" : "bg-green-500"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="text-[clamp(2.5rem,6vh,4.5rem)] font-mono font-bold text-white z-10 drop-shadow-lg mt-0">
        {formatTime(timeLeft)}
      </div>
    </div>
  );
};

const SharedTimer = memo(function SharedTimer({ roomId, isHost = false }) {
  const { timer, isLoading, startTimer, pause, resume, finishFocus, startRest, endSession } = useSharedTimer(roomId);
  const { notifyTimerComplete } = useNotification(); // 通知機能を追加
  const { currentTip, isVisible, showRandomTip, hideTip } = useTips(); // Tips機能を追加（showNextTip削除）
  const hasNotifiedRef = useRef(false); // 通知済みフラグ
  const lastNotifiedModeRef = useRef(null); // 最後に通知したモードを記録
  const prevModeRef = useRef(null); // 直前のモード
  const prevTimeLeftRef = useRef(null); // 直前の残り秒数
  // Tips表示制御用の参照（カウントダウン開始検知とサイクル単位の一回表示）
  const prevModeForTipsRef = useRef(null);
  const prevTimeLeftForTipsRef = useRef(null);
  const lastBreakCycleShownRef = useRef(null);

  // PersonalTimerの状態に変換（表示用）
  const personalState = mapSharedStateToPersonal(timer?.mode || 'work', timer?.isRunning || false, timer?.timeLeft || 0);

  const duration = getModeDuration(timer?.mode || 'work');

  // 表示用のtimeLeftを計算（REST_OR_INITで負の値の場合は正の値に変換）
  const displayTimeLeft = (personalState === TIMER_STATE.REST_OR_INIT && timer?.timeLeft < 0)
    ? duration
    : Math.max(0, timer?.timeLeft || 0);

  const progress = calculateProgress(displayTimeLeft, duration);

  // タイマーが0になった時の通知処理（モード切替前のモードで通知）
  useEffect(() => {
    const currentMode = timer?.mode;
    const currentTimeLeft = timer?.timeLeft;

    // 直前が1で今が0になった瞬間を検知 → 直前のモードで通知
    const isZeroTransition = prevTimeLeftRef.current > 0 && currentTimeLeft === 0;

    if (isZeroTransition && !hasNotifiedRef.current) {
      const modeToNotify = prevModeRef.current || currentMode;
      hasNotifiedRef.current = true;
      lastNotifiedModeRef.current = modeToNotify;
      notifyTimerComplete(modeToNotify);
    }

    // 0より大きくなったら（リセット/開始/手動切替等）通知フラグをリセット
    if (typeof currentTimeLeft === 'number' && currentTimeLeft > 0) {
      hasNotifiedRef.current = false;
      lastNotifiedModeRef.current = null;
    }

    // 最後に参照を更新
    prevModeRef.current = currentMode;
    prevTimeLeftRef.current = currentTimeLeft;
  }, [timer?.timeLeft, timer?.mode, notifyTimerComplete]);

  // 休憩タイマーが実際にスタートしたタイミングでTipsを表示（サイクルごとに一度だけ）
  useEffect(() => {
    const mode = timer?.mode;
    const isRunning = !!timer?.isRunning;
    const timeLeft = typeof timer?.timeLeft === 'number' ? timer.timeLeft : null;
    const cycle = timer?.cycle ?? null;

    const justEnteredBreak = (prevModeForTipsRef.current !== 'break' && prevModeForTipsRef.current !== 'longBreak') && (mode === 'break' || mode === 'longBreak');
    const countdownStarted =
      (mode === 'break' || mode === 'longBreak') &&
      isRunning &&
      typeof timeLeft === 'number' &&
      typeof prevTimeLeftForTipsRef.current === 'number' &&
      timeLeft < prevTimeLeftForTipsRef.current;

    if (mode === 'break' || mode === 'longBreak') {
      if (
        isRunning &&
        (justEnteredBreak || countdownStarted) &&
        lastBreakCycleShownRef.current !== cycle
      ) {
        showRandomTip();
        lastBreakCycleShownRef.current = cycle;
      }
    } else if (mode === 'work') {
      if (isVisible) hideTip();
    }

    // 前回値を更新
    prevModeForTipsRef.current = mode;
    prevTimeLeftForTipsRef.current = timeLeft;
  }, [timer?.mode, timer?.isRunning, timer?.timeLeft, timer?.cycle, isVisible, showRandomTip, hideTip]);

  const getStatusMessage = () => {
    switch(personalState) {
      case TIMER_STATE.INIT: return "準備完了";
      case TIMER_STATE.FOCUS: return "集中！！";
      case TIMER_STATE.POSE: return "一時停止中";
      case TIMER_STATE.REST_OR_INIT: return "休憩？";
      case TIMER_STATE.REST: return timer?.timeLeft > 0 ? "休憩" : "休憩終わり！";
      default: return "";
    }
  };

  const renderControls = () => {
    if (!isHost) {
      return (
        <div className="text-gray-400 w-full">
          <p className="text-[clamp(0.875rem,2vh,1rem)]">ホストのみタイマーを操作できます</p>
        </div>
      );
    }

    switch (personalState) {
      case TIMER_STATE.INIT:
        return (
          <button
            onClick={startTimer}
            className="bg-blue-600 hover:bg-blue-700 text-white px-[4%] py-[1.5vh] text-[clamp(1rem,2.5vh,1.25rem)] font-semibold rounded-lg shadow-lg hover:shadow-blue-500/25 transition-all duration-200 flex items-center gap-[0.75vw]"
          >
            <Play className="w-[clamp(1.125rem,2.5vh,1.375rem)] h-[clamp(1.125rem,2.5vh,1.375rem)]" />
            開始
          </button>
        );
      case TIMER_STATE.FOCUS:
        return (
          <div className="flex flex-col items-center gap-[1.2vh] w-full">
            <button
              onClick={pause}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-[3.5%] py-[1.2vh] text-[clamp(0.875rem,2vh,1.125rem)] font-semibold rounded-lg shadow-lg transition-all duration-200 flex items-center gap-[0.6vw]"
            >
              <Pause className="w-[clamp(1rem,2vh,1.25rem)] h-[clamp(1rem,2vh,1.25rem)]" />
              一時停止
            </button>
            <button
              onClick={finishFocus}
              className="bg-red-600 hover:bg-red-700 text-white px-[3.5%] py-[1.2vh] text-[clamp(0.875rem,2vh,1.125rem)] font-semibold rounded-lg shadow-lg transition-all duration-200 flex items-center gap-[0.6vw]"
            >
              <ZapOff className="w-[clamp(1rem,2vh,1.25rem)] h-[clamp(1rem,2vh,1.25rem)]" />
              終了
            </button>
          </div>
        );
      case TIMER_STATE.POSE:
        return (
          <button
            onClick={resume}
            className="bg-blue-600 hover:bg-blue-700 text-white px-[4%] py-[1.5vh] text-[clamp(1rem,2.5vh,1.25rem)] font-semibold rounded-lg shadow-lg hover:shadow-blue-500/25 transition-all duration-200 flex items-center gap-[0.75vw]"
          >
            <Play className="w-[clamp(1.125rem,2.5vh,1.375rem)] h-[clamp(1.125rem,2.5vh,1.375rem)]" />
            再開
          </button>
        );
      case TIMER_STATE.REST_OR_INIT:
        return (
          <div className="flex flex-col items-center gap-[1.2vh] w-full">
            <button
              onClick={startRest}
              className="bg-green-600 hover:bg-green-700 text-white px-[3.5%] py-[1.2vh] text-[clamp(0.875rem,2vh,1.125rem)] font-semibold rounded-lg shadow-lg transition-all duration-200 flex items-center gap-[0.6vw] w-[min(70%,14rem)] justify-center"
            >
              <Coffee className="w-[clamp(1rem,2vh,1.25rem)] h-[clamp(1rem,2vh,1.25rem)]" />
              休憩
            </button>
            <button
              onClick={endSession}
              className="bg-red-600 hover:bg-red-700 text-white px-[3.5%] py-[1.2vh] text-[clamp(0.875rem,2vh,1.125rem)] font-semibold rounded-lg shadow-lg transition-all duration-200 flex items-center gap-[0.6vw] w-[min(70%,14rem)] justify-center"
            >
              <ZapOff className="w-[clamp(1rem,2vh,1.25rem)] h-[clamp(1rem,2vh,1.25rem)]" />
              終了
            </button>
          </div>
        );
      case TIMER_STATE.REST:
        return (
          <div className="flex flex-col items-center gap-[1.2vh] w-full">
            <button
              onClick={pause}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-[3.5%] py-[1.2vh] text-[clamp(0.875rem,2vh,1.125rem)] font-semibold rounded-lg shadow-lg transition-all duration-200 flex items-center gap-[0.6vw]"
            >
              <Pause className="w-[clamp(1rem,2vh,1.25rem)] h-[clamp(1rem,2vh,1.25rem)]" />
              一時停止
            </button>
            <button
              onClick={endSession}
              className="bg-red-600 hover:bg-red-700 text-white px-[3.5%] py-[1.2vh] text-[clamp(0.875rem,2vh,1.125rem)] font-semibold rounded-lg shadow-lg transition-all duration-200 flex items-center gap-[0.6vw]"
            >
              <ZapOff className="w-[clamp(1rem,2vh,1.25rem)] h-[clamp(1rem,2vh,1.25rem)]" />
              終了
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full bg-gray-900 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full w-[clamp(3rem,6vh,4rem)] h-[clamp(3rem,6vh,4rem)] border-b-2 border-white mx-auto mb-[2vh]"></div>
          <p className="text-white text-[clamp(0.875rem,2vh,1rem)]">タイマーを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full min-h-0 bg-gray-900 text-center relative px-[3%] py-[2vh]">
      {/* ステータスメッセージ - 相対的な高さ（約8%） */}
      <div className="relative z-10 flex-shrink-0 flex items-center justify-center pt-[1vh] pb-[0.5vh]" style={{ maxHeight: '8%' }}>
        <AnimatePresence mode="wait">
          <motion.h2
            key={getStatusMessage()}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="text-[clamp(1.5rem,3.5vh,2.25rem)] font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"
          >
            {getStatusMessage()}
          </motion.h2>
        </AnimatePresence>
      </div>

      {/* タイマー表示 - 相対的な高さ（約25%） */}
      <div className="relative flex-shrink-0 flex items-center justify-center pt-[0.5vh] pb-[2vh]" style={{ maxHeight: '25%' }}>
        <BarTimer
          state={personalState}
          timeLeft={displayTimeLeft}
          progress={progress}
          formatTime={formatTime}
          mode={timer?.mode || 'work'}
        />
      </div>

      {/* コントロールボタン - 相対的な高さ（約15%） */}
      <div className="flex gap-[1.5vh] justify-center items-center flex-shrink-0 pt-[2vh] pb-[2vh]" style={{ maxHeight: '15%' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={personalState}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="w-full flex justify-center"
          >
            {renderControls()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* サイクル表示 - 相対的な高さ（約4%） */}
      <div className="text-[clamp(0.875rem,2vh,1rem)] text-gray-400 relative z-10 flex-shrink-0 pt-[2vh] pb-[1vh] mb-[5vh]" style={{ maxHeight: '4%' }}>
        サイクル: {timer?.cycle || 0}
      </div>

      {/* Tips表示 - 残りのスペースを埋める（柔軟、最低30%） */}
      <div className="flex-1 min-h-0 overflow-y-auto flex items-start justify-center pt-[1vh] pb-[1vh]" style={{ minHeight: '30%' }}>
        <TipsDisplay
          tip={currentTip}
          isVisible={isVisible}
        />
      </div>
    </div>
  );
});

export default SharedTimer;
