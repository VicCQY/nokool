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
  type: "executive_action" | "legislation";
  title: string;
  description: string;
  sourceUrl: string;
}

export interface ResearchedPromise {
  title: string;
  description: string;
  category: string;
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

  const systemPrompt = `You are an expert political researcher. Find this politician's campaign promises, and for each one, find what BILLS they INTRODUCED or CO-SPONSORED and what EXECUTIVE ACTIONS they took.

You do NOT determine statuses — that is calculated automatically from the events you provide.

Your PRIMARY job is finding BILL INTRODUCTIONS and BILL PASSAGES for each promise. Search thoroughly for:
- Every bill this politician INTRODUCED (they are the sponsor)
- Every bill this politician CO-SPONSORED that directly relates to the promise
- Every bill that PASSED INTO LAW that they introduced or co-sponsored

A bill counts ONLY if the politician was the SPONSOR or CO-SPONSOR. Random bills they voted on do NOT count — our bill matching system handles votes separately.

For bill passages: only mark as "signed into law" if the politician INTRODUCED or CO-SPONSORED the bill that passed. A bill passing that they merely voted for is a vote, not their legislation.

Here is a PERFECT example:

[
  {
    "title": "Legalize industrial hemp farming nationwide",
    "description": "Championed legalization of industrial hemp for Kentucky farmers. Introduced the Industrial Hemp Farming Act multiple times. Success means removing hemp from the Controlled Substances Act.",
    "category": "Economy",
    "dateMade": "2013-03-07",
    "sourceUrl": "https://massie.house.gov/news/documentsingle.aspx?DocumentID=397775",
    "severity": 4,
    "expectedMonths": 72,
    "billRelated": true,
    "timeline": [
      {
        "date": "2013-03-07",
        "type": "legislation",
        "title": "Introduced H.R. 525 Industrial Hemp Farming Act",
        "description": "First introduction of bill to legalize hemp farming.",
        "sourceUrl": "https://www.congress.gov/bill/113th-congress/house-bill/525"
      },
      {
        "date": "2015-01-08",
        "type": "legislation",
        "title": "Re-introduced H.R. 262 Industrial Hemp Farming Act",
        "description": "Second introduction in 114th Congress.",
        "sourceUrl": "https://www.congress.gov/bill/114th-congress/house-bill/262"
      },
      {
        "date": "2017-01-03",
        "type": "legislation",
        "title": "Re-introduced H.R. 3530 Industrial Hemp Farming Act",
        "description": "Third introduction in 115th Congress.",
        "sourceUrl": "https://www.congress.gov/bill/115th-congress/house-bill/3530"
      },
      {
        "date": "2018-12-20",
        "type": "legislation",
        "title": "2018 Farm Bill signed into law — hemp federally legal",
        "description": "Agriculture Improvement Act of 2018 signed, removing hemp from Schedule I.",
        "sourceUrl": "https://www.congress.gov/bill/115th-congress/house-bill/2"
      }
    ]
  },
  {
    "title": "Force release of classified Jeffrey Epstein files",
    "description": "Co-led bipartisan push with Ro Khanna to declassify Epstein files. Success means full public release.",
    "category": "Justice",
    "dateMade": "2023-05-15",
    "sourceUrl": "https://massie.house.gov/news/documentsingle.aspx?DocumentID=404589",
    "severity": 4,
    "expectedMonths": 24,
    "billRelated": true,
    "timeline": [
      {
        "date": "2023-07-12",
        "type": "legislation",
        "title": "Co-sponsored bipartisan Epstein disclosure resolution with Rep. Khanna",
        "description": "Filed resolution demanding release of all federal Epstein documents.",
        "sourceUrl": "https://khanna.house.gov/media/press-releases/khanna-massie-introduce-bipartisan-resolution-epstein"
      }
    ]
  },
  {
    "title": "Abolish the Federal Reserve System",
    "description": "Introduced legislation to end the Federal Reserve. Aspirational libertarian position unlikely to pass but shows ideological commitment.",
    "category": "Economy",
    "dateMade": "2013-09-17",
    "sourceUrl": "https://massie.house.gov/news/documentsingle.aspx?DocumentID=398001",
    "severity": 2,
    "expectedMonths": 120,
    "billRelated": true,
    "timeline": [
      {
        "date": "2013-09-17",
        "type": "legislation",
        "title": "Introduced H.R. 73 Federal Reserve Board Abolition Act",
        "description": "First introduction of bill to abolish the Fed.",
        "sourceUrl": "https://www.congress.gov/bill/113th-congress/house-bill/73"
      },
      {
        "date": "2024-05-15",
        "type": "legislation",
        "title": "Re-introduced Federal Reserve Board Abolition Act in 118th Congress",
        "description": "Continued multi-session effort.",
        "sourceUrl": "https://www.congress.gov/bill/118th-congress/house-bill/8421"
      }
    ]
  }
]

NOTES:
- Promises must be SPECIFIC (not slogans). Must have: clear field, clear subject, clear action.
- GOOD: 'Legalize industrial hemp', 'Abolish the Federal Reserve', 'Ban TikTok'
- BAD: 'Fight for families', 'Strengthen defense', 'Support freedom'
- dateMade = when FIRST promised, not recent repetition
- Timeline event type "legislation" = bill INTRODUCTIONS and SPONSORSHIPS only (when the politician introduced or co-sponsored a bill)
- Timeline event type "executive_action" = executive orders, memorandums, proclamations, bills signed/vetoed
- Bill VOTES are NOT returned by the AI — our bill matching system handles those separately. NEVER return a "bill_vote" type event.
- Valid timeline event types: "legislation" (introductions) and "executive_action" ONLY
- Name specific bill numbers (H.R. XXX, S. XXX) and EO numbers
- NEVER use Wikipedia or YouTube as sources
- First 6-10 promises = CORE (severity 4-5), next 5-10 = SECONDARY (severity 2-3)
- Aspirational/impossible promises get low severity (1-2) but still track the effort
- No duplicates, unique dates, unique sources where possible

CRITICAL: Return ONLY a raw JSON array starting with [ and ending with ]. No markdown, no code fences, no explanation.`;

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

For each new promise, find related bill introductions and executive actions through ${today}.`;
  } else {
    // Initial research
    userPrompt = `Research ${politicianName} (${party}, ${position}${officeInfo}).

What are the 6-10 things this politician is MOST known for fighting for or against? What defines them politically? What specific bills have they introduced or led? What distinguishes them from other ${party} members?

Find their 15-20 most significant promises. For each, find every bill they introduced and every executive action they took related to it, with real dates and bill/EO numbers through ${today}.`;
  }

  // Retry with fallback: try sonar-pro 3 times, then sonar 3 times
  const MODEL_FALLBACK = "sonar";
  const ATTEMPTS_PER_MODEL = 3;
  const models = [MODEL_RESEARCH, MODEL_FALLBACK];
  let parsed: unknown;
  let succeeded = false;

  for (const model of models) {
    if (succeeded) break;

    for (let attempt = 1; attempt <= ATTEMPTS_PER_MODEL; attempt++) {
      const label = `[Research] ${model} attempt ${attempt}/${ATTEMPTS_PER_MODEL}`;
      const text = await callPerplexity(systemPrompt, userPrompt, model);

      const trimmed = text.replace(/```(?:json)?\s*/gi, "").trim();
      if (!trimmed.includes("[")) {
        console.warn(`${label}: AI returned non-JSON response:`, text.slice(0, 300));
        continue;
      }

      try {
        parsed = parseJsonFromResponse(text);
      } catch {
        console.warn(`${label}: Failed to parse response:`, text.slice(0, 300));
        continue;
      }

      if (!Array.isArray(parsed)) {
        console.warn(`${label}: Response is not an array:`, typeof parsed);
        continue;
      }

      if (parsed.length === 0) {
        console.warn(`${label}: Perplexity returned empty array []`);
        continue;
      }

      // Success
      if (model === MODEL_FALLBACK) {
        console.log(`[Research] Succeeded with fallback model ${MODEL_FALLBACK} on attempt ${attempt}`);
      }
      succeeded = true;
      break;
    }
  }

  if (!succeeded || !Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Research failed after multiple attempts with both models. Please try again.");
  }

  const results = parsed.map((item: Record<string, unknown>) => processResearchItem(item));

  // Post-processing: deduplicate by title
  const deduped = deduplicateByTitle(results);

  // Detect and warn about lazy AI output
  validateResearchQuality(deduped);

  // Status is now calculated from events by calculate-promise-status.ts — no inference needed here

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

