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
  const [isAutoCycle, setIsAutoCycle] = useState(false);

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

            // タイマーが0になったら自動停止（自動サイクル中は除く）
            if (currentTimeLeft === 0 && timerData.isRunning && !timerData.isAutoCycle) {
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
            } else if (currentTimeLeft === 0 && timerData.isRunning && timerData.isAutoCycle) {
              console.log('タイマーが0になりました。自動サイクル中なので停止しません。');
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

          // Firestoreから自動サイクル状態を読み取り
          const autoCycleState = timerData.isAutoCycle || false;
          console.log("Firestoreから自動サイクル状態を読み取り:", autoCycleState);
          setIsAutoCycle(autoCycleState);
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
    console.log("自動モード切り替えチェック:", {
      roomId: !!roomId,
      timeLeft: timer.timeLeft,
      isRunning: timer.isRunning,
      isAutoCycle: isAutoCycle,
      mode: timer.mode,
      cycle: timer.cycle,
      condition: !roomId || timer.timeLeft > 0 || !timer.isRunning || !isAutoCycle
    });

    if (!roomId || timer.timeLeft > 0 || !timer.isRunning || !isAutoCycle) {
      console.log("自動モード切り替え条件を満たしていません");
      return;
    }

    console.log("自動モード切り替え条件満たす:", {
      timeLeft: timer.timeLeft,
      isRunning: timer.isRunning,
      isAutoCycle: isAutoCycle,
      mode: timer.mode,
      cycle: timer.cycle
    });

    const switchMode = async () => {
      try {
        const nextMode = switchTimerMode(timer.mode, timer.cycle);
        const nextDuration = getModeDuration(nextMode);
        const newCycle = timer.mode === "work" ? timer.cycle + 1 : timer.cycle;

        console.log(`自動モード切り替え実行: ${timer.mode} → ${nextMode} (サイクル: ${newCycle})`);

        const roomRef = doc(db, "rooms", roomId);
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

        console.log("自動モード切り替え完了");
      } catch (error) {
        console.error("モード切り替えエラー:", error);
      }
    };

    // 少し遅延を入れて確実に実行
    setTimeout(switchMode, 100);
  }, [timer.timeLeft, timer.isRunning, timer.mode, timer.cycle, roomId, isAutoCycle]);

  // ローカル更新用のタイマー（表示のスムーズさのため）
  useEffect(() => {
    if (!timer.isRunning || (timer.timeLeft <= 0 && !isAutoCycle)) {
      console.log("ローカルタイマー停止:", { isRunning: timer.isRunning, timeLeft: timer.timeLeft, isAutoCycle });
      return;
    }

    console.log("ローカルタイマー開始:", { timeLeft: timer.timeLeft });
    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev.timeLeft <= 1) {
          console.log("ローカルタイマー終了", {
            timeLeft: prev.timeLeft,
            isRunning: prev.isRunning,
            mode: prev.mode,
            isAutoCycle: isAutoCycle
          });
          // 自動サイクル中はisRunningをtrueのままにする
          return { ...prev, timeLeft: 0, isRunning: isAutoCycle ? true : false };
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
            timeLeft: timer.timeLeft || getModeDuration(timer.mode),
            pausedAt: null,
            isAutoCycle: true, // Firestoreに自動サイクル状態を保存
            lastUpdated: serverTimestamp()
          }
        });
        console.log("タイマー開始完了、自動サイクル有効");
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
      setIsAutoCycle(false);
      const roomRef = doc(db, "rooms", roomId);
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

  // モード切り替え処理
  const switchMode = async (newMode) => {
    if (!roomId) {
      console.log("roomIdがありません。モード切り替えできません。");
      return;
    }

    console.log("モード切り替え処理:", { roomId, currentMode: timer.mode, newMode });

    try {
      setIsAutoCycle(false); // 手動モード切り替え時は自動サイクルを停止
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
          isAutoCycle: false, // 手動モード切り替え時は自動サイクルを停止
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
    switchMode,
    isAutoCycle
  };
};
