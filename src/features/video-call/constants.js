// ビデオ通話機能で使用するタイミング・音声関連の定数
// 値を一元管理し、コンポーネント/フック間の整合性を保つ。

export const TIMINGS = {
  // TRACK_ATTACHMENT_DELAY: リモートトラックをアタッチするまでの遅延(ms)
  // 参加者追加時の体感応答性を高めるため 200ms → 50ms に短縮。
  // 問題が出る場合は 25ms 刻みで増やすことを推奨。
  TRACK_ATTACHMENT_DELAY: 50,

  // LOCAL_TRACK_ATTACHMENT_DELAY: ローカルトラックをアタッチするまでの遅延(ms)
  // 計測上の問題が無かったため 100ms → 20ms に短縮。ローカルプレビューの遅延を削減。
  LOCAL_TRACK_ATTACHMENT_DELAY: 20,

  // RETRY_ATTACHMENT_DELAY: トラックアタッチ失敗時の再試行間隔(ms)
  // 一時的な失敗からの復帰を早めるため 500ms → 100ms に短縮。
  RETRY_ATTACHMENT_DELAY: 100,

  // マイク有効化/公開後に音声レベル監視を開始するまでの待機時間(ms)
  AUDIO_MONITOR_START_DELAY_MS: 100,

  // 自動再生制限(NotAllowedError)からのリトライ間隔(ms)
  AUDIO_PLAY_RETRY_MS: [50, 100, 200, 500, 1000],

  // 画面共有トラックのアタッチ遅延(ms)
  // 画面共有トラックをアタッチするまでの待機時間
  SCREEN_SHARE_TRACK_ATTACHMENT_DELAY: 100,

  // カメラトラックの再アタッチ遅延(ms)
  // 画面共有停止後、カメラトラックを再アタッチするまでの待機時間
  CAMERA_REATTACHMENT_DELAY: 300,

  // 画面共有停止後の参加者リスト更新遅延(ms)
  // 画面共有停止後、参加者リストを更新するまでの待機時間
  SCREEN_SHARE_STOP_PARTICIPANT_UPDATE_DELAY: 500,

  // 画面共有トラックの存在確認遅延(ms)
  // screenShareOwnerが設定された後、トラックの存在を確認するまでの待機時間
  SCREEN_SHARE_TRACK_CHECK_DELAY: 500,
};

export const AUDIO = {
  // 無音再生時の音量（自動再生ポリシー回避のための最小値）
  SILENT_AUDIO_VOLUME: 0.01,
};


