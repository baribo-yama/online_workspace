# LiveKit設定ガイド

## 概要

このプロジェクトでは、LiveKitを使用してリアルタイムビデオ通話機能を実装しています。
LiveKitは、WebRTCベースの高品質なリアルタイム通信プラットフォームです。

**重要**: LiveKitのAPI認証情報（API Key/Secret）はセキュリティ上の理由から、**サーバーサイド（Cloud Functions）でのみ管理**されます。クライアント側の`.env`ファイルには設定しません。

## セットアップ手順

### 1. LiveKit Cloud アカウントの作成

1. [LiveKit Cloud](https://cloud.livekit.io/)でアカウントを作成
2. 新しいプロジェクトを作成
3. プロジェクト設定から以下を取得：
   - **Project URL**: プロジェクトのURL（例: `wss://your-project.livekit.cloud`）
   - **API Key**: プロジェクトのAPIキー
   - **API Secret**: プロジェクトのAPIシークレット

### 2. Firebase Secret Manager への設定

LiveKitのAPI認証情報は、Firebase Secret Managerに保存します。これにより、クライアント側に秘密情報が露出することを防ぎます。

```bash
# Firebase CLIでログイン（未ログインの場合）
firebase login

# プロジェクトを選択
firebase use <your-project-id>

# LiveKit API Key を Secret Manager に登録
firebase functions:secrets:set LIVEKIT_API_KEY
# プロンプトが表示されたら、LiveKit Cloudから取得したAPI Keyを入力

# LiveKit API Secret を Secret Manager に登録
firebase functions:secrets:set LIVEKIT_API_SECRET
# プロンプトが表示されたら、LiveKit Cloudから取得したAPI Secretを入力
```

**注意**: 
- Secret Managerに登録した値は、Cloud Functions内で`process.env.LIVEKIT_API_KEY`と`process.env.LIVEKIT_API_SECRET`として参照できます
- Secretを変更した場合は、Cloud Functionsを再デプロイする必要があります

### 3. クライアント側の環境変数設定

`.env`ファイルに以下の環境変数を設定してください：

```env
# LiveKit設定（URLのみ。API Key/Secretは設定しない）
VITE_LIVEKIT_URL=wss://your-project.livekit.cloud
```

**重要**: 
- ❌ `VITE_LIVEKIT_API_KEY` は設定しないでください（サーバーサイドのみで管理）
- ❌ `VITE_LIVEKIT_API_SECRET` は設定しないでください（サーバーサイドのみで管理）
- ✅ `VITE_LIVEKIT_URL` のみ設定してください（公開情報のため問題ありません）

### 4. Cloud Functions のデプロイ

Secret Managerに登録後、Cloud Functionsをデプロイします：

```bash
cd functions
npm install
cd ..
firebase deploy --only functions:createLivekitToken
```

### テスト手順

1. Secret ManagerにAPI認証情報を設定
2. Cloud Functionsをデプロイ
3. `.env`ファイルに`VITE_LIVEKIT_URL`を設定
4. 開発サーバーを起動: `npm run dev`
5. 部屋を作成・参加
6. カメラ・マイクの許可を確認
7. 複数ブラウザでテスト

## アーキテクチャ

### トークン発行の流れ

1. **クライアント側**: `fetchLivekitToken(roomName, identity)` を呼び出し
2. **Cloud Functions**: `createLivekitToken` が Secret Manager から API Key/Secret を取得
3. **Cloud Functions**: LiveKit SDK を使用してアクセストークンを生成
4. **クライアント側**: 取得したトークンで LiveKit ルームに接続

### セキュリティ上の利点

- ✅ API Key/Secret がクライアント側のバンドルに含まれない
- ✅ ブラウザの開発者ツールで秘密情報が見えない
- ✅ Secret Manager による安全な管理
- ✅ トークンは1時間の有効期限（短期間のみ有効）

## 実装詳細

**詳細な実装方法とコード例については、以下のドキュメントを参照してください：**

📖 [LiveKit トークン生成実装ガイド](./docs/LIVEKIT_TOKEN_GENERATION.md)

このドキュメントには以下が含まれています：
- クライアント側とCloud Functions側の実装コード
- クライアント側トークン生成からの移行方法
- エラーハンドリングの実装例
- セキュリティ上の利点の詳細説明

## トラブルシューティング

### Secret Manager の確認

```bash
# 登録済みのSecretを確認
firebase functions:secrets:access LIVEKIT_API_KEY
firebase functions:secrets:access LIVEKIT_API_SECRET
```

### エラーログの確認

```bash
# Cloud Functions のログを確認
firebase functions:log --only createLivekitToken
```

### よくあるエラー

- **"LiveKitシークレット未設定"**: Secret Manager への登録を確認
- **"トークン取得エラー"**: Cloud Functions のデプロイを確認
- **"サーバーに接続できませんでした"**: `VITE_LIVEKIT_URL` の設定を確認
