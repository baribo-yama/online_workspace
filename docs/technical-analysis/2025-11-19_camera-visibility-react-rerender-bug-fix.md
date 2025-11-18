# カメラ表示バグ修正レポート: React再描画問題

**作成日**: 2025-11-19  
**バグID**: カメラ表示バグ（React再描画問題）  
**優先度**: High  
**状態**: 修正完了  
**影響範囲**: ビデオ通話中の全参加者

---

## 📋 バグ概要

### **症状**

カメラをONにしているのに、相手の画面ではカメラ映像が表示されない問題が発生。

**具体的な症状**:
- 参加者AがカメラをONにする
- 参加者Aの画面では自分のカメラ映像が表示される
- **問題**: 参加者Bの画面では参加者Aのカメラ映像が表示されない
- カメラは実際にはONになっているが、相手の画面に反映されない

**再現条件**:
- **タイミング**: カメラのON/OFF切り替え時
- **発生パターン**: ローカル参加者のカメラON/OFF時、リモート参加者のカメラON/OFF時
- **再現率**: 100%（カメラ切り替え時に常に発生）

---

## 🔍 根本原因分析

### **原因1: ローカル参加者のカメラON/OFF時に`updateParticipants()`が呼ばれていない** 🔴 **最重要**

**問題のコード**（修正前）:
```javascript
// src/features/video-call/components/VideoCallRoom.jsx (1231-1248行目)
const toggleVideo = useCallback(async () => {
  if (!roomRef.current || !roomRef.current.localParticipant) {
    console.error("ルームまたはローカル参加者が存在しません");
    return;
  }

  try {
    const newVideoState = !isVideoEnabled;
    await roomRef.current.localParticipant.setCameraEnabled(newVideoState);
    setIsVideoEnabled(newVideoState);
    // ❌ updateParticipants()が呼ばれていない！
    
    if (import.meta.env.DEV) {
      console.log("カメラ状態切り替え:", newVideoState);
    }
  } catch (error) {
    console.error("カメラ切り替えエラー:", error);
  }
}, [isVideoEnabled]);
```

**問題の詳細**:
1. `toggleVideo`関数で`setCameraEnabled`を呼び出すと、LiveKit側でカメラ状態が変更される
2. `LocalTrackPublished`イベントが発火し、`handleLocalTrackPublished`関数でビデオトラックがアタッチされる
3. しかし、`updateParticipants()`が呼ばれていないため、`participants` stateが更新されない
4. リモート参加者の画面では、レンダリング時に`participant.videoTrackPublications`をチェックしているが、`participants`配列が更新されていないため、Reactの再描画が発生しない
5. 結果として、リモート参加者の画面ではカメラ状態の変更が反映されない

**レンダリング時の判定ロジック**（1940-1956行目）:
```javascript
// カメラが有効かどうかを判定
const hasActiveCamera = isLocal
  ? isVideoEnabled  // ローカル参加者: stateを参照
  : (() => {
      // リモート参加者: videoTrackPublicationsをチェック
      if (
        participant.videoTrackPublications &&
        participant.videoTrackPublications.size > 0
      ) {
        for (const publication of participant.videoTrackPublications.values()) {
          if (publication.isSubscribed && publication.track) {
            return true;
          }
        }
      }
      return false;
    })();
```

リモート参加者の画面では`participant.videoTrackPublications`を参照しているため、`participants`配列が更新されないと再描画が発生しない。

---

### **原因2: `LocalTrackPublished`イベントハンドラーで`updateParticipants()`が呼ばれていない** 🔴 **重要**

**問題のコード**（修正前）:
```javascript
// src/features/video-call/components/VideoCallRoom.jsx (1657-1729行目)
const handleLocalTrackPublished = (publication, participant) => {
  if (
    publication.kind === "video" &&
    publication.track &&
    participant.identity === localParticipant.identity
  ) {
    // ビデオトラックをアタッチ
    attachLocalVideoTrack();
    // ❌ updateParticipants()が呼ばれていない！
  }
};
```

**問題の詳細**:
- ローカルビデオトラックが公開された時、ビデオトラックはアタッチされるが、`updateParticipants()`が呼ばれない
- リモート参加者の画面では、`participants`配列が更新されないため、再描画が発生しない

---

### **原因3: `TrackSubscribed`イベントハンドラーで`updateParticipants()`が遅延実行されている** 🟡 **中程度**

