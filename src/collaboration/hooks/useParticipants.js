/**
 * useParticipants カスタムフック
 *
 * 勉強ルームの参加者管理を行うカスタムフック
 *
 * 主な機能:
 * - 参加者の追加・削除
 * - ホスト権限の自動設定（最初の参加者がホスト）
 * - リアルタイム参加者リストの監視
 * - 参加者の退出処理
 * - 部屋の終了処理
 *
 * @param {string} roomId - ルームID
 * @param {string} userName - ユーザー名
 * @returns {Object} 参加者管理の状態と関数
 * @returns {Array} participants - 参加者リスト
 * @returns {boolean} participantsLoading - ローディング状態
 * @returns {string} myParticipantId - 現在のユーザーの参加者ID
 * @returns {function} leaveRoom - ルーム退出関数
 * @returns {function} endRoom - ルーム終了関数（ホストのみ）
 */
import { useState, useEffect, useRef } from "react";
import {
  doc,
  deleteDoc,
  collection,
  addDoc,
  getDoc,
  getDocs,
  serverTimestamp,
  onSnapshot,
  query,
  limit,
  orderBy
} from "firebase/firestore";
import { db } from "../../shared/services/firebase";
import { updateDoc } from "firebase/firestore";
import { defaultParticipant } from "../../shared/services/firestore";

