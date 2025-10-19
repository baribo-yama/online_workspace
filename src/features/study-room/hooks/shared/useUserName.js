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
import { getUserName, saveUserName } from "../../utils";

export const useUserName = () => {
  const [name, setName] = useState("");

  // 名前をローカルストレージから復元
  useEffect(() => {
    setName(getUserName());
  }, []);

  // 名前変更ハンドラ
  const handleNameChange = useCallback((e) => {
    const newName = e.target.value;
    setName(newName);
    saveUserName(newName);
  }, []);

  return {
    name,
    setName,
    handleNameChange,
  };
};

