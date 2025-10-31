// 共有ポモドーロタイマーのフック
import { useState, useEffect } from "react";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { getRoomsCollection } from "../../../shared/services/firebase";
import {
  switchTimerMode,
  getModeDuration,
  createInitialTimer
} from "../../../shared/services/firestore";

export const useSharedTimer = (roomId) => {
  const [timer, setTimer] = useState(createInitialTimer());
  const [isLoading, setIsLoading] = useState(true);
  const [isAutoCycle, setIsAutoCycle] = useState(false);

  // Firestoreからタイマー状態をリアルタイム購諭
  useEffect(() => {
    if (!roomId) return;

    const roomRef = doc(getRoomsCollection(), roomId);

    const unsubscribe = onSnapshot(roomRef, (doc) => {
      if (doc.exists()) {
        const roomData = doc.data();
        if (roomData.timer) {
          const timerData = roomData.timer;

          // タイマーが実行中の場合、経過時間を計算
          let currentTimeLeft = timerData.timeLeft;
          let isRunning = timerData.isRunning || false;

          if (timerData.isRunning && timerData.startTime) {
            const startTime = timerData.startTime.toDate ?
              timerData.startTime.toDate().getTime() :
              timerData.startTime;
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            currentTimeLeft = Math.max(0, timerData.timeLeft - elapsed);

            // タイマーが0になったら自動停止（自動サイクル中は除く）
            if (currentTimeLeft === 0 && timerData.isRunning && !timerData.isAutoCycle) {
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
            } else if (currentTimeLeft === 0 && timerData.isRunning && timerData.isAutoCycle) {
              isRunning = true; // 自動サイクル中は実行中を維持
            }
          }

          setTimer({
            timeLeft: currentTimeLeft,
            isRunning: isRunning,
            mode: timerData.mode || 'work',
            cycle: timerData.cycle || 0,
            startTime: timerData.startTime
          });

          setIsAutoCycle(timerData.isAutoCycle || false);
        } else {
          // タイマーデータが存在しない場合は初期状態を設定
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
    if (!roomId || timer.timeLeft > 0 || !timer.isRunning || !isAutoCycle) {
      return;
    }

    const performAutoSwitchMode = async () => {
      try {
        // timerオブジェクトの値を安全に取得
        const currentMode = timer?.mode || "work";
        const currentCycle = timer?.cycle || 0;

        const nextMode = switchTimerMode(currentMode, currentCycle);
        const nextDuration = getModeDuration(nextMode);
        const newCycle = currentMode === "work" ? currentCycle + 1 : currentCycle;

        const roomRef = doc(getRoomsCollection(), roomId);
        // スプレッドで一貫性と可読性を確保
        await updateDoc(roomRef, {
          timer: {
            ...timer,
            mode: nextMode,
            timeLeft: nextDuration,
            cycle: newCycle,
            isRunning: true, // 自動サイクル中は継続的に実行
            startTime: serverTimestamp(),
            pausedAt: null,
            isAutoCycle: true, // 自動サイクル状態を維持
            lastUpdated: serverTimestamp()
          }
        });

      } catch (error) {
        console.error("モード切り替えエラー:", error);
      }
    };

    // 少し遅延を入れて確実に実行
    setTimeout(performAutoSwitchMode, 100);
  }, [timer.timeLeft, timer.isRunning, timer.mode, timer.cycle, roomId, isAutoCycle, timer]);

  // ローカル更新用のタイマー（表示のスムーズさのため）
  useEffect(() => {
    if (!timer.isRunning || (timer.timeLeft <= 0 && !isAutoCycle)) {
      return;
    }

    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev.timeLeft <= 1) {
          // 自動サイクル中はisRunningをtrueのままにする
          return { ...prev, timeLeft: 0, isRunning: isAutoCycle ? true : false };
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timer.isRunning, timer.timeLeft, isAutoCycle]);

  // タイマー開始処理
  const startTimer = async () => {
    if (!roomId) {
      return;
    }


    const roomRef = doc(getRoomsCollection(), roomId);
    console.log("更新対象パス:", roomRef.path);

    try {
      if (timer.isRunning) {
        // 停止処理
        console.log("タイマーを停止します");
        setIsAutoCycle(false);
        await updateDoc(roomRef, {
          timer: {
            ...timer,
            isRunning: false,
            pausedAt: serverTimestamp(),
            isAutoCycle: false, // Firestoreに自動サイクル状態を保存
            lastUpdated: serverTimestamp()
          }
        });
      } else {
        // 開始処理
        console.log("タイマーを開始します");
        console.log("自動サイクルを有効にします");
        setIsAutoCycle(true);
        await updateDoc(roomRef, {
          timer: {
            ...timer,
            isRunning: true,
            startTime: serverTimestamp(),
            timeLeft: getModeDuration(timer.mode),
            pausedAt: null,
            isAutoCycle: true, // Firestoreに自動サイクル状態を保存
            lastUpdated: serverTimestamp()
          }
        });
      }
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
  const resetTimer = async () => {
    if (!roomId) return;

    try {
      setIsAutoCycle(false);
      const roomRef = doc(getRoomsCollection(), roomId);
      const resetTimerData = createInitialTimer();

      await updateDoc(roomRef, {
        timer: {
          ...resetTimerData,
          timeLeft: getModeDuration(resetTimerData.mode),
          isAutoCycle: false, // リセット時は自動サイクルを停止
          lastUpdated: serverTimestamp()
        }
      });
    } catch (error) {
      console.error("タイマーリセットエラー:", error);
    }
  };

  // モード切り替え処理（手動）
  const switchTimerModeManual = async (newMode) => {
    if (!roomId) {
      return;
    }


    try {
      setIsAutoCycle(false); // 手動モード切り替え時は自動サイクルを停止
      const roomRef = doc(getRoomsCollection(), roomId);
      const newDuration = getModeDuration(newMode);
      const newCycle = newMode === "work" ? timer.cycle + 1 : timer.cycle;

      await updateDoc(roomRef, {
        timer: {
          ...timer,
          mode: newMode,
          timeLeft: newDuration,
          cycle: newCycle,
          isRunning: false,
          startTime: null,
          pausedAt: null,
          isAutoCycle: false, // 手動モード切り替え時は自動サイクルを停止
          lastUpdated: serverTimestamp()
        }
      });
    } catch (error) {
      console.error("モード切り替えエラー:", error);
    }
  };

  // pause/resume関数（PersonalTimerスタイル）
  const pauseTimer = async () => {
    if (!roomId || !timer.isRunning) return;
    
    try {
      setIsAutoCycle(false);
      const roomRef = doc(getRoomsCollection(), roomId);
      await updateDoc(roomRef, {
        timer: {
          ...timer,
          isRunning: false,
          pausedAt: serverTimestamp(),
          isAutoCycle: false,
          lastUpdated: serverTimestamp()
        }
      });
    } catch (error) {
      console.error("一時停止エラー:", error);
    }
  };

  const resumeTimer = async () => {
    if (!roomId || timer.isRunning) return;
    
    try {
      setIsAutoCycle(true);
      const roomRef = doc(getRoomsCollection(), roomId);
      await updateDoc(roomRef, {
        timer: {
          ...timer,
          isRunning: true,
          startTime: serverTimestamp(),
          pausedAt: null,
          isAutoCycle: true,
          lastUpdated: serverTimestamp()
        }
      });
    } catch (error) {
      console.error("再開エラー:", error);
    }
  };

  const finishFocus = async () => {
    if (!roomId) return;
    
    try {
      setIsAutoCycle(false);
      const roomRef = doc(getRoomsCollection(), roomId);
      await updateDoc(roomRef, {
        timer: {
          ...timer,
          mode: 'break',
          timeLeft: -1,
          isRunning: false,
          isAutoCycle: false,
          lastUpdated: serverTimestamp()
        }
      });
    } catch (error) {
      console.error("作業終了エラー:", error);
    }
  };

  const startRest = async () => {
    if (!roomId) return;
    
    try {
      setIsAutoCycle(true);
      const roomRef = doc(getRoomsCollection(), roomId);
      await updateDoc(roomRef, {
        timer: {
          ...timer,
          mode: 'break',
          timeLeft: getModeDuration('break'),
          isRunning: true,
          startTime: serverTimestamp(),
          isAutoCycle: true,
          lastUpdated: serverTimestamp()
        }
      });
    } catch (error) {
      console.error("休憩開始エラー:", error);
    }
  };

  const endSession = async () => {
    if (!roomId) return;
    
    try {
      setIsAutoCycle(false);
      const roomRef = doc(getRoomsCollection(), roomId);
      await updateDoc(roomRef, {
        timer: {
          ...timer,
          mode: 'work',
          timeLeft: getModeDuration('work'),
          isRunning: false,
          startTime: null,
          cycle: 0,
          isAutoCycle: false,
          lastUpdated: serverTimestamp()
        }
      });
    } catch (error) {
      console.error("セッション終了エラー:", error);
    }
  };

  const resumeFocusFromRest = async () => {
    if (!roomId) return;
    
    try {
      setIsAutoCycle(true);
      const roomRef = doc(getRoomsCollection(), roomId);
      await updateDoc(roomRef, {
        timer: {
          ...timer,
          mode: 'work',
          timeLeft: getModeDuration('work'),
          isRunning: true,
          startTime: serverTimestamp(),
          isAutoCycle: true,
          lastUpdated: serverTimestamp()
        }
      });
    } catch (error) {
      console.error("作業再開エラー:", error);
    }
  };

  return {
    timer,
    isLoading,
    startTimer,
    resetTimer,
    switchMode: switchTimerModeManual,
    pause: pauseTimer,
    resume: resumeTimer,
    finishFocus,
    startRest,
    endSession,
    resumeFocusFromRest,
    isAutoCycle
  };
};
