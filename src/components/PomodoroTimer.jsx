import { useState, useEffect } from "react";
import { Clock, Play, Pause, RotateCcw } from "lucide-react";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import {
  calculateTimerState,
  updateTimerState,
  switchTimerMode,
  getModeDuration,
  createInitialTimer
} from "../models/firestore";

function PomodoroTimer({ roomId }) {
  const [timer, setTimer] = useState(createInitialTimer());
  const [isLoading, setIsLoading] = useState(true);

  console.log("PomodoroTimer レンダリング:", { roomId, timer });

  // Firestoreからタイマー状態をリアルタイム購読
  useEffect(() => {
    if (!roomId) {
      console.log("roomIdがありません:", roomId);
      return;
    }

    console.log("Firestore監視開始:", roomId);
    const roomRef = doc(db, "rooms", roomId);
    console.log("監視対象パス:", roomRef.path);

    const unsubscribe = onSnapshot(roomRef, (doc) => {
      console.log("Firestore更新受信:", doc.exists(), doc.data());
      if (doc.exists()) {
        const roomData = doc.data();
        if (roomData.timer) {
          const timerData = roomData.timer;
          console.log("タイマーデータ:", timerData);

          // タイマーが実行中の場合、経過時間を計算
          let currentTimeLeft = timerData.timeLeft;
          let isRunning = timerData.isRunning || false;

          if (timerData.isRunning && timerData.startTime) {
            const startTime = timerData.startTime.toDate ?
              timerData.startTime.toDate().getTime() :
              timerData.startTime;
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            currentTimeLeft = Math.max(0, timerData.timeLeft - elapsed);

            // タイマーが0になったら自動停止
            if (currentTimeLeft === 0 && timerData.isRunning) {
              console.log('タイマーが0になりました。自動停止します。');
              isRunning = false;
              // Firestoreでタイマーを停止
              setTimeout(async () => {
                try {
                  await updateDoc(roomRef, {
                    timer: {
                      ...timerData,
                      isRunning: false,
                      startTime: null,
                      lastUpdated: serverTimestamp()
                    }
                  });
                } catch (error) {
                  console.error("タイマー自動停止エラー:", error);
                }
              }, 0);
            }
          }

          setTimer({
            timeLeft: currentTimeLeft,
            isRunning: isRunning,
            mode: timerData.mode || 'work',
            cycle: timerData.cycle || 0,
            startTime: timerData.startTime
          });
        } else {
          // タイマーデータが存在しない場合は初期状態を設定
          console.log("タイマーデータが存在しません。初期化します。");
          const initialTimer = createInitialTimer();
          setTimer(initialTimer);
          updateDoc(roomRef, {
            timer: {
              ...initialTimer,
              lastUpdated: serverTimestamp()
            }
          }).catch(error => {
            console.error("タイマー初期化エラー:", error);
          });
        }
      }
      setIsLoading(false);
    }, (error) => {
      console.error("タイマー状態の取得エラー:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [roomId]);

  // 時間切れの自動モード切り替え
  useEffect(() => {
    if (!roomId || timer.timeLeft > 0 || !timer.isRunning) return;

    const switchMode = async () => {
      try {
        const nextMode = switchTimerMode(timer.mode, timer.cycle);
        const nextDuration = getModeDuration(nextMode);
        const newCycle = timer.mode === "work" ? timer.cycle + 1 : timer.cycle;

        const roomRef = doc(db, "rooms", roomId);
        await updateDoc(roomRef, {
          timer: {
            ...timer,
            mode: nextMode,
            timeLeft: nextDuration,
            cycle: newCycle,
            isRunning: false,
            startTime: null,
            pausedAt: null,
            lastUpdated: serverTimestamp()
          }
        });
      } catch (error) {
        console.error("モード切り替えエラー:", error);
      }
    };

    switchMode();
  }, [timer.timeLeft, timer.isRunning, timer.mode, timer.cycle, roomId]);

  // ローカル更新用のタイマー（表示のスムーズさのため）
  useEffect(() => {
    if (!timer.isRunning || timer.timeLeft <= 0) {
      console.log("ローカルタイマー停止:", { isRunning: timer.isRunning, timeLeft: timer.timeLeft });
      return;
    }

    console.log("ローカルタイマー開始:", { timeLeft: timer.timeLeft });
    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev.timeLeft <= 1) {
          console.log("ローカルタイマー終了");
          return { ...prev, timeLeft: 0, isRunning: false };
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timer.isRunning, timer.timeLeft]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // タイマー開始処理
  const handleStart = async () => {
    if (!roomId) {
      console.log("roomIdがありません。タイマー開始できません。");
      return;
    }

    console.log("タイマー開始処理:", { roomId, timer });

    try {
      const roomRef = doc(db, "rooms", roomId);
      console.log("更新対象パス:", roomRef.path);

      if (timer.isRunning) {
        // 停止処理
        console.log("タイマーを停止します");
        await updateDoc(roomRef, {
          timer: {
            ...timer,
            isRunning: false,
            pausedAt: serverTimestamp(),
            lastUpdated: serverTimestamp()
          }
        });
      } else {
        // 開始処理
        console.log("タイマーを開始します");
        await updateDoc(roomRef, {
          timer: {
            ...timer,
            isRunning: true,
            startTime: serverTimestamp(),
            timeLeft: timer.timeLeft || getModeDuration(timer.mode),
            pausedAt: null,
            lastUpdated: serverTimestamp()
          }
        });
      }
      console.log("タイマー更新完了");
    } catch (error) {
      console.error("タイマー操作エラー:", error);
      console.error("エラー詳細:", {
        code: error.code,
        message: error.message,
        roomId: roomId,
        path: roomRef?.path
      });
    }
  };

  // タイマーリセット処理
  const handleReset = async () => {
    if (!roomId) return;

    try {
      const roomRef = doc(db, "rooms", roomId);
      const resetTimer = createInitialTimer();

      await updateDoc(roomRef, {
        timer: {
          ...resetTimer,
          timeLeft: getModeDuration(resetTimer.mode),
          lastUpdated: serverTimestamp()
        }
      });
    } catch (error) {
      console.error("タイマーリセットエラー:", error);
    }
  };

  const progress = ((getModeDuration(timer.mode) - timer.timeLeft) / getModeDuration(timer.mode)) * 100;

  if (isLoading) {
    return (
      <div className="text-center space-y-8">
        <div className="w-72 h-72 rounded-full border-8 border-gray-700 flex items-center justify-center">
          <div className="text-white">読み込み中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center space-y-8">
        <div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
            ポモドーロタイマー
          </h2>
          <p className="text-gray-300 text-lg">
            {timer.mode === "work" ? "25分間集中して学習しましょう" :
             timer.mode === "break" ? "5分間休憩しましょう" :
             "15分間長めの休憩をとりましょう"}
          </p>
          <div className="text-sm text-gray-400 mt-1">
            サイクル: {timer.cycle} | モード: {
              timer.mode === "work" ? "🍅 作業時間" :
              timer.mode === "break" ? "☕ 短い休憩" :
              "🛋️ 長い休憩"
            }
          </div>
        </div>

        {/* タイマー表示 */}
        <div className="relative">
          <div className="w-72 h-72 rounded-full border-8 border-gray-700 flex items-center justify-center relative overflow-hidden shadow-2xl shadow-blue-500/20">
            {/* プログレスリング */}
            <div
              className="absolute inset-0 rounded-full border-8 border-transparent"
              style={{
                background: `conic-gradient(from 0deg, ${
                  timer.mode === "work" ? "#3b82f6" :
                  timer.mode === "break" ? "#10b981" :
                  "#8b5cf6"
                } ${progress}%, transparent ${progress}%)`,
                mask: "radial-gradient(circle, transparent 50%, black 50%)",
                WebkitMask: "radial-gradient(circle, transparent 50%, black 50%)",
              }}
            />
            <div className="text-7xl font-mono font-bold text-white z-10 drop-shadow-lg filter drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]">
              {formatTime(timer.timeLeft)}
            </div>
          </div>
        </div>

        {/* タイマーコントロール */}
        <div className="flex gap-4 justify-center">
          <button
            onClick={handleStart}
            disabled={isLoading}
            className={`px-8 py-3 text-lg font-semibold rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2 ${
              timer.isRunning
                ? "bg-yellow-600 hover:bg-yellow-700 hover:shadow-yellow-500/25"
                : "bg-blue-600 hover:bg-blue-700 hover:shadow-blue-500/25"
            } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {timer.isRunning ? (
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
            disabled={isLoading}
            className="bg-gray-700 hover:bg-gray-600 border border-gray-600 text-white px-8 py-3 text-lg font-semibold rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-5 h-5" />
            リセット
          </button>
        </div>

        {/* タイマーステータス */}
        <div className="flex items-center justify-center gap-2 text-gray-300 text-lg">
          <Clock className="w-5 h-5" />
          <span className="font-medium">
            {timer.isRunning ?
              (timer.mode === "work" ? "集中時間中..." : "休憩時間中...") :
              timer.timeLeft === 0 ? "完了！" : "準備完了"}
          </span>
        </div>
      </div>
  );
}

export default PomodoroTimer;
