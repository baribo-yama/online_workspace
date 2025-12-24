const {onCall, HttpsError} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const {AccessToken} = require("livekit-server-sdk");

/**
 * LiveKit用アクセストークンを生成するCallable Function
 *
 * リクエストデータ:
 * {
 *   roomName: "room-123",
 *   identity: "user-abc"
 * }
 *
 * レスポンス:
 * {
 *   token: "jwt-string"
 * }
 */
const createLivekitToken = onCall(
    {
      region: "asia-northeast1",
      secrets: ["LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"],
    },
    async (request) => {
      const data = request.data || {};
      const {roomName, identity} = data;

      if (!roomName || !identity) {
        throw new HttpsError("invalid-argument", "roomName と identity は必須です");
      }

      // 型と長さのバリデーション
      if (typeof roomName !== "string" || roomName.length === 0 || roomName.length > 100) {
        throw new HttpsError("invalid-argument", "roomName は1-100文字の文字列である必要があります");
      }

      if (typeof identity !== "string" || identity.length === 0 || identity.length > 100) {
        throw new HttpsError("invalid-argument", "identity は1-100文字の文字列である必要があります");
      }

      const apiKey = process.env.LIVEKIT_API_KEY;
      const apiSecret = process.env.LIVEKIT_API_SECRET;

      if (!apiKey || !apiSecret) {
        logger.error("LiveKitシークレット未設定");
        throw new HttpsError("failed-precondition", "サーバー設定が正しくありません");
      }

      const token = new AccessToken(apiKey, apiSecret, {
        identity,
        ttl: "1h",
      });

      token.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
      });

      const jwt = await token.toJwt();

      logger.info("LiveKitトークン発行成功", {
        roomName,
        identity,
      });

      return {token: jwt};
    },
);

module.exports = {createLivekitToken};


