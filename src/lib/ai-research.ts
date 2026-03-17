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

/** Call 1 result: promise without timeline/status */
export interface ResearchedPromiseBase {
  title: string;
  description: string;
  category: string;
  dateMade: string;
  sourceUrl: string;
  severity: number;
  expectedMonths: number;
  billRelated: boolean;
}

/** Full promise with timeline (after Call 2 merges in) */
export interface ResearchedPromise extends ResearchedPromiseBase {
  status: string;
  timeline: TimelineEvent[];
}

/** Call 2 result: timeline for a specific promise */
export interface TimelineResult {
  title: string;
  currentStatus: string;
  timeline: TimelineEvent[];
}

// ══════════════════════════════════════════════
// CALL 1: FIND PROMISES (no timelines, no statuses)
// ══════════════════════════════════════════════

export async function researchPromises(
  politicianName: string,
  party: string,
  position: string,
  todayDate?: string,
): Promise<ResearchedPromiseBase[]> {
  const today = todayDate || new Date().toISOString().split("T")[0];

  const systemPrompt = `You are an expert political researcher. Your job is to find campaign promises — NOT to trace their history (that comes later).

=== QUALITY REQUIREMENTS ===

ZERO DUPLICATES: Before finalizing, review ALL promises and remove any that cover the same policy action. 'Boost domestic microchip production' and 'Invest in microchip manufacturing' are the SAME promise — pick the better title and merge them.

UNIQUE DATES FOR dateMade: Each promise was made at a DIFFERENT time. Do NOT set all promises to the same date. Find the ACTUAL date each promise was first made:
- Campaign announcement speeches have different dates
- Policy platform releases have dates
- Debate statements have dates
- Rally speeches have dates
- Press conferences have dates
- Op-eds and published plans have dates
If you cannot find the exact date, use the date of the earliest source you can find. EVERY promise should have a DIFFERENT dateMade unless genuinely announced together in the same speech.

UNIQUE SOURCES: Each promise should link to a DIFFERENT source URL. Do not use the same article for 10 promises.

=== STRICT FORMATTING ===

Promise title format: "[Action verb] [specific subject]"
GOOD: "Impose 10% universal tariff on all imports"
GOOD: "Pardon January 6 defendants"
BAD: "Tariffs" (no action, no specifics)
BAD: "Deal with immigration" (vague)

Promise description format: "On [date], [politician] promised to [specific action]. This would [concrete impact]."

=== WHAT COUNTS AS A PROMISE ===
A promise MUST have ALL of these:
1. A clear FIELD (policy area: education, immigration, economy, healthcare, etc.)
2. A clear SUBJECT (specific thing: school lunches, TikTok, the border wall, Medicare)
3. A clear DIRECTION (specific action: make free, ban, build, pardon, impose X% tariff)
4. A TIMEFRAME if one was stated (optional: 'within 24 hours', 'by 2028', 'day one')

GOOD: 'Impose 10% universal tariff on all imports'
BAD: 'Strengthen National Defense' (no specific subject or action)
BAD: 'Fight for working families' (slogan)

=== NO OVERLAP ===
ONE promise per distinct policy action. Do NOT create multiple promises for the same thing.

=== OUTPUT FORMAT ===
For each promise, return ONLY these fields:
1. title: Clear promise name
2. description: 2-3 sentences explaining what was promised
3. category: Economy, Healthcare, Environment, Immigration, Education, Infrastructure, Foreign Policy, Justice, Housing, Technology, Other
4. dateMade: YYYY-MM-DD when the promise was FIRST made
5. sourceUrl: where the promise was made. NEVER use wikipedia.org or youtube.com.
6. severity: 1-5 (5=cornerstone campaign promise, 4=major, 3=standard, 2=minor, 1=trivial)
7. expectedMonths: reasonable months to fulfill
8. billRelated: true/false — tied to specific legislation or executive action?

DO NOT include: status, timeline, or any history. Just the promises themselves.

CRITICAL — FIND ORIGINAL PROMISE DATES: Do NOT use compilation dates. Find when each promise was FIRST made:
- 'No tax on tips' was first announced at a rally in June 2024, not when a compilation was posted later
- 'Build the wall' was first promised in 2015, not during a 2024 speech
Each promise has a unique origin — find it.

LAZY OUTPUT WILL BE REJECTED:
- If more than 2 promises share the same dateMade, the ENTIRE response will be rejected.
- If more than 2 promises share the same sourceUrl, the ENTIRE response will be rejected.
- If any source is YouTube or Wikipedia, the ENTIRE response will be rejected.

VERIFY YOUR OWN WORK:
□ Are there any duplicate promises? REMOVE THEM.
□ Does every promise have a unique dateMade? FIX lazy same-day dates.
□ Is every sourceUrl a real, working URL (not Wikipedia or YouTube)? FIX bad sources.

Be thorough — find at least 15 promises, cover ALL major policy areas they campaigned on.
Prioritize: cornerstone promises first, then major, then minor.

Return ONLY a JSON array. No markdown, no explanation.`;

  const userPrompt = `Find ALL major campaign promises made by ${politicianName} (${party}), who serves as ${position}. Today is ${today}.

For each promise, return: title, description, category, dateMade, sourceUrl, severity, expectedMonths, billRelated.

DO NOT include timelines or statuses — just the promises themselves.

NEVER use Wikipedia or YouTube as a source.`;

  const text = await callPerplexity(systemPrompt, userPrompt, MODEL_RESEARCH);
  const parsed = parseJsonFromResponse(text);

  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array from research response");
  }

  const results = parsed.map((item: Record<string, unknown>) => processPromiseItem(item));

  // Post-processing quality checks
  validatePromiseQuality(results);

  return results;
}

