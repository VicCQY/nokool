import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

// Load .env manually since dotenv v17 changed behavior
const envPath = path.resolve(process.cwd(), ".env");
const envContent = fs.readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  if (!process.env[key]) process.env[key] = val;
}

const prisma = new PrismaClient();

async function main() {
  // Remove duplicate Trump (the one without congressId)
  const dupes = await prisma.politician.findMany({
    where: { name: "Donald Trump", congressId: null },
  });
  for (const d of dupes) {
    await prisma.politician.delete({ where: { id: d.id } });
    console.log(`Deleted duplicate Trump: ${d.id}`);
  }

  // Verify
  const pols = await prisma.politician.findMany({
    select: { name: true, congressId: true, branch: true, chamber: true },
  });
  console.log("\nPoliticians:", JSON.stringify(pols, null, 2));

  // Now sync votes using the Congress API
  console.log("\n--- Syncing 118th Congress votes (30 bills) ---\n");

  const API_KEY = process.env.CONGRESS_API_KEY;
  if (!API_KEY) {
    console.error("CONGRESS_API_KEY not set!");
    return;
  }

  const BASE = "https://api.congress.gov/v3";

  async function fetchJson(url: string) {
    const sep = url.includes("?") ? "&" : "?";
    const fullUrl = `${url}${sep}api_key=${API_KEY}&format=json`;
    const res = await fetch(fullUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text().then(t => t.slice(0, 200))}`);
    return res.json();
  }

  function delay(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function stripHtml(html: string) {
    return html.replace(/<[^>]*>/g, "").trim();
  }

  function mapVotePosition(pos: string): "YEA" | "NAY" | "ABSTAIN" | "ABSENT" {
    const p = pos.toLowerCase();
    if (p === "yea" || p === "aye" || p === "yes") return "YEA";
    if (p === "nay" || p === "no") return "NAY";
    if (p === "not voting") return "ABSENT";
    if (p === "present") return "ABSTAIN";
    return "ABSENT";
  }

  const POLICY_MAP: Record<string, string> = {
    "Economics and Public Finance": "Economy",
    "Taxation": "Economy",
    "Finance and Financial Sector": "Economy",
    "Commerce": "Economy",
    "Health": "Healthcare",
    "Environmental Protection": "Environment",
    "Energy": "Environment",
    "Public Lands and Natural Resources": "Environment",
    "Immigration": "Immigration",
    "Education": "Education",
    "Transportation and Public Works": "Infrastructure",
    "Water Resources Development": "Infrastructure",
    "International Affairs": "Foreign Policy",
    "Armed Forces and National Security": "Foreign Policy",
    "Crime and Law Enforcement": "Justice",
    "Civil Rights and Liberties, Minority Issues": "Justice",
    "Housing and Community Development": "Housing",
    "Science, Technology, Communications": "Technology",
  };

  const TYPE_MAP: Record<string, string> = {
    HR: "H.R.", S: "S.", HJRES: "H.J.Res.", SJRES: "S.J.Res.",
    HCONRES: "H.Con.Res.", SCONRES: "S.Con.Res.", HRES: "H.Res.", SRES: "S.Res.",
  };

  // Get congressId -> politicianId map
  const matched = await prisma.politician.findMany({
    where: { country: "US", congressId: { not: null } },
    select: { id: true, congressId: true, name: true },
  });
  const idMap = new Map(matched.filter(p => p.congressId && !p.congressId.startsWith("trump")).map(p => [p.congressId!, p.id]));
  console.log(`Matched politicians for vote sync: ${idMap.size}`);

  // Fetch House bills from 118th Congress — multiple pages for more coverage
  const allBills: any[] = [];
  for (let offset = 0; offset < 500; offset += 50) {
    const data = await fetchJson(`${BASE}/bill/118/hr?sort=updateDate+desc&limit=50&offset=${offset}`);
    const batch = data.bills || [];
    allBills.push(...batch);
    if (batch.length < 50) break;
    await delay(500);
  }
  const bills = allBills;
  console.log(`Fetched ${bills.length} House bills from 118th Congress`);

  let billsSynced = 0;
  let votesSynced = 0;
  let massieVotes = 0;
  const massieExamples: { bill: string; position: string }[] = [];

  for (const bill of bills) {
    if (billsSynced >= 50) break;

    try {
      await delay(500);
      const billType = bill.type.toLowerCase();
      const billNumber = bill.number;

      // Get actions
      const actionsData = await fetchJson(`${BASE}/bill/118/${billType}/${billNumber}/actions?limit=100`);
      const actions = actionsData.actions || [];
      await delay(500);

      const rollCalls = actions.filter((a: any) => a.recordedVotes && a.recordedVotes.length > 0);
      if (rollCalls.length === 0) continue;

      // Get bill detail for policy area
      let policyArea: string | undefined;
      try {
        const detail = await fetchJson(`${BASE}/bill/118/${billType}/${billNumber}`);
        policyArea = detail?.bill?.policyArea?.name;
        await delay(500);
      } catch {}

      // Get summary
      let summary = bill.title;
      try {
        const sumData = await fetchJson(`${BASE}/bill/118/${billType}/${billNumber}/summaries`);
        const sums = sumData.summaries || [];
        if (sums.length > 0) {
          const sorted = sums.sort((a: any, b: any) => (a.text?.length || 0) - (b.text?.length || 0));
          if (sorted[0]?.text) summary = stripHtml(sorted[0].text).slice(0, 2000);
        }
        await delay(500);
      } catch {}

      const formattedNum = `${TYPE_MAP[bill.type.toUpperCase()] || bill.type}${bill.number}`;
      const category = POLICY_MAP[policyArea || ""] || "Other";
      const firstRoll = rollCalls[0];
      const voteDate = firstRoll.recordedVotes?.[0]?.date
        ? new Date(firstRoll.recordedVotes[0].date)
        : new Date(firstRoll.actionDate);

      const dbBill = await prisma.bill.upsert({
        where: { billNumber_country: { billNumber: formattedNum, country: "US" } },
        update: { title: bill.title, summary, category, session: "118th Congress", dateVoted: voteDate },
        create: {
          title: bill.title, summary, billNumber: formattedNum, category,
          country: "US", session: "118th Congress", dateVoted: voteDate,
          sourceUrl: `https://www.congress.gov/bill/118th-congress/${billType === "hr" ? "house-bill" : "senate-bill"}/${billNumber}`,
        },
      });

      billsSynced++;
      console.log(`  [${billsSynced}] ${formattedNum}: ${bill.title.slice(0, 60)}...`);

      // Deduplicate roll call votes (same roll call can appear in multiple actions)
      const seenUrls = new Set<string>();
      const uniqueVotes: { url: string; chamber: string; rollNumber: number }[] = [];
      for (const action of rollCalls) {
        for (const rv of action.recordedVotes || []) {
          if (rv.url && !seenUrls.has(rv.url)) {
            seenUrls.add(rv.url);
            uniqueVotes.push(rv);
          }
        }
      }

      // Process roll call votes via House/Senate Clerk XML
      for (const rv of uniqueVotes) {
          try {
            await delay(500);
            // The url field points to the clerk XML (e.g., https://clerk.house.gov/evs/2024/roll345.xml)
            const xmlUrl = rv.url;
            if (!xmlUrl) continue;

            const xmlRes = await fetch(xmlUrl);
            if (!xmlRes.ok) {
              console.log(`    Warning: Failed to fetch ${xmlUrl}: ${xmlRes.status}`);
              continue;
            }
            const xml = await xmlRes.text();

            // Parse XML to extract votes — find all <recorded-vote> entries
            const voteRegex = /<legislator[^>]+name-id="([^"]+)"[^>]*>[^<]*<\/legislator><vote>([^<]+)<\/vote>/g;
            let match;
            while ((match = voteRegex.exec(xml)) !== null) {
              const bioguideId = match[1];
              const voteText = match[2];

              const politicianId = idMap.get(bioguideId);
              if (!politicianId) continue;

              const position = mapVotePosition(voteText);
              try {
                await prisma.vote.upsert({
                  where: { politicianId_billId: { politicianId, billId: dbBill.id } },
                  update: { position },
                  create: { politicianId, billId: dbBill.id, position },
                });
                votesSynced++;

                if (bioguideId === "M001184") {
                  massieVotes++;
                  if (massieExamples.length < 10) {
                    massieExamples.push({ bill: `${formattedNum} (${bill.title.slice(0, 40)})`, position });
                  }
                }
              } catch {}
            }
          } catch (err: any) {
            console.log(`    Warning: Failed roll call ${rv.chamber} #${rv.rollNumber}: ${err.message?.slice(0, 80)}`);
          }
      }
    } catch (err: any) {
      console.log(`  Skipped ${bill.type}${bill.number}: ${err.message?.slice(0, 80)}`);
    }
  }

  console.log(`\n=== SYNC SUMMARY ===`);
  console.log(`Bills synced: ${billsSynced}`);
  console.log(`Total votes recorded: ${votesSynced}`);
  console.log(`Massie votes: ${massieVotes}`);
  console.log(`\nMassie's positions:`);
  for (const ex of massieExamples) {
    console.log(`  ${ex.bill}: ${ex.position}`);
  }

  // Final DB counts
  const totalBills = await prisma.bill.count();
  const totalVotes = await prisma.vote.count();
  const massieDbVotes = await prisma.vote.count({
    where: { politician: { congressId: "M001184" } },
  });
  console.log(`\nDB totals: ${totalBills} bills, ${totalVotes} votes, ${massieDbVotes} Massie votes`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
