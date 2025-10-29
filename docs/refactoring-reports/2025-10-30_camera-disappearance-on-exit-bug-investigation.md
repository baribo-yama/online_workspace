# 退出時カメラ消失バグ調査報告書

**作成日**: 2025-10-30  
**報告者**: AI Assistant  
**バグカテゴリ**: VideoCallRoom 退出処理  
**優先度**: Critical  
**ステータス**: 調査中（原因特定・検証フェーズ）

---

## 🚨 バグ概要

### **症状**
3人以上の部屋で参加者1が退出すると、残存参加者（参加者2,3）側で**他人のカメラ映像（track）が不規則に消える**バグが発生する。

### **発生条件**
- **参加者数**: 3人以上
- **タイミング**: いずれかの参加者が退出した際
- **影響範囲**: 残存参加者（退出者以外）のカメラ映像
- **症状のパターン**: **不規則**（毎回異なる参加者のカメラが消える）

### **再現性**
- **再現率**: 100%（確実に再現）
- **消失タイミング**: **即座に消える**（退出直後）
- **発生環境**: 
  - ✅ 同一PCの別ブラウザで同時アクセス
  - ✅ 異なるPCでのアクセス
  - 両環境で同様に発生

---

## 🔍 症状の詳細分析

### **観察された挙動**
```
前提条件:
- 参加者A, B, C が3人でビデオ通話中
- 全員カメラON状態

発生シーケンス:
1. 参加者Aが退出ボタンをクリック
2. 参加者Aのカメラ映像が消える（正常）
3. **同時に、参加者BまたはCのカメラ映像も消える（異常）**
   - 毎回消える参加者が異なる（不規則）
   - 時にはBのみ、時にはCのみ、時には両方
```

### **影響を受ける処理フロー**
1. **Firestore**: 退出者のparticipantドキュメント削除
2. **LiveKit**: ParticipantDisconnectedイベント発生
3. **LiveKit**: TrackUnsubscribedイベント発生
4. **React**: 参加者リスト更新による再レンダリング
5. **DOM**: ビデオ要素の参照管理

---

## 📋 原因候補の整理

### **カテゴリA: LiveKit イベント・トラック管理**

#### **A1測: TrackUnsubscribed での detach 処理欠如** 🔴 **高優先度**

**現状のコード**:
```javascript
room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
  if (track.kind === Track.K bers.Video) {
    setTimeout(() => {
      updateParticipants(); // ← detach処理なし
    }, TRACK_ATTACHMENT_DELAY);
  }
});
```

**発生メカニズム**:
```
参加者1退出 → TrackUnsubscribed(A1) → detachなし
→ A1のトラックがDOM要素（videoElement.srcObject）に残存
→ 残存参加者（B, C）の新規トラックアタッチ時に競合
→ track.attach()が既存トラックと競合し、不規則な消失
```

**重要度**: ⭐⭐⭐ **高**  
**確認箇所**: `src/features/video-call/components/VideoCallRoom.jsx` (878-899行目)

---

#### **A2: ParticipantDisconnected での即座削除による競合** 🔴 **高優先度**

**現状のコード**:
```javascript
room.on(RoomEvent.ParticipantDisconnected, (participant) => {
  cleanupAudioElement(participant.identity);
  const keysToDelete = Array.from(attachedTracksRef.current ?? [])
    .filter(key => key.startsWith(participant.identity));
  keysToDelete.forEach(key => attachedTracksRef.current?.delete(key));
  
  remoteVideoRefs.current.delete(participant.identity); // ← 即座削除
  updateParticipants(); // ← React再レンダリング
});
```

**発生メカニズム**:
```
ParticipantDisconnected(A1) 
→ remoteVideoRefs.delete(A1) 即座実行
→ updateParticipants() 実行 → React再レンダリング開始
→ 他の参加者のvideo要素も再評価される
→ React再レンダリング中にremoteVideoRefs操作が競合
→ 残存参加者の参照が誤って削除される可能性
```

