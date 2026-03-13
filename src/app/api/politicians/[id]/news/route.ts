import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAiConfigured } from "@/lib/ai-provider";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const articles = await prisma.newsArticle.findMany({
    where: { politicianId: params.id },
    orderBy: { publishedAt: "desc" },
  });

  // Check freshness — find most recent fetchedAt
  const latestFetch = articles.length > 0
    ? Math.max(...articles.map((a) => a.fetchedAt.getTime()))
    : 0;
  const isFresh = Date.now() - latestFetch < 24 * 60 * 60 * 1000;

  return NextResponse.json({
    articles: articles.map((a) => ({
      id: a.id,
      title: a.title,
      sourceName: a.sourceName,
      sourceUrl: a.sourceUrl,
      publishedAt: a.publishedAt.toISOString(),
      summary: a.summary,
      category: a.category,
    })),
    isFresh,
    lastFetchedAt: latestFetch > 0 ? new Date(latestFetch).toISOString() : null,
    aiConfigured: isAiConfigured(),
  });
}
