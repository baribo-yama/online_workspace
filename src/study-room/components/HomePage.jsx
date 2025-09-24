// src/pages/Home.jsx
import { useEffect, useState } from "react";
import { collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "../../shared/services/firebase";
import { useNavigate } from "react-router-dom";
import { defaultRoom } from "../../shared/services/firestore";
import { Users, RefreshCw } from "lucide-react";
import PersonalTimer from "../../pomodoro-timer/components/PersonalTimer";

function Home() {
  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [rooms, setRooms] = useState([]);
  const [roomParticipants, setRoomParticipants] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // 名前をローカルストレージから復元
  useEffect(() => {
    const savedName = localStorage.getItem("userName");
    if (savedName) {
      setName(savedName);
    }
  }, []);

  // 部屋一覧をリアルタイムで取得（シンプル版）
  useEffect(() => {
    const roomsQuery = query(
      collection(db, "rooms"),
      orderBy("createdAt", "desc"),
      limit(10)
    );

    const unsubscribe = onSnapshot(roomsQuery, async (snapshot) => {
      const roomsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRooms(roomsData);

      // 各部屋の参加者データを取得
      const participantsData = {};
      for (const room of roomsData) {
        try {
          const participantsQuery = query(
            collection(db, "rooms", room.id, "participants"),
            orderBy("joinedAt", "asc")
          );
          
          const participantsSnapshot = await new Promise((resolve, reject) => {
            const unsubscribeParticipants = onSnapshot(participantsQuery, resolve, reject);
            // 即座にunsubscribeして一回だけ取得
            setTimeout(() => unsubscribeParticipants(), 100);
          });

          const participants = participantsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          // アクティブな参加者のみをフィルタ（5分以内）
          const now = Date.now();
          const activeParticipants = participants.filter(participant => {
            if (participant.joinedAt) {
              const joinedTime = participant.joinedAt.toDate ?
                participant.joinedAt.toDate().getTime() :
                participant.joinedAt;
              return (now - joinedTime) <= 300000; // 5分以内
            }
            return true;
          });

          participantsData[room.id] = activeParticipants.map(p => p.name);
        } catch (error) {
          console.error(`部屋 ${room.id} の参加者取得エラー:`, error);
          participantsData[room.id] = [];
        }
      }

      setRoomParticipants(participantsData);
      setLoading(false);
    }, (error) => {
      console.error("部屋一覧取得エラー:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 名前が変更されたらローカルストレージに保存
  const handleNameChange = (e) => {
    const newName = e.target.value;
    setName(newName);
    if (newName.trim()) {
      localStorage.setItem("userName", newName.trim());
    }
  };

  // シンプルな部屋作成
  const createRoom = async () => {
    if (!title.trim()) {
      alert("部屋のタイトルを入力してください");
      return;
    }
    if (!name.trim()) {
      alert("名前を入力してください");
      return;
    }

    // 現在の部屋数をチェック（シンプル）
    if (rooms.length >= 3) {
      alert("現在、同時に存在できる部屋数の上限（3部屋）に達しています。\nしばらく時間をおいてからお試しください。");
      return;
    }

    try {
      const docRef = await addDoc(collection(db, "rooms"), {
        ...defaultRoom,
        title: title.trim(),
        createdAt: serverTimestamp(),
      });

      console.log("部屋作成成功:", docRef.id);
      setTitle("");
      navigate(`/room/${docRef.id}`, { state: { name: name.trim() } });
    } catch (error) {
      console.error("部屋作成エラー:", error);
      alert("部屋の作成に失敗しました。もう一度お試しください。");
    }
  };

  const joinRoom = (roomId) => {
    if (!name.trim()) {
      alert("名前を入力してください");
      return;
    }
    console.log("部屋に参加:", { roomId, name: name.trim() });
    navigate(`/room/${roomId}`, { state: { name: name.trim() } });
  };

  return (
    <div className="flex h-screen bg-gray-900">
      {/* 左側 - 部屋一覧 */}
      <div className="w-1/2 bg-gray-800 border-r border-gray-700 p-6 overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">オンライン自習室</h1>
          <p className="text-gray-400">集中して学習できる環境を選んでください</p>
          <p className="text-gray-400 text-sm mt-1">
            現在の部屋数: {rooms.length}/3 (MVP制限)
          </p>
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
            onChange={handleNameChange}
            placeholder="あなたの名前"
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {name && (
            <p className="text-xs text-gray-400 mt-1">
              名前は自動的に保存されます
            </p>
          )}
        </div>

        {/* 部屋を作成ボタン */}
        <div className="mb-6">
          <button
            onClick={createRoom}
            disabled={rooms.length >= 3}
            className={`w-full font-semibold py-3 px-4 rounded-lg shadow-lg transition-all duration-200 flex items-center justify-center gap-2 ${
              rooms.length < 3
                ? 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-blue-500/25'
                : 'bg-gray-600 text-gray-300 cursor-not-allowed'
            }`}
          >
            <Users className="w-5 h-5" />
            部屋を作成
          </button>
          {rooms.length >= 3 && (
            <div className="mt-2 p-3 bg-red-900/50 border border-red-600 rounded text-red-200 text-sm">
              同時に存在できる部屋数の上限（3部屋）に達しています
            </div>
          )}
        </div>

        {/* 部屋一覧 */}
        <div className="space-y-4">
          {loading && (
            <div className="text-center py-8">
              <p className="text-gray-400">部屋一覧を読み込み中...</p>
            </div>
          )}

          {!loading && rooms.length > 0 && rooms.map((room) => (
            <div
              key={room.id}
              className="bg-gray-700 border border-gray-600 rounded-lg p-4 hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-200 cursor-pointer"
              onClick={() => joinRoom(room.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg text-white font-semibold">{room.title || "無題の部屋"}</h3>
                <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full">
                  アクティブ
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-300 mb-2">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{room.participantsCount || 0}/5</span>
                </div>
                <span className="bg-gray-600 text-gray-300 text-xs px-2 py-1 rounded">
                  {room.subject || "一般"}
                </span>
              </div>
              {/* 参加者名表示 */}
              {roomParticipants[room.id] && roomParticipants[room.id].length > 0 && (
                <div className="text-xs text-gray-400">
                  <span className="text-gray-500">参加者：</span>
                  {roomParticipants[room.id].join("　")}
                </div>
              )}
            </div>
          ))}

          {!loading && rooms.length === 0 && (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">現在アクティブな部屋がありません</p>
              <p className="text-gray-500 text-sm mt-1">新しい部屋を作成してみましょう</p>
            </div>
          )}
        </div>
      </div>

      {/* 右側 - 個人用ポモドーロタイマー */}
      <div className="w-1/2 flex flex-col items-center justify-center p-8 bg-gradient-to-br from-gray-900 via-gray-800 to-blue-900">
        <PersonalTimer />
      </div>
    </div>
  );
}

export default Home;
