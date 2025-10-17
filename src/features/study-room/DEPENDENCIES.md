# study-room/ 依存関係マップ

## 📊 依存関係の概要

study-room機能は**シンプルで明確な依存関係**を持っています。

---

## 🗂️ ファイル構造と依存関係

```
src/features/study-room/
├── index.js                    # エクスポート用（依存: すべてのコンポーネント・hooks）
├── constants.js                # 定数定義（依存: なし）
├── README.md                   # ドキュメント
├── DEPENDENCIES.md            # このファイル
├── hooks/
│   ├── useRoomData.js         # 依存: constants, shared/services/firebase
│   └── useRoomActions.js      # 依存: constants, shared/services/firebase, react-router-dom
└── components/
    ├── HomePage.jsx           # 依存: constants, shared/services/*, react-router-dom, timer, lucide-react
    ├── RoomPage.jsx           # 依存: constants, hooks/*, collaboration/*, timer/*, video-call/*, entertainment/*, react-router-dom
    ├── RoomHeader.jsx         # 依存: constants, lucide-react
    └── GameOverlay.jsx        # 依存: constants, entertainment/*
```

---

## 📦 外部依存関係

### React & React Router
```javascript
// すべてのコンポーネント
import { useState, useEffect, ... } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
```

### Firebase
```javascript
// hooks, HomePage
import { doc, onSnapshot, deleteDoc, addDoc, ... } from "firebase/firestore";
import { getRoomsCollection } from "../../../shared/services/firebase";
import { defaultRoom } from "../../../shared/services/firestore";
```

### UI Components
```javascript
// HomePage, RoomHeader
import { Users, Home, Trash2 } from "lucide-react";
```

### 他の機能モジュール
```javascript
// RoomPage
import { useParticipants } from "../../collaboration/hooks/useParticipants";
import { useNotification } from "../../entertainment/hooks/useNotification";
import SharedTimer from "../../timer/components/SharedTimer";
import ParticipantList from "../../collaboration/components/ParticipantList";
import VideoCallRoom from "../../video-call/components/VideoCallRoom";

// GameOverlay
import FaceObstacleGame from "../../entertainment/components/FaceObstacleGame";

// HomePage
import PersonalTimer from "../../timer/components/PersonalTimer";
```

---

## 🔄 内部依存関係

### Layer 1: 基礎レイヤー（依存なし）
- ✅ **constants.js**
  - 依存: なし
  - 役割: すべての定数を一元管理

### Layer 2: ビジネスロジックレイヤー
- ✅ **useRoomData.js**
  - 依存: `constants.js`, Firebase
  - 役割: ルームデータの取得と監視

- ✅ **useRoomActions.js**
  - 依存: `constants.js`, Firebase, React Router
  - 役割: ルームの退出・終了処理

### Layer 3: UIコンポーネントレイヤー
- ✅ **RoomHeader.jsx**
  - 依存: `constants.js`, lucide-react
  - 役割: ルームヘッダーの表示

- ✅ **GameOverlay.jsx**
  - 依存: `constants.js`, entertainment
  - 役割: ゲームオーバーレイの表示

### Layer 4: ページコンポーネントレイヤー
- ✅ **HomePage.jsx**
  - 依存: `constants.js`, Firebase, timer, React Router
  - 役割: ホームページ（部屋一覧）

- ✅ **RoomPage.jsx**
  - 依存: `constants.js`, `useRoomData`, `useRoomActions`, 他の機能モジュール
  - 役割: ルームメインページ

### Layer 5: エクスポートレイヤー
- ✅ **index.js**
  - 依存: すべてのコンポーネント・hooks
  - 役割: 他のモジュールからのインポートを簡略化

---

## 🎯 依存関係の特徴

### ✅ 良い点:
1. **単方向の依存関係**: 循環参照なし
2. **明確なレイヤー構造**: 各レイヤーは下位レイヤーのみに依存
3. **定数の一元管理**: constants.js が基礎レイヤーとして機能
4. **関心の分離**: hooks とコンポーネントが明確に分離
5. **疎結合**: 各ファイルが独立して機能

### 🔍 注意点:
1. **RoomPage.jsx の依存が多い**: メインページなので妥当だが、複雑化しないよう注意
2. **他の機能モジュールへの依存**: collaboration, timer, video-call, entertainment に依存
   - これは機能統合のため必要
   - 各機能が独立しているため、問題なし

---

## 📐 依存関係グラフ

```
constants.js (基礎)
    ↓
    ├─→ useRoomData.js
    ├─→ useRoomActions.js
    ├─→ RoomHeader.jsx
    └─→ GameOverlay.jsx
         ↓
         ├─→ HomePage.jsx
         └─→ RoomPage.jsx
              ↓
              └─→ index.js (エクスポート)
```

---

## 🛡️ 依存関係の健全性チェック

### ✅ チェック項目:
- [x] 循環参照がない
- [x] 各ファイルの責務が明確
- [x] 不要な依存関係がない
- [x] 外部ライブラリの使用が適切
- [x] モジュール間の結合度が低い
- [x] 各モジュールの凝集度が高い

### 📊 結果:
**依存関係は健全です！** 🎉

---

## 🔮 拡張時の考慮事項

### 新しいhooksを追加する場合:
```javascript
// hooks/useNewHook.js
import { ROOM_LIMITS } from "../constants";  // ✅ constants を使用

export const useNewHook = () => {
  // ロジック
};
```

### 新しいコンポーネントを追加する場合:
```javascript
// components/NewComponent.jsx
import { ROOM_ERRORS } from "../constants";  // ✅ constants を使用
import { useRoomData } from "../hooks/useRoomData";  // ✅ 既存のhooksを使用

export const NewComponent = () => {
  // UI
};
```

### ❌ 避けるべき依存関係:
```javascript
// BAD: 循環参照
// useRoomData.js → useRoomActions.js → useRoomData.js ❌

// BAD: 不要な依存
// RoomHeader.jsx → useParticipants.js ❌ (ヘッダーは参加者データを直接扱わない)

// GOOD: シンプルな単方向依存
// RoomPage.jsx → useRoomData.js ✅
```

---

## 📚 参考資料

- **Clean Architecture**: Robert C. Martin
- **Component Design Principles**: Separation of Concerns, Single Responsibility
- **React Best Practices**: Hooks, Component Composition

---

**最終更新**: 2025-10-17  
**ステータス**: ✅ 健全

