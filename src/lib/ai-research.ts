import { callPerplexity, parseJsonFromResponse } from "./perplexity-api";
import { prisma } from "./prisma";
import { sanitizeSourceUrl, validateSource } from "./source-validator";

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
  statusConfidence: string;
  statusReason: string;
  statusDate: string;
  statusSource: string;
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
  const systemPrompt = `You are a political researcher. For each campaign promise you find, provide:
1. title: Short clear promise name
2. description: 2-3 sentences explaining the promise
3. category: Economy, Healthcare, Environment, Immigration, Education, Infrastructure, Foreign Policy, Justice, Housing, Technology, Other
4. dateMade: When the promise was made (YYYY-MM-DD)
5. sourceUrl: Link to where they said it. NEVER use wikipedia.org. Use: official campaign sites, .gov, C-SPAN, AP, Reuters, NYT, WaPo, Politico, The Hill, CNN, Fox News, NPR.
6. severity: 1-5 (5=cornerstone, 4=major, 3=standard, 2=minor, 1=trivial)
7. expectedMonths: How many months to reasonably fulfill
8. billRelated: true/false — is this directly tied to specific legislation or executive action?
9. status: Current status (FULFILLED/PARTIAL/IN_PROGRESS/NOT_STARTED/BROKEN/REVERSED)
10. statusConfidence: high/medium/low — how confident are you in this status?
11. statusReason: 1-2 sentences explaining WHY this is the current status
12. statusDate: YYYY-MM-DD — CRITICAL: this must be the date the status actually changed, such as when a bill was signed, an executive order was issued, or the promise was publicly abandoned. NEVER use today's date. If you are unsure of the exact date, use the closest known date of the real event.
13. statusSource: URL proving the current status (different from the promise source). NEVER use wikipedia.org.

NEVER use Wikipedia (wikipedia.org) as a source URL. If your only source is Wikipedia, find the original source that Wikipedia cites instead. Preferred sources: official campaign websites, government records (.gov), C-SPAN, AP, Reuters, NYT, Washington Post, Politico, The Hill, CNN, Fox News, NPR, local newspapers, official press releases.

Assign severity 5 to cornerstone promises that defined their campaign, 4 to major policy items, 3 to standard promises, 2 to minor ones, 1 to trivial/specific ones.

For status:
- FULFILLED: Fully delivered with clear evidence
- PARTIAL: Some progress but not fully delivered
- IN_PROGRESS: Active work being done but not complete
- NOT_STARTED: No meaningful action taken
- BROKEN: Clearly gone against the promise
- REVERSED: Was fulfilled/partial then undone or rolled back

If unsure about status, default to NOT_STARTED with statusConfidence: "low".

IMPORTANT: Do NOT create multiple promises that cover the same topic. Combine related commitments into ONE promise. For example, "Reopen Schools During COVID-19" and "Move On from COVID-19 Shutdowns" should be ONE promise about COVID response. "Repeal ACA", "Replace ACA with Graham-Cassidy", and "Repeal Employer Mandate" should be ONE promise about healthcare reform. Each promise should be a distinct policy goal, not variations of the same theme.

Return ONLY a JSON array. No markdown, no explanation. Each object should have: title, description, category, status, statusConfidence, statusReason, statusDate, statusSource, dateMade, sourceUrl, severity, expectedMonths, billRelated`;

  const userPrompt = `Find ALL major campaign promises made by ${politicianName} (${party}), who serves as ${position}.

PRIORITY ORDER:
1. Cornerstone promises (the 3-5 things they are MOST known for promising)
2. Major policy promises (economy, healthcare, immigration, etc.)
3. Specific legislative promises (bills they promised to pass or oppose)
4. Smaller commitments (district-specific, procedural, or minor)

Find at least 15 specific, verifiable promises with real source URLs. Cover ALL major policy areas. For each promise, include the status with an actual event date (not today's date) and a source URL proving the status.

NEVER use Wikipedia as a source.`;

  const text = await callPerplexity(systemPrompt, userPrompt, MODEL_RESEARCH);
  const parsed = parseJsonFromResponse(text);

  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array from research response");
  }

  return parsed.map((item: Record<string, unknown>) => processResearchItem(item));
}

