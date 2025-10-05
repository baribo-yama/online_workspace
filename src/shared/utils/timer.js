// src/shared/utils/timer.js
// タイマー共通ユーティリティ

export const TIMER_STATE = {
  INIT: 'init',
  FOCUS: 'focus',
  POSE: 'pose',
  REST_OR_INIT: 'rest_or_init',
  REST: 'rest',
};

export const TIMER_MODES = {
  WORK: 'work',
  SHORT_BREAK: 'shortBreak',
  LONG_BREAK: 'longBreak'
};

export const TIMER_DURATIONS = {
  FOCUS: 25 * 60,
  SHORT_BREAK: 5 * 60,
  LONG_BREAK: 15 * 60
};

/**
 * 時間を MM:SS 形式でフォーマットする
 * @param {number} seconds - 秒数
 * @returns {string} フォーマットされた時間文字列
 */
export const formatTime = (seconds) => {
  const absSeconds = Math.abs(seconds);
  const mins = Math.floor(absSeconds / 60);
  const secs = absSeconds % 60;
  const sign = seconds < 0 ? "-" : "";
  return `${sign}${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

/**
 * 進捗率を計算する
 * @param {number} timeLeft - 残り時間
 * @param {number} totalDuration - 総時間
 * @returns {number} 進捗率（0-100）
 */
export const calculateProgress = (timeLeft, totalDuration) => {
  if (timeLeft < 0) return 100;
  return ((totalDuration - timeLeft) / totalDuration) * 100;
};

/**
 * オーバータイム進捗率を計算する
 * @param {number} timeLeft - 残り時間（負の値）
 * @param {number} totalDuration - 総時間
 * @returns {number} オーバータイム進捗率（0-100）
 */
export const calculateOverProgress = (timeLeft, totalDuration) => {
  if (timeLeft >= 0) return 0;
  return (Math.abs(timeLeft) / totalDuration) * 100;
};