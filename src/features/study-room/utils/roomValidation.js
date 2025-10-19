/**
 * roomValidation - ルーム関連のバリデーション関数
 *
 * 責務:
 * - 部屋タイトルのバリデーション
 * - ユーザー名のバリデーション
 * - 部屋作成可否の判定
 *
 * 純粋関数として実装（副作用なし）
 */
import { ROOM_LIMITS, ROOM_ERRORS } from "../constants";

/**
 * 部屋タイトルのバリデーション
 * @param {string} title - 部屋タイトル
 * @returns {Object} { valid: boolean, error?: string }
 */
export const validateRoomTitle = (title) => {
  if (!title || !title.trim()) {
    return { valid: false, error: ROOM_ERRORS.TITLE_REQUIRED };
  }
  return { valid: true };
};

/**
 * ユーザー名のバリデーション
 * @param {string} name - ユーザー名
 * @returns {Object} { valid: boolean, error?: string }
 */
export const validateUserName = (name) => {
  if (!name || !name.trim()) {
    return { valid: false, error: ROOM_ERRORS.NAME_REQUIRED };
  }
  return { valid: true };
};

/**
 * 部屋作成可否の判定
 * @param {number} currentRoomCount - 現在の部屋数
 * @returns {boolean} 作成可能ならtrue
 */
export const canCreateRoom = (currentRoomCount) => {
  return currentRoomCount < ROOM_LIMITS.MAX_ACTIVE_ROOMS;
};

/**
 * 参加者がアクティブかどうかの判定
 * @param {Object} participant - 参加者オブジェクト
 * @param {number} now - 現在時刻（ミリ秒）
 * @returns {boolean} アクティブならtrue
 */
export const isParticipantActive = (participant, now) => {
  if (!participant.joinedAt) {
    return true; // joinedAtがない場合はアクティブとみなす
  }

  const joinedTime = participant.joinedAt.toDate
    ? participant.joinedAt.toDate().getTime()
    : participant.joinedAt;

  return (now - joinedTime) <= ROOM_LIMITS.PARTICIPANT_TIMEOUT_MS;
};

