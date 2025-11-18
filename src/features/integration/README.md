# Integration機能

MOKUの外部サービス連携機能を管理するfeatureディレクトリ。

## 📁 構成

```
src/features/integration/
├── slack/                  # Slack連携
│   ├── services/
│   │   ├── slackApi.js           # Slack Web API クライアント
│   │   └── messageBuilder.js     # メッセージ生成ロジック
│   ├── hooks/
│   │   └── useSlackNotification.js # React カスタムフック
│   └── constants/
│       └── config.js              # 環境変数管理
└── README.md
```

## 🎯 機能概要

### Slack連携

MOKUでの部屋作成・参加・終了イベントをSlackの特定チャンネルに通知する機能。

**主な機能:**
- 部屋作成時にSlackチャンネルへ通知投稿
- 参加者追加時にスレッドで返信
- 部屋終了時にスレッドで終了メッセージ投稿

**設計思想:**
- **関心の分離**: API通信・メッセージ生成・React統合を分離
- **エラー時の継続**: Slack通知失敗時もMOKUの機能は中断しない
- **拡張性**: 将来的なDiscord/Teams対応を見据えた設計

## 🔧 使い方

### 1. 環境変数設定

`.env` に以下を追加:

```bash
VITE_SLACK_BOT_TOKEN=xoxb-your-bot-token
VITE_SLACK_CHANNEL_ID=C01234ABCDE
```

### 2. コンポーネントでの使用

```javascript
import { useSlackNotification } from '../../features/integration/slack/hooks/useSlackNotification.js';

const MyComponent = () => {
  const { notifyRoomCreated, notifyParticipantJoined } = useSlackNotification();

  const handleCreateRoom = async () => {
    const roomId = await createRoom({ ... });
    
    // Slack通知（非同期・エラー時も中断しない）
    notifyRoomCreated({
      roomId,
      roomTitle: 'テスト勉強会',
      hostName: '山田太郎'
    });
  };
};
```

## 📚 API リファレンス

### `useSlackNotification()`

Slack通知機能を提供するカスタムフック。

**返り値:**
```javascript
{
  notifyRoomCreated: (params) => Promise<void>,
  notifyParticipantJoined: (params) => Promise<void>,
  notifyRoomEnded: (params) => Promise<void>
}
```

**例:**
```javascript
const { notifyRoomCreated } = useSlackNotification();

notifyRoomCreated({
  roomId: 'abc123',
  roomTitle: '数学勉強会',
  hostName: '佐藤花子'
});
```

## 🔮 将来的な拡張

- `integration/discord/` - Discord連携
- `integration/teams/` - Microsoft Teams連携
- `integration/shared/` - 共通インターフェース

## 📝 関連ドキュメント

- [Slack連携機能 仕様書](../../../docs/slack-integration-spec.md)
- [プロジェクト概要](../../../docs/PROJECT_OVERVIEW.md)
