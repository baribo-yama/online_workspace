# LiveKit トークン生成実装ガイド

## 概要

このドキュメントでは、LiveKitのアクセストークンを**Cloud Functions経由で生成する**実装方法を説明します。この方法により、API Key/Secretをクライアント側に露出させず、セキュアにトークンを生成できます。

## アーキテクチャ

### トークン生成の流れ

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  クライアント  │ ────> │  Cloud Functions  │ ────> │  LiveKit Server │
│  (Browser)  │         │  (createLivekit  │         │                 │
│             │         │   Token)         │         │                 │
└─────────────┘         └──────────────────┘         └─────────────────┘
      │                           │
      │                           │
      │ 1. fetchLivekitToken()    │ 2. Secret Managerから
      │    (roomName, identity)   │    API Key/Secret取得
      │                           │
      │ <─── 3. JWT Token ────────│
      │                           │
      │ 4. Room.connect(token)    │
      │                           │
```

### 実装のポイント

1. **クライアント側**: Cloud Functionsを呼び出すだけ（API Key/Secretは持たない）
2. **Cloud Functions側**: Secret ManagerからAPI Key/Secretを取得してトークンを生成
3. **セキュリティ**: 秘密情報はサーバーサイドでのみ管理

## 実装コード

### 1. クライアント側の実装

**ファイル**: `src/features/video-call/config/livekit.js`

```javascript
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
```

### 2. Cloud Functions側の実装

**ファイル**: `functions/livekit/token.js`

```javascript
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const {AccessToken} = require("livekit-server-sdk");

/**
 * LiveKit用アクセストークンを生成するCallable Function
 *
 * リクエストデータ:
 * {
 *   roomName: "room-123",
 *   identity: "user-abc"
 * }
 *
 * レスポンス:
 * {
 *   token: "jwt-string"
 * }
 */
const createLivekitToken = onCall(
    {
      region: "asia-northeast1",
      secrets: ["LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"],
    },
    async (request) => {
      const data = request.data || {};
      const {roomName, identity} = data;

      // バリデーション
      if (!roomName || !identity) {
        throw new HttpsError("invalid-argument", "roomName と identity は必須です");
      }

      if (typeof roomName !== 'string' || roomName.length === 0 || roomName.length > 100) {
        throw new HttpsError("invalid-argument", "roomName は1-100文字の文字列である必要があります");
      }

      if (typeof identity !== 'string' || identity.length === 0 || identity.length > 100) {
        throw new HttpsError("invalid-argument", "identity は1-100文字の文字列である必要があります");
      }

      // Secret ManagerからAPI Key/Secretを取得
      const apiKey = process.env.LIVEKIT_API_KEY;
      const apiSecret = process.env.LIVEKIT_API_SECRET;

      if (!apiKey || !apiSecret) {
        logger.error("LiveKitシークレット未設定");
        throw new HttpsError("failed-precondition", "サーバー設定が正しくありません");
      }

      // LiveKit SDKを使用してトークンを生成
      const token = new AccessToken(apiKey, apiSecret, {
        identity,
        ttl: "1h",
      });

      token.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
      });

      const jwt = await token.toJwt();

      logger.info("LiveKitトークン発行成功", {
        roomName,
        identity,
      });

      return {token: jwt};
    },
);

module.exports = {createLivekitToken};
```

### 3. 使用例（コンポーネント側）

**ファイル**: `src/features/video-call/components/VideoCallRoom.jsx`

```javascript
import { fetchLivekitToken, generateRoomName, generateParticipantName } from '../config/livekit';

// ルームに接続する処理
const connectToRoom = async () => {
  const roomName = generateRoomName(roomId);
  const participantName = generateParticipantName(userName);
  
  try {
    // Cloud Functions経由でトークンを取得
    const token = await fetchLivekitToken(roomName, participantName);
    
    if (!token) {
      throw new Error("トークンの取得に失敗しました");
    }
    
    // 取得したトークンでLiveKitルームに接続
    await room.connect(LIVEKIT_CONFIG.serverUrl, token);
    
  } catch (error) {
    console.error("LiveKitトークン取得エラー:", error);
    
    // エラーハンドリング
    if (error.code === "functions/unavailable") {
      setError("サーバーに接続できませんでした。ネットワークを確認してください。");
    } else if (error.code === "functions/invalid-argument") {
      setError("認証情報が不正です。");
    } else {
      setError("ビデオ通話の認証に失敗しました。もう一度お試しください。");
    }
    throw error;
  }
};
```

## クライアント側トークン生成からの移行方法

### ❌ 古い実装（クライアント側でトークン生成）

```javascript
// ❌ 非推奨: クライアント側でトークンを生成
import { SignJWT } from 'jose';

