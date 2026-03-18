import { prisma } from "./prisma";
import { PromiseStatus } from "@prisma/client";

/**
 * Deterministic status calculation from event counts.
 * Status is NEVER assigned by AI — it's purely derived from counting events.
 */

export interface StatusCalculation {
  status: PromiseStatus;
  reason: string;
}

/**
 * Calculate status for a LEGISLATIVE promise (senator/representative).
 *
 * Event types counted:
 * - bill_vote (from PromiseBillLinks) — supporting votes
 * - legislation (from AI research) — bill introductions
 * - "signed into law" / "enacted" / "became law" in title → passed
 */
function calculateLegislativeStatus(events: { eventType: string; title: string }[]): StatusCalculation {
  const votes = events.filter((e) => e.eventType === "bill_vote");
  const opposingVotes = votes.filter((e) =>
    /\bvoted against\b/i.test(e.title) || /\bopposed\b/i.test(e.title) || /\bcontradicts\b/i.test(e.title),
  );
  const introductions = events.filter((e) => e.eventType === "legislation");
  const passed = events.filter((e) =>
    /\bsigned into law\b/i.test(e.title) || /\benacted\b/i.test(e.title) || /\bbecame law\b/i.test(e.title),
  );

  // Evaluated in this EXACT order — first match wins
  if (passed.length > 0) {
    return { status: "FULFILLED", reason: `Passed into law: ${passed[0].title}` };
  }

  if (opposingVotes.length > 0 && votes.length === opposingVotes.length && introductions.length === 0) {
    return { status: "BROKEN", reason: `Voted against own promise: ${opposingVotes[0].title}` };
  }

  if (introductions.length >= 3) {
    return { status: "PARTIAL", reason: `${introductions.length} bill introductions` };
  }

  if (introductions.length >= 1) {
    return { status: "ADVANCING", reason: `${introductions.length} bill introduction(s)` };
  }

  if (votes.length >= 1) {
    return { status: "IN_PROGRESS", reason: `${votes.length} supporting vote(s)` };
  }

  return { status: "NOT_STARTED", reason: "No events" };
}

/**
 * Calculate status for an EXECUTIVE promise (president/VP).
 *
 * Event types counted:
 * - executive_action (from AI research or PromiseActionLinks)
 * - "signed into law" in title → FULFILLED
 */
function calculateExecutiveStatus(events: { eventType: string; title: string }[]): StatusCalculation {
  const execActions = events.filter((e) => e.eventType === "executive_action");
  const votes = events.filter((e) => e.eventType === "bill_vote");
  const signedIntoLaw = events.filter((e) =>
    /\bsigned into law\b/i.test(e.title) || /\benacted\b/i.test(e.title) || /\bbecame law\b/i.test(e.title),
  );

  // Evaluated in this EXACT order — first match wins
  if (signedIntoLaw.length > 0) {
    return { status: "FULFILLED", reason: `Signed into law: ${signedIntoLaw[0].title}` };
  }

  if (execActions.length >= 3) {
    return { status: "PARTIAL", reason: `${execActions.length} executive actions` };
  }

  if (execActions.length >= 1) {
    return { status: "ADVANCING", reason: `${execActions.length} executive action(s)` };
  }

  if (votes.length > 0) {
    return { status: "IN_PROGRESS", reason: `${votes.length} related vote(s)` };
  }

  return { status: "NOT_STARTED", reason: "No events" };
}

/**
 * Calculate status for a single promise based on its events and the politician's branch.
 */
export function calculateStatus(
  branch: string,
  events: { eventType: string; title: string }[],
): StatusCalculation {
  // Only count real events — not promise_made or research_note
  const relevant = events.filter((e) =>
    e.eventType === "bill_vote" || e.eventType === "legislation" || e.eventType === "executive_action",
  );

  if (branch === "executive") {
    return calculateExecutiveStatus(relevant);
  }
  return calculateLegislativeStatus(relevant);
}

/**
 * Recalculate and update a single promise's status from its events.
 * Respects statusOverride — if set, override wins.
 * Only updates promise.status — never creates events.
 */
export async function recalculatePromiseStatus(promiseId: string): Promise<PromiseStatus> {
  const promise = await prisma.promise.findUnique({
    where: { id: promiseId },
    select: {
      id: true,
      status: true,
      statusOverride: true,
      politician: { select: { branch: true } },
      events: {
        where: { approved: true },
        select: { eventType: true, title: true },
        orderBy: { eventDate: "asc" },
      },
    },
  });

  if (!promise) return "NOT_STARTED";

  // Admin override takes priority
  if (promise.statusOverride) {
    if (promise.status !== promise.statusOverride) {
      await prisma.promise.update({
        where: { id: promiseId },
        data: { status: promise.statusOverride },
      });
    }
    return promise.statusOverride;
  }

  const { status: calculatedStatus } = calculateStatus(promise.politician.branch, promise.events);

  if (promise.status !== calculatedStatus) {
    await prisma.promise.update({
      where: { id: promiseId },
      data: { status: calculatedStatus },
    });
    console.log(`[StatusCalc] "${promiseId}": ${promise.status} → ${calculatedStatus}`);
  }

  return calculatedStatus;
}

/**
 * Recalculate status for ALL promises of a politician.
 */
export async function recalculateAllForPolitician(politicianId: string): Promise<number> {
  const promises = await prisma.promise.findMany({
    where: { politicianId },
    select: { id: true },
  });

  let changed = 0;
  for (const p of promises) {
    const oldPromise = await prisma.promise.findUnique({ where: { id: p.id }, select: { status: true } });
    const newStatus = await recalculatePromiseStatus(p.id);
    if (oldPromise && oldPromise.status !== newStatus) changed++;
  }

  return changed;
}

/**
 * Recalculate status for ALL promises in the system.
 */
export async function recalculateAll(): Promise<{ total: number; changed: number }> {
  const promises = await prisma.promise.findMany({
    select: { id: true, status: true },
  });

  let changed = 0;
  for (const p of promises) {
    const newStatus = await recalculatePromiseStatus(p.id);
    if (p.status !== newStatus) changed++;
  }

  return { total: promises.length, changed };
}
