/**
 * ルーム関連の定数定義
 *
 * マジックナンバー・マジックストリングを排除し、
 * 一箇所で管理することで保守性を向上
 */

// ルーム制限
export const ROOM_LIMITS = {
  MAX_PARTICIPANTS: 5,           // 1部屋の最大参加者数
  MAX_ACTIVE_ROOMS: 3,           // 同時に存在できる最大部屋数（MVP制限）
  PARTICIPANT_TIMEOUT_MS: 300000, // 参加者のタイムアウト（5分）
};

// エラーメッセージ
export const ROOM_ERRORS = {
  NOT_FOUND: "部屋が見つかりません",
  ROOM_FULL: "この部屋は満員です",
  NOT_HOST: "部屋を終了できるのはホストのみです",
  END_FAILED: "部屋の終了に失敗しました。もう一度お試しください",
  LEAVE_FAILED: "退出処理でエラーが発生しました",
  NAME_REQUIRED: "名前を入力してください",
  TITLE_REQUIRED: "部屋のタイトルを入力してください",
};

// 確認メッセージ
export const ROOM_CONFIRMS = {
  END_ROOM: "この部屋を終了しますか？\n\n部屋を終了すると、すべての参加者が退出され、部屋のデータが削除されます。この操作は取り消せません。",
};

// ゲームステータス
export const GAME_STATUS = {
  IDLE: "idle",
  PLAYING: "playing",
};

// ローディングメッセージ
export const LOADING_MESSAGES = {
  ROOM: "部屋を読み込み中...",
  VIDEO: "ビデオ通話を読み込み中...",
  GAME: "ゲームを読み込み中...",
};

// デフォルト値
export const ROOM_DEFAULTS = {
  GUEST_NAME: "Guest",
  UNTITLED_ROOM: "勉強部屋",
};

