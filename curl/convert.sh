#!/usr/bin/env bash
# Convert a statement with curl: upload a PDF, wait while it converts, then download Excel and JSON as one ZIP.
#
# Run it:  bash convert.sh [statement.pdf]      (default: sample-statement.pdf in this folder)
# Needs:   bash and curl, and your API key in the BSXL_API_KEY environment variable.
set -euo pipefail
BASE="${BSXL_API_BASE:-https://api.bankstatementxl.com/v1}"
AUTH="Authorization: Bearer ${BSXL_API_KEY:?Set BSXL_API_KEY to your API key first.}"
FILE="${1:-sample-statement.pdf}"

api() {  # one request; if it fails, show the API's answer and stop
  local out code
  out=$(curl -sS -w '\n%{http_code}' -H "$AUTH" "$@")
  code=${out##*$'\n'}; out=${out%$'\n'*}
  if [ "$code" -ge 400 ]; then echo "$out" >&2; exit 1; fi
  echo "$out"
}
field() { grep -oE "\"$1\":(\"[^\"]*\"|[^,}\"]*)" | head -1 | cut -d: -f2- | tr -d '"'; }  # one field of an answer

# 1. Upload. The statement is queued at once, and nothing is charged yet.
ID=$(api -F "file=@${FILE}" "$BASE/statements" | field id)
echo "Uploaded: $ID"

# 2. Wait while it converts (the answer's Retry-After header asks for 2 seconds between checks).
for _ in $(seq 300); do
  ANSWER=$(api "$BASE/statements/$ID")
  STATUS=$(echo "$ANSWER" | field status)
  [ "$STATUS" = queued ] || [ "$STATUS" = processing ] || break
  sleep 2
done
if [ "$STATUS" != ready ]; then
  echo "Not converted ($(echo "$ANSWER" | field code)): $(echo "$ANSWER" | field message)" >&2
  exit 1
fi
echo "Ready: $(echo "$ANSWER" | field rows) rows, $(echo "$ANSWER" | field rows_not_adding_up) not adding up"

# 3. Download. The first download uses the statement's pages and then deletes its results (the default),
#    so ask for every format you need at once. Two formats come back as one ZIP.
CODE=$(curl -sS -H "$AUTH" -o "$ID.zip" -w '%{http_code}' "$BASE/statements/$ID/download?format=xlsx,json")
if [ "$CODE" -ge 400 ]; then
  cat "$ID.zip" >&2; echo >&2; rm -f "$ID.zip"; exit 1
fi
echo "Saved $ID.zip, with the Excel and JSON files inside"
