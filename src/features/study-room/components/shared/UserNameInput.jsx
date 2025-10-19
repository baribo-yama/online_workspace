/**
 * UserNameInput - ユーザー名入力コンポーネント
 *
 * 責務:
 * - ユーザー名の入力フィールド表示
 * - 自動保存メッセージの表示
 *
 * HomePage から抽出した共通コンポーネント
 */
export const UserNameInput = ({ value, onChange }) => {
  return (
    <div className="mb-6">
      <input
        value={value}
        onChange={onChange}
        placeholder="あなたの名前"
        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {value && (
        <p className="text-xs text-gray-400 mt-1">
          名前は自動的に保存されます
        </p>
      )}
    </div>
  );
};

