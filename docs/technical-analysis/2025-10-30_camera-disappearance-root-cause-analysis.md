# 退出時カメラ消失バグ 根本原因分析と対処法

**作成日**: 2025-10-30  
**バグID**: 退出時カメラ消失バグ  
**優先度**: Critical  
**状態**: 修正完了  
**影響範囲**: 3人以上のビデオ通話セッション

---

## 📋 バグ概要

### **症状**

3人以上のビデオ通話セッションで、いずれかの参加者が退出すると、**残存参加者のカメラ映像が不規則に消失する**バグが発生。

**具体的な症状**:
- 参加者A、B、Cが同じ部屋に入室（全員カメラON）
- 参加者Bが退出
- **問題**: 参加者Aの画面では参加者Cのカメラが見えるが、参加者Cの画面では参加者Aのカメラが見えない（一方向通信になる）

**再現条件**:
- **参加者数**: 3人以上
- **タイミング**: いずれかの参加者が退出した際
- **症状のパターン**: **不規則**（毎回異なる参加者のカメラが消える）
- **再現率**: 100%

---

## 🔍 根本原因分析

### **原因1: リモートトラックに対してstop()を呼んでいた** 🔴 **最重大**

**問題のコード**（修正前）:
```javascript
// attachVideoTrack関数内（1399-1408行目）
if (videoElement.srcObject) {
  const attachedVideoTracks = videoElement.srcObject.getVideoTracks();
  attachedVideoTracks.forEach(t => {
    t.stop(); // ❌ リモートトラックにもstop()を呼んでいた！
  });
  videoElement.srcObject = null;
}
```

**問題の詳細**:
- **`MediaStreamTrack.stop()`はローカルトラック専用のAPI**
- リモートトラックに対して`stop()`を呼ぶと、**LiveKitサーバー側でトラックが停止され、他の参加者にも影響を与える可能性がある**
- 退出時に新しいトラックをアタッチする際、古いトラックをクリアする過程で、**残存参加者のトラックも誤って停止していた**

**なぜ見落とされていたか**:
- 同じファイル内の`attachAudioTrack`関数（426-432行目）には「リモートトラックに対してstop()を呼ばないこと」という警告コメントがあったが、ビデオトラック処理には同様の注意書きがなかった
- ローカル・リモートの区別なく一律に`stop()`を呼んでいた

---

### **原因2: 退出後のリモートトラック再アタッチ処理で退出参加者も処理対象になっていた** 🔴 **重大**

**問題のコード**（修正前）:
```javascript
// useEffect（1546-1578行目）
useEffect(() => {
  if (!participants.length) return;

  participants.forEach(participant => {
    if (participant === localParticipant) return;
    
    // ❌ 退出した参加者のチェックがない！
    if (participant.videoTrackPublications) {
      for (const publication of participant.videoTrackPublications.values()) {
        if (publication.track && publication.isSubscribed) {
          attachVideoTrackRef.current(publication.track, participant, false);
          break;
        }
      }
    }
  });
}, [participants, localParticipant]);
```

**問題の詳細**:
1. `ParticipantDisconnected`イベント → `updateParticipants()` → `participants`状態更新
2. `participants`が更新されると、この`useEffect`が実行される
3. しかし、**退出した参加者も一時的に`participants`配列に残っている可能性がある**
4. `room.remoteParticipants`の存在確認がないため、退出した参加者のトラックを処理しようとしてエラーが発生したり、残存参加者のトラック処理が遅延したりする

---

### **原因3: JSX refコールバックで残存参加者のビデオ要素が誤って削除されていた** 🟡 **重大**

**問題のコード**（修正前）:
```javascript
// JSX refコールバック（1628-1645行目）
ref={isLocal ? localVideoRef : (el) => {
  if (el) {
    remoteVideoRefs.current.set(participant.identity, el);
  } else {
    // ❌ React再レンダリング時にel=nullが呼ばれ、残存参加者のrefが削除される！
    remoteVideoRefs.current.delete(participant.identity);
  }
}}
```

**問題の詳細**:
- React再レンダリング時に、`video`要素が一時的に`unmount`状態として評価される
- その際、`ref`コールバックの`el=null`が呼ばれる
- **残存参加者の要素も一時的に`el=null`として評価され、誤って削除されていた**

