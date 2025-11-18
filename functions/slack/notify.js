const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

// Slack API エンドポイント
const SLACK_API_BASE = "https://slack.com/api";

/**
 * Slack API への汎用POST関数
 * @param {string} endpoint - APIエンドポイント
 * @param {object} body - リクエストボディ
 * @param {string} botToken - Bot User OAuth Token
 * @returns {Promise<object>} Slack API レスポンス
 */
const postToSlackApi = async (endpoint, body, botToken) => {
  try {
    const response = await fetch(`${SLACK_API_BASE}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Bearer ${botToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!data.ok) {
      logger.warn(`Slack API エラー: ${data.error}`, {
        endpoint,
        error: data.error,
      });
    }

    return data;
  } catch (error) {
    logger.error("Slack API 呼び出しエラー:", error);
    throw error;
  }
};

/**
 * Slack通知を送信するHTTPS関数
 * 
 * リクエストボディ:
 * {
 *   "channel": "C09SB7A96DU",
 *   "text": "メッセージ内容",
 *   "thread_ts": "1234567890.123456" (オプション)
 * }
 * 
 * レスポンス:
 * {
 *   "ok": true,
 *   "ts": "1234567890.123456",
 *   "channel": "C09SB7A96DU"
 * }
 */
exports.sendSlackNotification = onRequest(
    {
      cors: true, // CORS を許可（localhost:5173 からのアクセス）
      secrets: ["SLACK_BOT_TOKEN"], // Secret Manager から取得
      region: "asia-northeast1", // 東京リージョン（レイテンシ削減）
    },
    async (req, res) => {
      // POST メソッドのみ許可
      if (req.method !== "POST") {
        res.status(405).json({
          ok: false,
          error: "Method Not Allowed",
        });
        return;
      }

      const {channel, text, thread_ts} = req.body;

      // バリデーション
      if (!channel || !text) {
        res.status(400).json({
          ok: false,
          error: "Bad Request",
          message: "channel と text は必須です",
        });
        return;
      }

      // Secret Manager から Bot Token を取得
      const botToken = process.env.SLACK_BOT_TOKEN;
      if (!botToken) {
        logger.error("SLACK_BOT_TOKEN が設定されていません");
        res.status(500).json({
          ok: false,
          error: "Internal Server Error",
          message: "サーバー設定エラー",
        });
        return;
      }

      try {
        logger.info("Slack通知送信開始", {
          channel,
          textPreview: text.substring(0, 50),
          hasThread: !!thread_ts,
        });

        // Slack API 呼び出し
        const result = await postToSlackApi(
            "chat.postMessage",
            {
              channel,
              text,
              ...(thread_ts && {thread_ts}),
            },
            botToken,
        );

        if (result.ok) {
          logger.info("Slack通知成功", {
            ts: result.ts,
            channel: result.channel,
          });

          res.status(200).json({
            ok: true,
            ts: result.ts,
            channel: result.channel,
          });
        } else {
          logger.warn("Slack API エラー", {
            error: result.error,
          });

          res.status(400).json({
            ok: false,
            error: result.error,
          });
        }
      } catch (error) {
        logger.error("Slack通知送信エラー:", error);
        res.status(500).json({
          ok: false,
          error: "Internal Server Error",
        });
      }
    },
);
