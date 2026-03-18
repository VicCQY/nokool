import { calculateGradeFromScores } from "./promise-score";

interface PromiseRecord {
  score?: number;
  status?: string;
  category?: string;
  weight?: number;
  dateMade?: Date | string;
  expectedMonths?: number | null;
}

export function calculateFulfillment(
  promises: PromiseRecord[],
  _termInfo?: unknown,
  issueWeights?: Record<string, number>,
) {
  if (promises.length === 0) return { percentage: 0, grade: "N/A" };

  const gradePromises = promises.map((p) => ({
    score: p.score ?? 0,
    weight: p.weight || 3,
    category: p.category || "Other",
  }));

  const result = calculateGradeFromScores(gradePromises, issueWeights);

  return {
    percentage: result.percent,
    grade: result.letter,
  };
}
