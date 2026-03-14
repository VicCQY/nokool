"use client";

import { useState, useEffect, useRef } from "react";

interface BillLink {
  id: string;
  alignment: string;
  relevance: string;
  bill: {
    id: string;
    title: string;
    billNumber: string;
    category: string;
  };
  votePosition?: string | null;
}

interface BillSearchResult {
  id: string;
  title: string;
  billNumber: string;
  category: string;
  votePosition: string | null;
}

function getVoteAlignment(
  billAlignment: string,
  votePosition: string,
): "supports" | "opposes" | "neutral" {
  if (votePosition === "ABSTAIN" || votePosition === "ABSENT") return "neutral";
  if (billAlignment === "aligns") {
    return votePosition === "YEA" ? "supports" : "opposes";
  }
  return votePosition === "YEA" ? "opposes" : "supports";
}

const VOTE_BADGE_COLORS: Record<string, string> = {
  YEA: "bg-green-100 text-green-700",
  NAY: "bg-red-100 text-red-700",
  ABSTAIN: "bg-gray-100 text-gray-500",
  ABSENT: "bg-gray-100 text-gray-400",
};

export function BillLinksManager({
  promiseId,
  politicianId,
  initialLinks,
}: {
  promiseId: string;
  politicianId: string;
  initialLinks: BillLink[];
}) {
  const [links, setLinks] = useState<BillLink[]>(initialLinks);
  const [autoMatching, setAutoMatching] = useState(false);

  // Search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BillSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Selected bill state
  const [selectedBill, setSelectedBill] = useState<BillSearchResult | null>(null);
  const [selectedAlignment, setSelectedAlignment] = useState<"aligns" | "contradicts">("aligns");
  const [linking, setLinking] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/bills/search?q=${encodeURIComponent(query)}&politicianId=${politicianId}`,
        );
        if (res.ok) {
          const data = await res.json();
          // Filter out already-linked bills
          const linkedIds = new Set(links.map((l) => l.bill.id));
          setResults(data.filter((b: BillSearchResult) => !linkedIds.has(b.id)));
          setShowResults(true);
        }
      } catch {}
      finally { setSearching(false); }
    }, 300);
  }, [query, politicianId, links]);

  async function handleAutoMatch() {
    setAutoMatching(true);
    try {
      const res = await fetch(`/api/admin/promises/${promiseId}/auto-match`, {
        method: "POST",
      });
      if (res.ok) {
        await refreshLinks();
      }
    } catch {
      alert("Auto-match failed");
    } finally {
      setAutoMatching(false);
    }
  }

  async function refreshLinks() {
    const res = await fetch(`/api/admin/promises/${promiseId}/bill-links`);
    if (res.ok) {
      const data = await res.json();
      // Map the API response to our BillLink shape
      setLinks(
        data.map((l: Record<string, unknown>) => ({
          id: l.id,
          alignment: l.alignment,
          relevance: l.relevance,
          bill: {
            id: (l.bill as Record<string, unknown>).id,
            title: (l.bill as Record<string, unknown>).title,
            billNumber: (l.bill as Record<string, unknown>).billNumber,
            category: (l.bill as Record<string, unknown>).category,
          },
          votePosition: getVoteFromBill(l),
        })),
      );
    }
  }

  function getVoteFromBill(link: Record<string, unknown>): string | null {
    const bill = link.bill as Record<string, unknown>;
    const votes = bill.votes as Array<{ position: string }> | undefined;
    return votes && votes.length > 0 ? votes[0].position : null;
  }

  async function handleSelectBill(bill: BillSearchResult) {
    setSelectedBill(bill);
    setShowResults(false);
    setQuery("");
  }

  async function handleLinkBill() {
    if (!selectedBill) return;
    setLinking(true);
    try {
      const res = await fetch(`/api/admin/promises/${promiseId}/bill-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billId: selectedBill.id,
          alignment: selectedAlignment,
          relevance: "manual",
        }),
      });
      if (res.ok) {
        setLinks((prev) => [
          {
            id: (await res.json()).id || Date.now().toString(),
            alignment: selectedAlignment,
            relevance: "manual",
            bill: {
              id: selectedBill.id,
              title: selectedBill.title,
              billNumber: selectedBill.billNumber,
              category: selectedBill.category,
            },
            votePosition: selectedBill.votePosition,
          },
          ...prev,
        ]);
        // Refresh to get proper IDs
        await refreshLinks();
        setSelectedBill(null);
        setSelectedAlignment("aligns");
      } else {
        alert("Failed to link bill");
      }
    } catch {
      alert("Failed to link bill");
    } finally {
      setLinking(false);
    }
  }

  async function handleToggleAlignment(linkId: string, current: string) {
    const newAlignment = current === "aligns" ? "contradicts" : "aligns";
    const res = await fetch(
      `/api/admin/promises/${promiseId}/bill-links/${linkId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alignment: newAlignment }),
      },
    );
    if (res.ok) {
      setLinks((prev) =>
        prev.map((l) =>
          l.id === linkId ? { ...l, alignment: newAlignment } : l,
        ),
      );
    }
  }

  async function handleDelete(linkId: string) {
    if (!confirm("Remove this bill link?")) return;
    const res = await fetch(
      `/api/admin/promises/${promiseId}/bill-links/${linkId}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
    }
  }

  return (
    <div className="max-w-lg rounded-lg bg-white p-6 border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Related Bills</h2>
        <button
          onClick={handleAutoMatch}
          disabled={autoMatching}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {autoMatching ? "Matching..." : "Auto-Match"}
        </button>
      </div>

      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-4">
        Auto-matching is experimental. Use the search below to manually link specific bills.
      </p>

      {/* Manual bill search */}
      <div className="mb-4" ref={searchRef}>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Link a bill manually
        </label>
        <div className="relative">
          <input
            type="text"
            placeholder="Search by bill title or number..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setShowResults(true)}
          />
          {searching && (
            <div className="absolute right-3 top-2.5">
              <svg className="h-4 w-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}

          {/* Search results dropdown */}
          {showResults && results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
              {results.map((bill) => (
                <button
                  key={bill.id}
                  type="button"
                  onClick={() => handleSelectBill(bill)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                >
                  <p className="text-sm text-gray-900 truncate">{bill.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400 font-mono">{bill.billNumber}</span>
                    <span className="text-xs text-gray-400">{bill.category}</span>
                    {bill.votePosition && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${VOTE_BADGE_COLORS[bill.votePosition] || "bg-gray-100 text-gray-500"}`}>
                        {bill.votePosition}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
          {showResults && results.length === 0 && query.length >= 2 && !searching && (
            <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg px-3 py-3">
              <p className="text-sm text-gray-400">No bills found</p>
            </div>
          )}
        </div>
      </div>

      {/* Selected bill - alignment choice */}
      {selectedBill && (
        <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3">
          <p className="text-sm font-medium text-gray-900 truncate">{selectedBill.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-400 font-mono">{selectedBill.billNumber}</span>
            {selectedBill.votePosition && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${VOTE_BADGE_COLORS[selectedBill.votePosition] || "bg-gray-100 text-gray-500"}`}>
                Voted {selectedBill.votePosition}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-3">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="alignment"
                checked={selectedAlignment === "aligns"}
                onChange={() => setSelectedAlignment("aligns")}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Aligns</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="alignment"
                checked={selectedAlignment === "contradicts"}
                onChange={() => setSelectedAlignment("contradicts")}
                className="h-4 w-4 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm text-gray-700">Contradicts</span>
            </label>
            <div className="flex-1" />
            <button
              onClick={handleLinkBill}
              disabled={linking}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {linking ? "Linking..." : "Link Bill"}
            </button>
            <button
              onClick={() => setSelectedBill(null)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Linked bills list */}
      {links.length === 0 ? (
        <p className="text-sm text-gray-400">
          No bills linked yet. Use the search above to link bills manually, or click Auto-Match.
        </p>
      ) : (
        <div className="space-y-3">
          {links.map((link) => {
            const votePos = link.votePosition;
            const alignment = votePos
              ? getVoteAlignment(link.alignment, votePos)
              : null;

            return (
              <div
                key={link.id}
                className="rounded-md border border-gray-100 bg-gray-50 p-3"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {link.bill.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400 font-mono">
                        {link.bill.billNumber}
                      </span>
                      <span className="text-xs text-gray-400">
                        {link.bill.category}
                      </span>
                      {link.relevance === "auto" && (
                        <span className="text-[10px] text-gray-400 italic">
                          auto
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleAlignment(link.id, link.alignment)}
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold shrink-0 ${
                      link.alignment === "aligns"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                    title="Click to toggle"
                  >
                    {link.alignment === "aligns" ? "Aligns" : "Contradicts"}
                  </button>
                  <button
                    onClick={() => handleDelete(link.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
                    title="Remove link"
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
                </div>

                {/* Vote position and alignment result */}
                {votePos && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${VOTE_BADGE_COLORS[votePos] || "bg-gray-100 text-gray-500"}`}>
                      {votePos}
                    </span>
                    {alignment === "supports" && (
                      <span className="text-xs font-medium text-green-600">Supports Promise</span>
                    )}
                    {alignment === "opposes" && (
                      <span className="text-xs font-medium text-red-600">Opposes Promise</span>
                    )}
                    {alignment === "neutral" && (
                      <span className="text-xs font-medium text-gray-400">Neutral</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
