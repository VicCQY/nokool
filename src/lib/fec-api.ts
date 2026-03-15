const BASE_URL = "https://api.open.fec.gov/v1";

// ── Key rotation ──

let apiKeys: string[] = [];
let currentKeyIndex = 0;

function getApiKeys(): string[] {
  if (apiKeys.length > 0) return apiKeys;
  const multi = process.env.FEC_API_KEYS;
  const single = process.env.FEC_API_KEY;
  if (multi) {
    apiKeys = multi.split(",").map((k) => k.trim()).filter(Boolean);
  } else if (single) {
    apiKeys = [single];
  }
  if (apiKeys.length === 0) throw new Error("FEC_API_KEY(S) not set");
  return apiKeys;
}

function getCurrentKey(): string {
  const keys = getApiKeys();
  return keys[currentKeyIndex % keys.length];
}

function rotateKey(): boolean {
  const keys = getApiKeys();
  currentKeyIndex = (currentKeyIndex + 1) % keys.length;
  // Return true if we've cycled back to start (all keys exhausted)
  return currentKeyIndex === 0;
}

function buildUrl(path: string, params: Record<string, string> = {}, apiKey?: string): string {
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("api_key", apiKey ?? getCurrentKey());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchWithRotation(path: string, params: Record<string, string> = {}): Promise<any> {
  const keys = getApiKeys();
  let attempts = 0;
  const maxAttempts = keys.length;

  while (true) {
    const url = buildUrl(path, params);
    const res = await fetch(url, { cache: "no-store" });

    if (res.status === 429) {
      attempts++;
      const allExhausted = rotateKey();
      if (allExhausted && attempts >= maxAttempts) {
        // All keys exhausted — wait 60s then retry from the first key
        console.warn("All FEC API keys rate-limited. Waiting 60s...");
        await delay(60_000);
        attempts = 0;
      }
      continue;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`FEC API error ${res.status}: ${text.slice(0, 200)}`);
    }

    // Rotate evenly: advance to next key after each successful request
    rotateKey();
    return res.json();
  }
}

// ── Types ──

export interface FecCandidate {
  candidate_id: string;
  name: string;
  party: string;
  office: string; // H, S, P
  state: string;
  district: string;
  election_years: number[];
  incumbent_challenge: string;
}

export interface FecCommittee {
  committee_id: string;
  name: string;
  designation: string;
  committee_type: string;
  cycles: number[];
}

export interface FecCommitteeTotals {
  committee_id: string;
  cycle: number;
  receipts: number;
  individual_contributions: number;
  other_political_committee_contributions: number;
  disbursements: number;
}

export interface FecContribution {
  contributor_name: string;
  contributor_employer: string;
  contributor_occupation: string;
  contributor_state: string;
  contribution_receipt_amount: number;
  contribution_receipt_date: string;
  contributor_type: string;
  committee_id: string;
}

export interface FecEmployerTotal {
  employer: string;
  total: number;
  count: number;
}

export interface FecSizeBreakdown {
  size: number; // 0, 200, 500, 1000, 2000
  total: number;
  count: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface FecCandidateTotals {
  receipts: number;
  individual_contributions: number;
  individual_itemized_contributions: number;
  individual_unitemized_contributions: number;
  other_political_committee_contributions: number;
  transfers_from_affiliated_committee: number;
  candidate_contribution: number;
  disbursements: number;
  cash_on_hand_end_period: number;
  debts_owed_by_committee: number;
  [key: string]: unknown;
}

// ── API Functions ──

export async function searchCandidates(
  name: string,
  office?: string
): Promise<FecCandidate[]> {
  const params: Record<string, string> = {
    q: name,
    sort: "name",
    per_page: "5",
  };
  if (office) params.office = office;
  const data = await fetchWithRotation("/candidates/search/", params);
  return data.results || [];
}

export async function getCandidateCommittees(
  candidateId: string
): Promise<FecCommittee[]> {
  const data = await fetchWithRotation(`/candidate/${candidateId}/committees/`, {
    per_page: "20",
  });
  return data.results || [];
}

export async function getContributionsByEmployer(
  committeeId: string,
  cycle: number,
  perPage = 50
): Promise<FecEmployerTotal[]> {
  const data = await fetchWithRotation("/schedules/schedule_a/by_employer/", {
    committee_id: committeeId,
    cycle: String(cycle),
    sort: "-total",
    per_page: String(perPage),
  });
  return data.results || [];
}

export async function getCommitteeTotals(
  committeeId: string,
  cycle: number
): Promise<FecCommitteeTotals | null> {
  const data = await fetchWithRotation(`/committee/${committeeId}/totals/`, {
    cycle: String(cycle),
  });
  return data.results?.[0] || null;
}

export async function getContributionsBySize(
  committeeId: string,
  cycle: number
): Promise<FecSizeBreakdown[]> {
  const data = await fetchWithRotation("/schedules/schedule_a/by_size/", {
    committee_id: committeeId,
    cycle: String(cycle),
    per_page: "20",
  });
  return data.results || [];
}

export async function getContributions(
  committeeId: string,
  contributorType: string,
  perPage = 20
): Promise<FecContribution[]> {
  const data = await fetchWithRotation("/schedules/schedule_a/", {
    committee_id: committeeId,
    contributor_type: contributorType,
    sort: "-contribution_receipt_amount",
    per_page: String(perPage),
  });
  return data.results || [];
}

export async function getCandidateTotals(
  candidateId: string,
  cycle: number
): Promise<FecCandidateTotals | null> {
  const data = await fetchWithRotation(`/candidate/${candidateId}/totals/`, {
    cycle: String(cycle),
    election_full: "true",
  });
  return data.results?.[0] || null;
}

export { delay };
