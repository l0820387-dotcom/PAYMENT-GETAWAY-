// database/userModel.js
const store = require("./jsonStore");
const { encryptSecret, decryptSecret } = require("../utils/crypto");

const TABLE = "users";

async function getUser(userId) {
  return store.get(TABLE, String(userId));
}

/**
 * Creates a user record at the start of onboarding (mobile number step).
 * Later steps (upi, email) fill it in via updateProfile / setGmailCredentials.
 */
async function registerUser(userId, { mobile } = {}) {
  const existing = await getUser(userId);
  if (existing) return existing;

  const userData = {
    userId: String(userId),
    mobile: mobile || null,
    upiId: null,
    gmailEmail: null,
    gmailAppPasswordEnc: null, // { iv, authTag, data } - never store raw
    gmailConnected: false, // whether last IMAP test succeeded
    onboardingStep: "mobile", // mobile -> upi -> gmail_email -> gmail_password -> done
    isBanned: false,
    createdAt: Date.now(),
  };
  await store.set(TABLE, String(userId), userData);
  return userData;
}

async function updateProfile(userId, updates) {
  return store.update(TABLE, String(userId), updates);
}

async function setOnboardingStep(userId, step) {
  return store.update(TABLE, String(userId), { onboardingStep: step });
}

/** Encrypts and stores the Gmail App Password. Raw password never persisted. */
async function setGmailCredentials(userId, email, rawAppPassword, connected) {
  const encrypted = encryptSecret(rawAppPassword);
  return store.update(TABLE, String(userId), {
    gmailEmail: email,
    gmailAppPasswordEnc: encrypted,
    gmailConnected: connected,
  });
}

/** Decrypts and returns the raw Gmail App Password for making an IMAP connection. */
async function getGmailAppPassword(userId) {
  const user = await getUser(userId);
  if (!user?.gmailAppPasswordEnc) return null;
  return decryptSecret(user.gmailAppPasswordEnc);
}

async function setBanStatus(userId, isBanned) {
  return store.update(TABLE, String(userId), { isBanned });
}

async function isUserBanned(userId) {
  const user = await getUser(userId);
  return user ? user.isBanned === true : false;
}

async function addIpToWhitelist(userId, ip) {
  const user = await getUser(userId);
  const current = user?.ipWhitelist || [];
  if (current.includes(ip)) return current;
  current.push(ip);
  await store.update(TABLE, String(userId), { ipWhitelist: current });
  return current;
}

async function getIpWhitelist(userId) {
  const user = await getUser(userId);
  return user?.ipWhitelist || [];
}

async function setWebhookUrl(userId, url) {
  return store.update(TABLE, String(userId), { webhookUrl: url });
}

async function getAllUsers() {
  return store.getAll(TABLE);
}

async function linkKeyToUser(userId, keyHash) {
  const user = await getUser(userId);
  const keys = user?.keys || {};
  keys[keyHash] = true;
  await store.update(TABLE, String(userId), { keys });
}

async function unlinkKeyFromUser(userId, keyHash) {
  const user = await getUser(userId);
  const keys = user?.keys || {};
  delete keys[keyHash];
  await store.update(TABLE, String(userId), { keys });
}

module.exports = {
  getUser,
  registerUser,
  updateProfile,
  setOnboardingStep,
  setGmailCredentials,
  getGmailAppPassword,
  setBanStatus,
  isUserBanned,
  addIpToWhitelist,
  getIpWhitelist,
  setWebhookUrl,
  getAllUsers,
  linkKeyToUser,
  unlinkKeyFromUser,
};
