/**
 * Slack通知カスタムフック
 * 
 * 【設計原則】
 * - study-room コンポーネントが slackApi を直接呼ばない
 * - Firestore更新とSlack通知を一体化
 * - エラーハンドリングを統一（呼び出し元を中断しない）
 * - React hooks パターンに準拠
 */

import { useCallback } from 'react';
import { updateRoom } from '../../../../shared/services/firestore.js';
import {
  postRoomCreated,
  postParticipantJoined,
  postRoomEnded
} from '../services/slackApi.js';

/**
 * Slack通知機能を提供するカスタムフック
 * @returns {Object} Slack通知関数群
 */
export const useSlackNotification = () => {
  /**
   * 部屋作成通知
   * - Slackに通知を送信
   * - 成功時、Firestoreに thread_ts を保存
   * 
   * @param {Object} params
   * @param {string} params.roomId - 部屋ID
   * @param {string} params.roomTitle - 部屋タイトル
   * @param {string} params.hostName - ホスト名
   * @returns {Promise<void>}
   */
  const notifyRoomCreated = useCallback(async ({ roomId, roomTitle, hostName, workspaceId }) => {
    console.log('[Integration/Slack] 部屋作成通知を開始:', { roomId, roomTitle, hostName });

    try {
      const roomUrl = `${window.location.origin}/room/${roomId}`;

      const result = await postRoomCreated({
        hostName,
        roomTitle,
        roomUrl,
        workspaceId // 修正: params.workspaceId -> workspaceId
      });

      console.log('[Integration/Slack] 通知結果:', result);

      // Slack通知成功時、Firestoreに thread_ts を保存
      // Slack通知成功時、Firestoreに thread_ts を保存
      if (result.ok) {
        const updates = {};

        // 複数チャンネル対応: 結果マップを保存
        if (result.results) {
          updates.slackThreads = result.results;
        }

        // レガシー互換: 単一TSも保存
        if (result.ts) {
          updates.slackThreadTs = result.ts;
        }

        if (Object.keys(updates).length > 0) {
          await updateRoom(roomId, updates);
          console.log('[Integration/Slack] 通知情報を保存しました:', updates);
        }
      }
    } catch (error) {
      console.warn('[Integration/Slack] 部屋作成通知でエラー:', error);
      // エラーを投げない（部屋作成処理を中断しない）
    }
  }, []);

  /**
   * 参加者追加通知（スレッド返信）
   * 
   * @param {Object} params
   * @param {string} params.threadTs - Slackスレッド識別子
   * @param {string} params.userName - 参加者名
   * @param {number} params.participantCount - 現在の参加者数
   * @param {string} params.workspaceId - 通知先ワークスペースID (部屋データから取得)
   * @returns {Promise<void>}
   */
  const notifyParticipantJoined = useCallback(async ({ threadTs, threadTsMap, userName, participantCount, workspaceId }) => {
    if (!threadTs && !threadTsMap) return; // スレッド情報がない場合は何もしない

    try {
      await postParticipantJoined({
        threadTs,
        threadTsMap,
        userName,
        participantCount,
        workspaceId
      });
    } catch (error) {
      console.warn('[Integration/Slack] 参加通知でエラー:', error);
    }
  }, []);

  /**
   * 部屋終了通知（スレッド返信）
   * 
   * @param {Object} params
   * @param {string} params.threadTs - Slackスレッド識別子
   * @returns {Promise<void>}
   */
  const notifyRoomEnded = useCallback(async ({ threadTs, threadTsMap, workspaceId }) => {
    if (!threadTs && !threadTsMap) return; // スレッド情報がない場合は何もしない

    try {
      await postRoomEnded({ threadTs, threadTsMap, workspaceId });
    } catch (error) {
      console.warn('[Integration/Slack] 終了通知でエラー:', error);
    }
  }, []);

  return {
    notifyRoomCreated,
    notifyParticipantJoined,
    notifyRoomEnded
  };
};
