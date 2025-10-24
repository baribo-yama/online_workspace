import { getRoomsCollection } from './firebase';

// タイマー状態の初期化
export const createInitialTimer = () => ({
  timeLeft: 25 * 60,
  isRunning: false,
  mode: "work",
  cycle: 0,
  startTime: null,
  lastUpdated: null,
  pausedAt: null,
  totalWorkTime: 0,
  totalBreakTime: 0,
});

// rooms の初期形
export const defaultRoom = {
  title: "",
  createdAt: null,
  createdBy: "",
  hostId: "", // ホストのID
  participantsCount: 0,
  maxParticipants: 5, // MVP制限
  isActive: true,
  category: "数学",
  timer: {
    timeLeft: 25 * 60,
    isRunning: false,
    mode: "work",
    cycle: 0,
    startTime: null,
    lastUpdated: null,
    pausedAt: null,
    totalWorkTime: 0,
    totalBreakTime: 0,
  },
  game: {
    status: "idle", // "idle" | "playing"
    startTime: null,
    endTime: null,
    lastUpdated: null,
  },
};

// participants の初期形
export const defaultParticipant = (name = "Guest", isHost = false) => ({
  name,
  joinedAt: null,
  status: "online", // "online" | "away" | "offline"
  isCameraOn: false,
  isMicOn: false,
  lastActivity: null,
  isHost: isHost, // ホストかどうか
});

// signaling メッセージ初期形
export const defaultSignal = (from, type, payload = {}) => ({
  from,
  to: null,
  type, // "offer" | "answer" | "candidate"
  ...payload,
  createdAt: null,
});

// MVP制限設定
export const MVP_LIMITS = {
  MAX_ROOMS: 3,           // 最大部屋数
  MAX_PARTICIPANTS: 5,    // 1部屋あたりの最大参加者数
};

// タイマー関連の定数
export const TIMER_CONSTANTS = {
  SYNC_INTERVAL: 1000,        // 同期間隔（ミリ秒）
  AUTO_SWITCH_THRESHOLD: 0,   // 自動切り替えの閾値（秒）
  LONG_BREAK_CYCLE: 4,       // 長い休憩のサイクル間隔
  MAX_CYCLE: 999,            // 最大サイクル数
};

// 部屋カテゴリ
export const ROOM_CATEGORIES = [
  "数学",
  "英語",
  "プログラミング",
  "資格勉強",
  "読書",
  "その他"
];

// ポモドーロタイマー設定
export const POMODORO_SETTINGS = {
  WORK_DURATION: 25 * 60,    // 作業時間（秒）デフォルト25 * 60
  SHORT_BREAK: 5 * 60,       // 短い休憩（秒） 5 * 60
  LONG_BREAK: 15 * 60,       // 長い休憩（秒）
};

// タイマー状態のスキーマ
export const TIMER_SCHEMA = {
  timeLeft: 0,              // 残り時間（秒）
  isRunning: false,         // 実行中かどうか
  mode: "work",             // "work" | "break" | "longBreak"
  cycle: 0,                 // ポモドーロサイクル数
  startTime: null,          // 開始時刻（Firestore Timestamp）
  lastUpdated: null,        // 最終更新時刻（Firestore Timestamp）
  pausedAt: null,           // 一時停止時刻（Firestore Timestamp）
  totalWorkTime: 0,         // 累計作業時間（秒）
  totalBreakTime: 0,        // 累計休憩時間（秒）
};


// タイマー状態の更新
export const updateTimerState = (currentTimer, updates) => ({
  ...currentTimer,
  ...updates,
  lastUpdated: new Date(),
});

// タイマー状態の検証
export const validateTimerState = (timer) => {
  const required = ['timeLeft', 'isRunning', 'mode', 'cycle'];
  return required.every(field => Object.hasOwn(timer, field));
};

// タイマーモードの切り替え
export const switchTimerMode = (currentMode, cycle) => {
  if (currentMode === "work") {
    // 4サイクルごとに長い休憩
    return cycle % 4 === 0 ? "longBreak" : "break";
  } else {
    return "work";
  }
};

// モードに応じた時間設定
export const getModeDuration = (mode) => {
  switch (mode) {
    case "work":
      return POMODORO_SETTINGS.WORK_DURATION;
    case "break":
      return POMODORO_SETTINGS.SHORT_BREAK;
    case "longBreak":
      return POMODORO_SETTINGS.LONG_BREAK;
    default:
      return POMODORO_SETTINGS.WORK_DURATION;
  }
};

