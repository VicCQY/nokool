import { prisma } from "@/lib/prisma";

const FETCH_DELAY = 200;
const BATCH_SIZE = 50;
const BATCH_PAUSE = 5000;
const MAX_RETRIES = 3;

const posMap: Record<string, string> = {
  yea: "YEA", aye: "YEA", yes: "YEA", nay: "NAY", no: "NAY",
  "not voting": "ABSENT", present: "ABSTAIN",
};
function mapPos(p: string) { return posMap[(p || "not voting").toLowerCase()] || "ABSENT"; }

async function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

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

interface CongressSession {
  session: number;
  year: number;
  maxHouseRoll: number;
  maxSenateRoll: number;
}

const CONGRESS_SESSIONS: Record<number, CongressSession[]> = {
  118: [
    { session: 1, year: 2023, maxHouseRoll: 730, maxSenateRoll: 350 },
    { session: 2, year: 2024, maxHouseRoll: 530, maxSenateRoll: 340 },
  ],
  119: [
    { session: 1, year: 2025, maxHouseRoll: 400, maxSenateRoll: 200 },
  ],
};

interface TrackedPol {
  id: string;
  name: string;
  congressId: string;
  lastName: string;
  firstName: string;
}

async function loadPols(): Promise<TrackedPol[]> {
  const pols = await prisma.politician.findMany({
    where: { country: "US", congressId: { not: null } },
    select: { id: true, name: true, congressId: true },
  });
  return pols.map(p => {
    const parts = p.name.split(" ");
    return {
      id: p.id, name: p.name, congressId: p.congressId!,
      lastName: parts[parts.length - 1], firstName: parts[0],
    };
  });
}

export interface FullSyncResult {
  houseBills: number;
  houseVotes: number;
  senateBills: number;
  senateVotes: number;
  errors: string[];
}