**問題のコード**（修正前）:
```javascript
// src/features/video-call/components/VideoCallRoom.jsx (977-1016行目)
room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
  // ビデオトラックの処理
  if (track.kind === Track.Kind.Video && track) {
    setTimeout(() => {
      attachVideoTrackRef.current(track, participant, false);
    }, TRACK_ATTACHMENT_DELAY);
  }

  // 参加者リストの更新
  setTimeout(() => {
    updateParticipants(); // ❌ 遅延実行されている！
  }, TRACK_ATTACHMENT_DELAY);
});
```

**問題の詳細**:
- リモート参加者のカメラがONになった時、`TrackSubscribed`イベントが発火する
- `updateParticipants()`が`setTimeout`で遅延実行されているため、即座に再描画が発生しない
- ユーザー体験が悪化する

---

### **原因4: `TrackUnsubscribed`イベントハンドラーで`updateParticipants()`が遅延実行されている** 🟡 **中程度**

**問題のコード**（修正前）:
```javascript
// src/features/video-call/components/VideoCallRoom.jsx (1018-1094行目)
room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
  if (track.kind === Track.Kind.Video) {
    // ビデオトラックをdetach
    track.detach(videoElement);
    
    // 参加者リストを更新
    setTimeout(() => {
      updateParticipants(); // ❌ 遅延実行されている！
    }, TRACK_ATTACHMENT_DELAY);
  }
});
```

**問題の詳細**:
- リモート参加者のカメラがOFFになった時、`TrackUnsubscribed`イベントが発火する
- `updateParticipants()`が`setTimeout`で遅延実行されているため、即座に再描画が発生しない

---

## ✅ 実装した修正

### **修正1: `toggleVideo`関数内で`updateParticipants()`を呼び出す** ⭐ **最重要**

**修正箇所**: `src/features/video-call/components/VideoCallRoom.jsx` (1231-1253行目)

```javascript
const toggleVideo = useCallback(async () => {
  if (!roomRef.current || !roomRef.current.localParticipant) {
    console.error("ルームまたはローカル参加者が存在しません");
    return;
  }

  try {
    const newVideoState = !isVideoEnabled;
    await roomRef.current.localParticipant.setCameraEnabled(newVideoState);
    setIsVideoEnabled(newVideoState);
    
    // ✅ 参加者情報を更新してReactの再描画を発生させる
    // LiveKit側の参加者情報が変わったことをReactに反映させる
    // リモート参加者の画面でも、ローカル参加者のvideoTrackPublicationsの変更を検知できるようにする
    updateParticipants();

    if (import.meta.env.DEV) {
      console.log("カメラ状態切り替え:", newVideoState);
    }
  } catch (error) {
    console.error("カメラ切り替えエラー:", error);
  }
}, [isVideoEnabled, updateParticipants]); // ✅ 依存配列にupdateParticipantsを追加
```

**効果**:
- ✅ ローカル参加者がカメラをON/OFFした時、即座に`updateParticipants()`が呼ばれる
- ✅ `participants` stateが更新され、リモート参加者の画面でも再描画が発生する
- ✅ リモート参加者の画面で、ローカル参加者のカメラ状態が即座に反映される

---

### **修正2: `handleLocalTrackPublished`関数内で`updateParticipants()`を呼び出す** ⭐ **重要**

**修正箇所**: `src/features/video-call/components/VideoCallRoom.jsx` (1657-1740行目)

```javascript
const handleLocalTrackPublished = (publication, participant) => {
  if (
    publication.kind === "video" &&
    publication.track &&
    participant.identity === localParticipant.identity
  ) {
    const attachLocalVideoTrack = (retryCount = 0, maxRetries = 3) => {
      setTimeout(() => {
        if (attachVideoTrackRef.current) {
          try {
            attachVideoTrackRef.current(
              publication.track,
              participant,
              true
            );
            // ✅ ビデオトラックアタッチ成功後に参加者情報を更新
            // リモート参加者の画面でも、ローカル参加者のvideoTrackPublicationsの変更を検知できるようにする
            updateParticipants();
          } catch (error) {
            // エラーハンドリング
          }
        }
      }, delay);
    };
    attachLocalVideoTrack();
  }
};
```

**useEffectの依存配列も更新**:
```javascript
}, [localParticipant, updateParticipants]); // ✅ updateParticipantsを依存配列に追加
```

**効果**:
- ✅ ローカルビデオトラックがアタッチされた後、`updateParticipants()`が呼ばれる
- ✅ リモート参加者の画面でも、ローカル参加者のカメラ状態が即座に反映される

