import { prisma } from "./prisma";
import {
  fetchAllExecutiveActions,
  PRESIDENT_SLUGS,
  type TaggedDocument,
} from "./federal-register-api";
import { ExecutiveActionType } from "@prisma/client";

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Immigration: [
    "border", "immigration", "deportation", "alien", "asylum", "visa",
    "refugee", "citizenship", "ice", "customs", "migrant", "migration",
  ],
  Economy: [
    "tariff", "trade", "tax", "economic", "commerce", "business",
    "financial", "inflation", "jobs", "employment", "wage", "fiscal",
    "budget", "treasury", "import", "export", "market",
  ],
  Environment: [
    "energy", "oil", "gas", "drilling", "climate", "environmental",
    "epa", "paris", "carbon", "emissions", "conservation", "renewable",
    "fossil", "pipeline", "mining", "pollution", "water",
  ],
  Healthcare: [
    "health", "medical", "drug", "pharmaceutical", "medicare", "medicaid",
    "vaccine", "fda", "hospital", "opioid", "mental health",
  ],
  Education: [
    "education", "school", "university", "college", "student", "teacher",
    "academic", "title ix",
  ],
  "Foreign Policy": [
    "foreign", "international", "treaty", "sanctions", "diplomatic",
    "nato", "military", "defense", "national security", "intelligence",
    "arms", "weapons", "nuclear", "iran", "china", "russia", "ukraine",
    "israel", "terrorist", "terrorism",
  ],
  Justice: [
    "justice", "law enforcement", "crime", "prison", "court", "rights",
    "discrimination", "pardon", "clemency", "police", "civil rights",
    "constitutional", "amendment",
  ],
  Technology: [
    "technology", "cyber", "artificial intelligence", "internet", "data",
    "digital", "telecom", "space", "nasa", "quantum", "semiconductor",
    "tiktok", "social media",
  ],
  Housing: [
    "housing", "mortgage", "rent", "homeless", "hud",
  ],
  Infrastructure: [
    "infrastructure", "transportation", "highway", "bridge", "rail",
    "water", "construction", "transit", "airport", "port",
  ],
};

function categorizeAction(title: string, abstract: string | null): string {
  const text = `${title} ${abstract || ""}`.toLowerCase();

  let bestCategory = "Other";
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (text.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
}

const TYPE_MAP: Record<string, ExecutiveActionType> = {
  executive_order: "EXECUTIVE_ORDER",
  memorandum: "PRESIDENTIAL_MEMORANDUM",
  proclamation: "PROCLAMATION",
};

function mapDocumentType(doc: TaggedDocument): ExecutiveActionType | null {
  return TYPE_MAP[doc.fetchedType] || null;
}

export interface SyncResult {
  executiveOrders: number;
  memorandums: number;
  proclamations: number;
  updated: number;
  errors: string[];
}

export async function syncExecutiveActions(
  politicianId: string,
  year?: number,
): Promise<SyncResult> {
  const politician = await prisma.politician.findUnique({
    where: { id: politicianId },
  });

  if (!politician) throw new Error("Politician not found");
  if (politician.branch !== "executive") {
    throw new Error("Executive actions sync is only for executive branch politicians");
  }

  const slug = PRESIDENT_SLUGS[politician.name];
  if (!slug) {
    throw new Error(`No Federal Register slug mapped for "${politician.name}"`);
  }

  const startYear = year || politician.termStart.getFullYear();
  const docs = await fetchAllExecutiveActions(slug, startYear);

  const result: SyncResult = {
    executiveOrders: 0,
    memorandums: 0,
    proclamations: 0,
    updated: 0,
    errors: [],
  };

  // Filter to only actions within the current term
  const termStartTime = politician.termStart.getTime();

  for (const doc of docs) {
    try {
      const actionType = mapDocumentType(doc);
      if (!actionType) continue;

      const dateIssued = doc.signing_date
        ? new Date(doc.signing_date)
        : new Date(doc.publication_date);

      // Skip actions before term start
      if (dateIssued.getTime() < termStartTime) continue;

      const category = categorizeAction(doc.title, doc.abstract);
      const summary = doc.abstract || doc.title;

      // Upsert by title + politicianId to avoid duplicates
      const existing = await prisma.executiveAction.findFirst({
        where: {
          politicianId,
          title: doc.title,
        },
      });

      if (existing) {
        await prisma.executiveAction.update({
          where: { id: existing.id },
          data: {
            sourceUrl: doc.html_url,
            summary,
            category,
            type: actionType,
            dateIssued,
          },
        });
        result.updated++;
      } else {
        await prisma.executiveAction.create({
          data: {
            politicianId,
            title: doc.title,
            type: actionType,
            summary,
            category,
            dateIssued,
            sourceUrl: doc.html_url,
            relatedPromises: [],
          },
        });

        switch (actionType) {
          case "EXECUTIVE_ORDER": result.executiveOrders++; break;
          case "PRESIDENTIAL_MEMORANDUM": result.memorandums++; break;
          case "PROCLAMATION": result.proclamations++; break;
        }
      }
    } catch (err) {
      result.errors.push(`Failed to sync "${doc.title}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}
