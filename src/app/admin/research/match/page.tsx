"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Politician {
  id: string;
  name: string;
  party: string;
  branch: string;
}

interface SuggestedMatch {
  promiseId: string;
  promiseTitle: string;
  itemId: string;
  itemTitle: string;
  itemType: "bill" | "action";
  alignment: "aligns" | "contradicts";
  confidence: "high" | "medium";
  reason: string;
  selected: boolean;
}

export default function MatchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Politician[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedPol, setSelectedPol] = useState<Politician | null>(null);
  const [matches, setMatches] = useState<SuggestedMatch[]>([]);
  const [status, setStatus] = useState<"idle" | "matching" | "done" | "approving" | "approved" | "error">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/politicians/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSearchResults(data || []);
        setShowDropdown(true);
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  async function handleMatch() {
    if (!selectedPol) return;
    setStatus("matching");
    setError("");
    setMatches([]);
    setResult("");

    try {
      const res = await fetch("/api/admin/research/match-promises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ politicianId: selectedPol.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setError(data.error || "Matching failed");
        return;
      }

      setMatches(
        (data.matches || []).map((m: SuggestedMatch) => ({ ...m, selected: m.confidence === "high" })),
      );
      setStatus("done");
    } catch {
      setStatus("error");
      setError("Network error during matching");
    }
  }

  async function handleApprove() {
    const selected = matches.filter((m) => m.selected);
    if (selected.length === 0) {
      setError("No matches selected");
      return;
    }

    setStatus("approving");
    setError("");

    try {
      const res = await fetch("/api/admin/research/approve-matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matches: selected.map((m) => ({
            promiseId: m.promiseId,
            itemId: m.itemId,
            itemType: m.itemType,
            alignment: m.alignment,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setError(data.error || "Approval failed");
        return;
      }

      setStatus("approved");
      setResult(`Created ${data.total} links (${data.billLinks} bill, ${data.actionLinks} action)`);
    } catch {
      setStatus("error");
      setError("Network error during approval");
    }
  }

  function toggleMatch(index: number) {
    setMatches((prev) =>
      prev.map((m, i) => (i === index ? { ...m, selected: !m.selected } : m)),
    );
  }

  function selectAllHigh() {
    setMatches((prev) =>
      prev.map((m) => ({ ...m, selected: m.confidence === "high" })),
    );
  }

  function selectAll(val: boolean) {
    setMatches((prev) => prev.map((m) => ({ ...m, selected: val })));
  }

  const selectedCount = matches.filter((m) => m.selected).length;
  const highCount = matches.filter((m) => m.confidence === "high").length;

  // Group matches by promise
  const grouped = new Map<string, SuggestedMatch[]>();
  for (const m of matches) {
    const arr = grouped.get(m.promiseId) || [];
    arr.push(m);
    grouped.set(m.promiseId, arr);
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <Link
          href="/admin/research"
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          &larr; Research
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">AI Promise Matching</h1>
      </div>
      <p className="text-sm text-gray-500 mb-8">
        Use Perplexity AI to intelligently match a politician&apos;s promises to their
        bills and executive actions for the Says vs Does analysis.
      </p>

      {/* Select Politician */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm mb-6">
        <h2 className="text-base font-bold text-gray-900 mb-4">Select Politician</h2>
        <div className="relative">
          {selectedPol ? (
            <div className="flex items-center gap-2">
              <span className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">
                {selectedPol.name} ({selectedPol.party}) — {selectedPol.branch}
              </span>
              <button
                onClick={() => {
                  setSelectedPol(null);
                  setSearchQuery("");
                  setMatches([]);
                  setStatus("idle");
                }}
                className="rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50"
              >
                Clear
              </button>
            </div>
          ) : (
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              placeholder="Search politician..."
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          )}
          {showDropdown && searchResults.length > 0 && !selectedPol && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-auto">
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setSelectedPol(p);
                    setSearchQuery("");
                    setShowDropdown(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  {p.name} <span className="text-gray-400">({p.party})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedPol && (
          <button
            onClick={handleMatch}
            disabled={status === "matching"}
            className="mt-4 rounded-lg bg-[#0D0D0D] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {status === "matching" ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Matching...
              </span>
            ) : (
              "Auto-Match All Promises"
            )}
          </button>
        )}
      </div>

      {/* Status messages */}
      {status === "matching" && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 mb-6">
          <p className="text-sm text-blue-800">
            Analyzing promises against {selectedPol?.branch === "executive" ? "executive actions" : "bills"}...
            This may take 30-90 seconds depending on data volume.
          </p>
        </div>
      )}

      {status === "error" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 mb-6">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {status === "approved" && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5 mb-6">
          <p className="text-sm font-semibold text-green-800">{result}</p>
        </div>
      )}

      {/* Results */}
      {matches.length > 0 && status !== "approved" && (
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-base font-bold text-gray-900">
              Review Matches ({matches.length} suggested, {highCount} high confidence)
            </h2>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => selectAllHigh()} className="text-xs text-blue-600 hover:underline">
                Select High Confidence
              </button>
              <button onClick={() => selectAll(true)} className="text-xs text-blue-600 hover:underline">
                Select All
              </button>
              <button onClick={() => selectAll(false)} className="text-xs text-blue-600 hover:underline">
                Deselect All
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {Array.from(grouped.entries()).map(([promiseId, group]) => (
              <div key={promiseId} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900">{group[0].promiseTitle}</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {group.map((m) => {
                    const idx = matches.indexOf(m);
                    return (
                      <div
                        key={`${m.promiseId}-${m.itemId}`}
                        className={`px-4 py-3 flex items-start gap-3 transition-colors ${
                          m.selected ? "" : "opacity-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={m.selected}
                          onChange={() => toggleMatch(idx)}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                              m.alignment === "aligns"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}>
                              {m.alignment === "aligns" ? "Aligns" : "Contradicts"}
                            </span>
                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                              m.confidence === "high"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-500"
                            }`}>
                              {m.confidence}
                            </span>
                            <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                              {m.itemType}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-gray-800 mt-1">{m.itemTitle}</p>
                          <p className="text-xs text-gray-500 mt-1">{m.reason}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-gray-500">
              {selectedCount} of {matches.length} matches selected
            </p>
            <button
              onClick={handleApprove}
              disabled={selectedCount === 0 || status === "approving"}
              className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {status === "approving" ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Approving...
                </span>
              ) : (
                `Approve ${selectedCount} Matches`
              )}
            </button>
          </div>
        </div>
      )}

      {status === "done" && matches.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 mb-6">
          <p className="text-sm text-gray-500">
            No matches found. This could mean the politician has no promises, no bills/actions,
            or none of them are clearly related.
          </p>
        </div>
      )}
    </div>
  );
}
