// Recalculate PES scores for all promises
// Run: node scripts/recalculate-all-scores.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const PASSAGE_PATTERN = /\bsigned into law\b|\benacted\b|\bbecame law\b|\bpassed into law\b/i;

function getStatusLabel(score) {
  if (score >= 90) return "FULFILLED";
  if (score >= 70) return "PARTIAL";
  if (score >= 45) return "ADVANCING";
  if (score >= 15) return "IN_PROGRESS";
  if (score > 0) return "MINIMAL_EFFORT";
  if (score === 0) return "NOT_STARTED";
  return "BROKEN";
}

async function calculateScore(promise, politicianId, branch) {
  const scoredEvents = [];

  // Check for passage
  const passageEvent = promise.events.find(
    (e) => e.eventType === "legislation" && PASSAGE_PATTERN.test(e.title)
  );
  if (passageEvent) {
    return { score: 100, label: "FULFILLED" };
  }

  // Score legislation events
  let introCount = 0;
  let cosponCount = 0;

  for (const evt of promise.events) {
    if (evt.eventType !== "legislation" && evt.eventType !== "executive_action") continue;
    const rel = evt.relevanceScore ?? 1.0;

    if (evt.eventType === "executive_action") {
      const isEO = /\bexecutive order\b/i.test(evt.title);
      const rawPts = isEO ? 30 : 15;
      scoredEvents.push(Math.round(rawPts * rel));
      continue;
    }

    const isIntro = /\bIntroduced\b/i.test(evt.title);
    const isCosponsor = /\bCo-sponsored\b/i.test(evt.title);
    const passedCommittee = /\bpassed committee\b/i.test(evt.title);
    const passedChamber = /\bpassed House\b|\bpassed Senate\b/i.test(evt.title);

    if (isIntro) {
      introCount++;
      scoredEvents.push(Math.round((introCount === 1 ? 25 : 15) * rel));
    } else if (isCosponsor) {
      cosponCount++;
      scoredEvents.push(Math.round((cosponCount === 1 ? 10 : 5) * rel));
    } else {
      introCount++;
      scoredEvents.push(Math.round((introCount === 1 ? 25 : 15) * rel));
    }

    if (passedCommittee) scoredEvents.push(Math.round(10 * rel));
    if (passedChamber) scoredEvents.push(Math.round(15 * rel));
  }

  // Score bill votes
  for (const link of promise.billLinks) {
    const rel = link.relevanceScore ?? 0.5;
    const alignment = link.alignment || "aligns";
    const vote = link.bill.votes.find((v) => v.politicianId === politicianId);
    if (!vote) continue;

    let rawPts = 0;
    if (vote.position === "YEA") {
      rawPts = alignment === "aligns" ? 5 : -30;
    } else if (vote.position === "NAY") {
      rawPts = alignment === "aligns" ? -30 : 5;
    }
    if (rawPts !== 0) scoredEvents.push(Math.round(rawPts * rel));
  }

  // Score executive action links
  for (const link of promise.actionLinks) {
    const rel = link.relevanceScore ?? 0.5;
    const alignment = link.alignment || "supports";

    if (link.action.type === "BILL_SIGNED") {
      return { score: 100, label: "FULFILLED" };
    }

    const isEO = link.action.type === "EXECUTIVE_ORDER";
    const baseRaw = isEO ? 30 : 15;
    const rawPts = alignment === "supports" ? baseRaw : -baseRaw;
    scoredEvents.push(Math.round(rawPts * rel));
  }

  const rawTotal = scoredEvents.reduce((s, pts) => s + pts, 0);
  const score = Math.min(100, Math.max(-50, rawTotal));
  return { score, label: getStatusLabel(score) };
}

async function main() {
  const promises = await prisma.promise.findMany({
    include: {
      politician: { select: { branch: true } },
      events: {
        where: { approved: true },
        select: { eventType: true, title: true, relevanceScore: true },
        orderBy: { eventDate: "asc" },
      },
      billLinks: {
        select: {
          relevanceScore: true,
          alignment: true,
          bill: {
            select: {
              title: true,
              votes: { select: { position: true, politicianId: true } },
            },
          },
        },
      },
      actionLinks: {
        select: {
          relevanceScore: true,
          alignment: true,
          action: { select: { title: true, type: true } },
        },
      },
    },
  });

  console.log(`Recalculating ${promises.length} promises...`);

  let changed = 0;
  const results = [];

  for (const p of promises) {
    const { score, label } = await calculateScore(
      p,
      p.politicianId,
      p.politician.branch
    );
    const finalStatus = p.statusOverride || label;
    const oldScore = p.score;

    if (score !== oldScore || p.status !== finalStatus) {
      await prisma.promise.update({
        where: { id: p.id },
        data: { score, status: finalStatus },
      });
      changed++;
    }

    results.push({
      title: p.title.slice(0, 50),
      oldScore,
      newScore: score,
      status: finalStatus,
      events: p.events.length,
      billLinks: p.billLinks.length,
      actionLinks: p.actionLinks.length,
    });
  }

  // Print summary
  console.log(`\nDone. ${changed} of ${promises.length} changed.\n`);

  // Group by politician
  const byPol = {};
  for (const p of promises) {
    const key = p.politicianId;
    if (!byPol[key]) byPol[key] = { name: null, promises: [] };
    byPol[key].promises.push(p);
  }

  // Print top-level stats
  const scores = results.map((r) => r.newScore);
  console.log(`Score range: ${Math.min(...scores)} to ${Math.max(...scores)}`);
  console.log(
    `Status distribution:`,
    results.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {})
  );

  // Print changed ones
  const changedResults = results.filter((r) => r.oldScore !== r.newScore);
  if (changedResults.length > 0) {
    console.log(`\nChanged promises:`);
    for (const r of changedResults) {
      console.log(`  ${r.title}: ${r.oldScore} → ${r.newScore} (${r.status})`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
