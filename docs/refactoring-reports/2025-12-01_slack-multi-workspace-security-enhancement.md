# Slack統合：複数ワークスペース対応とセキュリティ強化

**作成日**: 2025年12月1日  
**カテゴリ**: リファクタリング  
**影響範囲**: フロントエンド（React/Vite）、Cloud Functions（Firebase）  
**優先度**: 高（セキュリティ改善）

---

## 1. 背景と目的

### 現在の問題点

#### セキュリティリスク
1. **チャンネルIDの公開**
   - `VITE_SLACK_CHANNEL_ID` がフロントエンドに埋め込まれている
   - DevToolsで誰でも確認可能
   - 意図しないチャンネルへの投稿を誘発する可能性

2. **Cloud Function URLの保護不足**
   - 認証なしで誰でもPOSTリクエスト送信可能
   - スパム攻撃、レート制限超過のリスク

3. **ワークスペース切り替えの困難さ**
   - 別のSlackワークスペースに切り替える際、Cloud Functionを再デプロイする必要がある
   - 運用コストが高い

### 目標

1. **セキュリティ強化**
   - チャンネルIDをCloud Function側で管理（フロントエンドから削除）
   - Firebase認証によるアクセス制限
   - 認証済みユーザーのみがSlack通知を送信可能に

2. **複数ワークスペース対応**
   - 1つのCloud Functionで複数のSlackワークスペースに対応
   - 環境変数の変更だけでワークスペースを切り替え可能
   - Cloud Functionの再デプロイ不要

3. **運用効率化**
   - `.env` の1行変更 + サーバー再起動だけで切り替え完了
   - 開発/本番環境の設定を明確に分離

---

## 2. アーキテクチャ設計

### 情報の流れ（改善後）

```
フロントエンド（React/Vite）
    ↓
    1. Firebase認証済みユーザーがID Tokenを取得
    ↓
slackApi.js
    ↓
    2. fetch(VITE_SLACK_FUNCTION_URL, {
         headers: { Authorization: `Bearer ${idToken}` },
         body: { workspace: 'workspace-a', roomTitle, ... }
       })
    ↓
Cloud Functions (sendSlackNotification)
    ↓
    3. Firebase ID Tokenを検証（認証チェック）
    4. リクエストからworkspace指定を取得
    5. WORKSPACE_CONFIG[workspace]から設定を読み込み
       - secretName: Secret Managerのパス
       - channelId: 投稿先チャンネルID
    ↓
Secret Manager
    ↓
    6. ワークスペースに対応するBot Tokenを取得
    ↓
Slack API (chat.postMessage)
    ↓
    7. 指定されたチャンネルに投稿
    ↓
Slackワークスペース
```

### セキュリティレイヤー

| レイヤー | 現在の実装 | 改善後 |
|---------|-----------|--------|
| **Bot Token** | ✅ Secret Manager | ✅ Secret Manager（ワークスペースごと） |
| **チャンネルID** | ❌ フロントエンド公開 | ✅ Cloud Function内で管理 |
| **エンドポイント保護** | ❌ 認証なし | ✅ Firebase ID Token必須 |
| **レート制限** | ❌ なし | ✅ Firebase Auth + Cloud Functions自動制限 |
| **ワークスペース切り替え** | ❌ 再デプロイ必要 | ✅ 環境変数のみ |

---

## 3. 実装仕様

### 3.1 フロントエンド側の変更

#### ファイル: `.env`

**変更内容**:
- `VITE_SLACK_CHANNEL_ID` を削除（セキュリティリスク）
- `VITE_SLACK_ACTIVE_WORKSPACE` を追加（ワークスペース選択）

```bash
# 変更前
VITE_SLACK_FEATURE_ENABLED=true
VITE_SLACK_CHANNEL_ID=C09SB7A96DU
VITE_SLACK_FUNCTION_URL=https://asia-northeast1-online-workspace-1c2a4.cloudfunctions.net/sendSlackNotification

# 変更後
VITE_SLACK_FEATURE_ENABLED=true
VITE_SLACK_FUNCTION_URL=https://asia-northeast1-online-workspace-1c2a4.cloudfunctions.net/sendSlackNotification
VITE_SLACK_ACTIVE_WORKSPACE=workspace-a
```

#### ファイル: `.env.example`

**変更内容**: 同様の修正を反映

