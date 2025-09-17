# LiveKit設定ガイド

## 概要

このプロジェクトでは、LiveKitを使用してリアルタイムビデオ通話機能を実装しています。
LiveKitは、WebRTCベースの高品質なリアルタイム通信プラットフォームです。

## 必要な環境変数

`.env`ファイルに以下の環境変数を設定してください：


# LiveKit設定
VITE_LIVEKIT_URL=wss://your-project.livekit.cloud
VITE_LIVEKIT_API_KEY=your_livekit_api_key
VITE_LIVEKIT_API_SECRET=your_livekit_api_secret

1. [LiveKit Cloud](https://cloud.livekit.io/)でアカウントを作成
2. 新しいプロジェクトを作成
3. プロジェクト設定から以下を取得：
- **Project URL**: プロジェクトのURL
- **API Key**: プロジェクトのAPIキー
- **API Secret**: プロジェクトのAPIシークレット

### テスト手順
1. 環境変数を設定
2. 開発サーバーを起動: `npm run dev`
3. 部屋を作成・参加
4. カメラ・マイクの許可を確認
5. 複数ブラウザでテスト
