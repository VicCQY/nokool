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

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FEC_BASE = "https://api.open.fec.gov/v1";
const FETCH_DELAY = 200;
const FEC_DELAY = 500;
const MAX_RETRIES = 3;

function fecKey() { return process.env.FEC_API_KEY!; }

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchWithRetry(url: string): Promise<Response | null> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 200) return res;
      if (res.status === 404) return null;
      if (res.status === 429 || res.status === 503) {
        await delay(Math.pow(2, attempt) * 1000);
        continue;
      }
      return null;
    } catch {
      if (attempt < MAX_RETRIES - 1) {
        await delay(Math.pow(2, attempt) * 1000);
        continue;
      }
      return null;
    }
  }
  return null;
}

const posMap: Record<string, string> = {
  yea: "YEA", aye: "YEA", yes: "YEA", nay: "NAY", no: "NAY",
  "not voting": "ABSENT", present: "ABSTAIN",
};
function mapPos(p: string) { return posMap[(p || "not voting").toLowerCase()] || "ABSENT"; }

// ── Politicians to add ──

interface PoliticianSeed {
  name: string;
  party: string;
  branch: string;
  chamber: string;
  termStart: string;
  termEnd: string | null;
  congressId: string;
  fecSearch: { office: string; state: string };
}

const POLITICIANS: PoliticianSeed[] = [
  {
    name: "Bernie Sanders",
    party: "Independent",
    branch: "legislative",
    chamber: "senate",
    termStart: "2019-01-03",
    termEnd: null,
    congressId: "S000033",
    fecSearch: { office: "S", state: "VT" },
  },
  {
    name: "Nancy Pelosi",
    party: "Democratic",
    branch: "legislative",
    chamber: "house",
    termStart: "2023-01-03",
    termEnd: null,
    congressId: "P000197",
    fecSearch: { office: "H", state: "CA" },
  },
  {
    name: "Ted Cruz",
    party: "Republican",
    branch: "legislative",
    chamber: "senate",
    termStart: "2019-01-03",
    termEnd: null,
    congressId: "C001098",
    fecSearch: { office: "S", state: "TX" },
  },
  {
    name: "Mike Johnson",
    party: "Republican",
    branch: "legislative",
    chamber: "house",
    termStart: "2023-01-03",
    termEnd: null,
    congressId: "J000299",
    fecSearch: { office: "H", state: "LA" },
    // Note: FEC search doesn't find him by "Mike Johnson" — his FEC name is
    // "JOHNSON, JAMES MICHAEL". Use fallback ID H6LA04138 if search fails.
  },
];

// ── Step 1: Add politicians ──

async function addPoliticians(): Promise<Map<string, string>> {
  const idMap = new Map<string, string>(); // name -> db id

  for (const pol of POLITICIANS) {
    console.log(`Adding ${pol.name} to database...`);

    const existing = await prisma.politician.findFirst({
      where: { congressId: pol.congressId },
    });

    if (existing) {
      console.log(`  Already exists (id: ${existing.id}), updating...`);
      await prisma.politician.update({
        where: { id: existing.id },
        data: {
          name: pol.name,
          party: pol.party,
          branch: pol.branch,
          chamber: pol.chamber,
          termStart: new Date(pol.termStart),
          termEnd: pol.termEnd ? new Date(pol.termEnd) : null,
        },
      });
      idMap.set(pol.name, existing.id);
    } else {
      const created = await prisma.politician.create({
        data: {
          name: pol.name,
          country: "US",
          party: pol.party,
          branch: pol.branch,
          chamber: pol.chamber,
          termStart: new Date(pol.termStart),
          termEnd: pol.termEnd ? new Date(pol.termEnd) : null,
          congressId: pol.congressId,
        },
      });
      console.log(`  Created (id: ${created.id})`);
      idMap.set(pol.name, created.id);
    }
  }

  return idMap;
}

// ── Step 2: Match FEC candidate IDs ──

