/**
 * Slack連携の環境変数管理
 * 
 * 【役割】
 * - Cloud Functions URL と Channel ID の一元管理
 * - 環境変数の存在チェックとバリデーション
 * - Slack機能の有効/無効判定
 * 
 * 【アーキテクチャ】
 * - Bot Tokenは Secret Manager で管理（セキュリティ強化）
 * - フロントエンドは Cloud Functions 経由で Slack API を呼び出し
 */

export const SLACK_CONFIG = {
  functionUrl: import.meta.env.VITE_SLACK_FUNCTION_URL,
  channelId: import.meta.env.VITE_SLACK_CHANNEL_ID,
  timeout: 5000, // 5秒
};

// 環境変数バリデーション（起動時チェック）
if (!SLACK_CONFIG.functionUrl || !SLACK_CONFIG.channelId) {
  console.warn(
    '[Integration/Slack] 環境変数未設定。Slack通知機能は無効化されます。\n' +
    '必要な変数: VITE_SLACK_FUNCTION_URL, VITE_SLACK_CHANNEL_ID'
  );
}

/**
 * Slack連携が有効かどうかを判定
 * @returns {boolean} 環境変数が正しく設定されている場合 true
 */
export const isSlackEnabled = () => {
  return Boolean(SLACK_CONFIG.functionUrl && SLACK_CONFIG.channelId);
};
