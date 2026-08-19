// bot/handlers/adminHandlers.js
const store = require("../../database/jsonStore");
const userModel = require("../../database/userModel");
const keyModel = require("../../database/keyModel");
const statsModel = require("../../database/statsModel");
const { ADMIN_ID } = require("../../config/constants");
const { adminPanel } = require("../keyboards/inlineKeyboards");
const { escapeMarkdown } = require("../../utils/telegramSafe");
const logger = require("../../utils/logger");

function isAdmin(userId) {
  return String(userId) === ADMIN_ID;
}

async function handleAdminPanel(bot, msg) {
  const userId = msg.from.id;
  if (!isAdmin(userId)) return bot.sendMessage(userId, "🚫 Unauthorized.");
  await bot.sendMessage(userId, "🛠️ *Admin Panel*", { parse_mode: "Markdown", ...adminPanel() });
}

async function handleGlobalStats(bot, chatId) {
  const stats = await statsModel.getGlobalStats();
  const text =
    `📊 *Global Stats*\n\n` +
    `Total Users: ${stats.totalUsers}\nBanned Users: ${stats.bannedUsers}\n` +
    `Total API Keys: ${stats.totalKeys}\nRevoked Keys: ${stats.revokedKeys}\n` +
    `Total API Calls: ${stats.totalCalls}\nSuccessful Calls: ${stats.successCalls}\n` +
    `Success Rate: ${stats.successRate}%`;
  await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
}

async function handleUserInfo(bot, msg, match) {
  const adminId = msg.from.id;
  if (!isAdmin(adminId)) return bot.sendMessage(adminId, "🚫 Unauthorized.");

  const targetId = match[1]?.trim();
  if (!targetId) return bot.sendMessage(adminId, "Usage: /user_info <user_id>");

  const user = await userModel.getUser(targetId);
  if (!user) return bot.sendMessage(adminId, "User not found.");

  const keys = await keyModel.getUserKeys(targetId);
  const stats = await statsModel.getUserStats(targetId);

  const text =
    `👤 *User Info: ${targetId}*\n\n` +
    `Mobile: ${user.mobile || "not set"}\nUPI: ${user.upiId || "not set"}\n` +
    `Gmail: ${user.gmailEmail || "not set"}\nGmail Connected: ${user.gmailConnected ? "✅" : "❌"}\n` +
    `Banned: ${user.isBanned ? "Yes 🚫" : "No ✅"}\n` +
    `Registered: ${new Date(user.createdAt).toLocaleString()}\n` +
    `Total Keys: ${keys.length}\nTotal Calls: ${stats.totalCalls}\nSuccess Rate: ${stats.successRate}%`;

  await bot.sendMessage(adminId, text, { parse_mode: "Markdown" });
}

async function handleBan(bot, msg, match) {
  const adminId = msg.from.id;
  if (!isAdmin(adminId)) return bot.sendMessage(adminId, "🚫 Unauthorized.");

  const targetId = match[1]?.trim();
  if (!targetId) return bot.sendMessage(adminId, "Usage: /ban <user_id>");

  await userModel.setBanStatus(targetId, true);
  await bot.sendMessage(adminId, `🚫 User ${targetId} banned.`);
  try {
    await bot.sendMessage(targetId, "🚫 Your account has been banned by admin.");
  } catch (e) {
    logger.warn("Could not notify banned user:", e.message);
  }
}

async function handleUnban(bot, msg, match) {
  const adminId = msg.from.id;
  if (!isAdmin(adminId)) return bot.sendMessage(adminId, "🚫 Unauthorized.");

  const targetId = match[1]?.trim();
  if (!targetId) return bot.sendMessage(adminId, "Usage: /unban <user_id>");

  await userModel.setBanStatus(targetId, false);
  await bot.sendMessage(adminId, `✅ User ${targetId} unbanned.`);
  try {
    await bot.sendMessage(targetId, "✅ Your account has been unbanned.");
  } catch (e) {
    logger.warn("Could not notify unbanned user:", e.message);
  }
}

