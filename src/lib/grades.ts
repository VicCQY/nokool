import { calculateWeightedGrade, type PromiseForGrade } from "./weighted-grade";

interface PromiseRecord {
  status: string;
  category?: string;
  weight?: number;
  dateMade?: Date;
  expectedMonths?: number | null;
}

interface PoliticianTermInfo {
  termStart: Date;
  termEnd: Date | null;
  branch: string;
  chamber: string | null;
}

export function calculateFulfillment(
  promises: PromiseRecord[],
  termInfo?: PoliticianTermInfo,
  issueWeights?: Record<string, number>,
) {
  if (promises.length === 0) return { percentage: 0, grade: "N/A", termProgress: 0 };

  // If we have term info, use the weighted grade system
  if (termInfo) {
    const gradePromises: PromiseForGrade[] = promises.map((p) => ({
      status: p.status,
      category: p.category || "Other",
      weight: p.weight || 3,
      dateMade: p.dateMade || termInfo.termStart,
      expectedMonths: p.expectedMonths,
    }));

    const result = calculateWeightedGrade(
      gradePromises,
      termInfo.termStart,
      termInfo.termEnd,
      termInfo.branch,
      termInfo.chamber,
      issueWeights,
    );

    return {
      percentage: Math.round(result.percent),
      grade: result.letter,
      termProgress: result.termProgress,
    };
  }

  // Fallback: old flat formula (for cases where term info isn't available)
  const fulfilled = promises.filter((p) => p.status === "FULFILLED").length;
  const partial = promises.filter((p) => p.status === "PARTIAL").length;

  const score = ((fulfilled + partial * 0.5) / promises.length) * 100;
  const percentage = Math.round(score);

  let grade: string;
  if (percentage >= 80) grade = "A";
  else if (percentage >= 65) grade = "B";
  else if (percentage >= 50) grade = "C";
  else if (percentage >= 35) grade = "D";
  else grade = "F";

  return { percentage, grade, termProgress: 0 };
}
