import { useState, useCallback } from 'react';
import tipsData from '../data/tips.json';

/**
 * Tips表示を管理するカスタムフック
 * 休憩時間にランダムなTipsを表示する
 * 同じTipsが連続で表示されないように制御
 */
export function useTips() {
  const [currentTip, setCurrentTip] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [lastTipId, setLastTipId] = useState(null);

  /**
   * ランダムなTipsを選択して表示
   * 前回と同じTipsは選ばない
   */
  const showRandomTip = useCallback(() => {
    // データが2個以上ある場合のみ重複チェック
    if (tipsData.length < 2) {
      const selectedTip = tipsData[0];
      setCurrentTip(selectedTip);
      setIsVisible(true);
      setLastTipId(selectedTip?.id);
      return;
    }

    // 前回と異なるTipsを選択
    let selectedTip;
    let attempts = 0;
    const maxAttempts = 10; // 無限ループ防止

    do {
      const randomIndex = Math.floor(Math.random() * tipsData.length);
      selectedTip = tipsData[randomIndex];
      attempts++;
    } while (selectedTip?.id === lastTipId && attempts < maxAttempts);

    setCurrentTip(selectedTip);
    setIsVisible(true);
    setLastTipId(selectedTip?.id);
  }, [lastTipId]);

  /**
   * Tipsを非表示にする
   */
  const hideTip = useCallback(() => {
    setIsVisible(false);
  }, []);

  return {
    currentTip,
    isVisible,
    showRandomTip,
    hideTip,
  };
}
