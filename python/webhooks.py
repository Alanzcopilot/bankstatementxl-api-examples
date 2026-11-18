"""Receive webhook events: a small server that checks each event's signature before trusting it.

Run it:  python webhooks.py     (listens on 127.0.0.1:8000; set HOST and PORT to change it)
Needs:   the address's signing secret in the BSXL_WEBHOOK_SECRET environment variable. Standard library only.

Register your server's address once. It must be https and reachable from the internet:
  curl -X POST https://api.bankstatementxl.com/v1/webhook-endpoints \
    -H "Authorization: Bearer $BSXL_API_KEY" -H "Content-Type: application/json" \
    -d '{"url": "https://your-server.example.com/bsxl-events"}'
  -> 201 {"id": "we_...", "secret": "whsec_...", ...}   The secret is shown only in this answer: keep it.
Then send a test event to check that it arrives:
  curl -X POST https://api.bankstatementxl.com/v1/webhook-endpoints/we_.../test -H "Authorization: Bearer $BSXL_API_KEY"
  -> {"delivered": true, "status": 200, ...}
"""
import hashlib
import hmac
import json
import os
import sys
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

SECRET = (os.environ.get("BSXL_WEBHOOK_SECRET") or sys.exit("Set BSXL_WEBHOOK_SECRET first.")).encode()
HOST, PORT = os.environ.get("HOST", "127.0.0.1"), int(os.environ.get("PORT", "8000"))
seen = set()  # event ids already handled (keep these in your database in production)


def signed_by_bankstatementxl(body, header):
    """BSXL-Signature: t=<Unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>", keyed with your secret>."""
    try:
        parts = dict(part.split("=", 1) for part in header.split(","))
        sent_at = int(parts["t"])
    except (KeyError, ValueError):
        return False
    if abs(time.time() - sent_at) > 300:  # older than 5 minutes: refuse it, it may be a replay
        return False
    expected = hmac.new(SECRET, parts["t"].encode() + b"." + body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected.encode(), parts.get("v1", "").encode())  # constant-time compare


class Events(BaseHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))  # the raw body: sign-checked as sent
        if not signed_by_bankstatementxl(body, self.headers.get("BSXL-Signature", "")):
            self.send_response(400)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        # Answer at once (within 10 seconds, or the event is sent again later), then do the work.
        self.send_response(200)
        self.send_header("Content-Length", "0")
        self.end_headers()

        event_id = self.headers.get("BSXL-Event-Id", "")
        if event_id in seen:  # a repeat of an event already handled (retries keep the same id)
            print(f"{event_id}: already handled, skipped")
            return
        seen.add(event_id)
        event = json.loads(body)
        data = event["data"]
        if event["type"] == "statement.ready":
            c = data["checks"]
            print(f"statement.ready {data['id']}: {c['rows']} rows, {c['rows_not_adding_up']} not adding up")
            # Download it now: GET /v1/statements/{id}/download?format=xlsx
        elif event["type"] == "statement.failed":
            print(f"statement.failed {data['id']}: {data['failure']['code']}: {data['failure']['message']}")
        elif event["type"] == "ping":
            print(f"ping: {data['message']}")
        # Other types may be added later: ignore what you don't know.

    def log_message(self, *args):  # keep the output to the lines above
        pass


print(f"Listening for events on http://{HOST}:{PORT}")
HTTPServer((HOST, PORT), Events).serve_forever()
