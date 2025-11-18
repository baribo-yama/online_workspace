/**
 * useParticipantsData - 各部屋の参加者情報取得
 *
 * 責務:
 * - 各部屋の参加者をFirestoreから取得
 * - 部屋IDをキーとした参加者マップを返す
 *
 * HomePage から抽出したロジック
 *
 * @param {Array} rooms - 部屋一覧
 * @returns {Object} { roomParticipants }
 */
import { useState, useEffect, useCallback } from "react";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { getRoomsCollection } from "../../../../shared/services/firebase";


export const useParticipantsData = (rooms) => {
  const [roomParticipants, setRoomParticipants] = useState({});

  // 参加者データを取得する関数（useCallbackで最適化）
  const fetchParticipantsData = useCallback(async (roomsData) => {
    const participantPromises = roomsData.map(async (room) => {
      try {
        const participantsQuery = query(
          collection(getRoomsCollection(), room.id, "participants"),
          orderBy("joinedAt", "asc")
        );

        const participantsSnapshot = await getDocs(participantsQuery);

        const participants = participantsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

      // 取得した参加者名をそのまま返却する
      return { roomId: room.id, participants: participants.map(p => p.name) };
      } catch (error) {
        console.error(`部屋 ${room.id} の参加者取得エラー:`, error);
        return { roomId: room.id, participants: [] };
      }
    });

    const participantResults = await Promise.all(participantPromises);
    const participantsData = {};
    participantResults.forEach(({ roomId, participants }) => {
      participantsData[roomId] = participants;
    });

    setRoomParticipants(participantsData);
  }, []);

  // 部屋データが変更されたときに参加者データを取得
  useEffect(() => {
    if (rooms.length > 0) {
      fetchParticipantsData(rooms);
    }
  }, [rooms, fetchParticipantsData]);

  return { roomParticipants };
};

