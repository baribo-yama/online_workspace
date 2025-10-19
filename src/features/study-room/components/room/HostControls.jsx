/**
 * HostControls - ホスト専用コントロールコンポーネント
 *
 * 責務:
 * - ゲーム開始ボタンの表示
 * - ゲーム中の表示
 * - ホスト情報の表示
 *
 * RoomPage から抽出
 */
import { GAME_STATUS } from "../../constants";

export const HostControls = ({ isHost, canStartGame, gameStatus, onGameStart }) => {
  if (!isHost) return null;

  return (
    <div className="space-y-3">
      {/* ゲーム開始ボタン */}
      {canStartGame && gameStatus !== GAME_STATUS.PLAYING && (
        <button
          onClick={onGameStart}
          className="bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded text-white font-medium transition-colors flex items-center gap-2 w-full justify-center"
          aria-label="ゲームを開始"
        >
          🎯 ゲーム開始
        </button>
      )}

      {/* ゲーム中表示 */}
      {gameStatus === GAME_STATUS.PLAYING && (
        <div
          className="p-3 bg-green-900/20 border border-green-500 rounded text-green-200 text-sm"
          role="status"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold">🎮 ゲーム中</span>
          </div>
          <p className="text-xs mt-1">全員がゲームに参加しています</p>
        </div>
      )}

      {/* ホスト情報 */}
      <div
        className="p-3 bg-yellow-900/20 border border-yellow-500 rounded text-yellow-200 text-sm"
        role="status"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold">👑 あなたがホストです</span>
        </div>
        <p className="text-xs mt-1">タイマーとゲームの制御ができます</p>
      </div>
    </div>
  );
};

