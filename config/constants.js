// config/constants.js

module.exports = {
  ADMIN_ID: String(process.env.ADMIN_ID),
  KEY_PREFIX_LIVE: process.env.KEY_PREFIX_LIVE || "fampay_live_",
  KEY_PREFIX_TEST: process.env.KEY_PREFIX_TEST || "fampay_test_",
  DEFAULT_RATE_LIMIT: parseInt(process.env.DEFAULT_RATE_LIMIT || "100", 10),
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "3600000", 10),

  FAMPAY_SENDER_EMAIL: process.env.FAMPAY_SENDER_EMAIL || "no-reply@famapp.in",
  EMAIL_POLL_INTERVAL_MS: parseInt(process.env.EMAIL_POLL_INTERVAL_MS || "30000", 10),
  STRICT_AMOUNT_MATCH: process.env.STRICT_AMOUNT_MATCH !== "false",
  PENDING_VERIFICATION_TIMEOUT_MS: parseInt(
    process.env.PENDING_VERIFICATION_TIMEOUT_MS || "900000",
    10
  ),

  // Secret used to encrypt each user's Gmail App Password at rest (AES-256-GCM).
  // MUST be set in .env - generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,

  ERROR_CODES: {
    INVALID_KEY: { code: "E001", message: "Invalid or unknown API key" },
    KEY_REVOKED: { code: "E002", message: "API key has been revoked" },
    USER_BANNED: { code: "E003", message: "Account is banned" },
    IP_NOT_WHITELISTED: { code: "E004", message: "Caller IP not in whitelist" },
    RATE_LIMIT_EXCEEDED: { code: "E005", message: "Rate limit exceeded" },
    MAINTENANCE_MODE: { code: "E006", message: "Gateway temporarily under maintenance" },
    MISSING_FIELDS: { code: "E007", message: "Required fields missing in request body" },
    SERVER_ERROR: { code: "E008", message: "Internal server error" },
    INVALID_AMOUNT: { code: "E009", message: "Invalid amount" },
    TXN_NOT_FOUND: { code: "E010", message: "Transaction not found" },
    DUPLICATE_UTR: { code: "E011", message: "This UTR has already been submitted" },
    INVALID_UPI: { code: "E012", message: "Invalid UPI ID format" },
  },

  FAQS: [
    "Q: How do I get an API key?\nA: Complete /start onboarding (mobile, UPI ID, Gmail) and it's generated automatically at the end.",
    "Q: Why do you need my Gmail App Password?\nA: We read your FamPay payment-notification emails via IMAP to auto-verify UTRs. We never see your real Gmail password - App Passwords can be revoked anytime from your Google Account without affecting your main password.",
    "Q: What does E001 mean?\nA: Your API key is invalid or not found in our system.",
    "Q: What does E004 mean?\nA: Your server IP isn't whitelisted. Use /add_ip <your_ip>.",
    "Q: What does E005 mean?\nA: You've hit your rate limit.",
    "Q: Test vs Live mode?\nA: Test mode simulates verification without checking real emails. Switch anytime via inline button.",
  ],
};
