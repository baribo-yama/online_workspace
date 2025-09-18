// 個人用ポモドーロタイマーのフック
import { useState, useEffect } from "react";

export const TIMER_STATE = {
  INIT: 'init',
  FOCUS: 'focus',
  POSE: 'pose',
  REST_OR_INIT: 'rest_or_init',
  REST: 'rest',
};

const FOCUS_DURATION = 25 * 60;
const REST_DURATION = 5 * 60;

export const usePersonalTimer = () => {
  const [state, setState] = useState(TIMER_STATE.INIT);
  const [timeLeft, setTimeLeft] = useState(FOCUS_DURATION);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const isRunning = state === TIMER_STATE.FOCUS || state === TIMER_STATE.REST;

    if (!isRunning) {
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft(time => time - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [state]);

  useEffect(() => {
    if (timeLeft > 0) return;

    if (state === TIMER_STATE.FOCUS) {
      setState(TIMER_STATE.REST);
      setTimeLeft(REST_DURATION); // Start rest timer
      setCycle(c => c + 1); // Increment cycle
    }
  }, [timeLeft, state]);

  const startFocus = () => {
    setState(TIMER_STATE.FOCUS);
    setTimeLeft(FOCUS_DURATION);
  };

  const pause = () => {
    setState(TIMER_STATE.POSE);
  };

  const resume = () => {
    setState(TIMER_STATE.FOCUS);
  };

  const finishFocus = () => {
    setState(TIMER_STATE.REST_OR_INIT);
  };

  const startRest = () => {
    setState(TIMER_STATE.REST);
    setTimeLeft(REST_DURATION);
  };

  const endSession = () => {
    setState(TIMER_STATE.INIT);
    setTimeLeft(FOCUS_DURATION);
    setCycle(0);
  };

  const resumeFocusFromRest = () => {
    setState(TIMER_STATE.FOCUS);
    setTimeLeft(FOCUS_DURATION);
  };


  const formatTime = (seconds) => {
    const absSeconds = Math.abs(seconds);
    const mins = Math.floor(absSeconds / 60);
    const secs = absSeconds % 60;
    const sign = seconds < 0 ? "-" : "";
    return `${sign}${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getProgress = () => {
      switch(state) {
          case TIMER_STATE.FOCUS:
          case TIMER_STATE.POSE:
              return (FOCUS_DURATION - timeLeft) / FOCUS_DURATION * 100;
          case TIMER_STATE.REST_OR_INIT:
              if (timeLeft > 0) {
                  return (FOCUS_DURATION - timeLeft) / FOCUS_DURATION * 100;
              }
              return 100;
          case TIMER_STATE.REST:
              if (timeLeft < 0) return 100;
              return (REST_DURATION - timeLeft) / REST_DURATION * 100;
          default:
              return 0;
      }
  }
  
  const getOverProgress = () => {
      if (state === TIMER_STATE.REST && timeLeft < 0) {
          return (Math.abs(timeLeft) / REST_DURATION) * 100;
      }
      return 0;
  }

  return {
    state,
    timeLeft,
    cycle,
    progress: getProgress(),
    overProgress: getOverProgress(),
    formatTime,
    startFocus,
    pause,
    resume,
    finishFocus,
    startRest,
    endSession,
    resumeFocusFromRest,
  };
};
