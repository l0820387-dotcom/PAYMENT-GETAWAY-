// bot/handlers/keyHandlers.js
const keyModel = require("../../database/keyModel");
const userModel = require("../../database/userModel");
const { isValidIPv4, isValidWebhookUrl } = require("../../utils/validators");
const { confirmDelete } = require("../keyboards/inlineKeyboards");

// /add_ip 192.168.x.x
async function handleAddIp(bot, msg, match) {
  const userId = msg.from.id;
  const ip = match[1]?.trim();

  if (!ip || !isValidIPv4(ip)) {
    return bot.sendMessage(userId, "❌ Invalid IP format. Usage: /add_ip 192.168.1.1");
  }

  const list = await userModel.addIpToWhitelist(userId, ip);
  await bot.sendMessage(userId, `✅ IP added to whitelist.\n\nCurrent whitelist:\n${list.join("\n")}`);
}

// /set_webhook https://...
async function handleSetWebhook(bot, msg, match) {
  const userId = msg.from.id;
  const url = match[1]?.trim();

  if (!url || !isValidWebhookUrl(url)) {
    return bot.sendMessage(userId, "❌ Invalid webhook URL. Must be HTTPS. Usage: /set_webhook https://yourdomain.com/hook");
  }

  await userModel.setWebhookUrl(userId, url);
  await bot.sendMessage(userId, `✅ Webhook set to:\n${url}`);
}

// callback: switch_<keyId>
async function handleSwitchMode(bot, userId, keyId) {
  const keyHash = await keyModel.resolveKeyId(keyId);
  if (!keyHash) return bot.sendMessage(userId, "Key not found (may have been deleted).");

  const key = await keyModel.getKeyByHash(keyHash);
  if (!key) return bot.sendMessage(userId, "Key not found.");

  const newMode = key.mode === "live" ? "test" : "live";
  await keyModel.switchKeyMode(keyHash, newMode);
  await bot.sendMessage(userId, `🔁 Key mode switched to *${newMode}*.`, { parse_mode: "Markdown" });
}

// callback: revoke_<keyId>
async function promptRevoke(bot, userId, keyId) {
  await bot.sendMessage(userId, "⚠️ This will permanently revoke and delete this API key. Continue?", confirmDelete(keyId));
}

// callback: confirmdel_<keyId>
async function confirmRevoke(bot, userId, keyId) {
  const keyHash = await keyModel.resolveKeyId(keyId);
  if (!keyHash) return bot.sendMessage(userId, "Key not found (may already be deleted).");

  await keyModel.revokeKey(keyHash);
  await keyModel.deleteKey(userId, keyHash);
  await bot.sendMessage(userId, "🗑️ Key revoked and deleted successfully.");
}

// /generate_key - lets a user create additional keys beyond the auto-generated one
async function handleGenerateKey(bot, msg) {
  const userId = msg.from.id;
  const user = await userModel.getUser(userId);

  if (!user || user.onboardingStep !== "done") {
    return bot.sendMessage(userId, "Please complete /start onboarding first.");
  }

  const { rawKey } = await keyModel.createApiKey(userId, "live");
  await bot.sendMessage(
    userId,
    `🔐 *New API Key:*\n\`${rawKey}\`\n\n⚠️ Shown only once - copy and delete this message.`,
    { parse_mode: "Markdown" }
  );
}

module.exports = {
  handleAddIp,
  handleSetWebhook,
  handleSwitchMode,
  promptRevoke,
  confirmRevoke,
  handleGenerateKey,
};
