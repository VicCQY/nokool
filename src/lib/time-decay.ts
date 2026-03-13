import { STANDARD_TERM_LENGTHS } from "./issue-weights";

export function getTermProgress(
  termStart: Date,
  termEnd: Date | null,
  branch: string,
  chamber: string | null,
): number {
  const now = new Date();
  const start = new Date(termStart);

  let end: Date;
  if (termEnd) {
    end = new Date(termEnd);
  } else {
    const key = chamber || branch || "executive";
    const years = STANDARD_TERM_LENGTHS[key] || 4;
    end = new Date(start);
    end.setFullYear(end.getFullYear() + years);
  }

  const totalDuration = end.getTime() - start.getTime();
  const elapsed = now.getTime() - start.getTime();

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
