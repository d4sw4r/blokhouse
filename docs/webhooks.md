# Webhooks

Blokhouse can call your systems when configuration items change, so that automation reacts
instead of polling: refresh an AWX inventory, open a ticket, update monitoring, post to chat.

Webhooks fire for **every** change to an item, wherever it comes from: the web UI, API v1, the
legacy API, bulk operations, CSV import, the Ansible collection or the Puppet report processor.

## Setup

**Admin → Webhooks**: enter a name, the URL and the events, then copy the **signing secret**.
It is shown only once. Use **Send test** to check that your receiver works. The delivery log
shows every attempt, the response code and the payload, and can send a delivery again.

Or use the API (token with the `admin` scope):

```bash
curl -X POST "$BLOKHOUSE_URL/api/v1/webhooks" \
  -H "Authorization: Bearer $BLOKHOUSE_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name": "AWX sync", "url": "https://awx.example.com/hooks/blokhouse", "events": ["item.created", "item.deleted"]}'
# → {"data": {"id": "…", "secret": "whsec_…", …}}
```

Endpoints: `GET/POST /api/v1/webhooks`, `GET/PATCH/DELETE /api/v1/webhooks/{id}`
(`{"rotateSecret": true}` creates a new secret), `POST /api/v1/webhooks/{id}/ping`,
`GET /api/v1/webhooks/{id}/deliveries`, `POST …/deliveries/{deliveryId}/redeliver`.
Details are in the OpenAPI document (`/docs`, tab API v1).

## Events

| Event | When | `data.item` | `data.previous` |
|-------|------|-------------|-----------------|
| `item.created` | An item was created | the new item | `null` |
| `item.updated` | Fields, type, tags or custom fields changed | the item now | the item before |
| `item.deleted` | An item was deleted | `null` | the item before |
| `ping` | **Send test** / `POST …/ping` | — | — |

An update that changes nothing (for example an Ansible or Puppet run that reports the same
values again) sends no event.

## Request

```http
POST /hooks/blokhouse HTTP/1.1
Content-Type: application/json
User-Agent: Blokhouse-Webhook/0.4.0
X-Blokhouse-Event: item.updated
X-Blokhouse-Delivery: cm4k9…            (unique per delivery; use it to detect duplicates)
X-Blokhouse-Timestamp: 1764068400       (Unix seconds)
X-Blokhouse-Signature: sha256=5f2c…

{
  "id": "evt_6b1f…",
  "event": "item.updated",
  "occurredAt": "2026-11-25T11:00:00.000Z",
  "data": {
    "item":     { "id": "…", "name": "web-01", "ip": "10.0.0.16", "status": "ACTIVE", "type": "Server",
                  "tags": ["prod"], "customFields": { "os": "Debian 12" }, "source": null, "externalId": null,
                  "lastSeenAt": "…", "createdAt": "…", "updatedAt": "…" },
    "previous": { "…": "same shape, before the change" },
    "changes":  ["ip"]
  },
  "actor": { "userId": "…", "via": "token" }
}
```

Items have the same shape as in API v1. `changes` lists the top-level fields that changed.

## Verifying the signature

The signature is an HMAC-SHA256 over `<timestamp>.<raw body>` with the webhook's secret.
Compare it in constant time, and reject old timestamps (for example older than 5 minutes) to
prevent replays.

**Node.js**

```js
import { createHmac, timingSafeEqual } from "node:crypto";

function verify(secret, headers, rawBody) {
  const ts = headers["x-blokhouse-timestamp"];
  const expected = "sha256=" + createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex");
  const given = headers["x-blokhouse-signature"] || "";
  const fresh = Math.abs(Date.now() / 1000 - Number(ts)) < 300;
  return fresh && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}
```

**Python**

```python
import hashlib, hmac, time

def verify(secret: str, headers, raw_body: bytes) -> bool:
    ts = headers["X-Blokhouse-Timestamp"]
    expected = "sha256=" + hmac.new(secret.encode(), ts.encode() + b"." + raw_body, hashlib.sha256).hexdigest()
    fresh = abs(time.time() - int(ts)) < 300
    return fresh and hmac.compare_digest(expected, headers.get("X-Blokhouse-Signature", ""))
```

## Delivery and retries

- Any **2xx** response is a success. Redirects are not followed and count as failures.
- Timeout: 10 seconds.
- Failed deliveries are retried after 30 s, 2 min, 10 min, 1 h and 6 h, so 6 attempts over
  about 7 hours. After that the delivery is marked `failed`; send it again from the log.
- Events for one webhook are sent in the order they happened, except while an earlier event
  waits for a retry. Use `occurredAt` or the item's `updatedAt` if order matters.
- A delivery can arrive more than once (for example if Blokhouse restarts mid-send). Use
  `X-Blokhouse-Delivery` to ignore duplicates.
- Events are stored in the database before they are sent, so they survive restarts.
  The log keeps successful deliveries for 14 days and failed ones for 30 days.
- Disabled webhooks receive nothing. Deliveries that were still waiting are marked `failed`.

## Security notes

- Only administrators can manage webhooks. Creating, changing and deleting them is recorded in
  the audit log.
- The secret is stored in the database as is, because Blokhouse needs it to sign. Treat database
  backups as sensitive. Rotate the secret (**New secret**) if it may have leaked.
- Blokhouse can call any address it can reach, including internal ones. That is intended:
  receivers are usually internal. Restrict outgoing traffic at the network level if needed.
