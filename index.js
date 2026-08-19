// index.js - Entry point
require("dotenv").config();

const { registerBot } = require("./bot/index");
const createApp = require("./server/app");
const { alertAdmin } = require("./bot/handlers/adminHandlers");
const { startPolling } = require("./email/imapPoller");
const pendingModel = require("./database/pendingModel");
const { PENDING_VERIFICATION_TIMEOUT_MS, ENCRYPTION_KEY } = require("./config/constants");
const logger = require("./utils/logger");

async function main() {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
    logger.error(
      "ENCRYPTION_KEY missing/invalid in .env. Generate with:\n" +
        "node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
    process.exit(1);
  }

  // 1. Start the Telegram bot (polling mode)
  const bot = registerBot();
  logger.info("Telegram bot started (polling mode).");

  // 2. Start the Express API server
  const app = createApp();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    logger.info(`API server listening on port ${PORT}`);
  });

  // 3. Start multi-user Gmail IMAP poller
  startPolling(bot);

  // 4. Expire stale pending verifications
  setInterval(async () => {
    try {
      const expired = await pendingModel.expireOldPending(PENDING_VERIFICATION_TIMEOUT_MS);
      if (expired.length > 0) logger.info(`Expired ${expired.length} stale pending verification(s).`);
    } catch (err) {
      logger.error("Pending-expiry cleanup failed:", err.message);
    }
  }, 60 * 1000);

  logger.info("System is up and running.");
}

main().catch((err) => {
  console.error("[index.js] Fatal startup error:", err);
  process.exit(1);
});
