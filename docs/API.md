# Payment Verification Gateway — API Documentation

Base URL: `https://your-server-domain.com` (replace with your deployed URL / cloudflared tunnel)

All endpoints (except `/health`) require:
```
Authorization: Bearer <your_api_key>
```

---

## Verification model

Verification is **asynchronous**. When you submit a UTR, the gateway does not check it instantly — it registers a *pending* record and matches it automatically against incoming FamPay payment-notification emails (polled every ~30 seconds from the merchant's connected Gmail). Expect resolution within a few seconds up to ~1 minute.

You get the result either by:
- **Polling** `GET /api/verify/status/:txn_id`, or
- **Webhook** — set one via the bot's `/set_webhook <https-url>` command; we POST the result to it once resolved.

---

## `GET /api/qr`

Generate a UPI payment QR code and get back an `order_id` for tracking.

**Query params**
| Param | Required | Notes |
|---|---|---|
| upi | Yes | The UPI ID to receive payment (e.g. `yourname@fam`) |
| amount | No | Fixed amount. Omit or use `0` for a dynamic QR where the payer enters their own amount |

**Response `200 OK`**
```json
{
  "status": "success",
  "data": {
    "order_id": "FAMPAY1234567890ABCD",
    "upi_link": "upi://pay?pa=yourname@fam&pn=Payment%20Gateway&am=70.00&cu=INR",
    "qr_image_url": "https://api.qrserver.com/v1/create-qr-code/?...",
    "upi_id": "yourname@fam",
    "amount": 70,
    "expires_in_seconds": 300
  }
}
```

QR codes are treated as expired after 5 minutes. The `order_id` isn't required for verification — you can use it as your own `reference_id` when calling `/api/verify` for bookkeeping, but the actual match happens on UTR + amount.

---

## `POST /api/verify`

Submit a payment for verification.

**Headers**
| Header | Required | Value |
|---|---|---|
| Authorization | Yes | `Bearer fampay_live_xxxx` |
| Content-Type | Yes | `application/json` |

**Body**
```json
{
  "amount": 499.00,
  "utr": "324567891234",
  "reference_id": "order_12345",
  "customer_email": "customer@example.com"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| amount | number | Yes | Must match exactly what the FamPay email reports |
| utr | string | Yes | UTR/transaction reference from the payment |
| reference_id | string | Yes | Your own order/reference ID (for your records) |
| customer_email | string | No | Optional metadata |

**Response `202 Accepted`**
```json
{
  "status": "pending",
  "txn_id": "txn_abcdef123456",
  "verified": false,
  "message": "Verification in progress...",
  "check_status_url": "/api/verify/status/txn_abcdef123456"
}
```

**Response `409 Conflict`** — UTR already submitted before
```json
{
  "status": "error",
  "code": "E011",
  "message": "This UTR has already been submitted",
  "existing_status": "success",
  "existing_txn_id": "txn_abcdef123456"
}
```

---

## `GET /api/verify/status/:txn_id`

Check the current status of a submitted verification.

**Response `200 OK`**
```json
{
  "status": "success",
  "txn_id": "txn_abcdef123456",
  "verified": true,
  "amount": 499.00,
  "utr": "324567891234"
}
```

`status` will be one of: `pending`, `success`, `failed`, `expired`.

---

## `GET /api/history`

Fetch your own payment history.

**Query params** (all optional)
| Param | Default | Notes |
|---|---|---|
| status | (all) | `success`, `failed`, `pending`, or `expired` |
| limit | 20 | Max records to return |
| offset | 0 | For pagination |

**Response `200 OK`**
```json
{
  "status": "success",
  "total": 42,
  "results": [
    {
      "txnId": "txn_abcdef123456",
      "status": "success",
      "amount": 499.00,
      "utr": "324567891234",
      "createdAt": 1755400000000
    }
  ]
}
```

---

## `GET /health`

No auth required. Basic liveness check.

**Response `200 OK`**
```json
{ "status": "ok", "uptime": 12345.6 }
```

---

## Error codes

| Code | Meaning |
|---|---|
| E001 | Invalid or unknown API key |
| E002 | API key has been revoked |
| E003 | Account is banned |
| E004 | Caller IP not in whitelist |
| E005 | Rate limit exceeded |
| E006 | Gateway under maintenance |
| E007 | Required fields missing |
| E008 | Internal server error |
| E009 | Invalid amount |
| E010 | Transaction not found |
| E011 | Duplicate UTR |
| E012 | Invalid UPI ID format |

---

## Webhook payload

If you've set a webhook via `/set_webhook https://yourapp.com/hook`, we POST this once a pending verification resolves:

```json
{
  "status": "success",
  "txn_id": "txn_abcdef123456",
  "utr": "324567891234",
  "amount": 499.00,
  "verified": true
}
```

Webhook URLs must be HTTPS. We do not retry failed webhook deliveries — use `GET /api/verify/status/:txn_id` as a fallback source of truth.