---

### **修正3: `TrackSubscribed`イベントハンドラーで`updateParticipants()`を即座に実行** ⭐ **重要**

**修正箇所**: `src/features/video-call/components/VideoCallRoom.jsx` (977-1020行目)

```javascript
room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
  // ビデオトラックの処理
  if (track.kind === Track.Kind.Video && track) {
    // ビデオトラックをアタッチ
    setTimeout(() => {
      if (attachVideoTrackRef.current) {
        attachVideoTrackRef.current(track, participant, false);
      }
    }, TRACK_ATTACHMENT_DELAY);
    
    // ✅ 参加者情報を即座に更新してReactの再描画を発生させる
    // setTimeoutで遅延させると、リモート参加者のカメラ状態変更が即座に反映されない
    updateParticipants();
  }

  // 音声トラックの処理
  if (track.kind === Track.Kind.Audio && track) {
    attachAudioTrack(track, participant);
    // 音声トラックの場合も参加者リストを更新（従来通り遅延実行）
    setTimeout(() => {
      updateParticipants();
    }, TRACK_ATTACHMENT_DELAY);
  }
});
```

**効果**:
- ✅ リモート参加者のカメラがONになった時、即座に`updateParticipants()`が呼ばれる
- ✅ 他の参加者の画面でも、リモート参加者のカメラ状態が即座に反映される
- ✅ ユーザー体験が向上する

---

### **修正4: `TrackUnsubscribed`イベントハンドラーで`updateParticipants()`を即座に実行** ⭐ **重要**

**修正箇所**: `src/features/video-call/components/VideoCallRoom.jsx` (1018-1097行目)

```javascript
room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
  if (track.kind === Track.Kind.Video) {
    // 1. ビデオトラックをdetach
    track.detach(videoElement);
    
    // 2. attachedTracksRefからトラック記録を削除
    // ...
    
    // ✅ 3. 参加者リストを即座に更新してReactの再描画を発生させる
    // setTimeoutで遅延させると、リモート参加者のカメラ状態変更が即座に反映されない
    updateParticipants();
  }
});
```

**効果**:
- ✅ リモート参加者のカメラがOFFになった時、即座に`updateParticipants()`が呼ばれる
- ✅ 他の参加者の画面でも、リモート参加者のカメラ状態が即座に反映される

---

## 📊 修正前後の比較

### **修正前の動作フロー** ❌

**ローカル参加者がカメラをONにする場合**:
```
1. toggleVideo() → setCameraEnabled(true)
2. LocalTrackPublishedイベント発火
3. handleLocalTrackPublished() → ビデオトラックをアタッチ
4. ❌ updateParticipants()が呼ばれない
5. participants stateが更新されない
6. ❌ リモート参加者の画面で再描画が発生しない
7. ❌ リモート参加者の画面ではカメラ映像が表示されない
```

**リモート参加者がカメラをONにする場合**:
```
1. リモート参加者がsetCameraEnabled(true)
2. TrackSubscribedイベント発火
3. ビデオトラックをアタッチ
4. setTimeout(() => updateParticipants(), TRACK_ATTACHMENT_DELAY)
5. ⏱️ 遅延後にparticipants stateが更新される
6. ⏱️ 遅延後に再描画が発生する
7. ⏱️ ユーザー体験が悪い
```

### **修正後の動作フロー** ✅

**ローカル参加者がカメラをONにする場合**:
```
1. toggleVideo() → setCameraEnabled(true)
2. ✅ updateParticipants()が即座に呼ばれる
3. participants stateが更新される
4. ✅ リモート参加者の画面で即座に再描画が発生する
5. LocalTrackPublishedイベント発火
6. handleLocalTrackPublished() → ビデオトラックをアタッチ
7. ✅ updateParticipants()が再度呼ばれる（念のため）
8. ✅ リモート参加者の画面ではカメラ映像が即座に表示される
```

**リモート参加者がカメラをONにする場合**:
```
1. リモート参加者がsetCameraEnabled(true)
2. TrackSubscribedイベント発火
3. ✅ updateParticipants()が即座に呼ばれる
4. ✅ participants stateが即座に更新される
5. ✅ 他の参加者の画面で即座に再描画が発生する
6. ビデオトラックをアタッチ（setTimeout内）
7. ✅ 他の参加者の画面ではカメラ映像が即座に表示される
```

---

## 🎯 修正の効果

### **動作確認項目**