```bash
# Slack Integration
VITE_SLACK_FEATURE_ENABLED=true
VITE_SLACK_FUNCTION_URL=https://your-cloud-function-url
# ワークスペース選択（workspace-a, workspace-b など）
VITE_SLACK_ACTIVE_WORKSPACE=workspace-a
```

#### ファイル: `src/features/integration/slack/constants/config.js`

**変更内容**:
- `channelId` プロパティを削除
- `activeWorkspace` プロパティを追加
- バリデーション条件を更新

```javascript
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
```

#### ファイル: `src/features/integration/slack/services/slackApi.js`

**変更内容**:
- Firebase ID Token取得処理を追加
- `Authorization` ヘッダーを追加
- `workspace` パラメータをリクエストボディに追加
- `channelId` パラメータを削除（Cloud Function側で管理）

```javascript
/**
 * Slack Web API クライアント（Cloud Functions プロキシ経由）
 * 
 * 【設計原則】
 * - 低レベルのAPI通信に特化
 * - Cloud Functions 経由で Slack API を呼び出し（CORS回避 + セキュリティ強化）
 * - Firebase認証によるアクセス制限
 * - エラー時も呼び出し元の処理を中断しない
 * - タイムアウト設定でハング防止
 * - React非依存（純粋なJavaScript）
 * 
 * 【アーキテクチャ】
 * フロントエンド（認証済み） → Cloud Functions（認証検証） → Slack API
 * - Bot Token と Channel ID は Secret Manager / Cloud Function で管理
 * - CORS の制約を回避
 * - 認証済みユーザーのみがアクセス可能
 */

import { auth } from '../../../../config/firebase.js';
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
    // Firebase ID Token を取得（認証済みユーザーのみ）
    const user = auth.currentUser;
    if (!user) {
      console.warn('[Integration/Slack] ユーザーが認証されていません');
      return { ok: false, error: 'not_authenticated' };
    }

    const idToken = await user.getIdToken();

    const response = await fetch(SLACK_CONFIG.functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${idToken}`, // 認証トークン
      },
      body: JSON.stringify({
        workspace: SLACK_CONFIG.activeWorkspace, // ワークスペース指定
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
```

---

### 3.2 Cloud Functions側の変更

#### ファイル: `functions/slack/notify.js`

**変更内容**:
- Firebase Admin SDKによるID Token検証を追加
- 複数ワークスペース対応の設定オブジェクト（`WORKSPACE_CONFIG`）を追加
- リクエストから `workspace` パラメータを取得
- `channel` パラメータをリクエストボディから削除（Cloud Function側で管理）
- CORS設定を本番ドメインのみに制限

```javascript
const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

// Firebase Admin SDK初期化（既存のindex.jsで初期化済みの場合は不要）
if (!admin.apps.length) {
  admin.initializeApp();
}

// Slack API エンドポイント
const SLACK_API_BASE = "https://slack.com/api";

/**
 * 複数ワークスペース設定
 * - 各ワークスペースごとに Secret Manager のシークレット名とチャンネルIDを管理
 * - ワークスペース追加時はここに設定を追加するだけ
 */
const WORKSPACE_CONFIG = {
  "workspace-a": {
    secretName: "SLACK_BOT_TOKEN_WORKSPACE_A", // Secret Manager のシークレット名
    channelId: "C09SB7A96DU", // ワークスペースAのチャンネルID
  },
  "workspace-b": {
    secretName: "SLACK_BOT_TOKEN_WORKSPACE_B",
    channelId: "C1234567890", // ワークスペースBのチャンネルID（例）
  },
  // 新しいワークスペースを追加する場合はここに追記
};

/**
 * Slack API への汎用POST関数
 * @param {string} endpoint - APIエンドポイント
 * @param {object} body - リクエストボディ
 * @param {string} botToken - Bot User OAuth Token
 * @returns {Promise<object>} Slack API レスポンス
 */
const postToSlackApi = async (endpoint, body, botToken) => {
  try {
    const response = await fetch(`${SLACK_API_BASE}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Bearer ${botToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!data.ok) {
      logger.warn(`Slack API エラー: ${data.error}`, {
        endpoint,
        error: data.error,
      });
    }

    return data;
  } catch (error) {
    logger.error("Slack API 呼び出しエラー:", error);
    throw error;
  }
};

/**
 * Slack通知を送信するHTTPS関数（複数ワークスペース対応 + Firebase認証）
 * 
 * リクエストヘッダー:
 * - Authorization: Bearer <Firebase ID Token> (必須)
 * 
 * リクエストボディ:
 * {
 *   "workspace": "workspace-a",  // ワークスペース指定（省略時はworkspace-a）
 *   "text": "メッセージ内容",
 *   "thread_ts": "1234567890.123456" (オプション)
 * }
 * 
 * レスポンス:
 * {
 *   "ok": true,
 *   "ts": "1234567890.123456",
 *   "channel": "C09SB7A96DU",
 *   "workspace": "workspace-a"
 * }
 */
exports.sendSlackNotification = onRequest(
    {
      // CORS設定（本番ドメインのみ許可）
      cors: [
        "https://online-workspace-1c2a4.web.app",
        "https://online-workspace-1c2a4.firebaseapp.com",
        /^http:\/\/localhost:\d+$/, // 開発環境（任意のポート）
      ],
      // Secret Manager から複数のシークレットを取得可能にする
      secrets: [
        "SLACK_BOT_TOKEN_WORKSPACE_A",
        "SLACK_BOT_TOKEN_WORKSPACE_B",
      ],
      region: "asia-northeast1", // 東京リージョン（レイテンシ削減）
    },
    async (req, res) => {
      // POST メソッドのみ許可
      if (req.method !== "POST") {
        res.status(405).json({
          ok: false,
          error: "Method Not Allowed",
        });
        return;
      }

      try {
        // ❶ Firebase ID Token検証（認証済みユーザーのみ許可）
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          logger.warn("認証ヘッダーが不正または欠落");
          res.status(401).json({
            ok: false,
            error: "Unauthorized",
            message: "Firebase ID Tokenが必要です",
          });
          return;
        }

        const idToken = authHeader.split("Bearer ")[1];
        let decodedToken;

        try {
          decodedToken = await admin.auth().verifyIdToken(idToken);
          logger.info("認証成功", {
            uid: decodedToken.uid,
            email: decodedToken.email,
          });
        } catch (error) {
          logger.warn("無効なID Token", {error: error.message});
          res.status(401).json({
            ok: false,
            error: "Unauthorized",
            message: "無効な認証トークンです",
          });
          return;
        }

        // ❷ リクエストボディを取得
        const {workspace = "workspace-a", text, thread_ts} = req.body;

        // ❸ バリデーション
        if (!text) {
          res.status(400).json({
            ok: false,
            error: "Bad Request",
            message: "text は必須です",
          });
          return;
        }

        // ❹ ワークスペース設定を取得
        const config = WORKSPACE_CONFIG[workspace];
        if (!config) {
          logger.warn("無効なワークスペース指定", {workspace});
          res.status(400).json({
            ok: false,
            error: "Bad Request",
            message: `無効なワークスペース: ${workspace}`,
          });
          return;
        }

        // ❺ Secret Manager から対応するBot Tokenを取得
        const botToken = process.env[config.secretName];
        if (!botToken) {
          logger.error(`${config.secretName} が設定されていません`);
          res.status(500).json({
            ok: false,
            error: "Internal Server Error",
            message: "サーバー設定エラー",
          });
          return;
        }

        logger.info("Slack通知送信開始", {
          workspace,
          channel: config.channelId,
          textPreview: text.substring(0, 50),
          hasThread: !!thread_ts,
          userId: decodedToken.uid,
        });

        // ❻ Slack API 呼び出し
        const result = await postToSlackApi(
            "chat.postMessage",
            {
              channel: config.channelId, // Cloud Function側で管理
              text,
              ...(thread_ts && {thread_ts}),
            },
            botToken,
        );

        if (result.ok) {
          logger.info("Slack通知成功", {
            ts: result.ts,
            channel: result.channel,
            workspace,
          });

          res.status(200).json({
            ok: true,
            ts: result.ts,
            channel: result.channel,
            workspace, // どのワークスペースに送信されたかを返す
          });
        } else {
          logger.warn("Slack API エラー", {
            error: result.error,
            workspace,
          });

          res.status(400).json({
            ok: false,
            error: result.error,
          });
        }
      } catch (error) {
        logger.error("Slack通知送信エラー:", error);
        res.status(500).json({
          ok: false,
          error: "Internal Server Error",
        });
      }
    },
);
```

#### ファイル: `functions/package.json`

**変更内容**: 依存関係に `firebase-admin` が含まれていることを確認（既存）

```json
{
  "dependencies": {
    "firebase-admin": "^12.6.0",
    "firebase-functions": "^6.0.1"
  }
}
```

---

### 3.3 Secret Manager の設定

#### 手順1: ワークスペースごとのBot Tokenを保存

```bash
# ワークスペースA用のBot Token（既存）
echo "xoxb-your-workspace-a-token" | gcloud secrets create SLACK_BOT_TOKEN_WORKSPACE_A \
  --data-file=- \
  --project=online-workspace-1c2a4 \
  --replication-policy="automatic"

# ワークスペースB用のBot Token（新規）
echo "xoxb-your-workspace-b-token" | gcloud secrets create SLACK_BOT_TOKEN_WORKSPACE_B \
  --data-file=- \
  --project=online-workspace-1c2a4 \
  --replication-policy="automatic"
```

#### 手順2: Cloud FunctionsにSecret Managerアクセス権限を付与

```bash
# Cloud Functionsのサービスアカウントを確認
gcloud functions describe sendSlackNotification \
  --region=asia-northeast1 \
  --project=online-workspace-1c2a4 \
  --format="value(serviceAccountEmail)"

# 出力例: online-workspace-1c2a4@appspot.gserviceaccount.com

# シークレットアクセス権限を付与
gcloud secrets add-iam-policy-binding SLACK_BOT_TOKEN_WORKSPACE_A \
  --member="serviceAccount:online-workspace-1c2a4@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=online-workspace-1c2a4

gcloud secrets add-iam-policy-binding SLACK_BOT_TOKEN_WORKSPACE_B \
  --member="serviceAccount:online-workspace-1c2a4@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=online-workspace-1c2a4
```

#### 手順3: Cloud Functionを再デプロイ

```bash
cd functions

# Cloud Functionをデプロイ（複数シークレット対応）
firebase deploy --only functions:sendSlackNotification

# または gcloud コマンド
gcloud functions deploy sendSlackNotification \
  --gen2 \
  --runtime=nodejs22 \
  --region=asia-northeast1 \
  --source=. \
  --entry-point=sendSlackNotification \
  --trigger-http \
  --allow-unauthenticated \
  --set-secrets='SLACK_BOT_TOKEN_WORKSPACE_A=SLACK_BOT_TOKEN_WORKSPACE_A:latest,SLACK_BOT_TOKEN_WORKSPACE_B=SLACK_BOT_TOKEN_WORKSPACE_B:latest' \
  --project=online-workspace-1c2a4
```

---

### 3.4 ドキュメント更新

#### ファイル: `README.md`

**変更箇所**: Slack統合セクション

```markdown
### Slack統合（オプション）

複数のSlackワークスペースに対応しています。環境変数でワークスペースを切り替えることができます。

**環境変数**:
```bash
# Slack機能の有効/無効（デフォルト: true）
VITE_SLACK_FEATURE_ENABLED=true

# Cloud Function URL（変更不要）
VITE_SLACK_FUNCTION_URL=https://asia-northeast1-online-workspace-1c2a4.cloudfunctions.net/sendSlackNotification

# ワークスペース選択（workspace-a, workspace-b など）
VITE_SLACK_ACTIVE_WORKSPACE=workspace-a
```

**ワークスペース切り替え手順**:
1. `.env` の `VITE_SLACK_ACTIVE_WORKSPACE` を変更（例: `workspace-a` → `workspace-b`）
2. 開発サーバー再起動: `npm run dev:full`

**セキュリティ**:
- Bot TokenとチャンネルIDはCloud Functions側で管理
- Firebase認証済みユーザーのみが通知を送信可能
- フロントエンドには機密情報を含めない設計
```

#### ファイル: `.github/copilot-instructions.md`

**変更箇所**: Slack環境変数セクション

```markdown
**Optional: Slack Integration**
```bash
# Feature flag - toggles UI and notifications
# Accepts: true/false/1/0 (defaults to true when unset)
VITE_SLACK_FEATURE_ENABLED=true

# Cloud Function proxy that posts to Slack (do NOT expose tokens in frontend)
VITE_SLACK_FUNCTION_URL=https://your-cloud-function-url

# Active workspace (workspace-a, workspace-b, etc.)
VITE_SLACK_ACTIVE_WORKSPACE=workspace-a
```

### Slack Feature Flag Behavior
- When `VITE_SLACK_FEATURE_ENABLED=false`:
   - Hide the Slack checkbox on Home; notifications are always off
- When `VITE_SLACK_FEATURE_ENABLED=true`:
   - Show the checkbox; workspace selection via `VITE_SLACK_ACTIVE_WORKSPACE`
   - Firebase authentication required for sending notifications
   - Channel ID and Bot Token managed server-side for security
```

---

## 4. 実装手順

### Phase 1: フロントエンド変更（即座に実行可能）

#### ステップ1: 環境変数の修正

```bash
# .env を編集
# - VITE_SLACK_CHANNEL_ID を削除
# - VITE_SLACK_ACTIVE_WORKSPACE=workspace-a を追加
```

#### ステップ2: 設定ファイルの修正

ファイルを以下の順序で修正:
1. `src/features/integration/slack/constants/config.js`
2. `src/features/integration/slack/services/slackApi.js`
3. `.env.example`

#### ステップ3: 動作確認

```bash
# 開発サーバー起動
npm run dev:full

# ブラウザで確認
# 1. ホーム画面でSlackチェックボックスが表示されるか
# 2. 部屋作成時に認証エラーが出ないか（この時点ではCloud Function側が未対応なので通知は失敗する）
```

### Phase 2: Cloud Functions変更（GCPデプロイが必要）

#### ステップ1: Secret Managerにシークレット追加

```bash
# 現在のSLACK_BOT_TOKENをワークスペースA用に移行
gcloud secrets versions list SLACK_BOT_TOKEN --project=online-workspace-1c2a4

# 新しいシークレットを作成
echo "xoxb-your-workspace-a-token" | gcloud secrets create SLACK_BOT_TOKEN_WORKSPACE_A \
  --data-file=- \
  --project=online-workspace-1c2a4

# ワークスペースB用（後で追加する場合）
echo "xoxb-your-workspace-b-token" | gcloud secrets create SLACK_BOT_TOKEN_WORKSPACE_B \
  --data-file=- \
  --project=online-workspace-1c2a4
```

#### ステップ2: Cloud Functionコードの修正

`functions/slack/notify.js` を修正（上記仕様参照）

#### ステップ3: デプロイ

```bash
cd functions

# Firebaseプロジェクトを確認
firebase use

# デプロイ
firebase deploy --only functions:sendSlackNotification

# デプロイ成功後、URLを確認
# 出力例: https://asia-northeast1-online-workspace-1c2a4.cloudfunctions.net/sendSlackNotification
```

#### ステップ4: 動作確認

```bash
# フロントエンド側で部屋を作成し、Slack通知が送信されるか確認
npm run dev:full

# ブラウザで:
# 1. 部屋を作成（Slackチェックボックスをオン）
# 2. Slackワークスペースに通知が届くか確認
# 3. Cloud Functionsのログを確認
gcloud functions logs read sendSlackNotification \
  --region=asia-northeast1 \
  --project=online-workspace-1c2a4 \
  --limit=20
```

### Phase 3: ドキュメント更新

1. `README.md` のSlack統合セクションを更新
2. `.github/copilot-instructions.md` の環境変数セクションを更新
3. `docs/PROJECT_OVERVIEW.md` にセキュリティ改善を記載

---

## 5. 検証シナリオ

### 5.1 セキュリティ検証

#### テスト1: 認証なしでアクセス
```bash
# 期待結果: 401 Unauthorized
curl -X POST https://asia-northeast1-online-workspace-1c2a4.cloudfunctions.net/sendSlackNotification \
  -H "Content-Type: application/json" \
  -d '{"workspace":"workspace-a","text":"Test"}'
```

#### テスト2: 無効なID Token
```bash
# 期待結果: 401 Unauthorized
curl -X POST https://asia-northeast1-online-workspace-1c2a4.cloudfunctions.net/sendSlackNotification \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid-token" \
  -d '{"workspace":"workspace-a","text":"Test"}'
```

#### テスト3: DevToolsでチャンネルIDが見えないか確認
1. ブラウザのDevToolsを開く
2. Sourcesタブで `config.js` を確認
3. `VITE_SLACK_CHANNEL_ID` が存在しないことを確認

### 5.2 機能検証

#### テスト1: 部屋作成通知（ワークスペースA）
```bash
# .env で VITE_SLACK_ACTIVE_WORKSPACE=workspace-a
# 部屋を作成し、ワークスペースAのチャンネルに通知が届くか確認
```

#### テスト2: ワークスペース切り替え
```bash
# .env で VITE_SLACK_ACTIVE_WORKSPACE=workspace-b に変更
# サーバー再起動
npm run dev:full
# 部屋を作成し、ワークスペースBのチャンネルに通知が届くか確認
```

#### テスト3: スレッド返信
```bash
# 部屋作成後、参加者が追加されたときにスレッド返信されるか確認
# Firestoreに slackThreadTs が保存されているか確認
```

### 5.3 エラーハンドリング検証

#### テスト1: 無効なワークスペース指定
```bash
# .env で VITE_SLACK_ACTIVE_WORKSPACE=invalid-workspace
# 期待結果: Cloud Functionが400エラーを返す
```

#### テスト2: Secret Manager未設定
```bash
# SLACK_BOT_TOKEN_WORKSPACE_B を削除した状態でworkspace-bを指定
# 期待結果: Cloud Functionが500エラーを返す
```

#### テスト3: ネットワークエラー
```bash
# Cloud Function URLを無効なURLに変更
# 期待結果: フロントエンドでエラーログが出るが、部屋作成処理は継続
```

---

## 6. ロールバック手順

万が一問題が発生した場合のロールバック手順:

### フロントエンド側

```bash
# Gitで変更を戻す
git revert <commit-hash>

# .env を元に戻す
VITE_SLACK_FEATURE_ENABLED=true
VITE_SLACK_CHANNEL_ID=C09SB7A96DU
VITE_SLACK_FUNCTION_URL=https://asia-northeast1-online-workspace-1c2a4.cloudfunctions.net/sendSlackNotification

# サーバー再起動
npm run dev:full
```

### Cloud Functions側

```bash
# 以前のバージョンに戻す
firebase functions:rollback sendSlackNotification

# または gcloud コマンド
gcloud functions rollback sendSlackNotification \
  --region=asia-northeast1 \
  --project=online-workspace-1c2a4
```

---

## 7. 今後の拡張性

### 追加ワークスペース対応

新しいSlackワークスペースを追加する手順:

1. **Secret Managerにシークレット追加**
   ```bash
   echo "xoxb-new-workspace-token" | gcloud secrets create SLACK_BOT_TOKEN_WORKSPACE_C \
     --data-file=- \
     --project=online-workspace-1c2a4
   ```

2. **Cloud Functionの設定を更新**
   ```javascript
   // functions/slack/notify.js
   const WORKSPACE_CONFIG = {
     "workspace-a": { ... },
     "workspace-b": { ... },
     "workspace-c": {
       secretName: "SLACK_BOT_TOKEN_WORKSPACE_C",
       channelId: "C9876543210"
     }
   };
   ```

3. **Cloud Functionを再デプロイ**
   ```bash
   firebase deploy --only functions:sendSlackNotification
   ```

4. **フロントエンドで使用**
   ```bash
   # .env
   VITE_SLACK_ACTIVE_WORKSPACE=workspace-c
   ```

### UI改善案（将来的に）

- ホーム画面でワークスペースを選択できるドロップダウンメニュー
- 各ワークスペースのアイコン・名前表示
- 管理画面でワークスペース設定を追加・削除

---

## 8. まとめ

### 実装前後の比較

| 項目 | 実装前 | 実装後 |
|------|--------|--------|
| **チャンネルID** | フロントエンドに公開 | Cloud Function内で管理 |
| **認証** | なし | Firebase ID Token必須 |
| **ワークスペース切り替え** | Cloud Function再デプロイ | .env変更のみ |
| **セキュリティリスク** | 高（スパム攻撃可能） | 低（認証済みユーザーのみ） |
| **運用コスト** | 高（再デプロイ必要） | 低（環境変数のみ） |

### 期待される効果

1. **セキュリティ向上**
   - チャンネルIDがフロントエンドから削除され、漏洩リスクが低減
   - Firebase認証により、認証済みユーザーのみが通知を送信可能
   - スパム攻撃、レート制限超過のリスクが大幅に減少

2. **運用効率化**
   - ワークスペース切り替えが`.env`の1行変更で完了
   - Cloud Functionの再デプロイ不要
   - 開発/本番環境の設定が明確に分離

3. **拡張性向上**
   - 新しいワークスペース追加が容易
   - 設定の一元管理により、メンテナンスが簡単

---

**実装担当者へのメモ**:
- Phase 1（フロントエンド）はリポジトリ内で完結するため、すぐに着手可能
- Phase 2（Cloud Functions）はGCPへのデプロイ権限が必要
- 本番環境での適用前に、開発環境で十分にテスト実施を推奨
