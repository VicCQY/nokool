export const ISSUE_WEIGHTS: Record<string, number> = {
  "Economy": 3.0,
  "Healthcare": 2.5,
  "Immigration": 2.3,
  "Justice": 2.2,
  "Foreign Policy": 2.0,
  "Education": 1.8,
  "Housing": 1.6,
  "Infrastructure": 1.4,
  "Environment": 1.3,
  "Technology": 1.1,
  "Other": 1.0,
};

export const SEVERITY_LABELS: Record<number, string> = {
  5: "Cornerstone",
  4: "Major",
  3: "Standard",
  2: "Minor",
  1: "Trivial",
};

export const STATUS_VALUES: Record<string, number> = {
  "FULFILLED": 1.0,
  "PARTIAL": 0.5,
  "IN_PROGRESS": 0.25,
  "NOT_STARTED": 0,
  "BROKEN": -1.0,
};

export const STANDARD_TERM_LENGTHS: Record<string, number> = {
  "executive": 4,
  "senate": 6,
  "house": 2,
  "legislative": 4,
};
