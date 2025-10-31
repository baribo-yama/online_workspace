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
  isHost,
  myParticipantId,
}) => {
  return (
    <div className="w-1/2 bg-gray-800 flex flex-col h-screen">
      {/* ポモドーロタイマー（タイマーボタンが見えるサイズ） */}
      <div className="h-3/5 border-b border-gray-700 flex">
        <SharedTimer roomId={roomId} isHost={isHost} myParticipantId={myParticipantId} />
      </div>

      {/* チャット */}
      <div className="flex-1 overflow-hidden">
        <RoomChat roomId={roomId} myParticipantId={myParticipantId} />
      </div>

      {/* ホストコントロール */}
      {/* <div className="p-6">
        <HostControls
          isHost={isHost}
          canStartGame={canStartGame}
          gameStatus={gameStatus}
          onGameStart={onGameStart}
        />
      </div> */}
    </div>
  );
};
