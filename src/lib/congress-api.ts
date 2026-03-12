const BASE_URL = "https://api.congress.gov/v3";

function getApiKey(): string {
  const key = process.env.CONGRESS_API_KEY;
  if (!key) throw new Error("CONGRESS_API_KEY is not set");
  return key;
}

function buildUrl(path: string, params: Record<string, string> = {}): string {
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("api_key", getApiKey());
  url.searchParams.set("format", "json");
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
    throw new Error(`Congress.gov API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ── Types ──

export interface CongressBill {
  congress: number;
  type: string; // "HR", "S", "HJRES", etc.
  number: number;
  title: string;
  url: string;
  latestAction?: { actionDate: string; text: string };
  policyArea?: { name: string };
}

export interface CongressBillDetail {
  congress: number;
  type: string;
  number: number;
  title: string;
  policyArea?: { name: string };
  subjects?: { legislativeSubjects?: { name: string }[] };
}

export interface CongressAction {
  actionDate: string;
  text: string;
  type: string;
  recordedVotes?: {
    rollNumber: number;
    chamber: string;
    congress: number;
    sessionNumber: number;
    url: string;
    date: string;
  }[];
}

export interface CongressMember {
  bioguideId: string;
  name: string;
  firstName: string;
  lastName: string;
  state: string;
  party: string;
  chamber: string;
}

export interface RollCallVote {
  member: {
    bioguideId: string;
    name: string;
  };
  votePosition: string; // "Yea", "Nay", "Not Voting", "Present"
}

// ── API Functions ──

export async function listBills(
  congress: number,
  limit = 20,
  offset = 0
): Promise<{ bills: CongressBill[]; nextUrl?: string }> {
  const url = buildUrl(`/bill/${congress}`, {
    sort: "updateDate+desc",
    limit: String(limit),
    offset: String(offset),
  });
  const data = await fetchJson(url);
  return {
    bills: data.bills || [],
    nextUrl: data.pagination?.next,
  };
}

export async function getBillDetail(
  congress: number,
  billType: string,
  billNumber: number
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const url = buildUrl(`/bill/${congress}/${billType.toLowerCase()}/${billNumber}`);
  const data = await fetchJson(url);
  return data.bill;
}

export async function getBillActions(
  congress: number,
  billType: string,
  billNumber: number
): Promise<CongressAction[]> {
  const url = buildUrl(
    `/bill/${congress}/${billType.toLowerCase()}/${billNumber}/actions`,
    { limit: "100" }
  );
  const data = await fetchJson(url);
  return data.actions || [];
}

export async function getBillSummaries(
  congress: number,
  billType: string,
  billNumber: number
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const url = buildUrl(
    `/bill/${congress}/${billType.toLowerCase()}/${billNumber}/summaries`
  );
  const data = await fetchJson(url);
  return data.summaries || [];
}

export async function getRollCallVote(
  congress: number,
  chamber: string,
  sessionNumber: number,
  rollCallNumber: number
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const url = buildUrl(
    `/vote/${congress}/${chamber.toLowerCase()}/${sessionNumber}/${rollCallNumber}`
  );
  const data = await fetchJson(url);
  return data.vote;
}

export async function listCurrentMembers(
  limit = 250,
  offset = 0
): Promise<{ members: CongressMember[]; nextUrl?: string }> {
  const url = buildUrl("/member", {
    currentMember: "true",
    limit: String(limit),
    offset: String(offset),
  });
  const data = await fetchJson(url);
  return {
    members: data.members || [],
    nextUrl: data.pagination?.next,
  };
}

export async function fetchAllCurrentMembers(): Promise<CongressMember[]> {
  const all: CongressMember[] = [];
  let offset = 0;
  const limit = 250;

  while (true) {
    const { members, nextUrl } = await listCurrentMembers(limit, offset);
    all.push(...members);
    if (!nextUrl || members.length < limit) break;
    offset += limit;
    await delay(500);
  }

  return all;
}

export { delay };
