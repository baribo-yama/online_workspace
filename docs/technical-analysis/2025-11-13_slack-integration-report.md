# Slack連携機能 - 技術仕様書

## 概要
Online WorkspaceのSlack連携機能は、部屋の作成や参加者の入退室を指定したSlackチャンネルに自動通知する機能です。
環境変数による柔軟なON/OFF制御と、セキュアなアーキテクチャを採用しています。

**最終更新:** 2024-11-13

---

## アーキテクチャ概要

### 通知フロー
```
Frontend (React)
    ↓ (HTTP POST)
Cloud Functions (Google Cloud)
    ↓ (Slack Web API)
Slack Channel
```

### セキュリティモデル
- **フロントエンド**: Cloud FunctionのURLのみを保持
- **Cloud Functions**: Slack Bot TokenをSecret Managerから取得
- **原則**: 秘密情報はフロントエンドに含めない

---

## 環境変数

### フラグ制御
```bash
# Slack連携機能の有効/無効を制御
# 許容値: true/false/1/0/yes/no/on/off (大文字小文字無視)
# デフォルト: true (未設定時)
VITE_SLACK_FEATURE_ENABLED=true
```

### 通信設定
```bash
# Cloud Function のエンドポイント
VITE_SLACK_FUNCTION_URL=https://asia-northeast1-your-project.cloudfunctions.net/sendSlackNotification

# 通知先のSlackチャンネルID
VITE_SLACK_CHANNEL_ID=C0123456789
```

### 動作マトリクス

| FEATURE_ENABLED | FUNCTION_URL | CHANNEL_ID | UI表示 | 送信動作 |
|-----------------|--------------|------------|--------|----------|
| false           | -            | -          | ❌     | no-op    |
| true            | ❌           | -          | ✅     | no-op    |
| true            | ✅           | ❌         | ✅     | no-op    |
| true            | ✅           | ✅         | ✅     | 送信     |

---

## ファイル構成

### 設定・判定ロジック
**`src/features/integration/slack/constants/config.js`**
```javascript
// 環境変数のパース
export const isSlackFeatureEnabled = () => {
  // VITE_SLACK_FEATURE_ENABLED を boolean に変換
  // デフォルト: true
};

// 送信可否の判定
export const isSlackEnabled = () => {
  // フラグON かつ URL/Channel設定済みで true
};
```

**責務:**
- 環境変数の型変換とバリデーション
- フラグと認証情報の両方をチェック

---

### API通信
**`src/features/integration/slack/services/slackApi.js`**
```javascript
// メイン投稿API（新スレッド作成）
export async function postSlackMessage({ channelId, payload });

// スレッド返信API
export async function postThreadMessage({ channelId, threadTs, payload });
```

**実装詳細:**
- early returnでno-opを実現（認証情報不足時）
- fetch APIでCloud Functionsへリクエスト
- エラー時はログ出力のみ（アプリは継続）

---

### メッセージ生成
**`src/features/integration/slack/services/messageBuilder.js`**
```javascript
// 部屋作成メッセージ
export const buildRoomCreatedMessage = ({ title, hostName, maxParticipants });

// 参加者入室メッセージ
export const buildParticipantJoinedMessage = ({ userName, roomTitle });
```

**フォーマット:**
- Slack Blocks APIを使用
- マークダウン形式のリッチテキスト
- 絵文字でビジュアル強調

---

### Reactカスタムフック
**`src/features/integration/slack/hooks/useSlackNotification.js`**
```javascript
export function useSlackNotification() {
  const notifyRoomCreated = async ({ ... });
  const notifyParticipantJoined = async ({ ... });
  
  return { notifyRoomCreated, notifyParticipantJoined };
}
```

**利用例:**
```javascript
const { notifyRoomCreated } = useSlackNotification();

await notifyRoomCreated({
  channelId: import.meta.env.VITE_SLACK_CHANNEL_ID,
  roomTitle: 'データ構造の勉強会',
  hostName: '田中',
  maxParticipants: 5,
});
```

---

### UI統合

**`src/features/study-room/components/home/HomePage.jsx`**
```javascript
import { isSlackFeatureEnabled } from '../../../integration/slack/constants/config';

const slackFeatureOn = isSlackFeatureEnabled();

// フラグに基づいてチェックボックス表示を制御
<RoomCreationForm 
  showSlackCheckbox={slackFeatureOn}
  // ...
/>

// 送信時にフラグで強制OFF
createRoom({
  // ...
  slackNotificationEnabled: slackFeatureOn && slackNotificationEnabled,
});
```

**`src/features/study-room/components/home/RoomCreationForm.jsx`**
```javascript
export default function RoomCreationForm({ 
  showSlackCheckbox = false, 
  // ... 
}) {
  return (
    <>
      {/* 既存のフォーム要素 */}
      
      {showSlackCheckbox && (
        <label>
          <input 
            type="checkbox" 
            checked={slackNotificationEnabled}
            onChange={(e) => setSlackNotificationEnabled(e.target.checked)}
          />
          Slackに通知する
        </label>
      )}
    </>
  );
}
```

