const BASE_URL = "https://www.federalregister.gov/api/v1";

const FIELDS = [
  "title",
  "executive_order_number",
  "signing_date",
  "publication_date",
  "abstract",
  "html_url",
  "document_number",
  "subtype",
];

export interface FederalRegisterDocument {
  title: string;
  executive_order_number: number | null;
  signing_date: string | null;
  publication_date: string;
  abstract: string | null;
  html_url: string;
  document_number: string;
  subtype: string | null;
}

interface ApiResponse {
  count: number;
  results: FederalRegisterDocument[];
  next_page_url: string | null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchPresidentialDocuments(
  president: string,
  documentType: string,
  year?: number,
): Promise<FederalRegisterDocument[]> {
  // Build URL manually — URLSearchParams encodes [] which the API rejects
  const parts = [
    `conditions[presidential_document_type]=${encodeURIComponent(documentType)}`,
    `conditions[president]=${encodeURIComponent(president)}`,
    `conditions[type]=PRESDOCU`,
    `per_page=100`,
    ...FIELDS.map((f) => `fields[]=${encodeURIComponent(f)}`),
  ];
  if (year) {
    parts.push(`conditions[publication_date][year]=${year}`);
  }

  const allResults: FederalRegisterDocument[] = [];
  let url: string | null = `${BASE_URL}/documents.json?${parts.join("&")}`;

  while (url) {
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Federal Register API error: ${res.status} - ${body.substring(0, 200)}`);
    }
    const data: ApiResponse = await res.json();
    allResults.push(...data.results);
    url = data.next_page_url;
    if (url) await delay(200);
  }

  return allResults;
}

export interface TaggedDocument extends FederalRegisterDocument {
  fetchedType: "executive_order" | "memorandum" | "proclamation";
}

export async function fetchAllExecutiveActions(
  president: string,
  startYear?: number,
): Promise<TaggedDocument[]> {
  const types = ["executive_order", "memorandum", "proclamation"] as const;
  const allDocs: TaggedDocument[] = [];

  for (const type of types) {
    if (startYear) {
      const currentYear = new Date().getFullYear();
      for (let y = startYear; y <= currentYear; y++) {
        const docs = await fetchPresidentialDocuments(president, type, y);
        allDocs.push(...docs.map((d) => ({ ...d, fetchedType: type })));
      }
    } else {
      const docs = await fetchPresidentialDocuments(president, type);
      allDocs.push(...docs.map((d) => ({ ...d, fetchedType: type })));
    }
  }

  // Sort by date descending
  allDocs.sort((a, b) => {
    const dateA = a.signing_date || a.publication_date;
    const dateB = b.signing_date || b.publication_date;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });

  return allDocs;
}

// Map our politician names to Federal Register president slugs
export const PRESIDENT_SLUGS: Record<string, string> = {
  "Donald Trump": "donald-trump",
  "Joe Biden": "joseph-biden",
};
