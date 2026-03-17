"use client";

import { useState, useEffect, useRef } from "react";

interface ActionLink {
  id: string;
  alignment: string;
  action: {
    id: string;
    title: string;
    type: string;
    category: string;
    dateIssued: string;
  };
}

interface ActionSearchResult {
  id: string;
  title: string;
  type: string;
  category: string;
  dateIssued: string;
}

const TYPE_LABELS: Record<string, string> = {
  EXECUTIVE_ORDER: "Executive Order",
  PRESIDENTIAL_MEMORANDUM: "Memorandum",
  PROCLAMATION: "Proclamation",
  BILL_SIGNED: "Bill Signed",
  BILL_VETOED: "Bill Vetoed",
  POLICY_DIRECTIVE: "Policy Directive",
};

const TYPE_COLORS: Record<string, string> = {
  EXECUTIVE_ORDER: "bg-blue-50 text-blue-700",
  PRESIDENTIAL_MEMORANDUM: "bg-purple-50 text-purple-700",
  PROCLAMATION: "bg-amber-50 text-amber-700",
  BILL_SIGNED: "bg-green-50 text-green-700",
  BILL_VETOED: "bg-red-50 text-red-700",
  POLICY_DIRECTIVE: "bg-gray-100 text-gray-700",
};

export function ExecutiveActionLinksManager({
  promiseId,
  politicianId,
  initialLinks,
}: {
  promiseId: string;
  politicianId: string;
  initialLinks: ActionLink[];
}) {
  const [links, setLinks] = useState<ActionLink[]>(initialLinks);

  // Search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ActionSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Selected action state
  const [selectedAction, setSelectedAction] = useState<ActionSearchResult | null>(null);
  const [selectedAlignment, setSelectedAlignment] = useState<"supports" | "contradicts">("supports");
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
          `/api/politicians/${politicianId}/executive-actions/search?q=${encodeURIComponent(query)}`,
        );
        if (res.ok) {
          const data = await res.json();
          const linkedIds = new Set(links.map((l) => l.action.id));
          setResults(data.filter((a: ActionSearchResult) => !linkedIds.has(a.id)));
          setShowResults(true);
        }
      } catch {}
      finally { setSearching(false); }
    }, 300);
  }, [query, politicianId, links]);

  async function handleSelectAction(action: ActionSearchResult) {
    setSelectedAction(action);
    setShowResults(false);
    setQuery("");
  }

  async function handleLinkAction() {
    if (!selectedAction) return;
    setLinking(true);
    try {
      const res = await fetch(`/api/nk-manage/promises/${promiseId}/action-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionId: selectedAction.id,
          alignment: selectedAlignment,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setLinks((prev) => [
          {
            id: created.id,
            alignment: selectedAlignment,
            action: {
              id: selectedAction.id,
              title: selectedAction.title,
              type: selectedAction.type,
              category: selectedAction.category,
              dateIssued: selectedAction.dateIssued,
            },
          },
          ...prev,
        ]);
        setSelectedAction(null);
        setSelectedAlignment("supports");
      } else {
        alert("Failed to link action");
      }
    } catch {
      alert("Failed to link action");
    } finally {
      setLinking(false);
    }
  }

  async function handleToggleAlignment(linkId: string, current: string) {
    const newAlignment = current === "supports" ? "contradicts" : "supports";
    const res = await fetch(
      `/api/nk-manage/promises/${promiseId}/action-links/${linkId}`,
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
    if (!confirm("Remove this action link?")) return;
    const res = await fetch(
      `/api/nk-manage/promises/${promiseId}/action-links/${linkId}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <div className="max-w-lg rounded-lg bg-white p-6 border border-gray-200 shadow-sm">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Related Executive Actions</h2>

      {/* Search input */}
      <div className="mb-4" ref={searchRef}>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Link an executive action
        </label>
        <div className="relative">
          <input
            type="text"
            placeholder="Search executive actions by title..."
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
              {results.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => handleSelectAction(action)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                >
                  <p className="text-sm text-gray-900 truncate">{action.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${TYPE_COLORS[action.type] || "bg-gray-100 text-gray-500"}`}>
                      {TYPE_LABELS[action.type] || action.type}
                    </span>
                    <span className="text-xs text-gray-400">{formatDate(action.dateIssued)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {showResults && results.length === 0 && query.length >= 2 && !searching && (
            <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg px-3 py-3">
              <p className="text-sm text-gray-400">No executive actions found</p>
            </div>
          )}
        </div>
      </div>

      {/* Selected action - alignment choice */}
      {selectedAction && (
        <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3">
          <p className="text-sm font-medium text-gray-900 truncate">{selectedAction.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${TYPE_COLORS[selectedAction.type] || "bg-gray-100 text-gray-500"}`}>
              {TYPE_LABELS[selectedAction.type] || selectedAction.type}
            </span>
            <span className="text-xs text-gray-400">{formatDate(selectedAction.dateIssued)}</span>
          </div>
          <div className="flex items-center gap-4 mt-3">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="action-alignment"
                checked={selectedAlignment === "supports"}
                onChange={() => setSelectedAlignment("supports")}
                className="h-4 w-4 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">Supports Promise</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="action-alignment"
                checked={selectedAlignment === "contradicts"}
                onChange={() => setSelectedAlignment("contradicts")}
                className="h-4 w-4 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm text-gray-700">Contradicts Promise</span>
            </label>
            <div className="flex-1" />
            <button
              onClick={handleLinkAction}
              disabled={linking}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {linking ? "Linking..." : "Link Action"}
            </button>
            <button
              onClick={() => setSelectedAction(null)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Linked actions list */}
      {links.length === 0 ? (
        <p className="text-sm text-gray-400">
          No executive actions linked yet. Use the search above to link actions to this promise.
        </p>
      ) : (
        <div className="space-y-3">
          {links.map((link) => (
            <div
              key={link.id}
              className="rounded-md border border-gray-100 bg-gray-50 p-3"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {link.action.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${TYPE_COLORS[link.action.type] || "bg-gray-100 text-gray-500"}`}>
                      {TYPE_LABELS[link.action.type] || link.action.type}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDate(link.action.dateIssued)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleAlignment(link.id, link.alignment)}
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold shrink-0 ${
                    link.alignment === "supports"
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700"
                  }`}
                  title="Click to toggle"
                >
                  {link.alignment === "supports" ? "Supports" : "Contradicts"}
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
