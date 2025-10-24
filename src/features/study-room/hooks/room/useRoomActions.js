/**
 * useRoomActions - ルーム操作ロジック
 *
 * 責務:
 * - 退出処理（ホスト権限移譲対応）
 * - 終了処理（ホスト権限チェック付き）
 * - エラーハンドリング
 *
 * バグ修正:
 * - ホスト以外が部屋を削除できないようにチェックを追加
 *
 * @param {string} roomId - ルームID
 * @param {function} leaveRoom - 参加者退出関数
 * @param {boolean} isHost - ホスト権限
 * @param {string} myParticipantId - 現在のユーザーの参加者ID
 * @returns {Object} { handleLeaveRoom, handleEndRoom }
 */
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { doc, deleteDoc, getFirestore } from "firebase/firestore";
import { getRoomsCollection } from "../../../../shared/services/firebase";
import { transferHostAuthority } from "../../../../shared/services/firestore";
import { showHostTransferSuccessToast, showErrorToast } from "../../../../shared/utils/toastNotification";
import { ROOM_ERRORS, ROOM_CONFIRMS } from "../../constants";

export const useRoomActions = (roomId, leaveRoom, isHost, myParticipantId) => {
  const navigate = useNavigate();
  const db = getFirestore();

  // 退出処理（ホスト権限移譲対応）
  const handleLeaveRoom = useCallback(async () => {
    try {
      console.log("[useRoomActions] ルーム退出開始");

      // ホスト権限移譲処理（先に実行 - ホストはまだ参加者リストに存在）
      if (isHost && myParticipantId) {
        try {
          console.log("[useRoomActions] ホスト権限移譲処理開始");
          const newHostId = await transferHostAuthority(db, roomId, myParticipantId);
          
          if (newHostId) {
            console.log("[useRoomActions] 新ホストに権限移譲完了:", newHostId);
            showHostTransferSuccessToast();
          } else {
            console.log("[useRoomActions] 残存参加者なし - ルーム終了");
            await deleteDoc(doc(getRoomsCollection(), roomId));
          }
        } catch (transferError) {
          console.error("[useRoomActions] 権限移譲エラー:", transferError);
          showErrorToast("ホスト権限の移譲に失敗しました。もう一度お試しください。");
          // 修正案3：throw しない（ホストをルーム内に留める）
          return;
        }
      }

      // その後に LiveKit 接続を切断してホストを参加者から削除
      console.log("[useRoomActions] LiveKit接続を切断");
      await leaveRoom();
      
      // 500ms 待機（接続切断完了を確保）
      await new Promise(resolve => setTimeout(resolve, 500));

      // ホームページへ遷移
      console.log("[useRoomActions] ホームページに遷移");
      navigate("/");
    } catch (error) {
      console.error("[useRoomActions] 退出エラー:", error);
      alert(ROOM_ERRORS.LEAVE_FAILED);
      navigate("/");
    }
  }, [leaveRoom, navigate, isHost, myParticipantId, roomId, db]);

  // 終了処理（ホスト権限チェック付き）
  const handleEndRoom = useCallback(async () => {
    // バグ修正: ホスト権限チェック
    if (!isHost) {
      alert(ROOM_ERRORS.NOT_HOST);
      console.warn("[useRoomActions] ホスト権限なし - 部屋終了を拒否");
      return;
    }

    // 確認ダイアログ
    const confirmEnd = window.confirm(ROOM_CONFIRMS.END_ROOM);
    if (!confirmEnd) {
      console.log("[useRoomActions] 終了キャンセル");
      return;
    }

    try {
      console.log("[useRoomActions] ルーム終了開始:", roomId);
      await deleteDoc(doc(getRoomsCollection(), roomId));
      console.log("[useRoomActions] ルーム終了成功");
      navigate("/");
    } catch (error) {
      console.error("[useRoomActions] 終了エラー:", error);
      alert(ROOM_ERRORS.END_FAILED);
    }
  }, [roomId, isHost, navigate]);

  return {
    handleLeaveRoom,
    handleEndRoom,
  };
};