export async function runFullVoteSync(
  congress: number,
  chamber: "house" | "senate" | "both",
): Promise<FullSyncResult> {
  const sessions = CONGRESS_SESSIONS[congress];
  if (!sessions) return { houseBills: 0, houseVotes: 0, senateBills: 0, senateVotes: 0, errors: [`Unknown congress: ${congress}`] };

  const politicians = await loadPols();
  if (politicians.length === 0) return { houseBills: 0, houseVotes: 0, senateBills: 0, senateVotes: 0, errors: ["No US politicians with congressId"] };

  const result: FullSyncResult = { houseBills: 0, houseVotes: 0, senateBills: 0, senateVotes: 0, errors: [] };

  if (chamber === "house" || chamber === "both") {
    const bioguideToPolId = new Map(politicians.map(p => [p.congressId, p.id]));
    for (const sess of sessions) {
      let consecutive404s = 0;
      let inBatch = 0;
      for (let roll = 1; roll <= sess.maxHouseRoll; roll++) {
        const billNum = `H.Vote.${sess.year}.${roll}`;
        const existing = await prisma.bill.findUnique({
          where: { billNumber_country: { billNumber: billNum, country: "US" } },
          select: { id: true, _count: { select: { votes: true } } },
        });
        if (existing && existing._count.votes >= politicians.length) continue;

        await delay(FETCH_DELAY);
        inBatch++;
        if (inBatch >= BATCH_SIZE) { inBatch = 0; await delay(BATCH_PAUSE); }

        const padded = String(roll).padStart(3, "0");
        const res = await fetchWithRetry(`https://clerk.house.gov/evs/${sess.year}/roll${padded}.xml`);
        if (!res) { consecutive404s++; if (consecutive404s >= 10) break; continue; }
        consecutive404s = 0;

        const xml = await res.text();
        const questionMatch = xml.match(/<vote-question>([^<]*)<\/vote-question>/);
        const descMatch = xml.match(/<vote-desc>([^<]*)<\/vote-desc>/);
        const dateMatch = xml.match(/<action-date[^>]*>([^<]*)<\/action-date>/);
        const title = (questionMatch?.[1] || "") + (descMatch?.[1] ? ": " + descMatch[1] : "") || `House Roll Call #${roll}`;
        let voteDate = dateMatch?.[1] ? new Date(dateMatch[1]) : new Date(`${sess.year}-06-01`);
        if (isNaN(voteDate.getTime())) voteDate = new Date(`${sess.year}-06-01`);

        const voteRegex = /<recorded-vote>[\s\S]*?<legislator[^>]*name-id="([^"]*)"[^>]*>[\s\S]*?<\/legislator>\s*<vote>([^<]+)<\/vote>\s*<\/recorded-vote>/g;
        const positions: { bioguideId: string; vote: string }[] = [];
        let match;
        while ((match = voteRegex.exec(xml)) !== null) {
          if (bioguideToPolId.has(match[1])) positions.push({ bioguideId: match[1], vote: match[2].trim() });
        }
        if (positions.length === 0) continue;

        const dbBill = await prisma.bill.upsert({
          where: { billNumber_country: { billNumber: billNum, country: "US" } },
          update: { title, session: `${congress}th Congress`, dateVoted: voteDate },
          create: { title, summary: title, billNumber: billNum, category: "Other", country: "US", session: `${congress}th Congress`, dateVoted: voteDate, sourceUrl: `https://clerk.house.gov/evs/${sess.year}/roll${padded}.xml` },
        });
        result.houseBills++;

        for (const pos of positions) {
          const polId = bioguideToPolId.get(pos.bioguideId);
          if (!polId) continue;
          try {
            await prisma.vote.upsert({
              where: { politicianId_billId: { politicianId: polId, billId: dbBill.id } },
              update: { position: mapPos(pos.vote) as "YEA" | "NAY" | "ABSTAIN" | "ABSENT" },
              create: { politicianId: polId, billId: dbBill.id, position: mapPos(pos.vote) as "YEA" | "NAY" | "ABSTAIN" | "ABSENT" },
            });
            result.houseVotes++;
          } catch {}
        }
      }
    }
  }

  if (chamber === "senate" || chamber === "both") {
    const lastNameMap = new Map<string, TrackedPol[]>();
    for (const p of politicians) {
      const key = p.lastName.toLowerCase();
      if (!lastNameMap.has(key)) lastNameMap.set(key, []);
      lastNameMap.get(key)!.push(p);
    }

    for (const sess of sessions) {
      let consecutive404s = 0;
      let inBatch = 0;
      for (let roll = 1; roll <= sess.maxSenateRoll; roll++) {
        const billNum = `S.Vote.${sess.session}.${roll}`;
        const existing = await prisma.bill.findUnique({
          where: { billNumber_country: { billNumber: billNum, country: "US" } },
          select: { id: true, _count: { select: { votes: true } } },
        });
        if (existing && existing._count.votes >= politicians.length) continue;

        await delay(FETCH_DELAY);
        inBatch++;
        if (inBatch >= BATCH_SIZE) { inBatch = 0; await delay(BATCH_PAUSE); }

        const padded = String(roll).padStart(5, "0");
        const res = await fetchWithRetry(`https://www.senate.gov/legislative/LIS/roll_call_votes/vote${congress}${sess.session}/vote_${congress}_${sess.session}_${padded}.xml`);
        if (!res) { consecutive404s++; if (consecutive404s >= 10) break; continue; }
        consecutive404s = 0;

        const xml = await res.text();
        const titleMatch = xml.match(/<vote_title>([^<]*)<\/vote_title>/);
        const dateMatch = xml.match(/<vote_date>([^<]*)<\/vote_date>/);
        const title = titleMatch?.[1] || `Senate Roll Call #${roll}`;
        let voteDate = dateMatch?.[1] ? new Date(dateMatch[1].replace(/,\s*\d{1,2}:\d{2}\s*(AM|PM)/i, "")) : new Date(`${sess.year}-06-01`);
        if (isNaN(voteDate.getTime())) voteDate = new Date(`${sess.year}-06-01`);

        const memberRegex = /<member>\s*<member_full>[^<]*<\/member_full>\s*<last_name>([^<]+)<\/last_name>\s*<first_name>([^<]+)<\/first_name>\s*<party>[^<]*<\/party>\s*<state>[^<]*<\/state>\s*<vote_cast>([^<]+)<\/vote_cast>\s*<lis_member_id>[^<]*<\/lis_member_id>\s*<\/member>/g;
        const positions: { pol: TrackedPol; vote: string }[] = [];
        let m: RegExpExecArray | null;
        while ((m = memberRegex.exec(xml)) !== null) {
          const match = m;
          const candidates = lastNameMap.get(match[1].toLowerCase());
          if (!candidates) continue;
          let pol = candidates[0];
          if (candidates.length > 1) {
            const fm = candidates.find(c => c.firstName.toLowerCase().startsWith(match[2].toLowerCase().slice(0, 2)) || match[2].toLowerCase().startsWith(c.firstName.toLowerCase().slice(0, 2)));
            if (fm) pol = fm;
          }
          positions.push({ pol, vote: match[3] });
        }
        if (positions.length === 0) continue;

        const dbBill = await prisma.bill.upsert({
          where: { billNumber_country: { billNumber: billNum, country: "US" } },
          update: { title, session: `${congress}th Congress`, dateVoted: voteDate },
          create: { title, summary: title, billNumber: billNum, category: "Other", country: "US", session: `${congress}th Congress`, dateVoted: voteDate, sourceUrl: `https://www.senate.gov/legislative/LIS/roll_call_votes/vote${congress}${sess.session}/vote_${congress}_${sess.session}_${padded}.htm` },
        });
        result.senateBills++;

        for (const pos of positions) {
          try {
            await prisma.vote.upsert({
              where: { politicianId_billId: { politicianId: pos.pol.id, billId: dbBill.id } },
              update: { position: mapPos(pos.vote) as "YEA" | "NAY" | "ABSTAIN" | "ABSENT" },
              create: { politicianId: pos.pol.id, billId: dbBill.id, position: mapPos(pos.vote) as "YEA" | "NAY" | "ABSTAIN" | "ABSENT" },
            });
            result.senateVotes++;
          } catch {}
        }
      }
    }
  }

  return result;
}

