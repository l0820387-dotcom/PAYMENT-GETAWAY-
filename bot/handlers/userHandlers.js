// bot/handlers/userHandlers.js
const userModel = require("../../database/userModel");
const keyModel = require("../../database/keyModel");
const txnModel = require("../../database/txnModel");
const statsModel = require("../../database/statsModel");
const { keyActions, historyFilters } = require("../keyboards/inlineKeyboards");
const { FAQS } = require("../../config/constants");
const { setState } = require("../state");
const { escapeMarkdown } = require("../../utils/telegramSafe");

// /docs
async function handleDocs(bot, msg) {
  const step0 = {
    endpoint: "GET https://your-server-domain.com/api/qr?upi=yourname@fam&amount=70",
    headers: { Authorization: "Bearer fampay_live_xxxxxxxxxxxxxxxxxxxx" },
    note: "amount is optional - omit it (or use amount=0) for a dynamic QR where the payer enters their own amount.",
    response: {
      status: "success",
      data: {
        order_id: "FAMPAY1234567890ABCD",
        upi_link: "upi://pay?pa=yourname@fam&pn=Payment%20Gateway&am=70.00&cu=INR",
        qr_image_url: "https://api.qrserver.com/v1/create-qr-code/?...",
        upi_id: "yourname@fam",
        amount: 70,
        expires_in_seconds: 300,
      },
    },
  };

  const step1 = {
    endpoint: "POST https://your-server-domain.com/api/verify",
    headers: {
      Authorization: "Bearer fampay_live_xxxxxxxxxxxxxxxxxxxx",
      "Content-Type": "application/json",
    },
    body: {
      amount: 499.0,
      utr: "324567891234",
      reference_id: "order_12345",
      customer_email: "customer@example.com",
    },
    immediate_response_202: {
      status: "pending",
      txn_id: "txn_abcdef123456",
      verified: false,
      check_status_url: "/api/verify/status/txn_abcdef123456",
    },
  };

  const step2 = {
    endpoint: "GET https://your-server-domain.com/api/verify/status/txn_abcdef123456",
    headers: { Authorization: "Bearer fampay_live_xxxxxxxxxxxxxxxxxxxx" },
    response_when_done: {
      status: "success",
      txn_id: "txn_abcdef123456",
      verified: true,
      amount: 499.0,
      utr: "324567891234",
    },
  };

  // NOTE: JSON blocks contain lots of underscores (fampay_live_xxx, txn_id, etc.)
  // Telegram's legacy Markdown parser gets confused by underscores even inside
  // triple-backtick code fences and throws "can't parse entities". Sending
  // these as plain text (no parse_mode) avoids that entirely.
  await bot.sendMessage(
    msg.chat.id,
    "📘 API Integration Docs\n\n" +
      "Verification is ASYNC - we match your UTR against incoming payment emails, " +
      "so it can take a few seconds up to ~1 minute.\n\n" +
      "Full docs also available as a file: /docs_file"
  );

  await bot.sendMessage(
    msg.chat.id,
    "Step 0 (optional): Generate a payment QR\n\n" + JSON.stringify(step0, null, 2)
  );

  await bot.sendMessage(
    msg.chat.id,
    "Step 1: Submit the UTR\n\n" + JSON.stringify(step1, null, 2)
  );

  await bot.sendMessage(
    msg.chat.id,
    "Step 2: Poll status (or use /set_webhook for a push instead)\n\n" + JSON.stringify(step2, null, 2)
  );
}

// /my_keys
async function handleMyKeys(bot, msg) {
  const userId = msg.from.id;
  const keys = await keyModel.getUserKeys(userId);

  if (keys.length === 0) {
    return bot.sendMessage(userId, "You have no API keys yet.");
  }

  for (const k of keys) {
    const status = k.revoked ? "🔴 Revoked" : "🟢 Active";
    const text =
      `*Key Hash:* \`${k.keyHash.slice(0, 16)}...\`\n` +
      `*Mode:* ${k.mode}\n*Status:* ${status}\n` +
      `*Total Calls:* ${k.totalCalls || 0}\n` +
      `*Created:* ${new Date(k.createdAt).toLocaleString()}`;

    await bot.sendMessage(userId, text, {
      parse_mode: "Markdown",
      ...(k.revoked ? {} : keyActions(k.keyId)),
    });
  }
}

// /stats
async function handleStats(bot, msg) {
  const userId = msg.from.id;
  const stats = await statsModel.getUserStats(userId);

  const text =
    `📊 *Your Stats*\n\n` +
    `Total Keys: ${stats.totalKeys}\n` +
    `Total API Calls: ${stats.totalCalls}\n` +
    `Successful Calls: ${stats.successCalls}\n` +
    `Success Rate: ${stats.successRate}%`;

  await bot.sendMessage(userId, text, { parse_mode: "Markdown" });
}

// /history - shows filter buttons, defaults to last 5
async function handleHistory(bot, msg) {
  const userId = msg.from.id;
  await bot.sendMessage(userId, "🧾 Choose a filter for your payment history:", historyFilters());
}

