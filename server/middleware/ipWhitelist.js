// server/middleware/ipWhitelist.js
const userModel = require("../../database/userModel");
const { ERROR_CODES } = require("../../config/constants");

module.exports = async function ipWhitelist(req, res, next) {
  const userId = req.apiKey.userId;
  const whitelist = await userModel.getIpWhitelist(userId);

  if (whitelist.length === 0) return next();

  const callerIp =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
  const normalizedIp = callerIp.replace("::ffff:", "");

  if (!whitelist.includes(normalizedIp)) {
    return res
      .status(403)
      .json({ status: "error", ...ERROR_CODES.IP_NOT_WHITELISTED, callerIp: normalizedIp });
  }

  next();
};