**重要度**: ⭐⭐⭐ **高**  
**確認箇所**: `src/features/video-call/components/VideoCallRoom.jsx` (762-777行目)

**過去の修正履歴**:
- 以前は `requestAnimationFrame` を使用してDOM更新後に削除していた
- 現在のコードでは即座削除に戻されている

---

#### **A3: JSX ref コールバックでの誤削除** 🔴 **極高優先度**

**現状のコード**:
```javascript
<video
  ref={isLocal ? localVideoRef : (el) => {
    if (el) {
      remoteVideoRefs.current.set(participant.identity, el);
    } else {
      remoteVideoRefs.current.delete(participant.identity); // ← 問題箇所
    }
  }}
/>
```

**発生メカニズム**:
```
ParticipantDisconnected(A1) → updateParticipants() → React再レンダリング
→ participants.map() 実行
→ 参加者B, Cのvideo要素が一時的にunmount状態として評価される可能性
→ React の再レンダリング中、要素の再マウント処理でel=nullが一時的に渡される
→ ref(el=null, participantB.identity) 実行
→ remoteVideoRefs.delete(B) 誤削除 ← カメラ消失の直接原因
→ 参加者Bのカメラ映像が消える
```

**重要度**: ⭐⭐⭐⭐ **極高**（不規則消失の主原因候補）  
**確認箇所**: `src/features/video-call/components/VideoCallRoom.jsx` (1535-1541行目)

**過去の修正履歴**:
- 以前は `else` 句での削除を禁止していた
- 現在のコードでは `else` 句での削除が復活している

---

#### **A4: TrackUnsubscribed と ParticipantDisconnected の実行順序不確定**

**問題点**:
- LiveKitイベントの到達順序が不確定
- クリーンアップ処理が複数回実行され、競合する可能性

**発生メカニズム**:
```
Case 1: TrackUnsubscribed → ParticipantDisconnected（正常順序）
Case 2: ParticipantDisconnected → TrackUnsubscribed（逆順）
→ 2回目のクリーンアップが他の参加者に影響を与える可能性
```

**重要度**: ⭐⭐ **中**  
**確認箇所**: 両イベントハンドラーの実行順序ログ

---

### **カテゴリB: React 状態管理・再レンダリング**

#### **B1: updateParticipants() の簡略化による変更検知不全** 🟡 **中優先度**

**現状のコード**:
```javascript
const updateParticipants = useCallback(() => {
  const allParticipants = [...].filter(p => p);
  
  setParticipants(prevParticipants => {
    if (prevParticipants.length !== allParticipants.length) {
      return allParticipants;
    }
    
    const prevIds = prevParticipants.map(p => p.identity).sort();
    const newIds = allParticipants.map(p => p.identity).sort();
    if (JSON.stringify(prevIds) !== JSON.stringify(newIds)) {
      return allParticipants;
    }
    
    return prevParticipants; // ← 変更検知ロジックが簡略化されている
  });
}, []);
```

**問題点**:
- 以前は `connectionState` や `videoTrackPublications` の変更も検知していた
- 現在は参加者数とIDの変更のみ検知
- トラック状態の変更が検知されない可能性

**重要度**: ⭐⭐ **中**  
**確認箇所**: `src/features/video-call/components/VideoCallRoom.jsx` (357-381行目)

---

#### **B2: attachedTracksRef のクリーンアップ範囲**

**現状のコード**:
```javascript
const keysToDelete = Array.from(attachedTracksRef.current ?? [])
  .filter(key => key.startsWith(participant.identity));
```

**潜在的問題**:
- `startsWith` の条件により、identityが似た参加者のキーを誤削除する可能性
- ただし、participantIdの設計次第で発生しない可能性もある

**重要度**: ⭐ **低**（identity設計次第）  
**確認箇所**: `src/features/video-call/components/VideoCallRoom掛x` (770行目)

---

