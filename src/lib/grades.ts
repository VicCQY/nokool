import { ISSUE_WEIGHTS, STATUS_VALUES } from "./issue-weights";

interface PromiseRecord {
  status?: string;
  category?: string;
  weight?: number;
}

export function calculateFulfillment(
  promises: PromiseRecord[],
  _termInfo?: unknown,
  issueWeights?: Record<string, number>,
) {
  if (promises.length === 0) return { percentage: 0, grade: "N/A" };

  const weights = issueWeights || ISSUE_WEIGHTS;
  let numerator = 0;
  let denominator = 0;

  for (const p of promises) {
    const severity = p.weight || 3;
    const issueWeight = weights[p.category || "Other"] || 1.0;
    const combinedWeight = severity * issueWeight;
    const statusValue = STATUS_VALUES[p.status || "NOTHING"] ?? 0;

    numerator += statusValue * combinedWeight;
    denominator += 100 * combinedWeight;
  }

  const percentage = denominator > 0
    ? Math.max(0, Math.min(100, Math.round((numerator / denominator) * 100)))
    : 0;

  let grade: string;
  if (percentage >= 80) grade = "A";
  else if (percentage >= 65) grade = "B";
  else if (percentage >= 40) grade = "C";
  else if (percentage >= 20) grade = "D";
  else grade = "F";

  return { percentage, grade };
}
