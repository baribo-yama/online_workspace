/**
 * 音声管理カスタムフック
 * 
 * VideoCallRoomコンポーネントから音声関連の責務を分離し、
 * 音声要素の作成、管理、リセット機能を提供します。
 */

import { useCallback, useRef } from 'react';

export const useAudioManagement = () => {
  // 音声要素の管理用Map
  const audioElementsRef = useRef(new Map());
  // ユーザーインタラクション有効フラグ
  const userInteractionEnabledRef = useRef(false);

  /**
   * ユーザーインタラクションを有効化する関数
   * 
   * ブラウザの自動再生制限を回避するため、
   * より積極的にユーザーインタラクションを取得します。
   */
  const enableUserInteraction = useCallback(() => {
    if (userInteractionEnabledRef.current) {
      return; // 既に有効化済み
    }
    
    try {
      // 無音の音声データ（Base64エンコード）
      const silentAudioData = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
      const silentAudio = new Audio(silentAudioData);
      
      // 音声要素の設定を最適化
      silentAudio.autoplay = true;
      silentAudio.playsInline = true;
      silentAudio.muted = false;
      silentAudio.volume = 0.01; // 非常に小さな音量
      
      // 無音音声を再生してユーザーインタラクションを記録
      silentAudio.play().then(() => {
        userInteractionEnabledRef.current = true;
        if (import.meta.env.DEV) {
          console.log('ユーザーインタラクション有効化完了');
        }
        // 音声要素を即座に停止
        silentAudio.pause();
        silentAudio.src = '';
      }).catch((error) => {
        if (import.meta.env.DEV) {
          console.log('無音音声再生失敗（通常は問題なし）:', error);
        }
        // 失敗してもユーザーインタラクションを有効化
        userInteractionEnabledRef.current = true;
      });
      
      // 複数の方法でユーザーインタラクションを取得
      const handleInteraction = () => {
        userInteractionEnabledRef.current = true;
        if (import.meta.env.DEV) {
          console.log('ユーザーインタラクション検知');
        }
        // イベントリスナーを削除
        document.removeEventListener('click', handleInteraction);
        document.removeEventListener('touchstart', handleInteraction);
        document.removeEventListener('keydown', handleInteraction);
        document.removeEventListener('mousemove', handleInteraction);
      };
      
      // 複数のイベントタイプでユーザーインタラクションを監視
      document.addEventListener('click', handleInteraction, { once: true });
      document.addEventListener('touchstart', handleInteraction, { once: true });
      document.addEventListener('keydown', handleInteraction, { once: true });
      document.addEventListener('mousemove', handleInteraction, { once: true });
      
      // 5秒後にイベントリスナーをクリーンアップ
      setTimeout(() => {
        document.removeEventListener('click', handleInteraction);
        document.removeEventListener('touchstart', handleInteraction);
        document.removeEventListener('keydown', handleInteraction);
        document.removeEventListener('mousemove', handleInteraction);
      }, 5000);
      
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('ユーザーインタラクション有効化エラー:', error);
      }
    }
  }, []);

  /**
   * 音声再生を自動的に実行する関数
   * 
   * リロード時の音声問題を解決するため、より積極的な音声接続処理を実装します。
   * AudioContextエラーとNotAllowedErrorの両方に対応します。
   */
  const playAudioSafely = useCallback(async (audioElement, participantIdentity) => {
    if (!audioElement) return;
    
    try {
      await audioElement.play();
      if (import.meta.env.DEV) {
        console.log('音声再生成功:', participantIdentity);
      }
    } catch (error) {
      if (error.name === 'NotAllowedError' || error.message.includes('AudioContext')) {
        console.warn('音声再生エラー - 積極的な再試行を開始:', participantIdentity, error.message);
        
        // ユーザーインタラクションを有効化
        enableUserInteraction();
        
        // 音声要素の状態をリセット
        audioElement.pause();
        audioElement.currentTime = 0;
        audioElement.load();
        
        // 積極的な音声接続再試行
        const aggressiveRetryAudioConnection = async () => {
          try {
            // 音声要素の状態を再設定
            audioElement.autoplay = true;
            audioElement.playsInline = true;
            audioElement.muted = false;
            audioElement.volume = 1.0;
            
            await audioElement.play();
            if (import.meta.env.DEV) {
              console.log('積極的音声接続成功:', participantIdentity);
            }
            return true;
          } catch (retryError) {
            if (import.meta.env.DEV) {
              console.log('積極的音声接続失敗（継続試行）:', participantIdentity, retryError.message);
            }
            return false;
          }
        };
        
        // 即座に再試行
        await aggressiveRetryAudioConnection();
        
        // 複数のタイミングで音声接続を試行
        const retryIntervals = [100, 500, 1000, 2000, 5000]; // ミリ秒
        
        retryIntervals.forEach((interval) => {
          setTimeout(async () => {
            const success = await aggressiveRetryAudioConnection();
            if (success && import.meta.env.DEV) {
              console.log(`音声接続成功（${interval}ms後）:`, participantIdentity);
            }
          }, interval);
        });
        
        // ユーザーインタラクションを検知した際の音声接続
        const handleUserInteraction = async () => {
          const success = await aggressiveRetryAudioConnection();
          if (success && import.meta.env.DEV) {
            console.log('ユーザーインタラクション後の音声接続成功:', participantIdentity);
          }
          
          // イベントリスナーを削除
          document.removeEventListener('click', handleUserInteraction);
          document.removeEventListener('touchstart', handleUserInteraction);
          document.removeEventListener('keydown', handleUserInteraction);
          document.removeEventListener('mousemove', handleUserInteraction);
        };
        
        // より多くのイベントタイプでユーザーインタラクションを監視
        document.addEventListener('click', handleUserInteraction, { once: true });
        document.addEventListener('touchstart', handleUserInteraction, { once: true });
        document.addEventListener('keydown', handleUserInteraction, { once: true });
        document.addEventListener('mousemove', handleUserInteraction, { once: true });
        
        // 15秒後にイベントリスナーをクリーンアップ
        setTimeout(() => {
          document.removeEventListener('click', handleUserInteraction);
          document.removeEventListener('touchstart', handleUserInteraction);
          document.removeEventListener('keydown', handleUserInteraction);
          document.removeEventListener('mousemove', handleUserInteraction);
        }, 15000);
        
      } else {
        console.error('音声再生エラー（その他）:', participantIdentity, error);
      }
    }
  }, [enableUserInteraction]);

  /**
   * 指定された参加者の音声要素をクリーンアップする関数
   * 
   * 参加者が退出した際や、音声トラックが非購読された際に
   * 音声要素を適切にクリーンアップします。
   * DOMからは削除せず、要素を保持してリロード時の音声問題を回避します。
   */
  const cleanupAudioElement = useCallback((participantIdentity) => {
    const audioElement = audioElementsRef.current.get(participantIdentity);
    if (audioElement) {
      try {
        // 音声の再生を停止
        audioElement.pause();
        // 音声ストリームをクリア
        audioElement.srcObject = null;
        // 要素を非表示に設定
        audioElement.style.display = 'none';
        
        if (import.meta.env.DEV) {
          console.log('音声要素を一時無効化:', participantIdentity);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('音声要素クリーンアップエラー:', participantIdentity, error);
        }
      }
    }
  }, []);

  /**
   * 全ての音声要素をリセットする関数
   * 
   * リロード時や新しい接続開始時に、既存の音声要素の状態を
   * 完全にリセットして、新しい音声トラックが正常にアタッチできるようにします。
   * AudioContextエラーを防ぐため、より積極的なリセット処理を実装します。
   */
  const resetAllAudioElements = useCallback((audioContextRef, analyserRef) => {
    if (import.meta.env.DEV) {
      console.log('全ての音声要素をリセット中...');
    }
    
    // 全ての音声要素の状態をリセット
    for (const [participantIdentity, audioElement] of audioElementsRef.current.entries()) {
      if (audioElement) {
        try {
          // 音声の再生を停止
          audioElement.pause();
          // 音声ストリームをクリア
          audioElement.srcObject = null;
          // 要素を非表示に設定
          audioElement.style.display = 'none';
          // 音量とミュート状態をリセット
          audioElement.volume = 1.0;
          audioElement.muted = false;
          // 自動再生を有効化
          audioElement.autoplay = true;
          audioElement.playsInline = true;
          // 音声要素の状態を完全にリセット
          audioElement.currentTime = 0;
          audioElement.load();
          
          if (import.meta.env.DEV) {
            console.log('音声要素をリセット:', participantIdentity);
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            console.warn('音声要素リセットエラー:', participantIdentity, error);
          }
        }
      }
    }
    
    // AudioContextもリセット（存在する場合）
    if (audioContextRef?.current) {
      try {
        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
        }
        audioContextRef.current = null;
        if (analyserRef?.current) {
          analyserRef.current = null;
        }
        if (import.meta.env.DEV) {
          console.log('AudioContextをリセット');
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('AudioContextリセットエラー:', error);
        }
      }
    }
    
    if (import.meta.env.DEV) {
      console.log('全ての音声要素のリセット完了');
    }
  }, []);

  /**
   * 音声トラックをアタッチする関数
   * 
   * 参加者の音声トラックをHTML音声要素にアタッチし、
   * 音声の再生を開始します。
   */
  const attachAudioTrack = useCallback((track, participant) => {
    if (!track || !participant) {
      console.warn('音声トラックまたは参加者が無効です');
      return;
    }

    try {
      // 既存の音声要素をチェック（重複作成を防ぐ）
      const existingElement = audioElementsRef.current.get(participant.identity);
      if (existingElement) {
        // 既存要素の状態を完全にリセット
        existingElement.pause();
        existingElement.srcObject = null;
        existingElement.volume = 1.0;
        existingElement.muted = false;
        existingElement.autoplay = true;
        existingElement.playsInline = true;
        
        // 新しい音声ストリームを設定
        /**
         * ベストプラクティス:
         * リモート MediaStreamTrack に対して track.stop() を呼ばないこと。
         * track.stop() はローカルトラック専用で、リモートトラックに対して呼ぶと
         * 他参加者のメディアにも影響を与える可能性があるため、
         * srcObject の解放と DOM 要素の削除のみを行うこと。
         */
        existingElement.srcObject = new MediaStream([track.mediaStreamTrack]);
        // 要素を非表示のまま維持
        existingElement.style.display = 'none';
        
        if (import.meta.env.DEV) {
          console.log('既存の音声要素を更新:', participant.identity);
        }
        
        // 音声の再生を開始（安全な再生処理を使用）
        playAudioSafely(existingElement, participant.identity);
        
        return;
      }

      // 新しいHTML音声要素を作成
      const audioElement = document.createElement('audio');
      audioElement.autoplay = true;        // 自動再生を有効化
      audioElement.playsInline = true;     // インライン再生（モバイル対応）
      audioElement.muted = false;          // ミュートを無効化
      audioElement.volume = 1.0;           // 音量を最大に設定
      audioElement.style.display = 'none'; // 非表示に設定
      
      // 音声ストリームを設定
      audioElement.srcObject = new MediaStream([track.mediaStreamTrack]);
      
      // DOMに追加（ブラウザの自動再生制限対策）
      document.body.appendChild(audioElement);

      // 参加者IDをキーとして音声要素の参照を保存
      audioElementsRef.current.set(participant.identity, audioElement);

      // 音声の再生を開始（安全な再生処理を使用）
      playAudioSafely(audioElement, participant.identity);

      if (import.meta.env.DEV) {
        console.log('音声トラックをアタッチ:', participant.identity, {
          hasMediaStreamTrack: !!track.mediaStreamTrack,
          audioElementCreated: !!audioElement,
          audioElementAutoplay: audioElement.autoplay,
          audioElementPlaysInline: audioElement.playsInline
        });
      }

    } catch (error) {
      console.error('音声トラックアタッチエラー:', error);
    }
  }, [playAudioSafely]);

  return {
    audioElementsRef,
    userInteractionEnabledRef,
    enableUserInteraction,
    playAudioSafely,
    cleanupAudioElement,
    resetAllAudioElements,
    attachAudioTrack
  };
};
