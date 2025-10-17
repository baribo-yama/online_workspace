# Study Room Feature（勉強部屋機能）

## 📁 ディレクトリ構造（レベル1: ミニマル構成）

```
src/features/study-room/
├── components/
│   ├── HomePage.jsx          # ホームページ（部屋一覧）
│   ├── RoomPage.jsx          # ルームページ（メイン）- 238行
│   ├── RoomHeader.jsx        # ヘッダーコンポーネント - 57行
│   └── GameOverlay.jsx       # ゲームオーバーレイ - 69行
├── hooks/
│   ├── useRoomData.js        # データ取得ロジック - 62行
│   └── useRoomActions.js     # 操作ロジック - 76行
├── constants.js              # 定数定義 - 49行
└── index.js                  # エクスポート用
```

**合計: 8ファイル / 約550行**

---

## 🎯 責務の分離

### **📄 components/** - UIコンポーネント
- **RoomPage.jsx**: メインコンテナ、状態管理、UIの配置
- **RoomHeader.jsx**: ヘッダー部分（タイトル、ボタン）
- **GameOverlay.jsx**: ゲーム全画面表示

### **🔧 hooks/** - ロジック層
- **useRoomData.js**: Firestoreからのデータ取得、監視
- **useRoomActions.js**: 退出・終了処理、権限チェック

### **📊 constants.js** - 定数
- ルーム制限値
- エラーメッセージ
- 確認メッセージ
- デフォルト値

---

## 🐛 修正されたバグ

### ✅ **1. ホスト以外が部屋削除できるバグ**
**修正箇所**: `hooks/useRoomActions.js`

```javascript
// バグ修正: ホスト権限チェック追加
if (!isHost) {
  alert(ROOM_ERRORS.NOT_HOST);
  return;
}
```

**変更内容**:
- `handleEndRoom()` 関数内でホスト権限をチェック
- UIレベルでも終了ボタンはホストのみに表示

### ✅ **2. マジックナンバー・マジックストリングの排除**
**修正箇所**: `constants.js`

```javascript
// Before（悪い例）
if (participants.length >= 5) { ... }
alert("部屋を終了できるのはホストのみです。");

// After（良い例）
if (participants.length >= ROOM_LIMITS.MAX_PARTICIPANTS) { ... }
alert(ROOM_ERRORS.NOT_HOST);
```

**メリット**:
- 一箇所で変更可能
- タイポ防止
- 保守性向上

---

## 💡 使用方法

### **他の機能からimportする場合**

```javascript
// 推奨: index.js 経由
import { RoomPage, useRoomData, ROOM_LIMITS } from '@/features/study-room';

// 直接importも可能
import { useRoomData } from '@/features/study-room/hooks/useRoomData';
```

### **新しいページで同じロジックを使う場合**

```javascript
import { useRoomData, useRoomActions } from '@/features/study-room';

function MyNewPage() {
  const { room, loading } = useRoomData(roomId);
  const { handleLeaveRoom } = useRoomActions(roomId, leaveRoom, isHost);

  // 同じロジックを再利用できる
}
```

---

## 🚀 今後の拡張

### **チャット機能を追加する場合**

```javascript
// RoomPage.jsx
import { ChatPanel } from '@/features/chat';

function RoomPage() {
  // ... 既存のコード ...

  return (
    <div className="flex h-screen">
      <RoomSidebar {...} />
      <RoomMainContent {...} />

      {/* 🆕 チャット追加（既存コードに影響なし） */}
      <ChatPanel roomId={roomId} userId={myParticipantId} />
    </div>
  );
}
```

### **統計機能を追加する場合**

```javascript
// RoomHeader.jsx
import { StatisticsButton } from '@/features/statistics';

export const RoomHeader = ({ ... }) => {
  return (
    <div>
      {/* 既存のボタン */}
      <button onClick={onLeaveRoom}>...</button>

      {/* 🆕 統計ボタン追加 */}
      <StatisticsButton roomId={roomId} />
    </div>
  );
};
```

---

## ⚠️ 注意点

### **hooksの依存関係**
- `useRoomActions` は `isHost` を引数で受け取る
- `isHost` は `RoomPage` 内で計算される
- 将来的に複雑になったら `useRoomPermissions` を追加検討

### **定数の追加**
新しい定数を追加する場合は `constants.js` に追加：

```javascript
// constants.js
export const NEW_FEATURE_CONFIG = {
  SETTING_1: "value1",
  SETTING_2: 100,
};
```

---

## 📊 パフォーマンス

- **遅延読み込み**: VideoCallRoom, FaceObstacleGame
- **メモ化**: 必要に応じて `useMemo`, `useCallback` 使用
- **リアルタイム更新**: Firestore の `onSnapshot` 使用

---

## 🧪 テスト（将来的に）

```javascript
// useRoomActions.test.js
import { renderHook } from '@testing-library/react';
import { useRoomActions } from './hooks/useRoomActions';

describe('useRoomActions', () => {
  it('ホスト以外は部屋を終了できない', () => {
    const { result } = renderHook(() =>
      useRoomActions('room123', mockLeaveRoom, false)
    );

    result.current.handleEndRoom();

    expect(window.alert).toHaveBeenCalledWith(ROOM_ERRORS.NOT_HOST);
  });
});
```

---

## 📝 変更履歴

### v1.3.2 (2025-10-17)
- ✅ **パフォーマンス最適化**
  - `HomePage.jsx`: `fetchParticipantsData` を `useCallback` でメモ化
  - `RoomPage.jsx`: `gameStatus` の冗長な計算を削除
  - useEffect の依存配列を適切に設定
  - 不要な関数の再作成を防止

### v1.3.0 (2025-10-17)
- ✅ **設計変更: ホスト権限の固定化**
  - ホスト権限の自動移譲を削除（バグの温床となるため）
  - 部屋を作成した人が永続的にホスト
  - ホストが退出しても `hostId` は保持される
  - UI変更: ホストには「部屋を終了」ボタンのみ、ゲストには「ルーム一覧に戻る」ボタンのみ表示
  - シンプルで予測可能な動作を実現

### v1.2.0 (2025-10-17)
- ✅ **コード品質の改善 - マジックナンバー・マジックストリングの完全排除**
  - `HomePage.jsx` の全マジックナンバーを `constants.js` に統合
  - 未使用インポートを削除（`db`, `RefreshCw`）
  - 全エラーメッセージを `ROOM_ERRORS` に統一
  - 保守性・拡張性が大幅に向上

### v1.0.0 (2025-01-XX)
- ✅ レベル1構造にリファクタリング
- ✅ hooks に分離（useRoomData, useRoomActions）
- ✅ constants.js で定数を一元管理
- ✅ ホスト権限チェックバグを修正
- ✅ RoomHeader, GameOverlay を分離
- ✅ 345行 → 238行に削減（RoomPage.jsx）

---

## 🔗 関連ドキュメント

- [requirements-specification.md](../../../docs/requirements-specification.md) - 要件定義
- [bugs.md](../../../docs/bugs.md) - バグ一覧
- [directory-structure.md](../../../docs/directory-structure.md) - ディレクトリ構造

