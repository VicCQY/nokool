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
  sloganWarning?: boolean;
}

// ══════════════════════════════════════════════
// RESEARCH PROMISES
// ══════════════════════════════════════════════

export interface ResearchContext {
  inOfficeSince?: string | null;
  existingPromises?: { title: string; category: string }[];
}

export async function researchPromises(
  politicianName: string,
  party: string,
  position: string,
  context: ResearchContext = {},
): Promise<ResearchedPromise[]> {
  const today = new Date().toISOString().split("T")[0];
  const { inOfficeSince, existingPromises = [] } = context;

  const systemPrompt = `You are an expert political researcher. Find this politician's campaign promises and trace their complete history.

=== WHAT IS A PROMISE ===
A promise has: a clear FIELD (policy area), a clear SUBJECT (specific thing), a clear DIRECTION (specific action), and optionally a TIMEFRAME.
GOOD: 'Pardon January 6 defendants', 'Impose 10% tariff on imports', 'Abolish the Federal Reserve', 'Legalize industrial hemp'
BAD (slogans, reject these): 'Fight for families', 'Strengthen defense', 'Support Ukraine', 'Cut spending'

=== PRIORITY ===
First 6-10 promises: CORE — the things that DEFINE this politician. Severity 4-5.
Next 5-10 promises: SECONDARY — important positions but not defining. Severity 2-3.

=== STATUS CRITERIA ===
FULFILLED = Goal achieved. Bill signed into law, EO implemented, outcome delivered.
PARTIAL = Led the fight REPEATEDLY. Introduced the SAME bill across MULTIPLE sessions. Pushed for floor votes. Held hearings. Years of sustained leadership. The system blocked them, not lack of effort.
ADVANCING = Introduced a bill OR led a concrete action. One bill introduction, organizing a hearing as chair, co-leading a major push. They took initiative beyond just voting.
IN_PROGRESS = Voted correctly when it came up OR co-sponsored someone else's bill. Supportive but didn't lead.
NOT_STARTED = ZERO action. No votes, no bills, no co-sponsorships, nothing.
BROKEN = Voted AGAINST their own promise or publicly abandoned it.
REVERSED = Did it then undid it.

KEY: Voting yes = IN_PROGRESS. Introducing own bill = ADVANCING. Introducing bills multiple sessions = PARTIAL. Passed into law = FULFILLED.

=== ASPIRATIONAL vs ACHIEVABLE PROMISES ===
Some promises are politically impossible given current reality (e.g., 'Abolish the Federal Reserve', 'End UN membership'). These are real promises but essentially aspirational — no single legislator can achieve them regardless of effort.

For aspirational/impossible promises:
- Lower severity to 1-2 (these aren't realistic campaign commitments, more like ideological positions)
- Give MORE credit for effort: introducing a bill on an impossible topic = ADVANCING even though it will never pass. It shows conviction.
- Do NOT mark these as NOT_STARTED just because the outcome is impossible. If they introduced a bill, that's ADVANCING. If they talk about it regularly and vote consistently, that's IN_PROGRESS.
- The key question is: are they sincere about this position? Not: will it ever happen?

=== TIMELINE RULES ===
Every event must be CONCRETE and VERIFIABLE:
GOOD: 'Jan 8, 2023 — Introduced H.R. 664 American Sovereignty Restoration Act'
BAD: 'Elected to Congress', 'Established platform', 'Advocated for reform'
Getting elected, joining committees, making speeches, and endorsing ideas are NOT timeline events.
If no concrete action was taken, the timeline must be EMPTY and status must be NOT_STARTED.

=== SOURCES ===
NEVER use Wikipedia or YouTube. Each promise should have a unique source URL from: .gov sites, C-SPAN, AP, Reuters, NYT, WaPo, Politico, The Hill, CNN, Fox News, NPR, official campaign sites.

=== NO DUPLICATES ===
One promise per distinct policy action. Do not create overlapping promises.
Each promise must have a UNIQUE dateMade — find when FIRST announced, not a recent repetition.

=== FORMAT ===
Return ONLY a JSON array:
[{
  "title": "string",
  "description": "string (2-3 sentences: what was promised, context, what success looks like)",
  "category": "Economy | Healthcare | Environment | Immigration | Education | Infrastructure | Foreign Policy | Justice | Housing | Technology | Other",
  "dateMade": "YYYY-MM-DD (when FIRST promised)",
  "sourceUrl": "string (not Wikipedia/YouTube)",
  "severity": "number 1-5",
  "expectedMonths": "number",
  "billRelated": "boolean",
  "timeline": [{
    "date": "YYYY-MM-DD (real date, NEVER today)",
    "type": "status_change | executive_action | legislation | news",
    "title": "string (name specific bills, EO numbers)",
    "description": "string",
    "sourceUrl": "string",
    "newStatus": "FULFILLED | PARTIAL | ADVANCING | IN_PROGRESS | NOT_STARTED | BROKEN | REVERSED (only for status_change, null otherwise)"
  }]
}]
No markdown, no explanation, ONLY the JSON array.`;

  // Build dynamic user prompt based on context
  const yearsServed = inOfficeSince
    ? Math.floor((Date.now() - new Date(inOfficeSince).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;
  const officeInfo = inOfficeSince
    ? `, in office since ${new Date(inOfficeSince).getFullYear()}, served ${yearsServed} years`
    : "";

  let userPrompt: string;

  if (existingPromises.length > 0) {
    // Re-research: find additional promises we're missing
    const categories = Array.from(new Set(existingPromises.map((p) => p.category))).join(", ");
    const existingTitles = existingPromises.map((p) => `"${p.title}"`).join(", ");
    userPrompt = `Research ${politicianName} (${party}, ${position}${officeInfo}).

They have ${existingPromises.length} tracked promises on: ${categories}. Find ADDITIONAL significant promises we're missing. Do not duplicate: ${existingTitles}.

For each new promise, trace what has happened through ${today}.`;
  } else {
    // Initial research
    userPrompt = `Research ${politicianName} (${party}, ${position}${officeInfo}).

What are the 6-10 things this politician is MOST known for fighting for or against? What defines them politically? What specific bills have they introduced or led? What distinguishes them from other ${party} members?

Find their 15-20 most significant promises from their entire career. For each, trace every bill introduced, vote cast, executive order, and development with real dates through ${today}.`;
  }

  // Retry up to 2 times if Perplexity returns non-JSON (narrative text, refusals)
  const MAX_ATTEMPTS = 3;
  let parsed: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const text = await callPerplexity(systemPrompt, userPrompt, MODEL_RESEARCH);

    const trimmed = text.replace(/```(?:json)?\s*/gi, "").trim();
    if (!trimmed.includes("[")) {
      console.warn(`[Research] Attempt ${attempt}/${MAX_ATTEMPTS}: AI returned non-JSON response:`, text.slice(0, 300));
      if (attempt === MAX_ATTEMPTS) {
        throw new Error("Research failed after multiple attempts — the AI kept returning non-JSON. Please try again.");
      }
      continue;
    }

    try {
      parsed = parseJsonFromResponse(text);
    } catch {
      console.warn(`[Research] Attempt ${attempt}/${MAX_ATTEMPTS}: Failed to parse response:`, text.slice(0, 300));
      if (attempt === MAX_ATTEMPTS) {
        throw new Error("Research failed after multiple attempts — could not parse AI response. Please try again.");
      }
      continue;
    }

    if (!Array.isArray(parsed)) {
      console.warn(`[Research] Attempt ${attempt}/${MAX_ATTEMPTS}: Response is not an array:`, typeof parsed);
      if (attempt === MAX_ATTEMPTS) {
        throw new Error("Research failed after multiple attempts. Please try again.");
      }
      continue;
    }

    // Treat empty array as a failed attempt — Perplexity sometimes returns [] with 1 token
    if (parsed.length === 0) {
      console.warn(`[Research] Attempt ${attempt}/${MAX_ATTEMPTS}: Perplexity returned empty array []`);
      if (attempt === MAX_ATTEMPTS) {
        throw new Error("Research failed — the AI returned no results after multiple attempts. Please try again.");
      }
      continue;
    }

    // Success — break out of retry loop
    break;
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Research failed — please try again");
  }

  const results = parsed.map((item: Record<string, unknown>) => processResearchItem(item));

  // Post-processing: deduplicate by title
  const deduped = deduplicateByTitle(results);

  // Detect and warn about lazy AI output
  validateResearchQuality(deduped);

  // Infer status from timeline when AI forgot to add status_change events
  inferStatusFromTimeline(deduped);

  // Flag possible slogans
  flagSlogans(deduped);

  return deduped;
}

// ══════════════════════════════════════════════
// Post-processing & validation
// ══════════════════════════════════════════════

function deduplicateByTitle(results: ResearchedPromise[]): ResearchedPromise[] {
  const seen = new Set<string>();
  const deduped: ResearchedPromise[] = [];
  for (const p of results) {
    const key = p.title.toLowerCase().trim();
    if (seen.has(key)) {
      console.warn(`[Research Quality] Removed duplicate promise: "${p.title}"`);
      continue;
    }
    seen.add(key);
    deduped.push(p);
  }
  return deduped;
}

// Detect vague/slogan-like titles: too short, no verb, or just a noun phrase
const ACTION_VERBS = /\b(pass|repeal|ban|impose|cut|raise|create|eliminate|end|build|fund|expand|reduce|withdraw|sign|pardon|abolish|legalize|decriminalize|deport|secure|close|open|reform|restore|protect|defund|audit|investigate|release|declassify|introduce|co-sponsor|vote|mandate|require|prohibit|block|overturn|implement|negotiate|renegotiate)\b/i;

function flagSlogans(results: ResearchedPromise[]): void {
  for (const p of results) {
    const words = p.title.trim().split(/\s+/);
    const hasVerb = ACTION_VERBS.test(p.title);
    // Flag if: very short (1-2 words), or no action verb detected
    if (words.length <= 2 || !hasVerb) {
      p.sloganWarning = true;
      console.warn(`[Research Quality] Possible slogan: "${p.title}"`);
    }
  }
}

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
      // Executive actions + news showing progress → PARTIAL; multiple actions → ADVANCING; otherwise IN_PROGRESS
      if (hasExecAction && hasNews && p.timeline.length >= 3) {
        p.status = "PARTIAL";
      } else if ((hasExecAction || hasLegislation) && p.timeline.length >= 2) {
        p.status = "ADVANCING";
      } else {
        p.status = "IN_PROGRESS";
      }
      console.log(`[Status Inference] "${p.title}": ${oldStatus} → ${p.status} (has ${hasExecAction ? "executive_action" : ""}${hasExecAction && hasLegislation ? "+" : ""}${hasLegislation ? "legislation" : ""} events)`);
    }
  }
}

function processResearchItem(item: Record<string, unknown>): ResearchedPromise {
  const VALID_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "ADVANCING", "FULFILLED", "PARTIAL", "BROKEN", "REVERSED"];

  // Source validation
  const rawSourceUrl = String(item.sourceUrl || "");
  const sourceUrl = sanitizeSourceUrl(rawSourceUrl, String(item.title || ""));

  // Date validation — fallback to today if AI returned an unparseable date
  const rawDateMade = String(item.dateMade || "");
  const dateMade = rawDateMade && !isNaN(new Date(rawDateMade).getTime())
    ? rawDateMade
    : new Date().toISOString().split("T")[0];

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
