import * as fs from "fs";

// Load env manually (dotenv v17 issue)
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
  const res = await fetch(url, { cache: "no-store" } as RequestInit);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`FEC API error ${res.status}: ${text.slice(0, 500)}`);
  }
  return res.json();
}

async function debug() {
  const candidateId = "P80001571"; // Trump's known FEC ID

  // 1. Check candidate info
  console.log("=== 1. CANDIDATE INFO ===");
  const candidateData = await fetchJson(
    `${BASE_URL}/candidate/${candidateId}/?api_key=${API_KEY}`
  );
  const cand = candidateData.results?.[0];
  console.log("Name:", cand?.name);
  console.log("Party:", cand?.party_full);
  console.log("Office:", cand?.office_full);
  console.log("Election years:", cand?.election_years);

  // 2. Get ALL committees
  console.log("\n=== 2. ALL COMMITTEES ===");
  const committeesData = await fetchJson(
    `${BASE_URL}/candidate/${candidateId}/committees/?api_key=${API_KEY}&per_page=50`
  );
  const committees = committeesData.results || [];
  console.log(`Found ${committees.length} committees:`);
  for (const c of committees) {
    console.log(`  ${c.committee_id} | ${c.name} | designation=${c.designation} | type=${c.committee_type}`);
  }

  // 3. Check candidate totals (aggregated fundraising)
  console.log("\n=== 3. CANDIDATE TOTALS ===");
  try {
    const totalsData = await fetchJson(
      `${BASE_URL}/candidate/${candidateId}/totals/?api_key=${API_KEY}&cycle=2024`
    );
    const totals = totalsData.results || [];
    for (const t of totals) {
      console.log(`  Cycle: ${t.cycle}`);
      console.log(`  Total receipts: $${t.receipts?.toLocaleString()}`);
      console.log(`  Individual contributions: $${t.individual_contributions?.toLocaleString()}`);
      console.log(`  PAC contributions: $${t.other_political_committee_contributions?.toLocaleString()}`);
      console.log(`  Total disbursements: $${t.disbursements?.toLocaleString()}`);
      console.log(`  Committee: ${t.committee_id} (${t.full_election})`);
    }
  } catch (err) {
    console.log("Error:", err);
  }

  // 4. Primary committee employer breakdown
  const primaryCommittee = committees.find((c: any) => c.designation === "P") || committees[0];
  console.log(`\n=== 4. EMPLOYER CONTRIBUTIONS (primary: ${primaryCommittee.committee_id}) ===`);
  const empData = await fetchJson(
    `${BASE_URL}/schedules/schedule_a/by_employer/?api_key=${API_KEY}&committee_id=${primaryCommittee.committee_id}&cycle=2024&sort=-total&per_page=20`
  );
  const employers = empData.results || [];
  console.log(`Found ${employers.length} employer entries:`);
  let empTotal = 0;
  for (const e of employers) {
    console.log(`  ${e.employer}: $${e.total?.toLocaleString()} (${e.count} contributions)`);
    empTotal += e.total || 0;
  }
  console.log(`  TOTAL from employers: $${empTotal.toLocaleString()}`);

  // 5. Individual contributions (schedule_a) — these are individual RECEIPTS not aggregated
  console.log(`\n=== 5. TOP INDIVIDUAL RECEIPTS (schedule_a, sorted by amount) ===`);
  const indData = await fetchJson(
    `${BASE_URL}/schedules/schedule_a/?api_key=${API_KEY}&committee_id=${primaryCommittee.committee_id}&contributor_type=individual&sort=-contribution_receipt_amount&per_page=10`
  );
  const individuals = indData.results || [];
  let indTotal = 0;
  for (const i of individuals) {
    console.log(`  ${i.contributor_name}: $${i.contribution_receipt_amount} (${i.contributor_employer || "N/A"})`);
    indTotal += i.contribution_receipt_amount || 0;
  }
  console.log(`  TOTAL from top 10 individuals: $${indTotal.toLocaleString()}`);

  // 6. Committee/PAC contributions
  console.log(`\n=== 6. TOP COMMITTEE/PAC RECEIPTS ===`);
  const pacData = await fetchJson(
    `${BASE_URL}/schedules/schedule_a/?api_key=${API_KEY}&committee_id=${primaryCommittee.committee_id}&contributor_type=committee&sort=-contribution_receipt_amount&per_page=10`
  );
  const pacs = pacData.results || [];
  let pacTotal = 0;
  for (const p of pacs) {
    console.log(`  ${p.contributor_name}: $${p.contribution_receipt_amount}`);
    pacTotal += p.contribution_receipt_amount || 0;
  }
  console.log(`  TOTAL from top 10 PACs: $${pacTotal.toLocaleString()}`);

  // 7. Check by_size aggregation (how much came from small vs large donors)
  console.log(`\n=== 7. CONTRIBUTIONS BY SIZE (primary committee) ===`);
  try {
    const sizeData = await fetchJson(
      `${BASE_URL}/schedules/schedule_a/by_size/?api_key=${API_KEY}&committee_id=${primaryCommittee.committee_id}&cycle=2024&per_page=20`
    );
    const sizes = sizeData.results || [];
    for (const s of sizes) {
      console.log(`  Size range ${s.size}: $${s.total?.toLocaleString()} (${s.count} contributions)`);
    }
  } catch (err) {
    console.log("Error:", err);
  }

  // 8. Check ALL committees' totals for a bigger picture
  console.log(`\n=== 8. COMMITTEE FINANCIAL TOTALS (all committees) ===`);
  for (const c of committees.slice(0, 5)) {
    try {
      const ctData = await fetchJson(
        `${BASE_URL}/committee/${c.committee_id}/totals/?api_key=${API_KEY}&cycle=2024`
      );
      const ct = ctData.results?.[0];
      if (ct && ct.receipts > 0) {
        console.log(`  ${c.committee_id} (${c.name}):`);
        console.log(`    Receipts: $${ct.receipts?.toLocaleString()}`);
        console.log(`    Individual: $${ct.individual_contributions?.toLocaleString()}`);
        console.log(`    PAC: $${ct.other_political_committee_contributions?.toLocaleString()}`);
        console.log(`    Transfers: $${ct.transfers_from_affiliated_committee?.toLocaleString()}`);
      }
    } catch {
      // skip
    }
  }
}

debug().catch(console.error);
