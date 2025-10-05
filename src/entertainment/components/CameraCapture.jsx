// カメラ撮影コンポーネント
import { useEffect, useState } from 'react';
import { Camera, CameraOff, Download, Trash2, AlertCircle } from 'lucide-react';
import { useCamera } from '../hooks/useCamera';

function CameraCapture({ onPhotoCapture, autoStart = true }) {
  const {
    isStreamActive,
    capturedPhoto,
    error,
    videoRef,
    canvasRef,
    startCamera,
    stopCamera,
    capturePhoto,
    loadSavedPhoto,
    clearPhoto
  } = useCamera();

  const [showFlash, setShowFlash] = useState(false);
  const [showCapturedPreview, setShowCapturedPreview] = useState(false);

  useEffect(() => {
    // 保存された写真を読み込み
    loadSavedPhoto();

    // 自動開始が有効な場合
    if (autoStart) {
      startCamera();
    }

    // クリーンアップ
    return () => {
      stopCamera();
    };
  }, [autoStart, loadSavedPhoto, startCamera, stopCamera]);

  const handleCapture = async () => {

    // フラッシュ効果
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 200);

    const photo = capturePhoto();

    if (photo) {
      // 撮影した写真を一瞬表示
      setShowCapturedPreview(true);
      setTimeout(() => {
        setShowCapturedPreview(false);
        // コールバック実行
        if (onPhotoCapture) {
          onPhotoCapture(photo);
        }
      }, 2000); // 2秒間表示
    } else {
      console.error('写真の撮影に失敗しました');
    }
  };

  const handleDownload = () => {
    if (capturedPhoto) {
      const link = document.createElement('a');
      link.download = `photo_${new Date().getTime()}.jpg`;
      link.href = capturedPhoto.dataUrl;
      link.click();
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-600">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Camera className="w-5 h-5" />
          入室記念撮影
        </h3>
        <div className="flex gap-2">
          {!isStreamActive ? (
            <button
              onClick={startCamera}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors flex items-center gap-1"
            >
              <Camera className="w-4 h-4" />
              開始
            </button>
          ) : (
            <button
              onClick={stopCamera}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors flex items-center gap-1"
            >
              <CameraOff className="w-4 h-4" />
              停止
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-600 rounded text-red-200 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-4">
        {/* カメラプレビュー */}
        {isStreamActive && (
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full max-w-md mx-auto rounded-lg bg-gray-900"
              style={{ transform: 'scaleX(-1)' }} // 鏡像表示
            />

            {/* フラッシュ効果 */}
            {showFlash && (
              <div className="absolute inset-0 bg-white rounded-lg flash-animation"></div>
            )}

            <div className="mt-3 flex justify-center">
              <button
                onClick={handleCapture}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Camera className="w-5 h-5" />
                撮影
              </button>
            </div>
          </div>
        )}

        {/* 撮影直後の一瞬表示 */}
        {showCapturedPreview && capturedPhoto && (
          <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
            <div className="text-center">
              <div className="mb-4">
                <img
                  src={capturedPhoto.dataUrl}
                  alt="撮影した写真"
                  className="max-w-sm max-h-96 rounded-lg shadow-2xl"
                />
              </div>
              <p className="text-white text-lg font-medium animate-pulse">
                📸 撮影完了！
              </p>
            </div>
          </div>
        )}

        {/* 撮影した写真の表示 */}
        {capturedPhoto && !showCapturedPreview && (
          <div className="border border-gray-600 rounded-lg p-3 bg-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-white font-medium">撮影完了</h4>
              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors flex items-center gap-1"
                  title="写真をダウンロード"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={clearPhoto}
                  className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded text-sm transition-colors flex items-center gap-1"
                  title="写真を削除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <img
              src={capturedPhoto.dataUrl}
              alt="撮影した写真"
              className="w-full max-w-xs mx-auto rounded-lg"
            />
            <p className="text-gray-400 text-xs mt-2 text-center">
              撮影日時: {new Date(capturedPhoto.timestamp).toLocaleString()}
            </p>
          </div>
        )}

        {/* 隠しCanvas（撮影用） */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      <div className="mt-4 p-3 bg-blue-900/30 border border-blue-600 rounded text-blue-200 text-xs">
        💡 <strong>使い方:</strong> 撮影した写真は休憩時間のシューティングゲームで使用されます！
      </div>

      {/* フラッシュアニメーション用CSS */}
      <style jsx>{`
        .flash-animation {
          animation: flash 0.2s ease-out;
        }

        @keyframes flash {
          0% { opacity: 0; }
          50% { opacity: 0.8; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default CameraCapture;
