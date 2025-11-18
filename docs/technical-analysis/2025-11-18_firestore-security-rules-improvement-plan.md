# Firestore セキュリティルール改善計画

**日付:** 2025-11-18 
**分析者:** AI (Cursor Agent)  
**対象:** Firestore Security Rules の段階的強化  
**問題の重要度:** 最高（セキュリティリスク）

---

## 📝 エグゼクティブサマリー

### **現状の問題**

現在の `firestore.rules` は MVP 段階の互換性を優先し、以下のような緩い制限になっています：

- **更新・削除が誰でも可能**: `allow update: if true;`, `allow delete: if true;`
- **認証未導入**: `request.auth` が使えないため、ユーザー識別ができない
- **直接アクセス可能**: ブラウザの開発者ツールやスクリプトから直接 Firestore にアクセス可能

これにより、悪意のあるユーザーが以下の攻撃を実行できる可能性があります：

1. データの完全削除（ルーム、参加者、メッセージ）
2. データの改ざん（タイマー操作、参加者リストの改ざん）
3. 不正なデータの書き込み（空のタイトル、異常な値）

### **改善方針**

段階的にセキュリティを強化し、既存機能への影響を最小限に抑えながら、リスクを低減します。

---

## 🔍 現状の実装状況

### **Firestore 操作の実装箇所**

| 操作 | 実装箇所 | 現在のルール |
|-----|---------|------------|
| **read** | `useRoomsList`, `useRoomData`, `useParticipants` | `allow read: if true;` |
| **create (room)** | `useRoomCreation` | 必須フィールドチェックあり |
| **update (room)** | `useParticipants`, `useSharedTimer`, `useFaceObstacleGame` | `allow update: if true;` |
| **delete (room)** | `useRoomActions` | `allow delete: if true;` |
| **create (participant)** | `useParticipants` | 必須フィールドチェックあり |
| **delete (participant)** | `useParticipants`（複数箇所） | `allow delete: if true;` |

### **認証状況**

- **Firebase Auth 未導入**: 匿名認証も含めて認証機能が実装されていない
- **ユーザー識別不可**: Firestore ルールで `request.auth.uid` が使えない
- **Cloud Functions**: LiveKit トークン発行と Slack 通知のみ実装済み

### **データ構造**

```javascript
// rooms コレクション
{
  title: string,
  createdAt: timestamp,
  hostId: string,  // ホストの participantId
  participantsCount: number,
  timer: {...},
  game: {...},
  slackNotificationEnabled: boolean,
  slackThreadTs: string | null
}

// participants サブコレクション
{
  name: string,
  joinedAt: timestamp,
  isHost: boolean,
  status: "online" | "away" | "offline",
  lastActivity: timestamp
}
```

---

## ✅ ステップ1: 今すぐ `firestore.rules` だけでできる対応

### **1-1. 削除操作の禁止（暫定）**

**目的**: 悪意のあるユーザーによるデータ削除を防ぐ

**変更内容**:

```diff
match /{prefix}_rooms/{roomId} {
  allow read: if true;
  allow create: if /* ... 既存のチェック ... */;
  allow update: if true;
  
-  allow delete: if true;
+  // TODO: 認証導入後にホストのみ許可
+  allow delete: if false;
  
  match /participants/{participantId} {
    allow read: if true;
    allow create: if /* ... 既存のチェック ... */;
    allow update: if true;
    
-    allow delete: if true;
+    // TODO: 認証導入後に本人またはホストのみ許可
+    allow delete: if false;
  }
  
  match /messages/{messageId} {
    allow read: if true;
    allow create: if /* ... 既存のチェック ... */;
    allow update: if false;
    allow delete: if false;  // 既に false
  }
}
```

**注意点**:
- 退出処理などで `deleteDoc` を使っている箇所は、一旦機能を無効化するか、Cloud Functions 経由に切り替える必要があります
- ルーム削除機能も同様に、Cloud Functions 実装まで一時的に無効化を検討

**影響範囲**:
- `useRoomActions.js`: ルーム削除機能
- `useParticipants.js`: 参加者削除機能（退出処理）

---

### **1-2. 更新可能なフィールドの制限**

**目的**: 重要なフィールド（`createdAt`, `hostId` など）の改ざんを防ぐ

**変更内容**:

