// bot/bot.js
const TelegramBot = require("node-telegram-bot-api");

if (!process.env.BOT_TOKEN) {
  console.error("[bot.js] BOT_TOKEN missing in .env");
  process.exit(1);
}

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

bot.on("polling_error", (err) => {
  console.error("[bot.js] Polling error:", err.message);
});

module.exports = bot;
