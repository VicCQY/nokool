export const COUNTRIES = {
  US: { name: "United States", flag: "🇺🇸" },
  CA: { name: "Canada", flag: "🇨🇦" },
  UK: { name: "United Kingdom", flag: "🇬🇧" },
  AU: { name: "Australia", flag: "🇦🇺" },
  FR: { name: "France", flag: "🇫🇷" },
  DE: { name: "Germany", flag: "🇩🇪" },
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
