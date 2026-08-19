# Payment Verification Gateway v2 — Local DB Edition

No Firebase, no external DB — everything stored as local JSON files under `/data`. Each user connects their own Gmail (App Password) during onboarding, and we watch their inbox for FamPay payment emails to auto-verify UTRs.

## Deploying on Railway (permanent public URL, runs 24/7 without your phone)

**Important limitation:** Railway's free tier filesystem is *ephemeral* — every redeploy/restart wipes the `/data` folder (all users, keys, transactions). This setup is fine for testing but not for production; ask if you need persistent storage added (e.g. a Railway Volume or a real database) before going live with real users.

### 1. Push this project to GitHub
```bash
cd payment-gateway-bot-v2
git init
git add .
git commit -m "Initial commit"
```
Create a new repo on https://github.com/new (keep it private), then:
```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```

### 2. Deploy on Railway
1. Go to https://railway.app → sign in with GitHub
2. **New Project** → **Deploy from GitHub repo** → select your repo
3. Railway will auto-detect Node.js and start building

### 3. Set environment variables
In the Railway project → your service → **Variables** tab, add each of these (same values as your local `.env`):
```
BOT_TOKEN=your_telegram_bot_token
ADMIN_ID=your_numeric_telegram_id
ENCRYPTION_KEY=your_64_char_hex_key
PORT=3000
KEY_PREFIX_LIVE=fampay_live_
KEY_PREFIX_TEST=fampay_test_
DEFAULT_RATE_LIMIT=100
RATE_LIMIT_WINDOW_MS=3600000
FAMPAY_SENDER_EMAIL=no-reply@famapp.in
EMAIL_POLL_INTERVAL_MS=30000
STRICT_AMOUNT_MATCH=true
PENDING_VERIFICATION_TIMEOUT_MS=900000
```
Don't set `PORT` manually if Railway auto-injects one — check the Variables tab; if Railway already shows a `PORT` value, leave it as-is.

### 4. Get your public URL
Once deployed, go to **Settings** → **Networking** → **Generate Domain**. You'll get a permanent URL like:
```
https://payment-gateway-bot-v2-production.up.railway.app
```
This is your fixed `base URL` — use it in the HTML test page instead of `localhost` or a cloudflared tunnel. It works from any device, anywhere, and doesn't change on restart.

### 5. Stop running it on Termux
Once Railway is live, you can close Termux — the bot and API now run on Railway 24/7. If you keep both running simultaneously, you'll get duplicate Telegram bot polling errors (`409 Conflict`) since only one instance can poll a given BOT_TOKEN at a time. Run it in **one place only**.

### Redeploying after code changes
```bash
git add .
git commit -m "your change description"
git push
```
Railway auto-redeploys on every push to `main`. Remember: this wipes `/data` (see limitation above) unless persistent storage is added.

---

## Running locally on Termux instead

## 1. Install
```bash
pkg update && pkg install nodejs -y
cd payment-gateway-bot
npm install
```

## 2. Configure environment
```bash
cp .env.example .env
nano .env
```
Fill in:
- `BOT_TOKEN` — from [@BotFather](https://t.me/BotFather)
- `ADMIN_ID` — your numeric Telegram user_id (get from [@userinfobot](https://t.me/userinfobot))
- `ENCRYPTION_KEY` — generate with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
  This encrypts every user's Gmail App Password at rest (AES-256-GCM). **Keep it secret and back it up** — if lost, all stored Gmail passwords become undecryptable and users must reconnect.

## 3. Run
```bash
node index.js
```

## 4. Keep running in Termux
```bash
pkg install tmux -y
tmux new -s gateway
node index.js
# detach: Ctrl+B then D
```

## 5. Expose API publicly
```bash
pkg install cloudflared -y
cloudflared tunnel --url http://localhost:3000
```

---

## New onboarding flow (per-user, via /start)

1. **Mobile number** — 10-digit Indian mobile
2. **UPI ID** — e.g. `yourname@fam`
3. **Gmail address** — must be a `@gmail.com` address
4. **Gmail App Password** — generated at https://myaccount.google.com/apppasswords (needs 2FA on that Google account). The bot immediately tries a real IMAP login to confirm it works, then **auto-deletes your password message** from the chat.
5. **API key is generated automatically at the end** — regardless of whether the Gmail connection succeeded. If it failed, you get a warning and can retry anytime with `/reconnect_gmail`.

Each user's own Gmail is polled independently every `EMAIL_POLL_INTERVAL_MS` (default 30s) for unread emails from `FAMPAY_SENDER_EMAIL`.

**Scale note:** this opens one IMAP connection per user per poll cycle. Fine for a handful of users on Termux. If you scale to 50+ concurrent users, ask for a rewrite using persistent IMAP IDLE connections instead.

---

## Local database structure

All data lives in `/data/*.json` (auto-created on first run):

| File | Contents |
|---|---|
| `users.json` | Profile, mobile, UPI, Gmail (encrypted password), ban status |
| `keys.json` | API keys (only SHA-256 hashes, never raw keys) |
| `transactions.json` | Full payment history |
| `pending.json` | In-flight UTR verifications awaiting email match |
| `rateLimits.json` | Per-key rate-limit windows |
| `settings.json` | Maintenance mode, global rate limit override |

**Back these up regularly** (e.g. `tar -czf backup.tar.gz data/`) — there's no cloud redundancy like Firebase gave you.

---

## Command Reference

### Onboarding / Account
`/start` `/reconnect_gmail` `/profile` `/update_mobile` `/update_upi` `/update_gmail`

### Payments & Keys
`/my_keys` `/generate_key` `/stats` `/history` `/add_ip <ip>` `/set_webhook <https-url>` `/docs` `/docs_file` `/help`

### Admin (ADMIN_ID only)
`/admin_panel` `/user_info <user_id>` `/ban <user_id>` `/unban <user_id>`
`/revoke_key <user_id> <key_hash>` `/broadcast <message>` `/set_limit <number>` `/export`

---

## API docs
See `docs/API.md` for full endpoint documentation, and `docs/postman_collection.json` — importable directly into Postman for testing.

## Branded landing page
A marketing/docs landing page lives at `public/index.html` and is served automatically at your server's root URL (e.g. `https://your-app.up.railway.app/`). Before deploying, open the file and set `BOT_USERNAME` near the bottom of the `<script>` block to your actual bot's Telegram username (without the `@`) so the "Get API key" buttons link correctly.

---

## Security notes
- Raw API keys shown once, only SHA-256 hash stored.
- Gmail App Passwords encrypted at rest (AES-256-GCM) — raw password never written to disk.
- `.env` and `/data` must never be committed to git — both are in `.gitignore`.
- Webhooks restricted to HTTPS only.
- Each UTR can only be submitted once (prevents replay).
- `/export` strips encrypted Gmail passwords from the output automatically.

## Known limitation — email pattern matching
FamPay's exact email wording isn't publicly documented. The regex patterns in `email/emailParser.js` (`UTR_PATTERNS`, `AMOUNT_PATTERNS`) are best-effort. **Before going live: forward yourself a real FamPay payment-received email, inspect its raw text, and adjust those patterns if extraction fails.**
