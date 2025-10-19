/**
 * useRoomsList - 部屋一覧のリアルタイム取得
 *
 * 責務:
 * - Firestoreから部屋一覧をリアルタイムで取得
 * - 最新順にソート
 * - ローディング状態の管理
 *
 * HomePage から抽出したロジック
 *
 * @returns {Object} { rooms, loading }
 */
import { useState, useEffect } from "react";
import { query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { getRoomsCollection } from "../../../../shared/services/firebase";
import { ROOM_LIMITS } from "../../constants";

export const useRoomsList = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const roomsQuery = query(
      getRoomsCollection(),
      orderBy("createdAt", "desc"),
      limit(ROOM_LIMITS.ROOMS_LIST_LIMIT)
    );

    const unsubscribe = onSnapshot(roomsQuery, (snapshot) => {
      const roomsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRooms(roomsData);
      setLoading(false);
    }, (error) => {
      console.error("部屋一覧取得エラー:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { rooms, loading };
};

