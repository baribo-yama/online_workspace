const metricsContainer = document.getElementById("metrics");
const roomsTableBody = document.querySelector("#roomsTable tbody");
const detailsCard = document.getElementById("roomDetails");
const logsList = document.getElementById("logsList");
const refreshButton = document.getElementById("refreshRooms");

const mockMetrics = [
  {
    title: "LiveKit合計利用時間",
    value: "182 分",
    delta: "+12%",
    positive: true,
  },
  {
    title: "本日の接続セッション",
    value: "24 件",
    delta: "+4",
    positive: true,
  },
  {
    title: "ピーク同時接続",
    value: "8 名",
    delta: "-2",
    positive: false,
  },
  {
    title: "Firestore読み取り",
    value: "3.1k",
    delta: "+220",
    positive: false,
  },
];

const mockRooms = [
  {
    id: "room-101",
    name: "朝活もくもく会",
    status: "active",
    participants: [
      { name: "Yuki", joinedAt: Date.now() - 38 * 60 * 1000 },
      { name: "Ken", joinedAt: Date.now() - 30 * 60 * 1000 },
    ],
    host: "Yuki",
    startedAt: Date.now() - 42 * 60 * 1000,
    tags: ["集中", "ペアプロ"]
  },
  {
    id: "room-202",
    name: "英語学習ルーム",
    status: "active",
    participants: [
      { name: "Aya", joinedAt: Date.now() - 55 * 60 * 1000 },
      { name: "Tomo", joinedAt: Date.now() - 7 * 60 * 1000 },
      { name: "Rio", joinedAt: Date.now() - 5 * 60 * 1000 },
    ],
    host: "Aya",
    startedAt: Date.now() - 60 * 60 * 1000,
    tags: ["英会話"]
  },
  {
    id: "room-303",
    name: "資格試験ラボ",
    status: "idle",
    participants: [
      { name: "Mei", joinedAt: Date.now() - 12 * 60 * 1000 },
    ],
    host: "Satoshi",
    startedAt: Date.now() - 120 * 60 * 1000,
    tags: ["TOEIC", "勉強会"]
  },
];

const mockLogs = [
  { time: "09:12", message: "Ken が \"朝活もくもく会\" に参加" },
  { time: "09:04", message: "管理者が LiveKit 日次利用量を更新" },
  { time: "08:55", message: "Aya が ルーム \"英語学習ルーム\" を開始" },
  { time: "08:00", message: "定期ジョブ: Firestore 使用量記録" },
];

let selectedRoomId = null;

function renderMetrics() {
  metricsContainer.innerHTML = mockMetrics
    .map(
      (metric) => `
        <article class="metric-card">
          <span class="metric-title">${metric.title}</span>
          <span class="metric-value">${metric.value}</span>
          <span class="metric-delta ${metric.positive ? "" : "negative"}">
            ${metric.positive ? "▲" : "▼"} ${metric.delta}
          </span>
        </article>
      `
    )
    .join("");
}

function formatDuration(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `${hours}時間 ${minutes}分`;
  }
  return `${minutes}分`;
}

function renderRooms() {
  roomsTableBody.innerHTML = mockRooms
    .map((room) => {
      const isActive = room.status === "active";
      const participantNames = room.participants.map((p) => p.name).join(", ");
      const duration = Date.now() - room.startedAt;
      return `
        <tr data-room-id="${room.id}" class="room-row ${
        selectedRoomId === room.id ? "selected" : ""
      }">
          <td>
            <div class="room-name">${room.name}</div>
            <div class="room-tags">
              ${room.tags.map((tag) => `<span class="tag">${tag}</span>`).join(" ")}
            </div>
          </td>
          <td><span class="badge ${isActive ? "active" : "idle"}">${
        isActive ? "稼働中" : "待機"
      }</span></td>
          <td>${room.participants.length}名<br /><span class="muted">${participantNames}</span></td>
          <td>${new Date(room.startedAt).toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
      })}</td>
          <td data-duration="${room.startedAt}">${formatDuration(duration)}</td>
          <td>
            <button class="btn btn-secondary btn-view" data-room="${room.id}">詳細</button>
            <button class="btn btn-danger btn-close" data-room="${room.id}">終了</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderLogs() {
  logsList.innerHTML = mockLogs
    .map(
      (log) => `
        <li class="log-item">
          <span>${log.message}</span>
          <span class="log-time">${log.time}</span>
        </li>
      `
    )
    .join("");
}

function renderDetails(roomId) {
  const room = mockRooms.find((r) => r.id === roomId);
  if (!room) {
    detailsCard.innerHTML = `
      <div class="card-header"><h2>ルーム詳細</h2></div>
      <div class="details-body empty">部屋が見つかりませんでした。</div>
    `;
    return;
  }

  detailsCard.innerHTML = `
    <div class="card-header">
      <h2>${room.name}</h2>
    </div>
    <div class="details-body">
      <div>
        <div class="details-label">ホスト</div>
        <div>${room.host}</div>
      </div>
      <div>
        <div class="details-label">状態</div>
        <div><span class="badge ${room.status === "active" ? "active" : "idle"}">${
    room.status === "active" ? "稼働中" : "待機"
  }</span></div>
      </div>
      <div>
        <div class="details-label">経過時間</div>
        <div id="detailsDuration">${formatDuration(
          Date.now() - room.startedAt
        )}</div>
      </div>
      <div>
        <div class="details-label">参加者</div>
        <div class="participants-list">
          ${room.participants
            .map(
              (p) => `
                <div class="participant-item">
                  <span class="participant-name">${p.name}</span>
                  <span class="participant-time">${formatDuration(
                    Date.now() - p.joinedAt
                  )} 前から参加中</span>
                </div>
              `
            )
            .join("")}
        </div>
      </div>
      <div class="details-actions">
        <button class="btn btn-secondary btn-ghost">チャットログを見る</button>
        <button class="btn btn-danger" data-room="${room.id}">この部屋を終了</button>
      </div>
    </div>
  `;
}

function updateDurations() {
  document
    .querySelectorAll("[data-duration]")
    .forEach((cell) => {
      const startedAt = Number(cell.getAttribute("data-duration"));
      cell.textContent = formatDuration(Date.now() - startedAt);
    });

  if (selectedRoomId) {
    const room = mockRooms.find((r) => r.id === selectedRoomId);
    if (room) {
      const detailsDuration = document.getElementById("detailsDuration");
      if (detailsDuration) {
        detailsDuration.textContent = formatDuration(Date.now() - room.startedAt);
      }
    }
  }
}

function addLog(message) {
  const now = new Date();
  const time = now.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
  mockLogs.unshift({ time, message });
  renderLogs();
}

roomsTableBody.addEventListener("click", (event) => {
  const row = event.target.closest("tr[data-room-id]");
  if (!row) return;

  const roomId = row.getAttribute("data-room-id");
  selectedRoomId = roomId;
  renderRooms();
  renderDetails(roomId);

  if (event.target.classList.contains("btn-close")) {
    addLog(`管理者がルーム \"${row.querySelector(".room-name").textContent}\" を終了（モック）`);
    alert("モック: ルーム終了APIを呼び出します");
  }
});

refreshButton.addEventListener("click", () => {
  addLog("管理者がルーム一覧を再読み込み（モック）");
  alert("モック: 最新データを取得します");
});

function init() {
  renderMetrics();
  renderRooms();
  renderLogs();
  renderDetails(selectedRoomId);
  setInterval(updateDurations, 30 * 1000);
}

init();
