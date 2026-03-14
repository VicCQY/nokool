"use client";

import { useState, useEffect, useRef } from "react";
import { COUNTRIES } from "@/lib/countries";
import type { Country } from "@prisma/client";

interface SearchResult {
  id: string;
  name: string;
  country: Country;
  party: string;
  photoUrl: string | null;
}

interface PoliticianSelectorProps {
  label: string;
  selectedId: string | null;
  excludeId: string | null;
  onSelect: (id: string) => void;
}

export function PoliticianSelector({
  label,
  selectedId,
  excludeId,
  onSelect,
}: PoliticianSelectorProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Fetch name for pre-selected ID
  useEffect(() => {
    if (!selectedId) {
      setSelectedName(null);
      return;
    }
    fetch(`/api/politicians/search?q=`)
      .then((r) => r.json())
      .then((all: SearchResult[]) => {
        const found = all.find((p) => p.id === selectedId);
        if (found) setSelectedName(found.name);
      });
  }, [selectedId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSearch(value: string) {
    setQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetch(`/api/politicians/search?q=${encodeURIComponent(value)}`)
        .then((r) => r.json())
        .then((data: SearchResult[]) => {
          setResults(
            excludeId ? data.filter((p) => p.id !== excludeId) : data,
          );
          setOpen(true);
        });
    }, 200);
  }

  function handleSelect(pol: SearchResult) {
    setSelectedName(pol.name);
    setQuery("");
    setOpen(false);
    onSelect(pol.id);
  }

  return (
    <div ref={containerRef} className="relative">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        {label}
      </p>
      <div className="relative">
        <input
          type="text"
          placeholder={selectedName ?? "Search by name..."}
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => {
            if (query === "") handleSearch("");
          }}
          className={`w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] focus:outline-none transition-colors ${
            selectedName && !query
              ? "placeholder:text-brand-charcoal placeholder:font-medium"
              : "placeholder:text-gray-400"
          }`}
        />
        {selectedId && (
          <button
            onClick={() => {
              setSelectedName(null);
              setQuery("");
              // Navigate without this side
              onSelect("");
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
          {results.map((pol) => {
            const flag =
              COUNTRIES[pol.country as keyof typeof COUNTRIES]?.flag ?? "";
            return (
              <button
                key={pol.id}
                onClick={() => handleSelect(pol)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
              >
                <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-gray-100">
                  {pol.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pol.photoUrl}
                      alt={pol.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-gray-400">
                      {pol.name[0]}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-brand-charcoal truncate">
                    {pol.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {flag} {pol.party}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {open && results.length === 0 && query && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg p-4">
          <p className="text-sm text-gray-400 text-center">
            No politicians found.
          </p>
        </div>
      )}
    </div>
  );
}
