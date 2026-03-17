import { callPerplexity, parseJsonFromResponse } from "./perplexity-api";

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
