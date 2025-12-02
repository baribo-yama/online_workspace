const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const {defineSecret} = require("firebase-functions/params");
const fetch = require("node-fetch");

// Slack API エンドポイント
const SLACK_API_BASE = "https://slack.com/api";

// シークレット定義
const slackBotToken = defineSecret("SLACK_BOT_TOKEN");

/**
 * 複数ワークスペース設定
 * - 各ワークスペースごとに Secret Manager のシークレット参照とチャンネルIDを管理
 */
const WORKSPACE_CONFIG = {
  "workspace-a": {
    secretParam: slackBotToken, // シークレットパラメータ
    channelId: "C09SB7A96DU",
  },
  // 新しいワークスペースを追加する場合はここに追記
};

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
 * Slack通知を送信するHTTPS関数ハンドラー（Firebase認証必須 + 複数ワークスペース対応）
 * 
 * リクエストヘッダー:
 * - Authorization: Bearer <Firebase ID Token> (必須)
 * 
 * リクエストボディ:
 * {
 *   "workspace": "workspace-a",  // ワークスペース指定（省略時はworkspace-a）
 *   "text": "メッセージ内容",
 *   "thread_ts": "1234567890.123456" (オプション)
 * }
 * 
 * レスポンス:
 * {
 *   "ok": true,
 *   "ts": "1234567890.123456",
 *   "channel": "C09SB7A96DU",
 *   "workspace": "workspace-a"
 * }
 */
exports.handler = async (req, res) => {
      // POST メソッドのみ許可
      if (req.method !== "POST") {
        res.status(405).json({
          ok: false,
          error: "Method Not Allowed",
        });
        return;
      }

      try {
        // ❶ Firebase ID Token検証（認証チェック）
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          logger.warn("認証ヘッダーが不正または欠落", {
            ip: req.ip,
            userAgent: req.headers["user-agent"],
          });
          res.status(401).json({
            ok: false,
            error: "Unauthorized",
            message: "Firebase ID Tokenが必要です",
          });
          return;
        }

        const idToken = authHeader.split("Bearer ")[1];
        let decodedToken;

        try {
          // ❷ ID Tokenを検証
          decodedToken = await admin.auth().verifyIdToken(idToken);
          logger.info("認証成功", {
            uid: decodedToken.uid,
            email: decodedToken.email || "(匿名)",
          });
        } catch (error) {
          logger.warn("無効なID Token", {
            errorCode: error.code,
            errorMessage: error.message,
          });
          res.status(401).json({
            ok: false,
            error: "Unauthorized",
            message: "無効な認証トークンです",
          });
          return;
        }

        // ❸ リクエストボディを取得
        const {workspace = "workspace-a", text, thread_ts} = req.body;

        // ❹ バリデーション
        if (!text) {
          res.status(400).json({
            ok: false,
            error: "Bad Request",
            message: "text は必須です",
          });
          return;
        }

        // ❺ ワークスペース設定を取得
        const config = WORKSPACE_CONFIG[workspace];
        if (!config) {
          logger.warn("無効なワークスペース指定", {workspace});
          res.status(400).json({
            ok: false,
            error: "Bad Request",
            message: `無効なワークスペース: ${workspace}`,
          });
          return;
        }

        const {secretParam, channelId} = config;

        // ❻ Secret Manager から Bot Token を取得
        const botToken = secretParam.value()?.trim();
        if (!botToken) {
          logger.error("Bot Token が取得できません", {
            workspace,
          });
          res.status(500).json({
            ok: false,
            error: "Internal Server Error",
            message: "サーバー設定エラー",
          });
          return;
        }

        logger.info("Slack通知送信開始", {
          workspace,
          channel: channelId,
          textPreview: text.substring(0, 50),
          hasThread: !!thread_ts,
          userId: decodedToken.uid,
        });

        // ❼ Slack API 呼び出し
        const result = await postToSlackApi(
            "chat.postMessage",
            {
              channel: channelId,
              text,
              ...(thread_ts && {thread_ts}),
            },
            botToken,
        );

        if (result.ok) {
          logger.info("Slack通知成功", {
            ts: result.ts,
            channel: channelId,
            workspace,
          });

          res.status(200).json({
            ok: true,
            ts: result.ts,
            channel: channelId,
            workspace,
          });
        } else {
          logger.warn("Slack API エラー", {
            error: result.error,
            workspace,
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
};
