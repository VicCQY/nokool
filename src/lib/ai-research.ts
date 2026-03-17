import { callPerplexity, parseJsonFromResponse } from "./perplexity-api";
import { prisma } from "./prisma";
import { sanitizeSourceUrl } from "./source-validator";

// ── Model Configuration ──
const MODEL_RESEARCH = "sonar-pro";
const MODEL_MATCHING = "sonar-pro";

// ══════════════════════════════════════════════
// STEP 1: RESEARCH (Full Timeline Per Promise)
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

export async function researchPromises(
  politicianName: string,
  party: string,
  position: string,
  todayDate?: string,
): Promise<ResearchedPromise[]> {
  const today = todayDate || new Date().toISOString().split("T")[0];

  const systemPrompt = `=== QUALITY REQUIREMENTS — READ CAREFULLY ===

YOU ARE BEING PAID FOR PREMIUM QUALITY. Do NOT take shortcuts.

ZERO DUPLICATES: Before finalizing your response, review ALL promises and remove any that cover the same policy action. 'Boost domestic microchip production' and 'Invest in microchip manufacturing' are the SAME promise — pick the better title and merge them. Scan your final list and eliminate ALL overlap.

UNIQUE DATES FOR dateMade: Each promise was made at a DIFFERENT time during the campaign. Do NOT set all promises to the same date (like election day). Find the ACTUAL date each promise was first made:
- Campaign announcement speeches have different dates
- Policy platform releases have dates
- Debate statements have dates
- Rally speeches have dates
- Press conferences have dates
- Op-eds and published plans have dates
If you cannot find the exact date a specific promise was first made, use the date of the earliest source you can find for that promise. EVERY promise should have a DIFFERENT dateMade unless they were genuinely announced together in the same speech.

UNIQUE SOURCES: Each promise should link to a DIFFERENT source URL where possible. Do not use the same article for 10 promises. Find the original speech, platform page, or news article specific to each promise.

TIMELINE EVENTS MUST BE REAL: Every timeline event must reference a SPECIFIC, NAMED action:
- Name the specific executive order number (e.g., 'EO 14159')
- Name the specific bill (e.g., 'HR-3684 Infrastructure Investment and Jobs Act')
- Name the specific vote or signing date
- 'Sworn in amid COVID surge' is NOT an action on COVID — DELETE events like this
- 'Administrative action taken' is too vague — WHAT action? Name it specifically or don't include it

DO NOT FABRICATE: If you cannot find a specific real event with a real date and real source, do NOT create a vague placeholder. An empty timeline with NOT_STARTED status is better than a fake timeline.

VERIFY YOUR OWN WORK: Before returning your response, check:
□ Are there any duplicate promises? REMOVE THEM.
□ Does every promise have a unique dateMade? FIX lazy same-day dates.
□ Does every timeline event name a specific action? REMOVE vague ones.
□ Is every sourceUrl a real, working URL (not Wikipedia or YouTube)? FIX OR REMOVE bad sources.
□ Are statuses justified by concrete evidence? DOWNGRADE to NOT_STARTED if evidence is weak.

You are an expert political researcher with access to current information. Your job is to find campaign promises and trace their COMPLETE HISTORY from when they were made to today.

=== STRICT FORMATTING TEMPLATES ===

Promise title format: "[Action verb] [specific subject]"
GOOD: "Impose 10% universal tariff on all imports"
GOOD: "Pardon January 6 defendants"
GOOD: "Withdraw from the Paris Climate Agreement"
BAD: "Tariffs" (no action, no specifics)
BAD: "Deal with immigration" (vague action, vague subject)
BAD: "Make America energy independent" (slogan, not measurable)

Promise description format: "On [date], [politician] promised to [specific action]. This would [concrete impact]."
GOOD: "On June 16, 2024, Trump promised to impose a 10% baseline tariff on all imported goods. This would affect approximately $3 trillion in annual imports."
BAD: "Trump wants tariffs on imports." (no date, no specifics, no impact)

=== WHAT COUNTS AS A TIMELINE EVENT ===
Timeline events must be CONCRETE actions with REAL dates and PROOF:

GOOD timeline events:
- "2025-01-20: Executive Order signed imposing 10% tariff (source: whitehouse.gov)"
- "2025-03-04: Additional 10% tariff on Chinese goods takes effect (source: reuters.com)"
- "2025-02-01: Bill H.R. 123 introduced in House (source: congress.gov)"

BAD timeline events (DO NOT INCLUDE):
- "2024-11-05: Trump wins election" (not an action on the promise)
- "2025-01-20: Trump takes office" (not an action on the promise)
- "Experts debate tariff impact" (opinion, not action)
- "Promise was made during campaign" (that's the dateMade field, not a timeline event)

=== STATUS CHANGE RULES ===
A status_change event REQUIRES concrete proof:
- NOT_STARTED → IN_PROGRESS: A bill was introduced, an executive order was drafted, formal process began
- IN_PROGRESS → PARTIAL: Some measurable part of the promise was delivered but not all of it
- IN_PROGRESS → FULFILLED: The complete promise was delivered as stated
- Any → BROKEN: The politician explicitly abandoned the promise or took opposite action
- Any → REVERSED: A previously fulfilled promise was undone

If a promise has NO concrete action taken, the timeline should be EMPTY and status should be NOT_STARTED. Do NOT fabricate progress.

=== WHAT COUNTS AS A PROMISE ===
A promise MUST have ALL of these elements:
1. A clear FIELD (policy area: education, immigration, economy, healthcare, etc.)
2. A clear SUBJECT (specific thing: school lunches, TikTok, the border wall, Medicare, Jan 6 defendants)
3. A clear DIRECTION (specific action: make free, ban, build, pardon, eliminate, increase by X%, impose X% tariff)
4. A TIMEFRAME if one was stated (optional: 'within 24 hours', 'by 2028', 'day one')

GOOD promises (specific, verifiable, clear yes/no outcome):
- 'Make school lunches free' (field: education, subject: school lunches, direction: make free)
- 'Pardon January 6 defendants' (field: justice, subject: J6 defendants, direction: pardon)
- 'Impose 10% universal tariff on all imports' (field: economy, subject: imports, direction: 10% tariff)
- 'End the war in Ukraine within 24 hours' (field: foreign policy, subject: Ukraine war, direction: end, timeframe: 24 hours)
- 'Eliminate the Department of Education' (field: education, subject: Dept of Education, direction: eliminate)

BAD — these are slogans or themes, NOT promises (reject these):
- 'Strengthen National Defense' (no specific subject or action)
- 'Fight for working families' (slogan, not actionable)
- 'Support Ukraine' (support how? no specific action)
- 'Cut federal spending' (cut what specifically? no subject)
- 'Make America Great Again' (slogan)
- 'Protect pre-existing conditions' (protect how? with what?)

If a topic is too vague, break it into the SPECIFIC commitments the politician actually made.

=== NO OVERLAP ===
ONE promise per distinct policy action. Do NOT create multiple promises for the same thing:
- 'Repeal ACA' and 'Replace ACA with Graham-Cassidy' = ONE promise: 'Repeal and Replace the Affordable Care Act'
- 'Build the wall' and 'Secure the border' = ONE promise if they refer to the same action
- 'Ban assault weapons' and 'Universal background checks' = TWO promises (different actions, different bills)

For each promise, provide:
1. title: Clear, concise promise name following the rules above
2. description: 2-3 sentences explaining what was promised
3. category: Economy, Healthcare, Environment, Immigration, Education, Infrastructure, Foreign Policy, Justice, Housing, Technology, Other
4. severity: 1-5 (5=cornerstone campaign promise, 4=major, 3=standard, 2=minor, 1=trivial)
5. expectedMonths: reasonable months to fulfill
6. billRelated: true/false — is this directly tied to specific legislation or executive action?
7. sourceUrl: where the promise was made. NEVER use wikipedia.org or youtube.com.
8. dateMade: YYYY-MM-DD when the promise was made

9. timeline: An array of events tracing the promise from when it was made to today. Each event:
   {
     date: 'YYYY-MM-DD',
     type: 'status_change' | 'executive_action' | 'legislation' | 'news',
     title: 'Short description of what happened',
     description: '1-2 sentences with details',
     sourceUrl: 'URL proving this happened',
     newStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'PARTIAL' | 'FULFILLED' | 'BROKEN' | 'REVERSED' (only for status_change events, null for others)
   }

The timeline MUST:
- Start with the first action taken on the promise (skip if still NOT_STARTED)
- Include EVERY major development with its REAL DATE — executive orders, bills introduced, votes, statements, policy changes
- Each status_change event must have a REAL DATE when the status actually changed, NOT today's date
- Events must be chronologically ordered
- The LAST status_change event determines the promise's current status
- If no action has been taken, timeline can be empty (status remains NOT_STARTED)

IMPORTANT:
- Do NOT create multiple promises for the same topic. One promise per distinct policy goal.
- NEVER use wikipedia.org, youtube.com, or youtu.be as a source URL. Use: official campaign sites, .gov, C-SPAN, AP, Reuters, NYT, WaPo, Politico, The Hill, CNN, Fox News, NPR.
- Every date must be the REAL date of the event, never today's date
- Be thorough — find at least 15 promises, cover ALL major policy areas they campaigned on
- Prioritize: cornerstone promises first, then major, then minor

Return ONLY a JSON array. No markdown, no explanation.`;

  const userPrompt = `Research ALL major campaign promises made by ${politicianName} (${party}), who serves as ${position}. Trace each promise's complete history from when it was made through today (${today}). Include every major development, executive action, legislative action, and status change with real dates and sources.

NEVER use Wikipedia or YouTube as a source.`;

  const text = await callPerplexity(systemPrompt, userPrompt, MODEL_RESEARCH);
  const parsed = parseJsonFromResponse(text);

  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array from research response");
  }

  return parsed.map((item: Record<string, unknown>) => processResearchItem(item));
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
      title: String(evtObj.title || ""),
      description: String(evtObj.description || ""),
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
    title: String(item.title || ""),
    description: String(item.description || ""),
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
// STEP 2: BILL MATCHING
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

// Detect final-passage bill votes (e.g., "H.R. 3684, As Amended", "S. 1260, As Amended")
// These are substantive legislation votes that the AI needs to see, even if keyword matching fails
// because Senate bill titles often lack policy keywords.
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

  // Always include substantive final-passage bill votes — the AI can recognize
  // "H.R. 3684" as the Infrastructure Act even though the title doesn't say so
  for (const item of items) {
    if (isSubstantiveBill(item.title)) {
      selectedIds.add(item.id);
    }
  }

  // Also add keyword-matched items (only if they're substantive, not confirmations)
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

  // Also include all executive actions (they're always substantive)
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