**ログから確認された証拠**:
```
[観測3] JSX ref delete実行: {deletedIdentity: 'user2', ...} // user2は残存参加者なのに削除された！
[観測3] JSX ref delete実行: {deletedIdentity: 'user2', ...} // 2回目の誤削除
```

---

### **原因4: LocalTrackPublishedイベントの重複登録** 🟡 **中程度**

**問題のコード**（修正前）:
```javascript
// connectToRoom内（886-915行目）
room.on(RoomEvent.LocalTrackPublished, (publication, participant) => {
  // ビデオトラックをアタッチ
  attachVideoTrackRef.current(publication.track, participant, true);
});

// useEffect内（1494-1537行目）
useEffect(() => {
  roomRef.current.on(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
  // 同じイベントを2回処理！
}, [localParticipant]);
```

**問題の詳細**:
- 同一イベントが2回処理される
- ローカルビデオトラックが重複アタッチされる可能性
- `attachedTracksRef`の記録が不整合になる

---

### **原因5: TrackUnsubscribedイベントでのdetach処理欠如** 🟡 **中程度**

**問題のコード**（修正前）:
```javascript
room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
  if (track.kind === Track.Kind.Video) {
    // ❌ track.detach()が呼ばれていない！
    setTimeout(() => {
      updateParticipants();
    }, TRACK_ATTACHMENT_DELAY);
  }
});
```

**問題の詳細**:
- LiveKitの`track.attach()`には必ず`track.detach()`が必要
- DOM要素にトラックが残存すると、新しいトラックアタッチ時に競合が発生

---

## 🔧 実装した修正

### **修正1: リモートトラックのstop()呼び出し削除** ⭐ **最重要**

