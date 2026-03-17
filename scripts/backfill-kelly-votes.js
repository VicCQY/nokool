const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const FETCH_DELAY = 250;
const BATCH_SIZE = 50;
const BATCH_PAUSE = 5000;
const MAX_RETRIES = 3;

const posMap = {
  yea: "YEA", aye: "YEA", yes: "YEA",
  nay: "NAY", no: "NAY",
  "not voting": "ABSENT",
  present: "ABSTAIN",
};
function mapPos(p) { return posMap[(p || "not voting").toLowerCase()] || "ABSENT"; }
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithRetry(url) {
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
      if (attempt < MAX_RETRIES - 1) { await delay(Math.pow(2, attempt) * 1000); continue; }
      return null;
    }
  }
  return null;
}

// 117th Congress: 2021-2022, 118th Congress: 2023-2024
const SESSIONS = [
  { congress: 117, session: 1, year: 2021, maxRoll: 550 },
  { congress: 117, session: 2, year: 2022, maxRoll: 500 },
  { congress: 118, session: 1, year: 2023, maxRoll: 350 },
  { congress: 118, session: 2, year: 2024, maxRoll: 340 },
];

async function main() {
  // Find Mark Kelly
  const kelly = await prisma.politician.findFirst({
    where: { name: { contains: "Mark Kelly" } },
    select: { id: true, name: true },
  });
  if (!kelly) { console.log("Mark Kelly not found"); process.exit(1); }
  console.log("Found:", kelly.name, kelly.id);

  const kellyLast = "Kelly";
  const kellyFirst = "Mark";

  let totalBills = 0;
  let totalVotes = 0;
  let skipped = 0;

  for (const sess of SESSIONS) {
    console.log(`\n=== ${sess.congress}th Congress, Session ${sess.session} (${sess.year}) ===`);
    let consecutive404s = 0;
    let inBatch = 0;
    let sessionBills = 0;
    let sessionVotes = 0;

    for (let roll = 1; roll <= sess.maxRoll; roll++) {
      // Use congress-aware bill number to avoid collisions
      const billNum = `S.Vote.${sess.congress}.${sess.session}.${roll}`;

      // Check if we already have this bill with a vote from Kelly
      const existing = await prisma.bill.findUnique({
        where: { billNumber_country: { billNumber: billNum, country: "US" } },
        select: { id: true, votes: { where: { politicianId: kelly.id }, select: { id: true } } },
      });
      if (existing && existing.votes.length > 0) { skipped++; continue; }

      await delay(FETCH_DELAY);
      inBatch++;
      if (inBatch >= BATCH_SIZE) {
        inBatch = 0;
        await delay(BATCH_PAUSE);
        process.stdout.write(`  [batch pause at roll ${roll}]\n`);
      }

      const padded = String(roll).padStart(5, "0");
      const url = `https://www.senate.gov/legislative/LIS/roll_call_votes/vote${sess.congress}${sess.session}/vote_${sess.congress}_${sess.session}_${padded}.xml`;
      const res = await fetchWithRetry(url);
      if (!res) {
        consecutive404s++;
        if (consecutive404s >= 15) {
          console.log(`  Stopped at roll ${roll} after 15 consecutive 404s`);
          break;
        }
        continue;
      }
      consecutive404s = 0;

      const xml = await res.text();
      const titleMatch = xml.match(/<vote_title>([^<]*)<\/vote_title>/);
      const dateMatch = xml.match(/<vote_date>([^<]*)<\/vote_date>/);
      const title = titleMatch?.[1] || `Senate Roll Call #${roll}`;
      let voteDate = dateMatch?.[1] ? new Date(dateMatch[1].replace(/,\s*\d{1,2}:\d{2}\s*(AM|PM)/i, "")) : new Date(`${sess.year}-06-01`);
      if (isNaN(voteDate.getTime())) voteDate = new Date(`${sess.year}-06-01`);

      // Find Kelly's vote in the XML
      const memberRegex = /<member>\s*<member_full>[^<]*<\/member_full>\s*<last_name>([^<]+)<\/last_name>\s*<first_name>([^<]+)<\/first_name>\s*<party>[^<]*<\/party>\s*<state>[^<]*<\/state>\s*<vote_cast>([^<]+)<\/vote_cast>\s*<lis_member_id>[^<]*<\/lis_member_id>\s*<\/member>/g;
      let m;
      let kellyVote = null;
      while ((m = memberRegex.exec(xml)) !== null) {
        if (m[1].toLowerCase() === kellyLast.toLowerCase()) {
          const xmlFirst = m[2].toLowerCase();
          if (xmlFirst.startsWith(kellyFirst.toLowerCase().slice(0, 3)) ||
              kellyFirst.toLowerCase().startsWith(xmlFirst.slice(0, 3))) {
            kellyVote = m[3].trim();
            break;
          }
        }
      }

      if (!kellyVote) continue;

      // Upsert bill
      const dbBill = await prisma.bill.upsert({
        where: { billNumber_country: { billNumber: billNum, country: "US" } },
        update: { title, session: `${sess.congress}th Congress`, dateVoted: voteDate },
        create: {
          title, summary: title, billNumber: billNum, category: "Other",
          country: "US", session: `${sess.congress}th Congress`, dateVoted: voteDate,
          sourceUrl: `https://www.senate.gov/legislative/LIS/roll_call_votes/vote${sess.congress}${sess.session}/vote_${sess.congress}_${sess.session}_${padded}.htm`,
        },
      });
      sessionBills++;

      // Upsert vote
      try {
        await prisma.vote.upsert({
          where: { politicianId_billId: { politicianId: kelly.id, billId: dbBill.id } },
          update: { position: mapPos(kellyVote) },
          create: { politicianId: kelly.id, billId: dbBill.id, position: mapPos(kellyVote) },
        });
        sessionVotes++;
      } catch (e) {
        console.log(`  Error on roll ${roll}:`, e.message);
      }

      if (sessionBills % 25 === 0) {
        process.stdout.write(`  Progress: ${sessionBills} bills, ${sessionVotes} votes (roll ${roll})\n`);
      }
    }

    console.log(`  Session result: ${sessionBills} bills, ${sessionVotes} votes`);
    totalBills += sessionBills;
    totalVotes += sessionVotes;
  }

  console.log(`\n=== TOTAL ===`);
  console.log(`Bills created/updated: ${totalBills}`);
  console.log(`Votes recorded: ${totalVotes}`);
  console.log(`Skipped (already existed): ${skipped}`);

  // Final count
  const finalCount = await prisma.vote.count({ where: { politicianId: kelly.id } });
  console.log(`Mark Kelly total votes in DB: ${finalCount}`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
