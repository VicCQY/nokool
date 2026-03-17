import { callPerplexity, parseJsonFromResponse } from "./perplexity-api";
import { prisma } from "./prisma";

// ── Promise Research ──

export interface ResearchedPromise {
  title: string;
  description: string;
  category: string;
  dateMade: string;
  sourceUrl: string;
  severity: number;
  expectedMonths: number;
}

export async function researchPromises(
  politicianName: string,
  party: string,
  position: string,
): Promise<ResearchedPromise[]> {
  const systemPrompt = `You are a political researcher. Find specific, verifiable campaign promises made by the given politician. For each promise, provide:
1. The exact promise (what they said they would do)
2. A brief description (2-3 sentences explaining the promise)
3. The category (one of: Economy, Healthcare, Environment, Immigration, Education, Infrastructure, Foreign Policy, Justice, Housing, Technology, Other)
4. When it was made (approximate date, YYYY-MM-DD format)
5. Source URL (link to where they said it — campaign website, speech transcript, news article, official statement. NEVER use Wikipedia)
6. A suggested severity rating (1-5, where 5=cornerstone campaign promise, 1=minor/specific)
7. A suggested expectedMonths (how many months this should reasonably take to fulfill)

Assign severity 5 to cornerstone promises that defined their campaign, 4 to major policy items, 3 to standard promises, 2 to minor ones, 1 to trivial/specific ones. Be generous with severity 4-5 — most campaign promises worth tracking are at least a 3.

Return ONLY a JSON array of promises. No markdown, no explanation. Each object should have: title, description, category, dateMade, sourceUrl, severity, expectedMonths`;

  const userPrompt = `Find ALL major campaign promises made by ${politicianName} (${party}), who serves as ${position}.

PRIORITY ORDER:
1. Cornerstone promises (the 3-5 things they are MOST known for promising — the reasons people voted for them)
2. Major policy promises (significant commitments on economy, healthcare, immigration, etc.)
3. Specific legislative promises (bills they promised to pass or oppose)
4. Smaller commitments (district-specific, procedural, or minor promises)

Find at least 15 specific, verifiable promises with real source URLs. Cover ALL major policy areas they campaigned on — do not miss any signature promises. For each promise, note if it was a DAY ONE promise or had a specific timeline attached.

Do not use Wikipedia as a source. Prefer: official campaign websites, speech transcripts, debate transcripts, policy platforms, reputable news coverage of campaign events.`;

  const text = await callPerplexity(systemPrompt, userPrompt);
  const parsed = parseJsonFromResponse(text);

  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array from research response");
  }

  return parsed.map((item: Record<string, unknown>) => ({
    title: String(item.title || ""),
    description: String(item.description || ""),
    category: String(item.category || "Other"),
    dateMade: String(item.dateMade || new Date().toISOString().split("T")[0]),
    sourceUrl: String(item.sourceUrl || ""),
    severity: Math.max(1, Math.min(5, Number(item.severity) || 3)),
    expectedMonths: Math.max(1, Number(item.expectedMonths) || 12),
  }));
}

// ── News Research ──

export interface ResearchedArticle {
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedDate: string;
}

export async function researchNews(
  politicianName: string,
): Promise<ResearchedArticle[]> {
  const systemPrompt = `You are a political news researcher. Find the 10 most recent and significant news articles about the given politician from the past 30 days. For each article provide: title, summary (2-3 sentences), source (publication name), url, publishedDate (YYYY-MM-DD). Return ONLY a JSON array.`;

  const userPrompt = `Find the 10 most recent and significant news articles about ${politicianName} from the past 30 days. Return as a JSON array with objects having these exact keys: title, summary, source, url, publishedDate.`;

  const text = await callPerplexity(systemPrompt, userPrompt);
  const parsed = parseJsonFromResponse(text);

  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array from news response");
  }

  return parsed.map((item: Record<string, unknown>) => ({
    title: String(item.title || ""),
    summary: String(item.summary || ""),
    source: String(item.source || "Unknown"),
    url: String(item.url || ""),
    publishedDate: String(item.publishedDate || new Date().toISOString().split("T")[0]),
  }));
}

// ── Promise-to-Bill/Action Matching ──

export interface SuggestedMatch {
  promiseId: string;
  promiseTitle: string;
  itemId: string;
  itemTitle: string;
  itemType: "bill" | "action";
  alignment: "aligns" | "contradicts";
  confidence: "high" | "medium";
  reason: string;
}

interface PromiseSummary {
  id: string;
  title: string;
  description: string;
  category: string;
}

interface ItemSummary {
  id: string;
  title: string;
  summary: string;
  type: "bill" | "action";
}

const MATCH_SYSTEM_PROMPT = `You are a political analyst matching campaign promises to legislative bills and executive actions. For each promise, find bills or actions that are directly relevant. Only match when the connection is clear and obvious. For each match, determine if the bill/action ALIGNS with the promise (supports its goal) or CONTRADICTS the promise (works against its goal). Return ONLY a JSON array of matches.`;

