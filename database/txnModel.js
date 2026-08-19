// database/txnModel.js
const store = require("./jsonStore");
const { generateTxnId } = require("../utils/crypto");

const TABLE = "transactions";

async function logTransaction(userId, { status, amount, keyHashUsed, utr = null, meta = {} }) {
  const txnId = generateTxnId();
  await store.set(TABLE, txnId, {
    txnId,
    userId: String(userId),
    status,
    amount,
    utr,
    keyHashUsed,
    meta,
    createdAt: Date.now(),
  });
  return txnId;
}

async function updateTransactionStatus(txnId, status, extra = {}) {
  return store.update(TABLE, txnId, { status, ...extra, updatedAt: Date.now() });
}

async function getTransaction(txnId) {
  return store.get(TABLE, txnId);
}

async function getRecentTransactions(userId, limit = 5) {
  const all = store.find(TABLE, (t) => t.userId === String(userId));
  return all.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}

/**
 * Full paginated payment history for a user (used by /history with filters).
 */
async function getFullHistory(userId, { status = null, limit = 20, offset = 0 } = {}) {
  let all = store.find(TABLE, (t) => t.userId === String(userId));
  if (status) all = all.filter((t) => t.status === status);
  all.sort((a, b) => b.createdAt - a.createdAt);
  return {
    total: all.length,
    results: all.slice(offset, offset + limit),
  };
}

async function getAllTransactions() {
  return store.getAll(TABLE);
}

module.exports = {
  logTransaction,
  updateTransactionStatus,
  getTransaction,
  getRecentTransactions,
  getFullHistory,
  getAllTransactions,
};
