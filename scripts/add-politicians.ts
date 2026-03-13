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

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CONGRESS_BASE = "https://api.congress.gov/v3";
const FEC_BASE = "https://api.open.fec.gov/v1";

function congressKey() { return process.env.CONGRESS_API_KEY!; }
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

// ── Congress.gov helpers ──

async function searchCongressMember(name: string): Promise<{ bioguideId: string; name: string; state: string } | null> {
  await delay(500);
  const url = `${CONGRESS_BASE}/member?api_key=${congressKey()}&format=json&limit=10&currentMember=true`;
  // The Congress.gov API doesn't have a name search param on /member, so we fetch all and filter
  // Actually let's try fetching by name through the offset/limit approach
  // Better: use the full members list we already have cached approach
  // For simplicity, just search directly
  const searchUrl = `${CONGRESS_BASE}/member?api_key=${congressKey()}&format=json&limit=250&currentMember=true`;
  const data = await fetchJson(searchUrl);
  const members = data.members || [];

  const nameLower = name.toLowerCase();
  const nameParts = nameLower.split(" ");
  const lastName = nameParts[nameParts.length - 1];
  const firstName = nameParts[0];

  for (const m of members) {
    const mLast = (m.lastName || m.name?.split(",")[0] || "").toLowerCase().trim();
    const mFirst = (m.firstName || m.name?.split(",")[1] || "").toLowerCase().trim();
    if (mLast === lastName && (mFirst.startsWith(firstName) || firstName.startsWith(mFirst))) {
      return { bioguideId: m.bioguideId, name: `${m.firstName} ${m.lastName}`, state: m.state };
    }
  }
  return null;
}

async function searchFecCandidate(name: string, office?: string): Promise<{ candidate_id: string; name: string } | null> {
  await delay(500);
  const params = new URLSearchParams({
    api_key: fecKey(),
    q: name,
    per_page: "5",
    sort: "name",
  });
  if (office) params.set("office", office);
  const data = await fetchJson(`${FEC_BASE}/candidates/search/?${params}`);
  const results = data.results || [];
  if (results.length === 0) return null;

  const nameLower = name.toLowerCase();
  const lastName = nameLower.split(" ").pop() || "";
  const best = results.find((c: any) => c.name.toLowerCase().includes(lastName)) || results[0];
  return { candidate_id: best.candidate_id, name: best.name };
}

// ── Sync helpers (simplified from the app's sync modules) ──

