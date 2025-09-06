import React, { useState, useEffect } from 'react';
import {
  Clock,
  Users,
  Play,
  Pause,
  RotateCcw,
  Video,
  VideoOff,
  Mic,
  ArrowLeft,
} from 'lucide-react';
import Button from './components/Button';
import Badge from './components/Badge';
import { Card, CardHeader, CardTitle, CardContent } from './components/Card';

const studyRooms = [
  { id: "1", name: "数学集中部屋", participants: 12, maxParticipants: 20, category: "数学", isActive: true },
  { id: "2", name: "英語学習ルーム", participants: 8, maxParticipants: 15, category: "英語", isActive: true },
  { id: "3", name: "プログラミング勉強会", participants: 15, maxParticipants: 25, category: "IT", isActive: true },
  { id: "4", name: "資格試験対策", participants: 6, maxParticipants: 12, category: "資格", isActive: false },
  { id: "5", name: "大学受験対策", participants: 20, maxParticipants: 30, category: "受験", isActive: true },
  { id: "6", name: "語学交換", participants: 4, maxParticipants: 10, category: "語学", isActive: false },
];

const mockParticipants = [
  { id: "1", name: "田中さん", isVideoOn: true, isMuted: false },
  { id: "2", name: "佐藤さん", isVideoOn: false, isMuted: true },
  { id: "3", name: "山田さん", isVideoOn: true, isMuted: false },
  { id: "4", name: "鈴木さん", isVideoOn: true, isMuted: true },
  { id: "5", name: "高橋さん", isVideoOn: false, isMuted: false },
  { id: "6", name: "渡辺さん", isVideoOn: true, isMuted: false },
];

