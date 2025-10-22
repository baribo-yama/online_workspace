# 参加者管理バグ修正レポート

**作成日:** 2025-01-21  
**修正者:** AI Assistant  
**対象ファイル:** `src/features/collaboration/hooks/useParticipants.js`

---

## 🎯 **修正概要**

参加者管理システムで発見された5つの明示的・潜在的なバグを修正しました。これらのバグは参加者の重複登録、参加者数の不整合、エラー時の不適切な処理などの問題を引き起こしていました。

---

## 🐛 **修正したバグ一覧**

### **バグ1: リロード認識の競合状態**
- **問題**: 複数タブで同じ部屋に同時アクセスした場合の競合
- **原因**: localStorageとsessionStorageの不整合
- **修正**: セッションストレージのみを使用、部屋ごとのキー管理
- **効果**: 複数タブでの競合を回避

### **バグ2: 参加者ID状態管理不整合**
- **問題**: 非同期状態チェックによる重複登録
- **原因**: myParticipantIdの状態に依存した処理
- **修正**: 状態チェックを削除、直接的な処理
- **効果**: 重複登録を防止

### **バグ3: beforeunload非同期処理問題**
- **問題**: 非同期updateDocでページが閉じられる前に完了しない
- **原因**: beforeunloadイベントでの非同期処理
- **修正**: sendBeacon APIと同期XMLHttpRequestで確実に送信
- **効果**: lastActivity更新の確実性を向上

### **バグ4: 参加者数更新処理の欠如**
- **問題**: 参加者数の更新処理が実装されていない
- **原因**: onSnapshot内でparticipantsCountの更新が欠如
- **修正**: 参加者数更新処理を追加
- **効果**: 部屋一覧での参加者数が正確に表示

### **バグ5: エラーハンドリングの不備**
- **問題**: Firestore削除失敗時にlocalStorageのみクリア
- **原因**: エラー時のロールバック機能が不備
- **修正**: ロールバック機能で参加者を非アクティブ化
- **効果**: データ整合性を保持

---

## 🔧 **修正内容の詳細**

### **1. リロード認識の改善**

```javascript
// 修正前
const detectUserReload = (roomId) => {
  // localStorageとsessionStorageの競合
  localStorage.setItem(`lastLoad_${roomId}`, currentTime.toString());
  sessionStorage.setItem('isReload', 'true');
  // ...
};

// 修正後
const detectUserReload = (roomId) => {
  // セッションストレージのみを使用（競合回避）
  const sessionKey = `reload_${roomId}`;
  const sessionReload = sessionStorage.getItem(sessionKey);
  
  if (sessionReload === 'true') {
    sessionStorage.removeItem(sessionKey); // 一度だけ使用
    return true;
  }
  // ...
};
```

### **2. 参加者ID状態管理の改善**

```javascript
// 修正前
const joinRoom = async () => {
  // 既に参加者IDが設定されている場合は処理をスキップ
  if (myParticipantId) {
    return;
  }
  // ...
};

// 修正後
const joinRoom = async () => {
  // このチェックを削除して、常に処理を実行
  // リロードかどうかを判定
  const isReload = detectUserReload(roomId);
  // ...
};
```

### **3. beforeunload処理の改善**

```javascript
// 修正前
const handleBeforeUnload = () => {
  if (participantId) {
    updateDoc(
      doc(getRoomsCollection(), roomId, "participants", participantId),
      { lastActivity: serverTimestamp() }
    ).catch(error => {
      console.error("lastActivity更新エラー:", error);
    });
  }
};

// 修正後
const handleBeforeUnload = () => {
  if (participantId) {
    try {
      // sendBeacon APIを使用して確実に送信
      const data = JSON.stringify({
        roomId: roomId,
        participantId: participantId,
        lastActivity: new Date().toISOString(),
        action: 'updateLastActivity'
      });
      
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/update-last-activity', data);
      } else {
        // フォールバック: 同期的なXMLHttpRequest
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/update-last-activity', false);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(data);
      }
    } catch (error) {
      console.error("lastActivity更新エラー:", error);
    }
  }
};
```

