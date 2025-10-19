/**
 * HomePage - ホームページ（部屋一覧）
 *
 * 責務:
 * - レイアウトの統合
 * - カスタムフックの統合
 * - 各サブコンポーネントへのprops渡し
 *
 * リファクタリング:
 * - ロジックをhooksに分離
 * - UIコンポーネントを分割
 * - 268行 → 約100行に削減
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PersonalTimer from "../../../timer/components/PersonalTimer";
import { useRoomsList } from "../../hooks/home/useRoomsList";
import { useRoomCreation } from "../../hooks/home/useRoomCreation";
import { useParticipantsData } from "../../hooks/home/useParticipantsData";
import { useUserName } from "../../hooks/shared/useUserName";
import { RoomCreationForm } from "./RoomCreationForm";
import { RoomList } from "./RoomList";
import { ROOM_LIMITS } from "../../constants";
import { validateUserName } from "../../utils";

function HomePage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");

  // カスタムフック
  const { rooms, loading } = useRoomsList();
  const { createRoom, creating } = useRoomCreation();
  const { roomParticipants } = useParticipantsData(rooms);
  const { name, handleNameChange } = useUserName();

  // 部屋作成ハンドラ
  const handleCreateRoom = () => {
    createRoom(title, name, rooms.length).then((success) => {
      if (success) {
        setTitle(""); // 作成成功時のみタイトルをクリア
      }
    });
  };

  // 部屋参加ハンドラ
  const joinRoom = (roomId) => {
    const userNameValidation = validateUserName(name);
    if (!userNameValidation.valid) {
      alert(userNameValidation.error);
      return;
    }
    console.log("部屋に参加:", { roomId, name: name.trim() });
    navigate(`/room/${roomId}`, { state: { name: name.trim() } });
  };

  return (
    <div className="flex h-screen bg-gray-900">
      {/* 左側 - 部屋一覧 */}
      <div className="w-1/2 bg-gray-800 border-r border-gray-700 p-6 overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">オンライン自習室</h1>
          <p className="text-gray-400">集中して学習できる環境を選んでください</p>
          <p className="text-gray-400 text-sm mt-1">
            現在の部屋数: {rooms.length}/{ROOM_LIMITS.MAX_ACTIVE_ROOMS} (MVP制限)
          </p>
        </div>

        {/* 部屋作成フォーム */}
        <RoomCreationForm
          title={title}
          onTitleChange={(e) => setTitle(e.target.value)}
          name={name}
          onNameChange={handleNameChange}
          onCreateRoom={handleCreateRoom}
          currentRoomCount={rooms.length}
          disabled={creating}
        />

        {/* 部屋一覧 */}
        <RoomList
          rooms={rooms}
          roomParticipants={roomParticipants}
          loading={loading}
          onJoinRoom={joinRoom}
        />
      </div>

      {/* 右側 - 個人用ポモドーロタイマー */}
      <div className="w-1/2 flex flex-col items-center justify-center p-8 bg-gradient-to-br from-gray-900 via-gray-800 to-blue-900">
        <PersonalTimer />
      </div>
    </div>
  );
}

export default HomePage;