### **カテゴリC: Firestore 同期タイミング**

#### **C1: Firestore と LiveKit の状態不整合**

**問題点**:
- Firestore削除がLiveKit切断より先に実行される
- 他の参加者が「参加者1は既にいない」と認識し、誤ったクリーンアップを実行

**発生メカニズム**:
```
useRoomActions.leaveRoom() 
→ Firestore: participant削除（即座）
→ LiveKit: disconnect()（非同期・遅延）
→ 他参加者が「参加者1は既にいない」と認識
→ Firestore onSnapshot で参加者リスト更新
→ 誤ったクリーンアップ実行
```

**重要度**: ⭐⭐ **中**  
**確認箇所**: `src/features/study-room/hooks/room/useRoomActions.js`

---

## 🔬 確認すべき観測ポイント

### **観測ポイント1: LiveKit イベントの到達順序と頻度**

**観測箇所**:
- `ParticipantDisconnected` イベントハンドラー（762行目）
- `TrackUnsubscribed` イベントハンドラー（878行目）

**確認項目**:
```
1. ParticipantDisconnected が何回呼ばれるか（退出者1回のみか？）
2. TrackUnsubscribed が何回呼ばれるか（退出者のトラック数のみか？）
3. 両者の到達順序（ParticipantDisconnected → TrackUnsubscribed か逆か）
4. 残存参加者（2,3）の identity が誤って渡されていないか
```

**想定される分岐パターン**:
```
パターン1: ParticipantDisconnected正常だが、TrackUnsubscribedなし
→ トラッククリーンアップ不完全（A1問題）

パターン2: ParticipantDisconnectedが複数回（退出者+残存者）
→ 誤ったidentityでクリーンアップ（A2問題）

パターン3: TrackUnsubscribedが参加者2,3にも発火
→ LiveKit側で誤った非購読イベント送信（A4問題）

パターン4: 正常（退出者1回のみ、順序も正常）
→ React側の問題（A3/B1/B2）
```

---

### **観測ポイント2: remoteVideoRefs の削除操作**

**観測箇所**:
- `ParticipantDisconnected` 内（774行目）
- JSX ref コールバック（1539行目）
- `updateParticipants` 実行時

**確認項目**:
```
1. remoteVideoRefs.current.delete() が何回実行されるか
2. 削除される identity リスト（退出者のみか、残存者も含むか）
3. 削除タイミング（ParticipantDisconnected時 / React再レンダリング時）
4. remoteVideoRefs.current のサイズ変化
```

**想定される分岐パターン**:
```
パターン1: 退出者1回のみ削除 → 正常
→ 他の原因を調査（B1/B2/C1）

パターン2: 残存参加者も削除される
→ JSX refの誤削除（A3）またはParticipantDisconnectedの誤発火（A2）

パターン3: 削除後に再セットされるが、タイミングがずれる
→ React再レンダリング競合（A2/A3）
```

---

### **観測ポイント3: React 再レンダリング時の ref コールバック**

**観測箇所**:
- JSX ref コールバック（1535-1540行目）
- `participants.map()` 実行時

**確認項目**:
```
1. ref(el=null) が呼ばれる回数（参加者数分のみか？）
2. el=null が呼ばれる identity リスト
3. 呼び出しタイミング（ParticipantDisconnected直後 / updateParticipants後）
4. remoteVideoRefs の削除が正しい参加者のみに限られているか
```

**想定される分岐パターン**:
```
パターン1: el=null が退出者のみ
→ 正常、JSX ref問題なし（他の原因）

パターン2: el=null が残存参加者にも呼ばれる
→ React再レンダリング時の誤評価（A3確定）

パターン3: el=null が呼ばれるが、deleteは実行されない（条件分岐で阻止）
→ 正常な動作
```

---

### **観測ポイント4: attachedTracksRef のクリーンアップ**

