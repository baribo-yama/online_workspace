/**
 * RoomMainContent - ルーム右メインコンテンツコンポーネント
 *
 * 責務:
 * - タイマーの表示
 * - チャットの表示
 * - ホストコントロールの表示
 *
 * RoomPage から抽出
 */
import SharedTimer from "../../../timer/components/SharedTimer";
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
      {/* ポモドーロタイマー（タイマーボタンが見えるサイズ） */}
      <div className="flex-1 p-6 items-center justify-center border-b border-gray-700">
        <SharedTimer roomId={roomId} isHost={isHost} />
      </div>

      {/* チャット */}
      <div className="h-1/3 overflow-hidden">
        <RoomChat roomId={roomId} />
      </div>

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

