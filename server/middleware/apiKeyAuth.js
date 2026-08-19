// server/middleware/apiKeyAuth.js
const { hashApiKey } = require("../../utils/crypto");
const keyModel = require("../../database/keyModel");
const userModel = require("../../database/userModel");
const store = require("../../database/jsonStore");
const { ERROR_CODES } = require("../../config/constants");

module.exports = async function apiKeyAuth(req, res, next) {
  const settings = store.get("settings", "global") || {};
  if (settings.maintenanceMode === true) {
    return res.status(503).json({ status: "error", ...ERROR_CODES.MAINTENANCE_MODE });
  }

  const authHeader = req.headers["authorization"] || "";
  const rawKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (!rawKey) {
    return res.status(401).json({ status: "error", ...ERROR_CODES.INVALID_KEY });
  }

  const keyHash = hashApiKey(rawKey);
  const keyData = await keyModel.getKeyByHash(keyHash);

  if (!keyData) {
    return res.status(401).json({ status: "error", ...ERROR_CODES.INVALID_KEY });
  }
  if (keyData.revoked) {
    return res.status(403).json({ status: "error", ...ERROR_CODES.KEY_REVOKED });
  }

  const isBanned = await userModel.isUserBanned(keyData.userId);
  if (isBanned) {
    return res.status(403).json({ status: "error", ...ERROR_CODES.USER_BANNED });
  }

  req.apiKey = keyData;
  req.keyHash = keyHash;
  next();
};
