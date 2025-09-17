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
- **Express**: Webサーバー
- **Socket.io**: WebSocket通信
- **Docker**: コンテナ化（開発環境）

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
└── README.md
```

**注意**: 環境変数を変更した場合は、開発サーバーを再起動してください。

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
