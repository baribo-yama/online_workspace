// src/pages/RoomPage.jsx
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { doc, deleteDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../shared/services/firebase";
import { useState, useEffect } from "react";
import { Home, Trash2 } from "lucide-react";
import SharedTimer from "../../pomodoro-timer/components/SharedTimer";
import ParticipantList from "../../collaboration/components/ParticipantList";
import { useParticipants } from "../../collaboration/hooks/useParticipants";
import ShootingGame from "../../entertainment/components/ShootingGame";

function RoomPage() {
  const { roomId } = useParams();
  const { state } = useLocation();
  const userName = state?.name || localStorage.getItem("userName") || "Guest";

  console.log("RoomPage レンダリング開始:", { roomId, userName, state });

  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTestGame, setShowTestGame] = useState(false);

  // 参加者管理フックを使用
  const { participants, participantsLoading, myParticipantId, leaveRoom } = useParticipants(roomId, userName);

  // ホスト判定
  const isHost = room?.hostId === myParticipantId;

  // 部屋情報の取得
  useEffect(() => {
    console.log("部屋データ取得開始:", roomId);
    const roomDocRef = doc(db, "rooms", roomId);

    const unsubscribe = onSnapshot(roomDocRef, (doc) => {
      console.log("部屋データ更新:", doc.exists(), doc.data());
      if (doc.exists()) {
        const roomData = doc.data();
        setRoom(roomData);
        setLoading(false);

        // ゲーム状態の監視
        const gameStatus = roomData.game?.status || "idle";
        console.log("ゲーム状態:", gameStatus);

        // ゲームが開始されたら自動的にゲーム画面を表示
        if (gameStatus === "playing") {
          console.log("ゲーム開始 - 自動表示");
          setShowTestGame(true);
        } else if (gameStatus === "idle") {
          console.log("ゲーム終了 - 自動非表示");
          setShowTestGame(false);
        }
      } else {
        console.log("部屋が見つかりません:", roomId);
        alert("部屋が見つかりません");
        navigate("/");
      }
    }, (error) => {
      console.error("部屋データ取得エラー:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [roomId, navigate]);

  const handleLeaveRoom = async () => {
    await leaveRoom();
    navigate("/");
  };

  const endRoom = async () => {
    const confirmEnd = window.confirm(
      "この部屋を終了しますか？\n\n部屋を終了すると、すべての参加者が退出され、部屋のデータが削除されます。この操作は取り消せません。"
    );

    if (confirmEnd) {
      try {
        await deleteDoc(doc(db, "rooms", roomId));
        console.log("部屋が終了されました:", roomId);
        navigate("/");
      } catch (error) {
        console.error("部屋終了でエラーが発生しました:", error);
        alert("部屋の終了に失敗しました。もう一度お試しください。");
      }
    }
  };

  // テスト用ゲーム開始
  const startTestGame = () => {
    setShowTestGame(true);
  };

  // ゲーム終了時の処理
  const handleGameEnd = (score) => {
    console.log(`テストゲーム終了！スコア: ${score}`);
    setShowTestGame(false);
  };

  if (loading) {
    console.log("ローディング画面を表示中");
    return (
      <div className="flex h-screen bg-gray-900 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">部屋を読み込み中...</p>
        </div>
      </div>
    );
  }

  console.log("メインレンダリング開始:", { room, participants, loading, participantsLoading });

  return (
    <div className="flex h-screen bg-gray-900">
      {/* 左半分 - 参加者一覧 */}
      <div className="w-1/2 bg-gray-800 border-r border-gray-700 p-6 flex flex-col">
        {/* MVP制限情報表示 */}
        <div className="mb-4 p-3 bg-purple-900/20 border border-purple-500 rounded text-purple-200 text-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold">MVP版制限</span>
          </div>
          <p>最大5人まで参加可能（ホスト含む）</p>
        </div>

        {/* ヘッダー */}
        <div className="mb-6">
          <div className="flex gap-2 mb-4">
            <button
              onClick={handleLeaveRoom}
              className="flex items-center gap-2 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 px-3 py-2 rounded-lg transition-all duration-200 border border-transparent hover:border-blue-500/30"
            >
              <Home className="w-4 h-4" />
              ルーム一覧に戻る
            </button>

            <button
              onClick={endRoom}
              className="flex items-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 px-3 py-2 rounded-lg transition-all duration-200 border border-transparent hover:border-red-500/30"
            >
              <Trash2 className="w-4 h-4" />
              部屋を終了
            </button>
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">
            {room?.title || "勉強部屋"}
          </h1>
          <p className="text-gray-400 text-sm">
            部屋ID: <span className="font-mono text-blue-300">{roomId}</span>
          </p>
        </div>

        {/* 参加者セクション */}
        <ParticipantList
          participants={participants}
          participantsLoading={participantsLoading}
          myParticipantId={myParticipantId}
        />

        {/* ゲームボタン（ホストのみ、休憩時間中のみ表示、ゲーム未開始時のみ） */}
        {isHost && room?.timer?.mode === 'break' && room?.game?.status !== 'playing' && (
          <div className="mt-4">
            <button
              onClick={startTestGame}
              className="bg-orange-600 hover:bg-orange-700 px-3 py-1 rounded text-white text-sm font-medium transition-colors flex items-center gap-2"
            >
              🎯 ゲーム開始
            </button>
          </div>
        )}

        {/* ゲーム中表示 */}
        {room?.game?.status === 'playing' && (
          <div className="mt-4 p-2 bg-green-900/20 border border-green-500 rounded text-green-200 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-semibold">🎮 ゲーム中</span>
            </div>
            <p className="text-xs mt-1">全員がゲームに参加しています</p>
          </div>
        )}

        {/* ホスト情報表示 */}
        {isHost && (
          <div className="mt-4 p-2 bg-yellow-900/20 border border-yellow-500 rounded text-yellow-200 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-semibold">👑 あなたがホストです</span>
            </div>
            <p className="text-xs mt-1">タイマーとゲームの制御ができます</p>
          </div>
        )}
      </div>

      {/* 右半分 - 共有ポモドーロタイマー */}
      <div className="w-1/2 bg-gray-900 p-6">
        <SharedTimer roomId={roomId} isHost={isHost} />
      </div>

      {/* テスト用ゲームオーバーレイ */}
      {showTestGame && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="max-w-4xl w-full mx-4">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-white mb-2">
                🎯 シューティングゲーム
              </h2>
              <p className="text-gray-300 text-lg">
                ターゲットをクリックしてスコアを稼ごう！
              </p>
            </div>

            <ShootingGame
              roomId={roomId}
              userName={userName}
              isHost={isHost}
            />

            <div className="text-center mt-4">
              {isHost ? (
                <button
                  onClick={() => setShowTestGame(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ゲームを終了
                </button>
              ) : (
                <p className="text-gray-400 text-sm">
                  ホストがゲームを終了するまでお待ちください
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RoomPage;