**観測箇所**:
- `TrackUnsubscribed` 内のクリーンアップ（現状なし）
- `ParticipantDisconnected` 内の keysToDelete フィルタ（770行目）

**確認項目**:
```
1. keysToDelete に含まれるキーリスト
2. filter(key => key.startsWith(participant.identity)) の結果
3. 残存参加者の trackId が誤って含まれないか
4. attachedTracksRef.current のサイズ変化
```

**想定される分岐パターン**:
```
パターン1: 退出者のキーのみ削除
→ 正常、attachedTracksRef問題なし

パターン2: 残存参加者のキーも誤って削除
→ identity の衝突またはフィルタ条件の問題（B2確定）

パターン3: キーは正しいが、削除タイミングが早すぎる
→ TrackUnsubscribed未発火時に削除（A1問題）
```

---

### **観測ポイント5: updateParticipants() の状態更新**

**観測箇所**:
- `updateParticipants` 関数（357行目）
- `setParticipants` の呼び出し結果

**確認項目**:
```
1. updateParticipants() が呼ばれる回数
2. prevParticipants と allParticipants の差分
3. 状態更新が実際に発生するか（return値の変更）
4. ビデオトラックの再アタッチが発生するか
```

**想定される分岐パターン**:
```
パターン1: 状態が正しく更新されるが、ビデオが消える
→ トラックアタッチの問題（A1/A3）

パターン2: 状態が更新されない（prevParticipants === allParticipants）
→ 変更検知ロジックの問題（B1確定）

パターン3: 状態更新後に再レンダリングが発生しない
→ React最適化によるスキップ（B1問題）
```

---

## 🎯 想定される複合シナリオ

### **シナリオ1: JSX ref 誤削除（A3）が主原因** 🔴 **最有力**

```
ParticipantDisconnected(A1) 
→ updateParticipants() → React再レンダリング
→ participants.map() で参加者2,3も再評価
→ video要素が一時的にunmount状態として評価
→ ref(el=null, participant2.identity) consolidation実行
→ remoteVideoRefs.delete(A2) 誤削除
→ 参加者2のカメラ消失
```

**観測結果の予想**:
- 観測ポイント3で「残存参加者にもel=null」を確認
- 観測ポイント2で「remoteVideoRefsに残存参加者のidentityも含まれる」を確認

---

### **シナリオ2: TrackUnsubscribed 不備（A1）+ 即座削除（A2）の複合**

```
ParticipantDisconnected(A1) → remoteVideoRefs.delete(A1) 即座実行
→ TrackUnsubscribed(A1) → detach処理なし
→ A1のトラックがDOM（videoElement.srcObject）に残存
→ 残存参加者（B, C）のトラックアタッチ時に競合
→ track.attach()が既存トラックと競合し、不規則な消失
```

**観測結果の予想**:
- 観測ポイント1で「TrackUnsubscribedにdetach処理がない」を確認
- 観測ポイント2で「即座削除が実行 Among」を確認
- 観測ポイント4で「attachedTracksRefから退出者のトラックが残存」を確認

---

### **シナリオ3: ParticipantDisconnected 誤発火（A2）**

```
LiveKitサーバー側のバグ？またはクライアント側の認識ミス
→ ParticipantDisconnected(A2) が誤って発火
→ remoteVideoRefs.delete(A2) 実行
→ 参加者2のカメラ消失
```

**観測結果の予想**:
- 観測ポイント1で「ParticipantDisconnectedが残存参加者にも発火」を確認
- 観測ポイント2で「残存参加者のidentityでdeleteが実行される」を確認

---

## 📝 次のステップ：検証ログ追加

### **ログ追加箇所と内容**

#### **ログ1: イベント到達順序とidentity**

**追加箇所**: `ParticipantDisconnected` イベントハンドラー（762行目）

