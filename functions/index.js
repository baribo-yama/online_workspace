const admin = require("firebase-admin");
const { onRequest } = require("firebase-functions/v2/https");
const { createLivekitToken } = require("./livekit/token");

// Firebase Admin SDK初期化
admin.initializeApp();

// Slack通知関数（notify.jsからシークレットとハンドラーをimport）
const notifyModule = require("./slack/notify");

exports.sendSlackNotification = onRequest(
  {
    secrets: notifyModule.secrets, // 配列をそのまま渡す
    region: "asia-northeast1",
    timeoutSeconds: 10,
    memory: "256MiB",
    cors: true,
  },
  notifyModule.handler,
);

// LiveKitトークン生成関数
exports.createLivekitToken = createLivekitToken;