export const generateAccessToken = async (roomName, participantName) => {
  // API Key/Secretがクライアント側に露出する（セキュリティリスク）
  const apiKey = import.meta.env.VITE_LIVEKIT_API_KEY;
  const apiSecret = import.meta.env.VITE_LIVEKIT_API_SECRET;
  
  const secret = new TextEncoder().encode(apiSecret);
  const token = await new SignJWT({...})
    .setIssuer(apiKey)
    .sign(secret);
  
  return token;
};
```

### ✅ 新しい実装（Cloud Functions経由）

```javascript
// ✅ 推奨: Cloud Functions経由でトークンを取得
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/shared/services/firebase';

export const fetchLivekitToken = async (roomName, identity) => {
  const callable = httpsCallable(functions, 'createLivekitToken');
  const { data } = await callable({ roomName, identity });
  return data.token;
};
```

### 移行手順

1. **`livekit.js`を更新**
   - `generateAccessToken`関数を削除またはコメントアウト
   - `fetchLivekitToken`関数を追加（上記の実装を参照）

2. **コンポーネント側の呼び出しを変更**
   ```javascript
   // 変更前
   const token = await generateAccessToken(roomName, participantName);
   
   // 変更後
   const token = await fetchLivekitToken(roomName, participantName);
   ```

3. **環境変数を削除**
   - `.env`から`VITE_LIVEKIT_API_KEY`と`VITE_LIVEKIT_API_SECRET`を削除
   - `VITE_LIVEKIT_URL`のみ残す

4. **Cloud Functionsをデプロイ**
   ```bash
   firebase deploy --only functions:createLivekitToken
   ```

## セキュリティ上の利点

### ✅ Cloud Functions経由の利点

1. **API Key/Secretの保護**
   - クライアント側のバンドルに含まれない
   - ブラウザの開発者ツールで見えない
   - Secret Managerによる安全な管理

2. **トークンの有効期限管理**
   - サーバー側で1時間の有効期限を設定
   - 短期間のみ有効なトークンを発行

3. **バリデーション**
   - サーバー側で入力値の検証が可能
   - 不正なリクエストをブロック

### ❌ クライアント側生成の問題点

1. **セキュリティリスク**
   - API Key/Secretが環境変数としてクライアント側に露出
   - バンドルに含まれるため、誰でも見ることができる

2. **管理の複雑さ**
   - 本番環境と開発環境で異なる認証情報を管理する必要がある
   - 漏洩時の影響が大きい

## エラーハンドリング

### よくあるエラーと対処法

| エラーコード | 原因 | 対処法 |
|------------|------|--------|
| `functions/unavailable` | Cloud Functionsに接続できない | ネットワーク接続を確認 |
| `functions/invalid-argument` | リクエストパラメータが不正 | `roomName`と`identity`の形式を確認 |
| `functions/failed-precondition` | Secret Managerに認証情報が未設定 | Secret Managerの設定を確認 |
| `functions/internal` | サーバー側のエラー | Cloud Functionsのログを確認 |

### エラーログの確認方法

```bash
# Cloud Functionsのログを確認
firebase functions:log --only createLivekitToken

# 特定のエラーを検索
firebase functions:log --only createLivekitToken | grep "error"
```

## テスト方法

### 1. ローカルでのテスト

```bash
# Cloud Functionsをローカルでエミュレート
firebase emulators:start --only functions

# 別ターミナルで開発サーバーを起動
npm run dev
```

### 2. 本番環境でのテスト

```bash
# Cloud Functionsをデプロイ
firebase deploy --only functions:createLivekitToken

# ブラウザで動作確認
# 1. 部屋を作成
# 2. ビデオ通話を開始
# 3. ブラウザのコンソールでエラーがないか確認
```

## まとめ

- ✅ **Cloud Functions経由でトークンを生成**することで、セキュリティが向上
- ✅ **API Key/SecretはSecret Managerで管理**し、クライアント側には露出しない
- ✅ **クライアント側は`fetchLivekitToken`を呼び出すだけ**でシンプル
- ✅ **エラーハンドリング**を適切に実装することで、ユーザー体験が向上

この実装方法により、セキュアで保守しやすいLiveKit統合が実現できます。

