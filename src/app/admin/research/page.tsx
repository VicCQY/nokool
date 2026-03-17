"use client";

import { useState, useEffect } from "react";

interface Politician {
  id: string;
  name: string;
  country: string;
  party: string;
}

interface ExistingPromise {
  id: string;
  title: string;
  category: string;
  status: string;
}

interface ResearchedPromise {
  title: string;
  description: string;
  category: string;
  dateMade: string;
  sourceUrl: string;
  severity: number;
  expectedMonths: number;
  selected: boolean;
}

interface NewsArticle {
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedDate: string;
}

const CATEGORIES = [
  "Economy", "Healthcare", "Environment", "Immigration", "Education",
  "Infrastructure", "Foreign Policy", "Justice", "Housing", "Technology", "Other",
];

const STOP_WORDS = new Set(["the", "a", "an", "to", "of", "and", "in", "on", "for", "with", "is", "it", "by", "as", "at", "or", "from", "that", "this", "be", "will", "all", "their", "his", "her"]);

function getSignificantWords(text: string): Set<string> {
  return new Set(
    text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((w) => w.length > 1 && !STOP_WORDS.has(w)),
  );
}

function wordOverlapRatio(a: string, b: string): number {
  const wordsA = getSignificantWords(a);
  const wordsB = getSignificantWords(b);
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  const arrA = Array.from(wordsA);
  for (let j = 0; j < arrA.length; j++) {
    if (wordsB.has(arrA[j])) overlap++;
  }
  const smaller = Math.min(wordsA.size, wordsB.size);
  return overlap / smaller;
}

function findDuplicateMatch(title: string, existing: ExistingPromise[]): string | null {
  for (const ep of existing) {
    if (wordOverlapRatio(title, ep.title) > 0.5) {
      return ep.title;
    }
  }
  return null;
}

