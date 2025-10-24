/**
 * useParticipants カスタムフック
 *
 * 勉強ルームの参加者管理を行うカスタムフック
 * 
 * 仕様書: docs/PARTICIPANT_MANAGEMENT_SPEC.md に基づく実装
 * 
 * 主な機能:
 * - 参加者の入室・退室管理（Firestoreを唯一の真実のソース）
 * - リロード時の既存ID再利用
 * - 明示退出時のみFirestore削除
 * - LiveKit接続はFirestore登録後の付随機能
 *
 * Safety-first方針:
 * - リロード・クラッシュ・タブ閉じではFirestore削除しない
 * - 重複削除は参加者登録時のみ実行
 * - 参加者識別はFirestoreのdoc.idのみで行う
 *
 * @param {string} roomId - ルームID
 * @param {string} userName - ユーザー名
 * @returns {Object} 参加者管理の状態と関数
 * @returns {Array} participants - 参加者リスト
 * @returns {boolean} participantsLoading - ローディング状態
 * @returns {string} myParticipantId - 現在のユーザーの参加者ID
 * @returns {function} handleExplicitExit - 明示退出関数
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
  orderBy,
  updateDoc,
  where,
  limit
} from "firebase/firestore";
import { getRoomsCollection } from "../../../shared/services/firebase";

// デバウンス関数
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

// 初回入室処理（仕様書完全準拠）
const handleFirstTimeEntry = async (roomId, userName) => {
  try {
    console.log("初回入室処理開始:", userName);
    
    // 1. Firestore へ新規参加者を登録
    const participantRef = await addDoc(
      collection(getRoomsCollection(), roomId, "participants"),
      {
        name: userName,
        createdAt: serverTimestamp(),
        active: true,
        isHost: false, // ホスト判定は後で行う
        joinedAt: serverTimestamp(),
        lastActivity: serverTimestamp()
      }
    );
    
    // 2. doc.idをlocalStorageに保存
    localStorage.setItem(`participantId_${roomId}`, participantRef.id);
    
    console.log("初回入室完了:", participantRef.id);
    return participantRef.id;
    
  } catch (error) {
    console.error("初回入室エラー:", error);
    throw error;
  }
};

// リロード/復帰処理（仕様書完全準拠）
const handleReloadEntry = async (roomId, userName) => {
  try {
    const existingParticipantId = localStorage.getItem(`participantId_${roomId}`);
    
    if (!existingParticipantId) {
      // localStorageにIDがない場合は同じ名前の既存参加者を検索して再利用
      console.log("[handleReloadEntry] localStorageに participantId がない - 同じ名前の参加者を検索");
      
      try {
        const participantsRef = collection(getRoomsCollection(), roomId, "participants");
        const q = query(participantsRef, where("name", "==", userName), limit(1));
        const snapshot = await getDocs(q);
        
        if (snapshot.docs.length > 0) {
          // 同じ名前の参加者が見つかった - 既存ドキュメントを再利用
          const existingDoc = snapshot.docs[0];
          const foundParticipantId = existingDoc.id;
          console.log("[handleReloadEntry] 同じ名前の参加者を発見 - 既存ID再利用:", foundParticipantId);
          
          // localStorageに保存
          localStorage.setItem(`participantId_${roomId}`, foundParticipantId);
          
          // 状態を更新
          await updateDoc(
            doc(getRoomsCollection(), roomId, "participants", foundParticipantId),
            {
              active: true,
              lastActivity: serverTimestamp()
            }
          );
          
          return foundParticipantId;
        }
      } catch (searchError) {
        console.warn("[handleReloadEntry] 同じ名前の参加者検索エラー:", searchError);
        // エラーの場合は初回入室処理にフォールバック
      }
      
      // 同じ名前の参加者が見つからない場合は初回入室扱い
      return await handleFirstTimeEntry(roomId, userName);
    }
    
    // Firestoreで既存参加者の存在を確認
    const participantDoc = await getDoc(
      doc(getRoomsCollection(), roomId, "participants", existingParticipantId)
    );
    
    if (participantDoc.exists()) {
      // 復帰処理
      console.log("復帰処理開始:", existingParticipantId);
      
      // active=trueに更新（必要に応じて）
      await updateDoc(
        doc(getRoomsCollection(), roomId, "participants", existingParticipantId),
        {
          active: true,
          lastActivity: serverTimestamp()
        }
      );
      
      console.log("復帰完了:", existingParticipantId);
      return existingParticipantId;
      
    } else {
      // docが欠落している例外時のみ新規入室扱い
      console.log("参加者docが欠落、初回入室にフォールバック");
      localStorage.removeItem(`participantId_${roomId}`);
      return await handleFirstTimeEntry(roomId, userName);
    }
    
  } catch (error) {
    console.error("復帰処理エラー:", error);
    throw error;
  }
};

// 明示退出処理（仕様書完全準拠）
const handleExplicitExit = async (roomId, participantId) => {
  try {
    console.log("明示退出開始:", participantId);
    
    // 1. Firestoreから参加者docを削除
    await deleteDoc(
      doc(getRoomsCollection(), roomId, "participants", participantId)
    );
    
    // 2. localStorage.participantIdをクリア
    localStorage.removeItem(`participantId_${roomId}`);
    
    console.log("明示退出完了");
    
  } catch (error) {
    console.error("明示退出エラー:", error);
    // エラーが発生してもlocalStorageはクリア
    localStorage.removeItem(`participantId_${roomId}`);
  }
};

// 予期しない終了の処理（仕様書完全準拠）
const handleUnexpectedTermination = (roomId, participantId) => {
  // beforeunloadイベントリスナー
  const handleBeforeUnload = () => {
    // Firestoreは削除しないことを保証
    console.log("予期しない終了検出、Firestoreは削除しない");
    
    // 必要に応じてlastActivityを更新
    updateDoc(
      doc(getRoomsCollection(), roomId, "participants", participantId),
      { lastActivity: serverTimestamp() }
    ).catch(error => {
      console.error("lastActivity更新エラー:", error);
    });
  };
  
  window.addEventListener('beforeunload', handleBeforeUnload);
  
  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
};

// 重複参加者のクリーンアップ処理
const cleanupDuplicateParticipants = async (roomId, myParticipantId) => {
  try {
    const participantsQuery = query(
      collection(getRoomsCollection(), roomId, "participants"),
      orderBy("joinedAt", "asc")
    );

    const snapshot = await getDocs(participantsQuery);
    const participants = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // 自分以外の参加者で、localStorageに保存されているIDと一致しない参加者を削除
    const storedId = localStorage.getItem(`participantId_${roomId}`);
    
    if (!storedId || storedId !== myParticipantId) {
      if (import.meta.env.DEV) {
        console.warn("localStorage の participantId が不正です");
      }
      return;
    }

    // 同じ名前で複数の参加者が登録されている場合、最新のもの以外を削除
    const participantsByName = {};
    participants.forEach(p => {
      if (!participantsByName[p.name]) {
        participantsByName[p.name] = [];
      }
      participantsByName[p.name].push(p);
    });

    const deletePromises = [];
    Object.values(participantsByName).forEach(group => {
      if (group.length > 1) {
        // 同じ名前の参加者が複数いる場合
        // 自分のIDと一致するものを残し、それ以外を削除
        const toDelete = group.filter(p => p.id !== myParticipantId);
        toDelete.forEach(p => {
          if (import.meta.env.DEV) {
            console.log("重複参加者を削除:", p.id, p.name);
          }
          deletePromises.push(
            deleteDoc(doc(getRoomsCollection(), roomId, "participants", p.id))
          );
        });
      }
    });

    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
      if (import.meta.env.DEV) {
        console.log(`${deletePromises.length}件の重複参加者を削除しました`);
      }
    }
  } catch (error) {
    console.error("重複参加者クリーンアップエラー:", error);
  }
};

export const useParticipants = (roomId, userName) => {
  const [participants, setParticipants] = useState([]);
  const [participantsLoading, setParticipantsLoading] = useState(true);
  const [myParticipantId, setMyParticipantId] = useState(null);
  const isUnmountingRef = useRef(false);

  // 参加者数更新関数（デバウンス付き）
  const updateParticipantsCountRef = useRef(
    debounce(async (roomId, count) => {
      try {
        const roomRef = doc(getRoomsCollection(), roomId);
        
        // ルームドキュメントの存在確認
        const roomDoc = await getDoc(roomRef);
        if (!roomDoc.exists()) {
          if (import.meta.env.DEV) {
            console.warn("ルームが存在しないため、参加者数更新をスキップ");
          }
          return;
        }
        
        await updateDoc(roomRef, {
          participantsCount: count
        });
        
        if (import.meta.env.DEV) {
          console.log("参加者数を更新:", count);
        }
      } catch (error) {
        console.error("参加者数更新エラー:", error);
      }
    }, 1000) // 1秒のデバウンス
  );

  // 参加者入室・復帰処理（仕様書完全準拠 + 重複登録防止）
  useEffect(() => {
    let participantId = null;
    let cleanup = null;
    isUnmountingRef.current = false;

    const joinRoom = async () => {
      try {
        // 既に参加者IDが設定されている場合はスキップ（重複登録防止）
        if (myParticipantId) {
          if (import.meta.env.DEV) {
            console.log("既に参加者ID取得済み、再登録をスキップ:", myParticipantId);
          }
          return;
        }

        // リロード/復帰処理（仕様書通り）
        participantId = await handleReloadEntry(roomId, userName);
        
        if (!isUnmountingRef.current) {
          setMyParticipantId(participantId);
          
          // 参加者ID取得後にクリーンアップを設定（PRレビュー対応）
          cleanup = handleUnexpectedTermination(roomId, participantId);
          
          // 参加者ID取得後、重複データをクリーンアップ
          setTimeout(() => {
            cleanupDuplicateParticipants(roomId, participantId);
          }, 2000); // 2秒後にクリーンアップ実行（Firestore同期を待つ）
        }
        
      } catch (error) {
        console.error("参加者登録エラー:", error);
      }
    };

    joinRoom();

    return () => {
      isUnmountingRef.current = true;
      if (cleanup) {
        cleanup();
      }
      
      // 明示退出時のみ削除処理
      // リロード時は削除しない
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userName]); // myParticipantIdは依存配列から削除（重複登録防止のため）

  // 参加者リストの監視（仕様書完全準拠 + 参加者数更新）
  useEffect(() => {
    const participantsQuery = query(
      collection(getRoomsCollection(), roomId, "participants"),
      orderBy("joinedAt", "asc")
    );

    const unsubscribe = onSnapshot(participantsQuery, (snapshot) => {
      const participants = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // アクティブな参加者のみをフィルタリング
      const activeParticipants = participants.filter(participant => 
        participant.active !== false
      );

      setParticipants(activeParticipants);
      setParticipantsLoading(false);
      
      // デバウンス付きで参加者数を更新
      updateParticipantsCountRef.current(roomId, activeParticipants.length);
    });

    return unsubscribe;
  }, [roomId]);

  return {
    participants,
    myParticipantId,
    participantsLoading,
    leaveRoom: () => handleExplicitExit(roomId, myParticipantId)
  };
};