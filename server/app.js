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

  // Allow browser-based clients (like the test console) to call this API.
  // This is a test/dev gateway meant to be called from arbitrary merchant
  // frontends, so we allow all origins here rather than a fixed whitelist.
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

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
