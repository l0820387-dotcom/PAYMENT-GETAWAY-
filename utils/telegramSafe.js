// utils/telegramSafe.js
// Telegram's legacy "Markdown" parse_mode throws hard errors ("can't parse
// entities") if special characters (_ * ` [ ]) appear unbalanced anywhere in
// the message - including inside code blocks in some edge cases. Any text
// that comes from user input or contains unpredictable characters (API keys,
// mobile numbers, broadcast messages, error strings) should be escaped
// before being interpolated into a Markdown-formatted message.

function escapeMarkdown(text) {
  if (text === null || text === undefined) return "";
  return String(text).replace(/([_*`[\]])/g, "\\$1");
}

module.exports = { escapeMarkdown };
