/**
 * Slack Web API クライアント（Cloud Functions プロキシ経由）
 * 
 * 【設計原則】
 * - Firebase匿名認証によるBot攻撃防止
 * - Cloud Functions 経由で Slack API を呼び出し（CORS回避 + セキュリティ強化）
 * - エラー時も呼び出し元の処理を中断しない
 * - タイムアウト設定でハング防止
 * - React非依存（純粋なJavaScript）
 * 
 * 【アーキテクチャ】
 * フロントエンド（認証済み） → Cloud Functions（認証検証） → Slack API
 * - Bot Token は Secret Manager で管理
 * - CORS の制約を回避
 * - 認証済みユーザーのみがアクセス可能
 */

import { auth } from '../../../../shared/services/firebase.js';
import { SLACK_CONFIG, isSlackEnabled } from '../constants/config.js';
import {
  buildRoomCreatedMessage,
  buildParticipantJoinedMessage,
  buildRoomEndedMessage
} from './messageBuilder.js';

/**
 * Cloud Functions プロキシ経由で Slack 通知を送信
 * @private
 * @param {Object} payload - リクエストペイロード
 * @param {string} payload.text - メッセージ本文
 * @param {string} [payload.thread_ts] - スレッドID（返信の場合）
 * @returns {Promise<{ok: boolean, ts?: string, error?: string}>}
 */
const sendViaCloudFunction = async (payload) => {
  if (!isSlackEnabled()) {
    console.log('[Integration/Slack] 機能が無効化されています');
    return { ok: false, error: 'slack_disabled' };
  }

  try {
    // ❶ Firebase認証済みユーザーのID Tokenを取得
    const user = auth.currentUser;

    if (!user) {
      console.error('[Integration/Slack] ユーザーが認証されていません');
      console.error('[Integration/Slack] App.jsx で signInAnonymously() が実行されているか確認してください');
      return { ok: false, error: 'not_authenticated' };
    }

    // ❷ ID Tokenを取得（有効期限1時間、自動更新）
    const idToken = await user.getIdToken();

    // ❸ Cloud FunctionにID Tokenとワークスペース情報を送信
    const response = await fetch(SLACK_CONFIG.functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        workspace: payload.workspaceId || SLACK_CONFIG.activeWorkspace, // 指定があればそれを使う、なければデフォルト
        ...payload
      }),
      signal: AbortSignal.timeout(SLACK_CONFIG.timeout)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn('[Integration/Slack] Cloud Function エラー:', {
        status: response.status,
        error: errorData.error,
        message: errorData.message
      });
      return { ok: false, error: errorData.error || `HTTP ${response.status}` };
    }

    const data = await response.json();

    if (!data.ok) {
      console.warn('[Integration/Slack] Slack API エラー:', data.error);
    }

    return data;

  } catch (error) {
    if (error.name === 'TimeoutError') {
      console.warn(`[Integration/Slack] タイムアウト（${SLACK_CONFIG.timeout}ms）`);
    } else if (error.message?.includes('getIdToken')) {
      console.error('[Integration/Slack] ID Token取得エラー:', error.message);
      console.error('[Integration/Slack] Firebase認証が初期化されているか確認してください');
    } else {
      console.warn('[Integration/Slack] ネットワークエラー:', error.message);
    }
    return { ok: false, error: error.message };
  }
};

/**
 * 部屋作成通知を送信
 * @param {Object} roomData - 部屋データ
 * @param {string} roomData.hostName - ホスト名
 * @param {string} roomData.roomTitle - 部屋タイトル
 * @param {string} roomData.roomUrl - 部屋URL
 * @returns {Promise<{ok: boolean, ts?: string}>} ts: スレッドID
 */
export const postRoomCreated = async (roomData) => {
  const message = buildRoomCreatedMessage(roomData);
  return sendViaCloudFunction({
    text: message,
    workspaceId: roomData.workspaceId
  });
};

/**
 * 参加者追加通知を送信（スレッド返信）
 * @param {Object} data - 参加データ
 * @param {string} data.threadTs - Slackスレッド識別子
 * @param {string} data.userName - 参加者名
 * @param {number} data.participantCount - 現在の参加者数
 * @returns {Promise<{ok: boolean}>}
 */
export const postParticipantJoined = async ({ threadTs, threadTsMap, userName, participantCount, workspaceId }) => {
  const message = buildParticipantJoinedMessage({ userName, participantCount });
  return sendViaCloudFunction({
    text: message,
    thread_ts: threadTs,
    thread_ts_map: threadTsMap,
    workspaceId
  });
};

/**
 * 部屋終了通知を送信（スレッド返信）
 * @param {Object} data - 終了データ
 * @param {string} data.threadTs - Slackスレッド識別子
 * @returns {Promise<{ok: boolean}>}
 */
export const postRoomEnded = async ({ threadTs, threadTsMap, workspaceId }) => {
  const message = buildRoomEndedMessage();
  return sendViaCloudFunction({
    text: message,
    thread_ts: threadTs,
    thread_ts_map: threadTsMap,
    workspaceId
  });
};
