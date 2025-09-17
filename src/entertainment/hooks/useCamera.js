// カメラ撮影機能のフック
import { useState, useRef, useCallback } from 'react';

export const useCamera = () => {
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  // カメラストリームを開始
  const startCamera = useCallback(async () => {
    try {
      setError(null);

      // カメラアクセス権限をチェック
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('このブラウザはカメラアクセスをサポートしていません');
      }


      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });


      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsStreamActive(true);
      }
    } catch (err) {
      console.error('カメラアクセスエラー:', err);
      let errorMessage = 'カメラにアクセスできませんでした。';

      if (err.name === 'NotAllowedError') {
        errorMessage = 'カメラへのアクセスが拒否されました。ブラウザの設定でカメラアクセスを許可してください。';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'カメラが見つかりません。カメラが接続されているか確認してください。';
      } else if (err.name === 'NotSupportedError') {
        errorMessage = 'HTTPS接続が必要です。セキュアな接続でアクセスしてください。';
      }

      setError(errorMessage);
    }
  }, []);

  // カメラストリームを停止
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsStreamActive(false);
  }, []);

  // 写真を撮影
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !isStreamActive) {
      setError('カメラが準備できていません');
      return null;
    }

    try {
      const video = videoRef.current;

      // ビデオが実際に再生されているかチェック
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        setError('カメラの準備が完了していません。しばらく待ってから再試行してください。');
        return null;
      }


      // Canvasを作成（既存のcanvasRefを使用するか、新しく作成）
      const canvas = canvasRef.current || document.createElement('canvas');

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const ctx = canvas.getContext('2d');

      // 鏡像を修正（水平方向に反転）
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);

      // 画像データを取得
      const photoDataUrl = canvas.toDataURL('image/jpeg', 0.8);

      // 写真データを保存
      const photoData = {
        dataUrl: photoDataUrl,
        timestamp: Date.now(),
        width: canvas.width,
        height: canvas.height
      };

      setCapturedPhoto(photoData);

      // ローカルストレージに保存（セッション用）
      localStorage.setItem('capturedPhoto', JSON.stringify(photoData));

      return photoData;

    } catch (err) {
      console.error('写真撮影エラー:', err);
      setError('写真の撮影に失敗しました: ' + err.message);
      return null;
    }
  }, [isStreamActive]);

  // 保存された写真を読み込み
  const loadSavedPhoto = useCallback(() => {
    try {
      const savedPhoto = localStorage.getItem('capturedPhoto');
      if (savedPhoto) {
        const photoData = JSON.parse(savedPhoto);
        setCapturedPhoto(photoData);
        return photoData;
      }
    } catch (err) {
      console.error('保存された写真の読み込みエラー:', err);
    }
    return null;
  }, []);

  // 写真を削除
  const clearPhoto = useCallback(() => {
    setCapturedPhoto(null);
    localStorage.removeItem('capturedPhoto');
  }, []);

  return {
    // 状態
    isStreamActive,
    capturedPhoto,
    error,

    // Refs
    videoRef,
    canvasRef,

    // アクション
    startCamera,
    stopCamera,
    capturePhoto,
    loadSavedPhoto,
    clearPhoto
  };
};
