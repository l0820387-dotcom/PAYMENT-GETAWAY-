// database/pendingModel.js
const store = require("./jsonStore");

const TABLE = "pending";

async function createPendingVerification({ txnId, userId, keyHash, utr, amount, meta = {} }) {
  const existing = await store.get(TABLE, utr);
  if (existing) return { alreadyExists: true, data: existing };

  const data = {
    txnId,
    userId: String(userId),
    keyHash,
    utr,
    amount,
    status: "pending",
    createdAt: Date.now(),
    meta,
  };
  await store.set(TABLE, utr, data);
  return { alreadyExists: false, data };
}

async function getPendingByUtr(utr) {
  return store.get(TABLE, utr);
}

async function getPendingByTxnId(txnId) {
  const results = store.find(TABLE, (p) => p.txnId === txnId);
  return results.length > 0 ? results[0] : null;
}

async function markVerified(utr, matchedEmailData) {
  return store.update(TABLE, utr, {
    status: "success",
    verifiedAt: Date.now(),
    matchedEmail: matchedEmailData,
  });
}

async function markFailed(utr, reason) {
  return store.update(TABLE, utr, {
    status: "failed",
    failedAt: Date.now(),
    failReason: reason,
  });
}

async function expireOldPending(timeoutMs) {
  const all = store.find(TABLE, (p) => p.status === "pending");
  const now = Date.now();
  const expired = [];

  for (const p of all) {
    if (now - p.createdAt > timeoutMs) {
      await store.update(TABLE, p.utr, { status: "expired", expiredAt: now });
      expired.push(p);
    }
  }
  return expired;
}

module.exports = {
  createPendingVerification,
  getPendingByUtr,
  getPendingByTxnId,
  markVerified,
  markFailed,
  expireOldPending,
};