```javascript
room.on(RoomEvent.ParticipantDisconnected, (participant) => {
  console.log('[観測1] ParticipantDisconnected:', {
    timestamp: Date.now(),
    disconnectedIdentity: participant.identity,
    allRemoteParticipants: Array.from(room.remoteParticipants.keys()),
    attachedTracksBefore: Array.from(attachedTracksRef.current),
    remoteVideoRefsBefore: Array.from(remoteVideoRefs.current.keys())
  });
  
  // 既存の処理...
});
```

**追加箇所**: `TrackUnsubscribed` イベントハンドラー（878行目）

```javascript
room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
  console.log('[観測1] TrackUnsubscribed:', {
    timestamp: Date.now(),
    participantIdentity: participant.identity,
    trackKind: track.kind,
    trackSid: track.sid,
    allRemoteParticipants: Array.from(room.remoteParticipants.keys())
  });
  
  // 既存の処理...
});
```

---

#### **ログ2: remoteVideoRefs 操作**

**追加箇所**: `ParticipantDisconnected` 内（774行目）

```javascript
const beforeDelete = Array.from(remoteVideoRefs.current.keys());
remoteVideoRefs.current.delete(participant.identity);
const afterDelete = Array.from(remoteVideoRefs.current.keys());

console.log('[観測2] remoteVideoRefs削除操作:', {
  timestamp: Date.now(),
  operation: 'delete',
  deletedIdentity: participant.identity,
  beforeDelete,
  afterDelete,
  allParticipants: participants.map(p => p.identity)
});
```

---

#### **ログ3: JSX ref コールバック**

**追加箇所**: JSX ref コールバック（1535-1540行目）

```javascript
ref={isLocal ? localVideoRef : (el) => {
  console.log('[観測3] JSX ref callback:', {
    timestamp: Date.now(),
    el: el ? 'exists' : 'null',
    participantIdentity: participant.identity,
    isLocal,
    allParticipants: participants.map(p => p.identity),
    remoteVideoRefsSize: remoteVideoRefs.current.size,
    remoteVideoRefsKeys: Array.from(remoteVideoRefs.current.keys())
  });
  
  if (el) {
    remoteVideoRefs.current.set(participant.identity, el);
  } else {
    const beforeDelete = Array.from(remoteVideoRefs.current.keys());
    remoteVideoRefs.current.delete(participant.identity);
    const afterDelete = Array.from(remoteVideoRefs.current.keys());
    
    console.log('[観測3] JSX ref delete実行:', {
      timestamp: Date.now(),
      deletedIdentity: participant.identity,
      beforeDelete,
      afterDelete
    });
  }
}}
```

---

#### **ログ4: attachedTracksRef クリーンアップ**

**追加箇所**: `ParticipantDisconnected` 内（770-771行目）

```javascript
const keysBefore = Array.from(attachedTracksRef.current);
const keysToDelete = Array.from(attachedTracksRef.current ?? [])
  .filter(key => key.startsWith(participant.identity));
const keysAfter = keysBefore.filter(key => !keysToDelete.includes(key));

console.log('[観測4] attachedTracksRefクリーンアップ:', {
  timestamp: Date.now(),
  participantIdentity: participant.identity,
  keysBefore,
  keysToDelete,
  keysAfter,
  allParticipants: participants.map(p => p.identity)
});

keysToDelete.forEach(key => attachedTracksRef.current?.delete(key));
```

---

#### **ログ5: updateParticipants 状態更新**

**追加箇所**: `updateParticipants` 関数内（365-381行目）

```javascript
const updateParticipants = useCallback(() => {
  if (!roomRef.current) return;

  const prevParticipants = participants; // 現在のstateを取得（useStateは非同期のため注意）
  const allParticipants = [
    roomRef.current.localParticipant,
    ...Array.from(roomRef.current.remoteParticipants.values())
  ].filter(p => p);

  console.log('[観測5] updateParticipants呼び出し:', {
    timestamp: Date.now(),
    prevCount: prevParticipants.length,
    newCount: allParticipants.length,
    prevIds: prevParticipants.map(p => p.identity),
    newIds: allParticipants.map(p => p.identity),
    willUpdate: prevParticipants.length !== allParticipants.length || 
                JSON.stringify(prevParticipants.map(p => p.identity).sort()) !== 
                JSON.stringify(allParticipants.map(p => p.identity).sort())
  });

  // 既存の処理...
}, []);
```