**`src/features/study-room/components/room/RoomPage.jsx`**
```javascript
// 参加者入室時のトリガー
useEffect(() => {
  if (newParticipant) {
    notifyParticipantJoined({
      channelId: room.slackChannelId || import.meta.env.VITE_SLACK_CHANNEL_ID,
      threadTs: room.slackThreadTs,
      userName: newParticipant.name,
      roomTitle: room.title,
    });
  }
}, [participants]);
```

---

## データフロー

### 部屋作成時
1. ユーザーがチェックボックスをONにして部屋作成
2. `HomePage.jsx` → `useRoomCreation.js` → `firestore.js` の `createRoom()` 呼び出し
3. Firestore に部屋データを保存
4. `slackNotificationEnabled: true` の場合、`notifyRoomCreated()` を実行
5. Cloud Functions 経由でSlackに新スレッド作成
6. 返却された `thread_ts` をFirestoreに保存

### 参加者入室時
1. 新しい参加者が部屋に入室
2. `RoomPage.jsx` の `useEffect` が参加者変更を検知
3. `room.slackThreadTs` が存在する場合、`notifyParticipantJoined()` を実行
4. Cloud Functions 経由でスレッドに返信を投稿

---

## Firestoreスキーマ

### rooms コレクション
```javascript
{
  id: string,                    // 部屋ID
  title: string,                 // 部屋タイトル
  host: string,                  // ホストのユーザーID
  participants: Array,           // 参加者リスト
  
  // Slack連携フィールド
  slackNotificationEnabled: boolean,  // Slack通知の有効/無効
  slackThreadTs: string | null,       // スレッドのタイムスタンプ
  slackChannelId: string | null,      // 投稿先チャンネルID（通常は環境変数と同じ）
  
  createdAt: Timestamp,
  // その他のフィールド...
}
```

---

## Cloud Functions実装（参考）

**`functions/index.js`**
```javascript
const functions = require('firebase-functions');
const { WebClient } = require('@slack/web-api');

// Secret Manager から Bot Token を取得
const getSlackToken = async () => {
  // 実装詳細は省略
};

exports.sendSlackNotification = functions.https.onRequest(async (req, res) => {
  const { action, channel, text, blocks, thread_ts } = req.body;
  
  const token = await getSlackToken();
  const client = new WebClient(token);
  
  try {
    if (action === 'post_message') {
      const result = await client.chat.postMessage({
        channel,
        text,
        blocks,
      });
      res.json({ ok: true, ts: result.ts });
      
    } else if (action === 'thread_message') {
      await client.chat.postMessage({
        channel,
        thread_ts,
        text,
        blocks,
      });
      res.json({ ok: true });
    }
  } catch (error) {
    console.error('Slack API error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});
```

---

## 開発ガイド

### 新しい通知タイプの追加手順

#### 1. メッセージビルダーに関数を追加
```javascript
// filepath: src/features/integration/slack/services/messageBuilder.js

export const buildYourNewMessage = ({ param1, param2 }) => {
  return {
    text: `新しいイベント: ${param1}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${param1}*\n${param2}`,
        },
      },
    ],
  };
};
```

#### 2. 必要に応じてAPI関数を追加
```javascript
// filepath: src/features/integration/slack/services/slackApi.js

export async function postYourNewNotification({ channelId, threadTs, payload }) {
  if (!isSlackEnabled()) return { ok: true, skipped: true };
  
  const url = import.meta.env.VITE_SLACK_FUNCTION_URL;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'your_custom_action',
      channel: channelId,
      thread_ts: threadTs,
      ...payload,
    }),
  });
  
  return res.ok ? res.json() : Promise.reject(new Error(`Slack error: ${res.status}`));
}
```

#### 3. カスタムフックに追加
```javascript
// filepath: src/features/integration/slack/hooks/useSlackNotification.js

const notifyYourNewEvent = async ({ channelId, threadTs, param1, param2 }) => {
  if (!isSlackFeatureEnabled()) return;
  if (!channelId) return;
  
  const payload = buildYourNewMessage({ param1, param2 });
  try {
    await postYourNewNotification({ channelId, threadTs, payload });
  } catch (error) {
    console.warn('[Slack] notification failed:', error);
  }
};

return { 
  notifyRoomCreated, 
  notifyParticipantJoined,
  notifyYourNewEvent, // 追加
};
```

#### 4. コンポーネントから利用
```javascript
const { notifyYourNewEvent } = useSlackNotification();

await notifyYourNewEvent({
  channelId: room.slackChannelId || import.meta.env.VITE_SLACK_CHANNEL_ID,
  threadTs: room.slackThreadTs,
  param1: 'value1',
  param2: 'value2',
});
```

---

## テスト手順