async function handleAdminRevokeKey(bot, msg, match) {
  const adminId = msg.from.id;
  if (!isAdmin(adminId)) return bot.sendMessage(adminId, "🚫 Unauthorized.");

  const [, targetId, keyHash] = match;
  if (!targetId || !keyHash) return bot.sendMessage(adminId, "Usage: /revoke_key <user_id> <key_hash>");

  await keyModel.revokeKey(keyHash);
  await keyModel.deleteKey(targetId, keyHash);
  await bot.sendMessage(adminId, `🗑️ Key revoked for user ${targetId}.`);
}

async function handleBroadcast(bot, msg, match) {
  const adminId = msg.from.id;
  if (!isAdmin(adminId)) return bot.sendMessage(adminId, "🚫 Unauthorized.");

  const message = match[1]?.trim();
  if (!message) return bot.sendMessage(adminId, "Usage: /broadcast <message>");

  const safeMessage = escapeMarkdown(message);
  const users = await userModel.getAllUsers();
  const ids = Object.keys(users);

  let sent = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      await bot.sendMessage(id, `📢 *Announcement*\n\n${safeMessage}`, { parse_mode: "Markdown" });
      sent++;
    } catch {
      failed++;
    }
  }

  await bot.sendMessage(adminId, `✅ Broadcast sent: ${sent} success, ${failed} failed.`);
}

async function toggleMaintenance(bot, chatId) {
  const settings = store.get("settings", "global") || { maintenanceMode: false };
  const newValue = !settings.maintenanceMode;
  await store.set("settings", "global", { ...settings, maintenanceMode: newValue });

  await bot.sendMessage(chatId, `🛠️ Maintenance mode is now *${newValue ? "ON" : "OFF"}*.`, {
    parse_mode: "Markdown",
  });
}

async function handleSetLimit(bot, msg, match) {
  const adminId = msg.from.id;
  if (!isAdmin(adminId)) return bot.sendMessage(adminId, "🚫 Unauthorized.");

  const limit = parseInt(match[1], 10);
  if (!limit || limit <= 0) return bot.sendMessage(adminId, "Usage: /set_limit <number>");

  const settings = store.get("settings", "global") || {};
  await store.set("settings", "global", { ...settings, globalRateLimit: limit });
  await bot.sendMessage(adminId, `✅ Global rate limit set to ${limit} calls/window.`);
}

async function handleExport(bot, msg) {
  const adminId = msg.from.id;
  if (!isAdmin(adminId)) return bot.sendMessage(adminId, "🚫 Unauthorized.");

  const users = await userModel.getAllUsers();
  const keys = await keyModel.getAllKeys();

  // Strip encrypted Gmail passwords from export for safety
  const safeUsers = {};
  for (const [id, u] of Object.entries(users)) {
    const { gmailAppPasswordEnc, ...rest } = u;
    safeUsers[id] = rest;
  }

  const exportData = { exportedAt: new Date().toISOString(), users: safeUsers, apiKeys: keys };
  const buffer = Buffer.from(JSON.stringify(exportData, null, 2), "utf-8");

  await bot.sendDocument(
    adminId,
    buffer,
    {},
    { filename: `export_${Date.now()}.json`, contentType: "application/json" }
  );
}

async function alertAdmin(bot, text) {
  try {
    await bot.sendMessage(ADMIN_ID, `🚨 *System Alert*\n\n${text}`, { parse_mode: "Markdown" });
  } catch (e) {
    logger.error("Failed to alert admin:", e.message);
  }
}

module.exports = {
  isAdmin,
  handleAdminPanel,
  handleGlobalStats,
  handleUserInfo,
  handleBan,
  handleUnban,
  handleAdminRevokeKey,
  handleBroadcast,
  toggleMaintenance,
  handleSetLimit,
  handleExport,
  alertAdmin,
};
