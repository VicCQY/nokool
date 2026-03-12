import { prisma } from "@/lib/prisma";
import {
  listBills,
  getBillActions,
  getBillSummaries,
  getBillDetail,
  getRollCallVote,
  fetchAllCurrentMembers,
  delay,
} from "@/lib/congress-api";
import { mapPolicyAreaToCategory } from "@/lib/congress-categories";

// ── Member Matching ──

export interface MatchResult {
  matched: { name: string; congressId: string }[];
  unmatched: string[];
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function matchMembers(): Promise<MatchResult> {
  const members = await fetchAllCurrentMembers();

  const usPoliticians = await prisma.politician.findMany({
    where: { country: "US" },
    select: { id: true, name: true, congressId: true },
  });

  const matched: { name: string; congressId: string }[] = [];
  const unmatchedPoliticians: string[] = [];

  for (const pol of usPoliticians) {
    if (pol.congressId) {
      matched.push({ name: pol.name, congressId: pol.congressId });
      continue;
    }

    const polNorm = normalizeName(pol.name);
    const polParts = polNorm.split(" ");
    const polFirst = polParts[0];
    const polLast = polParts[polParts.length - 1];

    let bestMatch: (typeof members)[0] | null = null;

    for (const m of members) {
      // Congress API sometimes returns name as "LastName, FirstName"
      // or has separate firstName/lastName fields
      const mLastNorm = normalizeName(m.lastName || "");
      const mFirstNorm = normalizeName(m.firstName || "");
      const mFullNorm = normalizeName(m.name || "");

      // Match: last name matches AND first name starts with same letters
      if (
        mLastNorm === polLast &&
        (mFirstNorm.startsWith(polFirst) || polFirst.startsWith(mFirstNorm))
      ) {
        bestMatch = m;
        break;
      }

      // Fallback: full name contains both parts
      if (mFullNorm.includes(polLast) && mFullNorm.includes(polFirst)) {
        bestMatch = m;
        break;
      }
    }

    if (bestMatch) {
      await prisma.politician.update({
        where: { id: pol.id },
        data: { congressId: bestMatch.bioguideId },
      });
      matched.push({ name: pol.name, congressId: bestMatch.bioguideId });
    } else {
      unmatchedPoliticians.push(pol.name);
    }
  }

  return { matched, unmatched: unmatchedPoliticians };
}

// ── Vote Sync ──

export interface SyncResult {
  billsSynced: number;
  votesSynced: number;
  billsSkipped: number;
  errors: string[];
}

function formatBillNumber(type: string, number: number): string {
  const typeMap: Record<string, string> = {
    HR: "H.R.",
    S: "S.",
    HJRES: "H.J.Res.",
    SJRES: "S.J.Res.",
    HCONRES: "H.Con.Res.",
    SCONRES: "S.Con.Res.",
    HRES: "H.Res.",
    SRES: "S.Res.",
  };
  const prefix = typeMap[type.toUpperCase()] || type;
  return `${prefix}${number}`;
}

function mapVotePosition(
  position: string
): "YEA" | "NAY" | "ABSTAIN" | "ABSENT" {
  const p = position.toLowerCase();
  if (p === "yea" || p === "aye" || p === "yes") return "YEA";
  if (p === "nay" || p === "no") return "NAY";
  if (p === "not voting") return "ABSENT";
  if (p === "present") return "ABSTAIN";
  return "ABSENT";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

export async function syncCongressVotes(
  congress: number,
  limit: number
): Promise<SyncResult> {
  const result: SyncResult = {
    billsSynced: 0,
    votesSynced: 0,
    billsSkipped: 0,
    errors: [],
  };

  // Build a lookup of congressId -> politicianId
  const politicians = await prisma.politician.findMany({
    where: { country: "US", congressId: { not: null } },
    select: { id: true, congressId: true },
  });
  const congressIdToPolId = new Map(
    politicians.map((p) => [p.congressId!, p.id])
  );

  if (congressIdToPolId.size === 0) {
    result.errors.push(
      "No US politicians have congressId mapped. Run 'Match Members' first."
    );
    return result;
  }

  // Fetch bills
  let bills;
  try {
    const data = await listBills(congress, limit);
    bills = data.bills;
  } catch (err) {
    result.errors.push(
      `Failed to fetch bills: ${err instanceof Error ? err.message : String(err)}`
    );
    return result;
  }

  for (const bill of bills) {
    try {
      await delay(500);

      const billType = bill.type.toLowerCase();
      const billNumber = bill.number;

      // Get actions to find roll call votes
      const actions = await getBillActions(congress, billType, billNumber);
      await delay(500);

      const rollCallActions = actions.filter(
        (a) => a.recordedVotes && a.recordedVotes.length > 0
      );

      if (rollCallActions.length === 0) {
        result.billsSkipped++;
        continue;
      }

      // Get bill detail for policy area
      let policyArea: string | undefined;
      try {
        const detail = await getBillDetail(congress, billType, billNumber);
        policyArea = detail?.policyArea?.name;
        await delay(500);
      } catch {
        // Non-critical, continue without policy area
      }

      // Get summary
      let summary = bill.title;
      try {
        const summaries = await getBillSummaries(
          congress,
          billType,
          billNumber
        );
        if (summaries.length > 0) {
          // Use the shortest summary available
          const sorted = summaries.sort(
            (a: { text: string }, b: { text: string }) =>
              (a.text?.length || 0) - (b.text?.length || 0)
          );
          const rawSummary = sorted[0]?.text;
          if (rawSummary) {
            summary = stripHtml(rawSummary).slice(0, 2000);
          }
        }
        await delay(500);
      } catch {
        // Non-critical, use title as summary
      }

      const formattedBillNumber = formatBillNumber(bill.type, bill.number);
      const category = mapPolicyAreaToCategory(policyArea);

      // Use the first roll call vote's date
      const firstRollCall = rollCallActions[0];
      const voteDate = firstRollCall.recordedVotes?.[0]?.date
        ? new Date(firstRollCall.recordedVotes[0].date)
        : new Date(firstRollCall.actionDate);

      // Upsert bill
      const dbBill = await prisma.bill.upsert({
        where: {
          billNumber_country: {
            billNumber: formattedBillNumber,
            country: "US",
          },
        },
        update: {
          title: bill.title,
          summary,
          category,
          session: `${congress}th Congress`,
          dateVoted: voteDate,
          sourceUrl: `https://www.congress.gov/bill/${congress}th-congress/${billType === "hr" ? "house-bill" : billType === "s" ? "senate-bill" : billType + "-bill"}/${billNumber}`,
        },
        create: {
          title: bill.title,
          summary,
          billNumber: formattedBillNumber,
          category,
          country: "US",
          session: `${congress}th Congress`,
          dateVoted: voteDate,
          sourceUrl: `https://www.congress.gov/bill/${congress}th-congress/${billType === "hr" ? "house-bill" : billType === "s" ? "senate-bill" : billType + "-bill"}/${billNumber}`,
        },
      });

      result.billsSynced++;

      // Process each roll call vote on this bill
      for (const action of rollCallActions) {
        for (const rv of action.recordedVotes || []) {
          try {
            await delay(500);
            const voteData = await getRollCallVote(
              rv.congress,
              rv.chamber,
              rv.sessionNumber,
              rv.rollNumber
            );

            if (!voteData?.positions) continue;

            for (const pos of voteData.positions) {
              const bioguideId = pos.member?.bioguideId;
              if (!bioguideId) continue;

              const politicianId = congressIdToPolId.get(bioguideId);
              if (!politicianId) continue;

              try {
                await prisma.vote.upsert({
                  where: {
                    politicianId_billId: {
                      politicianId,
                      billId: dbBill.id,
                    },
                  },
                  update: {
                    position: mapVotePosition(pos.votePosition || "Not Voting"),
                  },
                  create: {
                    politicianId,
                    billId: dbBill.id,
                    position: mapVotePosition(pos.votePosition || "Not Voting"),
                  },
                });
                result.votesSynced++;
              } catch {
                // Skip individual vote errors (e.g., constraint issues)
              }
            }
          } catch (err) {
            result.errors.push(
              `Failed to fetch roll call ${rv.chamber} #${rv.rollNumber}: ${err instanceof Error ? err.message : String(err)}`
            );
          }
        }
      }
    } catch (err) {
      result.errors.push(
        `Error processing bill ${bill.type}${bill.number}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return result;
}
