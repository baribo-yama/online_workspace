# VideoCallRoom.jsx 重大な問題点レポート

**作成日**: 2025-10-30  
**対象ファイル**: `src/features/video-call/components/VideoCallRoom.jsx`  
**調査目的**: 関数の重複と退出時カメラ消失バグの根本原因特定

---

## 🚨 **発見された重大な問題**

### **問題1: LocalTrackPublishedイベントの重複登録** 🔴 **Critical**

**場所**: 
- 886行目（`connectToRoom`内）
 uit 1494行目（`useEffect`内）

**問題の詳細**:
```javascript
// 1. connectToRoom内で登録（886-915行目）
room.on(RoomEvent.LocalTrackPublished, (publication, participant) => {
  // ローカルビデオトラックを即座にアタッチ
  setTimeout(() => {
    if (attachVideoTrackRef.current) {
      attachVideoTrackRef.current(publication.track, participant, true);
    }
  }, LOCAL_TRACK_ATTACHMENT_DELAY);
});

// 2. useEffect内でも登録（1494-1537行目）
useEffect(() => {
  if (!roomRef.current || !localParticipant) return;
  
  const handleLocalTrackPublished = (publication, participant) => {
    // リトライメカニズムでローカルトラックをアタッチ
    attachLocalVideoTrack();
  };
  
  roomRef.current.on(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
  
  return () => {
    roomRef.current.off(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
  };
}, [localParticipant]);
```

**影響**:
- 同一イベントが2回処理される
- ローカルビデオトラックが重複アタッチされる可能性
- `attachedTracksRef`の記録が不整合になる
- 不要な再レンダリングが発生

**修正方針**:
- `connectToRoom`内のハンドラーを削除し、`useEffect`内の実装のみを使用
- または、`useEffect`内のハンドラーを削除し、`connectToRoom`内の実装のみを使用（推奨）

---

### **問題2: リモートトラックに対してstop()を呼んでいる** 🔴 **Critical**

**場所**: 1400-1403行目

**問題のコード**:
```javascript
// 既存のトラックをクリア（ローカル・リモート両方）
if (videoElement.srcObject) {
  const attachedVideoTracks = videoElement.srcObject.getVideoTracks();
  attachedVideoTracks.forEach(t => {
    t.stop(); // ❌ リモートトラックにもstop()を呼んでいる！
  });
  videoElement.srcObject = null;
}
```

**問題の詳細**:
- **リモートトラックに対して`stop()`を呼ぶことは禁止されている**
- `stop()`はローカルトラック専用のAPI
- リモートトラックに対して`stop()`を呼ぶと、他の参加者のメディアにも影響を与える可能性がある
- ドキュメントの`attachAudioTrack`関数（426-432行目）でも同様の警告が記載されている

**正しい実装**:
```javascript
// 既存のトラックをクリア
if (videoElement.srcObject) {
  if (isLocal) {
    // ローカルトラックのみstop()を呼ぶ
    const attachedVideoTracks = videoElement.srcObject.getVideoTracks();
    attachedVideoTracks.forEach(t => {
      t.stop();
    });
  }
  // リモートトラックはstop()を呼ばず、srcObjectをクリアするだけ
  videoElement.srcObject = null;
}
```

**影響**:
- 退出者のトラックが正しくクリーンアップされない
- 残存参加者のトラックが誤って停止される可能性
- LiveKitサーバー側でのトラック状態が不整合になる

---

### **問題3: リモート参加者の既存トラック再アタッチのタイミング問題** 🟡 **High**

**場所**: 1546-1578行目

**問題の詳細**:
```javascript
useEffect(() => {
  if (!participants.length) return;

  participants.forEach(participant => {
    if (participant === localParticipant) return;
    
    if (participant.videoTrackPublications) {
      for (const publication of participant.videoTrackPublications.values()) {
        if (publication.track && publication.isSubscribed) {
          // リモートトラック用の遅延でアタッチ
          setTimeout(() => {
            if (attachVideoTrackRef.current && remoteVideoRefs.current.get(participant.identity)) {
              attachVideoTrackRef.current(publication.track, participant, false);
            }
          }, TRACK_ATTACHMENT_DELAY);
          break;
        }
      }
    }
  });
}, [participants, localParticipant]);
```

**問題点**:
1. **退出イベント後も再アタッチ処理が実行される**
   - `ParticipantDisconnected` → `updateParticipants()` → `participants`変更 → このuseEffect実行
   - しかし、退出した参加者のトラックも処理対象に含まれる可能性がある

2. **TrackSubscribedイベントとの競合**
   - `TrackSubscribed`（925-956行目）でも同じトラックをアタッチしている
   - これにより、同じトラックが2回アタッチされる可能性