- ✅ ローカル参加者がカメラをON/OFFした時、リモート参加者の画面で即座に反映される
- ✅ リモート参加者がカメラをON/OFFした時、他の参加者の画面で即座に反映される
- ✅ カメラ状態の変更が全参加者の画面で同期される
- ✅ ユーザー体験が向上する

### **期待される結果**

- ✅ カメラをONにすると、全参加者の画面で即座にカメラ映像が表示される
- ✅ カメラをOFFにすると、全参加者の画面で即座にカメラ映像が非表示になる
- ✅ カメラ状態の変更が即座に反映される

---

## 🔍 このバグに遭遇したときのチェックポイント

### **1. Reactのstate更新を確認する** ⭐ **最重要**

**チェック項目**:
- [ ] カメラ状態変更時に`updateParticipants()`が呼ばれているか
- [ ] `participants` stateが更新されているか
- [ ] `useCallback`の依存配列に必要な関数が含まれているか

**確認方法**:
```javascript
// デバッグ用のログを追加
const updateParticipants = useCallback(() => {
  console.log('[DEBUG] updateParticipants called');
  // ...
}, []);

// toggleVideo関数内で
const toggleVideo = useCallback(async () => {
  // ...
  updateParticipants();
  console.log('[DEBUG] toggleVideo: updateParticipants called');
}, [isVideoEnabled, updateParticipants]);
```

---

### **2. LiveKitイベントハンドラーを確認する** ⭐ **重要**

**チェック項目**:
- [ ] `LocalTrackPublished`イベントハンドラーで`updateParticipants()`が呼ばれているか
- [ ] `TrackSubscribed`イベントハンドラーで`updateParticipants()`が呼ばれているか
- [ ] `TrackUnsubscribed`イベントハンドラーで`updateParticipants()`が呼ばれているか
- [ ] `updateParticipants()`が`setTimeout`で遅延実行されていないか（ビデオトラックの場合）

**確認方法**:
```javascript
// イベントハンドラー内でログを追加
room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
  console.log('[DEBUG] TrackSubscribed:', track.kind, participant.identity);
  if (track.kind === Track.Kind.Video) {
    // updateParticipants()が呼ばれているか確認
    updateParticipants();
    console.log('[DEBUG] TrackSubscribed: updateParticipants called');
  }
});
```

---

### **3. レンダリング時の判定ロジックを確認する** ⭐ **重要**

**チェック項目**:
- [ ] ローカル参加者の判定: `isVideoEnabled` stateを参照しているか
- [ ] リモート参加者の判定: `participant.videoTrackPublications`を参照しているか
- [ ] `participants`配列が更新されないと、リモート参加者の判定が正しく動作しないことを理解しているか

**確認方法**:
```javascript
// レンダリング時にログを追加
{participants.map((participant, index) => {
  const hasActiveCamera = isLocal
    ? isVideoEnabled
    : (() => {
        console.log('[DEBUG] Remote participant camera check:', {
          identity: participant.identity,
          hasPublications: !!participant.videoTrackPublications,
          publicationsSize: participant.videoTrackPublications?.size || 0,
        });
        // ...
      })();
  // ...
})}
```

---

### **4. LiveKitの参加者情報とReactのstateの同期を確認する** 🟡 **中程度**

**チェック項目**:
- [ ] `roomRef.current.remoteParticipants`と`participants` stateが同期しているか
- [ ] `updateParticipants()`が正しく実装されているか
- [ ] `participant`オブジェクトの参照が正しく更新されているか

**確認方法**:
```javascript
const updateParticipants = useCallback(() => {
  if (!roomRef.current) return;

  const allParticipants = [
    roomRef.current.localParticipant,
    ...Array.from(roomRef.current.remoteParticipants.values()),
  ].filter((p) => p);

  console.log('[DEBUG] updateParticipants:', {
    localParticipant: roomRef.current.localParticipant?.identity,
    remoteParticipants: Array.from(roomRef.current.remoteParticipants.keys()),
    allParticipants: allParticipants.map(p => p.identity),
  });

  setParticipants([...allParticipants]);
  setLocalParticipant(roomRef.current.localParticipant);
}, []);
```

---

### **5. タイミングの問題を確認する** 🟡 **中程度**

**チェック項目**:
- [ ] `updateParticipants()`が`setTimeout`で遅延実行されていないか（ビデオトラックの場合）
- [ ] ビデオトラックのアタッチと`updateParticipants()`の呼び出しのタイミングが適切か
- [ ] 即座に再描画が必要な場合は、`setTimeout`を使わずに即座に実行する

