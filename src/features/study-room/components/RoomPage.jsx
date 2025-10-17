/**
 * RoomPage - 勉強ルームメインページ（レベル1: ミニマル構成）
 *
 * 責務:
 * - ルーティング情報の取得
 * - カスタムフックの統合
 * - UIコンポーネントの配置
 *
 * バグ修正:
 * - ホスト権限チェックを追加
 * - 部屋削除時のホストチェック実装
 * - 定数で一元管理
 *
 * リファクタリング:
 * - ロジックをhooksに分離
 * - 小さいコンポーネントは同ファイル内に定義
 */
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, lazy, Suspense } from "react";
import { useParticipants } from "../../collaboration/hooks/useParticipants";
import { useNotification } from "../../entertainment/hooks/useNotification";
import SharedTimer from "../../timer/components/SharedTimer";
import ParticipantList from "../../collaboration/components/ParticipantList";
import { useRoomData } from "../hooks/useRoomData";
import { useRoomActions } from "../hooks/useRoomActions";
import { RoomHeader } from "./RoomHeader";
import { GameOverlay } from "./GameOverlay";
import { LOADING_MESSAGES, GAME_STATUS, ROOM_DEFAULTS } from "../constants";

// 大きなコンポーネントは遅延読み込み
const VideoCallRoom = lazy(() => import("../../video-call/components/VideoCallRoom"));

// ===== 小さなUIコンポーネント（同ファイル内に定義） =====

const LoadingScreen = ({ message = LOADING_MESSAGES.ROOM }) => (
  <div className="flex h-screen bg-gray-900 items-center justify-center">
    <div className="text-center">
      <div
        className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"
        role="status"
        aria-label="読み込み中"
      />
      <p className="text-white">{message}</p>
    </div>
  </div>
);

const HostControls = ({ isHost, canStartGame, gameStatus, onGameStart }) => {
  if (!isHost) return null;

  return (
    <div className="space-y-3">
      {/* ゲーム開始ボタン */}
      {canStartGame && gameStatus !== GAME_STATUS.PLAYING && (
        <button
          onClick={onGameStart}
          className="bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded text-white font-medium transition-colors flex items-center gap-2 w-full justify-center"
          aria-label="ゲームを開始"
        >
          🎯 ゲーム開始
        </button>
      )}

      {/* ゲーム中表示 */}
      {gameStatus === GAME_STATUS.PLAYING && (
        <div
          className="p-3 bg-green-900/20 border border-green-500 rounded text-green-200 text-sm"
          role="status"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold">🎮 ゲーム中</span>
          </div>
          <p className="text-xs mt-1">全員がゲームに参加しています</p>
        </div>
      )}

      {/* ホスト情報 */}
      <div
        className="p-3 bg-yellow-900/20 border border-yellow-500 rounded text-yellow-200 text-sm"
        role="status"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold">👑 あなたがホストです</span>
        </div>
        <p className="text-xs mt-1">タイマーとゲームの制御ができます</p>
      </div>
    </div>
  );
};

// ===== メインコンポーネント =====

function RoomPage() {
  // ===== ルーティング情報 =====
  const { roomId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const userName = state?.name || localStorage.getItem("userName") || ROOM_DEFAULTS.GUEST_NAME;

  // ===== カスタムフック（データ取得・操作） =====
  const { room, loading, error } = useRoomData(roomId);
  const { participants, participantsLoading, myParticipantId, leaveRoom } =
    useParticipants(roomId, userName);
  const { requestPermission } = useNotification();

  // ===== ローカル状態管理 =====
  const [showGame, setShowGame] = useState(false);

  // ===== 権限チェック（シンプルに直接計算） =====
  const isHost = Boolean(room?.hostId && room.hostId === myParticipantId);
  const canStartGame = isHost && room?.timer?.mode === 'break';
  const gameStatus = room?.game?.status || GAME_STATUS.IDLE;

  // ===== 操作ロジック（hooks経由） =====
  const { handleLeaveRoom, handleEndRoom } = useRoomActions(roomId, leaveRoom, isHost);

  // ===== 副作用 =====

  // ゲーム状態の自動監視
  useEffect(() => {
    if (!room?.game) return;

    const status = room.game.status || GAME_STATUS.IDLE;
    console.log("[RoomPage] ゲーム状態:", status);

    if (status === GAME_STATUS.PLAYING) {
      console.log("[RoomPage] ゲーム開始 - 自動表示");
      setShowGame(true);
    } else if (status === GAME_STATUS.IDLE) {
      console.log("[RoomPage] ゲーム終了 - 自動非表示");
      setShowGame(false);
    }
  }, [room?.game?.status]);

  // 通知許可リクエスト
  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  // エラーハンドリング
  useEffect(() => {
    if (error) {
      console.error("[RoomPage] エラー発生:", error);
      alert(error);
      navigate("/");
    }
  }, [error, navigate]);

  // ===== 条件付きレンダリング =====

  // ローディング画面
  if (loading) {
    return <LoadingScreen />;
  }

  // 部屋が存在しない
  if (!room) {
    return <LoadingScreen message="部屋情報を取得中..." />;
  }

  // ===== メインUI =====

  return (
    <div className="flex h-screen bg-gray-900">
      {/* 左サイドバー: 参加者リスト & ビデオ通話 */}
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
              onLeaveRoom={handleLeaveRoom}
            />
          </Suspense>
        </div>
      </div>

      {/* 右メインコンテンツ: ヘッダー & タイマー & コントロール */}
      <div className="w-1/2 bg-gray-800 flex flex-col">
        {/* ヘッダー */}
        <RoomHeader
          roomTitle={room.title}
          roomId={roomId}
          isHost={isHost}
          onLeaveRoom={handleLeaveRoom}
          onEndRoom={handleEndRoom}
        />

        {/* ポモドーロタイマー */}
        <div className="flex-1 p-6">
          <SharedTimer roomId={roomId} isHost={isHost} />
        </div>

        {/* ホストコントロール */}
        <div className="p-6">
          <HostControls
            isHost={isHost}
            canStartGame={canStartGame}
            gameStatus={gameStatus}
            onGameStart={() => setShowGame(true)}
          />
        </div>
      </div>

      {/* ゲームオーバーレイ */}
      <GameOverlay
        show={showGame}
        roomId={roomId}
        userName={userName}
        isHost={isHost}
        onClose={() => setShowGame(false)}
      />
    </div>
  );
}

export default RoomPage;
