// utils/crypto.js
const crypto = require("crypto");
const { KEY_PREFIX_LIVE, KEY_PREFIX_TEST, ENCRYPTION_KEY } = require("../config/constants");

function generateApiKey(mode = "live") {
  const prefix = mode === "test" ? KEY_PREFIX_TEST : KEY_PREFIX_LIVE;
  const randomPart = crypto.randomBytes(24).toString("hex");
  return `${prefix}${randomPart}`;
}

function hashApiKey(rawKey) {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

function generateTxnId() {
  return "txn_" + crypto.randomBytes(8).toString("hex");
}

function generateUserId() {
  return "user_" + crypto.randomBytes(6).toString("hex");
}

// ---- AES-256-GCM encryption for Gmail App Passwords at rest ----
// ENCRYPTION_KEY in .env must be a 64-char hex string (32 bytes).

function getKeyBuffer() {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY missing or invalid in .env. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(ENCRYPTION_KEY, "hex");
}

function encryptSecret(plainText) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKeyBuffer(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
    data: encrypted.toString("hex"),
  };
}

function decryptSecret({ iv, authTag, data }) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKeyBuffer(), Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(authTag, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(data, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf-8");
}

module.exports = {
  generateApiKey,
  hashApiKey,
  generateTxnId,
  generateUserId,
  encryptSecret,
  decryptSecret,
};
