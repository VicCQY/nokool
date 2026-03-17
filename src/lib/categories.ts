import { PromiseStatus } from "@prisma/client";
import { calculateWeightedGrade, type PromiseForGrade } from "./weighted-grade";

export interface CategoryBreakdown {
  category: string;
  total: number;
  fulfilled: number;
  partial: number;
  broken: number;
  inProgress: number;
  notStarted: number;
  fulfillmentPercent: number;
}

interface TermInfo {
  termStart: Date;
  termEnd: Date | null;
  branch: string;
  chamber: string | null;
}

interface PromiseInput {
  category: string;
  status: PromiseStatus;
  weight?: number;
  dateMade?: Date | string;
  expectedMonths?: number | null;
}

export function calculateCategoryBreakdown(
  promises: PromiseInput[],
  termInfo?: TermInfo,
  issueWeights?: Record<string, number>,
): CategoryBreakdown[] {
  const map: Record<
    string,
    { total: number; fulfilled: number; partial: number; broken: number; inProgress: number; notStarted: number; promises: PromiseInput[] }
  > = {};

  for (const p of promises) {
    if (!map[p.category]) {
      map[p.category] = {
        total: 0,
        fulfilled: 0,
        partial: 0,
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
    else if (p.status === "BROKEN") c.broken++;
    else if (p.status === "IN_PROGRESS") c.inProgress++;
    else if (p.status === "NOT_STARTED") c.notStarted++;
  }

  return Object.entries(map).map(([category, data]) => {
    let fulfillmentPercent: number;

    if (termInfo && data.promises.some((p) => p.weight != null)) {
      // Use weighted grade formula per category
      const gradePromises: PromiseForGrade[] = data.promises.map((p) => ({
        status: p.status,
        category: p.category,
        weight: p.weight || 3,
        dateMade: p.dateMade ? new Date(p.dateMade) : termInfo.termStart,
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
      fulfillmentPercent = Math.round(result.percent);
    } else {
      // Fallback: simple formula
      fulfillmentPercent = data.total > 0
        ? Math.round(((data.fulfilled + data.partial * 0.5) / data.total) * 100)
        : 0;
    }

    return {
      category,
      total: data.total,
      fulfilled: data.fulfilled,
      partial: data.partial,
      broken: data.broken,
      inProgress: data.inProgress,
      notStarted: data.notStarted,
      fulfillmentPercent,
    };
  });
}