```diff
match /{prefix}_rooms/{roomId} {
  allow read: if true;
  allow create: if /* ... 既存のチェック ... */;
  
-  allow update: if true;
+  allow update: if
+    // 更新可能なフィールドのみ許可
+    request.resource.data.keys().hasOnly([
+      'participantsCount',
+      'timer',
+      'game',
+      'updatedAt',
+      'slackNotificationEnabled',
+      'slackThreadTs'
+    ]) &&
+    // 重要なフィールドは変更不可
+    request.resource.data.createdAt == resource.data.createdAt &&
+    request.resource.data.hostId == resource.data.hostId &&
+    request.resource.data.title == resource.data.title;
  
  allow delete: if false;
  
  match /participants/{participantId} {
    allow read: if true;
    allow create: if /* ... 既存のチェック ... */;
    
-    allow update: if true;
+    allow update: if
+      // 更新可能なフィールドのみ許可
+      request.resource.data.keys().hasOnly([
+        'status',
+        'lastActivity',
+        'isCameraOn',
+        'isMicOn',
+        'isHost'  // ホスト権限移譲時に必要
+      ]) &&
+      // 重要なフィールドは変更不可
+      request.resource.data.name == resource.data.name &&
+      request.resource.data.joinedAt == resource.data.joinedAt;
    
    allow delete: if false;
  }
}
```

**注意点**:
- `isHost` フィールドはホスト権限移譲時に更新されるため、許可リストに含める必要があります
- 将来的に認証を導入したら、`isHost` の更新はホストのみに制限すべき

**影響範囲**:
- 既存の `updateDoc` 呼び出しが、許可されたフィールドのみを更新しているか確認が必要

---

### **1-3. 作成時のバリデーション強化**

**目的**: 不正なデータの書き込みを防ぐ

**変更内容**:

```diff
match /{prefix}_rooms/{roomId} {
  allow create: if 
    request.resource.data.keys().hasAll(['title', 'createdAt']) &&
    request.resource.data.title is string &&
    request.resource.data.title.size() > 0 &&
    request.resource.data.title.size() <= 50 &&
+   // createdAt が未来の日時でないことを確認
+   request.resource.data.createdAt <= request.time &&
+   // タイトルに禁止文字が含まれていないことを確認（オプション）
+   !request.resource.data.title.matches('.*[<>{}].*');
  
  // ...
}
```

**注意点**:
- 正規表現チェックは、既存のデータに影響しない範囲で追加してください
- 必要に応じて、より厳密なバリデーションを追加可能

---

### **1-4. TODO コメントの追加**

**目的**: 将来の改善点を明記し、チームで共有

**追加するコメント例**:

```javascript
match /{prefix}_rooms/{roomId} {
  // TODO: 認証導入後に以下のルールに変更
  // allow update: if request.auth != null && isHost(roomId);
  // allow delete: if request.auth != null && isHost(roomId);
  
  // function isHost(roomId) {
  //   let room = get(/databases/$(database)/documents/$(getRoomPath(roomId)));
  //   return room.data.hostId == request.auth.uid;
  // }
}
```

---

## 🚀 ステップ2: その後に必要な対応（Auth 導入・Cloud Functions 経由）

### **2-1. Firebase Auth（匿名認証）の導入**

**目的**: ユーザー識別を可能にし、`request.auth.uid` を使えるようにする

**実装内容**:

1. **Firebase Auth の有効化**
   - Firebase Console で匿名認証を有効化
   - `src/shared/services/firebase.js` に `getAuth`, `signInAnonymously` を追加

2. **アプリ起動時の匿名サインイン**
   ```javascript
   import { getAuth, signInAnonymously } from 'firebase/auth';
   
   const auth = getAuth(app);
   await signInAnonymously(auth);
   ```

3. **Cloud Functions でのトークン発行時に認証**
   - LiveKit トークン発行時に、匿名認証済みか確認
   - 未認証の場合は匿名サインインを促す

**メリット**:
- Firestore ルールで `request.auth.uid` が使えるようになる
- ユーザーごとの操作を追跡可能

---

### **2-2. Cloud Functions 経由のデータ操作**

**目的**: サーバー側でバリデーションと権限チェックを行う

**実装する Functions**:

1. **ルーム作成**
   ```javascript
   exports.createRoom = onCall(async (request) => {
     // 認証チェック
     if (!request.auth) {
       throw new HttpsError('unauthenticated', 'ログインが必要です');
     }
     
     // バリデーション
     const { title } = request.data;
     if (!title || title.length > 50) {
       throw new HttpsError('invalid-argument', 'タイトルが不正です');
     }
     
     // Firestore に書き込み（Admin SDK 使用）
     const roomRef = await admin.firestore()
       .collection(`${DB_PREFIX}rooms`)
       .add({
         title,
         createdAt: admin.firestore.FieldValue.serverTimestamp(),
         hostId: request.auth.uid,
         // ...
       });
     
     return { roomId: roomRef.id };
   });
   ```

