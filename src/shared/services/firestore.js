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
