import { useState, useEffect } from "react";
import {
  TIMER_STATE,
  TIMER_DURATIONS,
  formatTime,
  calculateProgress,
  calculateOverProgress
} from "../../../shared/utils/timer";

export { TIMER_STATE };

export const usePersonalTimer = () => {
  const [state, setState] = useState(TIMER_STATE.INIT);
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATIONS.FOCUS);
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
      setTimeLeft(TIMER_DURATIONS.SHORT_BREAK);
      setCycle(c => c + 1);
    }
  }, [timeLeft, state]);

  const startFocus = () => {
    setState(TIMER_STATE.FOCUS);
    setTimeLeft(TIMER_DURATIONS.FOCUS);
  };

  const pause = () => {
    setState(TIMER_STATE.POSE);
  };

  const resume = () => {
    setState(TIMER_STATE.FOCUS);
  };

  const finishFocus = () => {
    setState(TIMER_STATE.REST_OR_INIT);
    setTimeLeft(-1);
  };

  const startRest = () => {
    setState(TIMER_STATE.REST);
    setTimeLeft(TIMER_DURATIONS.SHORT_BREAK);
  };

  const endSession = () => {
    setState(TIMER_STATE.INIT);
    setTimeLeft(TIMER_DURATIONS.FOCUS);
    setCycle(0);
  };

  const resumeFocusFromRest = () => {
    setState(TIMER_STATE.FOCUS);
    setTimeLeft(TIMER_DURATIONS.FOCUS);
  };

  const getProgress = () => {
    switch(state) {
      case TIMER_STATE.FOCUS:
      case TIMER_STATE.POSE:
        return calculateProgress(timeLeft, TIMER_DURATIONS.FOCUS);
      case TIMER_STATE.REST_OR_INIT:
        if (timeLeft > 0) {
          return calculateProgress(timeLeft, TIMER_DURATIONS.FOCUS);
        }
        return 100;
      case TIMER_STATE.REST:
        if (timeLeft < 0) return 100;
        return calculateProgress(timeLeft, TIMER_DURATIONS.SHORT_BREAK);
      default:
        return 0;
    }
  };

  const getOverProgress = () => {
    if (state === TIMER_STATE.REST && timeLeft < 0) {
      return calculateOverProgress(timeLeft, TIMER_DURATIONS.SHORT_BREAK);
    }
    return 0;
  };

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
