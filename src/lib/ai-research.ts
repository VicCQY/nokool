import { callPerplexity, parseJsonFromResponse } from "./perplexity-api";
import { prisma } from "./prisma";

// ── Model Configuration ──
// sonar = cheaper, good for research/discovery tasks with web search
// sonar-pro = more accurate, use for fact-checking where precision matters
const MODEL_RESEARCH = "sonar";
const MODEL_FACTCHECK = "sonar-pro";
const MODEL_MATCHING = "sonar-pro";

// ── Promise Research ──

export interface ResearchedPromise {
  title: string;
  description: string;
  category: string;
  status: string;
  dateMade: string;
  sourceUrl: string;
  severity: number;
  expectedMonths: number;
  billRelated: boolean;
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

For each promise, also determine its current status based on your knowledge:
- FULFILLED: The promise has been fully delivered with clear evidence
- PARTIAL: Some progress but not fully delivered
- IN_PROGRESS: Active work is being done but not complete
- NOT_STARTED: No meaningful action taken
- BROKEN: The politician has clearly gone against the promise or abandoned it

Be accurate and fair. If unsure, default to NOT_STARTED.

For each promise, also determine if this promise is directly related to specific legislation that would be voted on in Congress, OR for executive branch politicians, related to a specific executive action (executive order, memorandum, proclamation, bill signing). Set billRelated: true if it is, false if it's a general/aspirational/economic promise that wouldn't have a specific bill vote or executive action.

Return ONLY a JSON array of promises. No markdown, no explanation. Each object should have: title, description, category, status, dateMade, sourceUrl, severity, expectedMonths, billRelated`;

  const userPrompt = `Find ALL major campaign promises made by ${politicianName} (${party}), who serves as ${position}.

PRIORITY ORDER:
1. Cornerstone promises (the 3-5 things they are MOST known for promising — the reasons people voted for them)
2. Major policy promises (significant commitments on economy, healthcare, immigration, etc.)
3. Specific legislative promises (bills they promised to pass or oppose)
4. Smaller commitments (district-specific, procedural, or minor promises)

Find at least 15 specific, verifiable promises with real source URLs. Cover ALL major policy areas they campaigned on — do not miss any signature promises. For each promise, note if it was a DAY ONE promise or had a specific timeline attached.

Do not use Wikipedia as a source. Prefer: official campaign websites, speech transcripts, debate transcripts, policy platforms, reputable news coverage of campaign events.`;

  const text = await callPerplexity(systemPrompt, userPrompt, MODEL_RESEARCH);
  const parsed = parseJsonFromResponse(text);

  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array from research response");
  }

  const VALID_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "FULFILLED", "PARTIAL", "BROKEN"];
  return parsed.map((item: Record<string, unknown>) => ({
    title: String(item.title || ""),
    description: String(item.description || ""),
    category: String(item.category || "Other"),
    status: VALID_STATUSES.includes(String(item.status || "")) ? String(item.status) : "NOT_STARTED",
    dateMade: String(item.dateMade || new Date().toISOString().split("T")[0]),
    sourceUrl: String(item.sourceUrl || ""),
    severity: Math.max(1, Math.min(5, Number(item.severity) || 3)),
    expectedMonths: Math.max(1, Number(item.expectedMonths) || 12),
    billRelated: item.billRelated === true || item.billRelated === "true",
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

  const text = await callPerplexity(systemPrompt, userPrompt, MODEL_RESEARCH);
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

// ── Promise Status Updates ──

export interface StatusSuggestion {
  promiseId: string;
  title: string;
  currentStatus: string;
  suggestedStatus: string;
  reason: string;
}

export async function checkPromiseStatuses(
  politicianName: string,
  party: string,
  promises: { id: string; title: string; description: string; status: string }[],
): Promise<StatusSuggestion[]> {
  if (promises.length === 0) return [];

  const systemPrompt = `You are a political fact-checker. For each promise, determine its current status. Be fair and recognize partial efforts:
- FULFILLED: Fully delivered, clear evidence it's done
- PARTIAL: Meaningful progress made but not fully delivered. Use this if they've taken concrete steps but the promise isn't complete yet.
- IN_PROGRESS: They have started working on it — executive orders signed, bills introduced, public statements of intent with follow-through. Even early-stage action counts as IN_PROGRESS.
- NOT_STARTED: Genuinely NO action taken at all. No executive orders, no bills introduced, no public effort. Only use this if they have truly done nothing.
- BROKEN: Actively contradicted the promise or explicitly abandoned it.

Err on the side of IN_PROGRESS over NOT_STARTED. If there is ANY evidence of effort, even small steps, it should be at least IN_PROGRESS.`;

  // Truncate descriptions to 100 chars to save tokens
  const promiseList = promises
    .map((p, i) => `${i + 1}. "${p.title}": ${p.description.slice(0, 100)}`)
    .join("\n");

  const userPrompt = `Here are campaign promises made by ${politicianName} (${party}). For each one, determine the current status and provide a brief reason (1-2 sentences) explaining why.

${promiseList}

Return ONLY a JSON array: [{ "title": "string", "status": "FULFILLED" | "PARTIAL" | "IN_PROGRESS" | "NOT_STARTED" | "BROKEN", "reason": "string" }]`;

  const text = await callPerplexity(systemPrompt, userPrompt, MODEL_FACTCHECK);
  const parsed = parseJsonFromResponse(text);

  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array from status check response");
  }

  const VALID = ["NOT_STARTED", "IN_PROGRESS", "FULFILLED", "PARTIAL", "BROKEN"];

  // Match AI results back to promises by index/title
  return parsed.map((item: Record<string, unknown>, i: number) => {
    const promise = promises[i] || promises.find((p) => p.title === String(item.title));
    if (!promise) return null;
    const suggestedStatus = VALID.includes(String(item.status || "")) ? String(item.status) : "NOT_STARTED";
    return {
      promiseId: promise.id,
      title: promise.title,
      currentStatus: promise.status,
      suggestedStatus,
      reason: String(item.reason || ""),
    };
  }).filter((x): x is StatusSuggestion => x !== null);
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
  type: "bill" | "action";
  billNumber?: string;
}

// ── Local keyword pre-filter ──

const MATCH_STOP_WORDS = new Set([
  // Common English
  "the", "a", "an", "to", "of", "and", "in", "on", "for", "with", "is", "it",
  "by", "as", "at", "or", "from", "that", "this", "be", "will", "all", "their",
  "his", "her", "no", "not", "has", "have", "been", "was", "were", "are",
  "do", "does", "did", "would", "could", "should", "may", "can", "shall",
  "its", "also", "such", "than", "other", "which", "who", "whom", "more",
  "under", "over", "about", "into", "through", "during", "before", "after",
  // Congressional procedural terms (appear in nearly all bill titles)
  "act", "bill", "resolution", "motion", "agreeing", "passage", "ordering",
  "previous", "question", "providing", "consideration", "suspend", "rules",
  "pass", "agree", "amended", "amend", "amendment", "table", "recommit",
  "certain", "member", "members", "relating", "respect", "purposes",
  "congressional", "disapproval", "rule", "submitted", "chapter",
  "pursuant", "section", "title", "making", "appropriations", "fiscal",
  "year", "ending", "september", "government", "united", "states",
  "representative", "removing", "expressing", "support", "condemning",
  "censuring", "regarding", "concerning", "authorize", "authorizing",
  "direct", "require", "extend", "establishing", "designating",
]);

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !MATCH_STOP_WORDS.has(w));
}

function scoreItemRelevance(promiseKeywords: string[], itemTitle: string): number {
  const itemWords = new Set(extractKeywords(itemTitle));
  let score = 0;
  for (const kw of promiseKeywords) {
    if (itemWords.has(kw)) score++;
  }
  return score;
}

/** Pre-filter: for each promise, find the top N most keyword-relevant items.
 *  Requires score >= 2 to avoid noise from single-word matches.
 *  Falls back to most recent items if keyword matching finds nothing. */
function preFilterItems(
  promises: PromiseSummary[],
  items: ItemSummary[],
  topN: number = 20,
): ItemSummary[] {
  const selectedIds = new Set<string>();

  for (const promise of promises) {
    const keywords = extractKeywords(promise.title + " " + promise.description);
    if (keywords.length === 0) continue;

    // Score all items against this promise's keywords
    const scored = items.map((item) => ({
      item,
      score: scoreItemRelevance(keywords, item.title),
    }));

    // Take top N with score >= 2 (require at least 2 keyword matches)
    const good = scored
      .filter((s) => s.score >= 2)
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);

    good.forEach((s) => selectedIds.add(s.item.id));
  }

  // Fallback: if keyword matching found very few items, add the most recent bills
  // (items at end of array tend to be more recent since they're fetched in order)
  if (selectedIds.size < 20 && items.length > 0) {
    const fallbackCount = Math.min(20, items.length);
    const fallbackItems = items.slice(-fallbackCount);
    for (const item of fallbackItems) {
      selectedIds.add(item.id);
    }
    console.log(
      `[Match] Keyword filter found only ${selectedIds.size - fallbackCount} items, added ${fallbackCount} recent items as fallback`,
    );
  }

  return items.filter((item) => selectedIds.has(item.id));
}

const MATCH_SYSTEM_PROMPT = `You are a political analyst matching campaign promises to legislative bills and executive actions. For each promise, find bills or actions that are directly relevant. Only match when the connection is clear and obvious. For each match, determine if the bill/action ALIGNS with the promise (supports its goal) or CONTRADICTS the promise (works against its goal). Return ONLY a JSON array of matches.`;

function buildMatchUserPrompt(
  politicianName: string,
  promises: PromiseSummary[],
  items: ItemSummary[],
): string {
  const promiseList = promises
    .map((p) => `- [${p.id}] "${p.title}" (${p.category})`)
    .join("\n");

  const itemList = items
    .map((b) => `- [${b.id}] (${b.type}) "${b.title}"${b.billNumber ? ` (${b.billNumber})` : ""}`)
    .join("\n");

  return `Here are the campaign promises for ${politicianName}:
${promiseList}

Here are the bills/executive actions they voted on or signed:
${itemList}

For each promise, find the most relevant bills/actions (maximum 5 per promise). Return JSON:
[{ "promiseId": "string", "itemId": "string", "alignment": "aligns" | "contradicts", "confidence": "high" | "medium", "reason": "string" }]

Only include matches where the connection is clear. If no bills match a promise, skip it. Prefer high-confidence matches.`;
}

export async function matchPromisesToBills(
  politicianId: string,
): Promise<SuggestedMatch[]> {
  const politician = await prisma.politician.findUnique({
    where: { id: politicianId },
    select: { name: true, branch: true },
  });
  if (!politician) throw new Error("Politician not found");

  // Fetch only bill-related promises (billRelated = true)
  const promises = await prisma.promise.findMany({
    where: { politicianId, billRelated: true },
    select: { id: true, title: true, description: true, category: true },
  });
  if (promises.length === 0) return [];

  const promiseSummaries: PromiseSummary[] = promises.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    category: p.category,
  }));

  // Collect all items (bills + actions) — only fetch titles, not summaries
  const items: ItemSummary[] = [];

  // For legislative: fetch bills they voted on
  if (politician.branch !== "executive") {
    const votes = await prisma.vote.findMany({
      where: { politicianId },
      select: {
        bill: { select: { id: true, title: true, billNumber: true } },
      },
    });
    for (const v of votes) {
      items.push({
        id: v.bill.id,
        title: v.bill.title,
        type: "bill",
        billNumber: v.bill.billNumber,
      });
    }
  }

  // For executive: fetch executive actions + any votes
  if (politician.branch === "executive") {
    const actions = await prisma.executiveAction.findMany({
      where: { politicianId },
      select: { id: true, title: true },
    });
    for (const a of actions) {
      items.push({ id: a.id, title: a.title, type: "action" });
    }

    const votes = await prisma.vote.findMany({
      where: { politicianId },
      select: {
        bill: { select: { id: true, title: true, billNumber: true } },
      },
    });
    for (const v of votes) {
      items.push({
        id: v.bill.id,
        title: v.bill.title,
        type: "bill",
        billNumber: v.bill.billNumber,
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

  // Local keyword pre-filter: only send relevant bills to AI
  const filteredItems = preFilterItems(promiseSummaries, uniqueItems, 20);

  console.log(
    `[Match] ${uniqueItems.length} total items → ${filteredItems.length} after keyword pre-filter for ${promises.length} promises`,
  );

  if (filteredItems.length === 0) return [];

  // Single AI call with pre-filtered candidates
  const text = await callPerplexity(
    MATCH_SYSTEM_PROMPT,
    buildMatchUserPrompt(politician.name, promiseSummaries, filteredItems),
    MODEL_MATCHING,
  );
  const parsed = parseJsonFromResponse(text);

  if (!Array.isArray(parsed)) return [];

  // Build lookup maps for titles
  const promiseMap = new Map(promiseSummaries.map((p) => [p.id, p.title]));
  const itemMap = new Map(filteredItems.map((b) => [b.id, { title: b.title, type: b.type }]));

  // Deduplicate matches
  const matchSeen = new Set<string>();
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
    })
    .filter((m) => {
      const key = `${m.promiseId}:${m.itemId}`;
      if (matchSeen.has(key)) return false;
      matchSeen.add(key);
      return true;
    });
}
