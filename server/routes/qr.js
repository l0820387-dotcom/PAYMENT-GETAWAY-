// server/routes/qr.js
// Generates a UPI payment QR code for a given UPI ID + amount, and pre-registers
// an order_id so the merchant can later verify it via /api/verify using the
// same order_id as reference_id (or a fresh UTR submission that references it).

const express = require("express");
const router = express.Router();

const store = require("../../database/jsonStore");
const { ERROR_CODES } = require("../../config/constants");
const logger = require("../../utils/logger");

function generateOrderId() {
  const rand = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `FAMPAY${Date.now()}${rand}`;
}

/**
 * GET /api/qr?upi=<upi_id>&amount=<optional_amount>
 *
 * amount is optional:
 *  - omit it or pass amount=0 for a dynamic QR (payer enters their own amount)
 *  - pass a positive number for a fixed-amount QR
 *
 * Returns a UPI deep link and a QR code image URL, plus an order_id the
 * merchant should store and later use as reference_id when submitting the
 * UTR to /api/verify.
 */
router.get("/qr", async (req, res) => {
  const { apiKey } = req;
  const { upi, amount } = req.query;

  if (!upi) {
    return res.status(400).json({
      status: "error",
      ...ERROR_CODES.MISSING_FIELDS,
      required_fields: ["upi"],
    });
  }

  const upiRegex = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;
  if (!upiRegex.test(upi)) {
    return res.status(400).json({ status: "error", ...ERROR_CODES.INVALID_UPI });
  }

  let numericAmount = null;
  if (amount !== undefined && amount !== "" && amount !== "0") {
    numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount < 0) {
      return res.status(400).json({ status: "error", ...ERROR_CODES.INVALID_AMOUNT });
    }
  }

  try {
    const orderId = generateOrderId();

    const params = new URLSearchParams({
      pa: upi,
      pn: "Payment Gateway",
      cu: "INR",
      tn: `Order ${orderId}`,
    });
    if (numericAmount) params.set("am", numericAmount.toFixed(2));

    const upiLink = `upi://pay?${params.toString()}`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiLink)}`;

    // Store the order so /api/verify can later be cross-referenced by order_id
    // (merchants can submit reference_id = this order_id when they submit the UTR).
    await store.set("orders", orderId, {
      orderId,
      userId: apiKey.userId,
      keyHash: req.keyHash,
      upi,
      amount: numericAmount,
      status: "awaiting_payment",
      createdAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000, // QR treated as expired after 5 min, same as the reference bot
    });

    return res.status(200).json({
      status: "success",
      data: {
        order_id: orderId,
        upi_link: upiLink,
        qr_image_url: qrImageUrl,
        upi_id: upi,
        amount: numericAmount, // null means "dynamic - payer chooses"
        expires_in_seconds: 300,
      },
    });
  } catch (err) {
    logger.error("qr.js GET error:", err.message);
    return res.status(500).json({ status: "error", ...ERROR_CODES.SERVER_ERROR });
  }
});

module.exports = router;
