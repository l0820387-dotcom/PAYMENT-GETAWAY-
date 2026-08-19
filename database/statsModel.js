// database/statsModel.js
const { getUserKeys } = require("./keyModel");
const store = require("./jsonStore");

async function getUserStats(userId) {
  const keys = await getUserKeys(userId);
  let totalCalls = 0;
  let successCalls = 0;
  for (const k of keys) {
    totalCalls += k.totalCalls || 0;
    successCalls += k.successCalls || 0;
  }
  const successRate = totalCalls === 0 ? 0 : ((successCalls / totalCalls) * 100).toFixed(2);
  return { totalKeys: keys.length, totalCalls, successCalls, successRate };
}

async function getGlobalStats() {
  const users = store.getAll("users");
  const keys = store.getAll("keys");

  const userList = Object.values(users);
  const keyList = Object.values(keys);

  const totalUsers = userList.length;
  const bannedUsers = userList.filter((u) => u.isBanned).length;
  const totalKeys = keyList.length;
  const revokedKeys = keyList.filter((k) => k.revoked).length;

  let totalCalls = 0;
  let successCalls = 0;
  for (const k of keyList) {
    totalCalls += k.totalCalls || 0;
    successCalls += k.successCalls || 0;
  }

  return {
    totalUsers,
    bannedUsers,
    totalKeys,
    revokedKeys,
    totalCalls,
    successCalls,
    successRate: totalCalls === 0 ? 0 : ((successCalls / totalCalls) * 100).toFixed(2),
  };
}

module.exports = { getUserStats, getGlobalStats };
