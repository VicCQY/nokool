import { ISSUE_WEIGHTS, SEVERITY_LABELS } from "./issue-weights";
import { getTermEnd, getTermProgress, getPromiseProgress, getTimeAdjustedStatusValue } from "./time-decay";

export interface WeightedGradeResult {
  percent: number;
  letter: string;
  rawScore: number;
  maxScore: number;
  termProgress: number;
}

export interface PromiseForGrade {
  status: string;
  category: string;
  weight: number;
  dateMade: Date;
  expectedMonths?: number | null;
}

export function calculateWeightedGrade(
  promises: PromiseForGrade[],
  termStart: Date,
  termEnd: Date | null,
  branch: string,
  chamber: string | null,
  issueWeightsFromDb?: Record<string, number>,
): WeightedGradeResult {
  if (promises.length === 0)
    return { percent: 0, letter: "N/A", rawScore: 0, maxScore: 0, termProgress: 0 };

  const termProgress = getTermProgress(termStart, termEnd, branch, chamber);
  const resolvedTermEnd = getTermEnd(termStart, termEnd, branch, chamber);
  const weights = issueWeightsFromDb || ISSUE_WEIGHTS;

  let totalWeightedScore = 0;
  let totalMaxWeight = 0;

  for (const promise of promises) {
    const severity = promise.weight || 3;
    const issueWeight = weights[promise.category] || 1.0;
    // Per-promise time decay based on when the promise was made
    const promiseProgress = getPromiseProgress(promise.dateMade, resolvedTermEnd, promise.expectedMonths);
    const statusValue = getTimeAdjustedStatusValue(promise.status, promiseProgress);
    const combinedWeight = severity * issueWeight;

    totalWeightedScore += combinedWeight * statusValue;
    totalMaxWeight += combinedWeight;
  }

  // percent = rawScore / maxScore * 100
  // All FULFILLED = 100%, All NOT_STARTED day 1 ~10%, All BROKEN = -100% clamped to 0%
  const rawPercent = totalMaxWeight > 0
    ? (totalWeightedScore / totalMaxWeight) * 100
    : 0;

  const clampedPercent = Math.max(0, Math.min(100, rawPercent));

  // Dynamic thresholds: lenient early in term, strict at end
  // Linear interpolation between early and late thresholds
  const t = termProgress; // 0 = start, 1 = end
  const thresholds = {
    A: 40 + t * 40,   // 40% → 80%
    B: 30 + t * 35,   // 30% → 65%
    C: 20 + t * 30,   // 20% → 50%
    D: 10 + t * 25,   // 10% → 35%
  };

  let letter: string;
  if (clampedPercent >= thresholds.A) letter = "A";
  else if (clampedPercent >= thresholds.B) letter = "B";
  else if (clampedPercent >= thresholds.C) letter = "C";
  else if (clampedPercent >= thresholds.D) letter = "D";
  else letter = "F";

  return {
    percent: Math.round(clampedPercent * 10) / 10,
    letter,
    rawScore: totalWeightedScore,
    maxScore: totalMaxWeight,
    termProgress,
  };
}

export { SEVERITY_LABELS };
