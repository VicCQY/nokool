/**
 * Full Vote Sync — fetches ALL roll call votes for a given Congress
 * from clerk.house.gov (House) and senate.gov (Senate) XML sources.
 *
 * Usage: npx tsx scripts/full-vote-sync.ts [congress] [chamber]
 *   congress: 118 or 119 (default: 118)
 *   chamber: house, senate, or both (default: both)
 */
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

// ── Config ──
const CONGRESS_BASE = "https://api.congress.gov/v3";
function congressKey() { return process.env.CONGRESS_API_KEY || ""; }

const FETCH_DELAY = 200; // ms between requests
const BATCH_SIZE = 50;
const BATCH_PAUSE = 5000; // ms between batches
const MAX_RETRIES = 3;

const posMap: Record<string, string> = {
  yea: "YEA", aye: "YEA", yes: "YEA", nay: "NAY", no: "NAY",
  "not voting": "ABSENT", present: "ABSTAIN",
};
function mapPos(p: string) { return posMap[(p || "not voting").toLowerCase()] || "ABSENT"; }

async function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<Response | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 200) return res;
      if (res.status === 404) return null;
      if (res.status === 429 || res.status === 503) {
        const backoff = Math.pow(2, attempt) * 1000;
        console.log(`  Rate limited (${res.status}), waiting ${backoff}ms...`);
        await delay(backoff);
        continue;
      }
      return null;
    } catch {
      if (attempt < retries - 1) {
        await delay(Math.pow(2, attempt) * 1000);
        continue;
      }
      return null;
    }
  }
  return null;
}

// ── Congress session/year mappings ──
interface CongressConfig {
  congress: number;
  sessions: { session: number; year: number; maxHouseRoll: number; maxSenateRoll: number }[];
}

const CONGRESS_CONFIGS: Record<number, CongressConfig> = {
  118: {
    congress: 118,
    sessions: [
      { session: 1, year: 2023, maxHouseRoll: 730, maxSenateRoll: 350 },
      { session: 2, year: 2024, maxHouseRoll: 530, maxSenateRoll: 340 },
    ],
  },
  119: {
    congress: 119,
    sessions: [
      { session: 1, year: 2025, maxHouseRoll: 400, maxSenateRoll: 200 },
    ],
  },
};

// ── Politician lookup ──
interface TrackedPolitician {
  id: string;
  name: string;
  congressId: string;
  lastName: string;
  firstName: string;
  chamber: string | null;
}

async function loadPoliticians(): Promise<TrackedPolitician[]> {
  const pols = await prisma.politician.findMany({
    where: { country: "US", congressId: { not: null } },
    select: { id: true, name: true, congressId: true, chamber: true },
  });
  return pols.map(p => {
    const parts = p.name.split(" ");
    return {
      id: p.id,
      name: p.name,
      congressId: p.congressId!,
      lastName: parts[parts.length - 1],
      firstName: parts[0],
      chamber: p.chamber,
    };
  });
}

// ── Bill enrichment via Congress.gov ──
async function enrichBillTitle(billType: string, billNumber: string, congress: number): Promise<{ title: string; sourceUrl: string } | null> {
  if (!congressKey()) return null;
  try {
    await delay(300);
    const url = `${CONGRESS_BASE}/bill/${congress}/${billType.toLowerCase()}/${billNumber}?api_key=${congressKey()}&format=json`;
    const res = await fetchWithRetry(url);
    if (!res) return null;
    const data = await res.json();
    const bill = data?.bill;
    if (!bill?.title) return null;
    const typeSlug = billType.toLowerCase() === "hr" ? "house-bill" : billType.toLowerCase() === "s" ? "senate-bill" : `${billType.toLowerCase()}-bill`;
    return {
      title: bill.title,
      sourceUrl: `https://www.congress.gov/bill/${congress}th-congress/${typeSlug}/${billNumber}`,
    };
  } catch {
    return null;
  }
}

