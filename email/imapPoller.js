// email/imapPoller.js
// Every EMAIL_POLL_INTERVAL_MS, loops through all users who have connected
// Gmail credentials and checks each one's inbox for new FamPay emails,
// matching UTR+amount against that user's own pending verifications.
//
// NOTE ON SCALE: this opens one IMAP connection per user per poll cycle.
// Fine for a handful of users on Termux. If you grow to 50+ active users,
// consider keeping persistent IMAP connections (IDLE mode) instead of
// reconnecting every cycle - that's a bigger rewrite, ask if you need it.

const Imap = require("imap");
const { simpleParser } = require("mailparser");
const {
  FAMPAY_SENDER_EMAIL,
  EMAIL_POLL_INTERVAL_MS,
  STRICT_AMOUNT_MATCH,
} = require("../config/constants");
const { parseFampayEmail } = require("./emailParser");
const userModel = require("../database/userModel");
const pendingModel = require("../database/pendingModel");
const keyModel = require("../database/keyModel");
const txnModel = require("../database/txnModel");
const logger = require("../utils/logger");

let isPolling = false;
let botInstance = null;

function setBotInstance(bot) {
  botInstance = bot;
}

function connectAndFetch(email, appPassword) {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: email,
      password: appPassword,
      host: "imap.gmail.com",
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 10000,
      connTimeout: 10000,
    });

    imap.once("error", (err) => reject(err));

    imap.once("ready", () => {
      imap.openBox("INBOX", false, (err) => {
        if (err) return reject(err);

        imap.search([["FROM", FAMPAY_SENDER_EMAIL], "UNSEEN"], (err, uids) => {
          if (err) return reject(err);
          if (!uids || uids.length === 0) {
            imap.end();
            return resolve([]);
          }

          const fetch = imap.fetch(uids, { bodies: "", markSeen: true });
          const parsed = [];
          const parsePromises = [];

          fetch.on("message", (msg) => {
            msg.on("body", (stream) => {
              parsePromises.push(
                simpleParser(stream)
                  .then((mail) => parsed.push(mail))
                  .catch((e) => logger.error("[imapPoller] parse error:", e.message))
              );
            });
          });

          fetch.once("error", (err) => reject(err));
          fetch.once("end", async () => {
            await Promise.all(parsePromises);
            imap.end();
            resolve(parsed);
          });
        });
      });
    });

    imap.connect();
  });
}

async function processEmailMatch(userId, emailData) {
  const { utr, amount, subject } = emailData;

  const pending = await pendingModel.getPendingByUtr(utr);
  if (!pending || pending.userId !== String(userId)) return; // not this user's pending txn
  if (pending.status !== "pending") return;

  const amountMatches = STRICT_AMOUNT_MATCH ? Math.abs(pending.amount - amount) < 0.01 : true;

  if (!amountMatches) {
    await pendingModel.markFailed(utr, `Amount mismatch: expected ${pending.amount}, got ${amount}`);
    await txnModel.logTransaction(pending.userId, {
      status: "failed",
      amount: pending.amount,
      keyHashUsed: pending.keyHash,
      utr,
      meta: { reason: "amount_mismatch", emailAmount: amount },
    });
    await keyModel.recordKeyUsage(pending.keyHash, false);
    logger.warn(`[imapPoller] UTR ${utr} amount mismatch for user ${userId}.`);
    return;
  }

  await pendingModel.markVerified(utr, { amount, subject, matchedAt: Date.now() });
  await txnModel.logTransaction(pending.userId, {
    status: "success",
    amount: pending.amount,
    keyHashUsed: pending.keyHash,
    utr,
    meta: {},
  });
  await keyModel.recordKeyUsage(pending.keyHash, true);
  logger.info(`[imapPoller] UTR ${utr} verified for user ${userId}.`);

  if (botInstance) {
    botInstance
      .sendMessage(userId, `✅ Payment verified!\nUTR: ${utr}\nAmount: ₹${pending.amount}`)
      .catch(() => {});
  }

  fireWebhookIfConfigured(pending).catch((e) =>
    logger.warn("[imapPoller] webhook delivery failed:", e.message)
  );
}

async function fireWebhookIfConfigured(pending) {
  const user = await userModel.getUser(pending.userId);
  if (!user?.webhookUrl) return;

  await fetch(user.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: "success",
      txn_id: pending.txnId,
      utr: pending.utr,
      amount: pending.amount,
      verified: true,
    }),
  });
}

async function pollOnce() {
  if (isPolling) return;
  isPolling = true;

  try {
    const allUsers = await userModel.getAllUsers();
    const connectedUsers = Object.values(allUsers).filter(
      (u) => u.gmailEmail && u.gmailAppPasswordEnc
    );

    for (const user of connectedUsers) {
      try {
        const rawPassword = await userModel.getGmailAppPassword(user.userId);
        const messages = await connectAndFetch(user.gmailEmail, rawPassword);

        if (messages.length > 0) {
          logger.info(`[imapPoller] ${messages.length} new email(s) for user ${user.userId}`);
        }

        for (const mail of messages) {
          const emailData = parseFampayEmail(mail);
          if (emailData) await processEmailMatch(user.userId, emailData);
        }
      } catch (err) {
        logger.error(`[imapPoller] Failed for user ${user.userId}:`, err.message);
        // Don't crash the whole poll cycle if one user's IMAP fails
      }
    }
  } catch (err) {
    logger.error("[imapPoller] Poll cycle error:", err.message);
  } finally {
    isPolling = false;
  }
}

function startPolling(bot) {
  setBotInstance(bot);
  logger.info(
    `[imapPoller] Starting multi-user email polling every ${EMAIL_POLL_INTERVAL_MS / 1000}s`
  );
  pollOnce();
  setInterval(pollOnce, EMAIL_POLL_INTERVAL_MS);
}

module.exports = { startPolling, pollOnce, setBotInstance };
