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
const CONGRESS_BASE = "https://api.congress.gov/v3";
function fecKey() { return process.env.FEC_API_KEY!; }
function congressKey() { return process.env.CONGRESS_API_KEY!; }
async function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  return res.json();
}

async function main() {
  // 1. Fix JD Vance FEC ID — search for his Senate campaign
  console.log("=== Fixing JD Vance FEC ID ===");
  await delay(500);
  const vanceData = await fetchJson(`${FEC_BASE}/candidates/search/?api_key=${fecKey()}&q=vance&office=S&state=OH&per_page=10`);
  for (const c of vanceData.results || []) {
    console.log(`  ${c.candidate_id} | ${c.name} | ${c.office} | ${c.state}`);
  }
  const vanceFec = (vanceData.results || []).find((c: any) => c.name.toUpperCase().includes("VANCE"));
  if (vanceFec) {
    console.log(`  Matched: ${vanceFec.candidate_id}`);
    await prisma.politician.updateMany({
      where: { name: "JD Vance" },
      data: { fecCandidateId: vanceFec.candidate_id },
    });
  }

  // Also try searching without office filter
  if (!vanceFec) {
    console.log("  Trying broader search...");
    await delay(500);
    const vanceData2 = await fetchJson(`${FEC_BASE}/candidates/search/?api_key=${fecKey()}&q=jd+vance&per_page=10`);
    for (const c of vanceData2.results || []) {
      console.log(`  ${c.candidate_id} | ${c.name} | ${c.office}`);
    }
    const v2 = (vanceData2.results || []).find((c: any) => c.name.toUpperCase().includes("VANCE"));
    if (v2) {
      console.log(`  Matched: ${v2.candidate_id}`);
      await prisma.politician.updateMany({
        where: { name: "JD Vance" },
        data: { fecCandidateId: v2.candidate_id },
      });
    }
  }

  // 2. Sync more votes — fetch 100 bills from 118th Congress
  console.log("\n=== Syncing more votes (100 bills) ===");

  const politicians = await prisma.politician.findMany({
    where: { country: "US", congressId: { not: null } },
    select: { id: true, name: true, congressId: true, chamber: true },
  });
  const congressIdToPolId = new Map(politicians.map((p) => [p.congressId!, p.id]));
  console.log(`Politicians with congressId: ${Array.from(congressIdToPolId.entries()).map(([k, v]) => k).join(", ")}`);

  // Fetch more bills, focusing on ones that had votes
  let totalVotes = 0;

  for (let offset = 0; offset < 200; offset += 50) {
    await delay(500);
    const billsUrl = `${CONGRESS_BASE}/bill/118?api_key=${congressKey()}&format=json&limit=50&offset=${offset}&sort=updateDate+desc`;
    const billsData = await fetchJson(billsUrl);
    const bills = billsData.bills || [];
    console.log(`\nBatch ${offset/50 + 1}: ${bills.length} bills`);

    for (const bill of bills) {
      const billType = bill.type.toLowerCase();
      const billNumber = bill.number;

      try {
        await delay(500);
        const actionsUrl = `${CONGRESS_BASE}/bill/118/${billType}/${billNumber}/actions?api_key=${congressKey()}&format=json&limit=50`;
        const actionsData = await fetchJson(actionsUrl);
        const actions = (actionsData.actions || []).filter(
          (a: any) => a.recordedVotes && a.recordedVotes.length > 0
        );

        if (actions.length === 0) continue;

        // Deduplicate
        const seenRolls = new Set<string>();
        const rollCalls: any[] = [];
        for (const a of actions) {
          for (const rv of a.recordedVotes || []) {
            const key = `${rv.chamber}-${rv.rollNumber}-${rv.sessionNumber}`;
            if (!seenRolls.has(key)) {
              seenRolls.add(key);
              rollCalls.push(rv);
            }
          }
        }

        // Get bill detail
        let policyArea: string | undefined;
        try {
          await delay(500);
          const detail = await fetchJson(`${CONGRESS_BASE}/bill/118/${billType}/${billNumber}?api_key=${congressKey()}&format=json`);
          policyArea = detail?.bill?.policyArea?.name;
        } catch {}

        const typeMap: Record<string, string> = {
          hr: "H.R.", s: "S.", hjres: "H.J.Res.", sjres: "S.J.Res.",
          hconres: "H.Con.Res.", sconres: "S.Con.Res.", hres: "H.Res.", sres: "S.Res.",
        };
        const formattedBillNumber = (typeMap[billType] || bill.type) + billNumber;
        const categoryMap: Record<string, string> = {
          "Armed Forces and National Security": "Defense",
          "International Affairs": "Foreign Policy",
          "Economics and Public Finance": "Economy",
          "Health": "Healthcare", "Education": "Education",
          "Environmental Protection": "Environment", "Immigration": "Immigration",
          "Transportation and Public Works": "Infrastructure",
          "Crime and Law Enforcement": "Justice", "Taxation": "Economy",
          "Science, Technology, Communications": "Technology",
        };
        const category = (policyArea && categoryMap[policyArea]) || "Other";

        const firstRv = rollCalls[0];
        const voteDate = firstRv?.date ? new Date(firstRv.date) : new Date();

        const dbBill = await prisma.bill.upsert({
          where: { billNumber_country: { billNumber: formattedBillNumber, country: "US" } },
          update: { title: bill.title, category, session: "118th Congress", dateVoted: voteDate },
          create: {
            title: bill.title, summary: bill.title, billNumber: formattedBillNumber,
            category, country: "US", session: "118th Congress", dateVoted: voteDate,
            sourceUrl: `https://www.congress.gov/bill/118th-congress/${billType === "hr" ? "house-bill" : "senate-bill"}/${billNumber}`,
          },
        });

        // Process each roll call
        for (const rv of rollCalls) {
          try {
            await delay(500);
            const chamber = rv.chamber.toLowerCase();
            let positions: any[] = [];

            // Try Congress.gov first
            try {
              const voteData = await fetchJson(`${CONGRESS_BASE}/vote/${rv.congress}/${chamber}/${rv.sessionNumber}/${rv.rollNumber}?api_key=${congressKey()}&format=json`);
              positions = voteData?.vote?.positions || [];
            } catch {
              // Fallback to House Clerk XML for House votes
              if (chamber === "house") {
                try {
                  const year = voteDate.getFullYear() || 2024;
                  const xmlUrl = `https://clerk.house.gov/evs/${year}/roll${String(rv.rollNumber).padStart(3, "0")}.xml`;
                  const xmlRes = await fetch(xmlUrl);
                  if (xmlRes.ok) {
                    const xml = await xmlRes.text();
                    const voteRegex = /<recorded-vote>\s*<legislator[^>]*name-id="([^"]*)"[^>]*>.*?<\/legislator>\s*<vote>([^<]+)<\/vote>\s*<\/recorded-vote>/gs;
                    let match;
                    while ((match = voteRegex.exec(xml)) !== null) {
                      positions.push({ member: { bioguideId: match[1] }, votePosition: match[2].trim() });
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
                yea: "YEA", aye: "YEA", yes: "YEA", nay: "NAY", no: "NAY",
                "not voting": "ABSENT", present: "ABSTAIN",
              };
              const position = posMap[(pos.votePosition || "not voting").toLowerCase()] || "ABSENT";

              try {
                await prisma.vote.upsert({
                  where: { politicianId_billId: { politicianId, billId: dbBill.id } },
                  update: { position: position as any },
                  create: { politicianId, billId: dbBill.id, position: position as any },
                });
                totalVotes++;
              } catch {}
            }
          } catch {}
        }
        process.stdout.write(`+`);
      } catch {}
    }
  }

  console.log(`\n\nTotal new votes upserted: ${totalVotes}`);

  // 3. Now sync donations for Vance
  const vance = await prisma.politician.findFirst({ where: { name: "JD Vance" } });
  if (vance?.fecCandidateId) {
    console.log(`\n=== Syncing donations for JD Vance ===`);
    // Import helpers
    const { classifyIndustry, guessDonorType } = await import("../src/lib/fec-industries");

    await delay(500);
    const committeesData = await fetchJson(`${FEC_BASE}/candidate/${vance.fecCandidateId}/committees/?api_key=${fecKey()}&per_page=20`);
    const committees = committeesData.results || [];
    let bestId = committees[0]?.committee_id;
    let bestReceipts = 0;
    const allNames = new Set<string>();

    for (const c of committees) {
      allNames.add(c.name.toUpperCase());
      try {
        await delay(300);
        const t = await fetchJson(`${FEC_BASE}/committee/${c.committee_id}/totals/?api_key=${fecKey()}&cycle=2024`);
        const r = t.results?.[0];
        if (r && r.receipts > bestReceipts) { bestReceipts = r.receipts; bestId = c.committee_id; }
      } catch {}
    }
    console.log(`  Best committee: ${bestId} ($${bestReceipts.toLocaleString()})`);

    const EXCLUDED = new Set(["retired", "self-employed", "self employed", "not employed", "none", "n/a", "null", "information requested", "information requested per best efforts", "entrepreneur", "homemaker", "disabled", "student", "unemployed"]);
    let donationsCreated = 0, totalAmount = 0;

    async function upsertDonation(name: string, type: string, industry: string, amount: number) {
      if (!name || amount <= 0) return;
      let donor = await prisma.donor.findFirst({ where: { name, country: "US" } });
      if (!donor) donor = await prisma.donor.create({ data: { name, type: type as any, industry, country: "US" } });
      const existing = await prisma.donation.findFirst({ where: { donorId: donor.id, politicianId: vance.id, electionCycle: "2024" } });
      if (existing) { await prisma.donation.update({ where: { id: existing.id }, data: { amount } }); }
      else { await prisma.donation.create({ data: { donorId: donor.id, politicianId: vance.id, amount, date: new Date(), electionCycle: "2024" } }); donationsCreated++; }
      totalAmount += amount;
    }

    if (bestId) {
      await delay(500);
      const empData = await fetchJson(`${FEC_BASE}/schedules/schedule_a/by_employer/?api_key=${fecKey()}&committee_id=${bestId}&cycle=2024&sort=-total&per_page=50`);
      for (const emp of empData.results || []) {
        if (!emp.employer || EXCLUDED.has(emp.employer.toLowerCase().trim())) continue;
        await upsertDonation(emp.employer, guessDonorType(emp.employer), classifyIndustry(emp.employer), emp.total);
      }

      await delay(500);
      const sizeData = await fetchJson(`${FEC_BASE}/schedules/schedule_a/by_size/?api_key=${fecKey()}&committee_id=${bestId}&cycle=2024&per_page=20`);
      let smallTotal = 0, largeTotal = 0;
      for (const s of sizeData.results || []) {
        if (s.size <= 200) smallTotal += s.total; else largeTotal += s.total;
      }
      if (smallTotal > 0) await upsertDonation("Small-Dollar Individual Donors (Under $200)", "INDIVIDUAL", "Individual Contributions", smallTotal);
      if (largeTotal > 0) await upsertDonation("Large-Dollar Individual Donors ($200+)", "INDIVIDUAL", "Individual Contributions", largeTotal);
    }
    console.log(`  Donations: ${donationsCreated}, $${totalAmount.toLocaleString()}`);
  }

  // 4. Final summary
  console.log("\n" + "=".repeat(60));
  console.log("FINAL SUMMARY");
  console.log("=".repeat(60));

  const allPols = await prisma.politician.findMany({
    where: { country: "US" },
    select: { id: true, name: true, congressId: true, fecCandidateId: true, _count: { select: { votes: true, donations: true } } },
  });
  for (const p of allPols) {
    const donationSum = await prisma.donation.aggregate({ where: { politicianId: p.id }, _sum: { amount: true } });
    console.log(`\n${p.name}:`);
    console.log(`  congressId: ${p.congressId || "N/A"}`);
    console.log(`  fecCandidateId: ${p.fecCandidateId || "N/A"}`);
    console.log(`  Votes: ${p._count.votes}`);
    console.log(`  Donations: ${p._count.donations}, $${(donationSum._sum.amount || 0).toLocaleString()}`);
  }

  const totalBills = await prisma.bill.count();
  const totalVotesDb = await prisma.vote.count();
  const totalDonors = await prisma.donor.count();
  console.log(`\nDatabase totals: ${allPols.length} politicians, ${totalBills} bills, ${totalVotesDb} votes, ${totalDonors} donors`);

  await prisma.$disconnect();
}

main().catch(console.error);