**確認方法**:
```javascript
// ビデオトラックの場合は即座に実行
if (track.kind === Track.Kind.Video) {
  // アタッチは遅延実行（DOM要素の準備を待つ）
  setTimeout(() => {
    attachVideoTrackRef.current(track, participant, false);
  }, TRACK_ATTACHMENT_DELAY);
  
  // updateParticipants()は即座に実行（Reactの再描画を即座に発生させる）
  updateParticipants();
}
```

---

## 📝 関連ドキュメント

- **退出時カメラ消失バグ**: `docs/technical-analysis/2025-10-30_camera-disappearance-root-cause-analysis.md`
- **LiveKitリロード問題**: `docs/technical-analysis/2025-10-21_livekit-reload-issue-analysis.md`
- **参加者管理の重要な問題**: `docs/technical-analysis/2025-10-21_critical-participant-management-issues.md`

---

## 🎓 重要な教訓

### **1. LiveKitの状態変更とReactのstate更新は必ず同期させる**

LiveKit側で状態が変更された時（カメラON/OFF、トラック公開/非公開など）は、必ず`updateParticipants()`を呼び出してReactのstateを更新する必要がある。

```javascript
// ✅ 良い例
await roomRef.current.localParticipant.setCameraEnabled(true);
updateParticipants(); // 必ず呼び出す

// ❌ 悪い例
await roomRef.current.localParticipant.setCameraEnabled(true);
// updateParticipants()が呼ばれていない
```

---

### **2. ビデオトラックの状態変更は即座に反映させる**

ビデオトラックの状態変更（ON/OFF）は、ユーザー体験に直接影響するため、`updateParticipants()`を即座に実行する。`setTimeout`で遅延させない。

```javascript
// ✅ 良い例
if (track.kind === Track.Kind.Video) {
  // アタッチは遅延実行（DOM要素の準備を待つ）
  setTimeout(() => {
    attachVideoTrackRef.current(track, participant, false);
  }, TRACK_ATTACHMENT_DELAY);
  
  // updateParticipants()は即座に実行
  updateParticipants();
}

// ❌ 悪い例
if (track.kind === Track.Kind.Video) {
  setTimeout(() => {
    attachVideoTrackRef.current(track, participant, false);
    updateParticipants(); // 遅延実行されている
  }, TRACK_ATTACHMENT_DELAY);
}
```

---

### **3. レンダリング時の判定ロジックを理解する**

リモート参加者のカメラ状態は`participant.videoTrackPublications`を参照しているため、`participants`配列が更新されないと再描画が発生しない。

```javascript
// レンダリング時の判定
const hasActiveCamera = isLocal
  ? isVideoEnabled  // ローカル: stateを参照
  : (() => {
      // リモート: videoTrackPublicationsを参照
      // participants配列が更新されないと、この判定が正しく動作しない
      if (participant.videoTrackPublications && ...) {
        // ...
      }
    })();
```

---

### **4. useCallbackの依存配列を正しく設定する**

`updateParticipants()`を`useCallback`の依存配列に含めることで、最新の関数が参照されるようにする。

```javascript
// ✅ 良い例
const toggleVideo = useCallback(async () => {
  // ...
  updateParticipants();
}, [isVideoEnabled, updateParticipants]);

// ❌ 悪い例
const toggleVideo = useCallback(async () => {
  // ...
  updateParticipants();
}, [isVideoEnabled]); // updateParticipantsが依存配列にない
```

---

## 🚀 今後の予防策

### **コードレビューチェックリスト**

- [ ] カメラ状態変更時に`updateParticipants()`が呼ばれているか
- [ ] LiveKitイベントハンドラーで`updateParticipants()`が呼ばれているか
- [ ] ビデオトラックの状態変更時に`updateParticipants()`が即座に実行されているか
- [ ] `useCallback`の依存配列に必要な関数が含まれているか
- [ ] レンダリング時の判定ロジックが正しく実装されているか

### **テスト項目**

- [ ] ローカル参加者がカメラをON/OFFした時、リモート参加者の画面で即座に反映される
- [ ] リモート参加者がカメラをON/OFFした時、他の参加者の画面で即座に反映される
- [ ] 複数の参加者が同時にカメラをON/OFFした時、全参加者の画面で正しく反映される
- [ ] カメラ状態の変更が即座に反映される（遅延がない）

---

**作成日**: 2025-11-19  
**最終更新**: 2025-11-19  
**ステータス**: 修正完了、動作確認済み

