// src/features/timer/hooks/useTimerStateMapping.js
// PersonalTimerの状態とSharedTimerの状態を相互変換するマッピング層

import { TIMER_STATE } from "../../../shared/utils/timer";
import { getModeDuration } from "../../../shared/services/firestore";

/**
 * PersonalTimerの状態をSharedTimerの状態に変換
 * @param {string} personalState - TIMER_STATEのいずれか
 * @returns {Object} { mode: 'work' | 'break', isRunning: boolean }
 */
export const mapPersonalStateToShared = (personalState) => {
  switch(personalState) {
    case TIMER_STATE.INIT:
    case TIMER_STATE.POSE:
      return { mode: 'work', isRunning: false };
    case TIMER_STATE.FOCUS:
      return { mode: 'work', isRunning: true };
    case TIMER_STATE.REST_OR_INIT:
      return { mode: 'break', isRunning: false };
    case TIMER_STATE.REST:
      return { mode: 'break', isRunning: true };
    default:
      return { mode: 'work', isRunning: false };
  }
};

/**
 * SharedTimerの状態をPersonalTimerの状態に変換（表示用）
 * @param {string} mode - 'work' | 'break'
 * @param {boolean} isRunning - 実行中かどうか
 * @param {number} timeLeft - 残り時間（秒）
 * @returns {string} TIMER_STATEのいずれか
 */
export const mapSharedStateToPersonal = (mode, isRunning, timeLeft) => {
  if (mode === 'work') {
    if (!isRunning && timeLeft === getModeDuration('work')) {
      return TIMER_STATE.INIT;
    }
    if (isRunning) {
      return TIMER_STATE.FOCUS;
    }
    if (!isRunning) {
      return TIMER_STATE.POSE;
    }
  }
  
  if (mode === 'break' || mode === 'longBreak') {
    if (!isRunning && timeLeft < 0) {
      return TIMER_STATE.REST_OR_INIT;
    }
    if (isRunning) {
      return TIMER_STATE.REST;
    }
    if (!isRunning && timeLeft > 0) {
      return TIMER_STATE.POSE;
    }
    if (!isRunning) {
      return TIMER_STATE.REST_OR_INIT;
    }
  }
  
  return TIMER_STATE.INIT;
};
