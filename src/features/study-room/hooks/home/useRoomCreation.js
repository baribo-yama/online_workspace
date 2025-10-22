/**
 * useRoomCreation - 部屋作成ロジック
 *
 * 責務:
 * - 部屋作成のバリデーション
 * - Firestoreへの部屋追加
 * - 作成者を参加者として登録
 * - hostIdとcreatedByの設定
 * - 作成後のナビゲーション
 *
 * HomePage から抽出したロジック
 *
 * バグ修正 (2025-10-21):
 * - 部屋作成時にhostIdとcreatedByを設定
 * - 作成者を即座に参加者として登録
 * - リロード時のホスト権限移り変わりを修正
 *
 * @returns {Object} { createRoom, creating }
 */
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { addDoc, collection, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { getRoomsCollection } from "../../../../shared/services/firebase";
import { defaultRoom, defaultParticipant } from "../../../../shared/services/firestore";
import { ROOM_LIMITS, ROOM_ERRORS } from "../../constants";
import { validateRoomTitle, validateUserName } from "../../utils";

export const useRoomCreation = () => {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  // 部屋作成処理
  const createRoom = useCallback(async (title, userName, currentRoomCount) => {
    // バリデーション
    const titleValidation = validateRoomTitle(title);
    if (!titleValidation.valid) {
      alert(titleValidation.error);
      return false;
    }

    const userNameValidation = validateUserName(userName);
    if (!userNameValidation.valid) {
      alert(userNameValidation.error);
      return false;
    }

    // 現在の部屋数をチェック
    if (currentRoomCount >= ROOM_LIMITS.MAX_ACTIVE_ROOMS) {
      alert(ROOM_ERRORS.ROOMS_LIMIT_REACHED);
      return false;
    }

    setCreating(true);

    try {
      // 1. 部屋を作成（hostIdは後で設定）
      const roomRef = await addDoc(getRoomsCollection(), {
        ...defaultRoom,
        title: title.trim(),
        createdAt: serverTimestamp(),
        createdBy: userName.trim(),  // 作成者名を設定
      });

      console.log("部屋作成成功:", roomRef.id);

      // 2. 作成者を最初の参加者として登録（ホスト権限あり）
      const participantRef = await addDoc(
        collection(getRoomsCollection(), roomRef.id, "participants"),
        {
          ...defaultParticipant(userName.trim(), true),  // isHost: true
          joinedAt: serverTimestamp(),
        }
      );

      console.log("作成者を参加者として登録:", participantRef.id);

      // 3. 部屋のhostIdを設定
      await updateDoc(doc(getRoomsCollection(), roomRef.id), {
        hostId: participantRef.id,
        participantsCount: 1,  // 初期参加者数
      });

      console.log("hostIDを設定:", participantRef.id);

      // 4. localStorageに参加者IDを保存（リロード時の重複防止）
      localStorage.setItem(`participantId_${roomRef.id}`, participantRef.id);

      navigate(`/room/${roomRef.id}`, { state: { name: userName.trim() } });
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

