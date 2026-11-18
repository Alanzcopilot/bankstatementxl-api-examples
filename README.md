# BankStatementXL API examples

Convert PDF bank and credit card statements to Excel, CSV, QuickBooks (QBO), Xero, OFX, QIF and JSON from your own code, with every row checked against the statement's running balance.

- Website: https://bankstatementxl.com
- API reference: https://api.bankstatementxl.com/v1/docs
- Get a key: Settings → Developers on bankstatementxl.com (the API comes with Pro and Business plans, free trials included)

Runnable examples for the BankStatementXL API, a Postman collection, and a sample statement to try them on.
`sample-statement.pdf` is a generated sample, not a real bank statement: 2 pages, 31 transactions.

| Example | What it does | Python | Node |
|---|---|---|---|
| Convert a statement | Upload a PDF, wait for it, download Excel and JSON | `python/convert.py` | `node/convert.mjs` |
| Receive webhooks | Check each event's signature, skip repeats, print ready and failed statements | `python/webhooks.py` | `node/webhooks.mjs` |
| Handle errors | Retry when the API is busy or has a problem, explain every other error | `python/errors.py` | `node/errors.mjs` |
| Check your balance | Pages and scans you can use, what's held, and your limits | `python/account.py` | `node/account.mjs` |
| Convert a folder | Several statements, a few at a time | `python/batch.py` | `node/batch.mjs` |
| QuickBooks Desktop files | QBO files: choose the bank, confirm it once, download | `python/quickbooks-desktop.py` | `node/quickbooks-desktop.mjs` |

## Run them
1. Create a key in Settings → Developers on bankstatementxl.com, and put it in an environment variable:
   `export BSXL_API_KEY=...` (PowerShell: `$env:BSXL_API_KEY = "..."`).
2. Python 3.9 or newer: `pip install requests` (macOS and Linux: first `python3 -m venv .venv` and
   `source .venv/bin/activate`), then from this folder: `python python/convert.py`.
3. Node 18 or newer, no packages needed: `node node/convert.mjs`. bash and curl: `bash curl/convert.sh`.

The examples use `sample-statement.pdf` unless you pass your own file. `BSXL_API_BASE` changes the API address
(the default is `https://api.bankstatementxl.com/v1`). The webhook servers need `BSXL_WEBHOOK_SECRET`, the signing
secret you get when you add your address. Postman: import `postman/BankStatementXL.postman_collection.json` and put
your key in the `apiKey` variable's Current value (the Initial value is shared), or in Postman Vault.

## Ready-made automations
`n8n/`: five workflows to import into n8n, from Gmail, Outlook, Google Drive, Dropbox or OneDrive to Sheets, Excel,
folders, Slack and email (`n8n/README.md`). `zapier/`: the same five as Zapier recipes.

## Keep your key and your files safe
- Keep the key in an environment variable or your secrets manager. Never put it in your code, in git or in a browser.
- If a key leaks, revoke it in Settings → Developers and create a new one.
- Downloaded files hold the statement's transactions: store and delete them as carefully as the statement itself.