// Called from callback_query when a history filter button is tapped
async function handleHistoryFilter(bot, userId, statusFilter) {
  const status = statusFilter === "all" ? null : statusFilter;
  const { total, results } = await txnModel.getFullHistory(userId, { status, limit: 10 });

  if (results.length === 0) {
    return bot.sendMessage(userId, "No transactions found for this filter.");
  }

  const icon = { success: "✅", failed: "❌", pending: "⏳", expired: "⌛" };
  const lines = results.map((t, i) => {
    const utrLine = t.utr ? ` (UTR: ${t.utr})` : "";
    return `${i + 1}. ${icon[t.status] || "•"} ₹${t.amount} - ${t.status}${utrLine}\n   ${new Date(t.createdAt).toLocaleString()}`;
  });

  await bot.sendMessage(
    userId,
    `🧾 *Payment History* (showing ${results.length} of ${total})\n\n${lines.join("\n\n")}`,
    { parse_mode: "Markdown" }
  );
}

// /help
async function handleHelp(bot, msg) {
  const text = "❓ *Help & FAQs*\n\n" + FAQS.join("\n\n");
  await bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
}

// /profile
async function handleProfile(bot, msg) {
  const userId = msg.from.id;
  const user = await userModel.getUser(userId);

  const text =
    `👤 *Your Profile*\n\n` +
    `Mobile: ${escapeMarkdown(user?.mobile) || "not set"}\n` +
    `UPI ID: ${escapeMarkdown(user?.upiId) || "not set"}\n` +
    `Gmail: ${escapeMarkdown(user?.gmailEmail) || "not set"}\n` +
    `Gmail Connected: ${user?.gmailConnected ? "✅ Yes" : "❌ No"}\n\n` +
    `To update a field, use:\n/update_mobile /update_upi /update_gmail\n` +
    `Or /reconnect_gmail to retest your Gmail connection.`;

  await bot.sendMessage(userId, text, { parse_mode: "Markdown" });
}

// /update_mobile, /update_upi - simple guided single-field updates
async function handleUpdateMobile(bot, msg) {
  setState(msg.from.id, "update_mobile");
  await bot.sendMessage(msg.from.id, "📱 Send your new mobile number:");
}

async function handleUpdateUpi(bot, msg) {
  setState(msg.from.id, "update_upi");
  await bot.sendMessage(msg.from.id, "💳 Send your new UPI ID:");
}

async function handleUpdateGmail(bot, msg) {
  setState(msg.from.id, "update_gmail_email");
  await bot.sendMessage(
    msg.from.id,
    "📧 Send your new Gmail address (you'll be asked for a new App Password next):"
  );
}

// Generic profile-field update text handler, called from bot/index.js router
async function handleUpdateText(bot, msg, action) {
  const userId = msg.from.id;
  const text = msg.text.trim();
  const { isValidMobile, isValidUpi, isValidEmail, testImapConnection } = require("../../utils/validators");
  const { clearState, setState: setSt } = require("../state");

  if (action === "update_mobile") {
    if (!isValidMobile(text)) return bot.sendMessage(userId, "❌ Invalid mobile number.");
    await userModel.updateProfile(userId, { mobile: text });
    clearState(userId);
    return bot.sendMessage(userId, "✅ Mobile updated.");
  }

  if (action === "update_upi") {
    if (!isValidUpi(text)) return bot.sendMessage(userId, "❌ Invalid UPI ID.");
    await userModel.updateProfile(userId, { upiId: text });
    clearState(userId);
    return bot.sendMessage(userId, "✅ UPI ID updated.");
  }

  if (action === "update_gmail_email") {
    if (!isValidEmail(text) || !text.toLowerCase().endsWith("@gmail.com")) {
      return bot.sendMessage(userId, "❌ Please send a valid Gmail address.");
    }
    setSt(userId, "update_gmail_password", { gmailEmail: text });
    return bot.sendMessage(userId, "🔐 Now send your Gmail App Password for this address:");
  }

  if (action === "update_gmail_password") {
    const state = require("../state").getState(userId);
    const gmailEmail = state?.data?.gmailEmail;

    try {
      await bot.deleteMessage(msg.chat.id, msg.message_id);
    } catch {}

    await bot.sendMessage(userId, "🔄 Testing connection...");
    const result = await testImapConnection(gmailEmail, text);
    await userModel.setGmailCredentials(userId, gmailEmail, text, result.success);
    clearState(userId);

    return bot.sendMessage(
      userId,
      result.success ? "✅ Gmail updated and connected successfully!" : `⚠️ Gmail updated but connection failed: ${result.error}`
    );
  }
}

// /docs_file - sends the full API.md documentation as a downloadable file
async function handleDocsFile(bot, msg) {
  const fs = require("fs");
  const path = require("path");
  const docPath = path.join(__dirname, "..", "..", "docs", "API.md");

  if (!fs.existsSync(docPath)) {
    return bot.sendMessage(msg.chat.id, "Docs file not found.");
  }

  await bot.sendDocument(msg.chat.id, docPath, {}, { filename: "API.md" });
}

module.exports = {
  handleDocs,
  handleDocsFile,
  handleMyKeys,
  handleStats,
  handleHistory,
  handleHistoryFilter,
  handleHelp,
  handleProfile,
  handleUpdateMobile,
  handleUpdateUpi,
  handleUpdateGmail,
  handleUpdateText,
};