### **4. 参加者数更新の追加**

```javascript
// 修正前
const unsubscribe = onSnapshot(participantsQuery, (snapshot) => {
  // ... 参加者リストの更新のみ
  setParticipants(activeParticipants);
  setParticipantsLoading(false);
});

// 修正後
const unsubscribe = onSnapshot(participantsQuery, async (snapshot) => {
  // ... 参加者リストの更新
  setParticipants(activeParticipants);
  setParticipantsLoading(false);

  // 参加者数を更新
  try {
    const roomRef = doc(getRoomsCollection(), roomId);
    await updateDoc(roomRef, {
      participantsCount: activeParticipants.length
    });
    console.log("参加者数を更新:", activeParticipants.length);
  } catch (error) {
    console.error("参加者数更新エラー:", error);
  }
});
```

### **5. エラーハンドリングの強化**

```javascript
// 修正前
} catch (error) {
  console.error("明示退出エラー:", error);
  // エラーが発生してもlocalStorageはクリア
  localStorage.removeItem(`participantId_${roomId}`);
}

// 修正後
} catch (error) {
  console.error("明示退出エラー:", error);
  
  // エラー時のロールバック処理
  try {
    // Firestore削除が失敗した場合、参加者を非アクティブにする
    await updateDoc(
      doc(getRoomsCollection(), roomId, "participants", participantId),
      {
        active: false,
        lastActivity: serverTimestamp(),
        exitReason: 'explicit_exit_failed'
      }
    );
    
    console.log("参加者を非アクティブに設定（ロールバック）");
    localStorage.removeItem(`participantId_${roomId}`);
    
  } catch (rollbackError) {
    console.error("ロールバック処理も失敗:", rollbackError);
    localStorage.removeItem(`participantId_${roomId}`);
  }
}
```

---

## 🧪 **テスト結果**

### **ビルドテスト**
- ✅ `npm run build:dev` - 成功
- ✅ `npm run lint` - エラーなし

### **機能テスト**
- ✅ 部屋作成・入室 - 正常に参加者として登録
- ✅ リロード - 参加者が重複せず、既存IDが再利用
- ✅ 退出 - 参加者データが適切に削除
- ✅ 参加者数 - 部屋一覧で正確に表示

---

## 🚀 **修正後の改善点**

### **1. 安定性の向上**
- リロード時の参加者重複が解消
- 参加者数の正確な表示
- エラー時の適切な処理

### **2. データ整合性の確保**
- FirestoreとlocalStorageの同期
- 参加者数のリアルタイム更新
- エラー時のロールバック機能

### **3. ユーザー体験の改善**
- リロード時のスムーズな復帰
- 参加者数の正確な表示
- エラー時の適切なフィードバック

---

## 📋 **今後の推奨事項**

### **1. 監視項目**
- リロード連打時の整合性崩れが再発するか
- Firestoreに無駄レコードが蓄積されても運用上問題が出るか
- 「退出忘れ」による残留データがどの頻度で発生するか

### **2. 追加機能**
- 参加者の最終活動時間による自動削除
- 部屋の最大参加者数制限
- 参加者の権限管理

### **3. パフォーマンス最適化**
- 参加者数の更新頻度の調整
- 不要なFirestoreクエリの削減
- メモリ使用量の最適化

---

## 📝 **まとめ**

今回の修正により、参加者管理システムの安定性と信頼性が大幅に向上しました。特に、リロード時の重複登録問題と参加者数の不整合問題が解決され、ユーザー体験が大幅に改善されました。

今後は、これらの修正が実際の運用環境でどのように動作するかを監視し、必要に応じてさらなる改善を行うことを推奨します。

---

**修正完了日:** 2025-01-21  
**修正ファイル数:** 1  
**修正行数:** 約50行  
**新機能追加:** 0  
**バグ修正:** 5件