function processResearchItem(item: Record<string, unknown>): ResearchedPromise {
  const VALID_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "FULFILLED", "PARTIAL", "BROKEN", "REVERSED"];
  const VALID_CONFIDENCE = ["high", "medium", "low"];

  // Source validation
  const rawSourceUrl = String(item.sourceUrl || "");
  const sourceUrl = sanitizeSourceUrl(rawSourceUrl, String(item.title || ""));

  const rawStatusSource = String(item.statusSource || "");
  const statusSource = sanitizeSourceUrl(rawStatusSource, `${item.title} (status)`);

  // Confidence scoring
  let confidence = String(item.statusConfidence || "low").toLowerCase();
  if (!VALID_CONFIDENCE.includes(confidence)) confidence = "low";

  // Downgrade confidence if no source or untrusted source
  const statusSourceValidation = validateSource(statusSource);
  if (!statusSource || !statusSourceValidation.valid) {
    confidence = "low";
  } else if (statusSourceValidation.trusted === false && confidence === "high") {
    confidence = "medium";
  }

  // Date validation
  const now = new Date();
  let statusDate = String(item.statusDate || "");
  const statusDateObj = new Date(statusDate);
  if (!statusDate || isNaN(statusDateObj.getTime()) || statusDateObj > now) {
    // Invalid or future date — downgrade confidence
    statusDate = "";
    if (confidence !== "low") confidence = "low";
  }

  const dateMade = String(item.dateMade || new Date().toISOString().split("T")[0]);
  // If statusDate is before dateMade, flag
  if (statusDate && dateMade && new Date(statusDate) < new Date(dateMade)) {
    confidence = "low";
  }

  const status = VALID_STATUSES.includes(String(item.status || "")) ? String(item.status) : "NOT_STARTED";

  return {
    title: String(item.title || ""),
    description: String(item.description || ""),
    category: String(item.category || "Other"),
    status,
    statusConfidence: confidence,
    statusReason: String(item.statusReason || ""),
    statusDate,
    statusSource,
    dateMade,
    sourceUrl,
    severity: Math.max(1, Math.min(5, Number(item.severity) || 3)),
    expectedMonths: Math.max(1, Number(item.expectedMonths) || 12),
    billRelated: item.billRelated === true || item.billRelated === "true",
  };
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
  confidence: string;
  eventDate: string;
  reason: string;
  sourceUrl: string;
  changed: boolean;
}

