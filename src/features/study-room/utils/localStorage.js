/**
 * localStorage - ローカルストレージ操作のユーティリティ
 *
 * 責務:
 * - ユーザー名の保存・取得・削除
 * - localStorage操作の一元管理
 *
 * 副作用のあるユーティリティ関数として実装
 */

const USER_NAME_KEY = "userName";

/**
 * ユーザー名を保存
 * @param {string} name - ユーザー名
 */
export const saveUserName = (name) => {
  if (name && name.trim()) {
    localStorage.setItem(USER_NAME_KEY, name.trim());
  }
};

/**
 * ユーザー名を取得
 * @returns {string} 保存されているユーザー名（なければ空文字）
 */
export const getUserName = () => {
  return localStorage.getItem(USER_NAME_KEY) || "";
};

/**
 * ユーザー名を削除
 */
export const clearUserName = () => {
  localStorage.removeItem(USER_NAME_KEY);
};

