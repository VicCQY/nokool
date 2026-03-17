"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DonationItem {
  id: string;
  amount: number;
  date: string;
  electionCycle: string;
  sourceUrl: string | null;
  donor: { id: string; name: string };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
}

export function DonationManager({
  politicianId,
  donations,
  donors,
}: {
  politicianId: string;
  donations: DonationItem[];
  donors: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    donorId: "", amount: "", date: "", electionCycle: "", sourceUrl: "",
  });

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/politicians/${politicianId}/donations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    });
    if (res.ok) {
      setForm({ donorId: "", amount: "", date: "", electionCycle: "", sourceUrl: "" });
      setShowForm(false);
      router.refresh();
    } else {
      alert("Failed to add donation");
    }
    setSaving(false);
  }

  async function handleDelete(donationId: string) {
    if (!confirm("Delete this donation?")) return;
    await fetch(`/api/politicians/${politicianId}/donations/${donationId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Donations ({donations.length})
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          {showForm ? "Cancel" : "Add Donation"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Donor</label>
              <select required value={form.donorId} onChange={(e) => setForm({ ...form, donorId: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none">
                <option value="">Select donor</option>
                {donors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Amount ($)</label>
              <input type="number" required min="1" step="0.01" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
              <input type="date" required value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Election Cycle</label>
              <input type="text" required placeholder="e.g., 2024" value={form.electionCycle}
                onChange={(e) => setForm({ ...form, electionCycle: e.target.value })}
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
            {saving ? "Adding..." : "Add Donation"}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {donations.map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex-1 min-w-0">
              <span className="font-medium text-gray-900">{d.donor.name}</span>
              <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-400">
                <span className="font-semibold text-gray-900">{formatCurrency(d.amount)}</span>
                <span>{new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                <span className="bg-gray-100 px-1.5 py-0.5 rounded">{d.electionCycle}</span>
              </div>
            </div>
            <button onClick={() => handleDelete(d.id)} className="text-sm text-red-600 hover:underline ml-4">
              Delete
            </button>
          </div>
        ))}
        {donations.length === 0 && (
          <p className="text-gray-500 text-sm">No donations recorded yet.</p>
        )}
      </div>
    </div>
  );
}