3. **attachedTracksRefのチェック不備**
   - 退出後、`attachedTracksRef`には記録が残っているが、実際の`videoElement.srcObject`は空の場合がある
   - 修正後のコードではこのチェックが改善されているが、まだ不十分

**修正方針**:
- `publication.isSubscribed`を確認しているが、退出した参加者のトラックは既に`isSubscribed=false`になっているはず
- しかし、タイミングにより、`isSubscribed=true`のまま処理される可能性がある
- `room.remoteParticipants`に参加者が存在するかを確認してから処理する

---

### **問題4: TrackSubscribedとuseEffectでのリモートトラック処理の重複** 🟡 **Medium**

**場所**:
- TrackSubscribed: 925-956行目
- useEffect: 1546-1578行目

**問題の詳細**:
```javascript
// TrackSubscribedイベント（925-956行目）
room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
  if (track.kind === Track.Kind.Video && track) {
    setTimeout(() => {
      if (attachVideoTrackRef.current) {
        attachVideoTrackRef.current(track, participant, false);
      }
    }, TRACK_ATTACHMENT_DELAY);
  }
  setTimeout(() => {
    updateParticipants(); // ← participantsが変更される
  }, TRACK_ATTACHMENT_DELAY);
});

// useEffect（1546-1578行目）
useEffect(() => {
  participants.forEach(participant => {
    // 既存のビデオトラックをチェックしてアタッチ
    if (publication.track && publication.isSubscribed) {
      attachVideoTrackRef.current(publication.track, participant, false);
    }
  });
}, [participants, localParticipant]); // ← TrackSubscribedでupdateParticipants()が呼ばれると実行される
```

**影響**:
- 同じトラックが2回アタッチされようとする
- `attachedTracksRef`のチェックにより2回目はスキップされるが、不要な処理が発生

**修正方針**:
- `TrackSubscribed`でアタッチした後、`updateParticipants()`を呼ぶ必要があるか再検討
- または、`useEffect`での再アタッチ処理を削除し、`TrackSubscribed`のみを使用

---

### **問題5: 退出時のremoteVideoRefs削除タイミング** 🟡 **Medium**

**場所**: 832-855行目

**問題の詳細**:
```javascript
room.on(RoomEvent.ParticipantDisconnected, (participant) => {
  // ...
  
  requestAnimationFrame(() => {
    if (!roomRef.current?.remoteParticipants.has(participant.identity)) {
      remoteVideoRefs.current.delete(participant.identity);
    }
  });
  
  updateParticipants(); // ← 即座に実行される
});
```

**問題点**:
- `updateParticipants()`が即座に実行され、React再レンダリングが開始される
- `requestAnimationFrame`内で`remoteVideoRefs`が削除されるが、その前に再レンダリングが完了している可能性がある
- `useEffect`（1546-1578行目）が実行されるタイミングと、`remoteVideoRefs`削除のタイミングが競合する可能性

**修正方針**:
- `updateParticipants()`も`requestAnimationFrame`内で実行する
- または、`remoteVideoRefs`の削除を`updateParticipants()`の後に実行する

---

## 📊 **問題の優先度と影響**

| 問題 | 優先度 | 影響範囲 | 退出時カメラ消失への影響 |
|------|--------|----------|------------------------|
| **問題1: LocalTrackPublished重複** | 🔴 Critical | ローカルトラック | 🟡 間接的 |
| **問題2: リモートトラックstop()** | 🔴 Critical | リモートトラック | 🔴 **直接的** |
| **問題3: 既存トラック再アタッチ** | 🟡 High | リモートトラック | 🔴 **直接的** |
| **問題4: トラック処理重複** | 🟡 Medium | 全トラック | 🟡 間接的 |
| **問題5: remoteVideoRefs削除** | 🟡 Medium | リモートトラック | 🟡 間接的 |

---

## 🔧 **推奨される修正順序**

### **1. 即座に修正すべき問題（退出時カメラ消失に直接影響）**

1. **問題2: リモートトラックのstop()削除**
   - 最も重大な問題
   - 退出時に他の参加者のトラックが誤って停止される可能性

2. **問題3: 既存トラック再アタッチの改善**
   - 退出後のトラック再アタッチ処理を修正
   - `room.remoteParticipants`の存在確認を追加

### **2. 次に修正すべき問題（システム全体への影響）**

3. **問題1: LocalTrackPublished重複削除**
   - イベントハンドラーの重複を解消

4. **問題5: remoteVideoRefs削除タイミング改善**
   - React再レンダリングとの競合を解消

### **3. 最後に改善すべき問題（パフォーマンス）**

5. **問題4: トラック処理重複の最適化**
   - 不要な処理を削減

---

## 📝 **修正コード例**

### **修正1: リモートトラックのstop()削除（問題2）**

