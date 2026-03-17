const BLOCKED_DOMAINS = [
  "wikipedia.org",
  "wiki.",
  "fandom.com",
  "youtube.com",
  "youtu.be",
];

const TRUSTED_DOMAINS = [
  ".gov",
  "congress.gov",
  "whitehouse.gov",
  "federalregister.gov",
  "c-span.org",
  "apnews.com",
  "reuters.com",
  "nytimes.com",
  "washingtonpost.com",
  "politico.com",
  "thehill.com",
  "cnn.com",
  "foxnews.com",
  "npr.org",
  "bbc.com",
  "abcnews.go.com",
  "cbsnews.com",
  "nbcnews.com",
  "pbs.org",
  "usatoday.com",
];

export interface SourceValidation {
  valid: boolean;
  trusted?: boolean;
  reason?: string;
  warning?: string;
}

export function validateSource(url: string | null | undefined): SourceValidation {
  if (!url || url.trim() === "") {
    return { valid: false, reason: "No source provided" };
  }

  const lower = url.toLowerCase();

  for (const blocked of BLOCKED_DOMAINS) {
    if (lower.includes(blocked)) {
      return { valid: false, reason: "Blocked source (Wikipedia/YouTube/fandom)" };
    }
  }

  for (const trusted of TRUSTED_DOMAINS) {
    if (lower.includes(trusted)) {
      return { valid: true, trusted: true };
    }
  }

  return { valid: true, trusted: false, warning: "Unverified source" };
}

/**
 * Strip blocked sources from a URL, returning empty string if blocked.
 * Logs a warning for blocked sources.
 */
export function sanitizeSourceUrl(url: string, context?: string): string {
  const result = validateSource(url);
  if (!result.valid && url.trim() !== "") {
    console.warn(
      `[Source] Blocked source${context ? ` for ${context}` : ""}: ${url} — ${result.reason}`,
    );
    return "";
  }
  return url;
}