---

## 📊 検証フロー

### **ステップ1: ログ追加**
上記の検証ログをコードに追加

### **ステップ2: テスト実行**
1. 3人でビ朴通話開始
2. 参加者1が退出
3. コンソールログを保存

### **ステップ3: ログ分析**
各観測ポイントの結果を分析し、想定される分岐パターンと照合

### **ステップ4: 原因特定**
観測結果から原因候補を特定

### **ステップ5: 修正実装**
原因に応じた修正を実装

---

##有种 **優先度別の修正方針**

### **最優先修正（観測結果が判明次第）**

1. **A3: JSX ref 誤削除**（極高優先度）
   - `else` 句での削除処理を削除
   - `ParticipantDisconnected` イベントでのみ削除

2. **A1: TrackUnsubscribed での detach 処理追加**（高優先度）
   - `track.detach(videoElement)` を実行
   - `attachedTracksRef` からも削除

3. **A2: 即座削除の遅延化**（高優先度）
   - `requestAnimationFrame` を使用してDOM更新後に削除

### **次優先修正（観測結果により判断）**

4. **B1: updateParticipants の変更検知強化**（中優先度）
5. **A4: イベント順序の制御**（中優先度）
6. **C1: Firestore-LiveKit同期改善**（中優先度）

---

## 📚 参考資料

- `docs/technical-analysis/2025-10-29_expected-exit-behavior.md`: 期待される退出処理の挙動
- `docs/refactoring-reports/2025-10-29_camera-disappearance-comprehensive-fix.md`: 過去の修正履歴

---

## ⚠️ 注意事項

### **今回の調査で修正しない理由**
- **多点・同時多発の可能性**: 複数の原因が複合している可能性
- **確実な原因特定**: 推測ではなく、検証ログに基づく確実な原因特定が必要
- **副作用の回避**: 推測による修正が新たなバグを生む可能性

### **次のアクション**
1. 検証ログを追加
2. テスト実行とログ収集
3. ログ分析による原因特定
4. 原因に基づく修正実装

---

## 🧪 テスト項目設定

### **テスト環境準備**

#### **前提条件**
- 開発サーバーを起動（`npm run dev`）
- ブラウザのコンソールを開いてログを確認できる状態にする
- **開発モード（DEV=true）で実行**すること（ログが出力されるため）

#### **テスト用デバイス**
- **パターンA**: 同一PCの異なるブラウザ（Chrome + Firefox + Edgeなど）
- **パターンB**: 異なるPC（ノートPC + デスクトップなど）
- **推奨**: 最低3つのデバイス/ブラウザタブを準備

---

### **テストシナリオ**

#### **テストケース1: 基本退出シナリオ**

**目的**: 参加者1が退出した際のイベント到達とクリーンアップ動作を確認

**手順**:
1. 参加者A, B, C の3人でビデオ通話を開始
2. 全員がカメラONの状態を確認
3. 参加者Aが退出ボタンをクリック
4. **参加者B, Cのブラウザコンソールでログを確認**

**確認項目**:
- [ ] `[観測1] ParticipantDisconnected` が1回のみ実行される（参加者Aのidentityのみ）
- [ ] `[観測1] TrackUnsubscribed` が参加者Aのトラック数のみ実行される
- [ ] `[観測2] remoteVideoRefs削除操作` で参加者Aのidentityのみ削除される
- [ ] `[観測3] JSX ref callback` で `el=null` が参加者Aのみに実行される
- [ ] `[観測4] attachedTracksRefクリーンアップ` で参加者Aのキーのみ削除される

