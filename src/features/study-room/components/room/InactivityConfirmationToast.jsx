/**
 * InactivityConfirmationToast - ホスト非活動確認トースト
 *
 * 責務:
 * - ホストに「起きてますか？」を通知
 * - 「はい」ボタンで応答を受け取る
 * - 画面中央上部に表示
 *
 * 仕様:
 * - 自動非表示なし
 * - 閉じるボタンなし
 * - 他のトーストと併用可能
 */

export const InactivityConfirmationToast = ({ onConfirm, countdown }) => {
  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
      <div className="bg-yellow-500 text-white px-6 py-4 rounded-lg shadow-lg max-w-2xl">
        <div className="flex items-center gap-3">
          {/* アイコン */}
          <span className="text-2xl">⚠️</span>

          {/* メッセージ */}
          <div className="flex-1">
            <p className="font-bold">
              操作がない場合、この部屋は自動的に終了します。
              <br />
              部屋を継続させたい場合は「はい」を押してください
            </p>
            {countdown !== null && countdown > 0 && (
              <p className="text-sm opacity-90 mt-1">
                残り時間: {Math.floor(countdown / 60)}分{countdown % 60}秒
              </p>
            )}
          </div>

          {/* 「はい」ボタン */}
          <button
            onClick={onConfirm}
            className="bg-white text-yellow-600 px-4 py-2 rounded font-bold hover:bg-yellow-50 transition-colors"
          >
            はい
          </button>
        </div>
      </div>
    </div>
  );
};
