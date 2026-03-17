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

  // Normalize raw score from [-0.5, 1.0] range to [0, 100]
  // rawScore/maxScore gives the weighted average status value
  // Min possible = -0.5 (all BROKEN), Max possible = 1.0 (all FULFILLED)
  const rawAvg = totalMaxWeight > 0
    ? totalWeightedScore / totalMaxWeight
    : 0;

  const normalizedPercent = ((rawAvg + 0.5) / 1.5) * 100;
  const clampedPercent = Math.max(0, Math.min(100, normalizedPercent));

  // Fixed grade thresholds
  let letter: string;
  if (clampedPercent >= 75) letter = "A";
  else if (clampedPercent >= 60) letter = "B";
  else if (clampedPercent >= 45) letter = "C";
  else if (clampedPercent >= 30) letter = "D";
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
