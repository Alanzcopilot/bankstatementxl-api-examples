"""Convert a statement: upload a PDF, wait while it converts, then download Excel and JSON.

Run it:  python convert.py [statement.pdf]      (default: sample-statement.pdf in this folder)
Needs:   pip install requests, and your API key in the BSXL_API_KEY environment variable.
"""
import io
import os
import sys
import time
import zipfile

import requests

BASE = os.environ.get("BSXL_API_BASE", "https://api.bankstatementxl.com/v1")
KEY = os.environ.get("BSXL_API_KEY") or sys.exit("Set BSXL_API_KEY to your API key first.")
HEADERS = {"Authorization": f"Bearer {KEY}"}
path = sys.argv[1] if len(sys.argv) > 1 else "sample-statement.pdf"


def ok(r):
    """Stop with the API's message if the request failed. Every error is {"error": {"code": ..., "message": ...}}."""
    if not r.ok:
        err = r.json()["error"]
        sys.exit(f"{r.status_code} {err['code']}: {err['message']}")
    return r


# 1. Upload. The statement is queued at once, and nothing is charged yet.
with open(path, "rb") as f:
    r = ok(requests.post(f"{BASE}/statements", headers=HEADERS, files={"file": (os.path.basename(path), f)},
                         timeout=60))
st = r.json()

# 2. Wait while it converts. The Retry-After header says how many seconds to wait before asking again.
deadline = time.time() + 600
while st["status"] in ("queued", "processing") and time.time() < deadline:
    time.sleep(int(r.headers.get("Retry-After", "2")))
    r = ok(requests.get(f"{BASE}/statements/{st['id']}", headers=HEADERS, timeout=60))
    st = r.json()

if st["status"] != "ready":
    failure = st["failure"] or {"code": st["status"], "message": "Still converting. Ask again later."}
    sys.exit(f"Not converted ({failure['code']}): {failure['message']}")
c = st["checks"]
print(f"{st['id']} is ready: {c['rows']} rows, {c['rows_not_adding_up']} not adding up, "
      f"totals match: {c['totals_match']}")

# 3. Download. The first download uses the statement's pages and then deletes its results (the default),
#    so ask for every format you need at once. Two formats come back as one ZIP.
r = ok(requests.get(f"{BASE}/statements/{st['id']}/download", headers=HEADERS,
                    params={"format": "xlsx,json"}, timeout=120))
with zipfile.ZipFile(io.BytesIO(r.content)) as z:
    z.extractall(".")
    print(f"Saved {', '.join(z.namelist())} ({r.headers['BSXL-Pages-Used']} pages used)")
