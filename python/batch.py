"""Convert every PDF in a folder, a few at a time, and save each one in the formats you choose.

Run it:  python batch.py <folder> [formats]     formats: xlsx (the default), or several, such as xlsx,csv,qbo-csv
Files go to <folder>/converted/. Several formats for one statement come as one ZIP.
Needs:   pip install requests, and your API key in the BSXL_API_KEY environment variable.
"""
import os
import sys
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests

BASE = os.environ.get("BSXL_API_BASE", "https://api.bankstatementxl.com/v1")
KEY = os.environ.get("BSXL_API_KEY") or sys.exit("Set BSXL_API_KEY to your API key first.")
AT_ONCE = 3  # well inside the limits: 20 converting at once per workspace, 120 requests a minute per key

if len(sys.argv) < 2:
    sys.exit("Usage: python batch.py <folder> [formats]")
folder = Path(sys.argv[1])
formats = sys.argv[2] if len(sys.argv) > 2 else "xlsx"
out = folder / "converted"
out.mkdir(exist_ok=True)


def call(method, path, headers=None, **kwargs):
    """One request. After a 429 (too many requests) or a 5xx it waits and tries again, with the same headers."""
    headers = {"Authorization": f"Bearer {KEY}", **(headers or {})}
    for attempt in range(5):
        r = requests.request(method, BASE + path, headers=headers, timeout=120, **kwargs)
        if r.status_code == 429:
            time.sleep(int(r.headers.get("Retry-After", "5")))
        elif r.status_code >= 500:
            time.sleep(2 ** attempt)
        else:
            break
    if not r.ok:
        err = r.json()["error"]
        raise RuntimeError(f"{r.status_code} {err['code']}: {err['message']}")
    return r


def convert(pdf):
    try:
        # One Idempotency-Key per file: if the upload is retried, the API returns the first statement, not a second.
        r = call("POST", "/statements", headers={"Idempotency-Key": str(uuid.uuid4())},
                 files={"file": (pdf.name, pdf.read_bytes())})
        st = r.json()
        deadline = time.time() + 600  # never wait for ever
        while st["status"] in ("queued", "processing") and time.time() < deadline:
            time.sleep(int(r.headers.get("Retry-After", "2")))
            r = call("GET", f"/statements/{st['id']}")
            st = r.json()
        if st["status"] in ("queued", "processing"):
            return False, f"{pdf.name}: still converting after 10 minutes ({st['id']}); ask for it again later"
        if st["status"] == "failed":
            return False, f"{pdf.name}: not converted ({st['failure']['code']}): {st['failure']['message']}"
        # One download with every format: the first download deletes the results (the default).
        r = call("GET", f"/statements/{st['id']}/download", params={"format": formats})
        ext = r.headers["Content-Disposition"].rsplit(".", 1)[-1].strip('"')  # the format, or zip for several
        target = out / f"{pdf.stem}.{ext}"
        target.write_bytes(r.content)
        c = st["checks"]
        return True, f"{pdf.name}: {c['rows']} rows, {c['rows_not_adding_up']} not adding up -> {target}"
    except (RuntimeError, requests.RequestException) as e:
        return False, f"{pdf.name}: {e}"


pdfs = sorted(p for p in folder.iterdir() if p.suffix.lower() == ".pdf")
done = 0
with ThreadPoolExecutor(max_workers=AT_ONCE) as pool:
    for converted, line in pool.map(convert, pdfs):
        print(line)
        done += converted
print(f"Done: {done} of {len(pdfs)} converted.")
sys.exit(0 if done == len(pdfs) else 1)