**期待結果**:
- ✅ 参加者Aのカメラ映像が消える（正常）
- ✅ 参加者B, Cのカメラ映像が継続表示される（正常）
- ✅ ログに異常な削除操作が記録されない

---

#### **テストケース2: イベント到達順序の確認**

**目的**: ParticipantDisconnected と TrackUnsubscribed の到達順序を確認

**手順**:
1. テストケース1と同じ手順
2. **タイムスタンプを確認**してイベント到達順序を記録

**確認項目**:
- [ ] `[観測1] ParticipantDisconnected` のタイムスタンプ
- [ ] `[観測1] TrackUnsubscribed` のタイムスタンプ
- [ ] 両者の到達順序（通常は `ParticipantDisconnected` → `TrackUnsubscribed`）

**期待結果**:
- ✅ イベントが期待される順序で到達する
- ✅ タイムスタンプの差が妥当（通常数ミリ秒以内）

---

#### **テストケース3: 残存参加者のカメラ消失確認**

**目的**: バグが実際に発生するか確認し、ログから原因を特定

**手順**:
1. テストケース1と同じ手順
2. **参加者BまたはCのカメラが消えた場合**、その時点のログを確認

**確認項目**:
- [ ] **カメラが消えた参加者のidentity**
- [ ] `[観測2] remoteVideoRefs削除操作` でその参加者のidentityが誤って削除されていないか
- [ ] `[観測3] JSX ref delete実行` でその参加者のidentityが誤って削除されていないか
- [ ] `[観測1] ParticipantDisconnected` がその参加者にも発火していないか

**期待される問題パターン**:

**パターンA: JSX ref誤削除（A3問題）**:
```
[観測3] JSX ref callback: { el: 'null', participantIdentity: '参加者B' }
[観測3] JSX ref delete実行: { deletedIdentity: '参加者B' } ← 問題箇所
```

**パターンB: ParticipantDisconnected誤発火（A2問題）**:
```
[観測1] ParticipantDisconnected: { disconnectedIdentity: '参加者B' } ← 誤発火
[観測2] remoteVideoRefs削除操作: { deletedIdentity: '参加者B' }
```

**パターンC: TrackUnsubscribed誤発火（A4問題）**:
```
[観測1] TrackUnsubscribed: { participantIdentity: '参加者B' } ← 誤発火
```

---

#### **テストケース4: 複数回退出テスト**

**目的**: バグの再現性と不規則性を確認

**手順**:
1. 参加者A, B, C, D の4人でビデオ通話を開始
2. 参加者Aが退出 → ログ確認
3. 残存参加者で再度ビデオ通話を続行
4. 参加者Bが退出 → ログ確認
5. これを5回繰り返す

**確認項目**:
- [ ] 各退出時にどの参加者のカメラが消えたか
- [ ] ログパターンの一貫性
- [ ] バグの再現率（5回中何回発生）

**期待結果**:
- ✅ ログから一貫したパターンを確認できる
- ✅ 原因候補が特定できる

---

#### **テストケース5: updateParticipants 状態更新確認**

**目的**: 状態更新が正しく行われているか確認

**手順**:
1. テストケース1と同じ手順
2. `[観測5] updateParticipants` のログを確認

**確認項目**:
- [ ] `prevCount` と `newCount` の値（3 → 2）
- [ ] `prevIds` と `newIds` の差分（参加者Aが削除されている）
- [ ] `willUpdate` が `true` になっている
- [ ] 状態更新が確定しているか（`状態更新確定` ログが出力される）

**期待結果**:
- ✅ 状態更新が正しく実行される
- ✅ 参加者リストから退出者が削除される

---

### **ログ収集方法**

#### **ブラウザコンソールでのログ収集**

1. **Chrome DevTools の場合**:
   - F12キーでDevToolsを開く
   - 「Console」タブを選択
   - 「Filter」で `[観測` と入力してフィルタリング
   - ログを右クリック → 「Save as...」で保存

