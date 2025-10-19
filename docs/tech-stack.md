# 技術スタック概要

このプロジェクトで使用されている主要な技術スタックとライブラリの一覧です。 `package.json` に基づいています。

## フロントエンド

### **コアフレームワーク**
- **フレームワーク:** [React](https://react.dev/) (`react@^19.1.1`, `react-dom@^19.1.1`)
- **ビルドツール:** [Vite](https://vitejs.dev/) (`vite@^7.1.2`)
- **ルーティング:** [React Router](https://reactrouter.com/) (`react-router-dom@^7.8.2`)

### **スタイリング**
- **CSS フレームワーク:** [Tailwind CSS](https://tailwindcss.com/) (`tailwindcss@^3.4.17`)
- **CSS 処理:** [PostCSS](https://postcss.org/) (`postcss@^8.5.6`, `autoprefixer@^10.4.21`)
- **アニメーション:** [Framer Motion](https://www.framer.com/motion/) (`framer-motion@^12.23.16`)

### **リアルタイム通信**
- **ビデオ/オーディオ通話:** [LiveKit](https://livekit.io/) 
  - `livekit-client@^2.15.7` - クライアントSDK
  - `@livekit/components-react@^2.9.14` - Reactコンポーネント
  - `@livekit/components-styles@^1.1.6` - スタイル

### **UI・アイコン**
- **アイコンライブラリ:** [Lucide React](https://lucide.dev/) (`lucide-react@^0.542.0`)

### **認証・セキュリティ**
- **JWT 処理:** [jose](https://github.com/panva/jose) (`jose@^6.1.0`) - LiveKitトークン生成用

### **開発・品質管理**
- **リンター:** [ESLint](https://eslint.org/) (`eslint@^9.33.0`)
- **ESLint プラグイン:**
  - `eslint-plugin-react-hooks@^5.2.0` - React Hooks ルール
  - `eslint-plugin-react-refresh@^0.4.20` - React Refresh サポート

## バックエンド

### **ランタイム・サーバー**
- **ランタイム:** [Node.js](https://nodejs.org/)
- **WebSocket サーバー:** [ws](https://github.com/websockets/ws) (`ws@^8.18.3`)
- **開発用サーバー:** [Nodemon](https://nodemon.io/) (`nodemon@^3.1.10`)

## インフラストラクチャ & サービス

### **データベース・BaaS**
- **Backend as a Service:** [Firebase](https://firebase.google.com/) (`firebase@^12.2.1`)
  - **Firestore:** リアルタイムデータベース（部屋情報、参加者管理）
  - **Firebase Hosting:** 静的サイトホスティング

### **デプロイメント**
- **本番環境:** Firebase Hosting (`firebase.json`)
- **開発環境:** Firebase Hosting (dev target)
- **WebSocket サーバー:** [Render](https://render.com/) (`render.yaml`)

## 開発ツール・設定

### **パッケージ管理**
- **パッケージマネージャー:** npm / pnpm
- **タスクランナー:** [Concurrently](https://github.com/open-cli-tools/concurrently) (`concurrently@^9.2.1`)

### **ビルド設定**
- **Vite プラグイン:** `@vitejs/plugin-react@^5.0.0`
- **チャンク分割:** Firebase、LiveKit、React、UI関連で最適化
- **開発最適化:** 依存関係の事前バンドル

### **コード品質**
- **ESLint 設定:** フラット設定 (`eslint.config.js`)
- **TypeScript 型定義:** `@types/react@^19.1.10`, `@types/react-dom@^19.1.7`

## アーキテクチャ・設計

### **フロントエンド設計**
- **アーキテクチャ:** Feature-based architecture
- **状態管理:** React Hooks (useState, useEffect, useCallback, useMemo)
- **コンポーネント設計:** UIとロジックの分離
- **ルーティング:** React Router v7 (SPA)

### **リアルタイム通信**
- **WebRTC:** LiveKit経由でP2P通信
- **シグナリング:** LiveKitサーバー経由
- **メディア処理:** ブラウザネイティブAPI + LiveKit SDK

### **データフロー**
- **リアルタイム同期:** Firestore onSnapshot
- **状態管理:** React Hooks + Context API
- **キャッシュ:** ブラウザキャッシュ + Vite最適化

## 環境・デプロイ

### **環境変数**
- `VITE_FIREBASE_*` - Firebase設定
- `VITE_LIVEKIT_*` - LiveKit設定
- `NODE_ENV` - 実行環境

### **ビルド・デプロイ**
- **開発:** `npm run dev` (Vite dev server)
- **本番ビルド:** `npm run build:prod`
- **開発ビルド:** `npm run build:dev`
- **デプロイ:** Firebase CLI経由

### **パフォーマンス最適化**
- **コード分割:** Vite manualChunks設定
- **遅延読み込み:** React.lazy + Suspense
- **バンドル最適化:** Tree shaking、minification

## 今後の技術選定予定

### **短期的改善（1-3ヶ月）**
- **TypeScript化:** 型安全性の向上
- **テストフレームワーク:** Jest + React Testing Library
- **状態管理:** Zustand または Redux Toolkit（必要に応じて）

### **中長期的検討（3-12ヶ月）**
- **モバイル対応:** React Native または PWA
- **パフォーマンス監視:** Web Vitals、Error Tracking
- **CI/CD:** GitHub Actions または Firebase CI

---

**最終更新:** 2025-10-19  
**更新者:** AI (Cursor Agent)