2. **ルーム削除（ホストのみ）**
   ```javascript
   exports.deleteRoom = onCall(async (request) => {
     if (!request.auth) {
       throw new HttpsError('unauthenticated', 'ログインが必要です');
     }
     
     const { roomId } = request.data;
     const roomDoc = await admin.firestore()
       .collection(`${DB_PREFIX}rooms`)
       .doc(roomId)
       .get();
     
     if (roomDoc.data().hostId !== request.auth.uid) {
       throw new HttpsError('permission-denied', 'ホストのみ削除可能です');
     }
     
     await admin.firestore()
       .collection(`${DB_PREFIX}rooms`)
       .doc(roomId)
       .delete();
   });
   ```

3. **参加者追加・削除**
   - 同様に Cloud Functions 経由で実装
   - 参加者数の上限チェックなどもサーバー側で実施

**メリット**:
- クライアント側のバリデーションをバイパスできない
- 権限チェックを一元管理
- レート制限やログ記録が容易

---

### **2-3. Firestore ルールでの権限判定強化**

**目的**: 認証導入後、ルール側でも権限チェックを実装

**実装内容**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ヘルパー関数: ホストかどうか
    function isHost(roomId) {
      let room = get(/databases/$(database)/documents/$(getRoomPath(roomId)));
      return room.data.hostId == request.auth.uid;
    }
    
    // ヘルパー関数: ルームパス取得
    function getRoomPath(roomId) {
      return 'dev_rooms/' + roomId;  // または prod_rooms
    }
    
    match /{prefix}_rooms/{roomId} {
      allow read: if true;
      
      allow create: if 
        request.auth != null &&
        request.resource.data.keys().hasAll(['title', 'createdAt']) &&
        // ... 既存のチェック ...
        request.resource.data.hostId == request.auth.uid;
      
      allow update: if 
        request.auth != null &&
        isHost(roomId) &&
        // ... フィールド制限 ...
      
      allow delete: if 
        request.auth != null &&
        isHost(roomId);
      
      match /participants/{participantId} {
        allow read: if true;
        
        allow create: if 
          request.auth != null &&
          // ... 既存のチェック ...
          request.resource.data.name is string;
        
        allow update: if 
          request.auth != null &&
          (participantId == request.auth.uid || isHost(roomId));
        
        allow delete: if 
          request.auth != null &&
          (participantId == request.auth.uid || isHost(roomId));
      }
    }
  }
}
```

---

### **2-4. レート制限と監査**

**目的**: スパムや不正アクセスを防ぐ

**実装内容**:

1. **Cloud Functions でのレート制限**
   ```javascript
   const rateLimitMap = new Map();
   
   exports.createRoom = onCall(async (request) => {
     const uid = request.auth.uid;
     const now = Date.now();
     const key = `createRoom:${uid}`;
     
     if (rateLimitMap.has(key)) {
       const lastCall = rateLimitMap.get(key);
       if (now - lastCall < 60000) {  // 1分に1回まで
         throw new HttpsError('resource-exhausted', 'レート制限に達しました');
       }
     }
     
     rateLimitMap.set(key, now);
     // ... ルーム作成処理 ...
   });
   ```

2. **ログ記録**
   - 重要な操作（ルーム作成・削除など）を Cloud Functions のログに記録
   - 必要に応じて Firestore に監査ログを保存

---

## 📋 推奨ワークフロー

### **フェーズ1: 緊急対応（今すぐ）**

1. ✅ `firestore.rules` で削除禁止を実装
2. ✅ 更新可能なフィールドを制限
3. ✅ バリデーション強化
4. ✅ TODO コメント追加
5. ✅ `firebase deploy --only firestore:rules` でデプロイ
6. ✅ 既存機能の動作確認

**注意**: 削除機能が使えなくなるため、必要に応じて UI 側で機能を一時的に無効化

---

### **フェーズ2: 認証導入（1-2週間以内）**

1. Firebase Auth（匿名認証）を有効化
2. アプリ起動時に匿名サインイン
3. Cloud Functions で認証チェックを追加
4. Firestore ルールで `request.auth != null` チェックを追加

---

### **フェーズ3: Cloud Functions 経由への移行（2-4週間以内）**

1. ルーム作成・削除を Cloud Functions 経由に変更
2. 参加者追加・削除を Cloud Functions 経由に変更
3. フロントエンドの `addDoc`, `deleteDoc` を `httpsCallable` に置き換え
4. Firestore ルールを Cloud Functions 経由のみ許可に変更

---

### **フェーズ4: 権限制御の強化（1ヶ月以内）**

1. ホスト権限チェックを Firestore ルールに追加
2. 参加者の更新・削除を本人またはホストのみに制限
3. レート制限の実装
4. 監査ログの整備

---

## 🧪 テスト手順

### **ステップ1のテスト**

```bash
# エミュレータでテスト
firebase emulators:start --only firestore

