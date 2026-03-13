import { prisma } from "./prisma";
import { ISSUE_WEIGHTS } from "./issue-weights";

let cachedWeights: Record<string, number> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getIssueWeights(): Promise<Record<string, number>> {
  const now = Date.now();
  if (cachedWeights && now - cacheTimestamp < CACHE_TTL) {
    return cachedWeights;
  }

  const dbWeights = await prisma.issueWeight.findMany();
  if (dbWeights.length === 0) {
    cachedWeights = ISSUE_WEIGHTS;
  } else {
    cachedWeights = {};
    for (const w of dbWeights) {
      cachedWeights[w.category] = w.weight;
    }
    // Fill in any missing categories from defaults
    for (const [cat, weight] of Object.entries(ISSUE_WEIGHTS)) {
      if (!(cat in cachedWeights)) {
        cachedWeights[cat] = weight;
      }
    }
  }

  cacheTimestamp = now;
  return cachedWeights;
}

export function invalidateIssueWeightsCache() {
  cachedWeights = null;
  cacheTimestamp = 0;
}