```javascript
// 修正前（1400-1408行目）
if (videoElement.srcObject) {
  const attachedVideoTracks = videoElement.srcObject.getVideoTracks();
  attachedVideoTracks.forEach(t => {
    t.stop(); // ❌
  });
  videoElement.srcObject = null;
}

// 修正後
if (videoElement.srcObject) {
  if (isLocal) {
    // ローカルトラックのみstop()を呼ぶ
    const attachedVideoTracks = videoElement.srcObject.getVideoTracks();
    attachedVideoTracks.forEach(t => {
      t.stop();
    });
  }
  // リモートトラックはstop()を呼ばず、srcObjectをクリアするだけ
  videoElement.srcObject = null;
  if (import.meta.env.DEV && !isLocal) {
    console.log('リモートビデオ要素の既存トラックをクリア:', participant.identity);
  }
}
```

### **修正2: 既存トラック再アタッチの改善（問題3）**

```javascript
// 修正前（1546-1578行目）
useEffect(() => {
  if (!participants.length) return;

  participants.forEach(participant => {
    if (participant === localParticipant) return;
    // 既存のビデオトラックをチェックしてアタッチ
    if (publication.track && publication.isSubscribed) {
      attachVideoTrackRef.current(publication.track, participant, false);
    }
  });
}, [participants, localParticipant]);

// 修正後
useEffect(() => {
  if (!participants.length || !roomRef.current) return;

  participants.forEach(participant => {
    if (participant === localParticipant) return;
    
    // 退出した参加者は処理しない
    if (!roomRef.current.remoteParticipants.has(participant.identity)) {
      return;
    }
    
    // 既存のビデオトラックをチェックしてアタッチ
    if (participant.videoTrackPublications) {
      for (const publication of participant.videoTrackPublications.values()) {
        if (publication.track && publication.isSubscribed) {
          // リモートトラック用の遅延でアタッチ（refを使用）
          setTimeout(() => {
            if (attachVideoTrackRef.current && 
                remoteVideoRefs.current.get(participant.identity) &&
                roomRef.current?.remoteParticipants.has(participant.identity)) {
              attachVideoTrackRef.current(publication.track, participant, false);
            }
          }, TRACK_ATTACHMENT_DELAY);
          break;
        }
      }
    }
  });
}, [participants, localParticipant]);
```

### **修正3: LocalTrackPublished重複削除（問題1）**

**推奨**: `connectToRoom`内のハンドラーを削除し、`useEffect`内の実装のみを使用

```javascript
// 削除対象（886-915行目）
// room.on(RoomEvent.LocalTrackPublished, (publication, moonshot) => {
//   // このイベントハンドラーを削除
// });

// useEffect内の実装（1494-1537行目）は維持
```

### **修正4: remoteVideoRefs削除タイミング改善（問題5）**

```javascript
// 修正前
room.on(RoomEvent.ParticipantDisconnected, (participant) => {
  // ...
  requestAnimationFrame(() => {
    remoteVideoRefs.current.delete(participant.identity);
  });
  updateParticipants(); // ← 即座実行
});

// 修正後
room.on(RoomEvent.ParticipantDisconnected, (participant) => {
  // ...
  requestAnimationFrame(() => {
    if (!roomRef.current?.remoteParticipants.has(participant.identity)) {
      remoteVideoRefs.current.delete(participant.identity);
    }
    // updateParticipants()もrequestAnimationFrame内で実行
    updateParticipants();
  });
});
```

---

## 🎯 **退出時カメラ消失バグへの影響**

### **直接的影響のある問題**

1. **問題2: リモートトラックのstop()呼び出し** 🔴
   - 退出時に、残存参加者のトラックが`stop()`により誤って停止される
   - これが**最も重大な原因**

2. **問題3: 既存トラック再アタッチのタイミング問題** 🔴
   - 退出後、`useEffect`が実行されても、退出した参加者のトラックを処理しようとする
   - `room.remoteParticipants`の存在確認がないため、誤処理が発生

### **間接的影響のある問題**

3. **問題1: LocalTrackPublished重複**
   - ローカルトラックの重複アタッチにより、`attachedTracksRef`の状態が不整合になる
   - 退出時に残存参加者のトラック再アタッチが正しく動作しない可能性

4. **問題5: remoteVideoRefs削除タイミング**
   - React再レンダリングと`remoteVideoRefs`削除の競合により、一時的にトラックがアタッチできない状態になる

---

## ✅ **修正完了後の期待効果**

1. **退出時カメラ消失バグの解消**
   - 残存参加者のトラックが正しく継続表示される

2. **トラック処理の一貫性向上**
   - 重複処理がなくなり、トラック状態が正確になる

3. **パフォーマンス向上**
   - 不要な処理が削減され、CPU使用率が低下

---

**調査完了日**: 2025-10-30  
**次ステップ**: 上記修正を順次適用して動作確認

<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>
read_file
