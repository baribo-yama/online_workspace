# ホスト権限の仕様書

## 📋 概要

ホスト権限の自動移譲は**実装しない**という設計判断。
シンプルで予測可能な動作を優先。

---

## 🎯 設計方針

### **シンプル第一**
- 複雑なホスト権限移譲ロジックはバグの温床
- 部屋を作成した人が永続的にホスト
- 権限は固定で、移動しない

### **予測可能性**
- ユーザーが理解しやすい動作
- 誰がホストかが明確
- 意図しない権限の移動が起きない

---

## ✅ 現在の仕様

### 1. **ホスト権限の設定**
```javascript
// 部屋作成時
const docRef = await addDoc(getRoomsCollection(), {
  ...defaultRoom,
  hostId: "",  // 初期値は空
  title: title.trim(),
  createdAt: serverTimestamp(),
});

// 最初の参加者が入室時
if (isFirstParticipant) {
  await updateDoc(doc(getRoomsCollection(), roomId), {
    hostId: participantId,  // 最初の参加者のIDを設定
    createdBy: userName,
  });
}
```

### 2. **ホスト権限の判定**
```javascript
// RoomPage.jsx
const isHost = Boolean(room?.hostId && room.hostId === myParticipantId);
```

### 3. **ホストが退出した場合**
```javascript
// useParticipants.js の leaveRoom()
const leaveRoom = async () => {
  if (myParticipantId) {
    // 参加者を削除するだけ
    await deleteDoc(doc(getRoomsCollection(), roomId, "participants", myParticipantId));
    
    // ⚠️ hostId は変更しない
    // → ホストが退出しても、room.hostId は保持される
  }
};
```

### 4. **ホストが再入室した場合**
```javascript
// useParticipants.js の joinRoom()
// 既存の参加者IDをチェック
const existingParticipantId = localStorage.getItem(`participantId_${roomId}`);

// hostId と myParticipantId が一致すれば、再びホストになる
const isHost = Boolean(room?.hostId && room.hostId === myParticipantId);
```

---

## 🎨 UI仕様

### **ゲスト（isHost = false）**
```jsx
{!isHost && (
  <button onClick={onLeaveRoom}>
    <Home className="w-4 h-4" />
    ルーム一覧に戻る
  </button>
)}
```

**表示されるもの:**
- ✅ 「ルーム一覧に戻る」ボタンのみ

**動作:**
- 参加者リストから自分を削除してホームに戻る
- 部屋は残る

---

### **ホスト（isHost = true）**
```jsx
{isHost && (
  <button onClick={onEndRoom}>
    <Trash2 className="w-4 h-4" />
    部屋を終了
  </button>
)}
```

**表示されるもの:**
- ✅ 「部屋を終了」ボタンのみ

**動作:**
- 確認ダイアログを表示
- 部屋を削除してホームに戻る
- 全参加者が自動的に退出される

---

## 🔄 状態遷移図

```
[部屋作成]
    ↓
[hostId: "", 参加者: 0人]
    ↓
[Aが入室]
    ↓
[hostId: "A_ID", 参加者: 1人 (A=ホスト)]
    ↓
[B, Cが入室]
    ↓
[hostId: "A_ID", 参加者: 3人 (A=ホスト, B=ゲスト, C=ゲスト)]
    ↓
[Aが退出]  ← ⚠️ ここがポイント
    ↓
[hostId: "A_ID", 参加者: 2人 (B=ゲスト, C=ゲスト)]
    ↑
    └─ hostId は "A_ID" のまま保持
    └─ ホストは不在だが、部屋は存在し続ける
    ↓
[Aが再入室]
    ↓
[hostId: "A_ID", 参加者: 3人 (A=ホスト, B=ゲスト, C=ゲスト)]
    ↑
    └─ A の participantId が hostId と一致すればホストに戻る
```

---

## ❓ よくある質問

### Q1. ホストが退出したら、部屋を削除できる人がいなくなるのでは？

**A1.** はい、その通りです。これは**意図的な設計判断**です。

**理由:**
- ホスト権限の自動移譲はバグの温床になる
- シンプルで予測可能な動作を優先

