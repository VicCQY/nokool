/**
 * Phrases that indicate an internal/admin event
 * that should never appear on public timelines.
 */
const INTERNAL_PHRASES = [
  "revert",
  "regression",
  "correction",
  "fix",
  "via AI research",
  "via AI",
  "Initial status set",
  "Initial status",
  "AI research",
  "auto-applied",
  "ai_auto",
  "ai_flagged",
  "during import",
  "Status set to",
  "Promise created",
];

const INTERNAL_PATTERN = new RegExp(
  INTERNAL_PHRASES.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
  "i",
);

/**
 * Returns true if the event title or description contains
 * internal bookkeeping phrases and should be hidden from public view.
 */
export function isInternalEvent(
  title: string | null | undefined,
  description: string | null | undefined,
): boolean {
  if (title && INTERNAL_PATTERN.test(title)) return true;
  if (description && INTERNAL_PATTERN.test(description)) return true;
  return false;
}
