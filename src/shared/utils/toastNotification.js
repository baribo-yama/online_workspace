/**
 * トースト通知ユーティリティ
 * 
 * 画面上部に一時的に通知を表示する機能を提供
 * 
 * @example
 * // 基本的な使用方法
 * showToast('成功しました！', 'success');
 * showToast('エラーが発生しました', 'error');
 */

// 通知タイプのスタイル定義
const toastStyles = {
  success: {
    bg: 'bg-green-600',
    text: 'text-white',
    icon: '✅'
  },
  error: {
    bg: 'bg-red-600',
    text: 'text-white',
    icon: '❌'
  },
  info: {
    bg: 'bg-blue-600',
    text: 'text-white',
    icon: 'ℹ️'
  },
  warning: {
    bg: 'bg-yellow-600',
    text: 'text-white',
    icon: '⚠️'
  }
};

/**
 * トースト通知を表示する関数
 * 
 * @param {string} message - 表示するメッセージ
 * @param {'success' | 'error' | 'info' | 'warning'} type - 通知タイプ
 * @param {number} duration - 表示時間（ミリ秒） デフォルト: 3000
 */
export const showToast = (message, type = 'info', duration = 3000) => {
  const style = toastStyles[type] || toastStyles.info;
  
  // トースト要素を作成
  const toast = document.createElement('div');
  const toastId = `toast-${Date.now()}`;
  toast.id = toastId;
  
  toast.className = `
    fixed top-4 right-4 z-50 
    px-4 py-3 rounded-lg shadow-lg
    ${style.bg} ${style.text}
    flex items-center gap-2
    animate-fade-in
    max-w-sm
  `;
  
  // Create icon span
  const iconSpan = document.createElement('span');
  iconSpan.textContent = style.icon;
  
  // Create message span
  const messageSpan = document.createElement('span');
  messageSpan.textContent = message;
  
  // Append spans to toast
  toast.appendChild(iconSpan);
  toast.appendChild(messageSpan);
  
  document.body.appendChild(toast);
  
  // 指定時間後に削除
  setTimeout(() => {
    toast.classList.add('animate-fade-out');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, duration);
};

/**
 * ホスト権限移譲成功を通知
 */
export const showHostTransferSuccessToast = () => {
  showToast('⭐ ホスト権限を移譲しました', 'success', 3000);
};

/**
 * ホスト権限取得を通知
 */
export const showHostPromotionToast = () => {
  showToast('⭐ あなたはホストになりました', 'success', 4000);
};

/**
 * エラーを通知
 */
export const showErrorToast = (message = 'エラーが発生しました') => {
  showToast(message, 'error', 4000);
};
