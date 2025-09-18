// src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";

// 遅延読み込みでコード分割
const HomePage = lazy(() => import("./study-room/components/HomePage"));
const RoomPage = lazy(() => import("./study-room/components/RoomPage"));

function App() {
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
