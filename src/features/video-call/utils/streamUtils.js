/**
 * streamUtils - ストリーム操作のユーティリティ関数
 *
 * 責務:
 * - カメラ・マイクストリームの停止処理
 * - ストリーム状態の管理
 * - デバッグログの出力
 *
 * PRレビュー対応:
 * - コード重複の解消
 * - ログ出力の改善
 * - 統一的なエラーハンドリング
 */

/**
 * ローカル参加者のすべてのトラックを停止する
 * @param {Object} participant - LiveKitのローカル参加者オブジェクト
 */
export const stopAllLocalTracks = (participant) => {
  if (!participant) {
    if (import.meta.env.DEV) {
      console.warn('stopAllLocalTracks: participantが未定義です');
    }
    return;
  }

  try {
    // ビデオトラックを停止
    stopTracksByType(participant.videoTrackPublications, 'カメラ');
    
    // オーディオトラックを停止
    stopTracksByType(participant.audioTrackPublications, 'マイク');
    
    if (import.meta.env.DEV) {
      console.log('すべてのローカルトラックを停止しました');
    }
  } catch (error) {
    console.error('stopAllLocalTracks エラー:', error);
  }
};

/**
 * 指定されたタイプのトラックを停止する
 * @param {Map} publications - LiveKitのトラック公開オブジェクト
 * @param {string} trackType - トラックタイプ（'カメラ' または 'マイク'）
 */
const stopTracksByType = (publications, trackType) => {
  if (!publications) {
    if (import.meta.env.DEV) {
      console.log(`${trackType}トラック: 公開されているトラックがありません`);
    }
    return;
  }

  let stoppedCount = 0;
  
  for (const publication of publications.values()) {
    if (publication.track) {
      try {
        // LiveKitトラックを停止
        publication.track.stop();
        
        // ブラウザのメディアストリームトラックも停止
        if (publication.track.mediaStreamTrack) {
          publication.track.mediaStreamTrack.stop();
        }
        
        // デバッグ情報付きログ出力（PRレビュー対応）
        if (import.meta.env.DEV) {
          console.log(`${trackType}ストリームを完全停止:`, {
            trackSid: publication.trackSid,
            trackId: publication.track?.id,
            kind: publication.track?.kind
          });
        }
        
        stoppedCount++;
      } catch (trackError) {
        console.warn(`${trackType}トラック停止エラー:`, {
          trackSid: publication.trackSid,
          error: trackError
        });
      }
    }
  }
  
  if (import.meta.env.DEV && stoppedCount > 0) {
    console.log(`${trackType}トラック: ${stoppedCount}個のトラックを停止しました`);
  }
};

/**
 * ストリーム停止の状態を確認する
 * @param {Object} participant - LiveKitのローカル参加者オブジェクト
 * @returns {Object} ストリーム状態の情報
 */
export const getStreamStatus = (participant) => {
  if (!participant) {
    return { video: 0, audio: 0, total: 0 };
  }

  const videoCount = participant.videoTrackPublications?.size || 0;
  const audioCount = participant.audioTrackPublications?.size || 0;
  
  return {
    video: videoCount,
    audio: audioCount,
    total: videoCount + audioCount
  };
};
