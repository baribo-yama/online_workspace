# 期待される退出処理の挙動とフロー仕様

**作成日**: 2025-10-29
**目的**: AI開発における退出処理の理想的な挙動を定義し、バグ修正の基準とする  
**対象**: LiveKit + Firestore連携での参加者退出処理

---

## 📋 概要

この仕様は、3人以上の部屋で参加者が退出した際に**他の参加者のカメラが消失しない**ことを保証するための理想的な挙動を定義します。

---

## 🎯 期待される処理フロー

### 1. **正常退出（ユーザーが退出ボタンを押した場合）**

#### 1.1 退出処理の順序 ✅
```
1. ホスト権限移譲処理（ホストの場合のみ）
   ├── Firestore: 次のホストを選定・更新
   └── 残存参加者なし → ルーム削除

2. Firestore参加者削除
   ├── handleExplicitExit() 実行
   ├── 参加者ドキュメント削除
   └── localStorage クリーンアップ

3. LiveKit切断処理
   ├── localTracks 停止
   ├── room.disconnect() 実行
   └── 他参加者へ ParticipantDisconnected イベント送信

4. UI遷移
   └── ホームページに遷移
```

#### 1.2 各参加者での期待される挙動 ✅

**退出する参加者（Actor）:**
```
- Firestore参加者ドキュメント削除 ✅
- LiveKit接続切断 ✅
- ローカルビデオ・音声トラック停止 ✅
- UI遷移（ホームページ） ✅
```

**残存する参加者（Observer）:**
```
- ParticipantDisconnected イベント受信 ✅
- 退出した参加者のリソースクリーンアップ ✅
- 自分のカメラ・音声は継続表示 ✅ ← 最重要
- 参加者リスト更新（退出者を除外） ✅
```

---

## 🔧 技術的な期待される実装

### 2. **VideoCallRoom.jsx での期待される処理**

#### 2.1 ParticipantDisconnected イベントハンドラー ✅
```javascript
room.on(RoomEvent.ParticipantDisconnected, (participant) => {
  const disconnectedIdentity = participant.identity;
  
  // 1. 退出した参加者のリソースのみクリーンアップ
  cleanupAudioElement(disconnectedIdentity);
  
  // 2. 退出した参加者のトラック記録のみクリーンアップ
  const keysToDelete = Array.from(attachedTracksRef.current ?? [])
    .filter(key => key.startsWith(disconnectedIdentity));
  keysToDelete.forEach(key => attachedTracksRef.current?.delete(key));
  
  // 3. React状態を先に更新
  updateParticipants();
  
  // 4. DOM更新完了後に安全にビデオ要素参照を削除
  requestAnimationFrame(() => {
    if (!roomRef.current?.remoteParticipants.has(disconnectedIdentity)) {
      remoteVideoRefs.current.delete(disconnectedIdentity);
    }
  });
});
```

#### 2.2 JSXでのref管理 ✅
```javascript
// 期待される実装：JSXでの削除は禁止
ref={isLocal ? localVideoRef : (el) => {
  if (el) {
    remoteVideoRefs.current.set(participant.identity, el);
  }
  // else句での削除は禁止 - イベントハンドラーでのみ削除
}}
```

#### 2.3 updateParticipants 関数 ✅
```javascript
// 期待される実装：詳細な変更検知
const updateParticipants = useCallback(() => {
  // 参加者数の変更
  // 参加者IDの変更  
  // 接続状態の変更
  // トラック状態の変更
  // を全て検知して適切に状態更新
}, []);
```

---

## ⚠️ 禁止事項（実装してはいけない処理）

### 3.1 JSXでのビデオ要素削除 ❌
```javascript
// 禁止：React再レンダリング時に残存参加者も削除される
ref={(el) => {
  if (el) {
    remoteVideoRefs.current.set(participant.identity, el);
  } else {
    remoteVideoRefs.current.delete(participant.identity); // ❌ 禁止
  }
}}
```

### 3.2 即座削除→即座再レンダリング ❌
```javascript
// 禁止：DOM競合が発生する
remoteVideoRefs.current.delete(participant.identity); // ❌ 即座削除
updateParticipants(); // ❌ 即座再レンダリング
```

### 3.3 不適切な識別子混在 ❌
```javascript
// 禁止：識別子の不整合
Firestore: participantId = "abc123"
LiveKit:   identity = "田中太郎" // ❌ 異なる識別子
```

### 3.4 TrackUnsubscribedでのdetach処理欠如 ❌ ← 重大
```javascript
// 禁止：ビデオトラックのdetach処理なし（重大バグの原因）
room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
  if (track.kind === Track.Kind.Video) {
    updateParticipants(); // ❌ detach処理なしは禁止
  }
  // track.detach()なし ❌ ← 残存参加者のカメラ消失の直接原因
});
```

---

## 🧪 期待されるテスト結果

