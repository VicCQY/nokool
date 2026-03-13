import * as fs from "fs";

const envFile = fs.readFileSync(".env", "utf-8");
for (const line of envFile.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx);
  let val = trimmed.slice(eqIdx + 1);
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
    val = val.slice(1, -1);
  process.env[key] = val;
}

const BASE_URL = "https://api.open.fec.gov/v1";
const API_KEY = process.env.FEC_API_KEY!;

async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FEC API ${res.status}: ${await res.text().catch(() => "")}`);
  return res.json();
}

async function debug2() {
  // Search for Trump's actual principal campaign committee directly
  console.log("=== SEARCH FOR TRUMP COMMITTEES DIRECTLY ===");
  const searchData = await fetchJson(
    `${BASE_URL}/committees/?api_key=${API_KEY}&q=trump+for+president&cycle=2024&per_page=10`
  );
  for (const c of searchData.results || []) {
    console.log(`  ${c.committee_id} | ${c.name} | designation=${c.designation} | type=${c.committee_type} | candidate=${c.candidate_ids}`);
  }

  // Try the known Trump 2024 principal committee
  console.log("\n=== CHECK C00873893 (TRUMP FOR PRESIDENT 2024) ===");
  try {
    const cData = await fetchJson(
      `${BASE_URL}/committee/C00873893/?api_key=${API_KEY}`
    );
    const c = cData.results?.[0];
    console.log("Name:", c?.name);
    console.log("Designation:", c?.designation);
    console.log("Type:", c?.committee_type);
    console.log("Candidate IDs:", c?.candidate_ids);

    const totals = await fetchJson(
      `${BASE_URL}/committee/C00873893/totals/?api_key=${API_KEY}&cycle=2024`
    );
    const t = totals.results?.[0];
    console.log("Receipts:", t?.receipts?.toLocaleString());
    console.log("Individual:", t?.individual_contributions?.toLocaleString());
    console.log("PAC:", t?.other_political_committee_contributions?.toLocaleString());
  } catch (err) {
    console.log("Error:", err);
  }

  // Check C00828541 (NEVER SURRENDER INC) - the one with $495M
  console.log("\n=== CHECK C00828541 (NEVER SURRENDER INC) ===");
  const nsData = await fetchJson(
    `${BASE_URL}/committee/C00828541/?api_key=${API_KEY}`
  );
  const ns = nsData.results?.[0];
  console.log("Name:", ns?.name);
  console.log("Designation:", ns?.designation);
  console.log("Type:", ns?.committee_type);
  console.log("Candidate IDs:", ns?.candidate_ids);

  // Get employer breakdown for the $495M committee
  console.log("\n=== EMPLOYER CONTRIBUTIONS FOR C00828541 ===");
  const empData = await fetchJson(
    `${BASE_URL}/schedules/schedule_a/by_employer/?api_key=${API_KEY}&committee_id=C00828541&cycle=2024&sort=-total&per_page=30`
  );
  let empTotal = 0;
  for (const e of (empData.results || [])) {
    console.log(`  ${e.employer}: $${e.total?.toLocaleString()} (${e.count})`);
    empTotal += e.total || 0;
  }
  console.log(`  TOTAL: $${empTotal.toLocaleString()}`);

  // Get top PAC/committee contributions for C00828541
  console.log("\n=== TOP PAC CONTRIBUTIONS FOR C00828541 ===");
  const pacData = await fetchJson(
    `${BASE_URL}/schedules/schedule_a/?api_key=${API_KEY}&committee_id=C00828541&contributor_type=committee&sort=-contribution_receipt_amount&per_page=20`
  );
  let pacTotal = 0;
  for (const p of (pacData.results || [])) {
    console.log(`  ${p.contributor_name}: $${p.contribution_receipt_amount?.toLocaleString()}`);
    pacTotal += p.contribution_receipt_amount || 0;
  }
  console.log(`  TOTAL: $${pacTotal.toLocaleString()}`);

  // Also check MAGA PAC
  console.log("\n=== EMPLOYER CONTRIBUTIONS FOR C00580100 (MAGA PAC) ===");
  const magaEmpData = await fetchJson(
    `${BASE_URL}/schedules/schedule_a/by_employer/?api_key=${API_KEY}&committee_id=C00580100&cycle=2024&sort=-total&per_page=20`
  );
  let magaTotal = 0;
  for (const e of (magaEmpData.results || [])) {
    console.log(`  ${e.employer}: $${e.total?.toLocaleString()} (${e.count})`);
    magaTotal += e.total || 0;
  }
  console.log(`  TOTAL: $${magaTotal.toLocaleString()}`);

  // by_size for C00828541
  console.log("\n=== CONTRIBUTIONS BY SIZE FOR C00828541 ===");
  const sizeData = await fetchJson(
    `${BASE_URL}/schedules/schedule_a/by_size/?api_key=${API_KEY}&committee_id=C00828541&cycle=2024&per_page=20`
  );
  for (const s of (sizeData.results || [])) {
    console.log(`  Size ${s.size}: $${s.total?.toLocaleString()} (${s.count} contributions)`);
  }
}

debug2().catch(console.error);
