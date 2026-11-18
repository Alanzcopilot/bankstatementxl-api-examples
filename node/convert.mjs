// Convert a statement: upload a PDF, wait while it converts, then download Excel and JSON.
//
// Run it:  node convert.mjs [statement.pdf]      (default: sample-statement.pdf in this folder)
// Needs:   Node 18 or newer (no packages), and your API key in the BSXL_API_KEY environment variable.
import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";

const BASE = process.env.BSXL_API_BASE ?? "https://api.bankstatementxl.com/v1";
const KEY = process.env.BSXL_API_KEY;
if (!KEY) stop("Set BSXL_API_KEY to your API key first.");
const headers = { Authorization: `Bearer ${KEY}` };
const path = process.argv[2] ?? "sample-statement.pdf";
const sleep = (seconds) => new Promise((done) => setTimeout(done, seconds * 1000));

function stop(message) {
    console.error(message);
    process.exit(1);
}

// Stop with the API's message if the request failed. Every error is {"error": {"code": ..., "message": ...}}.
async function ok(response) {
    if (response.ok) return response;
    const { error } = await response.json();
    stop(`${response.status} ${error.code}: ${error.message}`);
}

// 1. Upload. The statement is queued at once, and nothing is charged yet.
const form = new FormData();
form.append("file", new Blob([await readFile(path)]), basename(path));
let r = await ok(await fetch(`${BASE}/statements`, { method: "POST", headers, body: form }));
let st = await r.json();

// 2. Wait while it converts. The Retry-After header says how many seconds to wait before asking again.
const deadline = Date.now() + 10 * 60 * 1000;
while (["queued", "processing"].includes(st.status) && Date.now() < deadline) {
    await sleep(Number(r.headers.get("Retry-After") ?? 2));
    r = await ok(await fetch(`${BASE}/statements/${st.id}`, { headers }));
    st = await r.json();
}

if (st.status !== "ready") {
    const failure = st.failure ?? { code: st.status, message: "Still converting. Ask again later." };
    stop(`Not converted (${failure.code}): ${failure.message}`);
}
const c = st.checks;
console.log(`${st.id} is ready: ${c.rows} rows, ${c.rows_not_adding_up} not adding up, totals match: ${c.totals_match}`);

// 3. Download. The first download uses the statement's pages and then deletes its results (the default),
//    so ask for every format you need at once. Two formats come back as one ZIP.
r = await ok(await fetch(`${BASE}/statements/${st.id}/download?format=xlsx,json`, { headers }));
const name = /filename="([^"]+)"/.exec(r.headers.get("Content-Disposition") ?? "")?.[1] ?? `${st.id}.zip`;
await writeFile(name, Buffer.from(await r.arrayBuffer()));
console.log(`Saved ${name}, with the Excel and JSON files inside (${r.headers.get("BSXL-Pages-Used")} pages used)`);