### 4. **カメラ消失バグのテストシナリオ**

#### 4.1 基本シナリオ ✅
```
前提条件:
- 参加者A（田中太郎A）: participantId="abc123"
- 参加者B（佐藤花子）: participantId="def456"  
- 参加者C（田中太郎B）: participantId="ghi789"

テスト手順:
1. 3人全員がビデオ通話に参加
2. 参加者Aが退出ボタンをクリック
3. 期待結果：
   ✅ 参加者Aのカメラが消える
   ✅ 参加者Bのカメラが継続表示
   ✅ 参加者Cのカメラが継続表示
   ✅ 参加者リストから参加者Aが削除
```

#### 4.2 同名参加者シナリオ ✅
```
前提条件:
- 参加者A（田中太郎）: participantId="abc123"
- 参加者B（田中太郎）: participantId="def456"
- 参加者C（佐藤花子）: participantId="ghi789"

テスト手順:
1. 3人全員がビデオ通話に参加（同名の田中太郎が2人）
2. 参加者A（田中太郎）が退出
3. 期待結果：
   ✅ 参加者A（田中太郎）のカメラが消える
   ✅ 参加者B（田中太郎）のカメラが継続表示 ← 重要
   ✅ 参加者C（佐藤花子）のカメラが継続表示
   ✅ 一意のparticipantIdにより正確に識別
```

---

## 🚨 バグの兆候（これらが発生したら実装に問題あり）

### 5. **検出すべき問題**

#### 5.1 カメラ消失の兆候 ❌
```
症状:
- 誰かが退出すると、他の参加者のカメラも消える
- ビデオ要素が黒画面になる
- "ビデオ要素が存在しません" ログが出力される

根本原因の可能性:
- JSXでのref削除による誤削除
- remoteVideoRefs の競合状態
- updateParticipants の判定ミス
- 識別子の不整合
```

#### 5.2 処理順序の問題 ❌
```
症状:
- コンソールログの順序が期待と異なる
- DOM更新前にビデオ要素が削除される
- React状態とLiveKit状態の不整合

根本原因の可能性:
- 非同期処理の競合
- requestAnimationFrame の未使用
- イベントハンドラーの処理順序ミス
```

---

## 📊 実装チェックリスト

### 6. **修正実装の確認項目**

#### 6.1 必須修正項目 ✅
- [ ] JSXでのref削除を禁止
- [ ] updateParticipants判定ロジック強化
- [ ] useEffect依存配列にmyParticipantId追加
- [ ] ParticipantDisconnectedでの安全な削除処理

#### 6.2 識別子統一項目 ✅
- [ ] generateParticipantIdentity使用
- [ ] myParticipantIdのprops連携
- [ ] LiveKit接続でparticipantId使用
- [ ] 既存generateParticipantNameからの移行

#### 6.3 テスト確認項目 ✅
- [ ] 3人以上での退出テスト
- [ ] 同名参加者での退出テスト
- [ ] リロード後の動作確認
- [ ] 複数回の入退室テスト

---

## 🎯 成功基準

### 7. **修正完了の判定基準**

#### 7.1 機能面 ✅
```
✅ 3人以上の部屋で誰かが退出しても他参加者のカメラが表示継続
✅ 同名参加者がいても正確に識別・処理
✅ ビデオトラックアタッチの成功率 100%
✅ リロード時の安定動作
```

#### 7.2 技術面 ✅
```
✅ コンソールエラーなし
✅ メモリリークなし
✅ Lintエラーなし
✅ ビルドエラーなし
```

#### 7.3 ログ出力 ✅
```
期待されるログフロー（デバッグモード）:
1. "参加者が切断されました: abc123"
2. "参加者数変更: 3 → 2"  
3. "ビデオ要素参照をクリーンアップしました: abc123"
4. エラーログなし
```

---

## 📝 AI開発者への指針

### 8. **このドキュメントの活用方法**

#### 8.1 バグ修正時 🔧
```
1. このドキュメントの「期待される処理フロー」を確認
2. 現在のコードと比較して差分を特定
3. 「禁止事項」に該当する実装がないかチェック
4. 「テストシナリオ」で動作確認
```

#### 8.2 新機能追加時 🚀
```
1. 既存の退出処理フローに影響しないか確認
2. 新機能が「期待される挙動」を損なわないか検証
3. 追加のテストケースを検討
```

#### 8.3 コードレビュー時 👀
```
1. 「実装チェックリスト」に基づく確認
2. 「バグの兆候」に該当する問題がないかチェック
3. 「成功基準」を満たしているか判定
```

---

**次回バグ発生時は、このドキュメントを基準として現状コードとの相違点を特定し、期待される挙動に合わせて修正を行ってください。**

---

**作成者**: AI Assistant  
**最終更新**: 2025-10-28  
**バージョン**: 1.0
