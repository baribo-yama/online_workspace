/**
 * LiveKit設定ファイル
 * 
 * リアルタイムビデオ通話機能のためのLiveKit設定を管理
 * 
 * 主な機能:
 * - LiveKitサーバーへの接続設定
 * - 音声・映像の品質設定
 * - 接続タイムアウトとリトライ設定
 * - アクセストークンの生成
 * 
 * @fileoverview LiveKit統合設定
 */

// === LiveKit基本設定 ===
export const LIVEKIT_CONFIG = {
  // 環境変数から取得（フォールバック付き）
  serverUrl: import.meta.env.VITE_LIVEKIT_URL || 'wss://onlineworkspace-xu7dilqe.livekit.cloud',
  apiKey: import.meta.env.VITE_LIVEKIT_API_KEY || 'dev-api-key',
  apiSecret: import.meta.env.VITE_LIVEKIT_API_SECRET || 'dev-api-secret',
  
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
  return `room-${roomId}`;
};

// 参加者名を生成（Firebaseの参加者名を使用）
export const generateParticipantName = (userName) => {
  return userName || 'Guest';
};

// LiveKitトークンを生成するための関数（開発用）
export const generateAccessToken = async (roomName, participantName) => {
  // 注意: 本番環境では、サーバーサイドでトークンを生成する必要があります
  // ここでは開発用のクライアントサイド実装です
  
  if (!LIVEKIT_CONFIG.apiKey || !LIVEKIT_CONFIG.apiSecret) {
    console.error('LiveKit API KeyまたはSecretが設定されていません');
    return null;
  }

  try {
    // 設定値をログ出力（デバッグ用）
    console.log('LiveKit設定確認:', {
      serverUrl: LIVEKIT_CONFIG.serverUrl,
      hasApiKey: !!LIVEKIT_CONFIG.apiKey,
      hasApiSecret: !!LIVEKIT_CONFIG.apiSecret,
      apiKeyLength: LIVEKIT_CONFIG.apiKey?.length,
      apiSecretLength: LIVEKIT_CONFIG.apiSecret?.length,
      isUsingEnvVars: !!(import.meta.env.VITE_LIVEKIT_URL && import.meta.env.VITE_LIVEKIT_API_KEY && import.meta.env.VITE_LIVEKIT_API_SECRET)
    });

    // joseライブラリを使用してJWTトークンを生成
    const { SignJWT } = await import('jose');
    
    const secret = new TextEncoder().encode(LIVEKIT_CONFIG.apiSecret);
    
    const token = await new SignJWT({
      video: {
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
      },
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .setIssuer(LIVEKIT_CONFIG.apiKey)
      .setSubject(participantName)
      .sign(secret);
    
    console.log('開発用トークン生成完了:', { roomName, participantName, tokenLength: token.length });
    return token;
    
  } catch (error) {
    console.error('トークン生成エラー:', error);
    return null;
  }
};

