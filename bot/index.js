// bot/index.js
const bot = require("./bot");
const onboardingHandlers = require("./handlers/onboardingHandlers");
const userHandlers = require("./handlers/userHandlers");
const keyHandlers = require("./handlers/keyHandlers");
const adminHandlers = require("./handlers/adminHandlers");
const { getState, clearState } = require("./state");
const logger = require("../utils/logger");

function registerBot() {
  // ---------- ONBOARDING / ACCOUNT ----------
  bot.onText(/\/start/, (msg) => onboardingHandlers.handleStart(bot, msg));
  bot.onText(/\/reconnect_gmail/, (msg) => onboardingHandlers.handleReconnectGmail(bot, msg));

  // ---------- USER COMMANDS ----------
  bot.onText(/\/docs$/, (msg) => userHandlers.handleDocs(bot, msg));
  bot.onText(/\/docs_file/, (msg) => userHandlers.handleDocsFile(bot, msg));
  bot.onText(/\/my_keys/, (msg) => userHandlers.handleMyKeys(bot, msg));
  bot.onText(/\/generate_key/, (msg) => keyHandlers.handleGenerateKey(bot, msg));
  bot.onText(/\/stats/, (msg) => userHandlers.handleStats(bot, msg));
  bot.onText(/\/history/, (msg) => userHandlers.handleHistory(bot, msg));
  bot.onText(/\/help/, (msg) => userHandlers.handleHelp(bot, msg));
  bot.onText(/\/profile/, (msg) => userHandlers.handleProfile(bot, msg));
  bot.onText(/\/update_mobile/, (msg) => userHandlers.handleUpdateMobile(bot, msg));
  bot.onText(/\/update_upi/, (msg) => userHandlers.handleUpdateUpi(bot, msg));
  bot.onText(/\/update_gmail/, (msg) => userHandlers.handleUpdateGmail(bot, msg));

  bot.onText(/\/add_ip (.+)/, (msg, match) => keyHandlers.handleAddIp(bot, msg, match));
  bot.onText(/\/set_webhook (.+)/, (msg, match) => keyHandlers.handleSetWebhook(bot, msg, match));

  // ---------- ADMIN COMMANDS ----------
  bot.onText(/\/admin_panel/, (msg) => adminHandlers.handleAdminPanel(bot, msg));
  bot.onText(/\/user_info (.+)/, (msg, match) => adminHandlers.handleUserInfo(bot, msg, match));
  bot.onText(/\/ban (.+)/, (msg, match) => adminHandlers.handleBan(bot, msg, match));
  bot.onText(/\/unban (.+)/, (msg, match) => adminHandlers.handleUnban(bot, msg, match));
  bot.onText(/\/revoke_key (\S+) (\S+)/, (msg, match) => adminHandlers.handleAdminRevokeKey(bot, msg, match));
  bot.onText(/\/broadcast (.+)/, (msg, match) => adminHandlers.handleBroadcast(bot, msg, match));
  bot.onText(/\/set_limit (\d+)/, (msg, match) => adminHandlers.handleSetLimit(bot, msg, match));
  bot.onText(/\/export/, (msg) => adminHandlers.handleExport(bot, msg));

  // ---------- PLAIN TEXT ROUTING (onboarding steps + profile updates) ----------
  bot.on("message", async (msg) => {
    if (!msg.text || msg.text.startsWith("/")) return;

    const state = getState(msg.from.id);
    if (!state) return;

    if (state.action.startsWith("onboard_")) {
      return onboardingHandlers.handleOnboardingText(bot, msg);
    }
    if (state.action.startsWith("update_")) {
      return userHandlers.handleUpdateText(bot, msg, state.action);
    }
  });

  // ---------- INLINE BUTTON CALLBACKS ----------
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data;

    try {
      if (data === "my_keys") {
        await userHandlers.handleMyKeys(bot, { from: { id: userId }, chat: { id: chatId } });
      } else if (data === "stats") {
        await userHandlers.handleStats(bot, { from: { id: userId }, chat: { id: chatId } });
      } else if (data === "history") {
        await userHandlers.handleHistory(bot, { from: { id: userId }, chat: { id: chatId } });
      } else if (data.startsWith("hist_")) {
        await userHandlers.handleHistoryFilter(bot, userId, data.replace("hist_", ""));
      } else if (data === "profile") {
        await userHandlers.handleProfile(bot, { from: { id: userId }, chat: { id: chatId } });
      } else if (data === "docs") {
        await userHandlers.handleDocs(bot, { chat: { id: chatId } });
      } else if (data === "help") {
        await userHandlers.handleHelp(bot, { chat: { id: chatId } });
      } else if (data.startsWith("switch_")) {
        await keyHandlers.handleSwitchMode(bot, userId, data.replace("switch_", ""));
      } else if (data.startsWith("revoke_")) {
        await keyHandlers.promptRevoke(bot, userId, data.replace("revoke_", ""));
      } else if (data.startsWith("confirmdel_")) {
        await keyHandlers.confirmRevoke(bot, userId, data.replace("confirmdel_", ""));
      } else if (data === "cancel_action") {
        await bot.sendMessage(userId, "❌ Cancelled.");
      } else if (data === "admin_stats") {
        await adminHandlers.handleGlobalStats(bot, chatId);
      } else if (data === "admin_maintenance") {
        await adminHandlers.toggleMaintenance(bot, chatId);
      } else if (data === "admin_export") {
        await adminHandlers.handleExport(bot, { from: { id: userId } });
      }

      await bot.answerCallbackQuery(query.id);
    } catch (err) {
      logger.error("callback_query error:", err.message);
      await bot.answerCallbackQuery(query.id, { text: "Something went wrong.", show_alert: true });
    }
  });

  logger.info("Bot commands and callbacks registered.");
  return bot;
}

module.exports = { registerBot };
