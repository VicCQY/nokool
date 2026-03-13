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
  if (res.status !== 200) return null;
  return res.json();
}

async function main() {
  console.log("=".repeat(70));
  console.log("MONEY TRAIL VERIFICATION REPORT");
  console.log("=".repeat(70));

  const politicians = await prisma.politician.findMany({
    where: { country: "US" },
    select: {
      id: true,
      name: true,
      fecCandidateId: true,
      branch: true,
      chamber: true,
    },
  });

  for (const pol of politicians) {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`${pol.name}`);
    console.log(`  FEC Candidate ID: ${pol.fecCandidateId || "NONE"}`);
    console.log(`  Branch: ${pol.branch || "N/A"}, Chamber: ${pol.chamber || "N/A"}`);

    // Get committees from FEC
    if (pol.fecCandidateId) {
      await delay(500);
      const committeeData = await fetchJson(
        `${FEC_BASE}/candidate/${pol.fecCandidateId}/committees/?api_key=${fecKey()}&per_page=20`
      );
      const committees = committeeData?.results || [];
      console.log(`  Committees (${committees.length}):`);
      for (const c of committees) {
        console.log(`    ${c.committee_id} | ${c.name} | type=${c.committee_type} desg=${c.designation}`);
      }
    }

    // Database donations by cycle
    const donations = await prisma.donation.findMany({
      where: { politicianId: pol.id },
      select: { amount: true, electionCycle: true },
    });

    const byCycle: Record<string, { total: number; count: number }> = {};
    for (const d of donations) {
      if (!byCycle[d.electionCycle]) byCycle[d.electionCycle] = { total: 0, count: 0 };
      byCycle[d.electionCycle].total += d.amount;
      byCycle[d.electionCycle].count++;
    }

    console.log(`  Database donations by cycle:`);
    for (const [cycle, data] of Object.entries(byCycle).sort()) {
      console.log(`    ${cycle}: ${data.count} donors, $${data.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
    }

    // Compare with FEC API totals (via committee totals endpoint)
    if (pol.fecCandidateId) {
      console.log(`  FEC API totals comparison:`);
      await delay(500);
      const committeeData = await fetchJson(
        `${FEC_BASE}/candidate/${pol.fecCandidateId}/committees/?api_key=${fecKey()}&per_page=20`
      );
      const committees = committeeData?.results || [];

      for (const cycle of [2020, 2022, 2024]) {
        // Sum totals across all committees for this cycle
        let fecReceipts = 0;
        let fecIndividual = 0;
        let fecPac = 0;

        for (const c of committees) {
          await delay(300);
          const totalsData = await fetchJson(
            `${FEC_BASE}/committee/${c.committee_id}/totals/?api_key=${fecKey()}&cycle=${cycle}`
          );
          const t = totalsData?.results?.[0];
          if (!t) continue;
          fecReceipts += t.receipts || 0;
          fecIndividual += t.individual_contributions || 0;
          fecPac += t.other_political_committee_contributions || 0;
        }

        if (fecReceipts === 0 && !byCycle[String(cycle)]) continue;

        const dbTotal = byCycle[String(cycle)]?.total || 0;
        const fecComparable = fecIndividual + fecPac;
        const pctDiff = fecComparable > 0 ? Math.abs((dbTotal - fecComparable) / fecComparable * 100) : 0;
        const flag = pctDiff > 10 ? " ⚠️ >10% DISCREPANCY" : "";

        console.log(`    ${cycle}: FEC receipts=$${fecReceipts.toLocaleString(undefined, { maximumFractionDigits: 0 })}, individual=$${fecIndividual.toLocaleString(undefined, { maximumFractionDigits: 0 })}, PAC=$${fecPac.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
        console.log(`           DB=$${dbTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}, FEC comparable=$${fecComparable.toLocaleString(undefined, { maximumFractionDigits: 0 })}, diff=${pctDiff.toFixed(1)}%${flag}`);
      }
    }

    // Check for Vance dual-role issue
    if (pol.name === "JD Vance") {
      console.log(`\n  VANCE DUAL-ROLE CHECK:`);
      console.log(`    Current FEC ID: ${pol.fecCandidateId}`);
      if (pol.fecCandidateId === "S2OH00436") {
        console.log(`    ✓ Using Senate campaign ID (correct for Vance's profile)`);
      } else if (pol.fecCandidateId?.startsWith("P")) {
        console.log(`    ✗ Using presidential ID — should use Senate ID S2OH00436`);
      }

      // Check if any donations look like they came from Trump-Vance presidential committees
      const donorNames = await prisma.donation.findMany({
        where: { politicianId: pol.id },
        select: { donor: { select: { name: true } }, amount: true, electionCycle: true },
      });
      const suspicious = donorNames.filter(d =>
        d.donor.name.toUpperCase().includes("TRUMP") ||
        d.donor.name.toUpperCase().includes("PRESIDENTIAL") ||
        d.donor.name.toUpperCase().includes("TRUMP VANCE")
      );
      if (suspicious.length > 0) {
        console.log(`    ✗ Found ${suspicious.length} donations referencing Trump/presidential:`);
        for (const s of suspicious) {
          console.log(`      ${s.donor.name}: $${s.amount.toLocaleString()} (${s.electionCycle})`);
        }
      } else {
        console.log(`    ✓ No presidential ticket donations mixed in`);
      }
    }
  }

  // Overall database summary
  const totalDonors = await prisma.donor.count();
  const totalDonations = await prisma.donation.count();
  const totalAmount = await prisma.donation.aggregate({ _sum: { amount: true } });

  console.log(`\n${"=".repeat(70)}`);
  console.log("DATABASE SUMMARY");
  console.log(`  Politicians: ${politicians.length}`);
  console.log(`  Donors: ${totalDonors}`);
  console.log(`  Donations: ${totalDonations}`);
  console.log(`  Total amount: $${(totalAmount._sum.amount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
  console.log("=".repeat(70));

  await prisma.$disconnect();
}

main().catch(console.error);
