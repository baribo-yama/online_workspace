const admin = require("firebase-admin");
const {sendSlackNotification} = require("./slack/notify");
const {createLivekitToken} = require("./livekit/token");

// Firebase Admin SDK初期化
admin.initializeApp();

exports.sendSlackNotification = sendSlackNotification;
exports.createLivekitToken = createLivekitToken;