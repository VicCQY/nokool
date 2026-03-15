"use client";

import { useState } from "react";
import { PoliticianCard } from "@/components/PoliticianCard";

interface PoliticianData {
  id: string;
  name: string;
  party: string;
  photoUrl: string | null;
  termStartStr: string;
  termEndStr: string | null;
  inOfficeSinceStr: string | null;
  grade: string;
  percentage: number;
  promiseCount: number;
  state: string | null;
  district: string | null;
}

const GRADE_ORDER: Record<string, number> = {
  F: 0, D: 1, C: 2, B: 3, A: 4, "N/A": 5,
};

const PARTY_FILTERS = ["All", "Republican", "Democrat", "Independent"] as const;

type SortOption = "grade" | "name" | "party";

export function PoliticianGrid({ politicians }: { politicians: PoliticianData[] }) {
  const [partyFilter, setPartyFilter] = useState<string>("All");
  const [sort, setSort] = useState<SortOption>("grade");

  const filtered = partyFilter === "All"
    ? politicians
    : politicians.filter((p) => p.party === partyFilter);

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "grade") {
      return (GRADE_ORDER[a.grade] ?? 5) - (GRADE_ORDER[b.grade] ?? 5);
    }
    if (sort === "name") {
      return a.name.localeCompare(b.name);
    }
    // sort === "party"
    return a.party.localeCompare(b.party) || a.name.localeCompare(b.name);
  });

  // Only show party filters if there are multiple parties
  const parties = new Set(politicians.map((p) => p.party));
  const showPartyFilter = parties.size > 1;

  return (
    <div className="mt-10">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        {/* Party filter */}
        {showPartyFilter && (
          <div className="flex flex-wrap gap-2">
            {PARTY_FILTERS.map((label) => {
              const active = partyFilter === label;
              return (
                <button
                  key={label}
                  onClick={() => setPartyFilter(label)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? "bg-[#0D0D0D] text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* Sort */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Sort by:</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="grade">Grade (F → A)</option>
            <option value="name">Name (A-Z)</option>
            <option value="party">Party</option>
          </select>
        </div>
      </div>

      {/* Count */}
      <p className="text-sm text-slate font-data mb-6">
        {sorted.length} politician{sorted.length !== 1 ? "s" : ""}
        {partyFilter !== "All" ? ` — ${partyFilter}` : ""}
      </p>

      {/* Grid */}
      {sorted.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((pol) => (
            <PoliticianCard
              key={pol.id}
              id={pol.id}
              name={pol.name}
              party={pol.party}
              photoUrl={pol.photoUrl}
              termStartStr={pol.termStartStr}
              termEndStr={pol.termEndStr}
              inOfficeSinceStr={pol.inOfficeSinceStr}
              grade={pol.grade}
              percentage={pol.percentage}
              promiseCount={pol.promiseCount}
              state={pol.state}
              district={pol.district}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-slate">
            No politicians match the current filter.
          </p>
        </div>
      )}
    </div>
  );
}