export async function checkPromiseStatuses(
  politicianName: string,
  party: string,
  promises: { id: string; title: string; description: string; status: string }[],
): Promise<StatusSuggestion[]> {
  if (promises.length === 0) return [];

  const systemPrompt = `You are a political fact-checker. For each promise, determine if the status has changed based on the latest available information.

For each promise, return:
1. title: The promise title (must match exactly)
2. currentStatus: What the status currently is in our database (provided to you)
3. suggestedStatus: What you think the status should be now
4. confidence: high/medium/low
5. eventDate: YYYY-MM-DD — CRITICAL: the date the status actually changed (when the bill was signed, the EO was issued, the promise was broken). NEVER use today's date. Use the closest known date of the real event.
6. reason: 1-2 sentences explaining what happened
7. sourceUrl: URL proving the change. NEVER use wikipedia.org.
8. changed: true/false — did the status actually change from currentStatus?

IMPORTANT RULES:
- If nothing has changed, set changed: false and keep suggestedStatus = currentStatus
- eventDate must be the date of the ACTUAL EVENT, not today
- NEVER use wikipedia.org as a source
- Be fair: if there is ANY evidence of effort, even small steps, use IN_PROGRESS not NOT_STARTED
- REVERSED means it was done then undone — not that progress stalled

Status definitions:
- FULFILLED: Fully delivered, clear evidence
- PARTIAL: Meaningful progress but not complete
- IN_PROGRESS: Active work being done, even early-stage
- NOT_STARTED: Genuinely NO action taken at all
- BROKEN: Actively contradicted or abandoned
- REVERSED: Was fulfilled/partial then undone or rolled back

Return ONLY a JSON array.`;

  // Include current status so AI knows what we have
  const promiseList = promises
    .map((p, i) => `${i + 1}. [${p.status}] "${p.title}": ${p.description.slice(0, 100)}`)
    .join("\n");

  const userPrompt = `Here are campaign promises made by ${politicianName} (${party}) with their CURRENT status in brackets. For each one, determine if the status should change based on the latest information.

${promiseList}

Return ONLY a JSON array with objects having: title, currentStatus, suggestedStatus, confidence, eventDate, reason, sourceUrl, changed`;

  const text = await callPerplexity(systemPrompt, userPrompt, MODEL_FACTCHECK);
  const parsed = parseJsonFromResponse(text);

  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array from status check response");
  }

  const VALID = ["NOT_STARTED", "IN_PROGRESS", "FULFILLED", "PARTIAL", "BROKEN", "REVERSED"];
  const VALID_CONFIDENCE = ["high", "medium", "low"];
  const now = new Date();

  return parsed.map((item: Record<string, unknown>, i: number) => {
    const promise = promises[i] || promises.find((p) => p.title === String(item.title));
    if (!promise) return null;

    const suggestedStatus = VALID.includes(String(item.suggestedStatus || ""))
      ? String(item.suggestedStatus)
      : promise.status;

    // Source validation
    const rawUrl = String(item.sourceUrl || "");
    const sourceUrl = sanitizeSourceUrl(rawUrl, promise.title);

    // Confidence with validation
    let confidence = String(item.confidence || "low").toLowerCase();
    if (!VALID_CONFIDENCE.includes(confidence)) confidence = "low";

    // Downgrade if no source or untrusted
    const srcValidation = validateSource(sourceUrl);
    if (!sourceUrl || !srcValidation.valid) {
      confidence = "low";
    } else if (srcValidation.trusted === false && confidence === "high") {
      confidence = "medium";
    }

    // Date validation
    let eventDate = String(item.eventDate || "");
    const eventDateObj = new Date(eventDate);
    if (!eventDate || isNaN(eventDateObj.getTime()) || eventDateObj > now) {
      eventDate = new Date().toISOString().split("T")[0]; // fallback to today
      if (confidence !== "low") confidence = "low";
    }

    const changed = item.changed === true || item.changed === "true";

    return {
      promiseId: promise.id,
      title: promise.title,
      currentStatus: promise.status,
      suggestedStatus,
      confidence,
      eventDate,
      reason: String(item.reason || ""),
      sourceUrl,
      changed,
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

const MATCH_SYSTEM_PROMPT = `You are a political analyst matching campaign promises to legislative bills and executive actions. For each promise, find bills or actions that are directly relevant.

STRICT MATCHING RULES:
- Only match bills that are DIRECTLY about the promise's specific policy goal.
- Confirmation votes for nominees are NOT matches for broad policy promises. A "Strengthen National Defense" promise should match defense spending bills or military policy bills, NOT personnel confirmation votes.
- Procedural votes, naming resolutions, and ceremonial bills are NOT matches.
- A weak or tangential match is WORSE than no match — only include clear, obvious connections.
- The bill/action must substantively advance or contradict the specific promise.

For each match, determine if the bill/action ALIGNS with the promise (supports its goal) or CONTRADICTS the promise (works against its goal). Return ONLY a JSON array of matches.`;

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

For each promise, find bills/actions that DIRECTLY address the promise's specific policy goal (maximum 5 per promise). Return JSON:
[{ "promiseId": "string", "itemId": "string", "alignment": "aligns" | "contradicts", "confidence": "high" | "medium", "reason": "string" }]

STRICT: Only include matches where the bill/action substantively advances or contradicts the specific promise. Skip confirmation votes, procedural votes, and tangential connections. If no bills clearly match a promise, skip it entirely — no match is better than a weak match.`;
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
