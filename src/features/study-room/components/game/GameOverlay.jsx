/**
 * GameOverlay - ゲーム画面オーバーレイ
 *
 * 責務:
 * - ゲーム画面を全画面オーバーレイで表示
 * - ゲームコンポーネントの遅延読み込み
 * - ゲーム画面の開閉制御
 */
import { lazy, Suspense } from "react";
import { LOADING_MESSAGES } from "../../constants";

const FaceObstacleGame = lazy(() => import("../../../entertainment/components/FaceObstacleGame"));

export const GameOverlay = ({
  show,
  roomId,
  userName,
  isHost,
  onClose
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
      <div className="max-w-4xl w-full mx-4">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-white mb-2">
            🎭 顔障害物ゲーム
          </h2>
          <p className="text-gray-300 text-lg">
            障害物を避けて最後まで生き残ろう！
          </p>
        </div>

        <Suspense fallback={
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div
                className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"
                role="status"
                aria-label="読み込み中"
              />
              <p className="text-white">{LOADING_MESSAGES.GAME}</p>
            </div>
          </div>
        }>
          <FaceObstacleGame
            roomId={roomId}
            userName={userName}
            isHost={isHost}
          />
        </Suspense>

        <div className="text-center mt-4">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ゲーム画面を閉じる
          </button>
          <p className="text-gray-400 text-xs mt-1">
            ゲーム自体を終了するには、ゲーム内の「ゲーム終了」ボタンを使用してください
          </p>
        </div>
      </div>
    </div>
  );
};

