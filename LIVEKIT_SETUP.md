# LiveKit設定ガイド

## 必要な環境変数

`.env`ファイルに以下の環境変数を設定してください：

```bash
# LiveKit設定
VITE_LIVEKIT_URL=wss://your-project.livekit.cloud
VITE_LIVEKIT_API_KEY=your_livekit_api_key
VITE_LIVEKIT_API_SECRET=your_livekit_api_secret
```

**注意**: 環境変数が設定されていない場合、開発用のフォールバック値が使用されます。
実際のLiveKit Cloudの設定を使用する場合は、上記の環境変数を正しく設定してください。

## LiveKitアカウントの設定

1. [LiveKit Cloud](https://cloud.livekit.io/)でアカウントを作成
2. 新しいプロジェクトを作成
3. プロジェクト設定から以下を取得：
   - **Project URL**: `wss://your-project.livekit.cloud`
   - **API Key**: プロジェクトのAPIキー
   - **API Secret**: プロジェクトのAPIシークレット

## 現在の実装状況

### ✅ 完了済み
- LiveKit依存関係の追加
- ビデオ通話コンポーネントの作成
- RoomPageへの統合
- 基本的なUI/UX

### ⚠️ 開発用制限事項
- **トークン認証**: 現在は開発用でトークンなしで接続を試行
- **本番環境**: サーバーサイドでトークン生成が必要

## 本番環境での実装

### サーバーサイドトークン生成
```javascript
// サーバーサイド（Node.js/Express例）
import { AccessToken } from 'livekit-server-sdk';

const generateToken = (roomName, participantName) => {
  const token = new AccessToken(apiKey, apiSecret, {
    identity: participantName,
  });
  
  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });
  
  return token.toJwt();
};
```

### クライアントサイドでの使用
```javascript
// トークンを取得してルームに接続
const token = await fetch('/api/livekit-token', {
  method: 'POST',
  body: JSON.stringify({ roomName, participantName })
}).then(res => res.json());

await room.connect(serverUrl, token);
```

## テスト方法

1. 環境変数を設定
2. 開発サーバーを起動: `npm run dev`
3. 部屋を作成・参加
4. カメラ・マイクの許可を確認
5. 複数ブラウザでテスト

## トラブルシューティング

### よくある問題
- **カメラアクセス拒否**: HTTPS接続が必要
- **接続エラー**: 環境変数の確認
- **音声が聞こえない**: ブラウザの音声許可確認

### デバッグ
- ブラウザの開発者ツールでコンソールを確認
- LiveKit Cloudのダッシュボードで接続状況を確認
