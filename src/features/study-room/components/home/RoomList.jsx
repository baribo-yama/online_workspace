/**
 * RoomList - 部屋一覧表示コンポーネント
 *
 * 責務:
 * - 部屋カードのリスト表示
 * - ローディング状態の表示
 * - 空状態の表示
 *
 * HomePage から抽出
 */
import { Users } from "lucide-react";
import { RoomCard } from "./RoomCard";

export const RoomList = ({ rooms, roomParticipants, loading, onJoinRoom }) => {
  // ローディング中
  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400">部屋一覧を読み込み中...</p>
      </div>
    );
  }

  // 部屋が存在する場合
  if (rooms.length > 0) {
    return (
      <div className="space-y-4">
        {rooms.map((room) => (
          <RoomCard
            key={room.id}
            room={room}
            participants={roomParticipants[room.id]}
            onClick={() => onJoinRoom(room.id)}
          />
        ))}
      </div>
    );
  }

  // 部屋が存在しない場合
  return (
    <div className="text-center py-8">
      <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
      <p className="text-gray-400">現在アクティブな部屋がありません</p>
      <p className="text-gray-500 text-sm mt-1">新しい部屋を作成してみましょう</p>
    </div>
  );
};

