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
  // Strip ALL markdown code fences (```json, ```, etc.) globally
  let cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

  // Extract just the JSON array between first [ and last ]
  const arrayStart = cleaned.indexOf("[");
  const arrayEnd = cleaned.lastIndexOf("]");
  if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
    cleaned = cleaned.slice(arrayStart, arrayEnd + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // Log raw response for debugging
    console.error("Failed to parse Perplexity JSON response.");
    console.error("Raw response (first 1000 chars):", text.slice(0, 1000));
    console.error("Cleaned (first 1000 chars):", cleaned.slice(0, 1000));
    throw new Error(
      `Failed to parse AI response as JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
