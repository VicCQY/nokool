const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  return key;
}

export function isAnthropicConfigured(): boolean {
  const key = process.env.ANTHROPIC_API_KEY;
  return !!key && key !== "your_anthropic_api_key_here";
}

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

async function callAnthropic(
  system: string,
  messages: AnthropicMessage[],
): Promise<string> {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": getApiKey(),
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      system,
      messages,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic API error ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();

  // Extract text from content blocks
  let text = "";
  for (const block of data.content || []) {
    if (block.type === "text") {
      text += block.text;
    }
  }

  return text;
}

function parseJsonFromResponse(text: string): unknown {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  // Try to find a JSON array in the response
  const arrayStart = cleaned.indexOf("[");
  const arrayEnd = cleaned.lastIndexOf("]");
  if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
    cleaned = cleaned.slice(arrayStart, arrayEnd + 1);
  }

  return JSON.parse(cleaned);
}

// ── Promise Research ──

export interface ResearchedPromise {
  title: string;
  description: string;
  category: string;
  status: string;
  dateMade: string;
  sourceUrl: string;
  weight: number;
}

export async function researchPromises(
  politicianName: string,
  country: string,
  party: string,
): Promise<ResearchedPromise[]> {
  const system = `You are a political research assistant. Search for and compile a comprehensive list of campaign promises, policy positions, and public commitments made by the specified politician. For each promise, provide: title (short), description (2-3 sentences), category (one of: Economy, Healthcare, Environment, Immigration, Education, Infrastructure, Foreign Policy, Justice, Housing, Technology, Other), a suggested status (NOT_STARTED, IN_PROGRESS, FULFILLED, PARTIAL, BROKEN), the approximate date it was made (YYYY-MM-DD), a source URL, and a suggested weight (1-5 where 5 is a cornerstone campaign promise). Return ONLY a JSON array with no other text.`;

  const userMsg = `Research all major campaign promises and policy positions of ${politicianName} (${party}, ${country}). Focus on their most recent campaign and current term. Return as a JSON array with objects having these exact keys: title, description, category, status, dateMade, sourceUrl, weight.`;

  const text = await callAnthropic(system, [{ role: "user", content: userMsg }]);
  const parsed = parseJsonFromResponse(text);

  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array from research response");
  }

  return parsed.map((item: Record<string, unknown>) => ({
    title: String(item.title || ""),
    description: String(item.description || ""),
    category: String(item.category || "Other"),
    status: String(item.status || "NOT_STARTED"),
    dateMade: String(item.dateMade || new Date().toISOString().split("T")[0]),
    sourceUrl: String(item.sourceUrl || ""),
    weight: Number(item.weight) || 3,
  }));
}

// ── News Fetching ──

export interface FetchedArticle {
  title: string;
  sourceName: string;
  url: string;
  publishedAt: string;
  summary: string;
  category: string;
}

export async function fetchNews(
  politicianName: string,
  topics?: string[],
): Promise<FetchedArticle[]> {
  const system = `You are a news research assistant. Search for the most recent and relevant news articles about the specified politician. For each article found, provide: title, sourceName (the publication name), url, publishedAt (YYYY-MM-DD), summary (2-3 sentences), and category (one of: Economy, Healthcare, Environment, Immigration, Education, Infrastructure, Foreign Policy, Justice, Housing, Technology, Other). Return ONLY a JSON array with no other text.`;

  const topicStr = topics && topics.length > 0 ? ` Focus on: ${topics.join(", ")}.` : "";
  const userMsg = `Find the 10 most recent and significant news articles about ${politicianName}.${topicStr} Return as a JSON array with objects having these exact keys: title, sourceName, url, publishedAt, summary, category.`;

  const text = await callAnthropic(system, [{ role: "user", content: userMsg }]);
  const parsed = parseJsonFromResponse(text);

  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array from news response");
  }

  return parsed.map((item: Record<string, unknown>) => ({
    title: String(item.title || ""),
    sourceName: String(item.sourceName || "Unknown"),
    url: String(item.url || ""),
    publishedAt: String(item.publishedAt || new Date().toISOString().split("T")[0]),
    summary: String(item.summary || ""),
    category: String(item.category || "Other"),
  }));
}
