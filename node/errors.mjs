// A request helper for production code: it waits and tries again when that helps, and turns every other error
// into a clear message.
//
// Run it:  node errors.mjs [statement.pdf]      (default: sample-statement.pdf in this folder)
// Needs:   Node 18 or newer (no packages), and your API key in the BSXL_API_KEY environment variable.
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const BASE = process.env.BSXL_API_BASE ?? "https://api.bankstatementxl.com/v1";
const KEY = process.env.BSXL_API_KEY;
if (!KEY) {
    console.error("Set BSXL_API_KEY to your API key first.");
    process.exit(1);
}
const sleep = (seconds) => new Promise((done) => setTimeout(done, seconds * 1000));

class ApiError extends Error {}

// A clear message for an error answer. Every error is {"error": {"code": ..., "message": ...}}.
async function explain(r) {
    const err = (await r.json().catch(() => ({}))).error;
    if (!err) return `HTTP ${r.status} from the API.`;
    if (r.status === 401) return "The API key was refused: it is missing, wrong or revoked. Check BSXL_API_KEY.";
    if (r.status === 402) {
        let text = `Not enough pages: ${err.pages_needed} needed, ${err.pages_left} left.`;
        if (err.scans_needed) text += ` Scans: ${err.scans_needed} needed, ${err.scans_left} left.`;
        return `${text} Add pages, or download or delete statements you have converted.`;
    }
    if (r.status === 403) return "Your plan doesn't include the API. It comes with the Pro and Business plans.";
    if (r.status === 410) return "This statement's results were deleted. Upload it again to convert it again.";
    const label = { 404: "Not found", 409: "Not possible now", 413: "File too large", 415: "File type not supported", 422: "Can't be done" }[r.status];
    return `${label ?? `HTTP ${r.status}`} (${err.code}): ${err.message}`;
}

// One API call. Tries again after a 429 (waiting Retry-After seconds), and after a 5xx or no answer at all
// (waiting 1, 2, 4, 8 seconds). An upload sent with an Idempotency-Key is retried with the same key, so a retry
// never creates a second statement. Any other error throws ApiError with a clear message.
async function call(method, path, { body, headers = {} } = {}, tries = 5) {
    let r;
    for (let attempt = 0; attempt < tries; attempt++) {
        try {
            r = await fetch(BASE + path, { method, body, headers: { Authorization: `Bearer ${KEY}`, ...headers } });
        } catch {
            r = undefined; // no answer: try again
        }
        let wait;
        if (r && r.status < 400) return r;
        if (r?.status === 429) wait = Number(r.headers.get("Retry-After") ?? 2);
        else if (!r || r.status >= 500) wait = 2 ** attempt;
        else throw new ApiError(await explain(r));
        if (attempt < tries - 1) await sleep(wait);
    }
    throw new ApiError(r ? await explain(r) : "No answer from the API. Check your connection.");
}

// ---- A few calls to show it working. Try them with a wrong key, or with no pages left.

async function account() {
    const { balance } = await (await call("GET", "/account")).json();
    return `${balance.pages} pages and ${balance.scans} scans left`;
}

async function upload() {
    const path = process.argv[2] ?? "sample-statement.pdf";
    const form = new FormData(); // built once: a retry sends the same file again
    form.append("file", new Blob([await readFile(path)]), basename(path));
    let r = await call("POST", "/statements", { body: form, headers: { "Idempotency-Key": randomUUID() } });
    let st = await r.json();
    const deadline = Date.now() + 600_000; // never wait for ever
    while (["queued", "processing"].includes(st.status) && Date.now() < deadline) {
        await sleep(Number(r.headers.get("Retry-After") ?? 2));
        r = await call("GET", `/statements/${st.id}`);
        st = await r.json();
    }
    await call("DELETE", `/statements/${st.id}`); // this demo keeps nothing: deleting it frees the pages it held
    return `${st.id} was ${st.status}, then deleted`;
}

async function unknownStatement() {
    await call("GET", "/statements/stmt_does_not_exist");
    return "found";
}

for (const [name, demo] of [["Account", account], ["Upload", upload], ["Unknown statement", unknownStatement]]) {
    try {
        console.log(`${name}: ${await demo()}`);
    } catch (e) {
        if (!(e instanceof ApiError)) throw e;
        console.log(`${name}: ${e.message}`);
    }
}
