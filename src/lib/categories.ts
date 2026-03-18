import { PromiseStatus } from "@prisma/client";
import { calculateGradeFromScores } from "./promise-score";

export interface CategoryBreakdown {
  category: string;
  total: number;
  fulfilled: number;
  partial: number;
  advancing: number;
  broken: number;
  inProgress: number;
  notStarted: number;
  fulfillmentPercent: number;
}

interface PromiseInput {
  category: string;
  status: PromiseStatus;
  score?: number;
  weight?: number;
}

export function calculateCategoryBreakdown(
  promises: PromiseInput[],
  _termInfo?: unknown,
  issueWeights?: Record<string, number>,
): CategoryBreakdown[] {
  const map: Record<
    string,
    { total: number; fulfilled: number; partial: number; advancing: number; broken: number; inProgress: number; notStarted: number; promises: PromiseInput[] }
  > = {};

  for (const p of promises) {
    if (!map[p.category]) {
      map[p.category] = {
        total: 0,
        fulfilled: 0,
        partial: 0,
        advancing: 0,
        broken: 0,
        inProgress: 0,
        notStarted: 0,
        promises: [],
      };
    }
    const c = map[p.category];
    c.total++;
    c.promises.push(p);
    if (p.status === "FULFILLED") c.fulfilled++;
    else if (p.status === "PARTIAL") c.partial++;
    else if (p.status === "ADVANCING") c.advancing++;
    else if (p.status === "BROKEN") c.broken++;
    else if (p.status === "IN_PROGRESS") c.inProgress++;
    else if (p.status === "NOT_STARTED") c.notStarted++;
  }

  return Object.entries(map).map(([category, data]) => {
    const gradePromises = data.promises.map((p) => ({
      score: p.score ?? 0,
      weight: p.weight || 3,
      category: p.category,
    }));

    const result = calculateGradeFromScores(gradePromises, issueWeights);

    return {
      category,
      total: data.total,
      fulfilled: data.fulfilled,
      partial: data.partial,
      advancing: data.advancing,
      broken: data.broken,
      inProgress: data.inProgress,
      notStarted: data.notStarted,
      fulfillmentPercent: result.percent,
    };
  });
}
