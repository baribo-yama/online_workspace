/**
 * limits - 制限値定数
 *
 * ルーム、参加者、タイマーなどの制限値を定義
 */

// ルーム制限
export const ROOM_LIMITS = {
  MAX_PARTICIPANTS: 5,            // 1部屋の最大参加者数
  MAX_ACTIVE_ROOMS: 3,            // 同時に存在できる最大部屋数（MVP制限）
  PARTICIPANT_TIMEOUT_MS: 300000, // 参加者のタイムアウト（5分）
  ROOMS_LIST_LIMIT: 10,           // 部屋一覧の取得上限
};

