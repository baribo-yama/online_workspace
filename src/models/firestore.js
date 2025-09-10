// rooms の初期形
export const defaultRoom = {
  title: "",
  createdAt: null,
  participantsCount: 0,
  timer: {
    state: "stopped",
    startTime: null,
    duration: 1500, // 25分
    cycle: 0,
  },
};

// participants の初期形
export const defaultParticipant = (name = "Guest") => ({
  name,
  joinedAt: null,
  isCameraOn: false,
  isMicOn: false,
  status: "online",
});

// signaling メッセージ初期形
export const defaultSignal = (from, type, payload = {}) => ({
  from,
  to: null,
  type, // "offer" | "answer" | "candidate"
  ...payload,
  createdAt: null,
});