async function syncVotesForPoliticians(congress: number, limit: number) {
  console.log(`\n=== SYNCING VOTING RECORDS (${congress}th Congress, ${limit} bills) ===`);

  const politicians = await prisma.politician.findMany({
    where: { country: "US", congressId: { not: null } },
    select: { id: true, name: true, congressId: true },
  });
  const congressIdToPolId = new Map(politicians.map((p) => [p.congressId!, p.id]));
  console.log(`Politicians with congressId: ${congressIdToPolId.size}`);

  // Fetch bills
  await delay(500);
  const billsUrl = `${CONGRESS_BASE}/bill/${congress}?api_key=${congressKey()}&format=json&limit=${limit}&sort=updateDate+desc`;
  const billsData = await fetchJson(billsUrl);
  const bills = billsData.bills || [];
  console.log(`Fetched ${bills.length} bills`);

  let billsSynced = 0;
  let votesSynced = 0;
  let billsSkipped = 0;

  const typeMap: Record<string, string> = {
    HR: "H.R.", S: "S.", HJRES: "H.J.Res.", SJRES: "S.J.Res.",
    HCONRES: "H.Con.Res.", SCONRES: "S.Con.Res.", HRES: "H.Res.", SRES: "S.Res.",
  };

  for (const bill of bills) {
    try {
      const billType = bill.type.toLowerCase();
      const billNumber = bill.number;

      // Get actions
      await delay(500);
      const actionsUrl = `${CONGRESS_BASE}/bill/${congress}/${billType}/${billNumber}/actions?api_key=${congressKey()}&format=json&limit=50`;
      const actionsData = await fetchJson(actionsUrl);
      const actions = (actionsData.actions || []).filter(
        (a: any) => a.recordedVotes && a.recordedVotes.length > 0
      );

      if (actions.length === 0) { billsSkipped++; continue; }

      // Deduplicate roll call URLs
      const seenRolls = new Set<string>();
      const uniqueActions: any[] = [];
      for (const a of actions) {
        for (const rv of a.recordedVotes || []) {
          const key = `${rv.chamber}-${rv.rollNumber}-${rv.sessionNumber}`;
          if (!seenRolls.has(key)) {
            seenRolls.add(key);
            uniqueActions.push({ ...a, recordedVotes: [rv] });
          }
        }
      }

      // Get bill detail for policy area
      let policyArea: string | undefined;
      try {
        await delay(500);
        const detailUrl = `${CONGRESS_BASE}/bill/${congress}/${billType}/${billNumber}?api_key=${congressKey()}&format=json`;
        const detail = await fetchJson(detailUrl);
        policyArea = detail?.bill?.policyArea?.name;
      } catch {}

      const formattedBillNumber = (typeMap[bill.type.toUpperCase()] || bill.type) + billNumber;

      // Simple category mapping
      const categoryMap: Record<string, string> = {
        "Armed Forces and National Security": "Defense",
        "International Affairs": "Foreign Policy",
        "Economics and Public Finance": "Economy",
        "Health": "Healthcare",
        "Education": "Education",
        "Environmental Protection": "Environment",
        "Immigration": "Immigration",
        "Transportation and Public Works": "Infrastructure",
        "Crime and Law Enforcement": "Justice",
        "Taxation": "Economy",
        "Science, Technology, Communications": "Technology",
        "Housing and Community Development": "Housing",
      };
      const category = (policyArea && categoryMap[policyArea]) || "Other";

      const firstRv = uniqueActions[0]?.recordedVotes?.[0];
      const voteDate = firstRv?.date ? new Date(firstRv.date) : new Date();

      // Upsert bill
      const dbBill = await prisma.bill.upsert({
        where: { billNumber_country: { billNumber: formattedBillNumber, country: "US" } },
        update: { title: bill.title, category, session: `${congress}th Congress`, dateVoted: voteDate },
        create: {
          title: bill.title, summary: bill.title, billNumber: formattedBillNumber,
          category, country: "US", session: `${congress}th Congress`, dateVoted: voteDate,
          sourceUrl: `https://www.congress.gov/bill/${congress}th-congress/${billType === "hr" ? "house-bill" : "senate-bill"}/${billNumber}`,
        },
      });
      billsSynced++;

      // Process roll call votes
      for (const action of uniqueActions) {
        for (const rv of action.recordedVotes || []) {
          try {
            await delay(500);
            // Fetch from Congress.gov roll call endpoint
            const chamber = rv.chamber.toLowerCase();
            const rollUrl = `${CONGRESS_BASE}/vote/${rv.congress}/${chamber}/${rv.sessionNumber}/${rv.rollNumber}?api_key=${congressKey()}&format=json`;
            let positions: any[] = [];

            try {
              const voteData = await fetchJson(rollUrl);
              positions = voteData?.vote?.positions || [];
            } catch {
              // Congress.gov vote endpoint sometimes fails; try House Clerk XML for House votes
              if (chamber === "house") {
                try {
                  const year = voteDate.getFullYear();
                  const xmlUrl = `https://clerk.house.gov/evs/${year}/roll${String(rv.rollNumber).padStart(3, "0")}.xml`;
                  const xmlRes = await fetch(xmlUrl);
                  if (xmlRes.ok) {
                    const xml = await xmlRes.text();
                    const voteRegex = /<recorded-vote>\s*<legislator[^>]*name-id="([^"]*)"[^>]*>.*?<\/legislator>\s*<vote>([^<]+)<\/vote>\s*<\/recorded-vote>/gs;
                    let match;
                    while ((match = voteRegex.exec(xml)) !== null) {
                      const bioguideId = match[1];
                      const votePosition = match[2].trim();
                      positions.push({ member: { bioguideId }, votePosition });
                    }
                  }
                } catch {}
              }
            }

            for (const pos of positions) {
              const bioguideId = pos.member?.bioguideId;
              if (!bioguideId) continue;
              const politicianId = congressIdToPolId.get(bioguideId);
              if (!politicianId) continue;

              const posMap: Record<string, string> = {
                yea: "YEA", aye: "YEA", yes: "YEA",
                nay: "NAY", no: "NAY",
                "not voting": "ABSENT", present: "ABSTAIN",
              };
              const position = posMap[(pos.votePosition || "not voting").toLowerCase()] || "ABSENT";

              try {
                await prisma.vote.upsert({
                  where: { politicianId_billId: { politicianId, billId: dbBill.id } },
                  update: { position: position as any },
                  create: { politicianId, billId: dbBill.id, position: position as any },
                });
                votesSynced++;
              } catch {}
            }
          } catch (err) {
            console.log(`  Warning: roll call ${rv.chamber} #${rv.rollNumber} failed: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }

      process.stdout.write(".");
    } catch (err) {
      console.log(`  Error on bill ${bill.type}${bill.number}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\nVote sync: ${billsSynced} bills, ${votesSynced} votes, ${billsSkipped} skipped`);
  return { billsSynced, votesSynced };
}

async function syncDonationsForPolitician(politicianId: string, politicianName: string, cycle: number) {
  console.log(`\nSyncing FEC donations for ${politicianName} (${cycle})...`);

  const politician = await prisma.politician.findUnique({
    where: { id: politicianId },
    select: { fecCandidateId: true },
  });

  if (!politician?.fecCandidateId) {
    console.log(`  No FEC candidate ID — skipping`);
    return { donationsCreated: 0, totalAmount: 0 };
  }

  // Get committees
  await delay(500);
  const committeesUrl = `${FEC_BASE}/candidate/${politician.fecCandidateId}/committees/?api_key=${fecKey()}&per_page=20`;
  const committeesData = await fetchJson(committeesUrl);
  const committees = committeesData.results || [];

  if (committees.length === 0) {
    console.log(`  No committees found`);
    return { donationsCreated: 0, totalAmount: 0 };
  }

  // Find best committee by receipts
  let bestId = committees[0].committee_id;
  let bestName = committees[0].name;
  let bestReceipts = 0;
  const allCommitteeNames = new Set<string>();

  for (const c of committees) {
    allCommitteeNames.add(c.name.toUpperCase());
    try {
      await delay(300);
      const totalsUrl = `${FEC_BASE}/committee/${c.committee_id}/totals/?api_key=${fecKey()}&cycle=${cycle}`;
      const totalsData = await fetchJson(totalsUrl);
      const t = totalsData.results?.[0];
      if (t && t.receipts > bestReceipts) {
        bestReceipts = t.receipts;
        bestId = c.committee_id;
        bestName = c.name;
      }
    } catch {}
  }

  console.log(`  Using: ${bestName} (${bestId}) — $${bestReceipts.toLocaleString()}`);

  const EXCLUDED = new Set([
    "retired", "self-employed", "self employed", "not employed", "none",
    "n/a", "null", "information requested", "information requested per best efforts",
    "entrepreneur", "homemaker", "disabled", "student", "unemployed", "refused", "requested",
  ]);

  let donationsCreated = 0;
  let totalAmount = 0;

  // Import industry classifier
  const { classifyIndustry, guessDonorType } = await import("../src/lib/fec-industries");

  async function upsertDonation(name: string, type: string, industry: string, amount: number) {
    if (!name || amount <= 0) return;
    let donor = await prisma.donor.findFirst({ where: { name, country: "US" } });
    if (!donor) {
      donor = await prisma.donor.create({
        data: { name, type: type as any, industry, country: "US" },
      });
    }
    const existing = await prisma.donation.findFirst({
      where: { donorId: donor.id, politicianId, electionCycle: String(cycle) },
    });
    if (existing) {
      await prisma.donation.update({ where: { id: existing.id }, data: { amount } });
    } else {
      await prisma.donation.create({
        data: { donorId: donor.id, politicianId, amount, date: new Date(), electionCycle: String(cycle) },
      });
      donationsCreated++;
    }
    totalAmount += amount;
  }

  // 1. Employer contributions
  await delay(500);
  const empUrl = `${FEC_BASE}/schedules/schedule_a/by_employer/?api_key=${fecKey()}&committee_id=${bestId}&cycle=${cycle}&sort=-total&per_page=50`;
  const empData = await fetchJson(empUrl);
  for (const emp of empData.results || []) {
    if (!emp.employer || EXCLUDED.has(emp.employer.toLowerCase().trim())) continue;
    await upsertDonation(emp.employer, guessDonorType(emp.employer), classifyIndustry(emp.employer), emp.total);
  }

  // 2. PAC/Committee contributions (filter self-transfers)
  await delay(500);
  const pacUrl = `${FEC_BASE}/schedules/schedule_a/?api_key=${fecKey()}&committee_id=${bestId}&contributor_type=committee&sort=-contribution_receipt_amount&per_page=50`;
  const pacData = await fetchJson(pacUrl);
  const polLastName = politicianName.split(" ").pop()?.toUpperCase() || "";
  for (const pac of pacData.results || []) {
    if (!pac.contributor_name || pac.contribution_receipt_amount <= 0) continue;
    const upper = pac.contributor_name.toUpperCase();
    const isSelf = Array.from(allCommitteeNames).some(cn => upper.includes(cn) || cn.includes(upper));
    if (isSelf) continue;
    if (upper.includes(polLastName) && (upper.includes("COMMITTEE") || upper.includes("JFC") || upper.includes("JOINT FUNDRAISING") || upper.includes("VICTORY") || upper.includes("SAVE AMERICA"))) continue;
    await upsertDonation(pac.contributor_name, guessDonorType(pac.contributor_name, "committee"), classifyIndustry(pac.contributor_name), pac.contribution_receipt_amount);
  }

  // 3. Contribution size breakdown
  await delay(500);
  const sizeUrl = `${FEC_BASE}/schedules/schedule_a/by_size/?api_key=${fecKey()}&committee_id=${bestId}&cycle=${cycle}&per_page=20`;
  const sizeData = await fetchJson(sizeUrl);
  let smallTotal = 0, largeTotal = 0;
  for (const s of sizeData.results || []) {
    if (s.size <= 200) smallTotal += s.total;
    else largeTotal += s.total;
  }
  if (smallTotal > 0) await upsertDonation("Small-Dollar Individual Donors (Under $200)", "INDIVIDUAL", "Individual Contributions", smallTotal);
  if (largeTotal > 0) await upsertDonation("Large-Dollar Individual Donors ($200+)", "INDIVIDUAL", "Individual Contributions", largeTotal);

  console.log(`  Donations: ${donationsCreated} created, $${totalAmount.toLocaleString()} total`);
  return { donationsCreated, totalAmount };
}

// ── Main ──

async function main() {
  console.log("=== ADDING THREE NEW POLITICIANS ===\n");

  // Define the three politicians
  const newPols = [
    {
      name: "JD Vance",
      country: "US" as const,
      party: "Republican",
      branch: "executive",
      chamber: null as string | null,
      termStart: new Date("2025-01-20"),
      termEnd: null as Date | null,
      expectedCongressId: "V000137", // From his Senate tenure
      fecOffice: "P" as string | undefined, // VP is on presidential ticket
    },
    {
      name: "Alexandria Ocasio-Cortez",
      country: "US" as const,
      party: "Democratic",
      branch: "legislative",
      chamber: "house",
      termStart: new Date("2019-01-03"),
      termEnd: null as Date | null,
      expectedCongressId: "O000172",
      fecOffice: "H" as string | undefined,
    },
    {
      name: "Rand Paul",
      country: "US" as const,
      party: "Republican",
      branch: "legislative",
      chamber: "senate",
      termStart: new Date("2011-01-05"),
      termEnd: null as Date | null,
      expectedCongressId: "P000603",
      fecOffice: "S" as string | undefined,
    },
  ];

  const results: { name: string; id: string; congressId: string | null; fecCandidateId: string | null; votes: number; donations: number; donationTotal: number }[] = [];

  for (const pol of newPols) {
    console.log(`--- ${pol.name} ---`);

    // 1. Upsert politician
    let existing = await prisma.politician.findFirst({
      where: { name: pol.name, country: pol.country },
    });

    if (existing) {
      await prisma.politician.update({
        where: { id: existing.id },
        data: { party: pol.party, branch: pol.branch, chamber: pol.chamber, termStart: pol.termStart, termEnd: pol.termEnd },
      });
      console.log(`  Updated existing record: ${existing.id}`);
    } else {
      existing = await prisma.politician.create({
        data: {
          name: pol.name, country: pol.country, party: pol.party,
          branch: pol.branch, chamber: pol.chamber,
          termStart: pol.termStart, termEnd: pol.termEnd, photoUrl: "",
        },
      });
      console.log(`  Created: ${existing.id}`);
    }

    // 2. Match Congress.gov ID
    let congressId = existing.congressId;
    if (!congressId) {
      console.log(`  Looking up Congress.gov member...`);
      try {
        const member = await searchCongressMember(pol.name);
        if (member) {
          congressId = member.bioguideId;
          console.log(`  Found: ${member.name} (${member.bioguideId}, ${member.state})`);
        } else {
          // Try expected ID
          congressId = pol.expectedCongressId;
          console.log(`  Not found in current members, using expected: ${congressId}`);
        }
        await prisma.politician.update({
          where: { id: existing.id },
          data: { congressId },
        });
      } catch (err) {
        congressId = pol.expectedCongressId;
        console.log(`  Congress.gov search failed, using expected: ${congressId} (${err instanceof Error ? err.message : String(err)})`);
        await prisma.politician.update({
          where: { id: existing.id },
          data: { congressId },
        });
      }
    } else {
      console.log(`  Congress ID already set: ${congressId}`);
    }

    // 3. Match FEC candidate ID
    let fecCandidateId = existing.fecCandidateId;
    if (!fecCandidateId) {
      console.log(`  Looking up FEC candidate...`);
      try {
        const fecResult = await searchFecCandidate(pol.name, pol.fecOffice);
        if (fecResult) {
          fecCandidateId = fecResult.candidate_id;
          console.log(`  Found: ${fecResult.name} (${fecResult.candidate_id})`);
          await prisma.politician.update({
            where: { id: existing.id },
            data: { fecCandidateId },
          });
        } else {
          console.log(`  No FEC candidate found`);
        }
      } catch (err) {
        console.log(`  FEC search failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      console.log(`  FEC ID already set: ${fecCandidateId}`);
    }

    results.push({
      name: pol.name, id: existing.id,
      congressId, fecCandidateId,
      votes: 0, donations: 0, donationTotal: 0,
    });
    console.log();
  }

  // 4. Sync voting records (all politicians with congressId at once)
  const { votesSynced } = await syncVotesForPoliticians(118, 40);

  // Count votes per politician
  for (const r of results) {
    const count = await prisma.vote.count({ where: { politicianId: r.id } });
    r.votes = count;
  }

  // 5. Sync donations for each politician
  for (const r of results) {
    const { donationsCreated, totalAmount } = await syncDonationsForPolitician(r.id, r.name, 2024);
    r.donations = donationsCreated;
    r.donationTotal = totalAmount;
  }

  // 6. Print summary
  console.log("\n" + "=".repeat(70));
  console.log("SUMMARY");
  console.log("=".repeat(70));
  for (const r of results) {
    console.log(`\n${r.name}:`);
    console.log(`  congressId: ${r.congressId || "N/A"}`);
    console.log(`  fecCandidateId: ${r.fecCandidateId || "N/A"}`);
    console.log(`  Votes: ${r.votes}`);
    console.log(`  Donations: ${r.donations}, Total: $${r.donationTotal.toLocaleString()}`);
  }

  // Database totals
  const totalBills = await prisma.bill.count();
  const totalVotes = await prisma.vote.count();
  const totalDonors = await prisma.donor.count();
  const totalPoliticians = await prisma.politician.count();

  console.log(`\nDatabase totals:`);
  console.log(`  Politicians: ${totalPoliticians}`);
  console.log(`  Bills: ${totalBills}`);
  console.log(`  Votes: ${totalVotes}`);
  console.log(`  Donors: ${totalDonors}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  prisma.$disconnect();
  process.exit(1);
});
