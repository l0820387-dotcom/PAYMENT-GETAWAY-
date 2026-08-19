// database/keyModel.js
const store = require("./jsonStore");
const crypto = require("crypto");
const { generateApiKey, hashApiKey } = require("../utils/crypto");
const { linkKeyToUser, unlinkKeyFromUser } = require("./userModel");

const TABLE = "keys";

async function createApiKey(userId, mode = "live") {
  const rawKey = generateApiKey(mode);
  const keyHash = hashApiKey(rawKey);
  // Telegram inline button callback_data has a strict 64-byte limit, and our
  // full SHA-256 keyHash (64 hex chars) plus a prefix like "switch_" blows past
  // that. So we generate a short keyId just for button callbacks, and store
  // both directions (keyId -> keyHash) so we can resolve it back.
  const keyId = crypto.randomBytes(6).toString("hex"); // 12 chars, short enough

  await store.set(TABLE, keyHash, {
    keyHash,
    keyId,
    userId: String(userId),
    mode,
    revoked: false,
    createdAt: Date.now(),
    totalCalls: 0,
    successCalls: 0,
    lastUsedAt: null,
  });
  await store.set("keyIdMap", keyId, { keyHash });

  await linkKeyToUser(userId, keyHash);
  return { rawKey, keyHash, keyId };
}

async function getKeyByHash(keyHash) {
  return store.get(TABLE, keyHash);
}

/** Resolves a short keyId (used in callback_data) back to the full keyHash. */
async function resolveKeyId(keyId) {
  const mapping = store.get("keyIdMap", keyId);
  return mapping ? mapping.keyHash : null;
}

async function getUserKeys(userId) {
  return store.find(TABLE, (k) => k.userId === String(userId));
}

async function revokeKey(keyHash) {
  return store.update(TABLE, keyHash, { revoked: true });
}

async function deleteKey(userId, keyHash) {
  const key = await getKeyByHash(keyHash);
  if (key?.keyId) await store.remove("keyIdMap", key.keyId);
  await store.remove(TABLE, keyHash);
  await unlinkKeyFromUser(userId, keyHash);
}

async function switchKeyMode(keyHash, mode) {
  return store.update(TABLE, keyHash, { mode });
}

async function recordKeyUsage(keyHash, success) {
  const key = await getKeyByHash(keyHash);
  if (!key) return;
  await store.update(TABLE, keyHash, {
    totalCalls: (key.totalCalls || 0) + 1,
    successCalls: (key.successCalls || 0) + (success ? 1 : 0),
    lastUsedAt: Date.now(),
  });
}

async function getAllKeys() {
  return store.getAll(TABLE);
}

module.exports = {
  createApiKey,
  getKeyByHash,
  resolveKeyId,
  getUserKeys,
  revokeKey,
  deleteKey,
  switchKeyMode,
  recordKeyUsage,
  getAllKeys,
};
