"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SearchPageClient({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length >= 2) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      <div className="relative">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search politicians, promises, bills, donors..."
          className="w-full rounded-lg border border-gray-200 bg-white pl-12 pr-4 py-4 text-lg text-brand-charcoal placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-brand-red transition-colors"
        />
      </div>
    </form>
  );
}
