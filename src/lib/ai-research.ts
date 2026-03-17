import { callPerplexity, parseJsonFromResponse } from "./perplexity-api";
import { prisma } from "./prisma";
import { sanitizeSourceUrl } from "./source-validator";

// ── Model Configuration ──
const MODEL_RESEARCH = "sonar-pro";
const MODEL_MATCHING = "sonar-pro";

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

export interface TimelineEvent {
  date: string;
  type: "status_change" | "executive_action" | "legislation" | "news";
  title: string;
  description: string;
  sourceUrl: string;
  newStatus: string | null;
}

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
  timeline: TimelineEvent[];
}

// ══════════════════════════════════════════════
// RESEARCH PROMISES
// ══════════════════════════════════════════════

export async function researchPromises(
  politicianName: string,
  party: string,
  position: string,
  todayDate?: string,
): Promise<ResearchedPromise[]> {
  const today = todayDate || new Date().toISOString().split("T")[0];

  const systemPrompt = `Find all major campaign promises made by this politician throughout their career. For each promise, tell me:
- What exactly they promised (be specific — not slogans)
- When they first made this promise (the original date, not a recent repetition)
- What category it falls under
- What has happened since — every bill introduced, vote cast, executive order signed, or major development, with specific dates
- What the current status is as of ${today}

Format as JSON array:
[{
  "title": "string (specific action, e.g. 'Pass Medicare for All', not vague like 'Improve healthcare')",
  "description": "string (2-3 sentences: what was promised, context, what success looks like)",
  "category": "Economy | Healthcare | Environment | Immigration | Education | Infrastructure | Foreign Policy | Justice | Housing | Technology | Other",
  "dateMade": "YYYY-MM-DD (when FIRST promised, not recently repeated)",
  "sourceUrl": "string (where promise was made — not Wikipedia, not YouTube)",
  "severity": "number 1-5 (5 = defining campaign promise, 1 = minor)",
  "expectedMonths": "number (reasonable time to fulfill)",
  "billRelated": "boolean (tied to specific legislation?)",
  "timeline": [{
    "date": "YYYY-MM-DD",
    "type": "status_change | executive_action | legislation | news",
    "title": "string (name specific bills, EO numbers, concrete actions)",
    "description": "string",
    "sourceUrl": "string",
    "newStatus": "NOT_STARTED | IN_PROGRESS | PARTIAL | FULFILLED | BROKEN | REVERSED (only for status_change, null otherwise)"
  }]
}]

IMPORTANT: If a promise has executive actions or legislation in its timeline, its status CANNOT be NOT_STARTED. You MUST include a status_change event in the timeline reflecting the progress. For example, if an executive order was signed related to a promise, add a status_change event on that same date moving the status to at least IN_PROGRESS.

Return ONLY the JSON array, no other text.`;

  const userPrompt = `Research ${politicianName} (${party}, ${position}). Find their 15-20 most significant campaign promises from their entire career. For each one, trace what has actually happened — every bill, vote, executive order, and development with real dates. Be thorough and current through ${today}. Do not use Wikipedia or YouTube as sources.`;

  const text = await callPerplexity(systemPrompt, userPrompt, MODEL_RESEARCH);
  const parsed = parseJsonFromResponse(text);

  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array from research response");
  }

  const results = parsed.map((item: Record<string, unknown>) => processResearchItem(item));

  // Post-processing: detect and warn about lazy AI output
  validateResearchQuality(results);

  // Infer status from timeline when AI forgot to add status_change events
  inferStatusFromTimeline(results);

  return results;
}

// ══════════════════════════════════════════════
// Post-processing & validation
// ══════════════════════════════════════════════

// Strip Perplexity citation markers like [1], [2], [3] from text
function stripCitations(text: string): string {
  return text.replace(/\[\d+\]/g, "").replace(/\s{2,}/g, " ").trim();
}

function validateResearchQuality(results: ResearchedPromise[]): void {
  // Warn about lazy same-day dateMade (log only)
  const dateCounts: Record<string, number> = {};
  for (const p of results) {
    dateCounts[p.dateMade] = (dateCounts[p.dateMade] || 0) + 1;
  }
  for (const [date, count] of Object.entries(dateCounts)) {
    if (count > 2) {
      console.warn(`[Research Quality] Lazy dates detected: ${count} promises share dateMade=${date}`);
    }
  }

  // Warn about lazy same sourceUrl (log only)
  const srcCounts: Record<string, number> = {};
  for (const p of results) {
    if (p.sourceUrl) {
      srcCounts[p.sourceUrl] = (srcCounts[p.sourceUrl] || 0) + 1;
    }
  }
  for (const [url, count] of Object.entries(srcCounts)) {
    if (count > 2) {
      console.warn(`[Research Quality] Lazy sources detected: ${count} promises share sourceUrl=${url}`);
    }
  }
}

