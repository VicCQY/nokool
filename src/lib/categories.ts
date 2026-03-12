import { PromiseStatus } from "@prisma/client";

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

export function calculateCategoryBreakdown(
  promises: { category: string; status: PromiseStatus }[],
): CategoryBreakdown[] {
  const map: Record<
    string,
    { total: number; fulfilled: number; partial: number; broken: number; inProgress: number; notStarted: number }
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
      };
    }
    const c = map[p.category];
    c.total++;
    if (p.status === "FULFILLED") c.fulfilled++;
    else if (p.status === "PARTIAL") c.partial++;
    else if (p.status === "BROKEN") c.broken++;
    else if (p.status === "IN_PROGRESS") c.inProgress++;
    else if (p.status === "NOT_STARTED") c.notStarted++;
  }

  return Object.entries(map).map(([category, data]) => ({
    category,
    ...data,
    fulfillmentPercent:
      data.total > 0
        ? Math.round(
            ((data.fulfilled + data.partial * 0.5) / data.total) * 100,
          )
        : 0,
  }));
}
