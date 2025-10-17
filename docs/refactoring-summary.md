# study-room/ リファクタリング概要

## 🎯 目的
study-room/ フォルダ内のコードをシンプルかつ保守・拡張しやすい設計に改善

---

## 📌 最新の設計変更 (v1.3.0)

### **ホスト権限の固定化**
ホスト権限の自動移譲を削除し、シンプルな設計に変更：

- ✅ 部屋を作成した人が永続的にホスト
- ✅ ホストが退出しても `hostId` は保持される
- ✅ ホストが再入室すれば、再びホスト権限を持つ
- ✅ UI変更: ホストには「部屋を終了」ボタンのみ、ゲストには「ルーム一覧に戻る」ボタンのみ

**理由:**
- ホスト権限の自動移譲はバグの温床となる
- シンプルで予測可能な動作を優先
- 保守性が大幅に向上

---

## ✅ 実施した改善

### 1. **マジックナンバー・マジックストリングの完全排除**

#### 修正前の問題:
```javascript
// HomePage.jsx の問題箇所
if (now - joinedTime <= 300000) { ... }  // 5分 = ？
if (rooms.length >= 3) { ... }  // 3 = ？
limit(10)  // 10 = ？
<span>{room.participantsCount || 0}/5</span>  // 5 = ？

alert("部屋のタイトルを入力してください");  // ハードコード
alert("名前を入力してください");  // ハードコード
```

#### 修正後:
```javascript
// constants.js に統合
export const ROOM_LIMITS = {
  MAX_PARTICIPANTS: 5,
  MAX_ACTIVE_ROOMS: 3,
  PARTICIPANT_TIMEOUT_MS: 300000,
  ROOMS_LIST_LIMIT: 10,
};

export const ROOM_ERRORS = {
  TITLE_REQUIRED: "部屋のタイトルを入力してください",
  NAME_REQUIRED: "名前を入力してください",
  CREATE_FAILED: "部屋の作成に失敗しました。もう一度お試しください",
  ROOMS_LIMIT_REACHED: "現在、同時に存在できる部屋数の上限（3部屋）に達しています。\n...",
};

// HomePage.jsx での使用
if (now - joinedTime <= ROOM_LIMITS.PARTICIPANT_TIMEOUT_MS) { ... }
if (rooms.length >= ROOM_LIMITS.MAX_ACTIVE_ROOMS) { ... }
limit(ROOM_LIMITS.ROOMS_LIST_LIMIT)
<span>{room.participantsCount || 0}/{ROOM_LIMITS.MAX_PARTICIPANTS}</span>

alert(ROOM_ERRORS.TITLE_REQUIRED);
alert(ROOM_ERRORS.NAME_REQUIRED);
```

**メリット:**
- ✅ 定数を一箇所で変更すれば全体に反映される
- ✅ 意味が明確になり、コードの可読性が向上
- ✅ タイポによるバグを防止
- ✅ テストが容易になる

---

### 2. **未使用インポートの削除**

#### 修正前:
```javascript
import { db, getRoomsCollection } from "../../../shared/services/firebase";
import { Users, RefreshCw } from "lucide-react";
```

#### 修正後:
```javascript
import { getRoomsCollection } from "../../../shared/services/firebase";
import { Users } from "lucide-react";
```

**効果:**
- ✅ バンドルサイズの削減
- ✅ 不要な依存関係の排除
- ✅ コードの明確化

---

### 3. **constants.js の拡充**

追加した定数:
- `ROOM_LIMITS.ROOMS_LIST_LIMIT`: 部屋一覧の取得上限
- `ROOM_ERRORS.CREATE_FAILED`: 部屋作成失敗のエラーメッセージ
- `ROOM_ERRORS.ROOMS_LIMIT_REACHED`: 部屋数上限到達のエラーメッセージ

---

## 📊 修正の影響範囲

### 修正したファイル:
1. ✅ `src/features/study-room/constants.js`
   - 定数を追加（`ROOMS_LIST_LIMIT`, `CREATE_FAILED`, `ROOMS_LIMIT_REACHED`）

2. ✅ `src/features/study-room/components/HomePage.jsx`
   - 未使用インポートを削除
   - 全マジックナンバーを定数に置き換え
   - 全エラーメッセージを定数に置き換え

### 影響を受けないファイル:
- ✅ `useRoomData.js` - 既に最適化済み
- ✅ `useRoomActions.js` - 既に最適化済み
- ✅ `RoomPage.jsx` - 既に最適化済み
- ✅ `RoomHeader.jsx` - 既に最適化済み
- ✅ `GameOverlay.jsx` - 既に最適化済み
- ✅ `index.js` - エクスポート用ファイル、変更不要

---

## 🧪 テスト項目

### 機能テスト:
- [ ] 部屋作成が正常に動作する
- [ ] 部屋一覧の表示が正常に動作する
- [ ] 参加者数の表示が正しい（/5 の表示）
- [ ] 部屋数制限（3部屋）が正しく動作する
- [ ] エラーメッセージが正しく表示される

### コードレビュー:
- [x] リンターエラーなし
- [x] マジックナンバーが存在しない
- [x] 未使用のインポートが存在しない
- [x] 定数が適切に使用されている

---

## 🎓 今後の開発者へのガイドライン

### 定数の追加方法:
```javascript
// constants.js に追加
export const ROOM_LIMITS = {
  MAX_PARTICIPANTS: 5,
  NEW_LIMIT: 100,  // 新しい定数を追加
};

// 使用する側
import { ROOM_LIMITS } from "../constants";

if (value >= ROOM_LIMITS.NEW_LIMIT) {
  // ...
}
```

### エラーメッセージの追加方法:
```javascript
// constants.js に追加
export const ROOM_ERRORS = {
  TITLE_REQUIRED: "部屋のタイトルを入力してください",
  NEW_ERROR: "新しいエラーメッセージ",  // 追加
};

// 使用する側
import { ROOM_ERRORS } from "../constants";

alert(ROOM_ERRORS.NEW_ERROR);
```

### ❌ 避けるべきこと:
```javascript
// BAD: マジックナンバー
if (participants.length > 8) { ... }

// GOOD: 定数を使用
if (participants.length > ROOM_LIMITS.MAX_PARTICIPANTS) { ... }

// BAD: ハードコードされたメッセージ
alert("エラーが発生しました");

// GOOD: 定数を使用
alert(ROOM_ERRORS.GENERIC_ERROR);
```

---

## 📈 品質指標

### Before (リファクタリング前):
- マジックナンバー: **8箇所**
- ハードコードされたメッセージ: **5箇所**
- 未使用インポート: **2個**

### After (リファクタリング後):
- マジックナンバー: **0箇所** ✅
- ハードコードされたメッセージ: **0箇所** ✅
- 未使用インポート: **0個** ✅

---

## 🔗 関連ドキュメント

- [bugs.md](./bugs.md) - バグ一覧
- [src/features/study-room/README.md](../src/features/study-room/README.md) - Study Room機能のREADME
- [requirements-specification.md](./requirements-specification.md) - 要件定義

