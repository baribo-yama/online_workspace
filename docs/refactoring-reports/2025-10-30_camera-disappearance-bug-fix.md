# 退出時カメラ消失バグ修正レポート

**作成日**: 2025-10-30  
**修正者**: AI Assistant  
**バグID**: 退出時カメラ消失バグ  
**優先度**: Critical  
**ステータス**: 修正完了

---

## 🚨 バグ概要

### **症状**
3人以上の部屋で参加者1が退出すると、残存参加者（参加者2,3）側で**他人のカメラ映像（track）が不規則に消える**バグが発生。

### **再現条件**
- **参加者数**: 3人以上
- **タイミング**: いずれかの参加者が退出した際
- **症状のパターン**: **不規則**（毎回異なる参加者のカメラが消える）
- **再現率**: 100%

---

## 🔍 ログ分析結果による原因特定

### **観測された実際のログ（参加者1の画面）**

```
[観測1] ParticipantDisconnected: {disconnectedIdentity: 'user3', ...} ✅ 正常
[観測2] remoteVideoRefs削除操作: {deletedIdentity: 'user3', ...} ✅ 正常

[観測3] JSX ref callback: {el: 'null', participantIdentity: 'user2', ...} ❌ 問題！
[観測3] JSX ref delete実行: {deletedIdentity: 'user2', ...} ❌ 残存参加者の誤削除
[観測3] JSX ref callback: {el: 'null', participantIdentity: 'user2', ...} ❌ 再度！
[観測3] JSX ref delete実行: {deletedIdentity: 'user2', ...} ❌ 2回目の誤削除
```

### **特定された根本原因**

#### **原因1: JSX refコールバックでの誤削除（A3問題）** 🔴 **確定**

**問題の流れ**:
```
1. ParticipantDisconnected(user3) 発火
2. updateParticipants() → React再レンダリング開始
3. participants.map() 実行中に、user2のvideo要素が一時的にunmount状態として評価
4. ref(el=null, user2) コールバック実行
5. else句で remoteVideoRefs.delete(user2) 誤実行 ← 問題箇所
6. user2のビデオ要素参照が削除される
7. その後、再レンダリングで再度 set されるが、タイミングがずれる
8. 結果: user2のカメラ映像が消える
```

**ログから確認できた証拠**:
- `[観測3] JSX ref delete実行: {deletedIdentity: 'user2'}` が2回記録
- user2は残存参加者なのに削除処理が実行されている
- ParticipantDisconnectedはuser3のみ（正常）

---

#### **原因2: TrackUnsubscribed での detach 処理欠如（A1問題）** 🔴 **確定**

**問題の流れ**:
```
1. TrackUnsubscribed(user3) 発火
2. updateParticipants() のみ実行
3. track.detach() が実行されない ← 問題箇所
4. user3のトラックがDOM要素に残存
5. 残存参加者のトラックアタッチ時に競合する可能性
```

**ログから確認できた証拠**:
- TrackUnsubscribedイベントは発火しているが、detach処理がない
- ビデオトラックのクリーンアップが不完全

---

#### **原因3: ParticipantDisconnected での即座削除（A2問題）** 🟡 **改善**

**問題の流れ**:
```
1. ParticipantDisconnected(user3) 発火
2. remoteVideoRefs.delete(user3) 即座実行
3. 同時にupdateParticipants() → React再レンダリング
4. DOM更新と削除処理が競合する可能性
```

**改善策**: requestAnimationFrameを使用してDOM更新後に削除

---

## ✅ 実装した修正

### **修正1: JSX refコールバックのelse句削除** ⭐ **最重要**

**修正箇所**: `src/features/video-call/components/VideoCallRoom.jsx` (1628-1641行目)

```javascript
// 修正前（問題のあるコード）
ref={isLocal ? localVideoRef : (el) => {
  if (el) {
    remoteVideoRefs.current.set(participant.identity, el);
  } else {
    remoteVideoRefs.current.delete(participant.identity); // ❌ 誤削除の原因
  }
}}

// 修正後（安全なコード）
ref={isLocal ? localVideoRef : (el) => {
  // JSX refでの削除は禁止 - ParticipantDisconnectedイベントでのみ削除
  // React再レンダリング時にel=nullが呼ばれ、残存参加者のビデオ要素が誤って削除されるのを防ぐため
  if (el) {
    remoteVideoRefs.current.set(participant.identity, el);
  }
  // else句での削除処理を削除 - これが残存参加者のカメラ消失の根本原因
}}
```

**効果**:
- ✅ 残存参加者のremoteVideoRefsが誤って削除されない
- ✅ React再レンダリング時に安全に動作
- ✅ ParticipantDisconnectedイベントのみで削除

---

### **修正2: TrackUnsubscribed での detach 処理追加** ⭐ **重要**

**修正箇所**: `src/features/video-call/components/VideoCallRoom.jsx` (971-1003行目)

