// 共有ポモドーロタイマーのフック
import { useState, useEffect } from "react";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../shared/services/firebase";
import {
  calculateTimerState,
  switchTimerMode,
  getModeDuration,
  createInitialTimer
} from "../../shared/services/firestore";

export const useSharedTimer = (roomId) => {
  const [timer, setTimer] = useState(createInitialTimer());
  const [isLoading, setIsLoading] = useState(true);

  console.log("useSharedTimer レンダリング:", { roomId, timer });

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

  // タイマー開始処理
  const startTimer = async () => {
    if (!roomId) {
      console.log("roomIdがありません。タイマー開始できません。");
      return;
    }

    console.log("タイマー開始処理:", { roomId, timer });

    const roomRef = doc(db, "rooms", roomId);
    console.log("更新対象パス:", roomRef.path);

    try {
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
  const resetTimer = async () => {
    if (!roomId) return;

    try {
      const roomRef = doc(db, "rooms", roomId);
      const resetTimerData = createInitialTimer();

      await updateDoc(roomRef, {
        timer: {
          ...resetTimerData,
          timeLeft: getModeDuration(resetTimerData.mode),
          lastUpdated: serverTimestamp()
        }
      });
    } catch (error) {
      console.error("タイマーリセットエラー:", error);
    }
  };

  // モード切り替え処理
  const switchMode = async (newMode) => {
    if (!roomId) {
      console.log("roomIdがありません。モード切り替えできません。");
      return;
    }

    console.log("モード切り替え処理:", { roomId, currentMode: timer.mode, newMode });

    try {
      const roomRef = doc(db, "rooms", roomId);
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
          lastUpdated: serverTimestamp()
        }
      });
      console.log("モード切り替え完了");
    } catch (error) {
      console.error("モード切り替えエラー:", error);
    }
  };

  return {
    timer,
    isLoading,
    startTimer,
    resetTimer,
    switchMode
  };
};
