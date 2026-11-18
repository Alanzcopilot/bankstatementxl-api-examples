// Convert every PDF in a folder, a few at a time, and save each one in the formats you choose.
//
// Run it:  node batch.mjs <folder> [formats]     formats: xlsx (the default), or several, such as xlsx,csv,qbo-csv
// Files go to <folder>/converted/. Several formats for one statement come as one ZIP.
// Needs:   Node 18 or newer (no packages), and your API key in the BSXL_API_KEY environment variable.
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, parse } from "node:path";

const BASE = process.env.BSXL_API_BASE ?? "https://api.bankstatementxl.com/v1";
const KEY = process.env.BSXL_API_KEY;
const AT_ONCE = 3; // well inside the limits: 20 converting at once per workspace, 120 requests a minute per key
const [folder, formats = "xlsx"] = process.argv.slice(2);
if (!KEY || !folder) {
    console.error("Set BSXL_API_KEY first. Usage: node batch.mjs <folder> [formats]");
    process.exit(1);
}
const out = join(folder, "converted");
await mkdir(out, { recursive: true });
const sleep = (seconds) => new Promise((done) => setTimeout(done, seconds * 1000));

// One request. After a 429 (too many requests) or a 5xx it waits and tries again, with the same headers and body.
async function call(method, path, { body, headers = {} } = {}) {
    let r;
    for (let attempt = 0; attempt < 5; attempt++) {
        r = await fetch(BASE + path, { method, body, headers: { Authorization: `Bearer ${KEY}`, ...headers } });
        if (r.status === 429) await sleep(Number(r.headers.get("Retry-After") ?? 5));
        else if (r.status >= 500) await sleep(2 ** attempt);
        else break;
    }
    if (!r.ok) {
        const { error } = await r.json();
        throw new Error(`${r.status} ${error.code}: ${error.message}`);
    }
    return r;
}

async function convert(file) {
    try {
        // One Idempotency-Key per file: if the upload is retried, the API returns the first statement, not a second.
        const form = new FormData();
        form.append("file", new Blob([await readFile(join(folder, file))]), file);
        let r = await call("POST", "/statements", { body: form, headers: { "Idempotency-Key": randomUUID() } });
        let st = await r.json();
        const deadline = Date.now() + 600_000; // never wait for ever
        while (["queued", "processing"].includes(st.status) && Date.now() < deadline) {
            await sleep(Number(r.headers.get("Retry-After") ?? 2));
            r = await call("GET", `/statements/${st.id}`);
            st = await r.json();
        }
        if (["queued", "processing"].includes(st.status)) return [false, `${file}: still converting after 10 minutes (${st.id}); ask for it again later`];
        if (st.status === "failed") return [false, `${file}: not converted (${st.failure.code}): ${st.failure.message}`];
        // One download with every format: the first download deletes the results (the default).
        r = await call("GET", `/statements/${st.id}/download?format=${encodeURIComponent(formats)}`);
        const served = /filename="([^"]+)"/.exec(r.headers.get("Content-Disposition") ?? "")?.[1] ?? ".zip";
        const target = join(out, parse(file).name + extname(served)); // the format's extension, or .zip for several
        await writeFile(target, Buffer.from(await r.arrayBuffer()));
        return [true, `${file}: ${st.checks.rows} rows, ${st.checks.rows_not_adding_up} not adding up -> ${target}`];
    } catch (e) {
        return [false, `${file}: ${e.message}`];
    }
}

const files = (await readdir(folder)).filter((name) => extname(name).toLowerCase() === ".pdf").sort();
const results = [];
const queue = [...files.entries()];
await Promise.all(
    Array.from({ length: AT_ONCE }, async () => {
        for (let next = queue.shift(); next; next = queue.shift()) results[next[0]] = await convert(next[1]);
    }),
);
for (const [, line] of results) console.log(line);
const done = results.filter(([converted]) => converted).length;
console.log(`Done: ${done} of ${files.length} converted.`);
process.exit(done === files.length ? 0 : 1);
