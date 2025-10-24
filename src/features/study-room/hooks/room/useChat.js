import { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { getRoomsCollection } from '../../../../shared/services/firebase';

/**
 * useChat - ルーム内チャット機能のカスタムフック
 * 
 * 責務:
 * - チャットメッセージの送受信
 * - リアルタイムメッセージ更新（Firestore リッスン）
 * - メッセージの状態管理
 */
export const useChat = (roomId, userName) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  // メッセージをリアルタイムで監視
  useEffect(() => {
    if (!roomId) return;

    try {
      const messagesQuery = query(
        collection(getRoomsCollection(), roomId, 'messages'),
        orderBy('createdAt', 'asc')
      );

      const unsubscribe = onSnapshot(
        messagesQuery,
        (snapshot) => {
          const fetchedMessages = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setMessages(fetchedMessages);
          setLoading(false);
          
          // 新しいメッセージが来たら最下部にスクロール
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 0);
        },
        (err) => {
          console.error('チャットメッセージ取得エラー:', err);
          setError('メッセージの読み込みに失敗しました');
          setLoading(false);
        }
      );

      return unsubscribe;
    } catch (err) {
      console.error('チャット初期化エラー:', err);
      setError('チャットの初期化に失敗しました');
      setLoading(false);
    }
  }, [roomId]);

  // メッセージ送信
  const sendMessage = useCallback(
    async (text) => {
      if (!roomId || !text.trim()) {
        return;
      }

      try {
        await addDoc(collection(getRoomsCollection(), roomId, 'messages'), {
          userName,
          text: text.trim(),
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.error('メッセージ送信エラー:', err);
        setError('メッセージの送信に失敗しました');
      }
    },
    [roomId, userName]
  );

  return {
    messages,
    loading,
    error,
    sendMessage,
    messagesEndRef,
  };
};
