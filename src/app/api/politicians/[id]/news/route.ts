import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAiConfigured } from "@/lib/ai-provider";
import { isAuthenticatedFromValue, COOKIE_NAME } from "@/lib/admin-auth";

export async function GET(
  request: Request,
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

  // Only expose aiConfigured to authenticated admins
  const cookieHeader = request.headers.get("cookie") || "";
  const cookieMatch = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const isAdmin = cookieMatch ? isAuthenticatedFromValue(cookieMatch[1]) : false;

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
    lastFetchedAt: latestFetch > 0 ? new Date(latestFetch).toISOString() : null,
    ...(isAdmin ? { aiConfigured: isAiConfigured() } : {}),
  });
}
