import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { researchNews, isAiConfigured } from "@/lib/ai-provider";

export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "AI provider not configured" },
      { status: 503 },
    );
  }

  const politician = await prisma.politician.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  });

  if (!politician) {
    return NextResponse.json({ error: "Politician not found" }, { status: 404 });
  }

  try {
    const articles = await researchNews(politician.name);

    // Delete old articles for this politician
    await prisma.newsArticle.deleteMany({
      where: { politicianId: politician.id },
    });

    // Insert new articles
    const created = await prisma.newsArticle.createMany({
      data: articles.map((a) => ({
        politicianId: politician.id,
        title: a.title,
        sourceName: a.source,
        sourceUrl: a.url,
        publishedAt: new Date(a.publishedDate),
        summary: a.summary,
        category: "Other",
      })),
    });

    // Fetch back the created articles
    const saved = await prisma.newsArticle.findMany({
      where: { politicianId: politician.id },
      orderBy: { publishedAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      count: created.count,
      articles: saved.map((a) => ({
        id: a.id,
        title: a.title,
        sourceName: a.sourceName,
        sourceUrl: a.sourceUrl,
        publishedAt: a.publishedAt.toISOString(),
        summary: a.summary,
        category: a.category,
      })),
      lastFetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("News refresh error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "News fetch failed" },
      { status: 500 },
    );
  }
}
