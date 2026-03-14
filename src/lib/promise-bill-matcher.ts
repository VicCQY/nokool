const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "to", "for", "of", "in", "on",
  "at", "by", "and", "or", "but", "with", "from", "this", "that", "will",
  "would", "should", "have", "has", "had", "be", "been", "not", "all", "can",
  "could", "do", "does", "did", "may", "might", "must", "shall", "very",
  "just", "more", "most", "no", "than", "too", "also", "into", "our", "we",
  "they", "them", "their", "about", "its", "it", "as", "so", "up", "out",
  "if", "each", "which", "she", "he", "his", "her", "how", "my", "your",
  "who", "what", "when", "where", "why", "over", "any", "some", "such",
  "through", "after", "before", "between", "under", "being", "those", "these",
  "other", "then", "only", "make", "like", "even", "new", "act", "bill",
  "resolution", "regarding", "related", "provide", "providing", "purposes",
  "section", "title", "amend", "amendment", "including", "certain",
]);

// Keywords indicating the promise is AGAINST something
const NEGATIVE_PROMISE_KEYWORDS = new Set([
  "oppose", "end", "stop", "abolish", "ban", "reduce", "eliminate", "cut",
  "against", "block", "defund", "repeal", "withdraw", "prevent", "restrict",
  "limit", "decrease", "halt", "terminate", "revoke", "curtail", "slash",
  "roll back", "rollback", "phase out",
]);

// Keywords indicating the promise is FOR something
const POSITIVE_PROMISE_KEYWORDS = new Set([
  "support", "expand", "protect", "increase", "fund", "create", "pass",
  "strengthen", "promote", "invest", "build", "improve", "ensure", "establish",
  "maintain", "preserve", "advance", "boost", "enhance", "extend",
]);

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function isStrongKeyword(word: string): boolean {
  // Proper nouns, specific policy terms - longer words are more specific
  if (word.length >= 7) return true;
  // Known strong terms
  const strong = new Set([
    "ukraine", "tariff", "tariffs", "border", "medicare", "medicaid",
    "tiktok", "china", "israel", "taiwan", "nato", "iran", "gaza",
    "abortion", "gun", "guns", "climate", "obamacare", "daca",
    "dreamers", "fentanyl", "social security", "minimum wage",
    "student loan", "fracking", "drilling", "pipeline", "nuclear",
    "crypto", "bitcoin", "equity", "dei", "transgender", "lgbtq",
    "vaccine", "covid", "pandemic", "insulin", "pharma", "drug",
    "police", "immigration", "deport", "asylum", "refugee",
    "veteran", "military", "defense", "spend", "debt", "deficit",
    "tax", "taxes", "wall", "fence",
  ]);
  return strong.has(word);
}

/**
 * Detect whether a bill supports or opposes a promise based on keywords.
 * Returns "supports" or "opposes".
 */
export function detectAlignment(
  promiseTitle: string,
  promiseDescription: string,
): "supports" | "opposes" {
  const promiseText = `${promiseTitle} ${promiseDescription}`.toLowerCase();

  let hasNegative = false;
  for (const kw of NEGATIVE_PROMISE_KEYWORDS) {
    if (promiseText.includes(kw)) {
      hasNegative = true;
      break;
    }
  }

  let hasPositive = false;
  for (const kw of POSITIVE_PROMISE_KEYWORDS) {
    if (promiseText.includes(kw)) {
      hasPositive = true;
      break;
    }
  }

  // If promise uses negative language (oppose, end, stop, ban...),
  // bills in the same topic area likely OPPOSE the promise direction
  // (the bill does the thing the promise opposes)
  if (hasNegative && !hasPositive) return "opposes";

  // Default: bill supports the promise
  return "supports";
}

export interface BillMatch {
  billId: string;
  score: number;
  alignment: "supports" | "opposes";
}

interface BillData {
  id: string;
  title: string;
  summary: string;
  billNumber: string;
  category: string;
}

interface PromiseData {
  id: string;
  title: string;
  description: string;
  category: string;
}

export function matchBillsToPromise(
  promise: PromiseData,
  allBills: BillData[],
): BillMatch[] {
  const promiseKeywords = extractKeywords(`${promise.title} ${promise.description}`);
  if (promiseKeywords.length === 0) return [];

  const promiseKeywordSet = new Set(promiseKeywords);
  const alignment = detectAlignment(promise.title, promise.description);
  const matches: BillMatch[] = [];

  for (const bill of allBills) {
    const billText = `${bill.title} ${bill.summary}`.toLowerCase();
    const billWords = new Set(extractKeywords(billText));

    let score = 0;
    let matchCount = 0;
    let hasStrongMatch = false;

    for (const keyword of promiseKeywordSet) {
      if (billWords.has(keyword) || billText.includes(keyword)) {
        matchCount++;
        score += isStrongKeyword(keyword) ? 3 : 1;
        if (isStrongKeyword(keyword)) hasStrongMatch = true;
      }
    }

    // Category match bonus
    if (bill.category === promise.category && matchCount >= 1) {
      score += 2;
    }

    // Require at least 2 keyword matches, or 1 strong match
    if (matchCount >= 2 || (matchCount >= 1 && hasStrongMatch)) {
      matches.push({ billId: bill.id, score, alignment });
    }
  }

  // Sort by score descending, cap at 15
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, 15);
}

/**
 * Given alignment and vote position, determine if the vote
 * supports or opposes the promise.
 */
export function getVoteAlignment(
  billAlignment: string,
  votePosition: string,
): "supports" | "opposes" | "neutral" {
  if (votePosition === "ABSTAIN" || votePosition === "ABSENT") return "neutral";

  if (billAlignment === "supports") {
    return votePosition === "YEA" ? "supports" : "opposes";
  } else {
    // bill opposes the promise
    return votePosition === "YEA" ? "opposes" : "supports";
  }
}

/**
 * Get a human-readable explanation of why a vote alignment is what it is.
 */
export function getAlignmentExplanation(
  billAlignment: string,
  votePosition: string,
): string {
  if (votePosition === "ABSTAIN") return "Abstained from voting";
  if (votePosition === "ABSENT") return "Absent for this vote";

  const votedFor = votePosition === "YEA";

  if (billAlignment === "supports") {
    return votedFor
      ? "Voted for a bill that supports this promise"
      : "Voted against a bill that supports this promise";
  } else {
    return votedFor
      ? "Voted for a bill that contradicts this promise"
      : "Voted against a bill that contradicts this promise";
  }
}
