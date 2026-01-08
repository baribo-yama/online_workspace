/**
 * LiveKit設定ファイル
 * 
 * リアルタイムビデオ通話機能のためのLiveKit設定を管理
 * 
 * 主な機能:
 * - LiveKitサーバーへの接続設定
 * - 音声・映像の品質設定
 * - 接続タイムアウトとリトライ設定
 * - アクセストークンの生成（Cloud Functions経由）
 * 
 * @fileoverview LiveKit統合設定
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '@/shared/services/firebase';

/**
 * Cloud Functions経由でLiveKitトークンを取得
 * 
 * @param {string} roomName - LiveKitルーム名（例: "room-abc123"）
 * @param {string} identity - 参加者の識別子（例: "user-name"）
 * @returns {Promise<string>} JWTトークン
 * @throws {Error} トークン取得に失敗した場合
 */
export const fetchLivekitToken = async (roomName, identity) => {
  try {
    const callable = httpsCallable(functions, 'createLivekitToken');
    const { data } = await callable({ roomName, identity });
    
    if (!data || !data.token) {
      throw new Error('トークンが返されませんでした');
    }
    
    return data.token;
  } catch (error) {
    console.error('LiveKitトークン取得失敗:', error);
    
    // HttpsErrorの場合はcodeプロパティを保持してそのまま再スロー
    if (error.code) {
      throw error;
    }
    
    // その他のエラーの場合は新しいErrorをスロー
    throw new Error(`トークン取得エラー: ${error.message}`);
  }
};

// === LiveKit基本設定 ===
export const LIVEKIT_CONFIG = {
  // 環境変数から取得（フォールバック付き）
  serverUrl: import.meta.env.VITE_LIVEKIT_URL || 'https://onlineworkspace-xu7dilqe.livekit.cloud',
  // 注意: apiKeyとapiSecretはクライアント側では使用しません（Cloud Functionsで管理）
  
  // デフォルト設定
  defaultOptions: {
    // 音声設定
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    // 映像設定
    video: {
      resolution: {
        width: 640,
        height: 480,
      },
      frameRate: 30,
    },
    // 接続設定
    connection: {
      timeout: 30000, // 30秒のタイムアウト
      reconnectPolicy: {
        nextRetryDelayInMs: (context) => {
          return Math.min(context.retryCount * 1000, 5000);
        },
        maxRetries: 3,
      },
    },
    // メディア設定
    publishDefaults: {
      videoSimulcastLayers: [
        { resolution: { width: 320, height: 240 }, encoding: { maxBitrate: 100000 } },
        { resolution: { width: 640, height: 480 }, encoding: { maxBitrate: 300000 } },
      ],
    },
  },
};

// LiveKitルーム名を生成（Firebaseの部屋IDを使用）
export const generateRoomName = (roomId) => {
  if (!roomId || typeof roomId !== 'string') {
    throw new Error('roomId is required and must be a string');
  }
  return `room-${roomId}`;
};

// 参加者名を生成（Firebaseの参加者名を使用）
export const generateParticipantName = (userName) => {
  return userName || 'Guest';
};

// 注意: クライアント側でのトークン生成は非推奨です
// Cloud Functions経由でトークンを取得するため、fetchLivekitTokenを使用してください

