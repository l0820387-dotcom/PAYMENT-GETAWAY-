// bot/handlers/onboardingHandlers.js
const userModel = require("../../database/userModel");
const keyModel = require("../../database/keyModel");
const { setState, clearState, getState } = require("../state");
const { isValidMobile, isValidUpi, isValidEmail, testImapConnection } = require("../../utils/validators");
const { mainMenu } = require("../keyboards/inlineKeyboards");
const logger = require("../../utils/logger");

// /start - kicks off onboarding if not already done
async function handleStart(bot, msg) {
  const userId = msg.from.id;
  const isBanned = await userModel.isUserBanned(userId);
  if (isBanned) {
    return bot.sendMessage(userId, "🚫 Your account is banned. Contact support.");
  }

  const user = await userModel.getUser(userId);

  if (user && user.onboardingStep === "done") {
    return bot.sendMessage(userId, `👋 Welcome back! Your account is already set up.`, mainMenu);
  }

  await userModel.registerUser(userId, {});
  await userModel.setOnboardingStep(userId, "mobile");
  setState(userId, "onboard_mobile");

  await bot.sendMessage(
    userId,
    `👋 *Welcome to Payment Verification Gateway!*\n\n` +
      `Let's set up your account. This takes 4 quick steps:\n` +
      `1️⃣ Mobile number\n2️⃣ UPI ID\n3️⃣ Gmail address\n4️⃣ Gmail App Password\n\n` +
      `📱 *Step 1/4:* Please send your 10-digit mobile number.`,
    { parse_mode: "Markdown" }
  );
}

/**
 * Central router for onboarding text replies. Called from bot/index.js
 * whenever a plain-text message arrives and the user's state starts with "onboard_".
 */
async function handleOnboardingText(bot, msg) {
  const userId = msg.from.id;
  const text = msg.text.trim();
  const state = getState(userId);
  if (!state) return;

  switch (state.action) {
    case "onboard_mobile":
      return handleMobileStep(bot, userId, text);
    case "onboard_upi":
      return handleUpiStep(bot, userId, text);
    case "onboard_gmail_email":
      return handleGmailEmailStep(bot, userId, text);
    case "onboard_gmail_password":
      return handleGmailPasswordStep(bot, userId, text, msg.message_id, msg.chat.id);
    default:
      return;
  }
}

async function handleMobileStep(bot, userId, text) {
  if (!isValidMobile(text)) {
    return bot.sendMessage(
      userId,
      "❌ Invalid mobile number. Please send a valid 10-digit Indian mobile number (e.g. 9876543210)."
    );
  }

  await userModel.updateProfile(userId, { mobile: text });
  await userModel.setOnboardingStep(userId, "upi");
  setState(userId, "onboard_upi");

  await bot.sendMessage(userId, "✅ Mobile saved.\n\n💳 *Step 2/4:* Please send your UPI ID (e.g. yourname@fam).", {
    parse_mode: "Markdown",
  });
}

async function handleUpiStep(bot, userId, text) {
  if (!isValidUpi(text)) {
    return bot.sendMessage(userId, "❌ Invalid UPI ID format. Example: yourname@fam");
  }

  await userModel.updateProfile(userId, { upiId: text });
  await userModel.setOnboardingStep(userId, "gmail_email");
  setState(userId, "onboard_gmail_email");

  await bot.sendMessage(
    userId,
    "✅ UPI ID saved.\n\n📧 *Step 3/4:* Please send the Gmail address that receives your FamPay payment notification emails.",
    { parse_mode: "Markdown" }
  );
}

async function handleGmailEmailStep(bot, userId, text) {
  if (!isValidEmail(text) || !text.toLowerCase().endsWith("@gmail.com")) {
    return bot.sendMessage(userId, "❌ Please send a valid Gmail address (must end with @gmail.com).");
  }

  await userModel.updateProfile(userId, { gmailEmail: text });
  await userModel.setOnboardingStep(userId, "gmail_password");
  setState(userId, "onboard_gmail_password", { gmailEmail: text });

  await bot.sendMessage(
    userId,
    "✅ Gmail address saved.\n\n" +
      "🔐 *Step 4/4:* Please send your Gmail *App Password* (NOT your normal Gmail password).\n\n" +
      "Generate one at: https://myaccount.google.com/apppasswords\n" +
      "(Requires 2-Step Verification enabled on your Google account.)\n\n" +
      "⚠️ We'll delete your message right after reading it for your security.",
    { parse_mode: "Markdown" }
  );
}

async function handleGmailPasswordStep(bot, userId, text, messageId, chatId) {
  const state = getState(userId);
  const gmailEmail = state?.data?.gmailEmail;

  // Try to delete the message containing the password immediately
  try {
    await bot.deleteMessage(chatId, messageId);
  } catch (e) {
    logger.warn("Could not auto-delete password message:", e.message);
  }

  await bot.sendMessage(userId, "🔄 Testing connection to Gmail... please wait.");

  const testResult = await testImapConnection(gmailEmail, text);

  await userModel.setGmailCredentials(userId, gmailEmail, text, testResult.success);

  if (testResult.success) {
    await bot.sendMessage(userId, "✅ Gmail connected successfully! Verified via IMAP login.");
  } else {
    await bot.sendMessage(
      userId,
      `⚠️ Couldn't connect to Gmail right now (${testResult.error}).\n\n` +
        `Your API key will still be generated, but automatic payment verification won't work until this is fixed.\n` +
        `Use /reconnect_gmail to retry anytime.`
    );
  }

  // Generate the API key regardless of connection outcome
  await userModel.setOnboardingStep(userId, "done");
  clearState(userId);

  const { rawKey } = await keyModel.createApiKey(userId, "live");

  await bot.sendMessage(
    userId,
    `🎉 *Setup complete!*\n\n` +
      `🔐 *Your API Key:*\n\`${rawKey}\`\n\n` +
      `⚠️ *This key is shown only ONCE.* Copy it now and store it securely.\n` +
      `We only store its SHA-256 hash - if lost, generate a new one via /my_keys.\n\n` +
      `🗑️ Please delete this message after copying, for your own security.`,
    { parse_mode: "Markdown" }
  );

  await bot.sendMessage(userId, "Here's your menu:", mainMenu);
}

// /reconnect_gmail - retry IMAP test connection without redoing full onboarding
async function handleReconnectGmail(bot, msg) {
  const userId = msg.from.id;
  const user = await userModel.getUser(userId);

  if (!user?.gmailEmail || !user?.gmailAppPasswordEnc) {
    return bot.sendMessage(userId, "You haven't set up Gmail yet. Use /start to complete onboarding.");
  }

  await bot.sendMessage(userId, "🔄 Testing Gmail connection...");
  const rawPassword = await userModel.getGmailAppPassword(userId);
  const testResult = await testImapConnection(user.gmailEmail, rawPassword);

  await userModel.updateProfile(userId, { gmailConnected: testResult.success });

  if (testResult.success) {
    await bot.sendMessage(userId, "✅ Gmail connected successfully!");
  } else {
    await bot.sendMessage(
      userId,
      `❌ Still failing: ${testResult.error}\n\nCheck your App Password is still valid at https://myaccount.google.com/apppasswords`
    );
  }
}

module.exports = {
  handleStart,
  handleOnboardingText,
  handleReconnectGmail,
};