// ══════════════════════════════════════════════
// CALL 2: BUILD TIMELINES (for approved promises)
// ══════════════════════════════════════════════

export async function researchTimelines(
  politicianName: string,
  party: string,
  position: string,
  promises: ResearchedPromiseBase[],
  todayDate?: string,
): Promise<TimelineResult[]> {
  const today = todayDate || new Date().toISOString().split("T")[0];

  const promiseList = promises
    .map((p, i) => `${i + 1}. "${p.title}" (made ${p.dateMade}): ${p.description.slice(0, 120)}`)
    .join("\n");

  const systemPrompt = `You are an expert political fact-checker. You will be given a list of campaign promises that have already been identified. Your ONLY job is to build a complete timeline of actions taken on each promise, and determine its current status.

=== TIMELINE EVENT RULES ===
Timeline events must be CONCRETE actions with REAL dates and PROOF:

GOOD timeline events:
- "2025-01-20: Executive Order signed imposing 10% tariff (source: whitehouse.gov)"
- "2025-03-04: Additional 10% tariff on Chinese goods takes effect (source: reuters.com)"
- "2025-02-01: Bill H.R. 123 introduced in House (source: congress.gov)"

BAD timeline events (DO NOT INCLUDE):
- "2024-11-05: Trump wins election" (not an action on the promise)
- "2025-01-20: Trump takes office" (not an action on the promise)
- "Experts debate tariff impact" (opinion, not action)
- "Promise was made during campaign" (that's dateMade, not a timeline event)

Every timeline event MUST:
- Name a specific executive order number (e.g., 'EO 14159')
- Name a specific bill (e.g., 'HR-3684 Infrastructure Investment and Jobs Act')
- Name a specific vote or signing date
- Reference a REAL, NAMED action — NOT vague words like 'initiated', 'launched', 'established', 'advocated', 'prioritized'

If you cannot find a specific real event with a real date and real source, do NOT create a vague placeholder. An empty timeline with NOT_STARTED status is better than a fake timeline.

=== STATUS CHANGE RULES ===
A status_change event REQUIRES concrete proof:
- NOT_STARTED → IN_PROGRESS: A bill was introduced, an executive order was drafted, formal process began
- IN_PROGRESS → PARTIAL: Some measurable part of the promise was delivered but not all
- IN_PROGRESS → FULFILLED: The complete promise was delivered as stated
- Any → BROKEN: The politician explicitly abandoned the promise or took opposite action
- Any → REVERSED: A previously fulfilled promise was undone

If NO concrete action has been taken, timeline should be EMPTY and currentStatus should be NOT_STARTED.

=== UNDERSTAND WHAT LEGISLATORS CAN DO ===
Senators and Representatives cannot unilaterally fulfill promises — they work through legislation. For legislators, IN_PROGRESS actions include:
- Introduced or co-sponsored a bill
- Voted YES on a related bill
- Held or participated in committee hearings
- Secured committee passage of a related bill
- Attached related amendments to other bills
NOT_STARTED means they have done literally NOTHING — no bills, no votes, no hearings.

=== OUTPUT FORMAT ===
For each promise, return:
{
  "title": "exact promise title from input",
  "currentStatus": "NOT_STARTED" | "IN_PROGRESS" | "PARTIAL" | "FULFILLED" | "BROKEN" | "REVERSED",
  "timeline": [
    {
      "date": "YYYY-MM-DD",
      "type": "status_change" | "executive_action" | "legislation" | "news",
      "title": "what happened",
      "description": "1-2 sentences with details",
      "sourceUrl": "URL proving this happened",
      "newStatus": "STATUS" (only for status_change type, null for others)
    }
  ]
}

The timeline MUST:
- Start with the first action taken (skip if NOT_STARTED)
- Include EVERY major development with REAL dates
- Events must be chronologically ordered
- The LAST status_change determines currentStatus

NEVER use wikipedia.org, youtube.com, or youtu.be as a source URL.
Every date must be the REAL date of the event, never today's date.

YOUR RESEARCH MUST BE CURRENT. If a politician has taken action on a promise, the timeline MUST reflect that. An empty timeline on a promise where action has been taken is a FAILURE.

LAZY OUTPUT WILL BE REJECTED:
- If any timeline event says 'initiated', 'launched', 'established', 'advocated', or 'prioritized' without naming a SPECIFIC bill number, executive order number, or concrete action, it will be deleted.
- If any source is YouTube or Wikipedia, the ENTIRE response will be rejected.

Return ONLY a JSON array. No markdown, no explanation.`;

  const userPrompt = `Build complete timelines for these campaign promises by ${politicianName} (${party}, ${position}). Today is ${today}.

${promiseList}

For each promise, trace its COMPLETE history from when it was made through today. Include every executive action, legislative action, and status change with real dates and sources. Return currentStatus and timeline array for each.

NEVER use Wikipedia or YouTube as a source.`;

  const text = await callPerplexity(systemPrompt, userPrompt, MODEL_RESEARCH);
  const parsed = parseJsonFromResponse(text);

  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array from timeline response");
  }

  const results = parsed.map((item: Record<string, unknown>) =>
    processTimelineItem(item),
  );

  // Post-processing: scrub vague events
  validateTimelineQuality(results);

  return results;
}

