// bot/state.js
const userState = new Map();

function setState(userId, action, data = {}) {
  userState.set(String(userId), { action, data });
}

function getState(userId) {
  return userState.get(String(userId)) || null;
}

function clearState(userId) {
  userState.delete(String(userId));
}

module.exports = { setState, getState, clearState };