function buildMatchUserPrompt(
  politicianName: string,
  promises: PromiseSummary[],
  items: ItemSummary[],
): string {
  const promiseList = promises
    .map((p) => `- [${p.id}] "${p.title}" (${p.category}): ${p.description.slice(0, 150)}`)
    .join("\n");

  const itemList = items
    .map((b) => `- [${b.id}] (${b.type}) "${b.title}": ${(b.summary || "").slice(0, 150)}`)
    .join("\n");

  return `Here are the campaign promises for ${politicianName}:
${promiseList}

Here are the bills/executive actions they voted on or signed:
${itemList}

For each promise, find the most relevant bills/actions (maximum 5 per promise). Return JSON:
[{ "promiseId": "string", "itemId": "string", "alignment": "aligns" | "contradicts", "confidence": "high" | "medium", "reason": "string" }]

Only include matches where the connection is clear. If no bills match a promise, skip it. Prefer high-confidence matches.`;
}

async function callMatchingForChunk(
  politicianName: string,
  promises: PromiseSummary[],
  items: ItemSummary[],
): Promise<SuggestedMatch[]> {
  if (items.length === 0 || promises.length === 0) return [];

  const text = await callPerplexity(
    MATCH_SYSTEM_PROMPT,
    buildMatchUserPrompt(politicianName, promises, items),
  );
  const parsed = parseJsonFromResponse(text);

  if (!Array.isArray(parsed)) return [];

  // Build lookup maps for titles
  const promiseMap = new Map(promises.map((p) => [p.id, p.title]));
  const itemMap = new Map(items.map((b) => [b.id, { title: b.title, type: b.type }]));

  return parsed
    .filter((m: Record<string, unknown>) => m.promiseId && m.itemId && promiseMap.has(String(m.promiseId)) && itemMap.has(String(m.itemId)))
    .map((m: Record<string, unknown>) => {
      const item = itemMap.get(String(m.itemId))!;
      return {
        promiseId: String(m.promiseId),
        promiseTitle: promiseMap.get(String(m.promiseId)) || "",
        itemId: String(m.itemId),
        itemTitle: item.title,
        itemType: item.type,
        alignment: m.alignment === "contradicts" ? "contradicts" as const : "aligns" as const,
        confidence: m.confidence === "medium" ? "medium" as const : "high" as const,
        reason: String(m.reason || ""),
      };
    });
}

const CHUNK_SIZE = 100;

export async function matchPromisesToBills(
  politicianId: string,
): Promise<SuggestedMatch[]> {
  const politician = await prisma.politician.findUnique({
    where: { id: politicianId },
    select: { name: true, branch: true },
  });
  if (!politician) throw new Error("Politician not found");

  // Fetch promises
  const promises = await prisma.promise.findMany({
    where: { politicianId },
    select: { id: true, title: true, description: true, category: true },
  });
  if (promises.length === 0) return [];

  const promiseSummaries: PromiseSummary[] = promises.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    category: p.category,
  }));

  // Collect all items (bills + actions)
  const items: ItemSummary[] = [];

  // For legislative: fetch bills they voted on
  if (politician.branch !== "executive") {
    const votes = await prisma.vote.findMany({
      where: { politicianId },
      select: {
        bill: { select: { id: true, title: true, summary: true } },
      },
    });
    for (const v of votes) {
      items.push({
        id: v.bill.id,
        title: v.bill.title,
        summary: v.bill.summary || "",
        type: "bill",
      });
    }
  }

  // For executive: fetch executive actions
  if (politician.branch === "executive") {
    const actions = await prisma.executiveAction.findMany({
      where: { politicianId },
      select: { id: true, title: true, summary: true },
    });
    for (const a of actions) {
      items.push({
        id: a.id,
        title: a.title,
        summary: a.summary || "",
        type: "action",
      });
    }

    // Also fetch bills they signed/vetoed (via votes if any, e.g. Vance)
    const votes = await prisma.vote.findMany({
      where: { politicianId },
      select: {
        bill: { select: { id: true, title: true, summary: true } },
      },
    });
    for (const v of votes) {
      items.push({
        id: v.bill.id,
        title: v.bill.title,
        summary: v.bill.summary || "",
        type: "bill",
      });
    }
  }

  // Deduplicate items by id
  const seen = new Set<string>();
  const uniqueItems = items.filter((b) => {
    if (seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  });

  if (uniqueItems.length === 0) return [];

  // Chunk items if too many
  const allMatches: SuggestedMatch[] = [];
  for (let i = 0; i < uniqueItems.length; i += CHUNK_SIZE) {
    const chunk = uniqueItems.slice(i, i + CHUNK_SIZE);
    const matches = await callMatchingForChunk(politician.name, promiseSummaries, chunk);
    allMatches.push(...matches);
  }

  // Deduplicate matches (same promiseId + itemId)
  const matchSeen = new Set<string>();
  return allMatches.filter((m) => {
    const key = `${m.promiseId}:${m.itemId}`;
    if (matchSeen.has(key)) return false;
    matchSeen.add(key);
    return true;
  });
}
