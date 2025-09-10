// src/pages/Home.jsx
import { useEffect, useState } from "react";
import { collection, addDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";

function Home() {
  const [rooms, setRooms] = useState([]);
  const [title, setTitle] = useState("");
  const navigate = useNavigate();

  // 部屋一覧をリアルタイム購読
  useEffect(() => {
    console.log("Firestoreからroomsを購読開始");
    const unsubscribe = onSnapshot(collection(db, "rooms"), (snapshot) => {
      const roomsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      console.log("現在のrooms:", roomsData);
      setRooms(roomsData);
    });

    return () => {
      console.log("Firestore購読を解除");
      unsubscribe();
    };
  }, []);

  // 部屋を作成
  const createRoom = async () => {
    console.log("Create Room ボタンが押されました");
    console.log("入力されたタイトル:", title);

    if (!title.trim()) {
      console.log("タイトルが空なので処理を中止しました");
      return;
    }

    try {
      const docRef = await addDoc(collection(db, "rooms"), {
        title: title,
        createdAt: serverTimestamp(),
        participantsCount: 0,
        timer: {
          state: "stopped",
          startTime: null,
          duration: 1500, // 25分
          cycle: 0,
        },
      });
      console.log("部屋を作成しました。Room ID:", docRef.id);

      setTitle("");
      navigate(`/room/${docRef.id}`);
    } catch (error) {
      console.error("部屋作成時にエラー:", error);
    }
  };

  return (
    <div>
      <h1>Online Study Room</h1>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Enter room title"
      />
      <button onClick={createRoom}>Create Room</button>

      <h2>Available Rooms</h2>
      <ul>
        {rooms.map((room) => (
          <li key={room.id}>
            {room.title || "No Title"}{" "}
            <button onClick={() => navigate(`/room/${room.id}`)}>Join</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Home;