// ── House vote parsing ──
async function syncHouseVotes(
  config: CongressConfig,
  politicians: TrackedPolitician[],
): Promise<{ votesCreated: number; billsCreated: number }> {
  const bioguideToPolId = new Map(politicians.map(p => [p.congressId, p.id]));
  const bioguideToName = new Map(politicians.map(p => [p.congressId, p.name]));
  let totalVotes = 0;
  let totalBills = 0;

  for (const sess of config.sessions) {
    console.log(`\n=== House ${sess.year} (Session ${sess.session}) ===`);
    let relevant = 0;
    let consecutive404s = 0;
    let inBatch = 0;

    for (let roll = 1; roll <= sess.maxHouseRoll; roll++) {
      // Check if we already have this vote fully covered
      const billNum = `H.Vote.${sess.year}.${roll}`;
      const existingBill = await prisma.bill.findUnique({
        where: { billNumber_country: { billNumber: billNum, country: "US" } },
        select: { id: true, _count: { select: { votes: true } } },
      });
      if (existingBill && existingBill._count.votes >= politicians.length) {
        if (roll % 100 === 0) process.stdout.write(`[skip ${roll}]`);
        continue;
      }

      await delay(FETCH_DELAY);
      inBatch++;

      if (inBatch >= BATCH_SIZE) {
        inBatch = 0;
        const pct = Math.round(roll / sess.maxHouseRoll * 100);
        process.stdout.write(`\n  House ${sess.year}: ${roll}/${sess.maxHouseRoll} (${pct}%) — ${relevant} relevant votes\n`);
        await delay(BATCH_PAUSE);
      }

      const padded = String(roll).padStart(3, "0");
      const url = `https://clerk.house.gov/evs/${sess.year}/roll${padded}.xml`;
      const res = await fetchWithRetry(url);

      if (!res) {
        consecutive404s++;
        if (consecutive404s >= 10) {
          console.log(`\n  Reached end of House ${sess.year} votes at roll ${roll}`);
          break;
        }
        continue;
      }
      consecutive404s = 0;

      const xml = await res.text();

      // Parse vote metadata
      const questionMatch = xml.match(/<vote-question>([^<]*)<\/vote-question>/);
      const descMatch = xml.match(/<vote-desc>([^<]*)<\/vote-desc>/);
      const dateMatch = xml.match(/<action-date[^>]*>([^<]*)<\/action-date>/);
      let title = (questionMatch?.[1] || "") + (descMatch?.[1] ? ": " + descMatch[1] : "");
      if (!title) title = `House Roll Call #${roll}`;
      const dateStr = dateMatch?.[1];
      let voteDate = dateStr ? new Date(dateStr) : new Date(`${sess.year}-06-01`);
      if (isNaN(voteDate.getTime())) voteDate = new Date(`${sess.year}-06-01`);

      // Parse vote positions
      const voteRegex = /<recorded-vote>\s*<legislator[^>]*name-id="([^"]*)"[^>]*>.*?<\/legislator>\s*<vote>([^<]+)<\/vote>\s*<\/recorded-vote>/gs;
      const positions: { bioguideId: string; vote: string }[] = [];
      let match;
      while ((match = voteRegex.exec(xml)) !== null) {
        if (bioguideToPolId.has(match[1])) {
          positions.push({ bioguideId: match[1], vote: match[2].trim() });
        }
      }

      if (positions.length === 0) continue;
      relevant++;

      // Try to extract actual bill reference from XML
      let sourceUrl = `https://clerk.house.gov/evs/${sess.year}/roll${padded}.xml`;
      const legNumMatch = xml.match(/<legis-num>([^<]*)<\/legis-num>/);
      if (legNumMatch?.[1]) {
        const legNum = legNumMatch[1].trim();
        const billTypeMatch = legNum.match(/^(H\.\s*R\.|S\.|H\.\s*J\.\s*Res\.|S\.\s*J\.\s*Res\.|H\.\s*Con\.\s*Res\.|S\.\s*Con\.\s*Res\.|H\.\s*Res\.|S\.\s*Res\.)\s*(\d+)/);
        if (billTypeMatch) {
          const rawType = billTypeMatch[1].replace(/\s+/g, "").replace(/\.$/, "");
          const num = billTypeMatch[2];
          const enriched = await enrichBillTitle(
            rawType === "H.R" ? "hr" : rawType === "S" ? "s" : rawType.toLowerCase().replace(/\./g, ""),
            num, config.congress
          );
          if (enriched) {
            title = enriched.title;
            sourceUrl = enriched.sourceUrl;
          }
        }
      }

      // Upsert bill
      const dbBill = await prisma.bill.upsert({
        where: { billNumber_country: { billNumber: billNum, country: "US" } },
        update: { title, session: `${config.congress}th Congress`, dateVoted: voteDate },
        create: {
          title, summary: title, billNumber: billNum,
          category: "Other", country: "US", session: `${config.congress}th Congress`,
          dateVoted: voteDate, sourceUrl,
        },
      });
      totalBills++;

      for (const pos of positions) {
        const politicianId = bioguideToPolId.get(pos.bioguideId);
        if (!politicianId) continue;
        try {
          await prisma.vote.upsert({
            where: { politicianId_billId: { politicianId, billId: dbBill.id } },
            update: { position: mapPos(pos.vote) as any },
            create: { politicianId, billId: dbBill.id, position: mapPos(pos.vote) as any },
          });
          totalVotes++;
        } catch {}
      }
      process.stdout.write(".");
    }
    console.log(`\n  House ${sess.year} done: ${relevant} relevant votes`);
  }

  return { votesCreated: totalVotes, billsCreated: totalBills };
}

