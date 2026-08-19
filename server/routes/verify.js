// server/routes/verify.js
const express = require("express");
const router = express.Router();

const pendingModel = require("../../database/pendingModel");
const { generateTxnId } = require("../../utils/crypto");
const { ERROR_CODES } = require("../../config/constants");
const logger = require("../../utils/logger");

/**
 * POST /api/verify
 * Body: { amount, utr, reference_id, customer_email }
 * Returns 202 pending immediately. Resolves automatically once the matching
 * FamPay email is found in the merchant's connected Gmail inbox.
 */
router.post("/verify", async (req, res) => {
  const { amount, utr, reference_id, customer_email } = req.body || {};

  if (amount === undefined || !utr || !reference_id) {
    return res.status(400).json({
      status: "error",
      ...ERROR_CODES.MISSING_FIELDS,
      required_fields: ["amount", "utr", "reference_id"],
    });
  }

  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ status: "error", ...ERROR_CODES.INVALID_AMOUNT });
  }

  const { apiKey, keyHash } = req;
  const txnId = generateTxnId();

  try {
    const result = await pendingModel.createPendingVerification({
      txnId,
      userId: apiKey.userId,
      keyHash,
      utr: String(utr).trim(),
      amount: numericAmount,
      meta: { reference_id, customer_email },
    });

    if (result.alreadyExists) {
      return res.status(409).json({
        status: "error",
        ...ERROR_CODES.DUPLICATE_UTR,
        existing_status: result.data.status,
        existing_txn_id: result.data.txnId,
      });
    }

    return res.status(202).json({
      status: "pending",
      txn_id: txnId,
      verified: false,
      message: "Verification in progress. We are matching this UTR against incoming payment emails.",
      check_status_url: `/api/verify/status/${txnId}`,
    });
  } catch (err) {
    logger.error("verify.js POST error:", err.message);
    return res.status(500).json({ status: "error", ...ERROR_CODES.SERVER_ERROR });
  }
});

/**
 * GET /api/verify/status/:txnId
 */
router.get("/verify/status/:txnId", async (req, res) => {
  try {
    const pending = await pendingModel.getPendingByTxnId(req.params.txnId);
    if (!pending) {
      return res.status(404).json({ status: "error", ...ERROR_CODES.TXN_NOT_FOUND });
    }

    return res.status(200).json({
      status: pending.status,
      txn_id: pending.txnId,
      verified: pending.status === "success",
      amount: pending.amount,
      utr: pending.utr,
    });
  } catch (err) {
    logger.error("verify.js GET status error:", err.message);
    return res.status(500).json({ status: "error", ...ERROR_CODES.SERVER_ERROR });
  }
});

module.exports = router;