### 1. フラグOFF（過去仕様）
```bash
# .env
VITE_SLACK_FEATURE_ENABLED=false

# サーバー再起動
npm run dev:full
```

**確認項目:**
- ✅ ホーム画面でSlackチェックボックスが非表示
- ✅ 部屋作成時にSlack通信が発生しない
- ✅ コンソールにSlack関連のエラー/警告なし

### 2. フラグON・認証情報なし
```bash
# .env
VITE_SLACK_FEATURE_ENABLED=true
VITE_SLACK_FUNCTION_URL=
VITE_SLACK_CHANNEL_ID=
```

**確認項目:**
- ✅ チェックボックスが表示される
- ✅ チェックONで部屋作成してもエラーなし
- ✅ 送信は安全にno-op（コンソールに警告が出る場合あり）

### 3. 全設定が正しい場合
```bash
# .env
VITE_SLACK_FEATURE_ENABLED=true
VITE_SLACK_FUNCTION_URL=https://your-function-url
VITE_SLACK_CHANNEL_ID=C0123456789
```

**確認項目:**
- ✅ チェックボックスONで部屋作成
- ✅ Slackチャンネルに新スレッド作成
- ✅ Firestoreに `slackThreadTs` が保存される
- ✅ 参加者入室時にスレッドに返信が投稿される
- ✅ ブラウザコンソールにエラーなし

---

## トラブルシューティング

### チェックボックスが表示されない

**原因候補:**
- `VITE_SLACK_FEATURE_ENABLED` が `false` になっている
- 環境変数の変更後にサーバーを再起動していない

**解決策:**
```bash
# .envを確認
cat .env | grep VITE_SLACK_FEATURE_ENABLED

# 開発サーバーを再起動
npm run dev:full
```

---

### 通知が送信されない

**原因候補:**
- Cloud FunctionのURLが間違っている
- Channel IDが間違っている
- Cloud Functions側のBot Tokenが無効

**解決策:**
```bash
# ブラウザのコンソールでエラー確認
# DevToolsのNetworkタブでリクエスト詳細を確認

# Cloud Functionsのログ確認
gcloud functions logs read sendSlackNotification --limit=50
```

---

### 本番環境で設定が反映されない

**原因候補:**
- `.env.production` に環境変数が設定されていない
- ビルド後にデプロイしていない

**解決策:**
```bash
# .env.production に追加
echo "VITE_SLACK_FEATURE_ENABLED=true" >> .env.production
echo "VITE_SLACK_FUNCTION_URL=https://..." >> .env.production
echo "VITE_SLACK_CHANNEL_ID=C..." >> .env.production

# 再ビルド＆デプロイ
npm run build
npx firebase deploy
```

---

## セキュリティベストプラクティス

### ❌ やってはいけないこと
1. **Slack Bot Tokenを `.env` に保存する**
   - フロントエンドの環境変数はビルド時にバンドルに埋め込まれます
   - ブラウザから見える = 公開情報と同じです

2. **認証なしでCloud Functionsを公開する**
   - 悪意あるユーザーが無制限にSlack投稿できてしまいます

3. **エラー詳細をユーザーに見せる**
   - 内部構造が露出します

### ✅ 推奨される方法
1. **Cloud Functions経由で通信**
   - フロントエンドはURLのみ保持
   - Bot TokenはSecret Managerで管理

2. **適切なCORS設定**
   - 信頼できるドメインからのみリクエストを許可

3. **Rate Limiting**
   - Cloud Functions側で投稿頻度を制限

4. **エラーハンドリング**
   - ユーザーには汎用メッセージのみ表示
   - 詳細はサーバーログに記録

---

## パフォーマンス考慮事項

### 非同期処理
- Slack通知は `await` せず、Fire-and-Forgetで実行可能
- ユーザー体験を優先（通知失敗してもアプリは継続）

### リトライ戦略
- Cloud Functions側で3回まで自動リトライ
- 失敗時はログ記録のみ（ユーザーには通知しない）

### キャッシュ
- `thread_ts` はFirestoreに永続化
- 再取得の必要なし

---

## 今後の拡張計画

### 計画中の機能
- [ ] 部屋削除時のスレッド返信（「この部屋は削除されました」）
- [ ] タイマー完了時の通知
- [ ] カスタマイズ可能な通知テンプレート
- [ ] 複数チャンネルへの同時投稿

### 技術的負債
- Cloud Functions のテストコード未整備
- エラー率のモニタリング未導入
- 通知履歴の保存機能なし

---

## 関連ドキュメント
- [プロジェクト概要](../PROJECT_OVERVIEW.md)
- [環境変数テンプレート](../../.env.example)
- [Copilot指示書](../../.github/copilot-instructions.md)
- [Slack API Documentation](https://api.slack.com/)

---

## 変更履歴
- **2024-11-13**: 初版作成
  - 環境変数フラグ機能の実装
  - 部屋作成・参加者入室時の通知
  - ドキュメント整備