// ── Senate vote parsing ──
async function syncSenateVotes(
  config: CongressConfig,
  politicians: TrackedPolitician[],
): Promise<{ votesCreated: number; billsCreated: number }> {
  // Build last-name lookup for Senate XML matching
  const lastNameMap = new Map<string, TrackedPolitician[]>();
  for (const p of politicians) {
    const key = p.lastName.toLowerCase();
    if (!lastNameMap.has(key)) lastNameMap.set(key, []);
    lastNameMap.get(key)!.push(p);
  }

  let totalVotes = 0;
  let totalBills = 0;

  for (const sess of config.sessions) {
    console.log(`\n=== Senate ${sess.year} (Session ${sess.session}) ===`);
    let relevant = 0;
    let consecutive404s = 0;
    let inBatch = 0;

    for (let roll = 1; roll <= sess.maxSenateRoll; roll++) {
      // Check if we already have this vote fully covered
      const billNum = `S.Vote.${sess.session}.${roll}`;
      const existingBill = await prisma.bill.findUnique({
        where: { billNumber_country: { billNumber: billNum, country: "US" } },
        select: { id: true, _count: { select: { votes: true } } },
      });
      if (existingBill && existingBill._count.votes >= politicians.length) {
        if (roll % 100 === 0) process.stdout.write(`[skip ${roll}]`);
        continue;
      }

      await delay(FETCH_DELAY);
      inBatch++;

      if (inBatch >= BATCH_SIZE) {
        inBatch = 0;
        const pct = Math.round(roll / sess.maxSenateRoll * 100);
        process.stdout.write(`\n  Senate ${sess.year}: ${roll}/${sess.maxSenateRoll} (${pct}%) — ${relevant} relevant votes\n`);
        await delay(BATCH_PAUSE);
      }

      const padded = String(roll).padStart(5, "0");
      const url = `https://www.senate.gov/legislative/LIS/roll_call_votes/vote${config.congress}${sess.session}/vote_${config.congress}_${sess.session}_${padded}.xml`;
      const res = await fetchWithRetry(url);

      if (!res) {
        consecutive404s++;
        if (consecutive404s >= 10) {
          console.log(`\n  Reached end of Senate ${sess.year} votes at roll ${roll}`);
          break;
        }
        continue;
      }
      consecutive404s = 0;

      const xml = await res.text();

      // Parse metadata
      const titleMatch = xml.match(/<vote_title>([^<]*)<\/vote_title>/);
      const dateMatch = xml.match(/<vote_date>([^<]*)<\/vote_date>/);
      let title = titleMatch?.[1] || `Senate Roll Call #${roll}`;
      const dateStr = dateMatch?.[1] || "";
      let voteDate = dateStr ? new Date(dateStr.replace(/,\s*\d{1,2}:\d{2}\s*(AM|PM)/i, "")) : new Date(`${sess.year}-06-01`);
      if (isNaN(voteDate.getTime())) voteDate = new Date(`${sess.year}-06-01`);

      // Parse members
      const memberRegex = /<member>\s*<member_full>[^<]*<\/member_full>\s*<last_name>([^<]+)<\/last_name>\s*<first_name>([^<]+)<\/first_name>\s*<party>[^<]*<\/party>\s*<state>[^<]*<\/state>\s*<vote_cast>([^<]+)<\/vote_cast>\s*<lis_member_id>[^<]*<\/lis_member_id>\s*<\/member>/gs;

      let m;
      const positions: { politician: TrackedPolitician; vote: string }[] = [];
      while ((m = memberRegex.exec(xml)) !== null) {
        const lastName = m[1];
        const firstName = m[2];
        const vote = m[3];
        const candidates = lastNameMap.get(lastName.toLowerCase());
        if (!candidates) continue;
        let pol = candidates[0];
        if (candidates.length > 1) {
          const firstMatch = candidates.find(c =>
            c.firstName.toLowerCase().startsWith(firstName.toLowerCase().slice(0, 2)) ||
            firstName.toLowerCase().startsWith(c.firstName.toLowerCase().slice(0, 2))
          );
          if (firstMatch) pol = firstMatch;
        }
        positions.push({ politician: pol, vote });
      }

      if (positions.length === 0) continue;
      relevant++;

      // Try to enrich from bill reference in title
      let sourceUrl = `https://www.senate.gov/legislative/LIS/roll_call_votes/vote${config.congress}${sess.session}/vote_${config.congress}_${sess.session}_${padded}.htm`;
      const billRefMatch = title.match(/(H\.R\.|S\.|H\.J\.Res\.|S\.J\.Res\.|H\.Con\.Res\.|S\.Con\.Res\.)\s*(\d+)/);
      if (billRefMatch) {
        const rawType = billRefMatch[1].replace(/\.$/, "").replace(/\./g, "").toLowerCase();
        const typeMap: Record<string, string> = { hr: "hr", s: "s", hjres: "hjres", sjres: "sjres", hconres: "hconres", sconres: "sconres" };
        const apiType = typeMap[rawType];
        if (apiType) {
          const enriched = await enrichBillTitle(apiType, billRefMatch[2], config.congress);
          if (enriched) {
            title = enriched.title;
            sourceUrl = enriched.sourceUrl;
          }
        }
      }

      // Upsert bill
      const dbBill = await prisma.bill.upsert({
        where: { billNumber_country: { billNumber: billNum, country: "US" } },
        update: { title, session: `${config.congress}th Congress`, dateVoted: voteDate },
        create: {
          title, summary: title, billNumber: billNum,
          category: "Other", country: "US", session: `${config.congress}th Congress`,
          dateVoted: voteDate, sourceUrl,
        },
      });
      totalBills++;

      for (const pos of positions) {
        try {
          await prisma.vote.upsert({
            where: { politicianId_billId: { politicianId: pos.politician.id, billId: dbBill.id } },
            update: { position: mapPos(pos.vote) as any },
            create: { politicianId: pos.politician.id, billId: dbBill.id, position: mapPos(pos.vote) as any },
          });
          totalVotes++;
        } catch {}
      }
      process.stdout.write(".");
    }
    console.log(`\n  Senate ${sess.year} done: ${relevant} relevant votes`);
  }

  return { votesCreated: totalVotes, billsCreated: totalBills };
}

