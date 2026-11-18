// QuickBooks Desktop and Quicken files (QBO, QFX): choose the statement's bank, confirm it once, then download.
//
// Run it:  node quickbooks-desktop.mjs <statement.pdf or stmt_...> [intu_bid]
//   A QBO file carries the Intuit bank ID of the bank named on the statement, and only that one. Ask without an ID
//   and the API lists the banks the statement's bank may be: your user chooses theirs. If you already know the ID,
//   pass it as intu_bid. The first time for a bank, your user confirms a short notice, and it is recorded.
//   A bank that isn't on Intuit's list can't get a QBO file: use OFX or IIF instead (format=ofx or format=iif).
//   For Quicken, ask for format=qfx in the same way.
// Needs:   Node 18 or newer (no packages), and your API key in the BSXL_API_KEY environment variable.
import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { createInterface } from "node:readline";

const BASE = process.env.BSXL_API_BASE ?? "https://api.bankstatementxl.com/v1";
const KEY = process.env.BSXL_API_KEY;
const headers = { Authorization: `Bearer ${KEY}` };
const sleep = (seconds) => new Promise((done) => setTimeout(done, seconds * 1000));

class Stop extends Error {} // ends the script with a message
async function fail(r) {
    const { error } = await r.json();
    throw new Stop(`${r.status} ${error.code}: ${error.message}`);
}

let reader, lines; // the answers typed (or piped in), one line each
async function ask(question) {
    process.stdout.write(question);
    reader ??= createInterface({ input: process.stdin });
    lines ??= reader[Symbol.asyncIterator]();
    const { value } = await lines.next();
    return (value ?? "").trim();
}

// The id of a statement you already converted, or a file to upload and convert now.
async function convertedStatement(arg) {
    if (arg.startsWith("stmt_")) return arg;
    const form = new FormData();
    form.append("file", new Blob([await readFile(arg)]), basename(arg));
    let r = await fetch(`${BASE}/statements`, { method: "POST", headers, body: form });
    if (!r.ok) await fail(r);
    let st = await r.json();
    while (["queued", "processing"].includes(st.status)) {
        await sleep(Number(r.headers.get("Retry-After") ?? 2));
        r = await fetch(`${BASE}/statements/${st.id}`, { headers });
        if (!r.ok) await fail(r);
        st = await r.json();
    }
    if (st.status !== "ready") throw new Stop(`Not converted: ${st.failure.message}`);
    return st.id;
}

async function main(arg, bankId) {
    const sid = await convertedStatement(arg);
    for (let round = 0; round < 6; round++) {
        const query = new URLSearchParams({ format: "qbo", ...(bankId ? { intu_bid: bankId } : {}) });
        const r = await fetch(`${BASE}/statements/${sid}/download?${query}`, { headers });
        if (r.ok) {
            await writeFile(`${sid}.qbo`, Buffer.from(await r.arrayBuffer()));
            console.log(`Saved ${sid}.qbo for bank ${bankId}. Back up your QuickBooks company file before you import it.`);
            return;
        }
        const { error } = await r.clone().json();

        if (error.code === "intu_bid_required" || error.code === "bank_not_matched") {
            const banks = error.banks; // the banks the statement's bank may be, best first: id, name, site and country
            if (!banks.length) {
                throw new Stop("This statement's bank isn't on Intuit's list, so it can't get a QBO file. Download OFX or IIF instead (format=ofx or format=iif).");
            }
            if (error.code === "bank_not_matched") console.log(`\nBank ${bankId} isn't the bank on this statement.`);
            console.log("\nWhich of these is the statement's bank?");
            banks.forEach((b, i) => console.log(`  ${i + 1}. ${b.name} (${b.site}, ${b.country}), bank ID ${b.id}`));
            const choice = Number(await ask(`Your bank [1-${banks.length}]: `));
            if (!Number.isInteger(choice) || choice < 1 || choice > banks.length) throw new Stop("No bank chosen, so no QBO file.");
            bankId = banks[choice - 1].id;
        } else if (error.code === "bank_id_confirmation_required") {
            // Once per bank: show your user the notice, and record their confirmation only if they give it.
            const { bank } = error;
            console.log(`\nBefore the first QBO or QFX file for ${bank.name} (bank ID ${bank.id}), please read this:`);
            console.log(`\n${error.notice}\n\n"${error.confirmation}"`);
            if ((await ask("Do you confirm? [y/N] ")).toLowerCase() !== "y") throw new Stop("Not confirmed, so no QBO file. Nothing was recorded.");
            const c = await fetch(`${BASE}/bank-id-confirmations`, {
                method: "POST",
                headers: { ...headers, "Content-Type": "application/json" },
                body: JSON.stringify({ intu_bid: bank.id, confirm: true }),
            });
            if (!c.ok) await fail(c);
            console.log(`Your confirmation for bank ${bank.id} is recorded.`);
        } else {
            await fail(r);
        }
    }
    throw new Stop("No QBO file. Try again.");
}

const [arg, bankId] = process.argv.slice(2);
try {
    if (!KEY || !arg) throw new Stop("Set BSXL_API_KEY first. Usage: node quickbooks-desktop.mjs <statement.pdf or stmt_...> [intu_bid]");
    await main(arg, bankId);
} catch (e) {
    if (!(e instanceof Stop)) throw e;
    console.error(e.message);
    process.exitCode = 1;
} finally {
    reader?.close(); // stop reading answers, so the script can end
}
