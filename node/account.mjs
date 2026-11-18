// Your account: the pages and scans you have left, and the limits that apply to your key.
//
// Run it:  node account.mjs
// Needs:   Node 18 or newer (no packages), and your API key in the BSXL_API_KEY environment variable.
const BASE = process.env.BSXL_API_BASE ?? "https://api.bankstatementxl.com/v1";
const KEY = process.env.BSXL_API_KEY;
if (!KEY) {
    console.error("Set BSXL_API_KEY to your API key first.");
    process.exit(1);
}

const r = await fetch(`${BASE}/account`, { headers: { Authorization: `Bearer ${KEY}` } });
const account = await r.json();
if (!r.ok) {
    console.error(`${r.status} ${account.error.code}: ${account.error.message}`);
    process.exit(1);
}

const { balance, limits } = account;
console.log(`Workspace: ${account.workspace.name} (${account.workspace.id})`);
console.log(`Pages left: ${balance.pages}`);
console.log(`Scans left: ${balance.scans}  (scanned and photographed pages use these too)`);
if (balance.held_pages || balance.held_scans) { // what's left already leaves these out
    console.log(`Held: ${balance.held_pages} pages and ${balance.held_scans} scans, for statements not downloaded yet (their download uses them; deleting one frees them)`);
}
console.log("Limits:");
console.log(`  ${limits.max_upload_mb} MB per upload, ${limits.max_pages} pages per statement, ${limits.max_files} page photos per statement`);
console.log(`  ${limits.requests_per_minute} requests a minute, ${limits.max_active_statements} converting at once`);
console.log(`  results kept at most ${limits.retention_hours} hours`);
console.log(`Formats: ${account.formats.join(", ")}`);
