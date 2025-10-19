/**
 * errors - エラーメッセージ定数
 *
 * アプリケーション全体で使用するエラーメッセージ
 */
import { ROOM_LIMITS } from "./limits";

// エラーメッセージ（動的に生成）
export const ROOM_ERRORS = {
  NOT_FOUND: "部屋が見つかりません",
  ROOM_FULL: "この部屋は満員です",
  NOT_HOST: "部屋を終了できるのはホストのみです",
  END_FAILED: "部屋の終了に失敗しました。もう一度お試しください",
  LEAVE_FAILED: "退出処理でエラーが発生しました",
  NAME_REQUIRED: "名前を入力してください",
  TITLE_REQUIRED: "部屋のタイトルを入力してください",
  CREATE_FAILED: "部屋の作成に失敗しました。もう一度お試しください",
  ROOMS_LIMIT_REACHED: `現在、同時に存在できる部屋数の上限（${ROOM_LIMITS.MAX_ACTIVE_ROOMS}部屋）に達しています。\nしばらく時間をおいてからお試しください。`,
};

