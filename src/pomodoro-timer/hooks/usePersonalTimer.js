// 個人用ポモドーロタイマーのフック
import { useState, useEffect } from "react";

export const usePersonalTimer = () => {
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25分
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState('work'); // 'work', 'break'
  const [cycle, setCycle] = useState(0);

  // ポモドーロタイマーロジック
  useEffect(() => {
    let interval = null;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsRunning(false);
      // 自動的にモード切り替え
      if (mode === 'work') {
        setMode('break');
        setTimeLeft(5 * 60); // 5分休憩
        setCycle(cycle + 1);
      } else {
        setMode('work');
        setTimeLeft(25 * 60); // 25分作業
      }
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, timeLeft, mode, cycle]);

  const startTimer = () => setIsRunning(!isRunning);

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(mode === 'work' ? 25 * 60 : 5 * 60);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = ((mode === 'work' ? 25 * 60 : 5 * 60) - timeLeft) / (mode === 'work' ? 25 * 60 : 5 * 60) * 100;

  return {
    timeLeft,
    isRunning,
    mode,
    cycle,
    progress,
    formatTime,
    startTimer,
    resetTimer
  };
};
