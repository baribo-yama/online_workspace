# 参加者管理システムの深刻な問題分析

**作成日:** 2025-10-21  
**分析者:** AI Assistant  
**対象:** Firestore参加者管理システム  
**緊急度:** 🔴 高（アプリの基本機能に影響）

---

## 📋 概要

現在の参加者管理システムには、**複数の深刻な問題**が同時に発生しており、アプリの基本機能である「部屋での共同作業」が正常に動作しない状況です。

### 🚨 報告された問題
1. **参加者数の反映問題** - リロード時に参加者数が正しく反映されない
2. **参加者登録の失敗** - 新規入室者がFirestoreに登録されない
3. **部屋の時系列保存問題** - dev_roomsコレクションが時系列で保存されない
4. **参加者退出の誤表示** - 退出した人と違う人が退出したと表示される
5. **カメラ/マイクの消失** - リロード時にビデオ通話が機能しなくなる

---

## 🔍 根本原因の分析

### 1. 参加者登録の競合状態（Race Condition）

#### 問題の詳細
```javascript
// src/features/collaboration/hooks/useParticipants.js:178-231
const joinRoom = async () => {
  // 1. 既存参加者をチェック
  const existingSnapshot = await getDocs(existingParticipantsQuery);
  
  // 2. 同じ名前の参加者を削除
  const duplicateParticipants = existingParticipants.filter(p => p.name === userName);
  if (duplicateParticipants.length > 0) {
    await Promise.all(duplicateParticipants.map(async (duplicate) => {
      await deleteDoc(doc(getRoomsCollection(), roomId, "participants", duplicate.id));
    }));
  }
  
  // 3. 新しい参加者を追加
  const docRef = await addDoc(collection(getRoomsCollection(), roomId, "participants"), {
    ...defaultParticipant(userName, isFirstParticipant),
    joinedAt: serverTimestamp(),
  });
};
```

#### 競合状態の発生パターン
```
【シナリオ: AさんとBさんが同時に入室】
時刻0: Aさんが既存参加者をチェック → 空
時刻1: Bさんが既存参加者をチェック → 空
時刻2: Aさんが新規参加者を作成 → ID:abc123
時刻3: Bさんが新規参加者を作成 → ID:xyz789
時刻4: Aさんが重複チェック → Bさんを削除対象に
時刻5: Bさんが重複チェック → Aさんを削除対象に
結果: どちらも削除されてしまう可能性
```

### 2. 重複削除ロジックの過剰実行

#### 問題の詳細
```javascript
// src/features/collaboration/hooks/useParticipants.js:107-140
const duplicatesToDelete = [];
sortedParticipants.forEach(participant => {
  if (!seenNames.has(participant.name)) {
    seenNames.add(participant.name);
    uniqueParticipants.push(participant);
  } else {
    // 重複する古い参加者を削除対象に追加
    duplicatesToDelete.push(participant);
  }
});

// 重複を一括削除
if (duplicatesToDelete.length > 0) {
  Promise.all(duplicatesToDelete.map(duplicate =>
    deleteDoc(doc(getRoomsCollection(), roomId, "participants", duplicate.id))
  ));
}
```

#### 問題の発生パターン
```
【シナリオ: リロード時の重複削除】
1. ユーザーがリロード
2. 既存の参加者IDをチェック → 有効
3. 既存IDを使用して処理終了
4. しかし、onSnapshotが発火
5. 重複削除ロジックが実行される
6. 既存の参加者も削除対象になる
7. 結果: 有効な参加者が削除される
```

### 3. 参加者数の更新タイミング問題

#### 問題の詳細
```javascript
// src/features/collaboration/hooks/useParticipants.js:149-164
// 部屋の参加者数を更新（部屋が存在する場合のみ）
try {
  const roomRef = doc(getRoomsCollection(), roomId);
  const roomDoc = await getDoc(roomRef);
  
  if (roomDoc.exists()) {
    await updateDoc(roomRef, {
      participantsCount: uniqueParticipants.length
    });
    console.log("部屋の参加者数を更新:", uniqueParticipants.length);
  } else {
    console.log("部屋が削除済みのため、参加者数更新をスキップ");
  }
} catch (error) {
  console.error("参加者数更新エラー:", error);
}
```

#### 問題の発生パターン
```
【シナリオ: 参加者数の不整合】
1. 参加者が入室 → participantsCount: 1
2. 参加者がリロード → 一時的に参加者が削除される
3. participantsCount: 0 に更新される
4. 参加者が再登録される
5. participantsCount: 1 に更新される
6. この間、他の参加者から見ると人数が0→1と変動
```

### 4. FirestoreとLiveKitの同期問題

#### 問題の詳細
```javascript
// VideoCallRoom.jsx と useParticipants.js の分離
// VideoCallRoom: LiveKitの接続管理
// useParticipants: Firestoreの参加者管理
// この2つが独立して動作するため、同期が取れない
```

