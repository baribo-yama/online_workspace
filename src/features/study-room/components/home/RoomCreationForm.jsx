/**
 * RoomCreationForm - 部屋作成フォームコンポーネント
 *
 * 責務:
 * - タイトル入力フィールドの表示
 * - 名前入力フィールドの表示（共通コンポーネント使用）
 * - Slack通知チェックボックスの表示
 * - 作成ボタンの表示と制御
 * - 制限メッセージの表示
 *
 * HomePage から抽出
 *
 * 機能追加 (2025-11-12):
 * - Slack通知チェックボックスを追加
 */
import { Users } from "lucide-react";
import { UserNameInput } from "../shared/UserNameInput";
import { ROOM_LIMITS } from "../../constants";

export const RoomCreationForm = ({
  title,
  onTitleChange,
  name,
  onNameChange,
  onCreateRoom,
  currentRoomCount,
  disabled,
  slackNotificationEnabled,
  onSlackNotificationChange,
  showSlackCheckbox = true,
}) => {
  const isLimitReached = currentRoomCount >= ROOM_LIMITS.MAX_ACTIVE_ROOMS;

  return (
    <div>
      {/* タイトル入力 */}
      <div className="mb-4">
        <input
          value={title}
          onChange={onTitleChange}
          placeholder="部屋のタイトルを入力"
          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 名前入力 */}
      <UserNameInput value={name} onChange={onNameChange} />

      {/* 部屋を作成ボタン & Slackチェックボックス */}
      <div className="mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onCreateRoom}
            disabled={disabled || isLimitReached}
            className={`font-semibold py-3 px-6 rounded-lg shadow-lg transition-all duration-200 flex items-center justify-center gap-2 ${
              !disabled && !isLimitReached
                ? 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-blue-500/25'
                : 'bg-gray-600 text-gray-300 cursor-not-allowed'
            }`}
          >
            <Users className="w-5 h-5" />
            部屋を作成
          </button>
          
          {/* Slack通知チェックボックス（機能フラグがONのときのみ表示） */}
          {showSlackCheckbox && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={slackNotificationEnabled}
                onChange={(e) => onSlackNotificationChange(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-sm text-gray-300">Slackで募集する</span>
            </label>
          )}
        </div>
        
        {isLimitReached && (
          <div className="mt-2 p-3 bg-red-900/50 border border-red-600 rounded text-red-200 text-sm">
            同時に存在できる部屋数の上限（{ROOM_LIMITS.MAX_ACTIVE_ROOMS}部屋）に達しています
          </div>
        )}
      </div>
    </div>
  );
};

