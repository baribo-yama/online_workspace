// 個人用ポモドーロタイマーのフック// 個人用ポモドーロタイマーのフック

import { useState, useEffect } from "react";import { useState, useEffect } from "react";

import { import { 

  TIMER_STATE,   TIMER_STATE, 

  TIMER_DURATIONS,   TIMER_DURATIONS, 

  formatTime,   formatTime, 

  calculateProgress,   calculateProgress, 

  calculateOverProgress   calculateOverProgress 

} from "../../shared/utils/timer";} from "../../shared/utils/timer";



export { TIMER_STATE };export { TIMER_STATE };



export const usePersonalTimer = () => {export const usePersonalTimer = () => {

  const [state, setState] = useState(TIMER_STATE.INIT);  const [state, setState] = useState(TIMER_STATE.INIT);

  const [timeLeft, setTimeLeft] = useState(TIMER_DURATIONS.FOCUS);  const [timeLeft, setTimeLeft] = useState(TIMER_DURATIONS.FOCUS);

  const [cycle, setCycle] = useState(0);  const [cycle, setCycle] = useState(0);



  useEffect(() => {  useEffect(() => {

    const isRunning = state === TIMER_STATE.FOCUS || state === TIMER_STATE.REST;    const isRunning = state === TIMER_STATE.FOCUS || state === TIMER_STATE.REST;



    if (!isRunning) {    if (!isRunning) {

      return;      return;

    }    }



    const interval = setInterval(() => {    const interval = setInterval(() => {

      setTimeLeft(time => time - 1);      setTimeLeft(time => time - 1);

    }, 1000);    }, 1000);



    return () => clearInterval(interval);    return () => clearInterval(interval);

  }, [state]);  }, [state]);



  useEffect(() => {  useEffect(() => {

    if (timeLeft > 0) return;    if (timeLeft > 0) return;



    if (state === TIMER_STATE.FOCUS) {    if (state === TIMER_STATE.FOCUS) {

      setState(TIMER_STATE.REST);      setState(TIMER_STATE.REST);

      setTimeLeft(TIMER_DURATIONS.SHORT_BREAK);      setTimeLeft(TIMER_DURATIONS.SHORT_BREAK);

      setCycle(c => c + 1);      setCycle(c => c + 1);

    }    }

  }, [timeLeft, state]);  }, [timeLeft, state]);



  const startFocus = () => {  const startFocus = () => {

    setState(TIMER_STATE.FOCUS);    setState(TIMER_STATE.FOCUS);

    setTimeLeft(TIMER_DURATIONS.FOCUS);    setTimeLeft(FOCUS_DURATION);

  };  };



  const pause = () => {  const pause = () => {

    setState(TIMER_STATE.POSE);    setState(TIMER_STATE.POSE);

  };  };



  const resume = () => {  const resume = () => {

    setState(TIMER_STATE.FOCUS);    setState(TIMER_STATE.FOCUS);

  };  };



  const finishFocus = () => {  const finishFocus = () => {

    setState(TIMER_STATE.REST_OR_INIT);    setState(TIMER_STATE.REST_OR_INIT);

    setTimeLeft(-1);  };

  };

  const startRest = () => {

  const startRest = () => {    setState(TIMER_STATE.REST);

    setState(TIMER_STATE.REST);    setTimeLeft(REST_DURATION);

    setTimeLeft(TIMER_DURATIONS.SHORT_BREAK);  };

  };

  const endSession = () => {

  const endSession = () => {    setState(TIMER_STATE.INIT);

    setState(TIMER_STATE.INIT);    setTimeLeft(FOCUS_DURATION);

    setTimeLeft(TIMER_DURATIONS.FOCUS);    setCycle(0);

    setCycle(0);  };

  };

  const resumeFocusFromRest = () => {

  const resumeFocusFromRest = () => {    setState(TIMER_STATE.FOCUS);

    setState(TIMER_STATE.FOCUS);    setTimeLeft(FOCUS_DURATION);

    setTimeLeft(TIMER_DURATIONS.FOCUS);  };

  };



  const getProgress = () => {  const formatTime = (seconds) => {

    switch(state) {    const absSeconds = Math.abs(seconds);

      case TIMER_STATE.FOCUS:    const mins = Math.floor(absSeconds / 60);

      case TIMER_STATE.POSE:    const secs = absSeconds % 60;

        return calculateProgress(timeLeft, TIMER_DURATIONS.FOCUS);    const sign = seconds < 0 ? "-" : "";

      case TIMER_STATE.REST_OR_INIT:    return `${sign}${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;

        if (timeLeft > 0) {  };

          return calculateProgress(timeLeft, TIMER_DURATIONS.FOCUS);

        }  const getProgress = () => {

        return 100;      switch(state) {

      case TIMER_STATE.REST:          case TIMER_STATE.FOCUS:

        if (timeLeft < 0) return 100;          case TIMER_STATE.POSE:

        return calculateProgress(timeLeft, TIMER_DURATIONS.SHORT_BREAK);              return (FOCUS_DURATION - timeLeft) / FOCUS_DURATION * 100;

      default:          case TIMER_STATE.REST_OR_INIT:

        return 0;              if (timeLeft > 0) {

    }                  return (FOCUS_DURATION - timeLeft) / FOCUS_DURATION * 100;

  }              }

                return 100;

  const getOverProgress = () => {          case TIMER_STATE.REST:

    if (state === TIMER_STATE.REST && timeLeft < 0) {              if (timeLeft < 0) return 100;

      return calculateOverProgress(timeLeft, TIMER_DURATIONS.SHORT_BREAK);              return (REST_DURATION - timeLeft) / REST_DURATION * 100;

    }          default:

    return 0;              return 0;

  }      }

  }

  return {  

    state,  const getOverProgress = () => {

    timeLeft,      if (state === TIMER_STATE.REST && timeLeft < 0) {

    cycle,          return (Math.abs(timeLeft) / REST_DURATION) * 100;

    progress: getProgress(),      }

    overProgress: getOverProgress(),      return 0;

    formatTime,  }

    startFocus,

    pause,  return {

    resume,    state,

    finishFocus,    timeLeft,

    startRest,    cycle,

    endSession,    progress: getProgress(),

    resumeFocusFromRest,    overProgress: getOverProgress(),

  };    formatTime,

};    startFocus,
    pause,
    resume,
    finishFocus,
    startRest,
    endSession,
    resumeFocusFromRest,
  };
};
