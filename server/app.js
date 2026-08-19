// server/app.js
const express = require("express");
const path = require("path");
const apiKeyAuth = require("./middleware/apiKeyAuth");
const ipWhitelist = require("./middleware/ipWhitelist");
const rateLimiter = require("./middleware/rateLimiter");
const verifyRoute = require("./routes/verify");
const historyRoute = require("./routes/history");
const qrRoute = require("./routes/qr");
const logger = require("../utils/logger");

function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));

  // Public landing/marketing page (no auth needed) - served from /public
  app.use(express.static(path.join(__dirname, "..", "public")));

  app.use("/api", apiKeyAuth, ipWhitelist, rateLimiter, verifyRoute);
  app.use("/api", apiKeyAuth, ipWhitelist, rateLimiter, historyRoute);
  app.use("/api", apiKeyAuth, ipWhitelist, rateLimiter, qrRoute);

  app.use((err, req, res, next) => {
    logger.error("Unhandled server error:", err.message);
    res.status(500).json({ status: "error", code: "E008", message: "Internal server error" });
  });

  return app;
}

module.exports = createApp;