// ── Backfill votes for a specific politician ──
// Re-scans all existing bill vote XMLs to find votes for a newly added politician
export async function backfillVotesForPolitician(politicianId: string) {
  const politician = await prisma.politician.findUnique({
    where: { id: politicianId },
    select: { id: true, name: true, congressId: true, chamber: true },
  });
  if (!politician || !politician.congressId) {
    console.log("Politician not found or has no congressId");
    return;
  }

  const parts = politician.name.split(" ");
  const lastName = parts[parts.length - 1];
  const firstName = parts[0];

  // Get all bills that this politician doesn't have votes for
  const existingVotes = await prisma.vote.findMany({
    where: { politicianId },
    select: { billId: true },
  });
  const existingBillIds = new Set(existingVotes.map(v => v.billId));

  const allBills = await prisma.bill.findMany({
    where: { country: "US" },
    select: { id: true, billNumber: true, sourceUrl: true },
  });

  let newVotes = 0;
  let checked = 0;

  for (const bill of allBills) {
    if (existingBillIds.has(bill.id)) continue;
    checked++;

    // Determine if this is a House or Senate vote and fetch XML
    let xml: string | null = null;

    if (bill.billNumber.startsWith("H.Vote.")) {
      // House vote: H.Vote.{year}.{roll}
      const parts = bill.billNumber.split(".");
      const year = parts[2];
      const roll = String(Number(parts[3])).padStart(3, "0");
      const url = `https://clerk.house.gov/evs/${year}/roll${roll}.xml`;
      await delay(FETCH_DELAY);
      const res = await fetchWithRetry(url);
      if (res) xml = await res.text();
    } else if (bill.billNumber.startsWith("S.Vote.")) {
      // Senate vote: S.Vote.{session}.{roll}
      const parts = bill.billNumber.split(".");
      const session = parts[2];
      const roll = String(Number(parts[3])).padStart(5, "0");
      // Try 118th Congress first, then 119th
      for (const cong of [118, 119]) {
        const url = `https://www.senate.gov/legislative/LIS/roll_call_votes/vote${cong}${session}/vote_${cong}_${session}_${roll}.xml`;
        await delay(FETCH_DELAY);
        const res = await fetchWithRetry(url);
        if (res) { xml = await res.text(); break; }
      }
    }

    if (!xml) continue;

    // Check if this politician voted
    let voted = false;
    let votePosition = "ABSENT";

    if (bill.billNumber.startsWith("H.Vote.")) {
      // Match by bioguideId
      const regex = new RegExp(`name-id="${politician.congressId}"[^>]*>.*?</legislator>\\s*<vote>([^<]+)</vote>`, "s");
      const match = xml.match(regex);
      if (match) {
        voted = true;
        votePosition = mapPos(match[1].trim());
      }
    } else {
      // Senate: match by last name
      const regex = new RegExp(`<last_name>${lastName}</last_name>\\s*<first_name>([^<]+)</first_name>.*?<vote_cast>([^<]+)</vote_cast>`, "s");
      const match = xml.match(regex);
      if (match) {
        // Verify first name matches
        const xmlFirst = match[1].toLowerCase();
        const polFirst = firstName.toLowerCase();
        if (xmlFirst.startsWith(polFirst.slice(0, 2)) || polFirst.startsWith(xmlFirst.slice(0, 2))) {
          voted = true;
          votePosition = mapPos(match[2].trim());
        }
      }
    }

    if (voted) {
      try {
        await prisma.vote.upsert({
          where: { politicianId_billId: { politicianId, billId: bill.id } },
          update: { position: votePosition as any },
          create: { politicianId, billId: bill.id, position: votePosition as any },
        });
        newVotes++;
      } catch {}
    }

    if (checked % 50 === 0) {
      process.stdout.write(`  Backfill ${politician.name}: checked ${checked}/${allBills.length - existingBillIds.size}, found ${newVotes}\n`);
    }
  }

  console.log(`  Backfill complete for ${politician.name}: ${newVotes} new votes from ${checked} bills checked`);
  return newVotes;
}