async function matchFecIds(idMap: Map<string, string>): Promise<void> {
  for (const pol of POLITICIANS) {
    const polId = idMap.get(pol.name)!;
    console.log(`\nMatching FEC candidate ID for ${pol.name}...`);

    // Check if already has FEC ID
    const existing = await prisma.politician.findUnique({
      where: { id: polId },
      select: { fecCandidateId: true },
    });

    if (existing?.fecCandidateId) {
      console.log(`  Already has FEC ID: ${existing.fecCandidateId}`);
      continue;
    }

    try {
      await delay(FEC_DELAY);
      const params = new URLSearchParams({
        api_key: fecKey(),
        q: pol.name,
        office: pol.fecSearch.office,
        state: pol.fecSearch.state,
        sort: "name",
        per_page: "5",
      });
      const url = `${FEC_BASE}/candidates/search/?${params}`;
      const data = await fetchJson(url);
      const candidates = data.results || [];

      if (candidates.length === 0) {
        // Fallback for known edge cases where FEC name doesn't match common name
        const KNOWN_FEC_IDS: Record<string, string> = {
          "Mike Johnson": "H6LA04138",
        };
        if (KNOWN_FEC_IDS[pol.name]) {
          await prisma.politician.update({
            where: { id: polId },
            data: { fecCandidateId: KNOWN_FEC_IDS[pol.name] },
          });
          console.log(`  Used fallback FEC ID: ${KNOWN_FEC_IDS[pol.name]}`);
          continue;
        }
        console.log(`  ERROR: No FEC candidates found for ${pol.name}`);
        continue;
      }

      // Find best match by last name
      const polLast = pol.name.split(" ").pop()?.toLowerCase() || "";
      const best = candidates.find((c: { name: string }) => c.name.toLowerCase().includes(polLast)) || candidates[0];

      await prisma.politician.update({
        where: { id: polId },
        data: { fecCandidateId: best.candidate_id },
      });

      console.log(`  Matched: ${best.name} -> ${best.candidate_id}`);
    } catch (err) {
      console.log(`  ERROR matching FEC for ${pol.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

// ── Step 3: Backfill voting records ──

async function backfillVotes(polName: string, polId: string, congressId: string, chamber: string): Promise<number> {
  console.log(`\nBackfilling votes for ${polName}...`);

  const parts = polName.split(" ");
  const lastName = parts[parts.length - 1];
  const firstName = parts[0];

  // Get existing votes to skip
  const existingVotes = await prisma.vote.findMany({
    where: { politicianId: polId },
    select: { billId: true },
  });
  const existingBillIds = new Set(existingVotes.map(v => v.billId));

  // Get all US bills
  const allBills = await prisma.bill.findMany({
    where: { country: "US" },
    select: { id: true, billNumber: true },
  });

  // Filter to the right chamber
  const chamberPrefix = chamber === "house" ? "H.Vote." : "S.Vote.";
  const relevantBills = allBills.filter(b => b.billNumber.startsWith(chamberPrefix) && !existingBillIds.has(b.id));

  console.log(`  Checking ${relevantBills.length} ${chamber} bills (${allBills.length} total, ${existingBillIds.size} already voted)...`);

  let newVotes = 0;
  let checked = 0;
  let errors = 0;

  for (const bill of relevantBills) {
    checked++;
    if (checked % 100 === 0) {
      process.stdout.write(`  Progress: ${checked}/${relevantBills.length} checked, ${newVotes} votes found\r`);
    }

    let xml: string | null = null;

    try {
      if (bill.billNumber.startsWith("H.Vote.")) {
        const p = bill.billNumber.split(".");
        const url = `https://clerk.house.gov/evs/${p[2]}/roll${String(Number(p[3])).padStart(3, "0")}.xml`;
        await delay(FETCH_DELAY);
        const res = await fetchWithRetry(url);
        if (res) xml = await res.text();
      } else if (bill.billNumber.startsWith("S.Vote.")) {
        const p = bill.billNumber.split(".");
        const roll = String(Number(p[3])).padStart(5, "0");
        for (const cong of [118, 119]) {
          const url = `https://www.senate.gov/legislative/LIS/roll_call_votes/vote${cong}${p[2]}/vote_${cong}_${p[2]}_${roll}.xml`;
          await delay(FETCH_DELAY);
          const res = await fetchWithRetry(url);
          if (res) { xml = await res.text(); break; }
        }
      }
    } catch {
      errors++;
      continue;
    }

    if (!xml) continue;

    let voted = false;
    let votePosition = "ABSENT";

    if (bill.billNumber.startsWith("H.Vote.")) {
      const regex = new RegExp(`name-id="${congressId}"[^>]*>[\\s\\S]*?</legislator>\\s*<vote>([^<]+)</vote>`);
      const match = xml.match(regex);
      if (match) { voted = true; votePosition = mapPos(match[1].trim()); }
    } else {
      const regex = new RegExp(`<last_name>${lastName}</last_name>\\s*<first_name>([^<]+)</first_name>[\\s\\S]*?<vote_cast>([^<]+)</vote_cast>`);
      const match = xml.match(regex);
      if (match) {
        const xmlFirst = match[1].toLowerCase();
        const polFirst = firstName.toLowerCase();
        if (xmlFirst.startsWith(polFirst.slice(0, 2)) || polFirst.startsWith(xmlFirst.slice(0, 2))) {
          voted = true; votePosition = mapPos(match[2].trim());
        }
      }
    }

    if (voted) {
      try {
        await prisma.vote.upsert({
          where: { politicianId_billId: { politicianId: polId, billId: bill.id } },
          update: { position: votePosition as "YEA" | "NAY" | "ABSTAIN" | "ABSENT" },
          create: { politicianId: polId, billId: bill.id, position: votePosition as "YEA" | "NAY" | "ABSTAIN" | "ABSENT" },
        });
        newVotes++;
      } catch {}
    }
  }

  console.log(`  Backfilling votes: checked ${checked} bills... found ${newVotes} votes${errors > 0 ? ` (${errors} fetch errors skipped)` : ""}`);
  return newVotes;
}