export default function StudyRoomApp() {
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes in seconds
  const [isRunning, setIsRunning] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);

  useEffect(() => {
    let interval = null;

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsRunning(false);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, timeLeft]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStart = () => setIsRunning(!isRunning);
  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(25 * 60);
  };

  const progress = ((25 * 60 - timeLeft) / (25 * 60)) * 100;

  const getSelectedRoom = () => studyRooms.find((room) => room.id === selectedRoom);

  const exitRoom = () => setSelectedRoom(null);

  if (selectedRoom) {
    const currentRoom = getSelectedRoom();

    return (
      <div className="flex h-screen bg-gray-900">
        {/* Left Section - Pomodoro Timer in Room */}
        <div className="w-1/2 flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-blue-900 p-8">
          {/* Room Header */}
          <div className="mb-6">
            <Button
              onClick={exitRoom}
              variant="outline"
              className="mb-4 bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              ルーム一覧に戻る
            </Button>
            <h2 className="text-2xl font-bold text-white mb-2">{currentRoom?.name}</h2>
            <div className="flex items-center gap-4 text-gray-300">
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span>{currentRoom?.participants}人参加中</span>
              </div>
              <Badge variant="outline" className="border-gray-500 text-gray-300">
                {currentRoom?.category}
              </Badge>
            </div>
          </div>

          {/* Timer Display */}
          <div className="flex-1 flex flex-col items-center justify-center space-y-6">
            <div className="relative">
              <div className="w-64 h-64 rounded-full border-8 border-gray-700 flex items-center justify-center relative overflow-hidden shadow-2xl shadow-blue-500/20">
                <div
                  className="absolute inset-0 rounded-full border-8 border-transparent"
                  style={{
                    background: `conic-gradient(from 0deg, #3b82f6 ${progress}%, transparent ${progress}%)`,
                    mask: "radial-gradient(circle, transparent 50%, black 50%)",
                    WebkitMask: "radial-gradient(circle, transparent 50%, black 50%)",
                  }}
                />
                <div className="text-6xl font-mono font-bold text-white z-10 drop-shadow-lg filter drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]">
                  {formatTime(timeLeft)}
                </div>
              </div>
            </div>

            {/* Timer Controls */}
            <div className="flex gap-4 justify-center">
              <Button
                onClick={handleStart}
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 font-semibold shadow-lg hover:shadow-blue-500/25 transition-all duration-200"
              >
                {isRunning ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    一時停止
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    開始
                  </>
                )}
              </Button>
              <Button
                onClick={handleReset}
                variant="outline"
                size="lg"
                className="px-6 py-3 font-semibold bg-gray-700 border-gray-600 text-white hover:bg-gray-600 hover:border-gray-500 shadow-lg transition-all duration-200"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                リセット
              </Button>
            </div>

            <div className="flex items-center justify-center gap-2 text-gray-300">
              <Clock className="w-4 h-4" />
              <span className="font-medium">
                {isRunning ? "集中時間中..." : timeLeft === 0 ? "完了！" : "準備完了"}
              </span>
            </div>
          </div>
        </div>

        {/* Right Section - Participant Cameras */}
        <div className="w-1/2 bg-gray-800 border-l border-gray-700 p-6">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-white mb-2">参加者</h3>
            <p className="text-gray-400">一緒に頑張っている仲間たち</p>
          </div>

          <div className="grid grid-cols-2 gap-4 h-[calc(100vh-200px)] overflow-y-auto">
            {mockParticipants.map((participant) => (
              <Card key={participant.id} className="bg-gray-700 border-gray-600 h-48">
                <CardContent className="p-4 h-full flex flex-col">
                  <div className="flex-1 bg-gray-800 rounded-lg flex items-center justify-center relative overflow-hidden">
                    {participant.isVideoOn ? (
                      <div className="w-full h-full bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center">
                        <span className="text-white font-semibold">{participant.name}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <VideoOff className="w-8 h-8 mb-2" />
                        <span className="text-sm">{participant.name}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 text-center">
                    <p className="text-white font-medium text-sm">{participant.name}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Control buttons */}
          <div className="mt-6 flex justify-center gap-4">
            <Button variant="outline" size="sm" className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600">
              <Video className="w-4 h-4 mr-2" />
              カメラ
            </Button>
            <Button variant="outline" size="sm" className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600">
              <Mic className="w-4 h-4 mr-2" />
              マイク
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Left Sidebar - Room List */}
      <div className="w-1/2 bg-gray-800 border-r border-gray-700 p-6 overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">オンライン自習室</h1>
          <p className="text-gray-400">集中して学習できる環境を選んでください</p>
        </div>

        <div className="mb-6">
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg shadow-lg hover:shadow-blue-500/25 transition-all duration-200"
            size="lg"
          >
            <Users className="w-5 h-5 mr-2" />
            部屋を作成
          </Button>
        </div>

        <div className="space-y-4">
          {studyRooms.map((room) => (
            <Card
              key={room.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/20 bg-gray-700 border-gray-600 ${
                selectedRoom === room.id ? "ring-2 ring-blue-500 bg-gray-600" : ""
              }`}
              onClick={() => setSelectedRoom(room.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-white">{room.name}</CardTitle>
                  <Badge
                    variant={room.isActive ? "default" : "secondary"}
                    className={
                      room.isActive ? "bg-green-600 hover:bg-green-700 text-white" : "bg-gray-600 text-gray-300"
                    }
                  >
                    {room.isActive ? "アクティブ" : "待機中"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-gray-300">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>
                      {room.participants}/{room.maxParticipants}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs border-gray-500 text-gray-300">
                    {room.category}
                  </Badge>
                </div>
                <div className="mt-2 w-full bg-gray-600 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(room.participants / room.maxParticipants) * 100}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Right Section - Pomodoro Timer */}
      <div className="w-1/2 flex flex-col items-center justify-center p-8 bg-gradient-to-br from-gray-900 via-gray-800 to-blue-900">
        <div className="text-center space-y-8">
          <div>
            <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
              ポモドーロタイマー
            </h2>
            <p className="text-gray-300 text-lg">25分間集中して学習しましょう</p>
          </div>

          {/* Timer Display */}
          <div className="relative">
            <div className="w-72 h-72 rounded-full border-8 border-gray-700 flex items-center justify-center relative overflow-hidden shadow-2xl shadow-blue-500/20">
              {/* Progress Ring */}
              <div
                className="absolute inset-0 rounded-full border-8 border-transparent"
                style={{
                  background: `conic-gradient(from 0deg, #3b82f6 ${progress}%, transparent ${progress}%)`,
                  mask: "radial-gradient(circle, transparent 50%, black 50%)",
                  WebkitMask: "radial-gradient(circle, transparent 50%, black 50%)",
                }}
              />
              <div className="text-7xl font-mono font-bold text-white z-10 drop-shadow-lg filter drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]">
                {formatTime(timeLeft)}
              </div>
            </div>
          </div>

          {/* Timer Controls */}
          <div className="flex gap-4 justify-center">
            <Button
              onClick={handleStart}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg font-semibold shadow-lg hover:shadow-blue-500/25 transition-all duration-200"
            >
              {isRunning ? (
                <>
                  <Pause className="w-5 h-5 mr-2" />
                  一時停止
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  開始
                </>
              )}
            </Button>
            <Button
              onClick={handleReset}
              variant="outline"
              size="lg"
              className="px-8 py-3 text-lg font-semibold bg-gray-700 border-gray-600 text-white hover:bg-gray-600 hover:border-gray-500 shadow-lg transition-all duration-200"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              リセット
            </Button>
          </div>

          {/* Timer Status */}
          <div className="flex items-center justify-center gap-2 text-gray-300 text-lg">
            <Clock className="w-5 h-5" />
            <span className="font-medium">{isRunning ? "集中時間中..." : timeLeft === 0 ? "完了！" : "準備完了"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
