const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const { defineSecret } = require("firebase-functions/params");
const fetch = require("node-fetch");
const cors = require("cors")({ origin: true });

// Slack API エンドポイント
const SLACK_API_BASE = "https://slack.com/api";

// =================================================================
// 1. シークレット（Bot Token）の定義
// =================================================================
const SECRETS = {
  A: defineSecret("SLACK_BOT_TOKEN_A"),
  B: defineSecret("SLACK_BOT_TOKEN_B"),
  C: defineSecret("SLACK_BOT_TOKEN_C"),
};

// Cloud Functionsに登録するための配列（exports用）
const secretParamsArray = Object.values(SECRETS);

// =================================================================
// 2. 通知ルートの定義
// =================================================================
// フロントエンドから指定される "workspace" (ID) に対して、
// 「どのToken」を使って「どのChannel」に送るかをマッピング
const NOTIFICATION_ROUTES = {
  "workspace-a": [
    { secret: SECRETS.A, channelId: "C09SB7A96DU" } // MOKUテスト用
  ],
  "workspace-b": [
    { secret: SECRETS.B, channelId: "C0A0Z510EP4" } // MOKUテスト用2
  ],
  "workspace-c": [
    { secret: SECRETS.C, channelId: "C08DDJ3SQCU" } // 雑談チャンネル
  ],
  // 複数ワークスペースへの一斉配信
  "workspace-a_b": [
    { secret: SECRETS.A, channelId: "C09SB7A96DU" },
    { secret: SECRETS.B, channelId: "C0A0Z510EP4" }
  ],
  "workspace-a_c": [
    { secret: SECRETS.A, channelId: "C09SB7A96DU" },
    { secret: SECRETS.C, channelId: "C08DDJ3SQCU" }
  ]
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
 *   "thread_ts": "1234567890.123456" (オプション: レガシー互換)
 *   "thread_ts_map": { "CHANNEL_ID": "TS", ... } (オプション: 複数チャンネル返信用)
 * }
 * 
 * レスポンス:
 * {
 *   "ok": true,
 *   "results": { "CHANNEL_ID": "TS", ... },
 *   "ts": "...", // レガシー互換
 *   "channel": "...", // レガシー互換
 *   "workspace": "workspace-a"
 * }
 */
const handler = async (req, res) => {
  cors(req, res, async () => {
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
      // thread_ts_map: { "CHANNEL_ID": "TS", ... } の形式で来ることを想定
      const { workspace = "workspace-a", text, thread_ts, thread_ts_map } = req.body;

      // ❹ バリデーション
      if (!text) {
        res.status(400).json({
          ok: false,
          error: "Bad Request",
          message: "text は必須です",
        });
        return;
      }

      // ❺ 通知ルート(targets)を取得
      const targets = NOTIFICATION_ROUTES[workspace];
      if (!targets) {
        logger.warn("無効なワークスペース指定", { workspace });
        res.status(400).json({
          ok: false,
          error: "Bad Request",
          message: `無効なワークスペース: ${workspace}`,
        });
        return;
      }

      logger.info("Slack通知送信開始", {
        workspace,
        targetCount: targets.length,
        textPreview: text.substring(0, 50),
        hasThreadMap: !!thread_ts_map,
        threadMapKeys: thread_ts_map ? Object.keys(thread_ts_map) : [], // デバッグ用
        legacyThreadTs: thread_ts,
        userId: decodedToken.uid,
      });

      // ❼ Slack API 呼び出し（全ターゲットへループ）
      const results = {};
      const errors = [];

      await Promise.all(targets.map(async (target) => {
        const { secret, channelId } = target;

        // Bot Token取得
        const botToken = secret.value()?.trim();
        if (!botToken) {
          logger.error(`Bot Token 未設定 for channel ${channelId}`, { workspace });
          errors.push({ channel: channelId, error: "Configuration Error: Token missing" });
          return;
        }

        // スレッドTS決定
        const targetTs = thread_ts_map?.[channelId] || thread_ts;
        const isReplyIntent = !!thread_ts_map || !!thread_ts;

        // デバッグログ: 各チャンネルの判定状況
        logger.debug(`[Channel: ${channelId}] 判定`, {
          targetTs,
          isReplyIntent,
          inMap: thread_ts_map ? (channelId in thread_ts_map) : false
        });

        if (isReplyIntent && !targetTs) {
          logger.warn(`[Channel: ${channelId}] スレッドTSが見つからないためスキップします`);
          return;
        }

        const result = await postToSlackApi(
          "chat.postMessage",
          {
            channel: channelId,
            text,
            ...(targetTs && { thread_ts: targetTs }),
          },
          botToken,
        );

        if (result.ok) {
          results[channelId] = result.ts;
        } else {
          errors.push({ channel: channelId, error: result.error });
        }
      }));

      // 結果応答
      const successCount = Object.keys(results).length;

      if (successCount > 0) {
        logger.info("Slack通知完了", {
          successCount,
          failCount: errors.length,
          workspace,
        });

        res.status(200).json({
          ok: true,
          results, // { "Cxxxx": "1234.5678", ... }
          ts: Object.values(results)[0],
          channel: Object.keys(results)[0],
          workspace,
        });
      } else {
        logger.warn("全宛先で送信失敗", {
          errors,
          workspace,
        });

        res.status(400).json({
          ok: false,
          error: "All targets failed",
          details: errors
        });
      }
    } catch (error) {
      logger.error("Slack通知送信エラー:", error);
      res.status(500).json({
        ok: false,
        error: "Internal Server Error",
      });
    }
  });
};

// 他のモジュールから参照できるようにエクスポート
exports.secrets = secretParamsArray;
exports.handler = handler;
