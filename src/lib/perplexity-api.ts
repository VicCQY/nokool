const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";

function getApiKey(): string {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) throw new Error("PERPLEXITY_API_KEY is not set");
  return key;
}

export function isPerplexityConfigured(): boolean {
  const key = process.env.PERPLEXITY_API_KEY;
  return !!key && key.length > 10;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function callPerplexity(
  systemPrompt: string,
  userPrompt: string,
  model: string = "sonar-pro",
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const res = await fetch(PERPLEXITY_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Perplexity API error ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();

  // Log token usage for cost monitoring
  const usage = data.usage;
  if (usage) {
    console.log(
      `[Perplexity] model=${model} prompt_tokens=${usage.prompt_tokens || "?"} completion_tokens=${usage.completion_tokens || "?"} total=${usage.total_tokens || "?"}`,
    );
  }

  return data.choices?.[0]?.message?.content || "";
}

export function parseJsonFromResponse(text: string): unknown {
  // Strip BOM and invisible Unicode whitespace
  let cleaned = text.replace(/^\uFEFF/, "").replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "").trim();

  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  cleaned = cleaned.replace(/```(?:json)?\s*/gi, "").trim();

  // Extract just the JSON array between first [ and last ]
  const arrayStart = cleaned.indexOf("[");
  const arrayEnd = cleaned.lastIndexOf("]");
  if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
    cleaned = cleaned.slice(arrayStart, arrayEnd + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("[parseJsonFromResponse] Failed to parse JSON.");
    console.error("Raw (first 500 chars):", text.slice(0, 500));
    console.error("Cleaned (first 500 chars):", cleaned.slice(0, 500));
    throw new Error(
      `Failed to parse AI response as JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
