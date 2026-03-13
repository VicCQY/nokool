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

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const FEC_BASE = "https://api.open.fec.gov/v1";
function fecKey() { return process.env.FEC_API_KEY!; }
async function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }
async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

async function upsertDonor(name: string, type: string, polId: string, amount: number, cycle: string) {
  let newDonor = false, newDonation = false;
  let donor = await prisma.donor.findFirst({ where: { name, country: "US" } });
  if (!donor) {
    const n = name.toLowerCase();
    let industry = "Other";
    if (n.includes("individual") || n.includes("small-dollar") || n.includes("large-dollar")) industry = "Individual Contributions";
    else if (n.includes("bank") || n.includes("capital") || n.includes("financial")) industry = "Finance";
    else if (n.includes("oil") || n.includes("energy")) industry = "Oil & Gas";
    else if (n.includes("health") || n.includes("hospital") || n.includes("medical")) industry = "Healthcare";
    else if (n.includes("law") || n.includes("legal") || n.includes("attorney")) industry = "Legal";
    else if (n.includes("realt") || n.includes("property")) industry = "Real Estate";
    else if (n.includes("tech") || n.includes("google") || n.includes("microsoft")) industry = "Technology";
    else if (n.includes("defense") || n.includes("military")) industry = "Defense";
    donor = await prisma.donor.create({ data: { name, type: type as "INDIVIDUAL" | "CORPORATION" | "PAC", industry, country: "US" } });
    newDonor = true;
  }
  const existing = await prisma.donation.findFirst({ where: { donorId: donor.id, politicianId: polId, electionCycle: cycle } });
  if (existing) {
    await prisma.donation.update({ where: { id: existing.id }, data: { amount } });
  } else {
    await prisma.donation.create({ data: { donorId: donor.id, politicianId: polId, amount, date: new Date(), electionCycle: cycle } });
    newDonation = true;
  }
  return { newDonor, newDonation };
}

async function main() {
  const johnson = await prisma.politician.findFirst({ where: { congressId: "J000299" } });
  if (!johnson) { console.log("Mike Johnson not found"); return; }

  console.log("Setting FEC ID H6LA04138 for Mike Johnson...");
  await prisma.politician.update({
    where: { id: johnson.id },
    data: { fecCandidateId: "H6LA04138" },
  });

  const polId = johnson.id;

  await delay(500);
  const commData = await fetchJson(`${FEC_BASE}/candidate/H6LA04138/committees/?api_key=${fecKey()}&per_page=20`);
  const committees = commData.results || [];
  console.log(`Found ${committees.length} committees`);

  const allCommitteeNames = new Set(committees.map((c: { name: string }) => c.name.toUpperCase()));

  for (const cycle of [2024, 2022]) {
    console.log(`\nSyncing ${cycle} cycle...`);

    let bestId = committees[0]?.committee_id;
    let bestReceipts = 0;
    for (const c of committees) {
      try {
        await delay(300);
        const data = await fetchJson(`${FEC_BASE}/committee/${c.committee_id}/totals/?api_key=${fecKey()}&cycle=${cycle}`);
        const t = data.results?.[0];
        if (t && t.receipts > bestReceipts) { bestReceipts = t.receipts; bestId = c.committee_id; }
      } catch {}
    }
    if (!bestId) { console.log("  No committee found"); continue; }
    console.log(`  Using committee ${bestId}, receipts: $${bestReceipts.toLocaleString()}`);

    const cycleStr = String(cycle);
    const excludedEmployers = new Set(["retired", "self-employed", "self employed", "not employed", "none", "n/a", "null", "information requested", "information requested per best efforts", "entrepreneur", "homemaker", "disabled", "student", "unemployed", "refused", "requested"]);

    let donorsCreated = 0, donationsCreated = 0, totalAmount = 0;

    // Employer contributions
    try {
      await delay(500);
      const data = await fetchJson(`${FEC_BASE}/schedules/schedule_a/by_employer/?api_key=${fecKey()}&committee_id=${bestId}&cycle=${cycle}&sort=-total&per_page=50`);
      for (const emp of (data.results || [])) {
        if (!emp.employer || excludedEmployers.has(emp.employer.toLowerCase().trim()) || emp.total <= 0) continue;
        const r = await upsertDonor(emp.employer, "CORPORATION", polId, emp.total, cycleStr);
        donorsCreated += r.newDonor ? 1 : 0;
        donationsCreated += r.newDonation ? 1 : 0;
        totalAmount += emp.total;
      }
    } catch (err) { console.log(`  Employer error:`, err instanceof Error ? err.message : err); }

    // PAC contributions
    try {
      await delay(500);
      const data = await fetchJson(`${FEC_BASE}/schedules/schedule_a/?api_key=${fecKey()}&committee_id=${bestId}&contributor_type=committee&sort=-contribution_receipt_amount&per_page=50`);
      for (const pac of (data.results || [])) {
        if (!pac.contributor_name || pac.contribution_receipt_amount <= 0) continue;
        const upperName = pac.contributor_name.toUpperCase();
        const isSelf = Array.from(allCommitteeNames).some(cn => upperName.includes(cn as string) || (cn as string).includes(upperName));
        if (isSelf) continue;
        if (upperName.includes("JOHNSON") && (upperName.includes("COMMITTEE") || upperName.includes("JFC") || upperName.includes("VICTORY"))) continue;
        const r = await upsertDonor(pac.contributor_name, "PAC", polId, pac.contribution_receipt_amount, cycleStr);
        donorsCreated += r.newDonor ? 1 : 0;
        donationsCreated += r.newDonation ? 1 : 0;
        totalAmount += pac.contribution_receipt_amount;
      }
    } catch (err) { console.log(`  PAC error:`, err instanceof Error ? err.message : err); }

    // Size breakdown
    try {
      await delay(500);
      const data = await fetchJson(`${FEC_BASE}/schedules/schedule_a/by_size/?api_key=${fecKey()}&committee_id=${bestId}&cycle=${cycle}&per_page=20`);
      let smallTotal = 0, largeTotal = 0;
      for (const s of (data.results || [])) {
        if (s.size <= 200) smallTotal += s.total;
        else largeTotal += s.total;
      }
      if (smallTotal > 0) {
        const r = await upsertDonor("Small-Dollar Individual Donors (Under $200)", "INDIVIDUAL", polId, smallTotal, cycleStr);
        donorsCreated += r.newDonor ? 1 : 0; donationsCreated += r.newDonation ? 1 : 0; totalAmount += smallTotal;
      }
      if (largeTotal > 0) {
        const r = await upsertDonor("Large-Dollar Individual Donors ($200+)", "INDIVIDUAL", polId, largeTotal, cycleStr);
        donorsCreated += r.newDonor ? 1 : 0; donationsCreated += r.newDonation ? 1 : 0; totalAmount += largeTotal;
      }
    } catch (err) { console.log(`  Size error:`, err instanceof Error ? err.message : err); }

    console.log(`  ${cycle}: ${donorsCreated} new donors, ${donationsCreated} new donations, $${totalAmount.toLocaleString()} total`);
  }

  await prisma.$disconnect();
  console.log("\nDone!");
}

main().catch(e => { console.error(e); process.exit(1); });
