import { prisma } from "./prisma";
import { ISSUE_WEIGHTS } from "./issue-weights";

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

export interface ScoredEvent {
  source: string; // e.g. "legislation", "bill_vote", "executive_action"
  title: string;
  rawPoints: number;
  relevance: number;
  points: number; // rawPoints × relevance, rounded
}

export interface PromiseScoreResult {
  score: number;
  label: string;
  events: ScoredEvent[];
}

// ══════════════════════════════════════════════
// PASSAGE DETECTION
// ══════════════════════════════════════════════

const PASSAGE_PATTERN = /\bsigned into law\b|\benacted\b|\bbecame law\b|\bpassed into law\b/i;

// ══════════════════════════════════════════════
// STATUS LABEL FROM SCORE
// ══════════════════════════════════════════════

export function getStatusLabel(score: number): string {
  if (score >= 90) return "FULFILLED";
  if (score >= 70) return "PARTIAL";
  if (score >= 45) return "ADVANCING";
  if (score >= 15) return "IN_PROGRESS";
  if (score > 0) return "MINIMAL_EFFORT";
  if (score === 0) return "NOT_STARTED";
  return "BROKEN";
}

// ══════════════════════════════════════════════
// SCORE CALCULATION
// ══════════════════════════════════════════════

export async function calculatePromiseScore(promiseId: string): Promise<PromiseScoreResult> {
  const promise = await prisma.promise.findUnique({
    where: { id: promiseId },
    select: {
      id: true,
      statusOverride: true,
      politician: { select: { branch: true } },
      events: {
        where: { approved: true },
        select: {
          eventType: true,
          title: true,
          relevanceScore: true,
        },
        orderBy: { eventDate: "asc" },
      },
      billLinks: {
        select: {
          relevanceScore: true,
          alignment: true,
          bill: {
            select: {
              title: true,
              votes: {
                where: { politicianId: { not: undefined } },
                select: { position: true, politicianId: true },
              },
            },
          },
        },
      },
      actionLinks: {
        select: {
          relevanceScore: true,
          alignment: true,
          action: {
            select: { title: true, type: true },
          },
        },
      },
    },
  });

  if (!promise) return { score: 0, label: "NOT_STARTED", events: [] };

  const scoredEvents: ScoredEvent[] = [];

  // ── Check for INSTANT 100: passage in legislation events ──
  const passageEvent = promise.events.find(
    (e) => e.eventType === "legislation" && PASSAGE_PATTERN.test(e.title),
  );
  if (passageEvent) {
    scoredEvents.push({
      source: "legislation",
      title: passageEvent.title,
      rawPoints: 100,
      relevance: 1.0,
      points: 100,
    });
    return { score: 100, label: "FULFILLED", events: scoredEvents };
  }

  // ── Score legislation events (from AI research) ──
  let introductionCount = 0;
  let cosponsorshipCount = 0;

  for (const evt of promise.events) {
    if (evt.eventType !== "legislation" && evt.eventType !== "executive_action") continue;
    const rel = evt.relevanceScore ?? 1.0;

    if (evt.eventType === "executive_action") {
      // Executive actions
      const isEO = /\bexecutive order\b/i.test(evt.title);
      const rawPts = isEO ? 30 : 15;
      const pts = Math.round(rawPts * rel);
      scoredEvents.push({
        source: "executive_action",
        title: evt.title,
        rawPoints: rawPts,
        relevance: rel,
        points: pts,
      });
      continue;
    }

    // Legislation events
    const isIntroduction = /\bIntroduced\b/i.test(evt.title);
    const isCosponsorship = /\bCo-sponsored\b/i.test(evt.title);
    const passedCommittee = /\bpassed committee\b/i.test(evt.title);
    const passedChamber = /\bpassed House\b|\bpassed Senate\b/i.test(evt.title);

    if (isIntroduction) {
      introductionCount++;
      const rawPts = introductionCount === 1 ? 25 : 15;
      const pts = Math.round(rawPts * rel);
      scoredEvents.push({
        source: "legislation",
        title: evt.title,
        rawPoints: rawPts,
        relevance: rel,
        points: pts,
      });
    } else if (isCosponsorship) {
      cosponsorshipCount++;
      const rawPts = cosponsorshipCount === 1 ? 10 : 5;
      const pts = Math.round(rawPts * rel);
      scoredEvents.push({
        source: "legislation",
        title: evt.title,
        rawPoints: rawPts,
        relevance: rel,
        points: pts,
      });
    } else {
      // Unknown legislation event — treat as introduction
      introductionCount++;
      const rawPts = introductionCount === 1 ? 25 : 15;
      const pts = Math.round(rawPts * rel);
      scoredEvents.push({
        source: "legislation",
        title: evt.title,
        rawPoints: rawPts,
        relevance: rel,
        points: pts,
      });
    }

    // Bonus for committee/chamber passage
    if (passedCommittee) {
      scoredEvents.push({
        source: "legislation",
        title: `${evt.title} (committee passage)`,
        rawPoints: 10,
        relevance: rel,
        points: Math.round(10 * rel),
      });
    }
    if (passedChamber) {
      scoredEvents.push({
        source: "legislation",
        title: `${evt.title} (chamber passage)`,
        rawPoints: 15,
        relevance: rel,
        points: Math.round(15 * rel),
      });
    }
  }

  // ── Score bill votes (from PromiseBillLinks) ──
  // We need to get the politician's vote for each linked bill
  const politicianId = await prisma.promise.findUnique({
    where: { id: promiseId },
    select: { politicianId: true },
  });

  if (politicianId) {
    for (const link of promise.billLinks) {
      const rel = link.relevanceScore ?? 0.5;
      const alignment = link.alignment || "aligns";
      const vote = link.bill.votes.find((v) => v.politicianId === politicianId.politicianId);

      if (!vote) continue;

      let rawPts = 0;
      if (vote.position === "YEA") {
        rawPts = alignment === "aligns" ? 5 : -30;
      } else if (vote.position === "NAY") {
        rawPts = alignment === "aligns" ? -30 : 5;
      }
      // ABSENT/ABSTAIN = 0

      if (rawPts !== 0) {
        const pts = Math.round(rawPts * rel);
        scoredEvents.push({
          source: "bill_vote",
          title: `${vote.position === "YEA" ? "Voted YEA" : "Voted NAY"} on ${link.bill.title}`,
          rawPoints: rawPts,
          relevance: rel,
          points: pts,
        });
      }
    }
  }

  // ── Score executive action links ──
  for (const link of promise.actionLinks) {
    const rel = link.relevanceScore ?? 0.5;
    const alignment = link.alignment || "supports";

    // Check for bill signed into law
    if (link.action.type === "BILL_SIGNED") {
      scoredEvents.push({
        source: "executive_action",
        title: link.action.title,
        rawPoints: 100,
        relevance: 1.0,
        points: 100,
      });
      // Instant 100
      const totalScore = Math.min(100, Math.max(-50, scoredEvents.reduce((s, e) => s + e.points, 0)));
      return { score: totalScore, label: getStatusLabel(totalScore), events: scoredEvents };
    }

    const isEO = link.action.type === "EXECUTIVE_ORDER";
    const baseRaw = isEO ? 30 : 15;
    const rawPts = alignment === "supports" ? baseRaw : -baseRaw;
    const pts = Math.round(rawPts * rel);

    scoredEvents.push({
      source: "executive_action",
      title: link.action.title,
      rawPoints: rawPts,
      relevance: rel,
      points: pts,
    });
  }

  // ── Compute total ──
  const rawTotal = scoredEvents.reduce((s, e) => s + e.points, 0);
  const score = Math.min(100, Math.max(-50, rawTotal));
  const label = getStatusLabel(score);

  return { score, label, events: scoredEvents };
}

