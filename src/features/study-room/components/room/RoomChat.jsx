import { useState, useRef } from 'react';
import { Send, AlertCircle } from 'lucide-react';
import { useChat } from '../../hooks/room/useChat';

/**
 * RoomChat - ルーム内チャットコンポーネント
 * 
 * 責務:
 * - チャットメッセージの表示
 * - メッセージ入力フィールド
 * - メッセージ送信
 * 
 * 特徴:
 * - LINE風のシンプルUI
 * - タイマー下部に配置（幅はタイマーに合わせる）
 * - ルーム終了時にメッセージは消去
 */
export const RoomChat = ({ roomId }) => {
  const userName = localStorage.getItem('userName') || 'ゲスト';
  const { messages, loading, error, sendMessage, messagesEndRef } = useChat(roomId, userName);
  
  const [inputValue, setInputValue] = useState('');
  const [sendError, setSendError] = useState(null);
  const inputRef = useRef(null);

  // メッセージ送信
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!inputValue.trim()) {
      return;
    }

    try {
      setSendError(null);
      await sendMessage(inputValue);
      setInputValue('');
      inputRef.current?.focus();
    } catch (err) {
      setSendError('メッセージの送信に失敗しました');
      console.error('送信エラー:', err);
    }
  };

  // Enterキーでメッセージ送信（Shift+Enterで改行）
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  return (
    <div className="px-6 pb-4 flex flex-col h-48 bg-gray-800 border-t border-gray-700">
      {/* ヘッダー */}
      <div className="py-2 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-300">チャット</h3>
      </div>

      {/* メッセージ表示エリア */}
      <div className="flex-1 overflow-y-auto py-2 space-y-2 custom-scrollbar">
        {loading && (
          <div className="text-center text-gray-500 text-xs py-4">
            メッセージを読み込み中...
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/20 p-2 rounded">
            <AlertCircle className="w-3 h-3" />
            <span>{error}</span>
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="text-center text-gray-500 text-xs py-4">
            まだメッセージはありません
          </div>
        )}

        {messages.map((message) => {
          const isOwnMessage = message.userName === userName;
          
          return (
            <div
              key={message.id}
              className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs px-3 py-2 rounded-lg text-sm break-words ${
                  isOwnMessage
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-200'
                }`}
              >
                {!isOwnMessage && (
                  <div className="text-xs font-semibold text-gray-400 mb-1">
                    {message.userName}
                  </div>
                )}
                <div>{message.text}</div>
              </div>
            </div>
          );
        })}

        {/* スクロール用参照 */}
        <div ref={messagesEndRef} />
      </div>

      {/* 入力エリア */}
      <form onSubmit={handleSendMessage} className="flex gap-2 pt-2 border-t border-gray-700">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="メッセージを入力..."
          className="flex-1 bg-gray-700 text-white text-sm px-3 py-2 rounded border border-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
          maxLength={200}
        />
        <button
          type="submit"
          disabled={!inputValue.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white p-2 rounded transition-colors"
          aria-label="送信"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* エラー表示 */}
      {sendError && (
        <div className="mt-2 text-red-400 text-xs bg-red-900/20 p-2 rounded flex items-center gap-2">
          <AlertCircle className="w-3 h-3" />
          {sendError}
        </div>
      )}

      {/* 文字数カウント */}
      <div className="text-right text-xs text-gray-500 mt-1">
        {inputValue.length}/200
      </div>
    </div>
  );
};
