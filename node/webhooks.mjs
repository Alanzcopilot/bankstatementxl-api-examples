// Receive webhook events: a small server that checks each event's signature before trusting it.
//
// Run it:  node webhooks.mjs     (listens on 127.0.0.1:8000; set HOST and PORT to change it)
// Needs:   Node 18 or newer (no packages), and the address's signing secret in BSXL_WEBHOOK_SECRET.
//
// Register your server's address once. It must be https and reachable from the internet:
//   curl -X POST https://api.bankstatementxl.com/v1/webhook-endpoints \
//     -H "Authorization: Bearer $BSXL_API_KEY" -H "Content-Type: application/json" \
//     -d '{"url": "https://your-server.example.com/bsxl-events"}'
//   -> 201 {"id": "we_...", "secret": "whsec_...", ...}   The secret is shown only in this answer: keep it.
// Then send a test event to check that it arrives:
//   curl -X POST https://api.bankstatementxl.com/v1/webhook-endpoints/we_.../test -H "Authorization: Bearer $BSXL_API_KEY"
//   -> {"delivered": true, "status": 200, ...}
import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

const SECRET = process.env.BSXL_WEBHOOK_SECRET;
if (!SECRET) {
    console.error("Set BSXL_WEBHOOK_SECRET first.");
    process.exit(1);
}
const HOST = process.env.HOST ?? "127.0.0.1";
const PORT = Number(process.env.PORT ?? 8000);
const seen = new Set(); // event ids already handled (keep these in your database in production)

// BSXL-Signature: t=<Unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>", keyed with your secret>.
function signedByBankStatementXL(body, header) {
    const parts = Object.fromEntries(header.split(",").map((part) => [part.slice(0, part.indexOf("=")), part.slice(part.indexOf("=") + 1)]));
    const sentAt = Number(parts.t);
    if (!Number.isInteger(sentAt) || Math.abs(Date.now() / 1000 - sentAt) > 300) return false; // older than 5 minutes: refuse it
    const expected = Buffer.from(createHmac("sha256", SECRET).update(`${parts.t}.`).update(body).digest("hex"));
    const given = Buffer.from(parts.v1 ?? "");
    return given.length === expected.length && timingSafeEqual(given, expected); // constant-time compare
}

createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
        const body = Buffer.concat(chunks); // the raw body: sign-checked exactly as sent
        if (req.method !== "POST" || !signedByBankStatementXL(body, req.headers["bsxl-signature"] ?? "")) {
            res.writeHead(400).end();
            return;
        }
        res.writeHead(200).end(); // answer at once (within 10 seconds, or the event is sent again later), then do the work

        const eventId = req.headers["bsxl-event-id"] ?? "";
        if (seen.has(eventId)) {
            console.log(`${eventId}: already handled, skipped`); // a repeat (retries keep the same id)
            return;
        }
        seen.add(eventId);
        const { type, data } = JSON.parse(body);
        if (type === "statement.ready") {
            console.log(`statement.ready ${data.id}: ${data.checks.rows} rows, ${data.checks.rows_not_adding_up} not adding up`);
            // Download it now: GET /v1/statements/{id}/download?format=xlsx
        } else if (type === "statement.failed") {
            console.log(`statement.failed ${data.id}: ${data.failure.code}: ${data.failure.message}`);
        } else if (type === "ping") {
            console.log(`ping: ${data.message}`);
        } // other types may be added later: ignore what you don't know
    });
}).listen(PORT, HOST, () => console.log(`Listening for events on http://${HOST}:${PORT}`));