// ── Step 4: Sync donations ──

interface DonationResult {
  donorsCreated: number;
  donationsCreated: number;
  totalAmount: number;
}

async function syncDonations(polName: string, polId: string, cycles: number[]): Promise<DonationResult> {
  const totals: DonationResult = { donorsCreated: 0, donationsCreated: 0, totalAmount: 0 };

  const politician = await prisma.politician.findUnique({
    where: { id: polId },
    select: { fecCandidateId: true },
  });

  if (!politician?.fecCandidateId) {
    console.log(`  Skipping donations for ${polName} — no FEC candidate ID`);
    return totals;
  }

  // Get committees
  let committees: { committee_id: string; name: string }[];
  try {
    await delay(FEC_DELAY);
    const data = await fetchJson(`${FEC_BASE}/candidate/${politician.fecCandidateId}/committees/?api_key=${fecKey()}&per_page=20`);
    committees = data.results || [];
  } catch (err) {
    console.log(`  ERROR getting committees for ${polName}: ${err instanceof Error ? err.message : String(err)}`);
    return totals;
  }

  if (committees.length === 0) {
    console.log(`  No committees found for ${polName}`);
    return totals;
  }

  const allCommitteeNames = new Set(committees.map(c => c.name.toUpperCase()));

  for (const cycle of cycles) {
    console.log(`  Syncing donations for ${cycle} cycle...`);

    // Find best committee for this cycle
    let bestId = committees[0].committee_id;
    let bestReceipts = 0;

    for (const c of committees) {
      try {
        await delay(300);
        const data = await fetchJson(`${FEC_BASE}/committee/${c.committee_id}/totals/?api_key=${fecKey()}&cycle=${cycle}`);
        const t = data.results?.[0];
        if (t && t.receipts > bestReceipts) {
          bestReceipts = t.receipts;
          bestId = c.committee_id;
        }
      } catch {}
    }

    const cycleStr = String(cycle);

    // Employer contributions
    try {
      await delay(FEC_DELAY);
      const data = await fetchJson(`${FEC_BASE}/schedules/schedule_a/by_employer/?api_key=${fecKey()}&committee_id=${bestId}&cycle=${cycle}&sort=-total&per_page=50`);
      const employers = data.results || [];

      const excludedEmployers = new Set(["retired", "self-employed", "self employed", "not employed", "none", "n/a", "null", "information requested", "information requested per best efforts", "entrepreneur", "homemaker", "disabled", "student", "unemployed", "refused", "requested"]);

      for (const emp of employers) {
        if (!emp.employer || excludedEmployers.has(emp.employer.toLowerCase().trim()) || emp.total <= 0) continue;

        await upsertDonorAndDonation(emp.employer, "CORPORATION", polId, emp.total, cycleStr, totals);
      }
    } catch (err) {
      console.log(`    ERROR (employer, ${cycle}): ${err instanceof Error ? err.message : String(err)}`);
    }

    // PAC contributions
    try {
      await delay(FEC_DELAY);
      const data = await fetchJson(`${FEC_BASE}/schedules/schedule_a/?api_key=${fecKey()}&committee_id=${bestId}&contributor_type=committee&sort=-contribution_receipt_amount&per_page=50`);
      const pacs = data.results || [];

      const polLastName = polName.split(" ").pop()?.toUpperCase() || "";

      for (const pac of pacs) {
        if (!pac.contributor_name || pac.contribution_receipt_amount <= 0) continue;

        const upperName = pac.contributor_name.toUpperCase();
        // Skip self-transfers
        const isSelfTransfer = Array.from(allCommitteeNames).some(cn => upperName.includes(cn) || cn.includes(upperName));
        if (isSelfTransfer) continue;

        if (upperName.includes(polLastName) && (upperName.includes("COMMITTEE") || upperName.includes("JFC") || upperName.includes("JOINT FUNDRAISING") || upperName.includes("VICTORY FUND"))) {
          continue;
        }

        await upsertDonorAndDonation(pac.contributor_name, "PAC", polId, pac.contribution_receipt_amount, cycleStr, totals);
      }
    } catch (err) {
      console.log(`    ERROR (PAC, ${cycle}): ${err instanceof Error ? err.message : String(err)}`);
    }

    // Small/large dollar aggregates
    try {
      await delay(FEC_DELAY);
      const data = await fetchJson(`${FEC_BASE}/schedules/schedule_a/by_size/?api_key=${fecKey()}&committee_id=${bestId}&cycle=${cycle}&per_page=20`);
      const sizeBreakdown = data.results || [];

      let smallTotal = 0;
      let largeTotal = 0;
      for (const s of sizeBreakdown) {
        if (s.size <= 200) smallTotal += s.total;
        else largeTotal += s.total;
      }

      if (smallTotal > 0) {
        await upsertDonorAndDonation("Small-Dollar Individual Donors (Under $200)", "INDIVIDUAL", polId, smallTotal, cycleStr, totals);
      }
      if (largeTotal > 0) {
        await upsertDonorAndDonation("Large-Dollar Individual Donors ($200+)", "INDIVIDUAL", polId, largeTotal, cycleStr, totals);
      }
    } catch (err) {
      console.log(`    ERROR (size breakdown, ${cycle}): ${err instanceof Error ? err.message : String(err)}`);
    }

    console.log(`    ${cycle}: ${totals.donorsCreated} donors, $${totals.totalAmount.toLocaleString()} total so far`);
  }

  return totals;
}

