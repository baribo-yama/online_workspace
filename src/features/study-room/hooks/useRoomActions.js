/**
 * useRoomActions - ルーム操作ロジック
 *
 * 責務:
 * - 退出処理
 * - 終了処理（ホスト権限チェック付き）
 * - エラーハンドリング
 *
 * バグ修正:
 * - ホスト以外が部屋を削除できないようにチェックを追加
 *
 * @param {string} roomId - ルームID
 * @param {function} leaveRoom - 参加者退出関数
 * @param {boolean} isHost - ホスト権限
 * @returns {Object} { handleLeaveRoom, handleEndRoom }
 */
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { doc, deleteDoc } from "firebase/firestore";
import { getRoomsCollection } from "../../../shared/services/firebase";
import { ROOM_ERRORS, ROOM_CONFIRMS } from "../constants";

export const useRoomActions = (roomId, leaveRoom, isHost) => {
  const navigate = useNavigate();

  // 退出処理
  const handleLeaveRoom = useCallback(async () => {
    try {
      console.log("[useRoomActions] ルーム退出開始");
      await leaveRoom();

      // LiveKit切断処理の完了を待つ
      setTimeout(() => {
        console.log("[useRoomActions] ホームページに遷移");
        navigate("/");
      }, 500);
    } catch (error) {
      console.error("[useRoomActions] 退出エラー:", error);
      alert(ROOM_ERRORS.LEAVE_FAILED);
      navigate("/");
    }
  }, [leaveRoom, navigate]);

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

