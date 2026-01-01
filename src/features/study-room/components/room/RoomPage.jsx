/**
 * RoomPage - 勉強ルームメインページ（レベル2: チーム開発対応）
 *
 * 責務:
 * - ルーティング情報の取得
 * - カスタムフックの統合
 * - UIコンポーネントの配置
 *
 * リファクタリング:
 * - ロジックをhooksに分離
 * - UIコンポーネントを分割
 * - 238行 → 約100行に削減
 *
 * 機能追加 (2025-11-12):
 * - Slack連携機能（参加通知）を追加
 */
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useParticipants } from "../../../collaboration/hooks/useParticipants";
import { useNotification } from "../../../entertainment/hooks/useNotification";
import { useRoomData } from "../../hooks/room/useRoomData";
import { useRoomActions } from "../../hooks/room/useRoomActions";
import { useRoomPermissions } from "../../hooks/room/useRoomPermissions";
import { useHostInactivity } from "../../hooks/room/useHostInactivity";
import { useSlackNotification } from "../../../integration/slack/hooks/useSlackNotification";
import { InactivityConfirmationToast } from "./InactivityConfirmationToast";
import { LoadingScreen } from "../shared/LoadingScreen";
import { RoomSidebar } from "./RoomSidebar";
import { RoomMainContent } from "./RoomMainContent";
import { GameOverlay } from "../game/GameOverlay";
import { showHostPromotionToast } from "../../../../shared/utils/toastNotification";
import { GAME_STATUS, ROOM_DEFAULTS } from "../../constants";

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
  const { notifyParticipantJoined } = useSlackNotification();

  // ===== 権限チェック =====
  const { isHost, gameStatus } = useRoomPermissions(room, myParticipantId);

  // ===== 操作ロジック =====
  const { handleLeaveRoom, handleEndRoom } = useRoomActions(roomId, leaveRoom, isHost, myParticipantId);

  // ===== ホスト非活動監視 =====
  const { showToast, countdown, handleConfirm } = useHostInactivity(
    roomId,
    isHost,
    room,
    handleEndRoom
  );

  // ===== ローカル状態管理 =====
  const [showGame, setShowGame] = useState(false);
  const [wasHost, setWasHost] = useState(false);
  const hasNotifiedJoinRef = useRef(false); // Slack通知済みフラグ

  // ===== 副作用 =====

  // Slack参加通知（参加者ID取得後、1回のみ実行）
  useEffect(() => {
    if (!myParticipantId || hasNotifiedJoinRef.current) return;
    // Slack通知が有効な部屋のみ
    if (!room?.slackThreadTs && !room?.slackThreads) return;

    // 自分がホストの場合は通知しない（部屋作成時に既に通知済み）
    if (isHost) {
      hasNotifiedJoinRef.current = true;
      return;
    }

    // Slack参加通知を送信
    notifyParticipantJoined({
      threadTs: room.slackThreadTs,
      threadTsMap: room.slackThreads,
      userName,
      participantCount: participants.length,
      workspaceId: room.slackWorkspaceId
    });

    hasNotifiedJoinRef.current = true;
  }, [myParticipantId, room?.slackThreadTs, room?.slackThreads, isHost, userName, participants.length, notifyParticipantJoined]);

  // ホスト権限昇格の通知
  useEffect(() => {
    if (!wasHost && isHost) {
      console.log("[RoomPage] ホスト権限を昇格");
      showHostPromotionToast();
    }
    setWasHost(isHost);
  }, [isHost, wasHost]);

  // ゲーム状態の自動監視
  useEffect(() => {
    if (!room?.game) return;

    console.log("[RoomPage] ゲーム状態:", gameStatus);

    if (gameStatus === GAME_STATUS.PLAYING) {
      console.log("[RoomPage] ゲーム開始 - 自動表示");
      setShowGame(true);
    } else if (gameStatus === GAME_STATUS.IDLE) {
      console.log("[RoomPage] ゲーム終了 - 自動非表示");
      setShowGame(false);
    }
  }, [gameStatus, room?.game]);

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
      <RoomSidebar
        roomId={roomId}
        userName={userName}
        participants={participants}
        participantsLoading={participantsLoading}
        myParticipantId={myParticipantId}
        onLeaveRoom={handleLeaveRoom}
        roomTitle={room.title}
        isHost={isHost}
        onEndRoom={handleEndRoom}
      />

      {/* 右メインコンテンツ: ヘッダー & タイマー & コントロール */}
      <RoomMainContent
        roomId={roomId}
        isHost={isHost}
        // canStartGame={canStartGame}
        // gameStatus={gameStatus}
        // onGameStart={() => setShowGame(true)}
        myParticipantId={myParticipantId}
      />

      {/* ゲームオーバーレイ */}
      <GameOverlay
        show={showGame}
        roomId={roomId}
        userName={userName}
        isHost={isHost}
        onClose={() => setShowGame(false)}
      />

      {/* ホスト非活動確認トースト */}
      {showToast && (
        <InactivityConfirmationToast onConfirm={handleConfirm} countdown={countdown} />
      )}
    </div>
  );
}

export default RoomPage;

