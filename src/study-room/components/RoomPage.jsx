/**
 * RoomPage コンポーネント
 *
 * 勉強ルームのメインページコンポーネント
 * LiveKitビデオ通話、ポモドーロタイマー、ゲーム機能を統合
 *
 * 主な機能:
 * - リアルタイムビデオ通話（LiveKit）
 * - 共有ポモドーロタイマー
 * - 参加者管理とホスト権限
 * - エンターテイメントゲーム
 * - 部屋の終了と退出
 *
 * @component
 */
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { doc, deleteDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../shared/services/firebase";
import { useState, useEffect, lazy, Suspense } from "react";
import { Home, Trash2 } from "lucide-react";
import SharedTimer from "../../pomodoro-timer/components/SharedTimer";
import ParticipantList from "../../collaboration/components/ParticipantList";
import { useParticipants } from "../../collaboration/hooks/useParticipants";

// 大きなコンポーネントを遅延読み込み
const FaceObstacleGame = lazy(() => import("../../entertainment/components/FaceObstacleGame"));
const VideoCallRoom = lazy(() => import("../../components/VideoCallRoom"));

function RoomPage() {
  // === ルーティング情報の取得 ===
  const { roomId } = useParams();                                    // URLからルームIDを取得
  const { state } = useLocation();                                   // ナビゲーション状態
  const userName = state?.name || localStorage.getItem("userName") || "Guest"; // ユーザー名の取得

  console.log("RoomPage レンダリング開始:", { roomId, userName, state });

  // === ナビゲーション ===
  const navigate = useNavigate();

  // === 状態管理 ===
  const [room, setRoom] = useState(null);                            // ルーム情報
  const [loading, setLoading] = useState(true);                      // ローディング状態
  const [showTestGame, setShowTestGame] = useState(false);           // ゲーム表示フラグ
  const [gameType, setGameType] = useState("face");                  // ゲームタイプ（顔認識ゲーム）

  // === 参加者管理フック ===
  const { participants, participantsLoading, myParticipantId, leaveRoom } = useParticipants(roomId, userName);

  // === ホスト権限の判定 ===
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
    try {
      console.log("ルームから退出中...");

      // 参加者データから退出
      await leaveRoom();

      // 少し遅延させてからホームページに戻る（LiveKit切断処理の完了を待つ）
      setTimeout(() => {
        console.log("ホームページに戻ります");
        navigate("/");
      }, 500);

    } catch (error) {
      console.error("ルーム退出エラー:", error);
      // エラーが発生してもホームページに戻る
      navigate("/");
    }
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
      {/* 左半分 - ヘッダー + 参加者一覧 + LiveKitビデオ通話 */}
      <div className="w-1/2 bg-gray-800 border-r border-gray-700 flex flex-col">
        {/* ヘッダー */}
        <div className="p-6 border-b border-gray-700">
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

        {/* 参加者一覧 */}
        <div className="p-6 border-b border-gray-700">
          <ParticipantList
            participants={participants}
            participantsLoading={participantsLoading}
            myParticipantId={myParticipantId}
          />
        </div>

        {/* ゲームボタン（ホストのみ、休憩時間中のみ表示、ゲーム未開始時のみ） */}
        {isHost && room?.timer?.mode === 'break' && room?.game?.status !== 'playing' && (
          <div className="mt-4 space-y-2">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setGameType("face");
                  setShowTestGame(true);
                }}
                className="bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded text-white text-sm font-medium transition-colors flex items-center gap-2"
              >
                🎭 顔障害物ゲーム
              </button>
            </div>
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

        {/* LiveKitビデオ通話 */}
        <div className="flex-1">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                <p className="text-white text-sm">ビデオ通話を読み込み中...</p>
              </div>
            </div>
          }>
            <VideoCallRoom
              roomId={roomId}
              userName={userName}
              participants={participants}
              onLeaveRoom={handleLeaveRoom}
            />
          </Suspense>
        </div>
      </div>

      {/* 右半分 - ポモドーロタイマーとゲーム機能のみ */}
      <div className="w-1/2 bg-gray-800 p-6 flex flex-col">
        {/* ポモドーロタイマー */}
        <div className="flex-1 mb-6">
          <SharedTimer roomId={roomId} isHost={isHost} />
        </div>

        {/* ゲーム機能セクション */}
        <div className="space-y-4">
          {/* ゲームボタン（ホストのみ、休憩時間中のみ表示、ゲーム未開始時のみ） */}
          {isHost && room?.timer?.mode === 'break' && room?.game?.status !== 'playing' && (
            <div>
              <button
                onClick={() => {
                  setGameType("face");
                  setShowTestGame(true);
                }}
                className="bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded text-white font-medium transition-colors flex items-center gap-2 w-full justify-center"
              >
                🎯 ゲーム開始
              </button>
            </div>
          )}

          {/* ゲーム中表示 */}
          {room?.game?.status === 'playing' && (
            <div className="p-3 bg-green-900/20 border border-green-500 rounded text-green-200 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold">🎮 ゲーム中</span>
              </div>
              <p className="text-xs mt-1">全員がゲームに参加しています</p>
            </div>
          )}

          {/* ホスト情報表示 */}
          {isHost && (
            <div className="p-3 bg-yellow-900/20 border border-yellow-500 rounded text-yellow-200 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold">👑 あなたがホストです</span>
              </div>
              <p className="text-xs mt-1">タイマーとゲームの制御ができます</p>
            </div>
          )}
        </div>
      </div>

      {/* テスト用ゲームオーバーレイ */}
      {showTestGame && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="max-w-4xl w-full mx-4">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-white mb-2">
                🎭 顔障害物ゲーム
              </h2>
              <p className="text-gray-300 text-lg">
                障害物を避けて最後まで生き残ろう！
              </p>
            </div>

            <Suspense fallback={
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                  <p className="text-white">ゲームを読み込み中...</p>
                </div>
              </div>
            }>
              <FaceObstacleGame
                roomId={roomId}
                userName={userName}
                isHost={isHost}
              />
            </Suspense>

            <div className="text-center mt-4">
              <button
                onClick={() => setShowTestGame(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ゲーム画面を閉じる
              </button>
              <p className="text-gray-400 text-xs mt-1">
                ゲーム自体を終了するには、ゲーム内の「ゲーム終了」ボタンを使用してください
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RoomPage;