export async function backfillVotesForPolitician(politicianId: string): Promise<{ newVotes: number; checked: number }> {
  const politician = await prisma.politician.findUnique({
    where: { id: politicianId },
    select: { id: true, name: true, congressId: true },
  });
  if (!politician || !politician.congressId) return { newVotes: 0, checked: 0 };

  const parts = politician.name.split(" ");
  const lastName = parts[parts.length - 1];
  const firstName = parts[0];

  const existingVotes = await prisma.vote.findMany({
    where: { politicianId },
    select: { billId: true },
  });
  const existingBillIds = new Set(existingVotes.map(v => v.billId));

  const allBills = await prisma.bill.findMany({
    where: { country: "US" },
    select: { id: true, billNumber: true },
  });

  let newVotes = 0;
  let checked = 0;

  for (const bill of allBills) {
    if (existingBillIds.has(bill.id)) continue;
    checked++;

    let xml: string | null = null;

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

    if (!xml) continue;

    let voted = false;
    let votePosition = "ABSENT";

    if (bill.billNumber.startsWith("H.Vote.")) {
      const regex = new RegExp(`name-id="${politician.congressId}"[^>]*>[\\s\\S]*?</legislator>\\s*<vote>([^<]+)</vote>`);
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
          where: { politicianId_billId: { politicianId, billId: bill.id } },
          update: { position: votePosition as "YEA" | "NAY" | "ABSTAIN" | "ABSENT" },
          create: { politicianId, billId: bill.id, position: votePosition as "YEA" | "NAY" | "ABSTAIN" | "ABSENT" },
        });
        newVotes++;
      } catch {}
    }
  }

  return { newVotes, checked };
}