// ══════════════════════════════════════════════
// RECALCULATE AND PERSIST
// ══════════════════════════════════════════════

export async function recalculatePromiseScore(promiseId: string): Promise<PromiseScoreResult> {
  const promise = await prisma.promise.findUnique({
    where: { id: promiseId },
    select: { statusOverride: true },
  });

  const result = await calculatePromiseScore(promiseId);

  // If admin override is set, use that status but still store the calculated score
  const finalStatus = promise?.statusOverride || result.label;

  await prisma.promise.update({
    where: { id: promiseId },
    data: {
      score: result.score,
      status: finalStatus as never,
    },
  });

  return result;
}

export async function recalculateAllScoresForPolitician(politicianId: string): Promise<number> {
  const promises = await prisma.promise.findMany({
    where: { politicianId },
    select: { id: true, score: true },
  });

  let changed = 0;
  for (const p of promises) {
    const result = await recalculatePromiseScore(p.id);
    if (result.score !== p.score) changed++;
  }
  return changed;
}

export async function recalculateAllScores(): Promise<{ total: number; changed: number }> {
  const promises = await prisma.promise.findMany({
    select: { id: true, score: true },
  });

  let changed = 0;
  for (const p of promises) {
    const result = await recalculatePromiseScore(p.id);
    if (result.score !== p.score) changed++;
  }

  return { total: promises.length, changed };
}

// ══════════════════════════════════════════════
// GRADE CALCULATION (replaces weighted-grade)
// ══════════════════════════════════════════════

export interface GradeResult {
  percent: number;
  letter: string;
}

export function calculateGradeFromScores(
  promises: { score: number; weight: number; category: string }[],
  issueWeightsFromDb?: Record<string, number>,
): GradeResult {
  if (promises.length === 0) return { percent: 0, letter: "N/A" };

  const weights = issueWeightsFromDb || ISSUE_WEIGHTS;

  let numerator = 0;
  let denominator = 0;

  for (const p of promises) {
    const severity = p.weight || 3;
    const issueWeight = weights[p.category] || 1.0;
    const combinedWeight = severity * issueWeight;

    numerator += p.score * combinedWeight;
    denominator += 100 * combinedWeight;
  }

  const percent = denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
  const clamped = Math.max(0, Math.min(100, percent));

  let letter: string;
  if (clamped >= 80) letter = "A";
  else if (clamped >= 70) letter = "B";
  else if (clamped >= 60) letter = "C";
  else if (clamped >= 50) letter = "D";
  else letter = "F";

  return { percent: clamped, letter };
}

export function calculateCategoryScores(
  promises: { score: number; weight: number; category: string }[],
  issueWeightsFromDb?: Record<string, number>,
): Record<string, { percent: number; count: number }> {
  const byCategory: Record<string, { score: number; weight: number; category: string }[]> = {};

  for (const p of promises) {
    if (!byCategory[p.category]) byCategory[p.category] = [];
    byCategory[p.category].push(p);
  }

  const result: Record<string, { percent: number; count: number }> = {};
  for (const [cat, catPromises] of Object.entries(byCategory)) {
    const grade = calculateGradeFromScores(catPromises, issueWeightsFromDb);
    result[cat] = { percent: grade.percent, count: catPromises.length };
  }

  return result;
}
