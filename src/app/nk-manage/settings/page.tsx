"use client";

import { useEffect, useState } from "react";

interface IssueWeightRow {
  category: string;
  weight: number;
  source: string;
  updatedAt: string | null;
}

export default function SettingsPage() {
  const [weights, setWeights] = useState<IssueWeightRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/nk-manage/issue-weights")
      .then((r) => r.json())
      .then((data) => {
        setWeights(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function updateWeight(category: string, value: number) {
    setWeights((prev) =>
      prev.map((w) => (w.category === category ? { ...w, weight: value } : w)),
    );
  }

  function updateSource(category: string, value: string) {
    setWeights((prev) =>
      prev.map((w) => (w.category === category ? { ...w, source: value } : w)),
    );
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/nk-manage/issue-weights", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weights: weights.map((w) => ({
            category: w.category,
            weight: w.weight,
            source: w.source,
          })),
        }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Issue weights saved successfully." });
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to save." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error." });
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Settings</h1>
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Settings</h1>
      <p className="text-sm text-gray-500 mb-8">
        Configure issue weights used in the weighted grade calculation.
      </p>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Issue Weights</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Adjust how much each issue category matters in the grade calculation.
            Based on voter priority survey data.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wider">
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium w-24">Weight</th>
                <th className="px-5 py-3 font-medium">Source</th>
                <th className="px-5 py-3 font-medium w-28">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {weights.map((w) => (
                <tr key={w.category} className="border-b border-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-700">
                    {w.category}
                  </td>
                  <td className="px-5 py-3">
                    <input
                      type="number"
                      min={1}
                      max={5}
                      step={0.1}
                      value={w.weight}
                      onChange={(e) =>
                        updateWeight(w.category, parseFloat(e.target.value) || 1)
                      }
                      className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </td>
                  <td className="px-5 py-3">
                    <input
                      type="text"
                      value={w.source}
                      onChange={(e) => updateSource(w.category, e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                      placeholder="e.g., Pew Research Sept 2024"
                    />
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400">
                    {w.updatedAt
                      ? new Date(w.updatedAt).toLocaleDateString()
                      : "Default"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
          <div>
            {message && (
              <p
                className={`text-sm ${
                  message.type === "success" ? "text-green-600" : "text-red-600"
                }`}
              >
                {message.text}
              </p>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save Weights"}
          </button>
        </div>
      </div>
    </div>
  );
}
