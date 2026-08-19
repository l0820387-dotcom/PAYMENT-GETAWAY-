// email/emailParser.js
// Extracts UTR, amount, and date from a FamPay payment-notification email body.
// Patterns below are based on a real FamPay "money received" email sample:
//
//   Hey <Name>,
//   You have successfully received
//   ₹70.0
//   from <Sender Name>
//   Transaction ID :
//   FMPIB6418022119
//   Date :
//   11:39 AM IST, 17 August 2026
//   Updated Balance :
//   ₹70.0
//   UTR :
//   659564536844
//   Purpose :
//   ZU73C190254628D337
//
// IMPORTANT: "Transaction ID" (FMPIB...) and "UTR" (numeric) are DIFFERENT
// fields in FamPay's email. Only the UTR field should be used for matching -
// merchants submit the UTR, not FamPay's internal transaction ID.

const logger = require("../utils/logger");

// UTR appears on its own line right after a "UTR :" label. Capture the
// next run of digits (FamPay UTRs seen so far are purely numeric, 10-18 digits).
const UTR_PATTERNS = [
  /UTR\s*:?\s*\n?\s*([0-9]{10,18})/i,
  // fallback for inline "UTR: 123456" on a single line
  /UTR\s*:?\s*([0-9]{10,18})/i,
];

// Amount appears right after "successfully received" as ₹<number>, and again
// under "Updated Balance :". We want the FIRST occurrence (the received amount),
// not the balance (which could differ if the wallet had prior funds).
const AMOUNT_PATTERNS = [
  /successfully\s+received\s*\n?\s*₹\s*([0-9]+(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?)/i,
  // fallback: any ₹ amount with decimal (FamPay always shows "X.0" style)
  /₹\s*([0-9]+(?:,[0-9]{2,3})*\.[0-9]{1,2})/,
  // last-resort fallback: Rs./INR prefix
  /(?:Rs\.?|INR)\s*([0-9]+(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?)/i,
];

function extractUtr(text) {
  for (const pattern of UTR_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

function extractAmount(text) {
  for (const pattern of AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const num = parseFloat(match[1].replace(/,/g, ""));
      if (!isNaN(num)) return num;
    }
  }
  return null;
}

function parseFampayEmail(parsedMail) {
  const text = parsedMail.text || parsedMail.html || "";
  if (!text) return null;

  const lowerText = text.toLowerCase();
  const looksLikePaymentEmail =
    lowerText.includes("successfully received") ||
    lowerText.includes("received") ||
    lowerText.includes("credited");

  if (!looksLikePaymentEmail) return null;

  const utr = extractUtr(text);
  const amount = extractAmount(text);

  if (!utr || amount === null) {
    logger.warn("[emailParser] Could not extract UTR/amount:", {
      subject: parsedMail.subject,
      utrFound: !!utr,
      amountFound: amount !== null,
    });
    return null;
  }

  return {
    utr,
    amount,
    receivedAt: parsedMail.date ? new Date(parsedMail.date).getTime() : Date.now(),
    subject: parsedMail.subject || "",
  };
}

module.exports = { parseFampayEmail, extractUtr, extractAmount };
