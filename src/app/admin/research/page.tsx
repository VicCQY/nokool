"use client";

import { useState, useEffect } from "react";

interface Politician {
  id: string;
  name: string;
  country: string;
  party: string;
}

interface ResearchedPromise {
  title: string;
  description: string;
  category: string;
  status: string;
  dateMade: string;
  sourceUrl: string;
  weight: number;
  selected: boolean;
}

const CATEGORIES = [
  "Economy", "Healthcare", "Environment", "Immigration", "Education",
  "Infrastructure", "Foreign Policy", "Justice", "Housing", "Technology", "Other",
];

const STATUSES = [
  { value: "NOT_STARTED", label: "Not Started" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "FULFILLED", label: "Fulfilled" },
  { value: "PARTIAL", label: "Partial" },
  { value: "BROKEN", label: "Broken" },
];

export default function ResearchPage() {
  const [politicians, setPoliticians] = useState<Politician[]>([]);
  const [selectedPolId, setSelectedPolId] = useState("");
  const [customName, setCustomName] = useState("");
  const [customParty, setCustomParty] = useState("");
  const [promises, setPromises] = useState<ResearchedPromise[]>([]);
  const [status, setStatus] = useState<"idle" | "researching" | "done" | "importing" | "imported" | "error">("idle");
  const [error, setError] = useState("");
  const [importResult, setImportResult] = useState("");
  const [apiConfigured, setApiConfigured] = useState(true);

  useEffect(() => {
    fetch("/api/politicians")
      .then((r) => r.json())
      .then((data) => setPoliticians(data.politicians || data || []))
      .catch(() => {});
  }, []);

  const selectedPol = politicians.find((p) => p.id === selectedPolId);

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
            status: p.status,
            weight: p.weight,
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
        status: "NOT_STARTED",
        dateMade: new Date().toISOString().split("T")[0],
        sourceUrl: "",
        weight: 3,
        selected: true,
      },
    ]);
  }

  function toggleAll(selected: boolean) {
    setPromises((prev) => prev.map((p) => ({ ...p, selected })));
  }

  const selectedCount = promises.filter((p) => p.selected).length;
  const researchTarget = selectedPol?.name || customName;

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">AI Promise Research</h1>
      <p className="text-sm text-gray-500 mb-8">
        Use AI to research a politician&apos;s campaign promises. Review the results, edit
        as needed, then import directly to the database.
      </p>

      {!apiConfigured && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">
            AI provider not configured. Set ANTHROPIC_API_KEY in your .env file.
          </p>
        </div>
      )}

      {/* Step 1: Select Politician */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm mb-6">
        <h2 className="text-base font-bold text-gray-900 mb-4">Step 1: Select Politician</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Existing Politician
            </label>
            <select
              value={selectedPolId}
              onChange={(e) => {
                setSelectedPolId(e.target.value);
                if (e.target.value) setCustomName("");
              }}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="">Choose a politician...</option>
              {politicians.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.party})
                </option>
              ))}
            </select>
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
                  if (e.target.value) setSelectedPolId("");
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
                Researching...
              </span>
            ) : (
              "Research Promises"
            )}
          </button>
        </div>
      </div>

      {/* Loading */}
      {status === "researching" && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 mb-6">
          <p className="text-sm text-blue-800">
            Researching promises for <strong>{researchTarget}</strong>... This may take
            30-60 seconds while AI searches the web.
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
            {promises.map((p, i) => (
              <div
                key={i}
                className={`rounded-xl border bg-white p-4 shadow-sm transition-colors ${
                  p.selected ? "border-gray-200" : "border-gray-100 opacity-60"
                }`}
              >
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
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                        <label className="block text-xs text-gray-400 mb-0.5">Status</label>
                        <select
                          value={p.status}
                          onChange={(e) => updatePromise(i, "status", e.target.value)}
                          className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-900"
                        >
                          {STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
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
                        <label className="block text-xs text-gray-400 mb-0.5">Weight (1-5)</label>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((w) => (
                            <button
                              key={w}
                              onClick={() => updatePromise(i, "weight", w)}
                              className={`flex-1 rounded py-1 text-xs font-medium transition-colors ${
                                p.weight === w
                                  ? "bg-gray-900 text-white"
                                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                              }`}
                            >
                              {w}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <input
                      type="url"
                      value={p.sourceUrl}
                      onChange={(e) => updatePromise(i, "sourceUrl", e.target.value)}
                      placeholder="Source URL"
                      className="w-full text-xs text-gray-500 border border-gray-100 rounded-md px-2 py-1.5 hover:border-gray-200 focus:border-gray-900 focus:outline-none"
                    />
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
            ))}
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
    </div>
  );
}
