/**
 * useRoomCreation - 部屋作成ロジック
 *
 * 責務:
 * - 部屋作成のバリデーション
 * - Firestoreへの部屋追加
 * - 作成後のナビゲーション
 *
 * HomePage から抽出したロジック
 *
 * @returns {Object} { createRoom, creating }
 */
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { addDoc, serverTimestamp } from "firebase/firestore";
import { getRoomsCollection } from "../../../../shared/services/firebase";
import { defaultRoom } from "../../../../shared/services/firestore";
import { ROOM_LIMITS, ROOM_ERRORS } from "../../constants";

export const useRoomCreation = () => {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  // 部屋作成処理
  const createRoom = useCallback(async (title, userName, currentRoomCount) => {
    // バリデーション
    if (!title.trim()) {
      alert(ROOM_ERRORS.TITLE_REQUIRED);
      return false;
    }
    if (!userName.trim()) {
      alert(ROOM_ERRORS.NAME_REQUIRED);
      return false;
    }

    // 現在の部屋数をチェック
    if (currentRoomCount >= ROOM_LIMITS.MAX_ACTIVE_ROOMS) {
      alert(ROOM_ERRORS.ROOMS_LIMIT_REACHED);
      return false;
    }

    setCreating(true);

    try {
      const docRef = await addDoc(getRoomsCollection(), {
        ...defaultRoom,
        title: title.trim(),
        createdAt: serverTimestamp(),
      });

      console.log("部屋作成成功:", docRef.id);
      navigate(`/room/${docRef.id}`, { state: { name: userName.trim() } });
      return true;
    } catch (error) {
      console.error("部屋作成エラー:", error);
      alert(ROOM_ERRORS.CREATE_FAILED);
      return false;
    } finally {
      setCreating(false);
    }
  }, [navigate]);

  return {
    createRoom,
    creating,
  };
};

