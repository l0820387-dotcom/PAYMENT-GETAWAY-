// server/middleware/rateLimiter.js
const store = require("../../database/jsonStore");
const { ERROR_CODES, DEFAULT_RATE_LIMIT, RATE_LIMIT_WINDOW_MS } = require("../../config/constants");
const bot = require("../../bot/bot");
const logger = require("../../utils/logger");

module.exports = async function rateLimiter(req, res, next) {
  const keyHash = req.keyHash;
  const settings = store.get("settings", "global") || {};
  const limit = settings.globalRateLimit || DEFAULT_RATE_LIMIT;

  const now = Date.now();
  let entry = store.get("rateLimits", keyHash);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry = { windowStart: now, count: 1, limit };
  } else {
    entry.count += 1;
  }
  await store.set("rateLimits", keyHash, entry);

  if (entry.count > limit) {
    bot
      .sendMessage(
        req.apiKey.userId,
        `⚠️ *Rate Limit Alert*\n\nYou've exceeded your limit of ${limit} calls/hour. Requests will be blocked until the window resets.`,
        { parse_mode: "Markdown" }
      )
      .catch((e) => logger.warn("Could not send rate limit alert:", e.message));

    return res.status(429).json({ status: "error", ...ERROR_CODES.RATE_LIMIT_EXCEEDED });
  }

  next();
};
