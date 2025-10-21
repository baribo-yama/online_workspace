/**
 * useParticipants カスタムフック
 *
 * 勉強ルームの参加者管理を行うカスタムフック
 *
 * 主な機能:
 * - 参加者の追加・削除
 * - ホスト権限の設定（最初の参加者がホスト、固定）
 * - リアルタイム参加者リストの監視
 * - 参加者の退出処理
 * - 重複参加者の自動削除
 * - 古い参加者データのクリーンアップ
 *
 * ホスト権限の仕様:
 * - 部屋を作成した人が永続的にホスト
 * - ホストが退出してもhostIdは保持される（権限移譲しない）
 * - ホストが再入室した場合、hostIdが一致すればホスト権限を維持
 *
 * バグ修正 (v1.3.1):
 * - 重複削除処理をPromise.allで並列実行し、完了を待機
 * - 削除完了後に参加者数を再確認してホスト判定を正確化
 * - 競合状態（Race Condition）を解消し、参加者リストの反映を安定化
 *
 * @param {string} roomId - ルームID
 * @param {string} userName - ユーザー名
 * @returns {Object} 参加者管理の状態と関数
 * @returns {Array} participants - 参加者リスト
 * @returns {boolean} participantsLoading - ローディング状態
 * @returns {string} myParticipantId - 現在のユーザーの参加者ID
 * @returns {function} leaveRoom - ルーム退出関数
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
import { getRoomsCollection } from "../../../shared/services/firebase";
import { updateDoc } from "firebase/firestore";
import { defaultParticipant } from "../../../shared/services/firestore";

export const useParticipants = (roomId, userName) => {
  const [participants, setParticipants] = useState([]);
  const [participantsLoading, setParticipantsLoading] = useState(true);
  const [myParticipantId, setMyParticipantId] = useState(null);
  const isUnmountingRef = useRef(false);

  // 参加者リストの取得（クリーンアップ機能付き）
  useEffect(() => {
    console.log("参加者データ取得開始:", roomId);
    const participantsQuery = query(
      collection(getRoomsCollection(), roomId, "participants"),
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

      // 古い参加者を一括削除
      if (oldParticipants.length > 0) {
        console.log("古い参加者を削除中:", oldParticipants.length, "件");
        Promise.all(
          oldParticipants.map(participant =>
            deleteDoc(doc(getRoomsCollection(), roomId, "participants", participant.id))
              .then(() => console.log("古い参加者を削除:", participant.name))
              .catch(error => console.error("古い参加者削除エラー:", error))
          )
        );
      }

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

      // 重複を検出し、削除する参加者のIDを収集
      const duplicatesToDelete = [];
      
      sortedParticipants.forEach(participant => {
        if (!seenNames.has(participant.name)) {
          seenNames.add(participant.name);
          uniqueParticipants.push(participant);
        } else {
          // 重複する古い参加者を削除対象に追加
          console.log("重複する参加者を検出:", participant.name, participant.id);
          duplicatesToDelete.push(participant);
        }
      });
      
      // 重複を一括削除（非同期だが、表示には影響しない）
      if (duplicatesToDelete.length > 0) {
        console.log("重複参加者を一括削除:", duplicatesToDelete.length, "件");
        Promise.all(
          duplicatesToDelete.map(duplicate =>
            deleteDoc(doc(getRoomsCollection(), roomId, "participants", duplicate.id))
              .catch(error => console.error("重複参加者削除エラー:", error))
          )
        ).then(() => {
          console.log("重複削除完了");
        });
      }

      console.log("ユニーク参加者:", uniqueParticipants.length, "人");
      setParticipants(uniqueParticipants);
      setParticipantsLoading(false);

      // 部屋の参加者数を更新
      try {
        await updateDoc(doc(getRoomsCollection(), roomId), {
          participantsCount: uniqueParticipants.length
        });
        console.log("部屋の参加者数を更新:", uniqueParticipants.length);
      } catch (error) {
        console.error("参加者数更新エラー:", error);
      }
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
            const existingDoc = await getDoc(doc(getRoomsCollection(), roomId, "participants", existingParticipantId));
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
          collection(getRoomsCollection(), roomId, "participants"),
          orderBy("joinedAt", "desc")
        );

        const existingSnapshot = await getDocs(existingParticipantsQuery);
        const existingParticipants = existingSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // 同じ名前の参加者を削除（Promise.allで全て完了するまで待機）
        const duplicateParticipants = existingParticipants.filter(p => p.name === userName);
        if (duplicateParticipants.length > 0) {
          console.log("重複する参加者を削除中:", duplicateParticipants.length, "件");
          await Promise.all(
            duplicateParticipants.map(async (duplicate) => {
              try {
                await deleteDoc(doc(getRoomsCollection(), roomId, "participants", duplicate.id));
                console.log("重複する既存参加者を削除:", duplicate.name, duplicate.id);
              } catch (error) {
                console.error("重複参加者削除エラー:", error);
              }
            })
          );
          console.log("重複削除完了");
        }

        // 削除後の参加者数を再確認（ホスト判定を正確に）
        const currentSnapshot = await getDocs(query(
          collection(getRoomsCollection(), roomId, "participants"),
          orderBy("joinedAt", "asc")
        ));
        const currentParticipants = currentSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // 最初の参加者かどうかをチェック（ホスト判定）
        const isFirstParticipant = currentParticipants.length === 0;

        console.log("新しい参加者として追加中:", userName, "ホスト:", isFirstParticipant);
        const docRef = await addDoc(collection(getRoomsCollection(), roomId, "participants"), {
          ...defaultParticipant(userName, isFirstParticipant),
          joinedAt: serverTimestamp(),
        });
        participantId = docRef.id;
        console.log("新しい参加者ID:", participantId);

        // 最初の参加者（ホスト）の場合、部屋のhostIdを設定
        if (isFirstParticipant) {
          try {
            await updateDoc(doc(getRoomsCollection(), roomId), {
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
        // クリーンアップ処理
        deleteDoc(doc(getRoomsCollection(), roomId, "participants", participantId))
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
        // 参加者を削除
        await deleteDoc(doc(getRoomsCollection(), roomId, "participants", myParticipantId));
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
