const POLICY_AREA_MAP: Record<string, string> = {
  "Economics and Public Finance": "Economy",
  "Taxation": "Economy",
  "Finance and Financial Sector": "Economy",
  "Commerce": "Economy",
  "Health": "Healthcare",
  "Environmental Protection": "Environment",
  "Energy": "Environment",
  "Public Lands and Natural Resources": "Environment",
  "Immigration": "Immigration",
  "Education": "Education",
  "Transportation and Public Works": "Infrastructure",
  "Water Resources Development": "Infrastructure",
  "International Affairs": "Foreign Policy",
  "Armed Forces and National Security": "Foreign Policy",
  "Crime and Law Enforcement": "Justice",
  "Civil Rights and Liberties, Minority Issues": "Justice",
  "Housing and Community Development": "Housing",
  "Science, Technology, Communications": "Technology",
};

export function mapPolicyAreaToCategory(policyArea?: string): string {
  if (!policyArea) return "Other";
  return POLICY_AREA_MAP[policyArea] || "Other";
}