# 別ターミナルでテストスクリプト実行
# （削除が拒否されることを確認）
```

### **ステップ2以降のテスト**

1. 匿名認証が正常に動作するか確認
2. Cloud Functions 経由の操作が正常に動作するか確認
3. Firestore ルールで権限チェックが正常に動作するか確認

---

## ⚠️ 注意点

### **既知の制約**

1. **削除機能の一時的な無効化**
   - ステップ1で削除を禁止すると、退出処理などが動作しなくなる
   - Cloud Functions 実装まで、一時的に機能を無効化する必要がある

2. **パフォーマンスへの影響**
   - Security Rules のチェックで若干のレイテンシが増加（1-2ms程度）
   - ユーザー体験への影響は最小限

3. **将来の変更**
   - 認証導入時にルールを大幅に変更する必要がある
   - Cloud Functions 経由への移行時も、フロントエンドのコード変更が必要

---

## 📊 セキュリティレベルの変化

### **現在（Before）**

```
セキュリティレベル: ⭐️⭐️ （低）
- 必須フィールドチェック: ✅
- データ型バリデーション: ✅
- 更新制限: ❌
- 削除制限: ❌
- 認証: ❌
- 権限制御: ❌
```

### **ステップ1実施後（After Phase 1）**

```
セキュリティレベル: ⭐️⭐️⭐️ （中）
- 必須フィールドチェック: ✅
- データ型バリデーション: ✅
- 更新制限: ✅
- 削除制限: ✅
- 認証: ❌
- 権限制御: ❌
```

### **全ステップ実施後（After All Phases）**

```
セキュリティレベル: ⭐️⭐️⭐️⭐️⭐️ （最高）
- 必須フィールドチェック: ✅
- データ型バリデーション: ✅
- 更新制限: ✅
- 削除制限: ✅
- 認証: ✅
- 権限制御: ✅
- レート制限: ✅
- 監査ログ: ✅
```

---

## ✅ チェックリスト

### **フェーズ1: 緊急対応**

- [ ] `firestore.rules` で削除禁止を実装
- [ ] 更新可能なフィールドを制限
- [ ] バリデーション強化
- [ ] TODO コメント追加
- [ ] `firebase deploy --only firestore:rules` でデプロイ
- [ ] 既存機能の動作確認
- [ ] 削除機能の UI を一時的に無効化（必要に応じて）

### **フェーズ2: 認証導入**

- [ ] Firebase Auth（匿名認証）を有効化
- [ ] アプリ起動時に匿名サインイン
- [ ] Cloud Functions で認証チェックを追加
- [ ] Firestore ルールで `request.auth != null` チェックを追加

### **フェーズ3: Cloud Functions 経由への移行**

- [ ] ルーム作成を Cloud Functions 経由に変更
- [ ] ルーム削除を Cloud Functions 経由に変更
- [ ] 参加者追加・削除を Cloud Functions 経由に変更
- [ ] フロントエンドのコードを更新

### **フェーズ4: 権限制御の強化**

- [ ] ホスト権限チェックを Firestore ルールに追加
- [ ] 参加者の更新・削除を本人またはホストのみに制限
- [ ] レート制限の実装
- [ ] 監査ログの整備

---

## 🎉 まとめ

この改善計画により、段階的にセキュリティを強化しながら、既存機能への影響を最小限に抑えることができます。

**重要なポイント**:
- まずは `firestore.rules` だけでできる対応から開始
- 認証導入と Cloud Functions 経由への移行は、計画的に実施
- 各フェーズで十分なテストを実施

**次のステップ**:
1. フェーズ1の実装とデプロイ
2. 既存機能の動作確認
3. フェーズ2以降の計画を立てる

---

**レポート作成日:** 2025-11-15  
**最終更新日:** 2025-11-15  
**次回レビュー予定:** フェーズ1完了後

