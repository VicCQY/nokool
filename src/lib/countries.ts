export const COUNTRIES = {
  US: { name: "United States", flag: "🇺🇸" },
  CA: { name: "Canada", flag: "🇨🇦" },
} as const;

export type CountryCode = keyof typeof COUNTRIES;

export const CATEGORIES = [
  "Economy",
  "Healthcare",
  "Education",
  "Environment",
  "Immigration",
  "Infrastructure",
  "Defense",
  "Social Policy",
  "Tax Policy",
  "Foreign Policy",
  "Justice",
  "Technology",
] as const;