#### 問題の発生パターン
```
【シナリオ: リロード時のカメラ消失】
1. ユーザーがリロード
2. VideoCallRoomコンポーネントが再マウント
3. LiveKit接続が一度切断される
4. useParticipantsが参加者を再登録
5. LiveKit接続が再確立される
6. この間、カメラ映像が映らない
```

---

## 🎯 影響範囲の分析

### 1. ユーザー体験への影響
- **参加者数の表示が不正確** → 混乱を招く
- **カメラ/マイクが機能しない** → 基本機能が使えない
- **参加者の入退室が正しく反映されない** → 信頼性の低下

### 2. データ整合性への影響
- **Firestoreの参加者データが不整合** → データの信頼性が低下
- **参加者数のカウントが不正確** → 統計データが無意味
- **ホスト権限の移り変わり** → セキュリティリスク

### 3. 開発・保守への影響
- **デバッグが困難** → 問題の特定に時間がかかる
- **新機能の追加が困難** → 基盤が不安定
- **テストが困難** → 再現性の低い問題

---

## 📊 問題の深刻度評価

| 問題 | 深刻度 | 影響範囲 | 緊急度 |
|------|--------|----------|--------|
| 参加者数の反映問題 | 🔴 高 | 全ユーザー | 🔴 高 |
| 参加者登録の失敗 | 🔴 高 | 新規ユーザー | 🔴 高 |
| カメラ/マイクの消失 | 🔴 高 | 全ユーザー | 🔴 高 |
| 参加者退出の誤表示 | 🟡 中 | 全ユーザー | 🟡 中 |
| 部屋の時系列保存問題 | 🟡 中 | 管理者 | 🟡 中 |

---

## 🔧 現在のコードの問題点

### 1. useParticipants.js の問題
```javascript
// 問題1: 複雑な重複削除ロジック
const duplicatesToDelete = [];
sortedParticipants.forEach(participant => {
  if (!seenNames.has(participant.name)) {
    seenNames.add(participant.name);
    uniqueParticipants.push(participant);
  } else {
    duplicatesToDelete.push(participant); // 既存参加者も削除対象になる
  }
});

// 問題2: 非同期処理の競合
await Promise.all(duplicateParticipants.map(async (duplicate) => {
  await deleteDoc(doc(getRoomsCollection(), roomId, "participants", duplicate.id));
}));

// 問題3: 参加者数の更新タイミング
await updateDoc(roomRef, {
  participantsCount: uniqueParticipants.length // 削除前の数で更新される可能性
});
```

### 2. VideoCallRoom.jsx の問題
```javascript
// 問題1: リロード時の接続切断
useEffect(() => {
  // リロード時にコンポーネントが再マウント
  // LiveKit接続が一度切断される
}, []);

// 問題2: 音声要素の管理
const cleanupAudioElement = useCallback((participantIdentity) => {
  // 音声要素を削除してしまう
  audioElementsRef.current.delete(participantIdentity);
});
```

### 3. useRoomCreation.js の問題
```javascript
// 問題1: 部屋作成時の参加者登録
const participantRef = await addDoc(
  collection(getRoomsCollection(), roomRef.id, "participants"),
  {
    ...defaultParticipant(userName.trim(), true),
    joinedAt: serverTimestamp(),
  }
);

// 問題2: hostIdの設定タイミング
await updateDoc(doc(getRoomsCollection(), roomRef.id), {
  hostId: participantRef.id,
  participantsCount: 1,
});
```

---

## 🎯 修正の方向性

### 1. 参加者管理の統一化
- **単一の参加者管理システム**を構築
- **FirestoreとLiveKitの同期**を確実にする
- **競合状態の回避**を実装

### 2. データ整合性の保証
- **トランザクション**を使用した一貫性の保証
- **デバウンス処理**による更新頻度の制御
- **エラーハンドリング**の強化

### 3. リロード時の動作改善
- **既存参加者IDの再利用**を確実にする
- **重複削除の回避**を実装
- **カメラ/マイクの継続性**を保証

---

## 📋 次のアクション

### Phase 1: 仕様書作成
1. **参加者管理仕様書**の作成
2. **データ整合性仕様書**の作成
3. **エラー処理仕様書**の作成

### Phase 2: 実装
1. **参加者管理システム**の再設計
2. **重複削除ロジック**の改善
3. **参加者数管理**の改善

### Phase 3: テスト
1. **単体テスト**の作成
2. **統合テスト**の実行
3. **ユーザーテスト**の実施

---

## 📝 結論

現在の参加者管理システムは、**複数の深刻な問題**が相互に影響し合っており、**根本的な再設計**が必要です。

**緊急度が高い**ため、仕様書の作成と実装を**並行して進める**ことを推奨します。

---

**次のステップ:** 参加者管理仕様書の作成に進む
