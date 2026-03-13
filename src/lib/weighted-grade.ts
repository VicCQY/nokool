import { ISSUE_WEIGHTS, SEVERITY_LABELS } from "./issue-weights";
import { getTermProgress, getTimeAdjustedStatusValue } from "./time-decay";

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
  const weights = issueWeightsFromDb || ISSUE_WEIGHTS;

  let totalWeightedScore = 0;
  let totalMaxWeight = 0;

  for (const promise of promises) {
    const severity = promise.weight || 3;
    const issueWeight = weights[promise.category] || 1.0;
    const statusValue = getTimeAdjustedStatusValue(promise.status, termProgress);
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

  // Adjusted thresholds for weighted system
  let letter: string;
  if (clampedPercent >= 80) letter = "A";
  else if (clampedPercent >= 65) letter = "B";
  else if (clampedPercent >= 50) letter = "C";
  else if (clampedPercent >= 35) letter = "D";
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
