# ディレクトリ構成

`tree -I "node_modules|dist|.git"` の実行結果です。


src/
├── features/                    # 機能ベースのモジュール
│   ├── study-room/             # 勉強部屋機能
│   │   ├── components/
│   │   │   ├── HomePage.jsx
│   │   │   └── RoomPage.jsx
│   │   └── index.js           # エクスポート用
│   │
│   ├── timer/                  # ポモドーロタイマー機能
│   │   ├── components/
│   │   │   ├── PersonalTimer.jsx
│   │   │   ├── SharedTimer.jsx
│   │   │   └── EnhancedPomodoroTimer.jsx
│   │   ├── hooks/
│   │   │   ├── usePersonalTimer.js
│   │   │   └── useSharedTimer.js
│   │   └── index.js
│   │
│   ├── video-call/             # ビデオ通話機能
│   │   ├── components/
│   │   │   └── VideoCallRoom.jsx
│   │   ├── config/
│   │   │   └── livekit.js
│   │   └── index.js
│   │
│   ├── collaboration/          # コラボレーション機能
│   │   ├── components/
│   │   │   └── ParticipantList.jsx
│   │   ├── hooks/
│   │   │   └── useParticipants.js
│   │   └── index.js
│   │
│   └── entertainment/          # エンターテイメント機能
│       ├── components/
│       │   └── FaceObstacleGame.jsx
│       ├── hooks/
│       │   ├── useFaceObstacleGame.js
│       │   └── useNotification.js
│       └── index.js
│
├── shared/                     # 共通機能
│   ├── config/
│   │   └── websocket.js
│   ├── services/
│   │   ├── firebase.js
│   │   └── firestore.js
│   └── utils/
│       └── timer.js
│
├── App.jsx                     # ルートコンポーネント
├── main.jsx                    # エントリーポイント
├── globals.css
└── index.css
