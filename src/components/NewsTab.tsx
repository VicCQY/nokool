"use client";

import { useState, useEffect } from "react";

interface Article {
  id: string;
  title: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  summary: string;
  category: string;
}

export function NewsTab({
  politicianId,
  isAdmin,
}: {
  politicianId: string;
  isAdmin: boolean;
}) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [apiConfigured, setApiConfigured] = useState(true);

  useEffect(() => {
    loadCachedArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [politicianId]);

  async function loadCachedArticles() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/politicians/${politicianId}/news`);
      const data = await res.json();
      setArticles(data.articles || []);
      setLastFetched(data.lastFetchedAt);
      if (data.aiConfigured === false) {
        setApiConfigured(false);
        return;
      }

      // If no cached articles, and user is admin, auto-refresh
      if (data.articles?.length === 0 && isAdmin) {
        await refreshArticles();
      }
    } catch {
      setError("Failed to load news");
    } finally {
      setLoading(false);
    }
  }

  async function refreshArticles() {
    setRefreshing(true);
    setError("");
    try {
      const res = await fetch(`/api/politicians/${politicianId}/news/refresh`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.status === 503) {
        setApiConfigured(false);
        return;
      }

      if (!res.ok) {
        setError(data.error || "Refresh failed");
        return;
      }

      setArticles(data.articles || []);
      setLastFetched(data.lastFetchedAt);
    } catch {
      setError("Network error during refresh");
    } finally {
      setRefreshing(false);
    }
  }

  const filtered = categoryFilter === "all"
    ? articles
    : articles.filter((a) => a.category === categoryFilter);

  const usedCategories = Array.from(new Set(articles.map((a) => a.category))).sort();

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  if (!apiConfigured) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
        <p className="text-slate">News unavailable — API not configured</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading news...
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header with refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          {lastFetched && (
            <p className="text-xs font-mono text-gray-400">
              Last updated: {timeAgo(lastFetched)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          {/* Category filter */}
          {usedCategories.length > 1 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="all">All Categories</option>
              {usedCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          {isAdmin && (
            <button
              onClick={refreshArticles}
              disabled={refreshing}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              {refreshing ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Refreshing...
                </span>
              ) : (
                "Refresh News"
              )}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-6">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Articles */}
      <div className="space-y-4">
        {filtered.map((article) => (
          <div
            key={article.id}
            className="rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md"
          >
            <div className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                <a
                  href={article.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-base font-semibold text-brand-charcoal hover:text-brand-red transition-colors"
                >
                  {article.title}
                </a>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs mb-3">
                <span className="font-mono font-medium text-gray-500">{article.sourceName}</span>
                <span className="text-gray-300">&middot;</span>
                <span className="font-mono text-gray-400">
                  {new Date(article.publishedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 font-medium text-slate">
                  {article.category}
                </span>
              </div>
              <p className="text-sm text-slate leading-relaxed">
                {article.summary}
              </p>
            </div>
          </div>
        ))}

        {filtered.length === 0 && articles.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
            <p className="text-slate">No articles match the selected category.</p>
          </div>
        )}

        {articles.length === 0 && !error && (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
            <p className="text-slate">
              No news articles yet.
              {isAdmin
                ? " Click 'Refresh News' to fetch the latest articles."
                : " Check back later for news coverage."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