2. **Firefox Developer Tools の場合**:
   - F12キーでDevToolsを開く
   - 「コンソール」タブを選択
   - 「フィルター」で `[観測` と入力
   - ログをコピーしてテキストファイルに保存

#### **推奨ログ収集方法**

```javascript
// コンソールで実行（全ての観測ログを記録）
const logs = [];
const originalLog = console.log;
console.log = function(...args) {
  if (args[0] && typeof args[0] === 'string' && args[0].includes('[観測')) {
    logs.push({
      timestamp: Date.now(),
      args: args
    });
  }
  originalLog煲(...args);
};

// テスト完了後、ログを保存
// logs をコピーしてJSONファイルとして保存
JSON.stringify(logs, null, 2);
```

---

### **ログ分析チェックリスト**

テスト実行後、以下のチェックリストを使用してログを分析してください。

#### **分析ポイント1: イベント到達順序**

- [ ] `ParticipantDisconnected` が1回のみ（退出者のみ）
- [ ] `TrackUnsubscribed` が適切な回数（退出者のトラック数のみ）
- [ ] イベントが期待される順序で到達

#### **分析ポイント2: remoteVideoRefs削除**

- [ ] 削除されるidentityが退出者のみ
- [ ] 残存参加者のidentityが削除されていない
- [ ] 削除タイミングが適切

#### **分析ポイント3: JSX ref操作**

- [ ] `el=null` が退出者のみに実行される
- [ ] 残存参加者で `JSX ref delete実行` が発生していない
- [ ] refコールバックの実行タイミングが適切

#### **分析ポイント4: attachedTracksRefクリーンアップ**

- [ ] 削除されるキーが退出者のトラックのみ
- [ ] 残存参加者のトラックキーが誤って削除されていない
- [ ] `startsWith` フィルタが正しく機能している

#### **分析ポイント5: 状態更新**

- [ ] `updateParticipants` が正しく呼ばれる
- [ ] 状態更新が確定している
- [ ] 参加者リストが正しく更新されている

---

### **テスト結果報告テンプレート**

テスト実行後、以下のテンプレートを使用して結果を報告してください。

```markdown
## テスト結果報告

**実施日**: YYYY-MM-DD
**テストケース**: ケース1-5
**環境**: 同一PC/異なるPC

### テストケース1: 基本退出シナリオ
- 結果: ✅ 成功 / ❌ 失敗
- カメラ消失の有無: 有 / 無
- 消失した参加者: 参加者B / 参加者C / 両方

### 観測ログ分析結果

**[観測1] イベント到達順序**:
- ParticipantDisconnected: [回数] 回
- TrackUnsubscribed: [回数] 回
- 順序: [順序]

**[観測2] remoteVideoRefs削除**:
- 削除されたidentity: [リスト]
- 問題: [有/無] - [詳細]

**[観測3] JSX ref操作**:
- el=nullが呼ばれた参加者: [リスト]
- JSX ref deleteが実行された参加者: [リスト]
- 問題: [有/無] - [詳細]

**[観測4] attachedTracksRefクリーンアップ**:
- 削除されたキー: [リスト]
- 問題: [有/無] - [詳細]

**[観測5] 状態更新**:
- 状態更新: [成功/失敗]
- 問題: [有/無] - [詳細]

### 原因候補の特定
- **推定原因**: [A1/A2/A3/A4/B1/B2/C1]
- **根拠**: [ログから確認できた証拠]
- **次のアクション**: [修正方針]
```

---

### **次ステップ**

1. **ログ追加完了** ✅
2. **テスト実行**: 上記テストケースを実施
3. **ログ分析**: チェックリストを使用して分析
4. **原因特定**: 分析結果から原因を特定
5. **修正実装**: 原因に基づいて修正

---

**作成者**: AI Assistant  
**ステータス**: 検証ログ追加完了（テスト実行待ち）  
**次回更新**: テスト結果とログ分析結果をもとに原因特定と修正実装