function inferStatusFromTimeline(results: ResearchedPromise[]): void {
  for (const p of results) {
    if (p.status === "FULFILLED" || p.status === "BROKEN") continue;

    const hasExecAction = p.timeline.some((e) => e.type === "executive_action");
    const hasLegislation = p.timeline.some((e) => e.type === "legislation");
    const hasNews = p.timeline.some((e) => e.type === "news");

    if (p.status === "NOT_STARTED" && (hasExecAction || hasLegislation)) {
      const oldStatus = p.status;
      // Executive actions + news showing progress → PARTIAL; otherwise IN_PROGRESS
      if (hasExecAction && hasNews && p.timeline.length >= 3) {
        p.status = "PARTIAL";
      } else {
        p.status = "IN_PROGRESS";
      }
      console.log(`[Status Inference] "${p.title}": ${oldStatus} → ${p.status} (has ${hasExecAction ? "executive_action" : ""}${hasExecAction && hasLegislation ? "+" : ""}${hasLegislation ? "legislation" : ""} events)`);
    }
  }
}

function processResearchItem(item: Record<string, unknown>): ResearchedPromise {
  const VALID_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "FULFILLED", "PARTIAL", "BROKEN", "REVERSED"];

  // Source validation
  const rawSourceUrl = String(item.sourceUrl || "");
  const sourceUrl = sanitizeSourceUrl(rawSourceUrl, String(item.title || ""));

  const dateMade = String(item.dateMade || new Date().toISOString().split("T")[0]);

  // Process timeline
  const rawTimeline = Array.isArray(item.timeline) ? item.timeline : [];
  const now = new Date();
  const timeline: TimelineEvent[] = [];

  for (const evt of rawTimeline) {
    if (!evt || typeof evt !== "object") continue;
    const evtObj = evt as Record<string, unknown>;

    const evtDate = String(evtObj.date || "");
    const evtDateObj = new Date(evtDate);
    if (!evtDate || isNaN(evtDateObj.getTime()) || evtDateObj > now) continue;

    const evtType = String(evtObj.type || "news");
    const validTypes = ["status_change", "executive_action", "legislation", "news"];
    const type = validTypes.includes(evtType) ? evtType : "news";

    const evtSourceUrl = sanitizeSourceUrl(String(evtObj.sourceUrl || ""), String(evtObj.title || ""));

    let newStatus: string | null = null;
    if (type === "status_change" && evtObj.newStatus) {
      const s = String(evtObj.newStatus);
      if (VALID_STATUSES.includes(s)) newStatus = s;
    }

    timeline.push({
      date: evtDate,
      type: type as TimelineEvent["type"],
      title: stripCitations(String(evtObj.title || "")),
      description: stripCitations(String(evtObj.description || "")),
      sourceUrl: evtSourceUrl,
      newStatus,
    });
  }

  // Sort chronologically
  timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Determine current status from last status_change event
  const lastStatusEvent = [...timeline].reverse().find((e) => e.type === "status_change" && e.newStatus);
  const status = lastStatusEvent?.newStatus && VALID_STATUSES.includes(lastStatusEvent.newStatus)
    ? lastStatusEvent.newStatus
    : (VALID_STATUSES.includes(String(item.status || "")) ? String(item.status) : "NOT_STARTED");

  return {
    title: stripCitations(String(item.title || "")),
    description: stripCitations(String(item.description || "")),
    category: String(item.category || "Other"),
    status,
    dateMade,
    sourceUrl,
    severity: Math.max(1, Math.min(5, Number(item.severity) || 3)),
    expectedMonths: Math.max(1, Number(item.expectedMonths) || 12),
    billRelated: item.billRelated === true || item.billRelated === "true",
    timeline,
  };
}

// ══════════════════════════════════════════════
// News Research
// ══════════════════════════════════════════════

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

// ══════════════════════════════════════════════
// BILL MATCHING
// ══════════════════════════════════════════════

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
  "the", "a", "an", "to", "of", "and", "in", "on", "for", "with", "is", "it",
  "by", "as", "at", "or", "from", "that", "this", "be", "will", "all", "their",
  "his", "her", "no", "not", "has", "have", "been", "was", "were", "are",
  "do", "does", "did", "would", "could", "should", "may", "can", "shall",
  "its", "also", "such", "than", "other", "which", "who", "whom", "more",
  "under", "over", "about", "into", "through", "during", "before", "after",
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

const PROCEDURAL_PATTERN = /^(Motion to|Confirmation:|On the Cloture|Shall the Objection)/i;
const BILL_PASSAGE_PATTERN = /^(H\.R\.|S\.|H\.J\.|S\.J\.|H\.Con\.|S\.Con\.)\s*\w/i;

function isSubstantiveBill(title: string): boolean {
  if (PROCEDURAL_PATTERN.test(title)) return false;
  if (/Amdt[\.\s]|Amendment No/i.test(title)) return false;
  if (BILL_PASSAGE_PATTERN.test(title)) return true;
  return false;
}

