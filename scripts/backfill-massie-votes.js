const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const FETCH_DELAY = 250;
const BATCH_SIZE = 50;
const BATCH_PAUSE = 5000;
const MAX_RETRIES = 3;

const MASSIE_BIOGUIDE = "M001184";

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

// House roll call votes
// 117th Congress: 2021-2022, 118th Congress: 2023-2024
const SESSIONS = [
  { congress: 117, session: 1, year: 2021, maxRoll: 500 },
  { congress: 117, session: 2, year: 2022, maxRoll: 550 },
  { congress: 118, session: 1, year: 2023, maxRoll: 750 },
  { congress: 118, session: 2, year: 2024, maxRoll: 550 },
];

async function main() {
  const massie = await prisma.politician.findFirst({
    where: { congressId: MASSIE_BIOGUIDE },
    select: { id: true, name: true },
  });
  if (!massie) { console.log("Massie not found"); process.exit(1); }
  console.log("Found:", massie.name, massie.id);

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
      const billNum = `H.Vote.${sess.congress}.${sess.session}.${roll}`;

      // Check if we already have this bill with a vote from Massie
      const existing = await prisma.bill.findUnique({
        where: { billNumber_country: { billNumber: billNum, country: "US" } },
        select: { id: true, votes: { where: { politicianId: massie.id }, select: { id: true } } },
      });
      if (existing && existing.votes.length > 0) { skipped++; continue; }

      await delay(FETCH_DELAY);
      inBatch++;
      if (inBatch >= BATCH_SIZE) {
        inBatch = 0;
        await delay(BATCH_PAUSE);
        process.stdout.write(`  [batch pause at roll ${roll}]\n`);
      }

      // House roll call XML URL format
      const padded = String(roll).padStart(3, "0");
      const url = `https://clerk.house.gov/evs/${sess.year}/roll${padded}.xml`;
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

      // Parse vote question/title
      const questionMatch = xml.match(/<vote-question>([^<]*)<\/vote-question>/);
      const descMatch = xml.match(/<vote-desc>([^<]*)<\/vote-desc>/);
      const dateMatch = xml.match(/<action-date[^>]*>([^<]*)<\/action-date>/);
      const title = (questionMatch?.[1] || "") + (descMatch?.[1] ? ": " + descMatch[1] : "") || `House Roll Call #${roll}`;

      let voteDate;
      if (dateMatch?.[1]) {
        // Format: "21-Jan-2021" or similar
        voteDate = new Date(dateMatch[1]);
        if (isNaN(voteDate.getTime())) voteDate = new Date(`${sess.year}-06-01`);
      } else {
        voteDate = new Date(`${sess.year}-06-01`);
      }

      // Find Massie's vote by bioguide ID
      // House XML format: <recorded-vote><legislator ... name-id="M001184" ...>Massie</legislator><vote>Yea</vote></recorded-vote>
      const voteRegex = new RegExp(
        `<recorded-vote>\\s*<legislator[^>]*name-id="${MASSIE_BIOGUIDE}"[^>]*>[^<]*</legislator>\\s*<vote>([^<]+)</vote>\\s*</recorded-vote>`,
        "i"
      );
      const voteMatch = xml.match(voteRegex);
      if (!voteMatch) continue;

      const massieVote = voteMatch[1].trim();

      // Upsert bill
      const dbBill = await prisma.bill.upsert({
        where: { billNumber_country: { billNumber: billNum, country: "US" } },
        update: { title: title.slice(0, 500), session: `${sess.congress}th Congress`, dateVoted: voteDate },
        create: {
          title: title.slice(0, 500),
          summary: title.slice(0, 500),
          billNumber: billNum,
          category: "Other",
          country: "US",
          session: `${sess.congress}th Congress`,
          dateVoted: voteDate,
          sourceUrl: `https://clerk.house.gov/evs/${sess.year}/roll${padded}.xml`,
        },
      });
      sessionBills++;

      // Upsert vote
      try {
        await prisma.vote.upsert({
          where: { politicianId_billId: { politicianId: massie.id, billId: dbBill.id } },
          update: { position: mapPos(massieVote) },
          create: { politicianId: massie.id, billId: dbBill.id, position: mapPos(massieVote) },
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

  const finalCount = await prisma.vote.count({ where: { politicianId: massie.id } });
  console.log(`Thomas Massie total votes in DB: ${finalCount}`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
