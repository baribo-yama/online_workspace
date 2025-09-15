# オンライン自習室アプリ

React + Vite + Firebase で構築されたオンライン自習室アプリケーションです。

## セットアップ

1. 依存関係をインストール:
```bash
npm install
```

2. Firebase設定:
`.env.example`を`.env`にコピーして、あなたのFirebaseプロジェクトの設定値を入力してください。
```bash
cp .env.example .env
```

3. 開発サーバーを起動:
```bash
npm run dev
```

## 環境変数

以下の環境変数を`.env`ファイルに設定する必要があります：

### Firebase設定
- `VITE_FIREBASE_API_KEY`: Firebase API キー
- `VITE_FIREBASE_AUTH_DOMAIN`: Firebase Auth ドメイン
- `VITE_FIREBASE_PROJECT_ID`: Firebase プロジェクト ID
- `VITE_FIREBASE_STORAGE_BUCKET`: Firebase ストレージバケット
- `VITE_FIREBASE_MESSAGING_SENDER_ID`: Firebase メッセージング送信者 ID
- `VITE_FIREBASE_APP_ID`: Firebase アプリ ID
- `VITE_FIREBASE_MEASUREMENT_ID`: Firebase 測定 ID

### LiveKit設定（ビデオ通話機能）
- `VITE_LIVEKIT_URL`: LiveKit サーバーのURL
- `VITE_LIVEKIT_API_KEY`: LiveKit API キー
- `VITE_LIVEKIT_API_SECRET`: LiveKit API シークレット

LiveKitアカウントは [https://livekit.io/](https://livekit.io/) で無料で作成できます。

### WebSocket設定（ゲーム機能）
- `VITE_WEBSOCKET_URL`: WebSocketサーバーのURL（デフォルト: `ws://localhost:8080`）

**環境変数の設定方法:**

1. **`.env`ファイルを作成**（プロジェクトルートに）:
```env
VITE_WEBSOCKET_URL=ws://localhost:8080
```

2. **異なる環境での設定例**:
```env
# 開発環境
VITE_WEBSOCKET_URL=ws://localhost:8080

# 本番環境（例）
VITE_WEBSOCKET_URL=wss://your-domain.com:8080
```

3. **WebSocketサーバーを起動**:
```bash
cd server
node server.js
```

**注意**: 環境変数を変更した場合は、開発サーバーを再起動してください。

## 機能

- オンライン自習室の作成・参加
- 共有ポモドーロタイマー（自動サイクル機能付き）
- リアルタイムで参加者数を表示
- 休憩時間中のマルチプレイヤーゲーム（WebSocket使用）
- 参加者同士でのリアルタイム音声・映像通話（LiveKit使用）

## 技術スタック

- React 19.1.1
- Vite 7.1.4
- Firebase Firestore
- WebSocket (Node.js + ws)
- Tailwind CSS
- React Router
- LiveKit (ビデオ通話)
