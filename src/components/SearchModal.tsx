"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PromiseStatus, DonorType } from "@prisma/client";

interface SearchResults {
  politicians: {
    results: {
      id: string;
      name: string;
      country: string;
      party: string;
      photoUrl: string | null;
      grade: string;
      percentage: number;
      promiseCount: number;
    }[];
    totalCount: number;
  };
  promises: {
    results: {
      id: string;
      title: string;
      status: PromiseStatus;
      category: string;
      politicianId: string;
      politicianName: string;
    }[];
    totalCount: number;
  };
  bills: {
    results: {
      id: string;
      title: string;
      billNumber: string;
      category: string;
      country: string;
      dateVoted: string;
      politicianId: string | null;
      politicianName: string | null;
    }[];
    totalCount: number;
  };
  donors: {
    results: {
      id: string;
      name: string;
      type: DonorType;
      industry: string;
      totalDonated: number;
    }[];
    totalCount: number;
  };
}

const COUNTRIES: Record<string, { flag: string }> = {
  US: { flag: "\u{1F1FA}\u{1F1F8}" },
  CA: { flag: "\u{1F1E8}\u{1F1E6}" },
  UK: { flag: "\u{1F1EC}\u{1F1E7}" },
  AU: { flag: "\u{1F1E6}\u{1F1FA}" },
  FR: { flag: "\u{1F1EB}\u{1F1F7}" },
  DE: { flag: "\u{1F1E9}\u{1F1EA}" },
};

const GRADE_COLORS: Record<string, string> = {
  A: "bg-grade-A text-white",
  B: "bg-grade-B text-white",
  C: "bg-grade-C text-white",
  D: "bg-grade-D text-white",
  F: "bg-grade-F text-white",
  "N/A": "bg-gray-400 text-white",
};

const STATUS_COLORS: Record<PromiseStatus, { bg: string; text: string; label: string }> = {
  FULFILLED: { bg: "bg-green-50", text: "text-green-700", label: "Fulfilled" },
  PARTIAL: { bg: "bg-yellow-50", text: "text-yellow-700", label: "Partial" },
  BROKEN: { bg: "bg-red-50", text: "text-red-700", label: "Broken" },
  IN_PROGRESS: { bg: "bg-blue-50", text: "text-blue-700", label: "In Progress" },
  NOT_STARTED: { bg: "bg-gray-50", text: "text-gray-600", label: "Not Started" },
};

const DONOR_TYPE_LABELS: Record<DonorType, string> = {
  CORPORATION: "Corporation",
  PAC: "PAC",
  SUPER_PAC: "Super PAC",
  INDIVIDUAL: "Individual",
  UNION: "Union",
  NONPROFIT: "Nonprofit",
  TRADE_ASSOCIATION: "Trade Assoc.",
};

const DONOR_TYPE_COLORS: Record<DonorType, string> = {
  CORPORATION: "bg-blue-50 text-blue-700",
  PAC: "bg-purple-50 text-purple-700",
  SUPER_PAC: "bg-violet-50 text-violet-700",
  INDIVIDUAL: "bg-gray-50 text-gray-600",
  UNION: "bg-amber-50 text-amber-700",
  NONPROFIT: "bg-teal-50 text-teal-700",
  TRADE_ASSOCIATION: "bg-orange-50 text-orange-700",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const STORAGE_KEY = "nokool-recent-searches";

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  const recent = getRecentSearches().filter((s) => s !== query);
  recent.unshift(query);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.slice(0, 5)));
}

