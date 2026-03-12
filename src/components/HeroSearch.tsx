"use client";

import { useState } from "react";
import { SearchModal } from "./SearchModal";

export function HeroSearch() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [heroQuery, setHeroQuery] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (heroQuery.trim().length >= 2) {
      setSearchOpen(true);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="mt-8 flex gap-2 max-w-md">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500"
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
            value={heroQuery}
            onChange={(e) => setHeroQuery(e.target.value)}
            placeholder="Search politicians, promises, bills..."
            className="w-full rounded-lg bg-white/10 border border-white/10 pl-10 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-colors"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-[#0D0D0D] shadow-sm hover:bg-gray-100 transition-all duration-200"
        >
          Search
        </button>
      </form>

      <SearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        initialQuery={heroQuery}
      />
    </>
  );
}
