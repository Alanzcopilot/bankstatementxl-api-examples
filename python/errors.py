"""A request helper for production code: it waits and tries again when that helps, and turns every other error
into a clear message.

Run it:  python errors.py [statement.pdf]       (default: sample-statement.pdf in this folder)
Needs:   pip install requests, and your API key in the BSXL_API_KEY environment variable.
"""
import os
import sys
import time
import uuid

import requests

BASE = os.environ.get("BSXL_API_BASE", "https://api.bankstatementxl.com/v1")
KEY = os.environ.get("BSXL_API_KEY") or sys.exit("Set BSXL_API_KEY to your API key first.")


class ApiError(Exception):
    pass


def explain(r):
    """A clear message for an error answer. Every error is {"error": {"code": ..., "message": ...}}."""
    try:
        err = r.json()["error"]
    except (ValueError, KeyError, TypeError):
        return f"HTTP {r.status_code} from the API."
    s = r.status_code
    if s == 401:
        return "The API key was refused: it is missing, wrong or revoked. Check BSXL_API_KEY."
    if s == 402:
        text = f"Not enough pages: {err['pages_needed']} needed, {err['pages_left']} left."
        if err.get("scans_needed"):
            text += f" Scans: {err['scans_needed']} needed, {err['scans_left']} left."
        return text + " Add pages, or download or delete statements you have converted."
    if s == 403:
        return "Your plan doesn't include the API. It comes with the Pro and Business plans."
    if s == 410:
        return "This statement's results were deleted. Upload it again to convert it again."
    label = {404: "Not found", 409: "Not possible now", 413: "File too large", 415: "File type not supported",
             422: "Can't be done"}.get(s, f"HTTP {s}")
    return f"{label} ({err['code']}): {err['message']}"


def call(method, path, tries=5, headers=None, **kwargs):
    """One API call. Tries again after a 429 (waiting Retry-After seconds), and after a 5xx or no answer at all
    (waiting 1, 2, 4, 8 seconds). An upload sent with an Idempotency-Key is retried with the same key, so a retry
    never creates a second statement. Any other error raises ApiError with a clear message."""
    headers = {"Authorization": f"Bearer {KEY}", **(headers or {})}
    r = None
    for attempt in range(tries):
        try:
            r = requests.request(method, BASE + path, headers=headers, timeout=60, **kwargs)
        except requests.RequestException:
            r = None  # no answer: try again
        if r is not None and r.status_code < 400:
            return r
        if r is not None and r.status_code == 429:
            wait = int(r.headers.get("Retry-After", "2"))
        elif r is None or r.status_code >= 500:
            wait = 2 ** attempt
        else:
            raise ApiError(explain(r))
        if attempt < tries - 1:
            time.sleep(wait)
    raise ApiError(explain(r) if r is not None else "No answer from the API. Check your connection.")


# ---- A few calls to show it working. Try them with a wrong key, or with no pages left.

def account():
    b = call("GET", "/account").json()["balance"]
    return f"{b['pages']} pages and {b['scans']} scans left"


def upload():
    path = sys.argv[1] if len(sys.argv) > 1 else "sample-statement.pdf"
    with open(path, "rb") as f:
        data = f.read()  # bytes, not the open file, so that a retry can send it again
    r = call("POST", "/statements", files={"file": (os.path.basename(path), data)},
             headers={"Idempotency-Key": str(uuid.uuid4())})
    st = r.json()
    deadline = time.time() + 600  # never wait for ever
    while st["status"] in ("queued", "processing") and time.time() < deadline:
        time.sleep(int(r.headers.get("Retry-After", "2")))
        r = call("GET", f"/statements/{st['id']}")
        st = r.json()
    call("DELETE", f"/statements/{st['id']}")  # this demo keeps nothing: deleting it frees the pages it held
    return f"{st['id']} was {st['status']}, then deleted"


def unknown_statement():
    call("GET", "/statements/stmt_does_not_exist")
    return "found"


for name, demo in (("Account", account), ("Upload", upload), ("Unknown statement", unknown_statement)):
    try:
        print(f"{name}: {demo()}")
    except ApiError as e:
        print(f"{name}: {e}")
