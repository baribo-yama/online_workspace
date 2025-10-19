/**
 * RoomSidebar - ルーム左サイドバーコンポーネント
 *
 * 責務:
 * - 参加者リストの表示
 * - ビデオ通話エリアの表示
 *
 * RoomPage から抽出
 */
import { Suspense, lazy } from "react";
import ParticipantList from "../../../collaboration/components/ParticipantList";
import { LOADING_MESSAGES } from "../../constants";

const VideoCallRoom = lazy(() => import("../../../video-call/components/VideoCallRoom"));

export const RoomSidebar = ({
  roomId,
  userName,
  participants,
  participantsLoading,
  myParticipantId,
  onLeaveRoom,
}) => {
  return (
    <div className="w-1/2 bg-gray-800 border-r border-gray-700 flex flex-col">
      {/* 参加者一覧 */}
      <div className="p-6 border-b border-gray-700">
        <ParticipantList
          participants={participants}
          participantsLoading={participantsLoading}
          myParticipantId={myParticipantId}
        />
      </div>

      {/* LiveKitビデオ通話 */}
      <div className="flex-1">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div
                className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"
                role="status"
              />
              <p className="text-white text-sm">{LOADING_MESSAGES.VIDEO}</p>
            </div>
          </div>
        }>
          <VideoCallRoom
            roomId={roomId}
            userName={userName}
            participants={participants}
            onLeaveRoom={onLeaveRoom}
          />
        </Suspense>
      </div>
    </div>
  );
};

