/**
 * useRoomData - ルームデータの取得と監視
 *
 * 責務:
 * - Firestoreからルームデータをリアルタイム取得
 * - エラーハンドリング
 * - ローディング状態の管理
 *
 * @param {string} roomId - ルームID
 * @returns {Object} { room, loading, error }
 */
import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getRoomsCollection } from "../../../../shared/services/firebase";
import { ROOM_ERRORS } from "../../constants";

export const useRoomData = (roomId) => {
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!roomId) {
      setError(ROOM_ERRORS.NOT_FOUND);
      setLoading(false);
      return;
    }

    console.log("[useRoomData] ルームデータ取得開始:", roomId);
    const roomDocRef = doc(getRoomsCollection(), roomId);

    const unsubscribe = onSnapshot(
      roomDocRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const roomData = docSnapshot.data();
          console.log("[useRoomData] ルームデータ更新");
          setRoom(roomData);
          setError(null);
        } else {
          console.warn("[useRoomData] ルームが見つかりません:", roomId);
          setError(ROOM_ERRORS.NOT_FOUND);
          setRoom(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error("[useRoomData] データ取得エラー:", err);
        setError(err.message || "データ取得に失敗しました");
        setLoading(false);
      }
    );

    return () => {
      console.log("[useRoomData] クリーンアップ");
      unsubscribe();
    };
  }, [roomId]);

  return { room, loading, error };
};

