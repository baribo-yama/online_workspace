/**
 * LoadingScreen - ローディング画面コンポーネント
 *
 * 責務:
 * - ローディング中の表示
 * - カスタマイズ可能なメッセージ
 *
 * RoomPage から抽出した共通コンポーネント
 */
import { LOADING_MESSAGES } from "../../constants";

export const LoadingScreen = ({ message = LOADING_MESSAGES.ROOM }) => (
  <div className="flex h-screen bg-gray-900 items-center justify-center">
    <div className="text-center">
      <div
        className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"
        role="status"
        aria-label="読み込み中"
      />
      <p className="text-white">{message}</p>
    </div>
  </div>
);

