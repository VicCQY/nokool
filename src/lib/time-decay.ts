import { STANDARD_TERM_LENGTHS } from "./issue-weights";

export function getTermEnd(
  termStart: Date,
  termEnd: Date | null,
  branch: string,
  chamber: string | null,
): Date {
  if (termEnd) return new Date(termEnd);
  const start = new Date(termStart);
  const key = chamber || branch || "executive";
  const years = STANDARD_TERM_LENGTHS[key] || 4;
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + years);
  return end;
}

export function getTermProgress(
  termStart: Date,
  termEnd: Date | null,
  branch: string,
  chamber: string | null,
): number {
  const now = new Date();
  const start = new Date(termStart);
  const end = getTermEnd(termStart, termEnd, branch, chamber);

  const totalDuration = end.getTime() - start.getTime();
  const elapsed = now.getTime() - start.getTime();

  return Math.max(0, Math.min(1, elapsed / totalDuration));
}

/**
 * Per-promise progress: how much time has elapsed since the promise was made,
 * relative to its deadline.
 * If expectedMonths is set: deadline = dateMade + expectedMonths
 * If expectedMonths is null: deadline = termEnd (full term fallback)
 * promiseProgress = (now - dateMade) / (deadline - dateMade), capped at 1.0
 */
export function getPromiseProgress(
  dateMade: Date,
  termEnd: Date,
  expectedMonths?: number | null,
): number {
  const now = new Date();
  const made = new Date(dateMade);

  let deadline: Date;
  if (expectedMonths != null && expectedMonths > 0) {
    deadline = new Date(made);
    deadline.setMonth(deadline.getMonth() + expectedMonths);
  } else {
    deadline = new Date(termEnd);
  }

  // If promise was made after deadline (shouldn't happen), no penalty
  if (made.getTime() >= deadline.getTime()) return 0;

  const totalDuration = deadline.getTime() - made.getTime();
  const elapsed = now.getTime() - made.getTime();

  return Math.max(0, Math.min(1, elapsed / totalDuration));
}

export function getTimeAdjustedStatusValue(
  status: string,
  termProgress: number,
): number {
  switch (status) {
    case "FULFILLED":
      return 1.0;
    case "PARTIAL":
      return 0.5;
    case "BROKEN":
      return -1.0;
    case "IN_PROGRESS":
      // Day 1: 0.5, Midterm: ~0.35, Year 3/4: ~0.15, Final months: ~0.05
      return 0.5 * (1 - Math.pow(termProgress, 1.5));
    case "NOT_STARTED":
      // Day 1: 0.1, Midterm: ~-0.1, Year 3/4: ~-0.4, Final months: ~-0.75
      return 0.1 - 0.85 * Math.pow(termProgress, 1.2);
    default:
      return 0;
  }
}
