// src/shared/config/websocket.js
// WebSocket設定

export const WEBSOCKET_CONFIG = {
  // 環境変数からWebSocket URLを取得、デフォルトはlocalhost
  URL: import.meta.env.VITE_WEBSOCKET_URL || "ws://localhost:8080",

  // 接続タイムアウト（ミリ秒）- 本番環境では長めに設定
  CONNECTION_TIMEOUT: isProduction() ? 15000 : 5000,

  // 再接続間隔（ミリ秒）
  RECONNECT_INTERVAL: 3000,

  // 最大再接続試行回数
  MAX_RECONNECT_ATTEMPTS: 10,

  // ping/pong設定
  PING_INTERVAL: 30000, // 30秒
  PONG_TIMEOUT: 10000,  // 10秒
};

// 環境判定
export function isProduction() {
  return import.meta.env.MODE === 'production';
}

// WebSocket URLの検証
export function validateWebSocketUrl(url) {
  if (!url) return false;
  return url.startsWith('ws://') || url.startsWith('wss://');
}

// デフォルトURLを取得
export function getDefaultWebSocketUrl() {
  if (isProduction()) {
    const prodUrl = import.meta.env.VITE_WEBSOCKET_URL_PROD;
    if (prodUrl && validateWebSocketUrl(prodUrl)) {
      return prodUrl;
    }
    // RenderのWebSocketサーバーURL（HTTPSをWSSに変更）
    return "wss://online-workspace.onrender.com";
  } else {
    return "ws://localhost:8080";
  }
}

// 環境に応じたWebSocket URLを取得
export function getWebSocketUrl() {
  const envUrl = import.meta.env.VITE_WEBSOCKET_URL;

  if (envUrl && validateWebSocketUrl(envUrl)) {
    console.log(`WebSocket URL: ${envUrl} (環境: ${import.meta.env.MODE})`);
    return envUrl;
  }

  const defaultUrl = getDefaultWebSocketUrl();
  console.warn(`環境変数 VITE_WEBSOCKET_URL が無効または未設定です。デフォルト値を使用: ${defaultUrl}`);
  return defaultUrl;
}