// ══════════════════════════════════════════════
// Processing helpers
// ══════════════════════════════════════════════

// Strip Perplexity citation markers like [1], [2], [3] from text
function stripCitations(text: string): string {
  return text.replace(/\[\d+\]/g, "").replace(/\s{2,}/g, " ").trim();
}

/** Process a Call 1 result item (promise without timeline) */
function processPromiseItem(item: Record<string, unknown>): ResearchedPromiseBase {
  const rawSourceUrl = String(item.sourceUrl || "");
  const sourceUrl = sanitizeSourceUrl(rawSourceUrl, String(item.title || ""));
  const dateMade = String(item.dateMade || new Date().toISOString().split("T")[0]);

  return {
    title: stripCitations(String(item.title || "")),
    description: stripCitations(String(item.description || "")),
    category: String(item.category || "Other"),
    dateMade,
    sourceUrl,
    severity: Math.max(1, Math.min(5, Number(item.severity) || 3)),
    expectedMonths: Math.max(1, Number(item.expectedMonths) || 12),
    billRelated: item.billRelated === true || item.billRelated === "true",
  };
}

/** Process a Call 2 result item (timeline for a promise) */
function processTimelineItem(
  item: Record<string, unknown>,
): TimelineResult {
  const VALID_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "FULFILLED", "PARTIAL", "BROKEN", "REVERSED"];

  const title = stripCitations(String(item.title || ""));

  // Process timeline events
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

  // Determine current status from last status_change event, or from AI's currentStatus field
  const lastStatusEvent = [...timeline].reverse().find((e) => e.type === "status_change" && e.newStatus);
  let currentStatus: string;
  if (lastStatusEvent?.newStatus && VALID_STATUSES.includes(lastStatusEvent.newStatus)) {
    currentStatus = lastStatusEvent.newStatus;
  } else if (VALID_STATUSES.includes(String(item.currentStatus || ""))) {
    currentStatus = String(item.currentStatus);
  } else {
    currentStatus = "NOT_STARTED";
  }

  return { title, currentStatus, timeline };
}

// ── Vague action words that indicate lazy AI output ──
const VAGUE_WORDS = /\b(initiated|launched|established|advocated|prioritized)\b/i;
const HAS_SPECIFIC_REF = /\b(H\.?R\.?\s*\d|S\.?\s*\d|EO\s*\d|Executive Order\s*\d|P\.?L\.?\s*\d|Public Law\s*\d)/i;

function validatePromiseQuality(results: ResearchedPromiseBase[]): void {
  // Check for lazy same-day dateMade
  const dateCounts: Record<string, number> = {};
  for (const p of results) {
    dateCounts[p.dateMade] = (dateCounts[p.dateMade] || 0) + 1;
  }
  for (const [date, count] of Object.entries(dateCounts)) {
    if (count > 2) {
      console.warn(`[Research Quality] Lazy dates detected: ${count} promises share dateMade=${date}`);
    }
  }

  // Check for lazy same sourceUrl
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

function validateTimelineQuality(results: TimelineResult[]): void {
  for (const r of results) {
    const before = r.timeline.length;
    r.timeline = r.timeline.filter((evt) => {
      const text = `${evt.title} ${evt.description}`;
      if (VAGUE_WORDS.test(text) && !HAS_SPECIFIC_REF.test(text)) {
        console.warn(`[Research Quality] Removed vague event from "${r.title}": "${evt.title}"`);
        return false;
      }
      return true;
    });

    // If we removed events, re-derive status from remaining timeline
    if (r.timeline.length < before) {
      const lastStatus = [...r.timeline].reverse().find((e) => e.type === "status_change" && e.newStatus);
      if (lastStatus?.newStatus) {
        r.currentStatus = lastStatus.newStatus;
      } else if (r.timeline.length === 0) {
        r.currentStatus = "NOT_STARTED";
      }
    }
  }
}

// ══════════════════════════════════════════════
// News Research (unchanged)
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
// BILL MATCHING (unchanged)
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
