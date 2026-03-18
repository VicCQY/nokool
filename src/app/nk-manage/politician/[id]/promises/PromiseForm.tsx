"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORIES } from "@/lib/countries";

const SEVERITY_OPTIONS = [
  { value: 1, label: "Trivial" },
  { value: 2, label: "Minor" },
  { value: 3, label: "Standard" },
  { value: 4, label: "Major" },
  { value: 5, label: "Cornerstone" },
];

const TIMELINE_OPTIONS = [
  { value: 1, label: "1 month (Day 1 promise)" },
  { value: 6, label: "6 months" },
  { value: 12, label: "12 months" },
  { value: 24, label: "24 months" },
  { value: null, label: "Full term" },
];

interface PromiseData {
  id?: string;
  title: string;
  description: string;
  category: string;
  dateMade: string;
  sourceUrl: string;
  status: string;
  weight: number;
  expectedMonths: number | null;
}

export function PromiseForm({
  politicianId,
  promise,
}: {
  politicianId: string;
  promise?: PromiseData;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<PromiseData>(
    promise ?? {
      title: "",
      description: "",
      category: CATEGORIES[0],
      dateMade: "",
      sourceUrl: "",
      status: "NOT_STARTED",
      weight: 3,
      expectedMonths: null,
    },
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const url = promise?.id
      ? `/api/politicians/${politicianId}/promises/${promise.id}`
      : `/api/politicians/${politicianId}/promises`;
    const method = promise?.id ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      router.push(`/nk-manage/politician/${politicianId}/promises`);
      router.refresh();
    } else {
      setLoading(false);
      alert("Failed to save promise");
    }
  }

  const inputClass =
    "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-lg space-y-4 rounded-lg bg-white p-6 border border-gray-200 shadow-sm"
    >
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Title
        </label>
        <input
          required
          className={inputClass}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          required
          rows={3}
          className={inputClass}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Category
        </label>
        <select
          className={inputClass}
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Promise Severity
        </label>
        <p className="text-xs text-gray-400 mb-2">
          How significant is this promise? Cornerstone promises that defined the
          campaign should be 5.
        </p>
        <div className="flex flex-wrap gap-2">
          {SEVERITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setForm({ ...form, weight: opt.value })}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                form.weight === opt.value
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {opt.value} &mdash; {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Expected Timeline
        </label>
        <p className="text-xs text-gray-400 mb-2">
          How many months should this promise reasonably take? Leave blank to use
          the full term length.
        </p>
        <div className="flex flex-wrap gap-2 mb-2">
          {TIMELINE_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setForm({ ...form, expectedMonths: opt.value })}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                form.expectedMonths === opt.value
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <input
          type="number"
          min={1}
          placeholder="Custom months (optional)"
          className={inputClass}
          value={form.expectedMonths ?? ""}
          onChange={(e) =>
            setForm({
              ...form,
              expectedMonths: e.target.value ? parseInt(e.target.value, 10) : null,
            })
          }
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Status
        </label>
        <select
          className={inputClass}
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
        >
          <option value="NOT_STARTED">Not Started</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="ADVANCING">Advancing</option>
          <option value="FULFILLED">Fulfilled</option>
          <option value="PARTIAL">Partial</option>
          <option value="BROKEN">Broken</option>
          <option value="REVERSED">Reversed</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Date Made
        </label>
        <input
          required
          type="date"
          className={inputClass}
          value={form.dateMade}
          onChange={(e) => setForm({ ...form, dateMade: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Source URL
        </label>
        <input
          type="url"
          className={inputClass}
          value={form.sourceUrl}
          onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Saving..." : promise?.id ? "Update" : "Create"}
      </button>
    </form>
  );
}
