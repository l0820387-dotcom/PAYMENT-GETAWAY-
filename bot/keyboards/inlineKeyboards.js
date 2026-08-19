// bot/keyboards/inlineKeyboards.js

const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: "📄 My Keys", callback_data: "my_keys" },
        { text: "📊 Stats", callback_data: "stats" },
      ],
      [
        { text: "🧾 History", callback_data: "history" },
        { text: "👤 Profile", callback_data: "profile" },
      ],
      [
        { text: "📘 Docs", callback_data: "docs" },
        { text: "❓ Help", callback_data: "help" },
      ],
    ],
  },
};

function keyActions(keyId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🔁 Switch Mode", callback_data: `switch_${keyId}` },
          { text: "🗑️ Revoke & Delete", callback_data: `revoke_${keyId}` },
        ],
      ],
    },
  };
}

function confirmDelete(keyId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Confirm Delete", callback_data: `confirmdel_${keyId}` },
          { text: "❌ Cancel", callback_data: "cancel_action" },
        ],
      ],
    },
  };
}

function adminPanel() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📊 Global Stats", callback_data: "admin_stats" }],
        [
          { text: "⏸️ Toggle Maintenance", callback_data: "admin_maintenance" },
          { text: "📤 Export Data", callback_data: "admin_export" },
        ],
      ],
    },
  };
}

function historyFilters() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Success", callback_data: "hist_success" },
          { text: "❌ Failed", callback_data: "hist_failed" },
          { text: "⏳ Pending", callback_data: "hist_pending" },
        ],
        [{ text: "📋 All", callback_data: "hist_all" }],
      ],
    },
  };
}

module.exports = { mainMenu, keyActions, confirmDelete, adminPanel, historyFilters };