// ── Main ──
async function main() {
  const args = process.argv.slice(2);
  const congressNum = Number(args[0]) || 118;
  const chamberArg = (args[1] || "both").toLowerCase();

  const config = CONGRESS_CONFIGS[congressNum];
  if (!config) {
    console.error(`Unknown congress: ${congressNum}. Supported: ${Object.keys(CONGRESS_CONFIGS).join(", ")}`);
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log(`FULL VOTE SYNC — ${congressNum}th Congress`);
  console.log(`Chamber: ${chamberArg}`);
  console.log("=".repeat(60));

  const politicians = await loadPoliticians();
  console.log(`\nTracked politicians: ${politicians.map(p => `${p.name} (${p.congressId})`).join(", ")}`);

  let houseResult = { votesCreated: 0, billsCreated: 0 };
  let senateResult = { votesCreated: 0, billsCreated: 0 };

  if (chamberArg === "house" || chamberArg === "both") {
    houseResult = await syncHouseVotes(config, politicians);
  }

  if (chamberArg === "senate" || chamberArg === "both") {
    senateResult = await syncSenateVotes(config, politicians);
  }

  // Print final summary
  console.log("\n" + "=".repeat(60));
  console.log("SYNC COMPLETE");
  console.log("=".repeat(60));
  console.log(`  House: ${houseResult.billsCreated} bills, ${houseResult.votesCreated} votes`);
  console.log(`  Senate: ${senateResult.billsCreated} bills, ${senateResult.votesCreated} votes`);
  console.log(`  Total: ${houseResult.billsCreated + senateResult.billsCreated} bills, ${houseResult.votesCreated + senateResult.votesCreated} votes`);

  // Per-politician totals
  console.log("\nPer-politician vote counts:");
  const allPols = await prisma.politician.findMany({
    where: { country: "US" },
    select: { name: true, chamber: true, _count: { select: { votes: true } } },
  });
  for (const p of allPols) {
    console.log(`  ${p.name} (${p.chamber || "exec"}): ${p._count.votes} votes`);
  }

  const totalBills = await prisma.bill.count();
  const totalVotes = await prisma.vote.count();
  console.log(`\nDatabase totals: ${totalBills} bills, ${totalVotes} votes`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
