/**
 * RoomHeader - ルームヘッダーコンポーネント
 *
 * 責務:
 * - ルームタイトルの表示
 * - ゲスト: 退出ボタンのみ表示
 * - ホスト: 終了ボタンのみ表示
 *
 * 仕様:
 * - ホストには部屋を終了するボタンだけが表示される
 * - ゲストにはルーム一覧に戻るボタンだけが表示される
 */
import { Home, Trash2 } from "lucide-react";
import { ROOM_DEFAULTS } from "../../constants";

export const RoomHeader = ({
  roomTitle,
  roomId,
  isHost,
  onLeaveRoom,
  onEndRoom
}) => {
  return (
    <div className="p-6 border-b border-gray-700">
      <div className="flex gap-2 mb-4">
        {/* ゲストには退出ボタンのみ表示 */}
        {!isHost && (
          <button
            onClick={onLeaveRoom}
            className="flex items-center gap-2 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 px-3 py-2 rounded-lg transition-all duration-200 border border-transparent hover:border-blue-500/30"
            aria-label="ルーム一覧に戻る"
          >
            <Home className="w-4 h-4" />
            ルーム一覧に戻る
          </button>
        )}

        {/* ホストには終了ボタンのみ表示 */}
        {isHost && (
          <button
            onClick={onEndRoom}
            className="flex items-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 px-3 py-2 rounded-lg transition-all duration-200 border border-transparent hover:border-red-500/30"
            aria-label="部屋を終了"
          >
            <Trash2 className="w-4 h-4" />
            部屋を終了
          </button>
        )}
      </div>

      <h1 className="text-2xl font-bold text-white mb-2">
        {roomTitle || ROOM_DEFAULTS.UNTITLED_ROOM}
      </h1>
      <p className="text-gray-400 text-sm">
        部屋ID: <span className="font-mono text-blue-300">{roomId}</span>
      </p>
    </div>
  );
};

