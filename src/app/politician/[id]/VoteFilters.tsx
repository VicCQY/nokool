"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CATEGORIES } from "@/lib/countries";

const POSITIONS = [
  { value: "YEA", label: "Yea" },
  { value: "NAY", label: "Nay" },
  { value: "ABSTAIN", label: "Abstain" },
  { value: "ABSENT", label: "Absent" },
];

const SORT_OPTIONS = [
  { value: "date", label: "Date (Newest)" },
  { value: "category", label: "Category" },
];

export function VoteFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentCategory = searchParams.get("voteCategory") ?? "";
  const currentPosition = searchParams.get("votePosition") ?? "";
  const currentSort = searchParams.get("voteSort") ?? "date";

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
        onChange={(e) => updateFilter("voteCategory", e.target.value)}
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
        value={currentPosition}
        onChange={(e) => updateFilter("votePosition", e.target.value)}
        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate shadow-sm focus:border-brand-charcoal focus:ring-1 focus:ring-brand-charcoal focus:outline-none transition-colors"
      >
        <option value="">All Positions</option>
        {POSITIONS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      <select
        value={currentSort}
        onChange={(e) => updateFilter("voteSort", e.target.value)}
        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate shadow-sm focus:border-brand-charcoal focus:ring-1 focus:ring-brand-charcoal focus:outline-none transition-colors"
      >
        {SORT_OPTIONS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
