export interface NewsArticle {
  title: string;
  description: string | null;
  url: string;
  source: { name: string };
  publishedAt: string;
  urlToImage: string | null;
}

export async function searchNews(query: string): Promise<NewsArticle[]> {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey || apiKey === "your_newsapi_key_here") {
    return [];
  }

  try {
    const params = new URLSearchParams({
      q: query,
      sortBy: "relevancy",
      pageSize: "5",
      apiKey,
    });

    const res = await fetch(`https://newsapi.org/v2/everything?${params}`, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) return [];

    const data = await res.json();
    return data.articles ?? [];
  } catch {
    return [];
  }
}
