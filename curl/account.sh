#!/usr/bin/env bash
# Your account with curl: your workspace, the pages and scans you have left, your limits and the formats.
#
# Run it:  bash account.sh
# Needs:   bash and curl, and your API key in the BSXL_API_KEY environment variable.
set -euo pipefail
BASE="${BSXL_API_BASE:-https://api.bankstatementxl.com/v1}"

OUT=$(curl -sS -w '\n%{http_code}' "$BASE/account" -H "Authorization: Bearer ${BSXL_API_KEY:?Set BSXL_API_KEY to your API key first.}")
CODE=${OUT##*$'\n'}
echo "${OUT%$'\n'*}"
[ "$CODE" -lt 400 ] || exit 1
# -> {"object":"account","workspace":{...},"balance":{"pages":...,"scans":...,"held_pages":...,"held_scans":...},
#     "limits":{...},"formats":[...]}   pages and scans are what you can use now; held_* wait for a download.
