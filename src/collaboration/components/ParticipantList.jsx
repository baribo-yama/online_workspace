// 参加者一覧コンポーネント
import { Users } from "lucide-react";

function ParticipantList({ participants, participantsLoading, myParticipantId }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-white">参加者</h2>
          <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full">
            {participants?.length || 0}人
          </span>
        </div>
      </div>

      <p className="text-gray-400 text-sm mb-6">一緒に勉強している仲間たち</p>

      <div className="space-y-3">
        {participantsLoading && (
          <div className="text-center py-4">
            <p className="text-gray-400 text-sm">参加者を読み込み中...</p>
          </div>
        )}

        {!participantsLoading && participants?.map((participant, index) => {
          const isCurrentUser = participant.id === myParticipantId;

          return (
            <div
              key={participant.id}
              className="bg-gray-700 rounded-lg p-4 border border-gray-600 hover:bg-gray-650 transition-colors"
            >
              <div className="flex items-center gap-3">
                {/* 参加者のアバター */}
                <div className="relative">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                    isCurrentUser ? 'bg-blue-500' : 'bg-green-500'
                  }`}>
                    {participant.name ? participant.name.charAt(0).toUpperCase() : "U"}
                  </div>
                  {/* オンライン状態インジケーター */}
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-gray-800 bg-green-500" />
                </div>

                {/* 参加者名 */}
                <div className="flex-1">
                  <p className="text-white font-medium">
                    {participant.name || `ユーザー${index + 1}`}
                    {isCurrentUser && (
                      <span className="text-blue-400 text-xs ml-2">(あなた)</span>
                    )}
                  </p>
                  <p className="text-xs flex items-center gap-1 text-green-400">
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                    オンライン
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        {!participantsLoading && (!participants || participants.length === 0) && (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-400">まだ参加者がいません</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ParticipantList;
