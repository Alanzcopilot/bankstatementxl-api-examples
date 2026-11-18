"""Your account: the pages and scans you have left, and the limits that apply to your key.

Run it:  python account.py
Needs:   pip install requests, and your API key in the BSXL_API_KEY environment variable.
"""
import os
import sys

import requests

BASE = os.environ.get("BSXL_API_BASE", "https://api.bankstatementxl.com/v1")
KEY = os.environ.get("BSXL_API_KEY") or sys.exit("Set BSXL_API_KEY to your API key first.")

r = requests.get(f"{BASE}/account", headers={"Authorization": f"Bearer {KEY}"}, timeout=60)
if not r.ok:
    err = r.json()["error"]
    sys.exit(f"{r.status_code} {err['code']}: {err['message']}")
account = r.json()

balance, limits = account["balance"], account["limits"]
print(f"Workspace: {account['workspace']['name']} ({account['workspace']['id']})")
print(f"Pages left: {balance['pages']}")
print(f"Scans left: {balance['scans']}  (scanned and photographed pages use these too)")
if balance.get("held_pages") or balance.get("held_scans"):  # what's left already leaves these out
    print(f"Held: {balance['held_pages']} pages and {balance['held_scans']} scans, for statements not downloaded yet "
          "(their download uses them; deleting one frees them)")
print("Limits:")
print(f"  {limits['max_upload_mb']} MB per upload, {limits['max_pages']} pages per statement, "
      f"{limits['max_files']} page photos per statement")
print(f"  {limits['requests_per_minute']} requests a minute, {limits['max_active_statements']} converting at once")
print(f"  results kept at most {limits['retention_hours']} hours")
print(f"Formats: {', '.join(account['formats'])}")
