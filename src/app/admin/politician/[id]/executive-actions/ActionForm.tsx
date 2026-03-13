"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORIES } from "@/lib/countries";

const ACTION_TYPES = [
  { value: "EXECUTIVE_ORDER", label: "Executive Order" },
  { value: "PRESIDENTIAL_MEMORANDUM", label: "Presidential Memorandum" },
  { value: "PROCLAMATION", label: "Proclamation" },
  { value: "BILL_SIGNED", label: "Bill Signed" },
  { value: "BILL_VETOED", label: "Bill Vetoed" },
  { value: "POLICY_DIRECTIVE", label: "Policy Directive" },
];

interface ActionFormData {
  id?: string;
  title: string;
  type: string;
  summary: string;
  category: string;
  dateIssued: string;
  sourceUrl: string;
  relatedPromises: string[];
}

interface PromiseOption {
  id: string;
  title: string;
}

export function ActionForm({
  politicianId,
  action,
  promises,
}: {
  politicianId: string;
  action?: ActionFormData;
  promises: PromiseOption[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<ActionFormData>(
    action ?? {
      title: "",
      type: "EXECUTIVE_ORDER",
      summary: "",
      category: CATEGORIES[0],
      dateIssued: "",
      sourceUrl: "",
      relatedPromises: [],
    },
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const url = action?.id
      ? `/api/politicians/${politicianId}/executive-actions/${action.id}`
      : `/api/politicians/${politicianId}/executive-actions`;
    const method = action?.id ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      router.push(`/admin/politician/${politicianId}/executive-actions`);
      router.refresh();
    } else {
      setLoading(false);
      alert("Failed to save action");
    }
  }

  function togglePromise(id: string) {
    setForm((f) => ({
      ...f,
      relatedPromises: f.relatedPromises.includes(id)
        ? f.relatedPromises.filter((p) => p !== id)
        : [...f.relatedPromises, id],
    }));
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
          Type
        </label>
        <select
          className={inputClass}
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
        >
          {ACTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Summary
        </label>
        <textarea
          required
          rows={3}
          className={inputClass}
          value={form.summary}
          onChange={(e) => setForm({ ...form, summary: e.target.value })}
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
          Date Issued
        </label>
        <input
          required
          type="date"
          className={inputClass}
          value={form.dateIssued}
          onChange={(e) => setForm({ ...form, dateIssued: e.target.value })}
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
      {promises.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Related Promises
          </label>
          <p className="text-xs text-gray-400 mb-2">
            Select promises this action directly addresses.
          </p>
          <div className="max-h-40 overflow-y-auto space-y-1 rounded-md border border-gray-200 p-2">
            {promises.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={form.relatedPromises.includes(p.id)}
                  onChange={() => togglePromise(p.id)}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm text-gray-700 truncate">
                  {p.title}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Saving..." : action?.id ? "Update" : "Create"}
      </button>
    </form>
  );
}
