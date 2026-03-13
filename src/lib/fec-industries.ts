const INDUSTRY_RULES: { keywords: string[]; industry: string }[] = [
  {
    keywords: [
      "bank", "goldman", "jpmorgan", "morgan stanley", "capital",
      "financial", "investment", "hedge fund", "wells fargo", "citigroup",
      "credit suisse", "blackrock", "vanguard", "fidelity",
    ],
    industry: "Finance",
  },
  {
    keywords: [
      "google", "alphabet", "meta", "facebook", "microsoft", "apple",
      "amazon", "salesforce", "oracle", "intel", "nvidia", "ibm",
      "cisco", "twitter", "uber", "lyft", "airbnb", "stripe",
      "software", "tech",
    ],
    industry: "Technology",
  },
  {
    keywords: [
      "exxon", "chevron", "bp ", "shell", "petroleum", "oil", "gas",
      "energy", "pipeline", "koch", "halliburton", "conoco",
    ],
    industry: "Oil & Gas",
  },
  {
    keywords: [
      "pfizer", "johnson & johnson", "merck", "abbvie", "pharma",
      "biotech", "novartis", "roche", "eli lilly", "bristol-myers",
      "amgen", "gilead",
    ],
    industry: "Pharmaceutical",
  },
  {
    keywords: [
      "lockheed", "raytheon", "boeing", "northrop", "defense",
      "military", "general dynamics", "bae systems", "l3harris",
    ],
    industry: "Defense",
  },
  {
    keywords: [
      "real estate", "realty", "properties", "housing", "construction",
      "developer", "home builder",
    ],
    industry: "Real Estate",
  },
  {
    keywords: [
      "hospital", "health", "clinic", "medical", "insurance", "aetna",
      "cigna", "united health", "kaiser", "blue cross", "anthem",
    ],
    industry: "Healthcare",
  },
  {
    keywords: ["university", "college", "school", "education", "academic"],
    industry: "Education",
  },
  {
    keywords: [
      "law firm", "attorney", "legal", "llp", "law office", "pllc",
      "esquire",
    ],
    industry: "Legal",
  },
  {
    keywords: [
      "walmart", "target", "retail", "restaurant", "food", "mcdonald",
      "starbucks", "costco",
    ],
    industry: "Retail",
  },
  {
    keywords: ["union", "aflcio", "afl-cio", "teamster", "seiu", "uaw"],
    industry: "Labor",
  },
];

export function classifyIndustry(name: string): string {
  const lower = name.toLowerCase();
  for (const rule of INDUSTRY_RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) return rule.industry;
    }
  }
  return "Other";
}

export function guessDonorType(
  name: string,
  contributorType?: string
): "INDIVIDUAL" | "CORPORATION" | "PAC" | "SUPER_PAC" | "UNION" | "NONPROFIT" {
  const lower = name.toLowerCase();

  if (contributorType === "individual") return "INDIVIDUAL";

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
