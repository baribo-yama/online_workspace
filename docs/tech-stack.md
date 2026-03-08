# 技術スタック概要

このプロジェクト（MOKU / オンライン作業・勉強スペース）で使用されている主要な技術スタックとライブラリの詳細一覧です。各 `package.json` の実際のバージョンに基づいています。

---

## フロントエンド

### **コアフレームワーク**

| ライブラリ | バージョン | 用途 |
|-----------|-----------|------|
| [React](https://react.dev/) | `^19.1.1` | UIライブラリ |
| [React DOM](https://react.dev/) | `^19.1.1` | DOMレンダリング |
| [Vite](https://vitejs.dev/) | `^7.1.2` | ビルドツール・開発サーバー |
| [React Router DOM](https://reactrouter.com/) | `^7.8.2` | クライアントサイドルーティング (SPA) |

### **スタイリング**

| ライブラリ | バージョン | 用途 |
|-----------|-----------|------|
| [Tailwind CSS](https://tailwindcss.com/) | `^3.4.17` | ユーティリティファーストCSSフレームワーク |
| [PostCSS](https://postcss.org/) | `^8.5.6` | CSS変換・処理 |
| [Autoprefixer](https://github.com/postcss/autoprefixer) | `^10.4.21` | ベンダープレフィックス自動付与 |
| [Framer Motion](https://www.framer.com/motion/) | `^12.23.16` | アニメーションライブラリ |

### **リアルタイム映像・音声通話**

| ライブラリ | バージョン | 用途 |
|-----------|-----------|------|
| [livekit-client](https://livekit.io/) | `^2.15.7` | LiveKit クライアントSDK (WebRTC) |
| [@livekit/components-react](https://github.com/livekit/components-js) | `^2.9.14` | LiveKit React UIコンポーネント |
| [@livekit/components-styles](https://github.com/livekit/components-js) | `^1.1.6` | LiveKit コンポーネント用スタイル |

### **UI・アイコン**

| ライブラリ | バージョン | 用途 |
|-----------|-----------|------|
| [Lucide React](https://lucide.dev/) | `^0.542.0` | アイコンライブラリ (540+ アイコン) |
| [prop-types](https://github.com/facebook/prop-types) | `^15.8.1` | Reactプロップの実行時型チェック |

### **開発・コード品質**

| ライブラリ | バージョン | 用途 |
|-----------|-----------|------|
| [ESLint](https://eslint.org/) | `^9.33.0` | 静的コード解析・リンター |
| [eslint-plugin-react-hooks](https://www.npmjs.com/package/eslint-plugin-react-hooks) | `^5.2.0` | React Hooks のルール強制 |
| [eslint-plugin-react-refresh](https://github.com/ArnaudBarre/eslint-plugin-react-refresh) | `^0.4.20` | HMR互換コンポーネント検証 |
| [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react) | `^5.0.0` | Vite向けReactプラグイン (Fast Refresh) |
| [@types/react](https://www.npmjs.com/package/@types/react) | `^19.1.10` | React TypeScript型定義 |
| [@types/react-dom](https://www.npmjs.com/package/@types/react-dom) | `^19.1.7` | React DOM TypeScript型定義 |
| [Concurrently](https://github.com/open-cli-tools/concurrently) | `^9.2.1` | 複数コマンドの並列実行 |
| [Nodemon](https://nodemon.io/) | `^3.1.10` | 開発時サーバー自動再起動 |
| [globals](https://github.com/sindresorhus/globals) | `^16.3.0` | ESLintグローバル変数定義 |

---

## バックエンド

### **WebSocketゲームサーバー** (`server/`)

| 技術 | バージョン | 用途 |
|------|-----------|------|
| [Node.js](https://nodejs.org/) | 20.x | サーバーランタイム |
| [ws](https://github.com/websockets/ws) | `^8.18.3` | WebSocketサーバー実装 |

**サーバー構成:**
- **ポート:** `8080`（`PORT` 環境変数で変更可能）
- **モジュール形式:** CommonJS (`require` / `module.exports`)
- **機能:** リアルタイムゲーム状態管理、ルーム状態管理、プレイヤー管理、ハートビート（Ping/Pong）
- **デプロイ:** [Render](https://render.com/)（Free プラン、`render.yaml` で定義）

### **Firebase Cloud Functions** (`functions/`)

| ライブラリ | バージョン | 用途 |
|-----------|-----------|------|
| [firebase-functions](https://firebase.google.com/docs/functions) | `^7.0.0` | Cloud Functions フレームワーク |
| [firebase-admin](https://firebase.google.com/docs/admin/setup) | `^12.6.0` | Firebase Admin SDK（認証検証等） |
| [livekit-server-sdk](https://github.com/livekit/server-sdk-js) | `^2.14.1` | LiveKit トークン生成（サーバーサイド） |
| [jose](https://github.com/panva/jose) | `^5.9.6` | JWT処理 |
| [node-fetch](https://github.com/node-fetch/node-fetch) | `^2.7.0` | HTTP リクエスト |
| [cors](https://github.com/expressjs/cors) | `^2.8.5` | CORS ヘッダー管理 |

**Cloud Functions の構成:**
- **ランタイム:** Node.js 20
- **リージョン:** `asia-northeast1`（東京）
- **関数一覧:**
  - `createLivekitToken` — LiveKit JWTトークン生成（Callable Function）
  - `slackNotify` — Slack通知送信（HTTPS Function、Firebase Auth認証必須）

---

## インフラストラクチャ & クラウドサービス

### **Firebase**

| サービス | バージョン（クライアントSDK） | 用途 |
|---------|--------------------------|------|
| [Firebase Firestore](https://firebase.google.com/docs/firestore) | `firebase@^12.2.1` | リアルタイムデータベース（部屋・参加者・タイマー状態） |
| [Firebase Authentication](https://firebase.google.com/docs/auth) | `firebase@^12.2.1` | ユーザー認証（匿名認証） |
| [Firebase Hosting](https://firebase.google.com/docs/hosting) | — | フロントエンド静的サイトホスティング（dev/prod 2ターゲット） |
| [Firebase Cloud Functions](https://firebase.google.com/docs/functions) | — | サーバーレスバックエンド（LiveKitトークン、Slack通知） |

**Firestore コレクション設計:**
```
{PREFIX}rooms/                    ← 部屋データ (PREFIX: prod_ or dev_)
  ├── {roomId}/                   ← 各部屋ドキュメント
  │   ├── title, createdAt, hostId, ...
  │   ├── timer: { timeLeft, isRunning, mode, cycle, ... }
  │   ├── game: { ... }
  │   ├── slackNotificationEnabled, slackThreadTs
  │   └── participants/           ← 参加者サブコレクション
  │       └── {participantId}/    ← 各参加者ドキュメント
  │           ├── name, status, isHost, ...
  │           └── isCameraOn, isMicOn
```

**最大参加人数:** 5名（MVP制限）

### **LiveKit**

| 項目 | 値 |
|------|---|
| サーバーURL | `wss://onlineworkspace-xu7dilqe.livekit.cloud`（デフォルト） |
| トークン生成 | Firebase Cloud Function（`LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` はSecret Managerで管理） |
| 接続タイムアウト | 30秒 |
| 最大リトライ | 3回（指数バックオフ） |
| 映像解像度 | 640×480 / 320×240（simulcast） |
| フレームレート | 30fps |

### **Slack 通知連携**

| 項目 | 値 |
|------|---|
| 実装 | Firebase Cloud Function（HTTPS）経由でSlack Bot Token使用 |
| 認証 | Firebase IDトークン必須 |
| 機能フラグ | `VITE_SLACK_FEATURE_ENABLED`（`true`/`false`/`1`/`0`） |
| 対応ワークスペース | 最大3ワークスペース（Slack Bot Token A/B/C を Secret Manager で管理） |
| タイムアウト | 10秒 / メモリ 256MB |

---

## アーキテクチャ・設計

### **フロントエンド設計**

- **アーキテクチャ:** Feature-based architecture（`src/features/` 配下に機能別モジュール）
- **状態管理:** React Hooks（`useState`, `useEffect`, `useCallback`, `useMemo`）+ Context API
- **コンポーネント設計:** UIコンポーネントとビジネスロジック（カスタムフック）の分離
- **モジュール形式:** ES Modules（`"type": "module"`）
- **パスエイリアス:** `@` → `./src`（Vite設定）

### **リアルタイム通信**

- **ビデオ/オーディオ:** LiveKit経由のWebRTC（P2P、シグナリングはLiveKitサーバー）
- **データ同期:** Firestore `onSnapshot` によるリアルタイム購読
- **ゲーム通信:** WebSocket（`ws`ライブラリ、ポート8080）
- **スクリーン共有:** LiveKit Screen Track API

### **ビルド・バンドル最適化**

- **チャンク分割（Manual Chunks）:**
  - `firebase-chunk` — Firebase app / Firestore
  - `livekit-chunk` — livekit-client / @livekit/components-react / @livekit/components-styles
  - `react-chunk` — react / react-dom
  - `router-chunk` — react-router-dom
  - `ui-chunk` — lucide-react
  - `utils-chunk` — jose / ws
- **チャンクサイズ警告閾値:** 1000KB
- **最適化:** Tree shaking、minification、依存関係の事前バンドル

### **機能フラグ** (`src/config/features.js`)

| フラグ | 値 | 説明 |
|--------|---|------|
| `GAME_ENABLED` | `false` | ゲーム機能（MVP安定性のため無効） |
| `CHAT_ENABLED` | `true` | チャット機能 |
| `VIDEO_CALL_ENABLED` | `true` | ビデオ通話機能 |
| `POMODORO_TIMER_ENABLED` | `true` | ポモドーロタイマー機能 |

---

## 環境変数一覧

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `VITE_FIREBASE_API_KEY` | ✅ | Firebase APIキー |
| `VITE_FIREBASE_AUTH_DOMAIN` | ✅ | Firebase認証ドメイン |
| `VITE_FIREBASE_PROJECT_ID` | ✅ | FirebaseプロジェクトID |
| `VITE_FIREBASE_STORAGE_BUCKET` | ✅ | Firebase Storageバケット |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | ✅ | Firebase MessagingセンダーID |
| `VITE_FIREBASE_APP_ID` | ✅ | Firebase アプリID |
| `VITE_FIREBASE_MEASUREMENT_ID` | — | Firebase Analytics測定ID |
| `VITE_LIVEKIT_URL` | ✅ | LiveKitサーバーURL (`wss://...`) |
| `VITE_WEBSOCKET_URL` | — | WebSocketサーバーURL（省略時: `ws://localhost:8080`） |
| `VITE_SLACK_FEATURE_ENABLED` | — | Slack通知UI・機能の有効/無効（省略時: `true`） |
| `VITE_SLACK_FUNCTION_URL` | — | Slack通知Cloud FunctionのURL |
| `VITE_SLACK_CHANNEL_ID` | — | デフォルトSlackチャンネルID |

> **Note:** LiveKit API Key/Secret および Slack Bot Token は Firebase Secret Manager で管理し、フロントエンドには公開しない。

---

## デプロイメント

| 対象 | サービス | 設定ファイル | コマンド |
|------|---------|-------------|---------|
| フロントエンド（本番） | Firebase Hosting (prod) | `firebase.json` | `npm run deploy:prod` |
| フロントエンド（開発） | Firebase Hosting (dev) | `firebase.json` | `npm run deploy:dev` |
| WebSocketサーバー | Render (Free) | `render.yaml` | 自動デプロイ |
| Cloud Functions | Firebase Functions | `functions/` | `firebase deploy --only functions` |

---

## 技術スタック全体像（サマリー）

| レイヤー | 技術 | バージョン | 役割 |
|---------|------|-----------|------|
| フロントエンドフレームワーク | React | 19.1.1 | UIライブラリ |
| ビルドツール | Vite | 7.1.2 | バンドラー・開発サーバー |
| スタイリング | Tailwind CSS | 3.4.17 | ユーティリティCSS |
| アニメーション | Framer Motion | 12.23.16 | UIアニメーション |
| ルーティング | React Router | 7.8.2 | SPAルーティング |
| リアルタイム通信 | LiveKit (WebRTC) | client: 2.15.7 / server-sdk: 2.14.1 | ビデオ・音声通話 |
| データベース | Firebase Firestore | SDK: 12.2.1 | リアルタイムDB |
| 認証 | Firebase Authentication | SDK: 12.2.1 | ユーザー認証 |
| ホスティング | Firebase Hosting | — | フロントエンド配信 |
| サーバーレスバックエンド | Firebase Cloud Functions | 7.0.0 | トークン生成・Slack通知 |
| WebSocketサーバー | Node.js + ws | ws: 8.18.3 | リアルタイムゲーム |
| 通知 | Slack API (Bot) | — | 勉強開始通知 |
| デプロイ（サーバー） | Render | — | WebSocketサーバー |
| リンター | ESLint | 9.33.0 | コード品質管理 |
| ランタイム（サーバー） | Node.js | 20 | バックエンド実行環境 |

---

**最終更新:** 2026-03-08  
**更新者:** AI (GitHub Copilot Agent)
