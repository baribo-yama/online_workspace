// シューティングゲームのロジック
import { useState, useRef, useCallback, useEffect } from 'react';

export const useShootingGame = (targetImage, gameConfig = {}) => {
  const {
    gameTime = 30000, // 30秒
    targetCount = 5,   // 同時に表示するターゲット数
    targetSize = 100,  // ターゲットサイズ
    spawnRate = 2000   // ターゲット出現間隔（ミリ秒）
  } = gameConfig;

  const [gameState, setGameState] = useState('waiting'); // waiting, playing, finished
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(gameTime / 1000);
  const [targets, setTargets] = useState([]);
  const [gameArea, setGameArea] = useState({ width: 800, height: 600 });

  const gameAreaRef = useRef(null);
  const gameTimerRef = useRef(null);
  const spawnTimerRef = useRef(null);
  const targetIdCounter = useRef(0);

  // ゲームエリアのサイズを更新
  const updateGameArea = useCallback(() => {
    if (gameAreaRef.current) {
      const rect = gameAreaRef.current.getBoundingClientRect();
      setGameArea({
        width: rect.width,
        height: rect.height
      });
    }
  }, []);

  // ランダムな位置を生成
  const getRandomPosition = useCallback(() => {
    const margin = targetSize / 2;
    return {
      x: Math.random() * (gameArea.width - targetSize - margin * 2) + margin,
      y: Math.random() * (gameArea.height - targetSize - margin * 2) + margin
    };
  }, [gameArea, targetSize]);

  // 新しいターゲットを生成
  const spawnTarget = useCallback(() => {
    console.log('spawnTarget呼び出し:', gameState);
    if (gameState !== 'playing') return;

    setTargets(prev => {
      // 最大数に達している場合は古いものを削除
      const newTargets = prev.length >= targetCount
        ? prev.slice(1)
        : prev;

      const position = getRandomPosition();
      const newTarget = {
        id: targetIdCounter.current++,
        x: position.x,
        y: position.y,
        size: targetSize,
        rotation: Math.random() * 360,
        createdAt: Date.now()
      };

      console.log('新しいターゲット生成:', newTarget);
      return [...newTargets, newTarget];
    });
  }, [gameState, targetCount, getRandomPosition, targetSize]);

  // ターゲットをクリック
  const hitTarget = useCallback((targetId) => {
    setTargets(prev => prev.filter(target => target.id !== targetId));
    setScore(prev => prev + 10);
  }, []);

  // ゲーム開始
  const startGame = useCallback(() => {
    console.log('ゲーム開始:', { gameArea, targetCount, targetSize });
    setGameState('playing');
    setScore(0);
    setTimeLeft(gameTime / 1000);
    setTargets([]);
    targetIdCounter.current = 0;

    // 初期ターゲットを生成
    for (let i = 0; i < Math.min(3, targetCount); i++) {
      setTimeout(() => {
        console.log(`ターゲット${i + 1}を生成中...`);
        spawnTarget();
      }, i * 500);
    }

    // ゲームタイマー
    gameTimerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // ターゲット生成タイマー
    spawnTimerRef.current = setInterval(spawnTarget, spawnRate);

    // ゲーム終了タイマー
    setTimeout(() => {
      setGameState('finished');
    }, gameTime);

  }, [gameTime, targetCount, spawnTarget, spawnRate]);

  // ゲーム終了
  const endGame = useCallback(() => {
    setGameState('finished');
    if (gameTimerRef.current) {
      clearInterval(gameTimerRef.current);
      gameTimerRef.current = null;
    }
    if (spawnTimerRef.current) {
      clearInterval(spawnTimerRef.current);
      spawnTimerRef.current = null;
    }
  }, []);

  // ゲームリセット
  const resetGame = useCallback(() => {
    endGame();
    setGameState('waiting');
    setScore(0);
    setTimeLeft(gameTime / 1000);
    setTargets([]);
  }, [endGame, gameTime]);

  // ゲーム状態が変わったときのクリーンアップ
  useEffect(() => {
    if (gameState === 'finished') {
      endGame();
    }
  }, [gameState, endGame]);

  // コンポーネントのクリーンアップ
  useEffect(() => {
    return () => {
      if (gameTimerRef.current) {
        clearInterval(gameTimerRef.current);
      }
      if (spawnTimerRef.current) {
        clearInterval(spawnTimerRef.current);
      }
    };
  }, []);

  // ウィンドウリサイズ対応
  useEffect(() => {
    updateGameArea();
    window.addEventListener('resize', updateGameArea);
    return () => window.removeEventListener('resize', updateGameArea);
  }, [updateGameArea]);

  return {
    // 状態
    gameState,
    score,
    timeLeft,
    targets,
    gameArea,

    // Refs
    gameAreaRef,

    // アクション
    startGame,
    endGame,
    resetGame,
    hitTarget,
    updateGameArea
  };
};
