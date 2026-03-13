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

async function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

const posMap: Record<string, string> = {
  yea: "YEA", aye: "YEA", yes: "YEA", nay: "NAY", no: "NAY",
  "not voting": "ABSENT", present: "ABSTAIN",
};
function mapPos(p: string) { return posMap[(p || "not voting").toLowerCase()] || "ABSENT"; }

interface SenatorInfo {
  lastName: string;
  firstName: string;
  state: string;
  politicianId: string;
}

interface RepInfo {
  bioguideId: string;
  politicianId: string;
}

async function main() {
  // Load all US politicians
  const politicians = await prisma.politician.findMany({
    where: { country: "US", congressId: { not: null } },
    select: { id: true, name: true, congressId: true, chamber: true },
  });
  console.log("Politicians:", politicians.map(p => `${p.name} (${p.congressId}, ${p.chamber || "?"})`).join(", "));

  // Build senator lookup by last name + state (for Senate XML matching)
  const senators: SenatorInfo[] = [];
  // Build rep lookup by bioguideId (for House XML matching)
  const reps: RepInfo[] = [];
  const congressIdToPolId = new Map(politicians.map(p => [p.congressId!, p.id]));

  for (const p of politicians) {
    const parts = p.name.split(" ");
    const lastName = parts[parts.length - 1];
    // Everyone gets added to both lookups since we want to match any votes
    senators.push({ lastName, firstName: parts[0], state: "", politicianId: p.id });
    reps.push({ bioguideId: p.congressId!, politicianId: p.id });
  }

  // Map for quick bioguide lookup (House)
  const bioguideToPolId = new Map(reps.map(r => [r.bioguideId, r.politicianId]));
  // Map for quick last name lookup (Senate) — may have collisions, so also store name
  const lastNameToSenators = new Map<string, SenatorInfo[]>();
  for (const s of senators) {
    const key = s.lastName.toLowerCase();
    if (!lastNameToSenators.has(key)) lastNameToSenators.set(key, []);
    lastNameToSenators.get(key)!.push(s);
  }

  let totalVotes = 0;
  let totalBills = 0;

  // ============================================================
  // PART 1: Senate votes via Senate.gov XML
  // 118th Congress: Session 1 (2023), Session 2 (2024)
  // ============================================================
  console.log("\n=== Fetching Senate votes (XML from senate.gov) ===");

  for (const session of [1, 2]) {
    const year = session === 1 ? 2023 : 2024;
    console.log(`\nSession ${session} (${year}):`);

    // Pick a spread of roll calls across the session
    // Senate typically has 200-400 roll calls per session
    const rollNumbers: number[] = [];
    for (let i = 1; i <= 350; i += 7) { // Every 7th roll call for good spread
      rollNumbers.push(i);
    }

    let sessionVotes = 0;
    let consecutive404s = 0;

    for (const roll of rollNumbers) {
      await delay(300);
      const padded = String(roll).padStart(5, "0");
      const url = `https://www.senate.gov/legislative/LIS/roll_call_votes/vote118${session}/vote_118_${session}_${padded}.xml`;

      try {
        const res = await fetch(url);
        if (res.status !== 200) {
          consecutive404s++;
          if (consecutive404s >= 3) break; // Stop if we hit the end
          continue;
        }
        consecutive404s = 0;

        const xml = await res.text();

        // Extract vote title and date
        const titleMatch = xml.match(/<vote_title>([^<]*)<\/vote_title>/);
        const dateMatch = xml.match(/<vote_date>([^<]*)<\/vote_date>/);
        const title = titleMatch?.[1] || `Senate Roll Call #${roll}`;
        const dateStr = dateMatch?.[1] || "";
        const voteDate = dateStr ? new Date(dateStr.replace(/,\s*\d{1,2}:\d{2}\s*(AM|PM)/, "")) : new Date(`${year}-06-01`);
        if (isNaN(voteDate.getTime())) voteDate.setTime(new Date(`${year}-06-01`).getTime());

        // Parse members
        const memberRegex = /<member>\s*<member_full>[^<]*<\/member_full>\s*<last_name>([^<]+)<\/last_name>\s*<first_name>([^<]+)<\/first_name>\s*<party>[^<]*<\/party>\s*<state>[^<]*<\/state>\s*<vote_cast>([^<]+)<\/vote_cast>\s*<lis_member_id>[^<]*<\/lis_member_id>\s*<\/member>/gs;

        let m;
        const positions: { lastName: string; firstName: string; vote: string }[] = [];
        while ((m = memberRegex.exec(xml)) !== null) {
          positions.push({ lastName: m[1], firstName: m[2], vote: m[3] });
        }

        // Check if any of our tracked politicians voted
        let matchedAny = false;
        const matchedNames: string[] = [];
        for (const pos of positions) {
          const candidates = lastNameToSenators.get(pos.lastName.toLowerCase());
          if (!candidates) continue;
          // If multiple politicians share a last name, try first name match
          let senator = candidates[0];
          if (candidates.length > 1) {
            const firstMatch = candidates.find(c =>
              c.firstName.toLowerCase().startsWith(pos.firstName.toLowerCase().slice(0, 2)) ||
              pos.firstName.toLowerCase().startsWith(c.firstName.toLowerCase().slice(0, 2))
            );
            if (firstMatch) senator = firstMatch;
          }
          matchedAny = true;
          matchedNames.push(pos.lastName);
        }

        if (!matchedAny) continue;

        // Create bill record
        const billNumber = `S.Vote.${session}.${roll}`;
        const dbBill = await prisma.bill.upsert({
          where: { billNumber_country: { billNumber, country: "US" } },
          update: { title, session: "118th Congress", dateVoted: voteDate },
          create: {
            title, summary: title, billNumber,
            category: "Other", country: "US", session: "118th Congress",
            dateVoted: voteDate,
            sourceUrl: `https://www.senate.gov/legislative/LIS/roll_call_votes/vote118${session}/vote_118_${session}_${padded}.htm`,
          },
        });
        totalBills++;

        // Upsert votes for matched politicians
        let billVotes = 0;
        for (const pos of positions) {
          const candidates = lastNameToSenators.get(pos.lastName.toLowerCase());
          if (!candidates) continue;
          let senator = candidates[0];
          if (candidates.length > 1) {
            const firstMatch = candidates.find(c =>
              c.firstName.toLowerCase().startsWith(pos.firstName.toLowerCase().slice(0, 2)) ||
              pos.firstName.toLowerCase().startsWith(c.firstName.toLowerCase().slice(0, 2))
            );
            if (firstMatch) senator = firstMatch;
          }

          try {
            await prisma.vote.upsert({
              where: { politicianId_billId: { politicianId: senator.politicianId, billId: dbBill.id } },
              update: { position: mapPos(pos.vote) as any },
              create: { politicianId: senator.politicianId, billId: dbBill.id, position: mapPos(pos.vote) as any },
            });
            billVotes++;
            totalVotes++;
          } catch {}
        }
        if (billVotes > 0) {
          sessionVotes += billVotes;
          process.stdout.write(`  [S${session}#${roll}] ${matchedNames.join(", ")}: ${billVotes} votes | ${title.slice(0, 50)}\n`);
        }
      } catch (err: any) {
        // Skip network errors
      }
    }
    console.log(`  Session ${session} total: ${sessionVotes} votes`);
  }

  // ============================================================
  // PART 2: House votes via clerk.house.gov XML
  // 118th Congress: 2023 and 2024
  // ============================================================
  console.log("\n=== Fetching House votes (XML from clerk.house.gov) ===");

  for (const year of [2023, 2024]) {
    console.log(`\nYear ${year}:`);

    const rollNumbers: number[] = [];
    for (let i = 1; i <= 600; i += 10) { // Every 10th roll call
      rollNumbers.push(i);
    }

    let yearVotes = 0;
    let consecutive404s = 0;

    for (const roll of rollNumbers) {
      await delay(300);
      const padded = String(roll).padStart(3, "0");
      const url = `https://clerk.house.gov/evs/${year}/roll${padded}.xml`;

      try {
        const res = await fetch(url);
        if (res.status !== 200) {
          consecutive404s++;
          if (consecutive404s >= 3) break;
          continue;
        }
        consecutive404s = 0;

        const xml = await res.text();

        // Extract vote metadata
        const questionMatch = xml.match(/<vote-question>([^<]*)<\/vote-question>/);
        const descMatch = xml.match(/<vote-desc>([^<]*)<\/vote-desc>/);
        const dateMatch = xml.match(/<action-date[^>]*>([^<]*)<\/action-date>/);
        const title = (questionMatch?.[1] || "") + (descMatch?.[1] ? ": " + descMatch[1] : "") || `House Roll Call #${roll}`;
        const dateStr = dateMatch?.[1];
        const voteDate = dateStr ? new Date(dateStr) : new Date(`${year}-06-01`);
        if (isNaN(voteDate.getTime())) voteDate.setTime(new Date(`${year}-06-01`).getTime());

        // Parse recorded votes — match by name-id (bioguideId)
        const voteRegex = /<recorded-vote>\s*<legislator[^>]*name-id="([^"]*)"[^>]*>.*?<\/legislator>\s*<vote>([^<]+)<\/vote>\s*<\/recorded-vote>/gs;

        let match;
        let matchedAny = false;
        const matchedNames: string[] = [];
        const matchedPositions: { bioguideId: string; vote: string }[] = [];

        while ((match = voteRegex.exec(xml)) !== null) {
          const bioguideId = match[1];
          const vote = match[2].trim();
          if (bioguideToPolId.has(bioguideId)) {
            matchedAny = true;
            matchedPositions.push({ bioguideId, vote });
            const pol = politicians.find(p => p.congressId === bioguideId);
            if (pol) matchedNames.push(pol.name.split(" ").pop()!);
          }
        }

        if (!matchedAny) continue;

        // Create bill record
        const billNumber = `H.Vote.${year}.${roll}`;
        const dbBill = await prisma.bill.upsert({
          where: { billNumber_country: { billNumber, country: "US" } },
          update: { title, session: "118th Congress", dateVoted: voteDate },
          create: {
            title, summary: title, billNumber,
            category: "Other", country: "US", session: "118th Congress",
            dateVoted: voteDate,
            sourceUrl: `https://clerk.house.gov/evs/${year}/roll${padded}.xml`,
          },
        });
        totalBills++;

        let billVotes = 0;
        for (const pos of matchedPositions) {
          const politicianId = bioguideToPolId.get(pos.bioguideId);
          if (!politicianId) continue;
          try {
            await prisma.vote.upsert({
              where: { politicianId_billId: { politicianId, billId: dbBill.id } },
              update: { position: mapPos(pos.vote) as any },
              create: { politicianId, billId: dbBill.id, position: mapPos(pos.vote) as any },
            });
            billVotes++;
            totalVotes++;
          } catch {}
        }
        if (billVotes > 0) {
          yearVotes += billVotes;
          process.stdout.write(`  [H${year}#${roll}] ${matchedNames.join(", ")}: ${billVotes} votes | ${title.slice(0, 50)}\n`);
        }
      } catch {}
    }
    console.log(`  Year ${year} total: ${yearVotes} votes`);
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log(`\n\nTotal new votes upserted: ${totalVotes}`);
  console.log(`Bills/vote records created: ${totalBills}`);
  console.log("\n" + "=".repeat(60));
  console.log("FINAL VOTE COUNTS");
  console.log("=".repeat(60));

  const allPols = await prisma.politician.findMany({
    where: { country: "US" },
    select: { id: true, name: true, chamber: true, _count: { select: { votes: true } } },
  });
  for (const p of allPols) {
    console.log(`  ${p.name} (${p.chamber || "exec"}): ${p._count.votes} votes`);
  }

  const dbBills = await prisma.bill.count();
  const dbVotes = await prisma.vote.count();
  console.log(`\nDatabase totals: ${dbBills} bills, ${dbVotes} votes`);

  await prisma.$disconnect();
}

main().catch(console.error);
