"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CATEGORIES } from "@/lib/countries";

const STATUSES = [
  { value: "FULFILLED", label: "Fulfilled" },
  { value: "PARTIAL", label: "Partial" },
  { value: "BROKEN", label: "Broken" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "NOT_STARTED", label: "Not Started" },
];

export function PromiseFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentCategory = searchParams.get("category") ?? "";
  const currentStatus = searchParams.get("status") ?? "";

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <select
        value={currentCategory}
        onChange={(e) => updateFilter("category", e.target.value)}
        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate shadow-sm focus:border-brand-charcoal focus:ring-1 focus:ring-brand-charcoal focus:outline-none transition-colors"
      >
        <option value="">All Categories</option>
        {CATEGORIES.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>
      <select
        value={currentStatus}
        onChange={(e) => updateFilter("status", e.target.value)}
        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate shadow-sm focus:border-brand-charcoal focus:ring-1 focus:ring-brand-charcoal focus:outline-none transition-colors"
      >
        <option value="">All Statuses</option>
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