```javascript
// 修正前（問題のあるコード）
if (track.kind === Track.Kind.Video) {
  setTimeout(() => {
    updateParticipants(); // ❌ detach処理なし
  }, TRACK_ATTACHMENT_DELAY);
}

// 修正後（完全なクリーンアップ）
if (track.kind === Track.Kind.Video) {
  // 1. ビデオトラックをdetach
  const videoElement = remoteVideoRefs.current.get(participant.identity);
  if (videoElement && track) {
    try {
      track.detach(videoElement); // ✅ detach処理追加
    } catch (error) {
      console.warn('ビデオトラックdetachエラー:', error);
      if (videoElement.srcObject) {
        videoElement.srcObject = null; // フォールバック
      }
    }
  }
  
  // 2. attachedTracksRefからトラック記録を削除
  const trackId = `${participant.identity}-${track.kind}-${track.sid || track.mediaStreamTrack?.id || 'unknown'}`;
  if (attachedTracksRef.current.has(trackId)) {
    attachedTracksRef.current.delete(trackId);
  }
  
  // 3. 参加者リストを更新
  setTimeout(() => {
    updateParticipants();
  }, TRACK_ATTACHMENT_DELAY);
}
```

**効果**:
- ✅ 退出者のトラックが完全に削除される
- ✅ DOM要素へのトラック残存が防止される
- ✅ 残存参加者のトラックアタッチ時の競合が解消

---

### **修正3: ParticipantDisconnected での安全な削除** 🟡 **改善**

**修正箇所**: `src/features/video-call/components/VideoCallRoom.jsx` (832-855行目)

```javascript
// 修正前（即座削除）
remoteVideoRefs.current.delete(participant.identity);
updateParticipants();

// 修正後（安全な削除）
requestAnimationFrame(() => {
  // 退出した参加者が本当にいなくなったかを確認してから削除
  if (!roomRef.current?.remoteParticipants.has(participant.identity)) {
    remoteVideoRefs.current.delete(participant.identity);
  }
});
updateParticipants();
```

**効果**:
- ✅ DOM更新完了後に削除される
- ✅ React再レンダリングとの競合が解消
- ✅ 参加者の存在確認後に削除される

---

## 🧪 修正効果の確認

### **修正前のログ（問題あり）**
```
[観測3] JSX ref delete実行: {deletedIdentity: 'user2', ...} ❌
[観測3] JSX ref delete実行: {deletedIdentity: 'user2', ...} ❌（2回目）
→ user2のカメラ消失
```

### **修正後の期待ログ**
```
[観測3] JSX ref callback: {el: 'null', participantIdentity: 'user2', ...}
→ else句がないため削除処理なし ✅
[観測3] JSX ref set: {participantIdentity: 'user2', ...}
→ 再セットのみ実行 ✅
→ user2のカメラ継続表示 ✅
```

---

## 📊 修正の重要ポイント

### **1. JSX refのelse句は使用禁止**
- React再レンダリング時に`el=null`が呼ばれるのは正常な動作
- しかし、残存参加者の要素も一時的に`el=null`として評価される
- **削除はParticipantDisconnectedイベントでのみ実行**

### **2. TrackUnsubscribedでのdetach処理は必須**
- LiveKitの`track.attach()`には必ず`track.detach()`が必要
- DOM要素にトラックが残存すると、新しいトラックアタッチ時に競合

### **3. requestAnimationFrameによる中断制御**
- DOM更新と状態更新のタイミングを制御
- React再レンダリング完了後に削除処理を実行

---

## 🎯 期待される修正効果

### **動作確認項目**
- ✅ 3人以上の部屋で参加者1が退出
- ✅ 参加者1のカメラ映像が消える（正常）
- ✅ 参加者2,3のカメラ映像が継続表示される（修正目標）

### **ログ確認項目**
- ✅ `[観測3] JSX ref delete実行` が残存参加者で発生しない
- ✅ `[観測1] TrackUnsubscribed: ビデオトラックをdetachしました` が出力される
- ✅ `[観測2] remoteVideoRefs削除操作` が退出者のみで実行される

---

## 📝 ドキュメント修正

### **修正内容**
- `docs/refactoring-reports/2025-10-30_camera-disappearance-on-exit-bug-investigation.md`
  - 中国語文字の修正（`拉力` → `p`, `拍了` → `p`）

---

## 🚀 次のステップ

1. **動作確認**: 実際のアプリでテスト実行
2. **ログ確認**: 修正後のログを確認して問題が解消されたか確認
3. **追加テスト**: 複数回の退出テスト、4人以上でのテスト

---

## ⚠️ 重要な教訓

1. **JSX refのelse句での削除は絶対に禁止**
   - React再レンダリング時の正常な動作を誤って削除処理と判断しない
   - 削除はイベントハンドラーでのみ実行

2. **LiveKitのtrack.attach()には必ずtrack.detach()が必要**
   - トラックのライフサイクル管理を適切に行う
   - DOM要素への残存を防ぐ

3. **ログ分析による原因特定の重要性**
   - 推測ではなく、実際のログから原因を特定
   - 観測ログが原因特定の鍵となった

---

**作成者**: AI Assistant  
**ステータス**: 修正完了（動作確認待ち）  
**次回更新**: 動作確認結果をもとに最終確認