```javascript
// 修正後（1398-1415行目）
// 既存のトラックをクリア
// 注意: リモートトラックに対してstop()を呼ばないこと
// stop()はローカルトラック専用で、リモートトラックに対して呼ぶと
// 他参加者のメディアにも影響を与える可能性がある
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

**効果**:
- ✅ 退出時に残存参加者のトラックが誤って停止されない
- ✅ LiveKitサーバー側でのトラック状態が正しく管理される

---

### **修正2: 退出参加者の処理をスキップ** ⭐ **重要**

```javascript
// 修正後（1553-1597行目）
useEffect(() => {
  if (!participants.length || !roomRef.current) return;

  participants.forEach(participant => {
    if (participant === localParticipant) return;
    
    // ✅ 退出した参加者は処理しない
    if (!roomRef.current.remoteParticipants.has(participant.identity)) {
      if (import.meta.env.DEV) {
        console.log('リモート参加者のビデオトラックアタッチスキップ: 参加者が既に退出', participant.identity);
      }
      return;
    }

    // 既存のビデオトラックをチェック
    if (participant.videoTrackPublications) {
      for (const publication of participant.videoTrackPublications.values()) {
        if (publication.track && publication.isSubscribed) {
          setTimeout(() => {
            // ✅ setTimeout内でも再度存在確認
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

**効果**:
- ✅ 退出した参加者のトラック処理がスキップされる
- ✅ 残存参加者のトラック処理が正しく実行される

---

### **修正3: JSX refコールバックでの削除処理削除** ⭐ **重要**

```javascript
// 修正後（1712-1725行目）
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
- ✅ 残存参加者の`remoteVideoRefs`が誤って削除されない
- ✅ React再レンダリング時に安全に動作

---

### **修正4: LocalTrackPublishedイベントの重複解消** 🟡 **改善**

```javascript
// 修正後（888-910行目）
// ローカルトラックが公開された時
// 注意: LocalTrackPublishedイベントはuseEffect（1494-1537行目）でも処理されるため、
// ここではオーディオトラックの音声レベル監視のみを処理
room.on(RoomEvent.LocalTrackPublished, (publication, participant) => {
  // ビデオトラックの処理はuseEffect内のハンドラーに任せる（重複を避ける）
  if (publication.kind === 'audio' && publication.track) {
    // オーディオトラックの音声レベル監視のみ処理
  }
});
```

**効果**:
- ✅ イベントハンドラーの重複が解消
- ✅ ローカルトラックの重複アタッチが防止

---

### **修正5: TrackUnsubscribedでのdetach処理追加** 🟡 **改善**

```javascript
// 修正後（980-1007行目）
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

---

### **修正6: remoteVideoRefs削除とupdateParticipants()のタイミング改善** 🟡 **改善**

```javascript
// 修正後（857-860行目）
// updateParticipants()もrequestAnimationFrame内で実行してReact再レンダリングとの競合を回避
requestAnimationFrame(() => {
  updateParticipants();
});
```

**効果**:
- ✅ DOM更新完了後に状態更新が実行される
- ✅ React再レンダリングとの競合が解消

---

## 📊 原因の優先度と影響

| 原因 | 優先度 | 退出時カメラ消失への影響 | 修正の重要度 |
|------|--------|------------------------|-------------|
| **原因1: リモートトラックstop()** | 🔴 Critical | 🔴 **直接的** | ⭐⭐⭐ 最優先 |
| **原因2: 退出参加者の処理** | 🔴 Critical | 🔴 **直接的** | ⭐⭐⭐ 最優先 |
| **原因3: JSX ref誤削除** | 🟡 High | 🔴 **直接的** | ⭐⭐ 重要 |
| **原因4: イベント重複** | 🟡 Medium | 🟡 間接的 | ⭐ 改善 |
| **原因5: detach処理欠如** | 🟡 Medium | 🟡 間接的 | ⭐ 改善 |

---

## 🎓 重要な教訓とベストプラクティス

### **1. リモートトラックにはstop()を呼ばない**

```javascript
// ❌ 悪い例
if (videoElement.srcObject) {
  attachedVideoTracks.forEach(t => {
    t.stop(); // リモートトラックにも呼んでしまう
  });
}

// ✅ 良い例
if (videoElement.srcObject) {
  if (isLocal) {
    // ローカルトラックのみstop()を呼ぶ
    attachedVideoTracks.forEach(t => {
      t.stop();
    });
  }
  // リモートトラックはsrcObjectをクリアするだけ
  videoElement.srcObject = null;
}
```

**理由**:
- `MediaStreamTrack.stop()`はローカルトラック専用
- リモートトラックに対して呼ぶと、他の参加者のメディアにも影響を与える可能性がある

---

### **2. JSX refコールバックでの削除処理は禁止**

```javascript
// ❌ 悪い例
ref={(el) => {
  if (el) {
    refs.current.set(key, el);
  } else {
    refs.current.delete(key); // React再レンダリング時に誤削除される！
  }
}}

// ✅ 良い例
ref={(el) => {
  if (el) {
    refs.current.set(key, el);
  }
  // else句での削除は禁止 - イベントハンドラーでのみ削除
}}
```

**理由**:
- React再レンダリング時に`el=null`が呼ばれるのは正常な動作
- 残存要素も一時的に`el=null`として評価される可能性がある
- 削除は明示的なイベントハンドラー（例: `ParticipantDisconnected`）でのみ実行

---

### **3. 退出参加者のチェックを必ず実施**

```javascript
// ❌ 悪い例
participants.forEach(participant => {
  // 退出した参加者も処理対象になってしまう
  processTrack(participant);
});

// ✅ 良い例
participants.forEach(participant => {
  // 退出した参加者は処理しない
  if (!roomRef.current.remoteParticipants.has(participant.identity)) {
    return;
  }
  processTrack(participant);
});
```

**理由**:
- `participants`状態の更新タイミングと`room.remoteParticipants`の更新タイミングが異なる可能性がある
- 退出後、一時的に`participants`配列に退出者が残っている場合がある

---

### **4. track.attach()には必ずtrack.detach()をセットで実装**

```javascript
// ✅ 良い例
room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
  if (track.kind === Track.Kind.Video) {
    const videoElement = remoteVideoRefs.current.get(participant.identity);
    if (videoElement && track) {
      try {
        track.detach(videoElement); // attachしたら必ずdetach
      } catch (error) {
        // エラーハンドリング
      }
    }
  }
});
```

**理由**:
- LiveKitのトラックライフサイクル管理のベストプラクティス
- DOM要素へのトラック残存による競合を防ぐ

---

### **5. イベントハンドラーの重複登録を防ぐ**

```javascript
// ❌ 悪い例
// connectToRoom内
room.on(RoomEvent.LocalTrackPublished, handler);
// useEffect内でも
room.on(RoomEvent.LocalTrackPublished, handler); // 重複！

// ✅ 良い例
// connectToRoom内: オーディオのみ処理
room.on(RoomEvent.LocalTrackPublished, (publication, participant) => {
  if (publication.kind === 'audio') {
    // オーディオ処理
  }
});
// useEffect内: ビデオのみ処理
useEffect(() => {
  const handler = (publication, participant) => {
    if (publication.kind === 'video') {
      // ビデオ処理
    }
  };
  room.on(RoomEvent.LocalTrackPublished, handler);
  return () => room.off(RoomEvent.LocalTrackPublished, handler);
}, [dependencies]);
```

**理由**:
- 同一イベントが2回処理されると、状態が不整合になる可能性がある
- 処理を明確に分離することで、保守性が向上

---

## 🔄 修正前後の比較

### **退出時の処理フロー**

**修正前** ❌:
```
1. ParticipantDisconnected イベント発火
2. トラック再アタッチ処理（退出参加者も処理対象に）
3. attachVideoTrack実行 → リモートトラックにもstop()呼び出し
   └→ 残存参加者のトラックが誤って停止！
4. React再レンダリング
   └→ JSX refコールバックで残存参加者のrefが誤削除
5. 結果: 残存参加者のカメラ映像が消失
```

**修正後** ✅:
```
1. ParticipantDisconnected イベント発火
2. 退出参加者のリソースクリーンアップ
   ├── cleanupAudioElement()
   ├── attachedTracksRef 削除（退出参加者分のみ）
   └── remoteVideoRefs削除（requestAnimationFrame内）
3. updateParticipants()実行（requestAnimationFrame内）
4. React再レンダリング
5. useEffect実行（残存参加者のトラック再アタッチ）
   └→ 退出参加者は処理スキップ ✅
   └→ リモートトラックにはstop()を呼ばない ✅
6. 結果: 残存参加者のカメラ映像が継続表示 ✅
```

---

## 📝 調査・修正の記録

### **調査プロセス**

1. **ログ分析による原因特定**
   - 観測ログを追加して、実際の実行順序を確認
   - `[観測3] JSX ref delete実行`で残存参加者の誤削除を発見

2. **コードレビューによる根本原因発見**
   - `attachAudioTrack`関数の警告コメントを発見
   - ビデオトラック処理にも同様の問題があることを確認

3. **包括的な修正実施**
   - 5つの原因を特定し、優先順位付けして修正
   - すべての修正が仕様書と整合していることを確認

### **関連ドキュメント**

- **調査レポート**: `docs/refactoring-reports/2025-10-30_camera-disappearance-on-exit-bug-investigation.md`
- **修正レポート**: `docs/refactoring-reports/2025-10-30_camera-disappearance-bug-fix.md`
- **問題点レポート**: `docs/technical-analysis/2025-10-30_videocallroom-critical-issues.md`
- **確認レポート**: `docs/technical-analysis/2025-10-30_fix-verification-report.md`
- **期待動作仕様**: `docs/technical-analysis/2025-10-29_expected-exit-behavior.md`

---

## ✅ 修正完了後の状態

### **動作確認項目**

- ✅ 3人以上の部屋で参加者1が退出
- ✅ 参加者1のカメラ映像が消える（正常）
- ✅ 参加者2,3のカメラ映像が継続表示される（修正目標達成）

### **期待される結果**

- ✅ 退出者Bの存在に関係なく、A ↔ C の映像は相互に見える
- ✅ 不規則なカメラ消失が発生しない
- ✅ すべての残存参加者が正常にビデオ通話を継続できる

---

## 🎯 今後の予防策

### **コードレビューチェックリスト**

- [ ] リモートトラックに対して`stop()`を呼んでいないか
- [ ] JSX refコールバックで削除処理をしていないか
- [ ] 退出参加者のチェックを実施しているか
- [ ] `track.attach()`と`track.detach()`がセットで実装されているか
- [ ] イベントハンドラーが重複登録されていないか

### **テスト項目**

- [ ] 3人以上の部屋で退出テスト
- [ ] 4人以上での退出テスト
- [ ] 複数回の退出テスト（連続退出）
- [ ] ホストが退出した場合のテスト
- [ ] リロード後の退出テスト

---

**作成日**: 2025-10-30  
**最終更新**: 2025-10-30  
**ステータス**: 修正完了、動作確認済み

