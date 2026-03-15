import * as fs from "fs";

// Load env manually
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

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const BASE_URL = "https://api.open.fec.gov/v1";

// Key rotation
const API_KEYS = (process.env.FEC_API_KEYS || process.env.FEC_API_KEY || "").split(",").map((k: string) => k.trim()).filter(Boolean);
let keyIdx = 0;
function getKey(): string {
  const k = API_KEYS[keyIdx % API_KEYS.length];
  keyIdx = (keyIdx + 1) % API_KEYS.length;
  return k;
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, { cache: "no-store" } as any);
    if (res.status === 429) {
      console.log("    Rate limited, switching key and waiting 2s...");
      keyIdx = (keyIdx + 1) % API_KEYS.length;
      await delay(2000);
      // rebuild URL with new key
      const u = new URL(url);
      u.searchParams.set("api_key", getKey());
      url = u.toString();
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`FEC API ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
  }
  throw new Error("FEC API: max retries exceeded");
}

function buildUrl(path: string, params: Record<string, string> = {}): string {
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("api_key", getKey());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

function fmt(n: number): string {
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function pct(a: number, b: number): string {
  if (b === 0) return "N/A";
  return ((a / b) * 100).toFixed(1) + "%";
}

interface PoliticianReport {
  name: string;
  fecId: string | null;
  fecTotalReceipts: number;
  fecIndividualContrib: number;
  dbTotal: number;
  dbIndividualAggregate: number;
  committees: { id: string; name: string; type: string; receipts: number }[];
  bestCommittee: string;
  issues: string[];
}

async function main() {
  console.log("=== FEC DATA VERIFICATION AUDIT ===\n");

  // ── 1. Sanity checks on existing DB data ──
  console.log("── SANITY CHECKS ──\n");

  // Zero/negative donations
  const badAmounts = await prisma.donation.findMany({
    where: { amount: { lte: 0 } },
    include: { donor: { select: { name: true } }, politician: { select: { name: true } } },
  });
  if (badAmounts.length > 0) {
    console.log(`⚠ Found ${badAmounts.length} donations with amount <= 0:`);
    for (const d of badAmounts) {
      console.log(`  - ${d.donor.name} → ${d.politician.name}: ${d.amount}`);
    }
    const del = await prisma.donation.deleteMany({ where: { amount: { lte: 0 } } });
    console.log(`  Deleted ${del.count} bad donations.\n`);
  } else {
    console.log("✓ No donations with amount <= 0.\n");
  }

  // Duplicate donor names
  const allDonors = await prisma.donor.findMany({ orderBy: { name: "asc" } });
  const nameMap = new Map<string, any[]>();
  for (const d of allDonors) {
    const key = d.name.toLowerCase().trim();
    if (!nameMap.has(key)) nameMap.set(key, []);
    nameMap.get(key)!.push(d);
  }
  const dupeNames = Array.from(nameMap.entries()).filter(([, v]) => v.length > 1);
  if (dupeNames.length > 0) {
    console.log(`⚠ Found ${dupeNames.length} duplicate donor name(s):`);
    for (const [name, donors] of dupeNames) {
      console.log(`  "${name}" — ${donors.length} entries (IDs: ${donors.map((d: any) => d.id).join(", ")})`);
    }
    console.log();
  } else {
    console.log("✓ No duplicate donor names.\n");
  }

  // Suspiciously high individual donations
  const highIndiv = await prisma.donation.findMany({
    where: {
      amount: { gte: 10_000_000 },
      donor: { type: "INDIVIDUAL" },
    },
    include: { donor: { select: { name: true, type: true } }, politician: { select: { name: true } } },
  });
  if (highIndiv.length > 0) {
    console.log(`⚠ Suspiciously high INDIVIDUAL donations (>=$10M):`);
    for (const d of highIndiv) {
      console.log(`  - ${d.donor.name} → ${d.politician.name}: ${fmt(d.amount)} (${d.electionCycle}) — ${d.donor.type}`);
      if (d.donor.name.includes("Small-Dollar") || d.donor.name.includes("Large-Dollar")) {
        console.log(`    ^ This is an aggregate entry, expected to be large.`);
      }
    }
    console.log();
  } else {
    console.log("✓ No suspiciously high individual donations.\n");
  }

  // ── 2. Per-politician FEC verification ──
  console.log("── PER-POLITICIAN FEC VERIFICATION ──\n");

  const politicians = await prisma.politician.findMany({
    where: { country: "US", fecCandidateId: { not: null } },
    include: {
      donations: {
        include: { donor: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const reports: PoliticianReport[] = [];

  for (const pol of politicians) {
    const report: PoliticianReport = {
      name: pol.name,
      fecId: pol.fecCandidateId,
      fecTotalReceipts: 0,
      fecIndividualContrib: 0,
      dbTotal: 0,
      dbIndividualAggregate: 0,
      committees: [],
      bestCommittee: "",
      issues: [],
    };

    console.log(`── ${pol.name} (${pol.fecCandidateId}) ──`);

    // DB totals for 2024
    const donations2024 = pol.donations.filter((d: any) => d.electionCycle === "2024");
    report.dbTotal = donations2024.reduce((sum: number, d: any) => sum + d.amount, 0);

    const aggDonations = donations2024.filter((d: any) =>
      d.donor.name.includes("Small-Dollar") || d.donor.name.includes("Large-Dollar")
    );
    report.dbIndividualAggregate = aggDonations.reduce((sum: number, d: any) => sum + d.amount, 0);

    // FEC: Get candidate totals
    try {
      await delay(400);
      const totalsUrl = buildUrl(`/candidate/${pol.fecCandidateId}/totals/`, {
        cycle: "2024",
        election_full: "true",
      });
      const totalsData = await fetchJson(totalsUrl);
      const t = totalsData.results?.[0];
      if (t) {
        report.fecTotalReceipts = t.receipts || 0;
        report.fecIndividualContrib = t.individual_contributions || t.individual_itemized_contributions || 0;
      } else {
        report.issues.push("No FEC totals found for 2024");
      }
    } catch (err: any) {
      report.issues.push(`FEC totals error: ${err.message}`);
    }

    // FEC: Get all committees
    try {
      await delay(400);
      const commsUrl = buildUrl(`/candidate/${pol.fecCandidateId}/committees/`, {
        per_page: "50",
      });
      const commsData = await fetchJson(commsUrl);
      for (const c of commsData.results || []) {
        let receipts = 0;
        try {
          await delay(300);
          const tUrl = buildUrl(`/committee/${c.committee_id}/totals/`, { cycle: "2024" });
          const tData = await fetchJson(tUrl);
          receipts = tData.results?.[0]?.receipts || 0;
        } catch {
          // skip
        }
        report.committees.push({
          id: c.committee_id,
          name: c.name,
          type: c.committee_type_full || c.designation_full || c.committee_type,
          receipts,
        });
      }
      report.committees.sort((a, b) => b.receipts - a.receipts);
      report.bestCommittee = report.committees[0]?.name || "N/A";
    } catch (err: any) {
      report.issues.push(`Committee error: ${err.message}`);
    }

    // Print report
    console.log(`  FEC Total Receipts:       ${fmt(report.fecTotalReceipts)}`);
    console.log(`  FEC Individual Contrib:   ${fmt(report.fecIndividualContrib)}`);
    console.log(`  Our DB Total (2024):      ${fmt(report.dbTotal)}`);
    console.log(`  Our DB Individual Agg:    ${fmt(report.dbIndividualAggregate)}`);

    if (report.fecIndividualContrib > 0) {
      const diff = report.dbIndividualAggregate - report.fecIndividualContrib;
      console.log(`  Indiv. Agg vs FEC Indiv:  ${fmt(diff)} (${pct(report.dbIndividualAggregate, report.fecIndividualContrib)} of FEC)`);
    }

    console.log(`  Committees (${report.committees.length}):`);
    for (const c of report.committees) {
      const marker = c.receipts > 0 ? "" : " [no 2024 data]";
      console.log(`    - ${c.name} (${c.id}) — ${c.type} — ${fmt(c.receipts)}${marker}`);
    }

    // Donor breakdown
    const donorsByType: Record<string, { count: number; total: number }> = {};
    for (const d of donations2024) {
      const t = d.donor.type;
      if (!donorsByType[t]) donorsByType[t] = { count: 0, total: 0 };
      donorsByType[t].count++;
      donorsByType[t].total += d.amount;
    }
    console.log(`  Donor breakdown (2024):`);
    for (const [type, data] of Object.entries(donorsByType).sort((a, b) => b[1].total - a[1].total)) {
      console.log(`    ${type}: ${data.count} donations, ${fmt(data.total)}`);
    }

    if (report.issues.length > 0) {
      console.log(`  Issues: ${report.issues.join("; ")}`);
    }
    console.log();

    reports.push(report);
  }

  // ── 3. Summary table ──
  console.log("── SUMMARY TABLE ──\n");
  console.log(
    "Politician".padEnd(25) +
    "FEC Receipts".padStart(18) +
    "DB Total".padStart(18) +
    "DB/FEC %".padStart(12) +
    "FEC Indiv".padStart(18) +
    "DB Indiv Agg".padStart(18) +
    "Agg/FEC %".padStart(12) +
    "Committees".padStart(12)
  );
  console.log("-".repeat(133));
  for (const r of reports) {
    console.log(
      r.name.padEnd(25) +
      fmt(r.fecTotalReceipts).padStart(18) +
      fmt(r.dbTotal).padStart(18) +
      pct(r.dbTotal, r.fecTotalReceipts).padStart(12) +
      fmt(r.fecIndividualContrib).padStart(18) +
      fmt(r.dbIndividualAggregate).padStart(18) +
      pct(r.dbIndividualAggregate, r.fecIndividualContrib).padStart(12) +
      String(r.committees.length).padStart(12)
    );
  }
  console.log();
}

main()
  .then(() => prisma.$disconnect())
  .catch((e: any) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
