import { PromiseStatus } from "@prisma/client";
import { ISSUE_WEIGHTS, STATUS_VALUES } from "./issue-weights";

export interface CategoryBreakdown {
  category: string;
  total: number;
  kept: number;
  fighting: number;
  stalled: number;
  nothing: number;
  broke: number;
  fulfillmentPercent: number;
}

interface PromiseInput {
  category: string;
  status: PromiseStatus;
  weight?: number;
}

export function calculateCategoryBreakdown(
  promises: PromiseInput[],
  _termInfo?: unknown,
  issueWeights?: Record<string, number>,
): CategoryBreakdown[] {
  const weights = issueWeights || ISSUE_WEIGHTS;
  const map: Record<
    string,
    { total: number; kept: number; fighting: number; stalled: number; nothing: number; broke: number; promises: PromiseInput[] }
  > = {};

  for (const p of promises) {
    if (!map[p.category]) {
      map[p.category] = { total: 0, kept: 0, fighting: 0, stalled: 0, nothing: 0, broke: 0, promises: [] };
    }
    const c = map[p.category];
    c.total++;
    c.promises.push(p);
    if (p.status === "KEPT") c.kept++;
    else if (p.status === "FIGHTING") c.fighting++;
    else if (p.status === "STALLED") c.stalled++;
    else if (p.status === "NOTHING") c.nothing++;
    else if (p.status === "BROKE") c.broke++;
  }

  return Object.entries(map).map(([category, data]) => {
    let numerator = 0;
    let denominator = 0;
    for (const p of data.promises) {
      const severity = p.weight || 3;
      const issueWeight = weights[p.category] || 1.0;
      const combinedWeight = severity * issueWeight;
      const statusValue = STATUS_VALUES[p.status] ?? 0;
      numerator += statusValue * combinedWeight;
      denominator += 100 * combinedWeight;
    }
    const percent = denominator > 0
      ? Math.max(0, Math.min(100, Math.round((numerator / denominator) * 100)))
      : 0;

    return {
      category,
      total: data.total,
      kept: data.kept,
      fighting: data.fighting,
      stalled: data.stalled,
      nothing: data.nothing,
      broke: data.broke,
      fulfillmentPercent: percent,
    };
  });
}
