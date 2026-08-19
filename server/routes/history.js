// server/routes/history.js
const express = require("express");
const router = express.Router();

const txnModel = require("../../database/txnModel");
const { ERROR_CODES } = require("../../config/constants");
const logger = require("../../utils/logger");

/**
 * GET /api/history?status=success&limit=20&offset=0
 * Returns the authenticated merchant's own payment history.
 */
router.get("/history", async (req, res) => {
  try {
    const { apiKey } = req;
    const { status, limit, offset } = req.query;

    const result = await txnModel.getFullHistory(apiKey.userId, {
      status: status || null,
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    return res.status(200).json({ status: "success", ...result });
  } catch (err) {
    logger.error("history.js GET error:", err.message);
    return res.status(500).json({ status: "error", ...ERROR_CODES.SERVER_ERROR });
  }
});

module.exports = router;
