const INDUSTRY_RULES: { keywords: string[]; industry: string }[] = [
  {
    keywords: [
      "bank", "banking", "capital", "financial", "investment", "securities",
      "hedge", "venture", "asset", "wealth", "credit", "loan", "mortgage",
      "equity", "fund", "brokerage", "fidelity", "goldman", "jpmorgan",
      "citi", "wells fargo", "merrill", "schwab", "blackrock", "vanguard",
      "insurance", "underwriter", "morgan stanley", "credit suisse",
    ],
    industry: "Finance",
  },
  {
    keywords: [
      "law", "legal", "attorney", "counsel", "litigation",
      "firm llp", "firm llc", "firm pc", "firm pllc",
      "esquire", "barrister",
    ],
    industry: "Legal",
  },
  {
    keywords: [
      "real estate", "realty", "property", "properties", "housing",
      "development", "construction", "builder", "home", "homes",
      "apartment", "land", "reit",
    ],
    industry: "Real Estate",
  },
  {
    keywords: [
      "oil", "gas", "petroleum", "energy", "drilling", "pipeline",
      "refinery", "fuel", "mining", "coal", "natural gas",
      "exxon", "chevron", "shell", "halliburton",
      "electric", "utility", "utilities", "solar", "wind", "power",
      "koch", "conoco",
    ],
    industry: "Oil & Gas / Energy",
  },
  {
    keywords: [
      "tech", "software", "computer", "digital", "cyber", "data", "cloud",
      "microsoft", "google", "apple", "amazon", "meta", "oracle", "intel",
      "cisco", "ibm", "semiconductor", "chip",
      "alphabet", "facebook", "salesforce", "nvidia", "twitter",
      "uber", "lyft", "airbnb", "stripe",
    ],
    industry: "Technology",
  },
  {
    keywords: [
      "health", "medical", "hospital", "physician", "doctor", "pharma",
      "pharmaceutical", "biotech", "drug", "clinic", "dental", "nursing",
      "patient", "surgery", "therapeutics", "pfizer", "merck",
      "johnson & johnson", "abbvie", "novartis", "roche", "eli lilly",
      "bristol-myers", "amgen", "gilead", "aetna", "cigna",
      "united health", "kaiser", "blue cross", "anthem",
    ],
    industry: "Healthcare",
  },
  {
    keywords: [
      "defense", "military", "aerospace", "lockheed", "raytheon", "boeing",
      "northrop", "general dynamics", "bae", "contractor", "l3harris",
    ],
    industry: "Defense",
  },
  {
    keywords: [
      "telecom", "wireless", "broadband", "cable", "verizon", "at&t",
      "t-mobile", "comcast", "charter",
    ],
    industry: "Telecommunications",
  },
  {
    keywords: [
      "transport", "airline", "aviation", "shipping", "freight", "logistics",
      "trucking", "railroad", "rail",
    ],
    industry: "Transportation",
  },
  {
    keywords: [
      "farm", "agriculture", "agricultural", "ranch", "crop", "livestock",
      "dairy", "grain", "seed",
    ],
    industry: "Agriculture",
  },
  {
    keywords: ["university", "college", "school", "education", "academic", "professor", "teacher"],
    industry: "Education",
  },
  {
    keywords: ["retail", "store", "shop", "walmart", "target", "costco"],
    industry: "Retail",
  },
  {
    keywords: [
      "entertainment", "media", "film", "movie", "studio", "music",
      "gaming", "casino", "hotel", "resort", "restaurant",
    ],
    industry: "Entertainment",
  },
  {
    keywords: [
      "manufacturing", "factory", "industrial", "steel", "metal", "chemical",
      "auto", "motor", "textile",
    ],
    industry: "Manufacturing",
  },
  {
    keywords: [
      "union", "afl", "teamster", "seiu", "afscme", "carpenters",
      "electricians", "plumbers", "laborers", "workers",
    ],
    industry: "Labor",
  },
  {
    keywords: [
      "republican", "gop", "conservative", "heritage", "freedom", "liberty",
      "patriot", "maga", "america first",
    ],
    industry: "Republican / Conservative",
  },
  {
    keywords: [
      "democrat", "progressive", "liberal", "moveon", "actblue",
      "planned parenthood", "sierra club", "emily's list",
    ],
    industry: "Democratic / Progressive",
  },
];

export function classifyIndustry(
  name: string,
  donorType?: string,
): string {
  const lower = name.toLowerCase();

  // Type-based overrides
  if (donorType === "UNION") return "Labor";

  for (const rule of INDUSTRY_RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) return rule.industry;
    }
  }
  return "Other";
}

// Fake employer names that indicate individual donors, not corporations
const INDIVIDUAL_EMPLOYER_NAMES = new Set([
  "retired", "self-employed", "self employed", "self", "not employed",
  "not applicable", "none", "n/a", "null", "information requested",
  "information requested per best efforts", "entrepreneur", "homemaker",
  "disabled", "student", "unemployed", "refused", "requested",
]);

export function guessDonorType(
  name: string,
  contributorType?: string
): "INDIVIDUAL" | "CORPORATION" | "PAC" | "SUPER_PAC" | "UNION" | "NONPROFIT" {
  const lower = name.toLowerCase().trim();

  if (contributorType === "individual") return "INDIVIDUAL";

  // Never classify fake employer names as corporations
  if (INDIVIDUAL_EMPLOYER_NAMES.has(lower)) return "INDIVIDUAL";

  if (lower.includes("union") || lower.includes("afl") || lower.includes("teamster"))
    return "UNION";
  if (lower.includes("pac") || lower.includes("political action"))
    return "PAC";
  if (lower.includes("super pac")) return "SUPER_PAC";
  if (lower.includes("nonprofit") || lower.includes("foundation") || lower.includes("charity"))
    return "NONPROFIT";
  if (contributorType === "committee") return "PAC";

  return "CORPORATION";
}