export const useParticipants = (roomId, userName) => {
  const [participants, setParticipants] = useState([]);
  const [participantsLoading, setParticipantsLoading] = useState(true);
  const [myParticipantId, setMyParticipantId] = useState(null);
  const isUnmountingRef = useRef(false);

  // 参加者リストの取得（クリーンアップ機能付き）
  useEffect(() => {
    console.log("参加者データ取得開始:", roomId);
    const participantsQuery = query(
      collection(db, "rooms", roomId, "participants"),
      orderBy("joinedAt", "asc"),
      limit(10)
    );

    const unsubscribe = onSnapshot(participantsQuery, async (snapshot) => {
      console.log("参加者データ更新:", snapshot.docs.length, "件");
      const participantsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // 古い参加者データをクリーンアップ（5分以上前のデータ）
      const now = Date.now();
      const oldParticipants = participantsData.filter(participant => {
        if (participant.joinedAt) {
          const joinedTime = participant.joinedAt.toDate ?
            participant.joinedAt.toDate().getTime() :
            participant.joinedAt;
          return (now - joinedTime) > 300000; // 5分以上前
        }
        return false;
      });

      // 古い参加者を削除
      oldParticipants.forEach(async (participant) => {
        try {
          await deleteDoc(doc(db, "rooms", roomId, "participants", participant.id));
          console.log("古い参加者を削除:", participant.name);
        } catch (error) {
          console.error("古い参加者削除エラー:", error);
        }
      });

      // アクティブな参加者のみを表示
      const activeParticipants = participantsData.filter(participant => {
        if (participant.joinedAt) {
          const joinedTime = participant.joinedAt.toDate ?
            participant.joinedAt.toDate().getTime() :
            participant.joinedAt;
          return (now - joinedTime) <= 300000; // 5分以内
        }
        return true;
      });

      // 同じ名前の参加者の重複を除去（最新の参加者のみを保持）
      const uniqueParticipants = [];
      const seenNames = new Set();

      // 参加時間でソート（新しい順）
      const sortedParticipants = activeParticipants.sort((a, b) => {
        const timeA = a.joinedAt?.toDate ? a.joinedAt.toDate().getTime() : a.joinedAt || 0;
        const timeB = b.joinedAt?.toDate ? b.joinedAt.toDate().getTime() : b.joinedAt || 0;
        return timeB - timeA; // 新しい順
      });

      sortedParticipants.forEach(participant => {
        if (!seenNames.has(participant.name)) {
          seenNames.add(participant.name);
          uniqueParticipants.push(participant);
        } else {
          // 重複する古い参加者を削除
          console.log("重複する参加者を削除:", participant.name, participant.id);
          deleteDoc(doc(db, "rooms", roomId, "participants", participant.id))
            .catch(error => console.error("重複参加者削除エラー:", error));
        }
      });

      console.log("ユニーク参加者:", uniqueParticipants.length, "人");
      setParticipants(uniqueParticipants);
      setParticipantsLoading(false);
    }, (error) => {
      console.error("参加者データ取得エラー:", error);
      setParticipantsLoading(false);
    });

    return () => unsubscribe();
  }, [roomId]);

  // 参加者登録
  useEffect(() => {
    let participantId = null;
    isUnmountingRef.current = false;

    const joinRoom = async () => {
      try {
        // 既存の参加者IDをチェック
        const existingParticipantId = localStorage.getItem(`participantId_${roomId}`);

        if (existingParticipantId) {
          // 既存の参加者IDがある場合、それが有効かチェック
          try {
            const existingDoc = await getDoc(doc(db, "rooms", roomId, "participants", existingParticipantId));
            if (existingDoc.exists()) {
              console.log("既存の参加者IDを使用:", existingParticipantId);
              participantId = existingParticipantId;
              if (!isUnmountingRef.current) {
                setMyParticipantId(existingParticipantId);
              }
              return; // 既存の参加者IDを使用して終了
            } else {
              console.log("既存の参加者IDが無効。新しい参加者を作成");
              localStorage.removeItem(`participantId_${roomId}`);
            }
          } catch (error) {
            console.log("既存参加者IDのチェックエラー:", error);
            localStorage.removeItem(`participantId_${roomId}`);
          }
        }

        // 同じ名前の既存参加者をチェックして削除
        const existingParticipantsQuery = query(
          collection(db, "rooms", roomId, "participants"),
          orderBy("joinedAt", "desc")
        );

        const existingSnapshot = await getDocs(existingParticipantsQuery);
        const existingParticipants = existingSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // 同じ名前の参加者を削除
        const duplicateParticipants = existingParticipants.filter(p => p.name === userName);
        for (const duplicate of duplicateParticipants) {
          try {
            await deleteDoc(doc(db, "rooms", roomId, "participants", duplicate.id));
            console.log("重複する既存参加者を削除:", duplicate.name, duplicate.id);
          } catch (error) {
            console.error("重複参加者削除エラー:", error);
          }
        }

        // 最初の参加者かどうかをチェック（ホスト判定）
        const isFirstParticipant = existingParticipants.length === 0;

        console.log("新しい参加者として追加中:", userName, "ホスト:", isFirstParticipant);
        const docRef = await addDoc(collection(db, "rooms", roomId, "participants"), {
          ...defaultParticipant(userName, isFirstParticipant),
          joinedAt: serverTimestamp(),
        });
        participantId = docRef.id;
        console.log("新しい参加者ID:", participantId);

        // 最初の参加者（ホスト）の場合、部屋のhostIdを設定
        if (isFirstParticipant) {
          try {
            await updateDoc(doc(db, "rooms", roomId), {
              hostId: participantId,
              createdBy: userName,
            });
            console.log("ホストIDを設定:", participantId);
          } catch (error) {
            console.error("ホストID設定エラー:", error);
          }
        }

        if (!isUnmountingRef.current) {
          setMyParticipantId(docRef.id);
        }
        localStorage.setItem(`participantId_${roomId}`, docRef.id);
      } catch (error) {
        console.error("参加者登録エラー:", error);
      }
    };

    joinRoom();

    // ページ離脱時の処理
    const handleBeforeUnload = () => {
      if (participantId) {
        localStorage.setItem(`delete_participant_${participantId}`, JSON.stringify({
          roomId: roomId,
          participantId: participantId,
          timestamp: Date.now()
        }));
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      isUnmountingRef.current = true;
      window.removeEventListener('beforeunload', handleBeforeUnload);

      if (participantId) {
        deleteDoc(doc(db, "rooms", roomId, "participants", participantId))
          .then(() => {
            console.log("クリーンアップ: 参加者データを削除しました", participantId);
            localStorage.removeItem(`participantId_${roomId}`);
            localStorage.removeItem(`delete_participant_${participantId}`);
          })
          .catch((error) => {
            console.error("クリーンアップ: 参加者データ削除エラー", error);
          });
      }
    };
  }, [roomId, userName]);

  // 部屋から退出
  const leaveRoom = async () => {
    if (myParticipantId) {
      try {
        await deleteDoc(doc(db, "rooms", roomId, "participants", myParticipantId));
        console.log("参加者が退出しました:", myParticipantId);

        localStorage.removeItem(`participantId_${roomId}`);
        localStorage.removeItem(`delete_participant_${myParticipantId}`);

        setMyParticipantId(null);
      } catch (error) {
        console.error("退出処理でエラーが発生しました:", error);
      }
    }
  };

  return {
    participants,
    participantsLoading,
    myParticipantId,
    leaveRoom
  };
};
