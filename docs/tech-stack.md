# 技術スタック概要

このプロジェクトで使用されている主要な技術スタックの一覧です。

## フロントエンド

- **フレームワーク:** [React](https://react.dev/)
- **ビルドツール:** [Vite](https://vitejs.dev/)
- **ルーティング:** [React Router](https://reactrouter.com/)
- **スタイリング:**
  - [Tailwind CSS](https://tailwindcss.com/)
  - [PostCSS](https://postcss.org/)
- **リアルタイムビデオ/オーディオ:** [LiveKit](https://livekit.io/)
- **アニメーション:** [Framer Motion](https://www.framer.com/motion/)
- **アイコン:** [Lucide React](https://lucide.dev/)
- **リンター:** [ESLint](https://eslint.org/)

## バックエンド

- **ランタイム:** [Node.js](https://nodejs.org/)
- **WebSocketサーバー:** [ws](https://github.com/websockets/ws)
- **開発用サーバー:** [Nodemon](https://nodemon.io/)

## インフラストラクチャ & サービス

- **ホスティング/BaaS:** [Firebase](https://firebase.google.com/) (Hosting, Firestoreなど)
- **デプロイ:**
  - Firebase Hosting
  - [Render](https://render.com/) (`render.yaml`が存在)

## 開発ツール

- **パッケージマネージャー:** npm (または pnpm)
- **タスクランナー:** [Concurrently](https://github.com/open-cli-tools/concurrently) (フロントエンドとバックエンドの同時実行用)
