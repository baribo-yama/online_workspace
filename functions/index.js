const admin = require("firebase-admin");
const {defineSecret} = require("firebase-functions/params");
const {createLivekitToken} = require("./livekit/token");

// Firebase Admin SDK初期化
admin.initializeApp();

// シークレット定義
const slackBotToken = defineSecret("SLACK_BOT_TOKEN");

// Slack通知関数（notify.jsから直接エクスポート）
const {onRequest} = require("firebase-functions/v2/https");
const notifyHandler = require("./slack/notify");

exports.sendSlackNotification = onRequest(
  {
    secrets: [slackBotToken],
    region: "asia-northeast1",
    timeoutSeconds: 10,
    memory: "256MiB",
    cors: [
      "https://online-workspace-1c2a4.web.app",
      "https://online-workspace-1c2a4.firebaseapp.com",
      /^http:\/\/localhost:\d+$/,
    ],
  },
  notifyHandler.handler,
);

exports.createLivekitToken = createLivekitToken;