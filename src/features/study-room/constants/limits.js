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

// ホスト確認通知の設定
export const HOST_INACTIVITY_CONFIG = {
  ROOM_CHECK_INTERVAL_MS: 60 * 1000,    // 2時間（ミリ秒）2 * 60 * 60 * 1000- ルーム作成から定期通知の間隔
  CONFIRMATION_TOAST_DURATION_MS: 20 * 1000, // 10分（ミリ秒）10 * 60 * 1000- 確認トーストの表示時間
};