async function upsertDonorAndDonation(
  donorName: string,
  donorType: "INDIVIDUAL" | "CORPORATION" | "PAC" | "SUPER_PAC" | "UNION" | "NONPROFIT",
  politicianId: string,
  amount: number,
  cycle: string,
  result: DonationResult,
) {
  if (!donorName || amount <= 0) return;

  // Simple industry classification
  const name = donorName.toLowerCase();
  let industry = "Other";
  if (name.includes("bank") || name.includes("capital") || name.includes("financial") || name.includes("investment")) industry = "Finance";
  else if (name.includes("tech") || name.includes("google") || name.includes("microsoft") || name.includes("apple") || name.includes("meta")) industry = "Technology";
  else if (name.includes("oil") || name.includes("energy") || name.includes("petroleum")) industry = "Oil & Gas";
  else if (name.includes("pharma") || name.includes("drug")) industry = "Pharmaceutical";
  else if (name.includes("defense") || name.includes("military") || name.includes("lockheed") || name.includes("raytheon")) industry = "Defense";
  else if (name.includes("realt") || name.includes("property") || name.includes("housing")) industry = "Real Estate";
  else if (name.includes("health") || name.includes("hospital") || name.includes("medical")) industry = "Healthcare";
  else if (name.includes("universit") || name.includes("school") || name.includes("education")) industry = "Education";
  else if (name.includes("law") || name.includes("legal") || name.includes("attorney")) industry = "Legal";
  else if (name.includes("union") || name.includes("labor") || name.includes("workers") || name.includes("afscme") || name.includes("seiu") || name.includes("afl")) industry = "Labor";
  else if (name.includes("individual") || name.includes("small-dollar") || name.includes("large-dollar")) industry = "Individual Contributions";

  let donor = await prisma.donor.findFirst({
    where: { name: donorName, country: "US" },
  });

  if (!donor) {
    donor = await prisma.donor.create({
      data: { name: donorName, type: donorType, industry, country: "US" },
    });
    result.donorsCreated++;
  }

  const existing = await prisma.donation.findFirst({
    where: { donorId: donor.id, politicianId, electionCycle: cycle },
  });

  if (existing) {
    await prisma.donation.update({ where: { id: existing.id }, data: { amount } });
  } else {
    await prisma.donation.create({
      data: { donorId: donor.id, politicianId, amount, date: new Date(), electionCycle: cycle },
    });
    result.donationsCreated++;
  }

  result.totalAmount += amount;
}

