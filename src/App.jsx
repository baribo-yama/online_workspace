// src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import { auth } from "./shared/services/firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";

// 遅延読み込みでコード分割
const HomePage = lazy(() => import("./features/study-room/components/home/HomePage"));
const RoomPage = lazy(() => import("./features/study-room/components/room/RoomPage"));

function App() {
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    // Firebase認証状態の監視
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        // 未認証なら匿名ログイン（自動実行）
        try {
          const credential = await signInAnonymously(auth);
          console.log('[Auth] 匿名ログイン成功:', credential.user.uid);
        } catch (error) {
          console.error('[Auth] 匿名ログイン失敗:', error);
          // エラーでもアプリは継続（Slack機能のみ無効化）
        }
      } else {
        console.log('[Auth] 既にログイン済み:', currentUser.uid);
      }
      setAuthInitialized(true);
    });

    return () => unsubscribe();
  }, []);

  // 認証初期化完了まで待機
  if (!authInitialized) {
    return (
      <div className="flex h-screen bg-gray-900 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">認証中...</p>
        </div>
      </div>
    );
  }
  return (
    <BrowserRouter>
      <Suspense fallback={
        <div className="flex h-screen bg-gray-900 items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white">読み込み中...</p>
          </div>
        </div>
      }>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/room/:roomId" element={<RoomPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
