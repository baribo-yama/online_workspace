# ディレクトリ構成

`tree -I "node_modules|dist|.git"` の実行結果です。

```
.
├── LIVEKIT_SETUP.md
├── README.md
├── docs
│   └── tech-stack.md
├── eslint.config.js
├── firebase.json
├── index.html
├── package-lock.json
├── package.json
├── pnpm-lock.yaml
├── postcss.config.js
├── public
│   ├── images
│   │   └── obstacles
│   │       ├── README.md
│   │       └── ojisan_32x32.png
│   └── sounds
│       └── notification.mp3
├── render.yaml
├── server
│   ├── gameLoop.js
│   ├── package-lock.json
│   ├── package.json
│   ├── playerManager.js
│   ├── server.js
│   └── state.js
├── src
│   ├── App.jsx
│   ├── collaboration
│   │   ├── components
│   │   │   └── ParticipantList.jsx
│   │   └── hooks
│   │       └── useParticipants.js
│   ├── components
│   │   ├── EnhancedPomodoroTimer.jsx
│   │   └── VideoCallRoom.jsx
│   ├── config
│   │   └── livekit.js
│   ├── entertainment
│   │   ├── components
│   │   │   ├── CameraCapture.jsx
│   │   │   └── FaceObstacleGame.jsx
│   │   └── hooks
│   │       ├── useCamera.js
│   │       ├── useFaceObstacleGame.js
│   │       └── useNotification.js
│   ├── features
│   │   └── camera
│   │       └── CameraCapture.jsx
│   ├── game-test
│   │   └── index.html
│   ├── globals.css
│   ├── index.css
│   ├── main.jsx
│   ├── pomodoro-timer
│   │   ├── components
│   │   │   ├── PersonalTimer.jsx
│   │   │   └── SharedTimer.jsx
│   │   └── hooks
│   │       ├── usePersonalTimer.js
│   │       └── useSharedTimer.js
│   ├── shared
│   │   ├── config
│   │   │   └── websocket.js
│   │   ├── services
│   │   │   ├── firebase.js
│   │   │   └── firestore.js
│   │   └── utils
│   │       └── timer.js
│   └── study-room
│       └── components
│           ├── HomePage.jsx
│           └── RoomPage.jsx
├── tailwind.config.js
├── test-websocket-server.js
└── vite.config.js
