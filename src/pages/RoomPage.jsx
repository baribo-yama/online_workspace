// src/pages/RoomPage.jsx
import { useParams } from "react-router-dom";

function RoomPage() {
  const { roomId } = useParams();

  return (
    <div>
      <h1>Room: {roomId}</h1>
      <p>ここにタイマーや参加者リストを実装していきます。</p>
    </div>
  );
}

export default RoomPage;