function preFilterItems(
  promises: PromiseSummary[],
  items: ItemSummary[],
  topN: number = 20,
): ItemSummary[] {
  const selectedIds = new Set<string>();

  for (const item of items) {
    if (isSubstantiveBill(item.title)) {
      selectedIds.add(item.id);
    }
  }

  for (const promise of promises) {
    const keywords = extractKeywords(promise.title + " " + promise.description);
    if (keywords.length === 0) continue;

    const scored = items
      .filter((item) => !PROCEDURAL_PATTERN.test(item.title))
      .map((item) => ({
        item,
        score: scoreItemRelevance(keywords, item.title),
      }));

    const good = scored
      .filter((s) => s.score >= 2)
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);

    good.forEach((s) => selectedIds.add(s.item.id));
  }

  for (const item of items) {
    if (item.type === "action") selectedIds.add(item.id);
  }

  return items.filter((item) => selectedIds.has(item.id));
}

const MATCH_SYSTEM_PROMPT = `You are a legislative analyst matching campaign promises to specific bills.

=== WHAT COUNTS AS A MATCH ===
A bill matches a promise ONLY if the bill's PRIMARY PURPOSE directly addresses the promise's specific action. The connection must be OBVIOUS and DIRECT.

GOOD matches:
- Promise: 'Ban TikTok' ↔ Bill: 'Protecting Americans from Foreign Adversary Controlled Applications Act' (bill literally bans TikTok)
- Promise: 'Impose 10% tariff on all imports' ↔ Bill: 'Universal Baseline Tariff Act' (bill imposes tariffs)
- Promise: 'Pardon Jan 6 defendants' ↔ Executive Action: 'Executive Grant of Clemency for January 6 defendants' (direct action on promise)

BAD matches (DO NOT MAKE THESE):
- Promise: 'Strengthen National Defense' ↔ Bill: 'Confirmation of Pete Hegseth as Secretary of Defense' (confirmation vote ≠ defense policy)
- Promise: 'Secure the border' ↔ Bill: 'Motion to proceed to executive session' (procedural, not substantive)
- Promise: 'Cut taxes' ↔ Bill: 'Continuing Resolution to fund government' (tangentially related at best)

RULES:
- Confirmation votes for nominees are NEVER matches for broad policy promises
- Procedural votes (cloture, motion to proceed) only match if the UNDERLYING BILL directly addresses the promise
- If you have to stretch to explain the connection, it's NOT a match
- Quality over quantity — 2 perfect matches are better than 10 weak ones

For each match, provide:
- promiseId: ID of the promise
- itemId: ID of the bill/action
- alignment: 'aligns' or 'contradicts'
- confidence: 'high' or 'medium'
- reason: ONE sentence explaining the DIRECT connection

IMPORTANT: Many bill titles below are just bill NUMBERS (e.g., 'H.R. 3684, As Amended'). Use your knowledge to identify what these bills are:
- H.R. 3684 = Infrastructure Investment and Jobs Act
- H.R. 5376 = Inflation Reduction Act (climate, healthcare, taxes)
- H.R. 4521 / S. 1260 = CHIPS and Science Act (semiconductor manufacturing)
- H.R. 3967 = PACT Act (veterans healthcare)
- H.R. 8404 = Respect for Marriage Act
- H.R. 7776 = National Defense Authorization Act
- H.R. 1319 = American Rescue Plan
Look up any bill number you don't recognize. Match based on what the bill DOES, not just its title.

Return ONLY a JSON array of matches. If no bills clearly match a promise, return an empty array for that promise.`;

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

Here are the bills/executive actions they voted on or signed. NOTE: Many titles are just bill numbers — use your knowledge to identify what these bills actually do:
${itemList}

For each promise, find bills/actions that DIRECTLY address the promise's specific policy goal (maximum 5 per promise). Many bills are listed by number only (e.g., "H.R. 3684, As Amended") — look up what these bills are and match based on their actual content/purpose.

Return JSON:
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

  const items: ItemSummary[] = [];

  if (politician.branch !== "executive") {
    const votes = await prisma.vote.findMany({
      where: { politicianId },
      select: { bill: { select: { id: true, title: true, billNumber: true } } },
    });
    for (const v of votes) {
      items.push({ id: v.bill.id, title: v.bill.title, type: "bill", billNumber: v.bill.billNumber });
    }
  }

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
      select: { bill: { select: { id: true, title: true, billNumber: true } } },
    });
    for (const v of votes) {
      items.push({ id: v.bill.id, title: v.bill.title, type: "bill", billNumber: v.bill.billNumber });
    }
  }

  const seen = new Set<string>();
  const uniqueItems = items.filter((b) => {
    if (seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  });

  if (uniqueItems.length === 0) return [];

  const filteredItems = preFilterItems(promiseSummaries, uniqueItems, 20);

  console.log(
    `[Match] ${uniqueItems.length} total items → ${filteredItems.length} after keyword pre-filter for ${promises.length} promises`,
  );

  if (filteredItems.length === 0) return [];

  const text = await callPerplexity(
    MATCH_SYSTEM_PROMPT,
    buildMatchUserPrompt(politician.name, promiseSummaries, filteredItems),
    MODEL_MATCHING,
  );
  const parsed = parseJsonFromResponse(text);

  if (!Array.isArray(parsed)) return [];

  const promiseMap = new Map(promiseSummaries.map((p) => [p.id, p.title]));
  const itemMap = new Map(filteredItems.map((b) => [b.id, { title: b.title, type: b.type }]));

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