// タイマー状態の計算（クライアント側）
export const calculateTimerState = (timerData) => {
  if (!timerData || !timerData.isRunning || !timerData.startTime) {
    return timerData;
  }

  const startTime = timerData.startTime.toDate ?
    timerData.startTime.toDate().getTime() :
    timerData.startTime;

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const currentTimeLeft = Math.max(0, timerData.timeLeft - elapsed);

  return {
    ...timerData,
    timeLeft: currentTimeLeft,
    // 時間切れの場合は自動的にモード切り替え
    isRunning: currentTimeLeft > 0 ? timerData.isRunning : false,
  };
};

/**
 * ホスト権限を次の参加者に移譲する関数
 * 
 * @param {Object} db - Firestore インスタンス
 * @param {string} roomId - ルームID
 * @param {string} currentHostId - 現在のホストの participantId
 * @returns {Promise<string>} 新ホストの participantId
 * @throws {Error} 権限移譲に失敗した場合
 */
export const transferHostAuthority = async (db, roomId, currentHostId) => {
  const { runTransaction, collection, query, orderBy, getDocs, doc } = await import('firebase/firestore');
  
  try {
    // 1. トランザクション外でルーム内の全参加者を取得
    // 重要：getRoomsCollection() を使ってプレフィックスを正しく適用
    const roomsCollection = getRoomsCollection();
    const participantsRef = collection(roomsCollection, roomId, "participants");
    const participantsQuery = query(participantsRef, orderBy('joinedAt', 'asc'));
    const participantsSnapshot = await getDocs(participantsQuery);
    
    console.log('[transferHostAuthority] Firestore取得結果:', {
      totalDocs: participantsSnapshot.docs.length,
      docs: participantsSnapshot.docs.map(d => ({
        id: d.id,
        data: d.data()
      }))
    });
    
    const participants = participantsSnapshot.docs
      .map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }))
      .filter(p => p.id !== currentHostId); // 現在のホストを除外
    
    console.log('[transferHostAuthority] ホスト除外後:', {
      count: participants.length,
      participants: participants.map(p => ({
        id: p.id,
        isHost: p.isHost,
        name: p.name,
        joinedAt: p.joinedAt
      }))
    });
    
    if (participants.length === 0) {
      // 残存参加者がいない場合
      console.log('残存参加者なし：ルーム終了');
      return null;
    }
    
    // 修正案1追加：ホスト候補がゲスト（isHost=false）であることを確認
    // 重要：isHost が undefined または false の場合を候補対象にする
    const hostCandidates = participants.filter(p => p.isHost !== true);
    
    console.log('[transferHostAuthority] ホスト候補:', {
      count: hostCandidates.length,
      candidates: hostCandidates.map(p => ({
        id: p.id,
        isHost: p.isHost,
        name: p.name
      }))
    });
    
    if (hostCandidates.length === 0) {
      console.error('エラー：有効なホスト候補が見つかりません', {
        allParticipants: participants.length,
        hosts: participants.filter(p => p.isHost === true).length
      });
      throw new Error('権限移譲対象が見つかりません（全員ホスト権限を持っています）');
    }
    
    // 2. 新ホストを決定（ホスト候補のみから選択）
    // joinedAt が最も早い参加者 → doc.id の辞書順
    const newHost = hostCandidates.sort((a, b) => {
      const timeCompare = (a.joinedAt?.toDate?.() || 0) - (b.joinedAt?.toDate?.() || 0);
      if (timeCompare !== 0) return timeCompare;
      return a.id.localeCompare(b.id);
    })[0];
    
    // 3. トランザクション内で権限移譲を実行
    return await runTransaction(db, async (transaction) => {
      console.log('[transferHostAuthority] トランザクション開始');
      
      // 新ホストの isHost を true に更新
      // 重要：getRoomsCollection() でプレフィックスを正しく適用
      transaction.update(
        doc(getRoomsCollection(), roomId, "participants", newHost.id),
        { isHost: true }
      );
      
      console.log('[transferHostAuthority] 新ホストのisHost更新:', newHost.id);
      
      // 現在のホストの参加者ドキュメントを削除
      transaction.delete(
        doc(getRoomsCollection(), roomId, "participants", currentHostId)
      );
      
      console.log('[transferHostAuthority] 旧ホスト削除:', currentHostId);
      
      // ★ 重要追加：ルームドキュメント自体の hostId も更新
      transaction.update(
        doc(getRoomsCollection(), roomId),
        { hostId: newHost.id }
      );
      
      console.log('[transferHostAuthority] ルームドキュメントのhostId更新:', newHost.id);
      console.log('権限移譲完了:', `${currentHostId} → ${newHost.id}`);
      return newHost.id;
    });
    
  } catch (error) {
    console.error('権限移譲処理エラー:', error);
    throw error;
  }
};