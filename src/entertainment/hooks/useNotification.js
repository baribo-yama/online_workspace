import { useCallback, useRef } from 'react';
/**
 * ポモドーロ通知フック（音のみ）
 * - 視覚通知は行わず音のみ再生
 * - 提供API: requestPermission(ダミー), playSound, notifyTimerComplete
 */

/**
 * 通知フックのオプション
 * @typedef {Object} UseNotificationOptions
 * @property {string} [soundUrl] 再生する通知音のURL（既定: DEFAULT_NOTIFICATION_SOUND_URL）
 */

/** 既定の通知音パス（public配下） */
export const DEFAULT_NOTIFICATION_SOUND_URL = '/sounds/notification.mp3';

/**
 * useNotification
 * @param {UseNotificationOptions} [options]
 */
export const useNotification = (options = {}) => {
  // 音声ファイルの参照（遅延読み込み）
  const audioRef = useRef(null);
  const soundUrl = options.soundUrl || DEFAULT_NOTIFICATION_SOUND_URL;

  // 従来互換のためのダミー実装（視覚通知は無効のため何もしない）
  const requestPermission = useCallback(async () => {
    return true;
  }, []);

  // デスクトップ通知・トースト通知は使用しない（音のみ）

  // フォールバック音声（Web Audio API）
  const playFallbackSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.warn('フォールバック音声再生エラー:', error);
    }
  }, []);

  // 通知音を再生（MP3優先、失敗時はビープフォールバック）
  const playSound = useCallback(() => {
    try {
      // 既存の音声が再生中の場合は停止
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      // 新しい音声要素を作成
      const audio = new Audio(soundUrl);
      audio.volume = 0.5;
      audioRef.current = audio;
      
      audio.play().catch(error => {
        console.warn('音声再生エラー:', error);
        // 音声ファイルが見つからない場合はWeb Audio APIでフォールバック
        playFallbackSound();
      });
    } catch (error) {
      console.warn('音声再生エラー:', error);
      playFallbackSound();
    }
  }, [playFallbackSound, soundUrl]);

  // タイマー完了通知（音のみ）
  const notifyTimerComplete = useCallback((mode) => {
    const messages = {
      work: {
        title: '作業時間終了！',
        message: 'お疲れ様でした！休憩時間です。',
        console: '作業時間が終了しました！休憩を取りましょう。',
        toast: '作業時間が終了しました！休憩を取りましょう。'
      },
      break: {
        title: '休憩時間終了！',
        message: '休憩時間が終了しました。作業を再開しましょう。',
        console: '休憩時間が終了しました！作業を再開しましょう。',
        toast: '休憩時間が終了しました！作業を再開しましょう。'
      }
    };

    const notification = messages[mode] || messages.work;

    // 音声通知
    try {
      playSound();
    } catch (error) {
      console.warn('音声通知エラー:', error);
    }

    // 開発時のみログ
    if (import.meta?.env?.DEV) {
      console.log(notification.console);
    }
  }, [playSound]);

  return { 
    requestPermission,
    playSound,
    notifyTimerComplete,
    // 視覚通知は提供しない
  };
};