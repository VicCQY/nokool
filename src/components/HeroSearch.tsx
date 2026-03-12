"use client";

import { useState } from "react";
import { SearchModal } from "./SearchModal";

export function HeroSearch() {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setSearchOpen(true)}
        className="rounded-lg border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-white/20 transition-all duration-200 flex items-center gap-2"
      >
        <svg
          className="h-4 w-4"
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
        Search
      </button>

      <SearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </>
  );
}