export function SearchModal({
  isOpen,
  onClose,
  initialQuery = "",
}: {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Build flat list of navigable results for keyboard nav
  const flatResults: { type: string; href: string }[] = [];
  if (results) {
    results.politicians.results.forEach((p) =>
      flatResults.push({ type: "politician", href: `/politician/${p.id}` }),
    );
    results.promises.results.forEach((p) =>
      flatResults.push({
        type: "promise",
        href: `/politician/${p.politicianId}?tab=promises`,
      }),
    );
    results.bills.results.forEach((b) =>
      flatResults.push({
        type: "bill",
        href: b.politicianId
          ? `/politician/${b.politicianId}?tab=votes`
          : "#",
      }),
    );
    results.donors.results.forEach(() =>
      flatResults.push({ type: "donor", href: "#" }),
    );
  }

  useEffect(() => {
    if (isOpen) {
      setRecentSearches(getRecentSearches());
      setQuery(initialQuery);
      setResults(null);
      setActiveIndex(-1);
      setTimeout(() => inputRef.current?.focus(), 50);
      if (initialQuery.length >= 2) {
        doSearch(initialQuery);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialQuery]);

  const doSearch = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data);
      setActiveIndex(-1);
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length >= 2) {
      debounceRef.current = setTimeout(() => doSearch(query), 300);
    } else {
      setResults(null);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  function navigate(href: string) {
    if (href === "#") return;
    if (query.length >= 2) saveRecentSearch(query);
    onClose();
    router.push(href);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && flatResults[activeIndex]) {
        navigate(flatResults[activeIndex].href);
      } else if (query.length >= 2) {
        saveRecentSearch(query);
        onClose();
        router.push(`/search?q=${encodeURIComponent(query)}`);
      }
    }
  }

  if (!isOpen) return null;

  const hasResults =
    results &&
    (results.politicians.results.length > 0 ||
      results.promises.results.length > 0 ||
      results.bills.results.length > 0 ||
      results.donors.results.length > 0);

  const showEmpty = results && !hasResults && query.length >= 2;
  const showRecent = !results && query.length < 2;

  let flatIndex = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] sm:pt-[15vh] px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200">
          <svg
            className="h-5 w-5 text-gray-400 flex-shrink-0"
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
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search politicians, promises, bills, donors..."
            className="flex-1 text-lg text-brand-charcoal placeholder-gray-400 outline-none bg-transparent"
          />
          {loading && (
            <div className="h-5 w-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          )}
          <kbd className="hidden sm:inline-flex items-center rounded border border-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1">
          {/* Recent searches */}
          {showRecent && (
            <div className="p-5">
              {recentSearches.length > 0 ? (
                <>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                    Recent Searches
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((s) => (
                      <button
                        key={s}
                        onClick={() => setQuery(s)}
                        className="rounded-full bg-gray-100 px-3 py-1.5 text-sm text-slate hover:bg-gray-200 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                    Try searching for
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["Biden", "Healthcare", "Infrastructure Act", "Koch Industries"].map(
                      (s) => (
                        <button
                          key={s}
                          onClick={() => setQuery(s)}
                          className="rounded-full bg-gray-100 px-3 py-1.5 text-sm text-slate hover:bg-gray-200 transition-colors"
                        >
                          {s}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {showEmpty && (
            <div className="p-8 text-center">
              <p className="text-slate">
                No results found for &ldquo;{query}&rdquo;
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Try different keywords or check your spelling.
              </p>
            </div>
          )}

          {/* Results by category */}
          {hasResults && (
            <div className="py-2">
              {/* Politicians */}
              {results.politicians.results.length > 0 && (
                <div>
                  <div className="px-5 py-2 flex items-center gap-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Politicians
                    </p>
                    <span className="text-[10px] bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5">
                      {results.politicians.totalCount}
                    </span>
                  </div>
                  {results.politicians.results.map((p) => {
                    flatIndex++;
                    const idx = flatIndex;
                    return (
                      <button
                        key={p.id}
                        onClick={() => navigate(`/politician/${p.id}`)}
                        className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                          activeIndex === idx
                            ? "bg-blue-50"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-gray-200">
                          {p.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.photoUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-gray-500">
                              {p.name[0]}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-brand-charcoal truncate">
                            {p.name}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {COUNTRIES[p.country]?.flag} {p.party}
                          </p>
                        </div>
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            GRADE_COLORS[p.grade] || "bg-gray-400 text-white"
                          }`}
                        >
                          {p.grade}
                        </span>
                      </button>
                    );
                  })}
                  {results.politicians.totalCount > 5 && (
                    <button
                      onClick={() => {
                        saveRecentSearch(query);
                        onClose();
                        router.push(
                          `/search?q=${encodeURIComponent(query)}`,
                        );
                      }}
                      className="w-full px-5 py-2 text-xs font-medium text-[#2563EB] hover:bg-gray-50 text-left"
                    >
                      View all {results.politicians.totalCount} results
                    </button>
                  )}
                </div>
              )}

              {/* Promises */}
              {results.promises.results.length > 0 && (
                <div>
                  <div className="px-5 py-2 flex items-center gap-2 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Promises
                    </p>
                    <span className="text-[10px] bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5">
                      {results.promises.totalCount}
                    </span>
                  </div>
                  {results.promises.results.map((p) => {
                    flatIndex++;
                    const idx = flatIndex;
                    const sc = STATUS_COLORS[p.status];
                    return (
                      <button
                        key={p.id}
                        onClick={() =>
                          navigate(
                            `/politician/${p.politicianId}?tab=promises`,
                          )
                        }
                        className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                          activeIndex === idx
                            ? "bg-blue-50"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-brand-charcoal truncate">
                            {p.title}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            by {p.politicianName}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${sc.bg} ${sc.text}`}
                        >
                          {sc.label}
                        </span>
                        <span className="inline-flex items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-slate">
                          {p.category}
                        </span>
                      </button>
                    );
                  })}
                  {results.promises.totalCount > 5 && (
                    <button
                      onClick={() => {
                        saveRecentSearch(query);
                        onClose();
                        router.push(
                          `/search?q=${encodeURIComponent(query)}`,
                        );
                      }}
                      className="w-full px-5 py-2 text-xs font-medium text-[#2563EB] hover:bg-gray-50 text-left"
                    >
                      View all {results.promises.totalCount} results
                    </button>
                  )}
                </div>
              )}

              {/* Bills */}
              {results.bills.results.length > 0 && (
                <div>
                  <div className="px-5 py-2 flex items-center gap-2 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Bills
                    </p>
                    <span className="text-[10px] bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5">
                      {results.bills.totalCount}
                    </span>
                  </div>
                  {results.bills.results.map((b) => {
                    flatIndex++;
                    const idx = flatIndex;
                    return (
                      <button
                        key={b.id}
                        onClick={() =>
                          b.politicianId
                            ? navigate(
                                `/politician/${b.politicianId}?tab=votes`,
                              )
                            : undefined
                        }
                        className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                          activeIndex === idx
                            ? "bg-blue-50"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-brand-charcoal truncate">
                            {b.title}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {b.billNumber} &middot;{" "}
                            {new Date(b.dateVoted).toLocaleDateString("en-US", {
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        <span className="inline-flex items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-slate">
                          {b.category}
                        </span>
                      </button>
                    );
                  })}
                  {results.bills.totalCount > 5 && (
                    <button
                      onClick={() => {
                        saveRecentSearch(query);
                        onClose();
                        router.push(
                          `/search?q=${encodeURIComponent(query)}`,
                        );
                      }}
                      className="w-full px-5 py-2 text-xs font-medium text-[#2563EB] hover:bg-gray-50 text-left"
                    >
                      View all {results.bills.totalCount} results
                    </button>
                  )}
                </div>
              )}

              {/* Donors */}
              {results.donors.results.length > 0 && (
                <div>
                  <div className="px-5 py-2 flex items-center gap-2 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Donors
                    </p>
                    <span className="text-[10px] bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5">
                      {results.donors.totalCount}
                    </span>
                  </div>
                  {results.donors.results.map((d) => {
                    flatIndex++;
                    const idx = flatIndex;
                    return (
                      <div
                        key={d.id}
                        className={`w-full flex items-center gap-3 px-5 py-2.5 transition-colors ${
                          activeIndex === idx
                            ? "bg-blue-50"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-brand-charcoal truncate">
                            {d.name}
                          </p>
                          <p className="text-xs text-gray-400">{d.industry}</p>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            DONOR_TYPE_COLORS[d.type]
                          }`}
                        >
                          {DONOR_TYPE_LABELS[d.type]}
                        </span>
                        <span className="text-sm font-semibold text-brand-charcoal whitespace-nowrap">
                          {formatCurrency(d.totalDonated)}
                        </span>
                      </div>
                    );
                  })}
                  {results.donors.totalCount > 5 && (
                    <button
                      onClick={() => {
                        saveRecentSearch(query);
                        onClose();
                        router.push(
                          `/search?q=${encodeURIComponent(query)}`,
                        );
                      }}
                      className="w-full px-5 py-2 text-xs font-medium text-[#2563EB] hover:bg-gray-50 text-left"
                    >
                      View all {results.donors.totalCount} results
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-gray-200 px-5 py-2.5 flex items-center gap-4 text-[10px] text-gray-400">
          <span>
            <kbd className="rounded border border-gray-200 px-1 py-0.5 font-medium">
              &uarr;&darr;
            </kbd>{" "}
            navigate
          </span>
          <span>
            <kbd className="rounded border border-gray-200 px-1 py-0.5 font-medium">
              &crarr;
            </kbd>{" "}
            open
          </span>
          <span>
            <kbd className="rounded border border-gray-200 px-1 py-0.5 font-medium">
              esc
            </kbd>{" "}
            close
          </span>
        </div>
      </div>
    </div>
  );
}
