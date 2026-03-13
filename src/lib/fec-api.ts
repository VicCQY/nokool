const BASE_URL = "https://api.open.fec.gov/v1";

function getApiKey(): string {
  const key = process.env.FEC_API_KEY;
  if (!key) throw new Error("FEC_API_KEY is not set");
  return key;
}

function buildUrl(path: string, params: Record<string, string> = {}): string {
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("api_key", getApiKey());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`FEC API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
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
  const url = buildUrl("/candidates/search/", params);
  const data = await fetchJson(url);
  return data.results || [];
}

export async function getCandidateCommittees(
  candidateId: string
): Promise<FecCommittee[]> {
  const url = buildUrl(`/candidate/${candidateId}/committees/`, {
    per_page: "20",
  });
  const data = await fetchJson(url);
  return data.results || [];
}

export async function getContributionsByEmployer(
  committeeId: string,
  cycle: number,
  perPage = 50
): Promise<FecEmployerTotal[]> {
  const url = buildUrl("/schedules/schedule_a/by_employer/", {
    committee_id: committeeId,
    cycle: String(cycle),
    sort: "-total",
    per_page: String(perPage),
  });
  const data = await fetchJson(url);
  return data.results || [];
}

export async function getCommitteeTotals(
  committeeId: string,
  cycle: number
): Promise<FecCommitteeTotals | null> {
  const url = buildUrl(`/committee/${committeeId}/totals/`, {
    cycle: String(cycle),
  });
  const data = await fetchJson(url);
  return data.results?.[0] || null;
}

export interface FecSizeBreakdown {
  size: number; // 0, 200, 500, 1000, 2000
  total: number;
  count: number;
}

export async function getContributionsBySize(
  committeeId: string,
  cycle: number
): Promise<FecSizeBreakdown[]> {
  const url = buildUrl("/schedules/schedule_a/by_size/", {
    committee_id: committeeId,
    cycle: String(cycle),
    per_page: "20",
  });
  const data = await fetchJson(url);
  return data.results || [];
}

export async function getContributions(
  committeeId: string,
  contributorType: string,
  perPage = 20
): Promise<FecContribution[]> {
  const url = buildUrl("/schedules/schedule_a/", {
    committee_id: committeeId,
    contributor_type: contributorType,
    sort: "-contribution_receipt_amount",
    per_page: String(perPage),
  });
  const data = await fetchJson(url);
  return data.results || [];
}

export { delay };