// ── Main ──

interface PoliticianResult {
  name: string;
  votes: number;
  donors: number;
  donations: number;
  totalAmount: number;
}

async function main() {
  console.log("=== Adding New Politicians to NoKool ===\n");

  // Step 1: Add politicians
  console.log("── Step 1: Adding politicians ──");
  const idMap = await addPoliticians();

  // Step 2: Match FEC IDs
  console.log("\n── Step 2: Matching FEC candidate IDs ──");
  await matchFecIds(idMap);

  // Step 3 & 4: Backfill votes and sync donations per politician
  const results: PoliticianResult[] = [];

  for (const pol of POLITICIANS) {
    const polId = idMap.get(pol.name)!;

    console.log(`\n${"═".repeat(50)}`);
    console.log(`Processing: ${pol.name}`);
    console.log(`${"═".repeat(50)}`);

    // Step 3: Backfill votes
    let votes = 0;
    try {
      votes = await backfillVotes(pol.name, polId, pol.congressId, pol.chamber);
    } catch (err) {
      console.log(`  ERROR backfilling votes for ${pol.name}: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Step 4: Sync donations
    // Sanders and Cruz are senators who ran in 2018 and 2024; Pelosi and Johnson run every 2 years
    const cycles = (pol.chamber === "senate") ? [2024, 2022] : [2024, 2022];

    let donationResult: DonationResult = { donorsCreated: 0, donationsCreated: 0, totalAmount: 0 };
    try {
      donationResult = await syncDonations(pol.name, polId, cycles);
    } catch (err) {
      console.log(`  ERROR syncing donations for ${pol.name}: ${err instanceof Error ? err.message : String(err)}`);
    }

    results.push({
      name: pol.name,
      votes,
      donors: donationResult.donorsCreated,
      donations: donationResult.donationsCreated,
      totalAmount: donationResult.totalAmount,
    });
  }

  // Final summary
  console.log(`\n\n${"═".repeat(70)}`);
  console.log("FINAL SUMMARY");
  console.log(`${"═".repeat(70)}`);
  console.log(`${"Name".padEnd(20)} ${"Votes".padStart(8)} ${"Donors".padStart(8)} ${"Donations".padStart(10)} ${"Total Amount".padStart(18)}`);
  console.log(`${"-".repeat(20)} ${"-".repeat(8)} ${"-".repeat(8)} ${"-".repeat(10)} ${"-".repeat(18)}`);

  for (const r of results) {
    console.log(
      `${r.name.padEnd(20)} ${String(r.votes).padStart(8)} ${String(r.donors).padStart(8)} ${String(r.donations).padStart(10)} ${("$" + r.totalAmount.toLocaleString()).padStart(18)}`
    );
  }

  const totalVotes = results.reduce((s, r) => s + r.votes, 0);
  const totalDonors = results.reduce((s, r) => s + r.donors, 0);
  const totalDonations = results.reduce((s, r) => s + r.donations, 0);
  const totalAmount = results.reduce((s, r) => s + r.totalAmount, 0);

  console.log(`${"-".repeat(20)} ${"-".repeat(8)} ${"-".repeat(8)} ${"-".repeat(10)} ${"-".repeat(18)}`);
  console.log(
    `${"TOTAL".padEnd(20)} ${String(totalVotes).padStart(8)} ${String(totalDonors).padStart(8)} ${String(totalDonations).padStart(10)} ${("$" + totalAmount.toLocaleString()).padStart(18)}`
  );

  console.log("\nDone!");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
