// utils/validators.js
const Imap = require("imap");

const MOBILE_REGEX = /^[6-9]\d{9}$/; // Indian 10-digit mobile
const UPI_REGEX = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IPV4_REGEX =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

function isValidMobile(input) {
  return MOBILE_REGEX.test(input.trim());
}

function isValidUpi(input) {
  return UPI_REGEX.test(input.trim());
}

function isValidEmail(input) {
  return EMAIL_REGEX.test(input.trim());
}

function isValidIPv4(ip) {
  return IPV4_REGEX.test(ip);
}

function isValidWebhookUrl(url) {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Attempts a real IMAP login with the given Gmail credentials.
 * Resolves { success: true } or { success: false, error: string }.
 * Never throws - always resolves so callers can proceed either way.
 */
function testImapConnection(email, appPassword) {
  return new Promise((resolve) => {
    const imap = new Imap({
      user: email,
      password: appPassword,
      host: "imap.gmail.com",
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 8000,
      connTimeout: 8000,
    });

    const finish = (result) => {
      try {
        imap.end();
      } catch {}
      resolve(result);
    };

    imap.once("ready", () => finish({ success: true }));
    imap.once("error", (err) => finish({ success: false, error: err.message }));

    try {
      imap.connect();
    } catch (err) {
      finish({ success: false, error: err.message });
    }
  });
}

module.exports = {
  isValidMobile,
  isValidUpi,
  isValidEmail,
  isValidIPv4,
  isValidWebhookUrl,
  testImapConnection,
};
