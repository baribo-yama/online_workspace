// src/pages/RoomPage.jsx
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  doc,
  deleteDoc,
  collection,
  addDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  query,
  limit,
  orderBy
} from "firebase/firestore";
import { db } from "../firebase";
import { useEffect, useState, useRef } from "react";
import { defaultParticipant } from "../models/firestore";
import { ArrowLeft, Users, LogOut, X, Home, Trash2 } from "lucide-react";
import EnhancedPomodoroTimer from "../components/EnhancedPomodoroTimer";
import ShootingGame from "../features/shooting-game/ShootingGame";

function RoomPage() {
  const { roomId } = useParams();
  const { state } = useLocation();
  const userName = state?.name || localStorage.getItem("userName") || "Guest";

  console.log("RoomPage レンダリング開始:", { roomId, userName, state });

  const navigate = useNavigate();
  const [myParticipantId, setMyParticipantId] = useState(null);
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState([]);
  const [participantsLoading, setParticipantsLoading] = useState(true);
  const [showTestGame, setShowTestGame] = useState(false);
  const [roomTimer, setRoomTimer] = useState({
    timeLeft: 25 * 60,
    isRunning: false,
    mode: 'work',
    cycle: 0,
    startTime: null
  });
  const isUnmountingRef = useRef(false);

  useEffect(() => {
    setMyParticipantId(localStorage.getItem(`participantId_${roomId}`));
  }, [roomId]);

  // 参加者リストの取得（クリーンアップ機能付き）
  useEffect(() => {
    console.log("参加者データ取得開始:", roomId);
    const participantsQuery = query(
      collection(db, "rooms", roomId, "participants"),
      orderBy("joinedAt", "asc"),
      limit(10)
    );

    const unsubscribe = onSnapshot(participantsQuery, async (snapshot) => {
      console.log("参加者データ更新:", snapshot.docs.length, "件");
      const participantsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // 古い参加者データをクリーンアップ（5分以上前のデータ）
      const now = Date.now();
      const oldParticipants = participantsData.filter(participant => {
        if (participant.joinedAt) {
          const joinedTime = participant.joinedAt.toDate ?
            participant.joinedAt.toDate().getTime() :
            participant.joinedAt;
          return (now - joinedTime) > 300000; // 5分以上前
        }
        return false;
      });

      // 古い参加者を削除
      oldParticipants.forEach(async (participant) => {
        try {
          await deleteDoc(doc(db, "rooms", roomId, "participants", participant.id));
          console.log("古い参加者を削除:", participant.name);
        } catch (error) {
          console.error("古い参加者削除エラー:", error);
        }
      });

      // アクティブな参加者のみを表示
      const activeParticipants = participantsData.filter(participant => {
        if (participant.joinedAt) {
          const joinedTime = participant.joinedAt.toDate ?
            participant.joinedAt.toDate().getTime() :
            participant.joinedAt;
          return (now - joinedTime) <= 300000; // 5分以内
        }
        return true;
      });

      console.log("アクティブ参加者:", activeParticipants.length, "人");
      setParticipants(activeParticipants);
      setParticipantsLoading(false);
    }, (error) => {
      console.error("参加者データ取得エラー:", error);
      setParticipantsLoading(false);
    });

    return () => unsubscribe();
  }, [roomId]);

  // 部屋のタイマー状態を監視
  useEffect(() => {
    if (!roomId) return;

    const roomDocRef = doc(db, "rooms", roomId);
    const unsubscribe = onSnapshot(roomDocRef, (doc) => {
      if (doc.exists()) {
        const roomData = doc.data();
        if (roomData.timer) {
          const timerData = roomData.timer;

          // タイマーが実行中の場合、経過時間を計算
          let currentTimeLeft = timerData.timeLeft;
          let isRunning = timerData.isRunning || false;

          if (timerData.isRunning && timerData.startTime) {
            const startTime = timerData.startTime.toDate ?
              timerData.startTime.toDate().getTime() :
              timerData.startTime;
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            currentTimeLeft = Math.max(0, timerData.timeLeft - elapsed);

            // タイマーが0になったら自動停止
            if (currentTimeLeft === 0 && timerData.isRunning) {
              console.log('タイマーが0になりました。自動停止します。');
              isRunning = false;
              // Firestoreでタイマーを停止（非同期で実行）
              setTimeout(async () => {
                try {
                  await updateDoc(doc(db, "rooms", roomId), {
                    timer: {
                      ...timerData,
                      isRunning: false,
                      startTime: null,
                      lastUpdated: serverTimestamp()
                    }
                  });
                } catch (error) {
                  console.error("タイマー自動停止エラー:", error);
                }
              }, 0);
            }
          }

          setRoomTimer({
            timeLeft: currentTimeLeft,
            isRunning: isRunning,
            mode: timerData.mode || 'work',
            cycle: timerData.cycle || 0,
            startTime: timerData.startTime
          });
        }
      }
    }, (error) => {
      console.error("タイマー状態取得エラー:", error);
    });

    return () => unsubscribe();
  }, [roomId]);

  const leaveRoom = async () => {
    if (myParticipantId) {
      try {
        // 参加者データを削除
        await deleteDoc(doc(db, "rooms", roomId, "participants", myParticipantId));
        console.log("参加者が退出しました:", myParticipantId);

        // localStorageからも削除
        localStorage.removeItem(`participantId_${roomId}`);
        localStorage.removeItem(`delete_participant_${myParticipantId}`);

        // 状態をリセット
        setMyParticipantId(null);
      } catch (error) {
        console.error("退出処理でエラーが発生しました:", error);
      }
    }
    navigate("/");
  };

  const endRoom = async () => {
    const confirmEnd = window.confirm(
      "この部屋を終了しますか？\n\n部屋を終了すると、すべての参加者が退出され、部屋のデータが削除されます。この操作は取り消せません。"
    );

    if (confirmEnd) {
      try {
        await deleteDoc(doc(db, "rooms", roomId));
        console.log("部屋が終了されました:", roomId);
        navigate("/");
      } catch (error) {
        console.error("部屋終了でエラーが発生しました:", error);
        alert("部屋の終了に失敗しました。もう一度お試しください。");
      }
    }
  };

  // テスト用ゲーム開始
  const startTestGame = () => {
    setShowTestGame(true);
  };

  // ゲーム終了時の処理
  const handleGameEnd = (score) => {
    console.log(`テストゲーム終了！スコア: ${score}`);
    setShowTestGame(false);
  };

  // タイマー制御関数
  const updateRoomTimer = async (timerUpdate) => {
    try {
      await updateDoc(doc(db, "rooms", roomId), {
        timer: {
          ...roomTimer,
          ...timerUpdate,
          lastUpdated: serverTimestamp()
        }
      });
    } catch (error) {
      console.error("タイマー更新エラー:", error);
    }
  };

  const startTimer = () => {
    updateRoomTimer({
      isRunning: true,
      startTime: serverTimestamp()
    });
  };

  const pauseTimer = () => {
    updateRoomTimer({
      isRunning: false,
      startTime: null
    });
  };

  const resetTimer = () => {
    updateRoomTimer({
      timeLeft: roomTimer.mode === 'work' ? 25 * 60 : 5 * 60,
      isRunning: false,
      startTime: null
    });
  };

  const switchMode = (newMode) => {
    const newTimeLeft = newMode === 'work' ? 25 * 60 : 5 * 60;
    updateRoomTimer({
      mode: newMode,
      timeLeft: newTimeLeft,
      isRunning: false,
      startTime: null,
      cycle: newMode === 'work' ? roomTimer.cycle + 1 : roomTimer.cycle
    });
  };

  // 部屋情報と参加者登録（シンプル版）
  useEffect(() => {
    let participantId = null;
    let unsubRoom = null;
    isUnmountingRef.current = false;

    const initRoom = async () => {
      console.log("部屋データ取得開始:", roomId);
      // 部屋情報リスナー
      unsubRoom = onSnapshot(doc(db, "rooms", roomId), (doc) => {
        console.log("部屋データ更新:", doc.exists(), doc.data());
        if (doc.exists()) {
          setRoom(doc.data());
          setLoading(false);
        } else {
          console.log("部屋が見つかりません:", roomId);
          alert("部屋が見つかりません");
          navigate("/");
        }
      }, (error) => {
        console.error("部屋データ取得エラー:", error);
        setLoading(false);
      });

      // 参加者として追加
      try {
        console.log("参加者として追加中:", userName);
        const docRef = await addDoc(collection(db, "rooms", roomId, "participants"), {
          ...defaultParticipant(userName),
          joinedAt: serverTimestamp(),
        });
        participantId = docRef.id;
        console.log("参加者ID:", participantId);
        if (!isUnmountingRef.current) {
          setMyParticipantId(docRef.id);
        }
        localStorage.setItem(`participantId_${roomId}`, docRef.id);
      } catch (error) {
        console.error("参加者登録エラー:", error);
      }
    };

    initRoom();

    // ページ離脱時の処理（シンプル版）
    const handleBeforeUnload = () => {
      if (participantId) {
        // localStorageに削除フラグを設定
        localStorage.setItem(`delete_participant_${participantId}`, JSON.stringify({
          roomId: roomId,
          participantId: participantId,
          timestamp: Date.now()
        }));
      }
    };

    // ページ離脱イベントを登録
    window.addEventListener('beforeunload', handleBeforeUnload);

    // クリーンアップ関数
    return () => {
      isUnmountingRef.current = true;

      // イベントリスナーを削除
      window.removeEventListener('beforeunload', handleBeforeUnload);

      // リスナーを停止
      if (unsubRoom) unsubRoom();

      // 参加者データを削除（確実に実行）
      if (participantId) {
        deleteDoc(doc(db, "rooms", roomId, "participants", participantId))
          .then(() => {
            console.log("クリーンアップ: 参加者データを削除しました", participantId);
            // localStorageからも削除
            localStorage.removeItem(`participantId_${roomId}`);
            localStorage.removeItem(`delete_participant_${participantId}`);
          })
          .catch((error) => {
            console.error("クリーンアップ: 参加者データ削除エラー", error);
          });
      }
    };
  }, [roomId, userName]);

  if (loading) {
    console.log("ローディング画面を表示中");
    return (
      <div className="flex h-screen bg-gray-900 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">部屋を読み込み中...</p>
        </div>
      </div>
    );
  }

  console.log("メインレンダリング開始:", { room, participants, loading, participantsLoading });

  return (
    <div className="flex h-screen bg-gray-900">
      {/* 左半分 - 参加者一覧 */}
      <div className="w-1/2 bg-gray-800 border-r border-gray-700 p-6 flex flex-col">
        {/* MVP制限情報表示 */}
        <div className="mb-4 p-3 bg-purple-900/20 border border-purple-500 rounded text-purple-200 text-sm">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4" />
            <span className="font-semibold">MVP版制限</span>
          </div>
          <p>最大5人まで参加可能（ホスト含む）</p>
        </div>

        {/* ヘッダー */}
        <div className="mb-6">
          <div className="flex gap-2 mb-4">
            <button
              onClick={leaveRoom}
              className="flex items-center gap-2 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 px-3 py-2 rounded-lg transition-all duration-200 border border-transparent hover:border-blue-500/30"
            >
              <Home className="w-4 h-4" />
              ルーム一覧に戻る
            </button>

            <button
              onClick={endRoom}
              className="flex items-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 px-3 py-2 rounded-lg transition-all duration-200 border border-transparent hover:border-red-500/30"
            >
              <Trash2 className="w-4 h-4" />
              部屋を終了
            </button>
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">
            {room?.title || "勉強部屋"}
          </h1>

          <div className="flex items-center gap-2 text-gray-400">
            <Users className="w-4 h-4" />
            <span>
              {participantsLoading ? "読み込み中..." : `${participants?.length || 0}人参加中`}
              <span className="text-xs ml-1">
                (上限: 5人)
              </span>
            </span>
            <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded ml-2">
              数学
            </span>
          </div>
        </div>

        {/* 参加者セクション */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white">参加者</h2>
              <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full">
                {participants?.length || 0}人
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={startTestGame}
                className="bg-orange-600 hover:bg-orange-700 px-3 py-1 rounded text-white text-sm font-medium transition-colors flex items-center gap-2"
              >
                🎯 ゲーム
              </button>
            </div>
          </div>

          <p className="text-gray-400 text-sm mb-6">一緒に勉強している仲間たち</p>

          <div className="space-y-3">
            {participantsLoading && (
              <div className="text-center py-4">
                <p className="text-gray-400 text-sm">参加者を読み込み中...</p>
              </div>
            )}

            {!participantsLoading && participants?.map((participant, index) => {
              const isCurrentUser = participant.id === myParticipantId;

              return (
                <div
                  key={participant.id}
                  className="bg-gray-700 rounded-lg p-4 border border-gray-600 hover:bg-gray-650 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {/* 参加者のアバター */}
                    <div className="relative">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                        isCurrentUser ? 'bg-blue-500' : 'bg-green-500'
                      }`}>
                        {participant.name ? participant.name.charAt(0).toUpperCase() : "U"}
                      </div>
                      {/* オンライン状態インジケーター */}
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-gray-800 bg-green-500" />
                    </div>

                    {/* 参加者名 */}
                    <div className="flex-1">
                      <p className="text-white font-medium">
                        {participant.name || `ユーザー${index + 1}`}
                        {isCurrentUser && (
                          <span className="text-blue-400 text-xs ml-2">(あなた)</span>
                        )}
                      </p>
                      <p className="text-xs flex items-center gap-1 text-green-400">
                        <div className="w-2 h-2 rounded-full bg-green-400" />
                        オンライン
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {!participantsLoading && (!participants || participants.length === 0) && (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                <p className="text-gray-400">まだ参加者がいません</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 右半分 - ポモドーロタイマー */}
      <div className="w-1/2 bg-gray-900 p-6">
        <EnhancedPomodoroTimer
          timer={roomTimer}
          onStart={startTimer}
          onPause={pauseTimer}
          onReset={resetTimer}
          onModeChange={switchMode}
          onGameStart={() => setShowTestGame(true)}
        />
      </div>

      {/* テスト用ゲームオーバーレイ */}
      {showTestGame && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="max-w-4xl w-full mx-4">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-white mb-2">
                🎯 シューティングゲーム
              </h2>
              <p className="text-gray-300 text-lg">
                ターゲットをクリックしてスコアを稼ごう！
              </p>
            </div>

            <ShootingGame
              targetImage={null}
              onGameEnd={handleGameEnd}
              gameConfig={{
                gameTime: 30000, // 30秒
                targetCount: 10,
                targetSize: 80,
                spawnRate: 1200
              }}
            />

            <div className="text-center mt-4">
              <button
                onClick={() => setShowTestGame(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ゲームを終了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RoomPage;
