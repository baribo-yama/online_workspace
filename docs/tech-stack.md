# 技術スタック概要

このプロジェクトで使用されている主要な技術スタックとライブラリの一覧です。 `package.json` に基づいています。

## フロントエンド

- **フレームワーク:** [React](https://react.dev/) (`react`, `react-dom`)
- **ビルドツール:** [Vite](https://vitejs.dev/) (`vite`)
- **ルーティング:** [React Router](https://reactrouter.com/) (`react-router-dom`)
- **スタイリング:**
  - [Tailwind CSS](https://tailwindcss.com/) (`tailwindcss`)
  - [PostCSS](https://postcss.org/) (`postcss`, `autoprefixer`)
- **リアルタイムビデオ/オーディオ:** [LiveKit](https://livekit.io/) (`livekit-client`, `@livekit/components-react`)
- **アニメーション:** [Framer Motion](https://www.framer.com/motion/) (`framer-motion`)
- **アイコン:** [Lucide React](https://lucide.dev/) (`lucide-react`)
- **リンター:** [ESLint](https://eslint.org/) (`eslint`)

## バックエンド

- **ランタイム:** [Node.js](https://nodejs.org/)
- **WebSocketサーバー:** [ws](https://github.com/websockets/ws) (`ws`)
- **開発用サーバー:** [Nodemon](https://nodemon.io/) (`nodemon`)

## インフラストラクチャ & サービス

- **ホスティング/BaaS:** [Firebase](https://firebase.google.com/) (`firebase`) (Hosting, Firestoreなど)
- **デプロイ:**
  - Firebase Hosting (`firebase.json`)
  - [Render](https://render.com/) (`render.yaml`)

## 開発ツール

- **パッケージマネージャー:** npm / pnpm
- **タスクランナー:** [Concurrently](https://github.com/open-cli-tools/concurrently) (`concurrently`)
