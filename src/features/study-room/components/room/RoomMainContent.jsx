/**
 * RoomMainContent - ルーム右メインコンテンツコンポーネント
 *
 * 責務:
 * - ヘッダーの表示
 * - タイマーの表示
 * - ホストコントロールの表示
 *
 * RoomPage から抽出
 */
import SharedTimer from "../../../timer/components/SharedTimer";
import { RoomHeader } from "./RoomHeader";
import { HostControls } from "./HostControls";
import { RoomChat } from "./RoomChat";

export const RoomMainContent = ({
  roomId,
  roomTitle,
  isHost,
  canStartGame,
  gameStatus,
  onLeaveRoom,
  onEndRoom,
  onGameStart,
}) => {
  return (
    <div className="w-1/2 bg-gray-800 flex flex-col">
      {/* ヘッダー */}
      <RoomHeader
        roomTitle={roomTitle}
        roomId={roomId}
        isHost={isHost}
        onLeaveRoom={onLeaveRoom}
        onEndRoom={onEndRoom}
      />

      {/* ポモドーロタイマー */}
      <div className="flex-1 p-6">
        <SharedTimer roomId={roomId} isHost={isHost} />
      </div>

      {/* チャット */}
      <RoomChat roomId={roomId} />

      {/* ホストコントロール */}
      <div className="p-6">
        <HostControls
          isHost={isHost}
          canStartGame={canStartGame}
          gameStatus={gameStatus}
          onGameStart={onGameStart}
        />
      </div>
    </div>
  );
};