export default function ResearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Politician[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedPolId, setSelectedPolId] = useState("");
  const [selectedPolName, setSelectedPolName] = useState("");
  const [customName, setCustomName] = useState("");
  const [customParty, setCustomParty] = useState("");
  const [promises, setPromises] = useState<ResearchedPromise[]>([]);
  const [existingPromises, setExistingPromises] = useState<ExistingPromise[]>([]);
  const [status, setStatus] = useState<"idle" | "researching" | "done" | "importing" | "imported" | "error">("idle");
  const [error, setError] = useState("");
  const [importResult, setImportResult] = useState("");
  const [apiConfigured, setApiConfigured] = useState(true);
  // News state
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [newsStatus, setNewsStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [newsError, setNewsError] = useState("");

  // Debounced search for politicians
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

  // Load existing promises when politician is selected
  useEffect(() => {
    if (!selectedPolId) {
      setExistingPromises([]);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/politicians/${selectedPolId}/promises`);
        if (res.ok) {
          const data = await res.json();
          setExistingPromises(Array.isArray(data) ? data : data.promises || []);
        }
      } catch {
        // Non-critical
      }
    })();
  }, [selectedPolId]);

  async function handleResearch() {
    setStatus("researching");
    setError("");
    setPromises([]);
    setImportResult("");

    try {
      const body = selectedPolId
        ? { politicianId: selectedPolId }
        : { politicianName: customName, party: customParty, country: "US" };

      const res = await fetch("/api/admin/research/promises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.status === 503) {
        setApiConfigured(false);
        setStatus("error");
        setError(data.error);
        return;
      }

      if (!res.ok) {
        setStatus("error");
        setError(data.error || "Research failed");
        return;
      }

      setPromises(
        (data.promises || []).map((p: ResearchedPromise) => ({ ...p, selected: true })),
      );
      setStatus("done");
    } catch {
      setStatus("error");
      setError("Network error — could not reach the server");
    }
  }

  async function handleNewsResearch() {
    if (!selectedPolId) return;
    setNewsStatus("loading");
    setNewsError("");
    setNewsArticles([]);

    try {
      const res = await fetch("/api/admin/research/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ politicianId: selectedPolId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setNewsStatus("error");
        setNewsError(data.error || "News research failed");
        return;
      }

      setNewsArticles(data.articles || []);
      setNewsStatus("done");
    } catch {
      setNewsStatus("error");
      setNewsError("Network error during news research");
    }
  }

  async function handleImport() {
    const polId = selectedPolId;
    if (!polId) {
      setError("Select a politician from the dropdown to import promises");
      return;
    }

    const selected = promises.filter((p) => p.selected);
    if (selected.length === 0) {
      setError("No promises selected for import");
      return;
    }

    setStatus("importing");
    setError("");

    try {
      const res = await fetch("/api/admin/research/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          politicianId: polId,
          promises: selected.map((p) => ({
            title: p.title,
            description: p.description,
            category: p.category,
            status: "NOT_STARTED",
            weight: p.severity,
            expectedMonths: p.expectedMonths,
            dateMade: p.dateMade,
            sourceUrl: p.sourceUrl,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setError(data.error || "Import failed");
        return;
      }

      setStatus("imported");
      setImportResult(`Imported ${data.imported} promises for ${data.politicianName}`);
    } catch {
      setStatus("error");
      setError("Network error during import");
    }
  }

  function updatePromise(index: number, field: string, value: string | number | boolean) {
    setPromises((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
    );
  }

  function removePromise(index: number) {
    setPromises((prev) => prev.filter((_, i) => i !== index));
  }

  function addBlankPromise() {
    setPromises((prev) => [
      ...prev,
      {
        title: "",
        description: "",
        category: "Other",
        dateMade: new Date().toISOString().split("T")[0],
        sourceUrl: "",
        severity: 3,
        expectedMonths: 12,
        selected: true,
      },
    ]);
  }

  function toggleAll(selected: boolean) {
    setPromises((prev) => prev.map((p) => ({ ...p, selected })));
  }

  const selectedCount = promises.filter((p) => p.selected).length;
  const researchTarget = selectedPolName || customName;

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">AI Promise Research</h1>
      <p className="text-sm text-gray-500 mb-8">
        Use Perplexity AI to research a politician&apos;s campaign promises. Review the results,
        edit as needed, then import directly to the database.
      </p>

      {!apiConfigured && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">
            AI provider not configured. Set PERPLEXITY_API_KEY in your .env file.
          </p>
        </div>
      )}

      {/* Step 1: Select Politician */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm mb-6">
        <h2 className="text-base font-bold text-gray-900 mb-4">Step 1: Select Politician</h2>

        <div className="space-y-4">
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Existing Politician
            </label>
            {selectedPolId ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">
                  {selectedPolName}
                </span>
                <button
                  onClick={() => {
                    setSelectedPolId("");
                    setSelectedPolName("");
                    setSearchQuery("");
                    setExistingPromises([]);
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
                placeholder="Search by name..."
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            )}
            {showDropdown && searchResults.length > 0 && !selectedPolId && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-auto">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setSelectedPolId(p.id);
                      setSelectedPolName(`${p.name} (${p.party})`);
                      setSearchQuery("");
                      setShowDropdown(false);
                      setCustomName("");
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {p.name} <span className="text-gray-400">({p.party})</span>
                  </button>
                ))}
              </div>
            )}
            {showDropdown && searchQuery.trim() && searchResults.length === 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg px-3 py-2 text-sm text-gray-400">
                No politicians found
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs text-gray-400">OR</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Politician Name
              </label>
              <input
                type="text"
                value={customName}
                onChange={(e) => {
                  setCustomName(e.target.value);
                  if (e.target.value) {
                    setSelectedPolId("");
                    setSelectedPolName("");
                  }
                }}
                placeholder="e.g. Kamala Harris"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Party
              </label>
              <input
                type="text"
                value={customParty}
                onChange={(e) => setCustomParty(e.target.value)}
                placeholder="e.g. Democratic"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleResearch}
              disabled={(!selectedPolId && !customName) || status === "researching" || !apiConfigured}
              className="rounded-lg bg-[#0D0D0D] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {status === "researching" ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Researching Promises...
                </span>
              ) : (
                "Research Promises"
              )}
            </button>
            {selectedPolId && (
              <button
                onClick={handleNewsResearch}
                disabled={newsStatus === "loading" || !apiConfigured}
                className="rounded-lg border border-gray-200 px-6 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {newsStatus === "loading" ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Researching News...
                  </span>
                ) : (
                  "Research News"
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Existing Promises */}
      {existingPromises.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Existing Promises ({existingPromises.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {existingPromises.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-white border border-gray-200 px-3 py-1 text-xs text-gray-600">
                <span className={`inline-block w-2 h-2 rounded-full ${
                  p.status === "FULFILLED" ? "bg-green-500" :
                  p.status === "IN_PROGRESS" ? "bg-blue-500" :
                  p.status === "BROKEN" ? "bg-red-500" :
                  p.status === "PARTIAL" ? "bg-amber-500" :
                  "bg-gray-300"
                }`} />
                {p.title}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {status === "researching" && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 mb-6">
          <p className="text-sm text-blue-800">
            Researching promises for <strong>{researchTarget}</strong>... This may take
            30-60 seconds while Perplexity searches the web.
          </p>
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 mb-6">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Import success */}
      {status === "imported" && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5 mb-6">
          <p className="text-sm font-semibold text-green-800">{importResult}</p>
        </div>
      )}

      {/* Step 2: Review Results */}
      {promises.length > 0 && status !== "imported" && (
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-base font-bold text-gray-900">
              Step 2: Review Results ({promises.length} promises found)
            </h2>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => toggleAll(true)} className="text-xs text-blue-600 hover:underline">
                Select All
              </button>
              <button onClick={() => toggleAll(false)} className="text-xs text-blue-600 hover:underline">
                Deselect All
              </button>
              <button
                onClick={addBlankPromise}
                className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                + Add Another
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {promises.map((p, i) => {
              const dupMatch = findDuplicateMatch(p.title, existingPromises);
              return (
              <div
                key={i}
                className={`rounded-xl border bg-white p-4 shadow-sm transition-colors ${
                  dupMatch ? "border-amber-300" : p.selected ? "border-gray-200" : "border-gray-100 opacity-60"
                }`}
              >
                {dupMatch && (
                  <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                    Possible duplicate of: <strong>{dupMatch}</strong>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={p.selected}
                    onChange={(e) => updatePromise(i, "selected", e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  <div className="flex-1 min-w-0 space-y-3">
                    <input
                      type="text"
                      value={p.title}
                      onChange={(e) => updatePromise(i, "title", e.target.value)}
                      placeholder="Promise title"
                      className="w-full text-sm font-semibold text-gray-900 border-b border-transparent hover:border-gray-200 focus:border-gray-900 focus:outline-none pb-0.5"
                    />
                    <textarea
                      value={p.description}
                      onChange={(e) => updatePromise(i, "description", e.target.value)}
                      rows={2}
                      placeholder="Description..."
                      className="w-full text-sm text-gray-600 border border-gray-100 rounded-md px-2 py-1.5 hover:border-gray-200 focus:border-gray-900 focus:outline-none resize-none"
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <div>
                        <label className="block text-xs text-gray-400 mb-0.5">Category</label>
                        <select
                          value={p.category}
                          onChange={(e) => updatePromise(i, "category", e.target.value)}
                          className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-900"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-0.5">Date Made</label>
                        <input
                          type="date"
                          value={p.dateMade}
                          onChange={(e) => updatePromise(i, "dateMade", e.target.value)}
                          className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-0.5">Severity (1-5)</label>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((w) => (
                            <button
                              key={w}
                              onClick={() => updatePromise(i, "severity", w)}
                              className={`flex-1 rounded py-1 text-xs font-medium transition-colors ${
                                p.severity === w
                                  ? "bg-gray-900 text-white"
                                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                              }`}
                            >
                              {w}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-0.5">Expected Months</label>
                        <input
                          type="number"
                          min={1}
                          max={120}
                          value={p.expectedMonths}
                          onChange={(e) => updatePromise(i, "expectedMonths", Number(e.target.value) || 1)}
                          className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-0.5">Source</label>
                        <input
                          type="url"
                          value={p.sourceUrl}
                          onChange={(e) => updatePromise(i, "sourceUrl", e.target.value)}
                          placeholder="URL"
                          className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-900"
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => removePromise(i)}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                    title="Remove"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              );
            })}
          </div>

          {/* Step 3: Import */}
          <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-gray-500">
              {selectedCount} of {promises.length} promises selected
              {!selectedPolId && (
                <span className="text-amber-600 ml-2">
                  (select a politician from dropdown to import)
                </span>
              )}
            </p>
            <button
              onClick={handleImport}
              disabled={selectedCount === 0 || !selectedPolId || status === "importing"}
              className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {status === "importing" ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Importing...
                </span>
              ) : (
                `Import ${selectedCount} Selected Promises`
              )}
            </button>
          </div>
        </div>
      )}

      {/* News Results */}
      {newsStatus === "loading" && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 mb-6">
          <p className="text-sm text-blue-800">Researching recent news... This may take 15-30 seconds.</p>
        </div>
      )}
      {newsStatus === "error" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 mb-6">
          <p className="text-sm text-red-800">{newsError}</p>
        </div>
      )}
      {newsArticles.length > 0 && (
        <div className="mb-6">
          <h2 className="text-base font-bold text-gray-900 mb-4">
            Recent News ({newsArticles.length} articles)
          </h2>
          <div className="space-y-3">
            {newsArticles.map((a, i) => (
              <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900">{a.title}</h3>
                    <p className="text-xs text-gray-500 mt-1">{a.source} &middot; {a.publishedDate}</p>
                    <p className="text-sm text-gray-600 mt-2">{a.summary}</p>
                  </div>
                  {a.url && (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      View
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
