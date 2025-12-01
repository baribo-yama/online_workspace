/**
 * Slack連携の環境変数管理
 * 
 * 【役割】
 * - Cloud Functions URL とワークスペース選択の一元管理
 * - 環境変数の存在チェックとバリデーション
 * - Slack機能の有効/無効判定
 * 
 * 【アーキテクチャ】
 * - Bot Token と Channel ID は Secret Manager / Cloud Function で管理（セキュリティ強化）
 * - フロントエンドは Cloud Functions 経由で Slack API を呼び出し
 * - ワークスペース選択はリクエストパラメータで指定
 */

export const SLACK_CONFIG = {
  functionUrl: import.meta.env.VITE_SLACK_FUNCTION_URL,
  activeWorkspace: import.meta.env.VITE_SLACK_ACTIVE_WORKSPACE || 'workspace-a', // デフォルト
  featureEnabledRaw: import.meta.env.VITE_SLACK_FEATURE_ENABLED,
  timeout: 5000, // 5秒
};

// 環境変数バリデーション（起動時チェック）
if (!SLACK_CONFIG.functionUrl) {
  console.warn(
    '[Integration/Slack] 環境変数未設定。Slack通知機能は無効化されます。\n' +
    '必要な変数: VITE_SLACK_FUNCTION_URL'
  );
}

/**
 * Slack機能フラグが有効かどうか
 * - 既定: true（未設定時はオン）
 * - 許容: "true"/"false"/"1"/"0"（大文字小文字無視）
 */
export const isSlackFeatureEnabled = () => {
  const raw = SLACK_CONFIG.featureEnabledRaw;
  if (raw == null || raw === '') return true; // default ON
  const v = String(raw).trim().toLowerCase();
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  // 不正値は安全側でON
  return true;
};

/**
 * Slack連携が有効かどうかを判定
 * @returns {boolean} 環境変数が正しく設定されている場合 true
 */
export const isSlackEnabled = () => {
  return Boolean(
    isSlackFeatureEnabled() &&
    SLACK_CONFIG.functionUrl
  );
};