const VALID_CATEGORIES = new Set([
  "Economy", "Healthcare", "Environment", "Immigration", "Education",
  "Infrastructure", "Foreign Policy", "Justice", "Housing", "Technology", "Other",
]);

const CATEGORY_ALIASES: Record<string, string> = {
  "Health": "Healthcare",
  "Constitution": "Justice",
  "Civil Liberties": "Justice",
  "Social Policy": "Other",
  "Government Reform": "Other",
  "Agriculture": "Economy",
  "Energy": "Economy",
  "Defense": "Foreign Policy",
  "National Security": "Foreign Policy",
  "Gun Rights": "Justice",
  "Guns": "Justice",
  "Civil Rights": "Justice",
  "Trade": "Economy",
  "Labor": "Economy",
  "Taxes": "Economy",
  "Budget": "Economy",
};

function normalizeCategory(raw: string): string {
  const trimmed = raw.trim();
  if (VALID_CATEGORIES.has(trimmed)) return trimmed;
  if (CATEGORY_ALIASES[trimmed]) return CATEGORY_ALIASES[trimmed];
  return "Other";
}

function processResearchItem(item: Record<string, unknown>): ResearchedPromise {
  // Source validation
  const rawSourceUrl = String(item.sourceUrl || "");
  const sourceUrl = sanitizeSourceUrl(rawSourceUrl, String(item.title || ""));

  // Date validation — fallback to today if AI returned an unparseable date
  const rawDateMade = String(item.dateMade || "");
  const dateMade = rawDateMade && !isNaN(new Date(rawDateMade).getTime())
    ? rawDateMade
    : new Date().toISOString().split("T")[0];

  // Process timeline — only legislation and executive_action events
  const rawTimeline = Array.isArray(item.timeline) ? item.timeline : [];
  const now = new Date();
  const timeline: TimelineEvent[] = [];

  for (const evt of rawTimeline) {
    if (!evt || typeof evt !== "object") continue;
    const evtObj = evt as Record<string, unknown>;

    const evtDate = String(evtObj.date || "");
    const evtDateObj = new Date(evtDate);
    if (!evtDate || isNaN(evtDateObj.getTime()) || evtDateObj > now) continue;

    const evtType = String(evtObj.type || "legislation");
    // Only keep legislation and executive_action events
    const validTypes = ["executive_action", "legislation"];
    const type = validTypes.includes(evtType) ? evtType : "legislation";

    const evtSourceUrl = sanitizeSourceUrl(String(evtObj.sourceUrl || ""), String(evtObj.title || ""));

    timeline.push({
      date: evtDate,
      type: type as TimelineEvent["type"],
      title: stripCitations(String(evtObj.title || "")),
      description: stripCitations(String(evtObj.description || "")),
      sourceUrl: evtSourceUrl,
    });
  }

  // Sort chronologically
  timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // No status — it's calculated from events by calculate-promise-status.ts
  return {
    title: stripCitations(String(item.title || "")),
    description: stripCitations(String(item.description || "")),
    category: normalizeCategory(String(item.category || "Other")),
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
  topN: number = 30,
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
      .filter((s) => s.score >= 1)
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);

    good.forEach((s) => selectedIds.add(s.item.id));
  }

  for (const item of items) {
    if (item.type === "action") selectedIds.add(item.id);
  }

  // If too few matches, add the most recent bills as fallback
  if (selectedIds.size < 30) {
    const recentBills = items
      .filter((item) => !selectedIds.has(item.id) && !PROCEDURAL_PATTERN.test(item.title))
      .slice(0, 30 - selectedIds.size);
    recentBills.forEach((item) => selectedIds.add(item.id));
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

ALIGNMENT — think carefully:
Before deciding alignment, think about what the bill DOES and what the promise WANTS.
If the bill advances the promise's goal, it ALIGNS. If the bill works against the promise's goal, it CONTRADICTS.

Example: Promise 'End U.S. involvement in foreign wars'. Bill 'Motion to Repeal Iraq War Authorization'. The bill ENDS war involvement, which ALIGNS with the promise. Voting YES = supports. Voting NO = opposes.
Example: Promise 'Oppose all foreign aid'. Bill 'Ukraine Security Supplemental'. The bill SENDS aid, which CONTRADICTS the promise. Voting YES = opposes. Voting NO = supports.

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
    .map((p) => `- [${p.id}] "${p.title}" (${p.category}): ${p.description.slice(0, 150)}`)
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
