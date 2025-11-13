# Online Workspace - リアルタイム勉強ルーム

## 概要

Online Workspaceは、LiveKitを使用したリアルタイムビデオ通話機能を搭載した勉強ルームアプリケーションです。複数のユーザーが同じルームで勉強しながら、ポモドーロタイマーやゲーム機能を共有できます。

## 主な機能

### 🎥 リアルタイムビデオ通話
- **LiveKit統合**: 高品質なリアルタイムビデオ・音声通話
- **カメラ・マイク制御**: 個別のオン/オフ切り替え
- **音声レベル監視**: スピーキングインジケーター
- **自動再接続**: ネットワーク断線時の自動復旧

### ⏰ 共有ポモドーロタイマー
- **同期タイマー**: 全参加者でタイマーを共有
- **ホスト制御**: ホストのみがタイマーを制御可能
- **モード切り替え**: 作業・休憩・長休憩の自動切り替え
- **リアルタイム更新**: Firestoreによる状態同期

### 🎮 エンターテイメント機能
- **シューティングゲーム**: 休憩時間中のゲーム
- **ホスト権限**: ホストのみがゲームを開始可能
- **自動表示**: ゲーム開始時の自動画面切り替え

### 👥 参加者管理
- **ホストシステム**: 最初の参加者が自動的にホスト
- **リアルタイム参加者リスト**: 参加者の動的な追加・削除
- **権限管理**: ホストとゲストの権限分離

## 技術スタック

### フロントエンド
- **React 18**: メインのUIフレームワーク
- **Vite**: ビルドツール
- **Tailwind CSS**: スタイリング
- **Lucide React**: アイコンライブラリ

### リアルタイム通信
- **LiveKit**: ビデオ通話機能
- **Firebase Firestore**: データベースとリアルタイム同期
- **WebRTC**: ピアツーピア通信

### 開発・デプロイ
- **Node.js**: サーバーサイド
- **WebSocket Server**: リアルタイム通信
- **Firebase Hosting**: フロントエンドのホスティング
- **Render.com**: WebSocketサーバーのデプロイ

## セットアップ

### 前提条件
- Node.js 18以上
- npm または yarn
- Firebase プロジェクト
- LiveKit アカウント

### 環境変数の設定

`.env` ファイルを作成し、以下の変数を設定してください：

```env
# Firebase設定
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# LiveKit設定
VITE_LIVEKIT_URL=wss://your-livekit-server.com
VITE_LIVEKIT_API_KEY=your_livekit_api_key
VITE_LIVEKIT_API_SECRET=your_livekit_api_secret

# WebSocket設定
VITE_WEBSOCKET_URL=ws://localhost:8080  # 開発環境

# Slack連携（任意・Cloud Functions経由）
# 機能フラグ: true/false/1/0（未設定時はtrue）
VITE_SLACK_FEATURE_ENABLED=true
# Slack投稿用のCloud Function URL（トークンはフロントに置かない）
VITE_SLACK_FUNCTION_URL=https://your-cloud-function-url
# 投稿先チャンネルID（例: C0123456789）
VITE_SLACK_CHANNEL_ID=
```

### インストールと起動

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev

# サーバーの起動（別ターミナル）
cd server
npm install
npm start
```

## デプロイ

### 本番環境のデプロイ手順

#### 1. Firebase Hosting（フロントエンド）

```bash
# ビルド
npm run build

# Firebaseにデプロイ
npx firebase deploy
```

#### 2. Render.com（WebSocketサーバー）

1. [Render.com](https://render.com/)でアカウント作成
2. 新しいWeb Serviceを作成
3. GitHubリポジトリを接続
4. 以下の設定を適用：

```yaml
# render.yaml
services:
  - type: web
    name: online-workspace-websocket
    env: node
    buildCommand: cd server && npm install
    startCommand: cd server && node server.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        fromService:
          type: web
          name: online-workspace-websocket
          property: port
```

#### 3. 本番環境の環境変数

`.env.production` ファイルを作成：

```env
# 本番環境WebSocket URL（Renderのデプロイ後に更新）
VITE_WEBSOCKET_URL=wss://your-app-name.onrender.com

# Firebase設定（開発環境と同じ）
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# LiveKit設定（開発環境と同じ）
VITE_LIVEKIT_URL=wss://your-livekit-server.com
VITE_LIVEKIT_API_KEY=your_livekit_api_key
VITE_LIVEKIT_API_SECRET=your_livekit_api_secret
```

### インストールと起動

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev

# サーバーの起動（別ターミナル）
cd server
npm install
npm start
```

## プロジェクト構造

```
online_workspace/
├── src/
│   ├── components/           # 共通コンポーネント
│   │   └── VideoCallRoom.jsx # LiveKitビデオ通話コンポーネント
│   ├── config/              # 設定ファイル
│   │   └── livekit.js       # LiveKit設定
│   ├── collaboration/       # 参加者管理
│   │   ├── components/      # 参加者関連コンポーネント
│   │   └── hooks/           # 参加者管理フック
│   ├── study-room/          # 勉強ルーム機能
│   ├── pomodoro-timer/      # ポモドーロタイマー
│   ├── entertainment/       # ゲーム機能
│   └── shared/              # 共有サービス
├── server/                  # サーバーサイド
│   ├── server.js           # WebSocketサーバー
│   ├── gameLoop.js         # ゲームロジック
│   └── package.json        # サーバー依存関係
├── render.yaml             # Render.comデプロイ設定
└── README.md
```

**注意**:
- 環境変数を変更した場合は、開発サーバーを再起動してください
- 本番環境では`.env.production`ファイルの設定が自動的に使用されます
 - SlackのBot Tokenなどの秘密値はフロントの.envに置かないでください（Cloud Functions/Secret Managerで管理）

### Slack機能フラグの挙動
- `VITE_SLACK_FEATURE_ENABLED=true` のとき
  - ホーム画面に「Slackで募集する」チェックボックスが表示されます
  - チェックON時のみSlackへ通知（Cloud Functions経由）
  - ただし `VITE_SLACK_FUNCTION_URL` と `VITE_SLACK_CHANNEL_ID` が未設定なら送信は行われません（安全なno-op）
- `VITE_SLACK_FEATURE_ENABLED=false` のとき
  - チェックボックスは表示されず、Slack通知は常にオフ（過去仕様）

## 主要コンポーネント

### VideoCallRoom
- LiveKitを使用したリアルタイムビデオ通話
- カメラ・マイクの制御
- 音声レベル監視
- 自動再接続機能

### RoomPage
- 勉強ルームのメインページ
- ビデオ通話、タイマー、ゲームの統合
- ホスト権限の管理

### useParticipants
- 参加者管理のカスタムフック
- ホスト権限の自動設定
- リアルタイム参加者リストの監視

## ライセンス

MIT License

## 貢献

プルリクエストやイシューの報告を歓迎します。

## サポート

問題が発生した場合は、GitHubのIssuesページで報告してください。
