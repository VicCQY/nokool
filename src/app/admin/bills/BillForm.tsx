"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, COUNTRIES } from "@/lib/countries";

interface BillFormProps {
  bill?: {
    id: string;
    title: string;
    summary: string;
    billNumber: string;
    category: string;
    country: string;
    session: string;
    dateVoted: string;
    sourceUrl: string | null;
  };
}

export function BillForm({ bill }: BillFormProps) {
  const router = useRouter();
  const isEdit = !!bill;

  const [form, setForm] = useState({
    title: bill?.title ?? "",
    summary: bill?.summary ?? "",
    billNumber: bill?.billNumber ?? "",
    category: bill?.category ?? "",
    country: bill?.country ?? "US",
    session: bill?.session ?? "",
    dateVoted: bill?.dateVoted
      ? new Date(bill.dateVoted).toISOString().slice(0, 10)
      : "",
    sourceUrl: bill?.sourceUrl ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const url = isEdit ? `/api/bills/${bill.id}` : "/api/bills";
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      router.push("/admin/bills");
      router.refresh();
    } else {
      alert("Failed to save bill");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Title
        </label>
        <input
          type="text"
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Summary
        </label>
        <textarea
          required
          rows={3}
          value={form.summary}
          onChange={(e) => setForm({ ...form, summary: e.target.value })}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Bill Number
          </label>
          <input
            type="text"
            required
            value={form.billNumber}
            onChange={(e) => setForm({ ...form, billNumber: e.target.value })}
            placeholder="e.g., H.R.3684 or C-11"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Session
          </label>
          <input
            type="text"
            required
            value={form.session}
            onChange={(e) => setForm({ ...form, session: e.target.value })}
            placeholder="e.g., 117th Congress"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            required
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">Select category</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
            <option value="Technology">Technology</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Country
          </label>
          <select
            required
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          >
            {Object.entries(COUNTRIES).map(([code, info]) => (
              <option key={code} value={code}>
                {info.flag} {info.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date Voted
          </label>
          <input
            type="date"
            required
            value={form.dateVoted}
            onChange={(e) => setForm({ ...form, dateVoted: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Source URL
          </label>
          <input
            type="url"
            value={form.sourceUrl}
            onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : isEdit ? "Update Bill" : "Create Bill"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/bills")}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
