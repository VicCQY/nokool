"use client";

import { useState } from "react";

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
}

export function BillLinksManager({
  promiseId,
  initialLinks,
}: {
  promiseId: string;
  initialLinks: BillLink[];
}) {
  const [links, setLinks] = useState<BillLink[]>(initialLinks);
  const [autoMatching, setAutoMatching] = useState(false);

  async function handleAutoMatch() {
    setAutoMatching(true);
    try {
      const res = await fetch(`/api/admin/promises/${promiseId}/auto-match`, {
        method: "POST",
      });
      if (res.ok) {
        // Refresh links
        const linksRes = await fetch(
          `/api/admin/promises/${promiseId}/bill-links`,
        );
        if (linksRes.ok) {
          const data = await linksRes.json();
          setLinks(data);
        }
      }
    } catch {
      alert("Auto-match failed");
    } finally {
      setAutoMatching(false);
    }
  }

  async function handleToggleAlignment(linkId: string, current: string) {
    const newAlignment = current === "supports" ? "opposes" : "supports";
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

      {links.length === 0 ? (
        <p className="text-sm text-gray-400">
          No bills linked yet. Click Auto-Match to find relevant bills.
        </p>
      ) : (
        <div className="space-y-3">
          {links.map((link) => (
            <div
              key={link.id}
              className="flex items-start gap-3 rounded-md border border-gray-100 bg-gray-50 p-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {link.bill.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
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
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  link.alignment === "supports"
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {link.alignment === "supports" ? "Supports" : "Opposes"}
              </button>
              <button
                onClick={() => handleDelete(link.id)}
                className="text-gray-300 hover:text-red-500 transition-colors"
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
          ))}
        </div>
      )}
    </div>
  );
}
