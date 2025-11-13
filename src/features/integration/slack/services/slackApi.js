/**
 * Slack Web API クライアント（Cloud Functions プロキシ経由）
 * 
 * 【設計原則】
 * - 低レベルのAPI通信に特化
 * - Cloud Functions 経由で Slack API を呼び出し（CORS回避 + セキュリティ強化）
 * - エラー時も呼び出し元の処理を中断しない
 * - タイムアウト設定でハング防止
 * - React非依存（純粋なJavaScript）
 * 
 * 【アーキテクチャ】
 * フロントエンド → Cloud Functions → Slack API
 * - Bot Token は Secret Manager で管理
 * - CORS の制約を回避
 */

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
    return { ok: false, error: 'slack_disabled' };
  }

  try {
    const response = await fetch(SLACK_CONFIG.functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        channel: SLACK_CONFIG.channelId,
        ...payload
      }),
      signal: AbortSignal.timeout(SLACK_CONFIG.timeout)
    });

    const data = await response.json();
    
    if (!data.ok) {
      console.warn('[Integration/Slack] Cloud Function エラー:', data.error);
    }
    
    return data;
  } catch (error) {
    if (error.name === 'TimeoutError') {
      console.warn(`[Integration/Slack] タイムアウト（${SLACK_CONFIG.timeout}ms）`);
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
  return sendViaCloudFunction({ text: message });
};

/**
 * 参加者追加通知を送信（スレッド返信）
 * @param {Object} data - 参加データ
 * @param {string} data.threadTs - Slackスレッド識別子
 * @param {string} data.userName - 参加者名
 * @param {number} data.participantCount - 現在の参加者数
 * @returns {Promise<{ok: boolean}>}
 */
export const postParticipantJoined = async ({ threadTs, userName, participantCount }) => {
  const message = buildParticipantJoinedMessage({ userName, participantCount });
  return sendViaCloudFunction({
    text: message,
    thread_ts: threadTs
  });
};

/**
 * 部屋終了通知を送信（スレッド返信）
 * @param {Object} data - 終了データ
 * @param {string} data.threadTs - Slackスレッド識別子
 * @returns {Promise<{ok: boolean}>}
 */
export const postRoomEnded = async ({ threadTs }) => {
  const message = buildRoomEndedMessage();
  return sendViaCloudFunction({
    text: message,
    thread_ts: threadTs
  });
};
