// src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./study-room/components/HomePage";
import RoomPage from "./study-room/components/RoomPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/room/:roomId" element={<RoomPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
