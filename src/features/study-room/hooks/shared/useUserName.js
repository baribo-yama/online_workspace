/**
 * useUserName - ユーザー名管理フック
 *
 * 責務:
 * - localStorageからのユーザー名復元
 * - ユーザー名の更新とlocalStorageへの保存
 *
 * HomePage から抽出したロジック
 *
 * @returns {Object} { name, setName, handleNameChange }
 */
import { useState, useEffect, useCallback } from "react";

const USER_NAME_KEY = "userName";

export const useUserName = () => {
  const [name, setName] = useState("");

  // 名前をローカルストレージから復元
  useEffect(() => {
    const savedName = localStorage.getItem(USER_NAME_KEY);
    if (savedName) {
      setName(savedName);
    }
  }, []);

  // 名前変更ハンドラ
  const handleNameChange = useCallback((e) => {
    const newName = e.target.value;
    setName(newName);
    if (newName.trim()) {
      localStorage.setItem(USER_NAME_KEY, newName.trim());
    }
  }, []);

  return {
    name,
    setName,
    handleNameChange,
  };
};

