/**
 * RoomCard - 個別の部屋カードコンポーネント
 *
 * 責務:
 * - 部屋情報の表示（タイトル、参加者数、ステータス）
 * - 参加者名の表示
 * - クリックイベントの伝播
 *
 * HomePage から抽出
 */
import { Users } from "lucide-react";
import { ROOM_LIMITS } from "../../constants";

export const RoomCard = ({ room, participants, onClick }) => {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className="bg-gray-700 border border-gray-600 rounded-lg p-4 hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`部屋「${room.title || "無題の部屋"}」に参加する`}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg text-white font-semibold">{room.title || "無題の部屋"}</h3>
        <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full">
          アクティブ
        </span>
      </div>
      <div className="flex items-center justify-between text-sm text-gray-300 mb-2">
        <div className="flex items-center gap-1">
          <Users className="w-4 h-4" />
          <span>{room.participantsCount || 0}/{ROOM_LIMITS.MAX_PARTICIPANTS}</span>
        </div>
        <span className="bg-gray-600 text-gray-300 text-xs px-2 py-1 rounded">
          {room.subject || "一般"}
        </span>
      </div>
      {/* 参加者名表示 */}
      {participants && participants.length > 0 && (
        <div className="text-xs text-gray-400">
          <span className="text-gray-500">参加者：</span>
          {participants.join("　")}
        </div>
      )}
    </div>
  );
};