**対処法:**
1. ホストが再入室すれば、再びホスト権限を持つ
2. 使われなくなった部屋は自然に放置される
3. 管理者がFirestoreから手動で削除できる

---

### Q2. ホストが不在の部屋に誰も入れなくなるのでは？

**A2.** いいえ、入室自体は可能です。

- 部屋一覧に表示される
- ゲストとして入室できる
- ただし、誰も部屋を終了できない

**運用での対応:**
- ホストが戻ってくるのを待つ
- または別の部屋を作り直す

---

### Q3. ホストIDを他の人に変更することはできないの？

**A3.** 現在の仕様では**できません**。

**将来的な拡張案:**
- 管理画面でホストを変更できる機能
- ホストが明示的に権限を移譲できる機能（手動）
- ただし、自動移譲は実装しない

---

## 🚀 メリット

### ✅ **1. シンプル**
- 権限移譲ロジックがない
- コードが短く、理解しやすい
- バグが少ない

### ✅ **2. 予測可能**
- 部屋作成者がホスト
- 誰がホストかが明確
- 意図しない権限移動がない

### ✅ **3. 保守性が高い**
- 複雑なエッジケースを考慮不要
- テストが容易
- 拡張しやすい

---

## ⚠️ デメリット

### ❌ **1. ホスト不在の部屋**
- ホストが退出すると、部屋を削除できる人がいなくなる
- 対処: ホストが再入室するか、管理者が手動削除

### ❌ **2. 柔軟性が低い**
- ホスト権限を他の人に渡せない（自動・手動とも）
- 対処: 将来的に手動移譲機能を追加する可能性

---

## 🔮 将来的な拡張案

### 案1: 手動でのホスト権限移譲
```javascript
// ホストが明示的に権限を移譲
const transferHost = async (newHostId) => {
  if (!isHost) {
    alert("ホストのみが権限を移譲できます");
    return;
  }
  
  // 確認ダイアログ
  const confirm = window.confirm(`${newHostName} にホスト権限を移譲しますか？`);
  if (!confirm) return;
  
  // hostId を更新
  await updateDoc(doc(getRoomsCollection(), roomId), {
    hostId: newHostId,
  });
};
```

### 案2: 部屋の有効期限
```javascript
// 一定時間（例: 24時間）経過した部屋を自動削除
const ROOM_EXPIRATION = 24 * 60 * 60 * 1000; // 24時間

// Cloud Functions で定期的に実行
const deleteExpiredRooms = async () => {
  const now = Date.now();
  const rooms = await getDocs(getRoomsCollection());
  
  rooms.forEach(async (roomDoc) => {
    const createdAt = roomDoc.data().createdAt.toDate().getTime();
    if (now - createdAt > ROOM_EXPIRATION) {
      await deleteDoc(roomDoc.ref);
    }
  });
};
```

---

## 📊 実装状況

| 機能 | 状態 | 備考 |
|-----|------|------|
| 部屋作成者がホスト | ✅ 実装済み | 最初の参加者のIDをhostIdに設定 |
| ホスト判定 | ✅ 実装済み | `room.hostId === myParticipantId` |
| ホスト退出時の権限保持 | ✅ 実装済み | hostId は変更しない |
| ホスト再入室時の権限復帰 | ✅ 実装済み | hostId が一致すればホストに |
| ホストのみ「部屋を終了」ボタン | ✅ 実装済み | RoomHeader.jsx |
| ゲストのみ「ルーム一覧に戻る」ボタン | ✅ 実装済み | RoomHeader.jsx |
| 自動権限移譲 | ❌ 未実装 | 意図的に実装しない |
| 手動権限移譲 | ❌ 未実装 | 将来的な拡張案 |

---

## 🔗 関連ドキュメント

- [bugs.md](./bugs.md) - バグ一覧と修正状況
- [src/features/study-room/README.md](../src/features/study-room/README.md) - Study Room機能のREADME
- [requirements-specification.md](./requirements-specification.md) - 要件定義

---

**最終更新**: 2025-10-17  
**設計判断者**: 開発チーム  
**ステータス**: ✅ 確定

