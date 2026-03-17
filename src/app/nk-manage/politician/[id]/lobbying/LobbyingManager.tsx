"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface LobbyingItem {
  id: string;
  lobbyistName: string;
  clientName: string;
  clientIndustry: string;
  issue: string;
  amount: number;
  year: number;
  sourceUrl: string | null;
}

const INDUSTRIES = [
  "Oil & Gas", "Finance", "Technology", "Pharmaceutical", "Defense",
  "Healthcare", "Education", "Real Estate", "Political", "Entertainment",
  "Transportation", "Engineering", "Labour", "Manufacturing",
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
}

export function LobbyingManager({
  politicianId,
  records,
}: {
  politicianId: string;
  records: LobbyingItem[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    lobbyistName: "", clientName: "", clientIndustry: "", issue: "",
    amount: "", year: "", sourceUrl: "",
  });

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/politicians/${politicianId}/lobbying`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount), year: parseInt(form.year) }),
    });
    if (res.ok) {
      setForm({ lobbyistName: "", clientName: "", clientIndustry: "", issue: "", amount: "", year: "", sourceUrl: "" });
      setShowForm(false);
      router.refresh();
    } else {
      alert("Failed to add lobbying record");
    }
    setSaving(false);
  }

  async function handleDelete(recordId: string) {
    if (!confirm("Delete this lobbying record?")) return;
    await fetch(`/api/politicians/${politicianId}/lobbying/${recordId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Lobbying Records ({records.length})
        </h2>
        <button onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
          {showForm ? "Cancel" : "Add Record"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Lobbyist Name</label>
              <input type="text" required value={form.lobbyistName}
                onChange={(e) => setForm({ ...form, lobbyistName: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Client Name</label>
              <input type="text" required value={form.clientName}
                onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Client Industry</label>
              <select required value={form.clientIndustry}
                onChange={(e) => setForm({ ...form, clientIndustry: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none">
                <option value="">Select industry</option>
                {INDUSTRIES.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Issue</label>
              <input type="text" required value={form.issue}
                onChange={(e) => setForm({ ...form, issue: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Amount ($)</label>
              <input type="number" required min="1" step="0.01" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Year</label>
              <input type="number" required min="2000" max="2030" value={form.year}
                onChange={(e) => setForm({ ...form, year: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Source URL (optional)</label>
            <input type="url" value={form.sourceUrl}
              onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none" />
          </div>
          <button type="submit" disabled={saving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Adding..." : "Add Record"}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {records.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{r.clientName}</span>
                <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{r.clientIndustry}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">via {r.lobbyistName}</p>
              <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-400">
                <span className="font-semibold text-gray-900">{formatCurrency(r.amount)}</span>
                <span>{r.year}</span>
                <span className="text-gray-500">{r.issue}</span>
              </div>
            </div>
            <button onClick={() => handleDelete(r.id)} className="text-sm text-red-600 hover:underline ml-4">
              Delete
            </button>
          </div>
        ))}
        {records.length === 0 && (
          <p className="text-gray-500 text-sm">No lobbying records yet.</p>
        )}
      </div>
    </div>
  );
}
