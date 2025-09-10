// src/pages/Home.jsx
import { useEffect, useState } from "react";
import { collection, addDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { defaultRoom } from "../models/firestore";
import { Users } from "lucide-react";
import PomodoroTimer from "../components/PomodoroTimer";

function Home() {
  const [rooms, setRooms] = useState([]);
  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "rooms"), (snapshot) => {
      const roomsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRooms(roomsData);
    });
    return () => unsubscribe();
  }, []);

  const createRoom = async () => {
    if (!title.trim()) return alert("部屋のタイトルを入力してください");
    if (!name.trim()) return alert("名前を入力してください");

    const docRef = await addDoc(collection(db, "rooms"), {
      ...defaultRoom,
      title: title,
      createdAt: serverTimestamp(),
    });
    setTitle("");
    navigate(`/room/${docRef.id}`, { state: { name } });
  };

  const joinRoom = (roomId) => {
    if (!name.trim()) return alert("名前を入力してください");
    navigate(`/room/${roomId}`, { state: { name } });
  };

  return (
    <div className="flex h-screen bg-gray-900">
      {/* 左側 - 部屋一覧 */}
      <div className="w-1/2 bg-gray-800 border-r border-gray-700 p-6 overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">オンライン自習室</h1>
          <p className="text-gray-400">集中して学習できる環境を選んでください</p>
        </div>

        {/* 部屋を作成ボタン */}
        <div className="mb-6">
          <button
            onClick={createRoom}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg shadow-lg hover:shadow-blue-500/25 transition-all duration-200 flex items-center justify-center gap-2"
          >
            <Users className="w-5 h-5" />
            部屋を作成
          </button>
        </div>

        {/* 作成する部屋のタイトル入力 */}
        <div className="mb-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="部屋のタイトルを入力"
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 名前入力 */}
        <div className="mb-6">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="あなたの名前"
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 部屋一覧 */}
        <div className="space-y-4">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="bg-gray-700 border border-gray-600 rounded-lg p-4 hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-200 cursor-pointer"
              onClick={() => joinRoom(room.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg text-white font-semibold">{room.title || "No Title"}</h3>
                <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full">
                  アクティブ
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-300">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{room.participantsCount || 0}/20</span>
                </div>
                <span className="bg-gray-600 text-gray-300 text-xs px-2 py-1 rounded">
                  数学
                </span>
              </div>
              <div className="mt-2 w-full bg-gray-600 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((room.participantsCount || 0) / 20) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 右側 - ポモドーロタイマー */}
      <div className="w-1/2 flex flex-col items-center justify-center p-8 bg-gradient-to-br from-gray-900 via-gray-800 to-blue-900">
        <PomodoroTimer />
      </div>
    </div>
  );
}

export default Home;
