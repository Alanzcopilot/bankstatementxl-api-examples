"""QuickBooks Desktop and Quicken files (QBO, QFX): choose the statement's bank, confirm it once, then download.

Run it:  python quickbooks-desktop.py <statement.pdf or stmt_...> [intu_bid]
  A QBO file carries the Intuit bank ID of the bank named on the statement, and only that one. Ask without an ID
  and the API lists the banks the statement's bank may be: your user chooses theirs. If you already know the ID,
  pass it as intu_bid. The first time for a bank, your user confirms a short notice, and it is recorded.
  A bank that isn't on Intuit's list can't get a QBO file: use OFX or IIF instead (format=ofx or format=iif).
  For Quicken, ask for format=qfx in the same way.
Needs:   pip install requests, and your API key in the BSXL_API_KEY environment variable.
"""
import os
import sys
import time

import requests

BASE = os.environ.get("BSXL_API_BASE", "https://api.bankstatementxl.com/v1")
KEY = os.environ.get("BSXL_API_KEY") or sys.exit("Set BSXL_API_KEY to your API key first.")
HEADERS = {"Authorization": f"Bearer {KEY}"}
if len(sys.argv) < 2:
    sys.exit("Usage: python quickbooks-desktop.py <statement.pdf or stmt_...> [intu_bid]")


def fail(r):
    err = r.json()["error"]
    sys.exit(f"{r.status_code} {err['code']}: {err['message']}")


def ask(question):
    try:
        return input(question).strip()
    except EOFError:
        return ""


def converted_statement(arg):
    """The id of a statement you already converted, or a file to upload and convert now."""
    if arg.startswith("stmt_"):
        return arg
    with open(arg, "rb") as f:
        r = requests.post(f"{BASE}/statements", headers=HEADERS, files={"file": (os.path.basename(arg), f)}, timeout=60)
    while r.ok and r.json()["status"] in ("queued", "processing"):
        time.sleep(int(r.headers.get("Retry-After", "2")))
        r = requests.get(f"{BASE}/statements/{r.json()['id']}", headers=HEADERS, timeout=60)
    if not r.ok:
        fail(r)
    if r.json()["status"] != "ready":
        sys.exit(f"Not converted: {r.json()['failure']['message']}")
    return r.json()["id"]


sid = converted_statement(sys.argv[1])
bank_id = sys.argv[2] if len(sys.argv) > 2 else None
for _ in range(6):
    params = {"format": "qbo"} | ({"intu_bid": bank_id} if bank_id else {})
    r = requests.get(f"{BASE}/statements/{sid}/download", headers=HEADERS, params=params, timeout=120)
    if r.ok:
        with open(f"{sid}.qbo", "wb") as f:
            f.write(r.content)
        print(f"Saved {sid}.qbo for bank {bank_id}. Back up your QuickBooks company file before you import it.")
        break
    err = r.json()["error"]

    if err["code"] in ("intu_bid_required", "bank_not_matched"):
        banks = err["banks"]  # the banks the statement's bank may be, best first: id, name, site and country
        if not banks:
            sys.exit("This statement's bank isn't on Intuit's list, so it can't get a QBO file. "
                     "Download OFX or IIF instead (format=ofx or format=iif).")
        if err["code"] == "bank_not_matched":
            print(f"\nBank {bank_id} isn't the bank on this statement.")
        print("\nWhich of these is the statement's bank?")
        for i, b in enumerate(banks, 1):
            print(f"  {i}. {b['name']} ({b['site']}, {b['country']}), bank ID {b['id']}")
        choice = ask(f"Your bank [1-{len(banks)}]: ")
        if not choice.isdigit() or not 1 <= int(choice) <= len(banks):
            sys.exit("No bank chosen, so no QBO file.")
        bank_id = banks[int(choice) - 1]["id"]

    elif err["code"] == "bank_id_confirmation_required":
        # Once per bank: show your user the notice, and record their confirmation only if they give it.
        bank = err["bank"]
        print(f"\nBefore the first QBO or QFX file for {bank['name']} (bank ID {bank['id']}), please read this:")
        print(f"\n{err['notice']}\n\n\"{err['confirmation']}\"")
        if ask("Do you confirm? [y/N] ").lower() != "y":
            sys.exit("Not confirmed, so no QBO file. Nothing was recorded.")
        c = requests.post(f"{BASE}/bank-id-confirmations", headers=HEADERS,
                          json={"intu_bid": bank["id"], "confirm": True}, timeout=60)
        if not c.ok:
            fail(c)
        print(f"Your confirmation for bank {bank['id']} is recorded.")

    else:
        fail(r)
else:
    sys.exit("No QBO file. Try again.")
