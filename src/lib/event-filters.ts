/**
 * Words that indicate an internal correction/admin event
 * that should never appear on public timelines.
 */
const INTERNAL_KEYWORDS = [
  "revert", "regression", "correction", "fix",
  "via AI research", "Initial status set", "AI research",
];

const INTERNAL_PATTERN = new RegExp(INTERNAL_KEYWORDS.join("|"), "i");

/**
 * Returns true if the event title or description contains
 * internal correction keywords and should be hidden from public view.
 */
export function isInternalEvent(
  title: string | null | undefined,
  description: string | null | undefined,
): boolean {
  if (title && INTERNAL_PATTERN.test(title)) return true;
  if (description && INTERNAL_PATTERN.test(description)) return true;
  return false;
}
