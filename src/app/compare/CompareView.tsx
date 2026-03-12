"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { PoliticianSelector } from "./PoliticianSelector";
import { KoolAidMeter } from "@/components/KoolAidMeter";
import type { PoliticianComparison } from "./page";

const GRADE_COLORS: Record<string, string> = {
  A: "bg-[#22C55E]",
  B: "bg-[#3B82F6]",
  C: "bg-[#F59E0B]",
  D: "bg-[#F97316]",
  F: "bg-[#EF4444]",
  "N/A": "bg-gray-400",
};

interface CompareViewProps {
  initialA: PoliticianComparison | null;
  initialB: PoliticianComparison | null;
  selectedIdA: string | null;
  selectedIdB: string | null;
}

export function CompareView({
  initialA,
  initialB,
  selectedIdA,
  selectedIdB,
}: CompareViewProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const polA = initialA;
  const polB = initialB;

  const sameSelected =
    selectedIdA && selectedIdB && selectedIdA === selectedIdB;

  const updateUrl = useCallback(
    (side: "a" | "b", id: string | null) => {
      const params = new URLSearchParams();
      const aId = side === "a" ? (id || null) : selectedIdA;
      const bId = side === "b" ? (id || null) : selectedIdB;
      if (aId) params.set("a", aId);
      if (bId) params.set("b", bId);
      const qs = params.toString();
      router.push(qs ? `/compare?${qs}` : "/compare");
    },
    [router, selectedIdA, selectedIdB],
  );

  function handleSwap() {
    const params = new URLSearchParams();
    if (selectedIdB) params.set("a", selectedIdB);
    if (selectedIdA) params.set("b", selectedIdA);
    router.push(`/compare?${params.toString()}`);
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Stats for butterfly chart
  const statRows = [
    {
      label: "Total Promises",
      a: polA?.totalPromises ?? 0,
      b: polB?.totalPromises ?? 0,
      color: "#6b7280",
    },
    {
      label: "Fulfilled",
      a: polA?.fulfilled ?? 0,
      b: polB?.fulfilled ?? 0,
      color: "#22c55e",
    },
    {
      label: "Broken",
      a: polA?.broken ?? 0,
      b: polB?.broken ?? 0,
      color: "#ef4444",
    },
    {
      label: "In Progress",
      a: polA?.inProgress ?? 0,
      b: polB?.inProgress ?? 0,
      color: "#3b82f6",
    },
    {
      label: "Fulfillment %",
      a: polA?.percentage ?? 0,
      b: polB?.percentage ?? 0,
      color: "#8b5cf6",
      isPercent: true,
    },
  ];

  // Categories from both politicians
  const allCategories = new Set<string>();
  if (polA) Object.keys(polA.categories).forEach((c) => allCategories.add(c));
  if (polB) Object.keys(polB.categories).forEach((c) => allCategories.add(c));
  const categories = Array.from(allCategories).sort();

  const bothSelected = polA && polB && !sameSelected;

  return (
    <div>
      {/* Selectors */}
      <div className="flex flex-col md:flex-row items-stretch gap-4 mb-8">
        <div className="flex-1">
          <PoliticianSelector
            label="Politician A"
            selectedId={selectedIdA}
            excludeId={selectedIdB}
            onSelect={(id) => updateUrl("a", id)}
          />
        </div>

        <div className="flex items-center justify-center">
          <button
            onClick={handleSwap}
            className="rounded-lg border border-gray-200 bg-white p-2.5 shadow-sm hover:bg-gray-50 transition-colors"
            title="Swap politicians"
          >
            <svg
              className="h-5 w-5 text-[#4A4A4A]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1">
          <PoliticianSelector
            label="Politician B"
            selectedId={selectedIdB}
            excludeId={selectedIdA}
            onSelect={(id) => updateUrl("b", id)}
          />
        </div>
      </div>

      {/* Share button */}
      {bothSelected && (
        <div className="flex justify-end mb-6">
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-[#4A4A4A] shadow-sm hover:bg-gray-50 transition-colors"
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
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            {copied ? "Copied!" : "Share Comparison"}
          </button>
        </div>
      )}

      {/* Empty state */}
      {!polA && !polB && (
        <div className="rounded-xl border border-gray-200 bg-white p-16 text-center">
          <p className="text-lg text-[#4A4A4A]">
            Select two politicians to compare their track records.
          </p>
        </div>
      )}

      {/* Same politician */}
      {sameSelected && (
        <div className="rounded-xl border border-gray-200 bg-white p-16 text-center">
          <p className="text-lg text-[#4A4A4A]">
            Pick two different politicians. Comparing someone to themselves is
            just a mirror.
          </p>
        </div>
      )}

      {/* Comparison */}
      {bothSelected && (
        <div className="space-y-8">
          {/* Head to Head */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 items-center">
              {/* Politician A */}
              <PoliticianHero pol={polA} />

              {/* VS divider */}
              <div className="flex items-center justify-center">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#0D0D0D] text-white font-extrabold text-sm">
                  VS
                </span>
              </div>

              {/* Politician B */}
              <PoliticianHero pol={polB} />
            </div>
          </div>

          {/* Butterfly chart stats */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-5">
              Stats Comparison
            </h2>
            <div className="space-y-4">
              {statRows.map((row) => {
                const max = row.isPercent
                  ? 100
                  : Math.max(row.a, row.b, 1);
                const pctA = (row.a / max) * 100;
                const pctB = (row.b / max) * 100;

                return (
                  <div key={row.label}>
                    {/* Mobile: stacked */}
                    <div className="md:hidden">
                      <p className="text-xs font-medium text-[#4A4A4A] mb-1.5">
                        {row.label}
                      </p>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-[#1A1A1A] w-8 text-right">
                          {row.a}
                          {row.isPercent ? "%" : ""}
                        </span>
                        <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pctA}%`,
                              backgroundColor: row.color,
                              opacity: 0.7,
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#1A1A1A] w-8 text-right">
                          {row.b}
                          {row.isPercent ? "%" : ""}
                        </span>
                        <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pctB}%`,
                              backgroundColor: row.color,
                              opacity: 0.45,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Desktop: butterfly */}
                    <div className="hidden md:grid grid-cols-[1fr_120px_1fr] items-center gap-2">
                      {/* A bar (right-aligned, extends left from center) */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#1A1A1A] w-8 text-right">
                          {row.a}
                          {row.isPercent ? "%" : ""}
                        </span>
                        <div className="flex-1 h-4 rounded-full bg-gray-100 overflow-hidden flex justify-end">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pctA}%`,
                              backgroundColor: row.color,
                              opacity: 0.7,
                            }}
                          />
                        </div>
                      </div>

                      {/* Label */}
                      <p className="text-xs font-medium text-[#4A4A4A] text-center">
                        {row.label}
                      </p>

                      {/* B bar (left-aligned, extends right from center) */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-4 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pctB}%`,
                              backgroundColor: row.color,
                              opacity: 0.45,
                            }}
                          />
                        </div>
                        <span className="text-xs font-bold text-[#1A1A1A] w-8">
                          {row.b}
                          {row.isPercent ? "%" : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Legend */}
              <div className="flex justify-center gap-6 pt-2 text-xs text-gray-400">
                <span>{polA.name}</span>
                <span>{polB.name}</span>
              </div>
            </div>
          </div>

          {/* Category Breakdown */}
          {categories.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-[#1A1A1A] mb-5">
                Category Breakdown
              </h2>

              {/* Desktop table */}
              <div className="hidden md:block">
                <div className="grid grid-cols-[1fr_auto_1fr] gap-x-4 gap-y-0">
                  {/* Header */}
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider pb-3 text-right">
                    {polA.name}
                  </div>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider pb-3 text-center">
                    Category
                  </div>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider pb-3">
                    {polB.name}
                  </div>

                  {categories.map((cat) => {
                    const a = polA.categories[cat];
                    const b = polB.categories[cat];
                    const aPct = a?.percentage ?? 0;
                    const bPct = b?.percentage ?? 0;
                    const aWins = aPct > bPct;
                    const bWins = bPct > aPct;

                    return (
                      <div key={cat} className="contents">
                        <div
                          className={`text-right py-2.5 px-3 rounded-l-lg ${aWins ? "bg-green-50" : ""}`}
                        >
                          {a ? (
                            <span className="text-sm text-[#1A1A1A]">
                              <span className="font-bold">{aPct}%</span>
                              <span className="text-gray-400 ml-1.5">
                                ({a.count})
                              </span>
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </div>
                        <div className="text-center py-2.5 px-3 border-x border-gray-100">
                          <span className="text-sm font-medium text-[#4A4A4A]">
                            {cat}
                          </span>
                        </div>
                        <div
                          className={`py-2.5 px-3 rounded-r-lg ${bWins ? "bg-green-50" : ""}`}
                        >
                          {b ? (
                            <span className="text-sm text-[#1A1A1A]">
                              <span className="font-bold">{bPct}%</span>
                              <span className="text-gray-400 ml-1.5">
                                ({b.count})
                              </span>
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {categories.map((cat) => {
                  const a = polA.categories[cat];
                  const b = polB.categories[cat];
                  const aPct = a?.percentage ?? 0;
                  const bPct = b?.percentage ?? 0;
                  const aWins = aPct > bPct;
                  const bWins = bPct > aPct;

                  return (
                    <div
                      key={cat}
                      className="rounded-lg border border-gray-100 p-3"
                    >
                      <p className="text-sm font-medium text-[#4A4A4A] mb-2">
                        {cat}
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div
                          className={`rounded-md p-2 ${aWins ? "bg-green-50" : "bg-gray-50"}`}
                        >
                          <p className="text-xs text-gray-400 truncate">
                            {polA.name}
                          </p>
                          {a ? (
                            <p className="text-sm font-bold text-[#1A1A1A]">
                              {aPct}%{" "}
                              <span className="font-normal text-gray-400">
                                ({a.count})
                              </span>
                            </p>
                          ) : (
                            <p className="text-xs text-gray-300">—</p>
                          )}
                        </div>
                        <div
                          className={`rounded-md p-2 ${bWins ? "bg-green-50" : "bg-gray-50"}`}
                        >
                          <p className="text-xs text-gray-400 truncate">
                            {polB.name}
                          </p>
                          {b ? (
                            <p className="text-sm font-bold text-[#1A1A1A]">
                              {bPct}%{" "}
                              <span className="font-normal text-gray-400">
                                ({b.count})
                              </span>
                            </p>
                          ) : (
                            <p className="text-xs text-gray-300">—</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* One side selected only */}
      {((polA && !polB && !sameSelected) ||
        (!polA && polB && !sameSelected)) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            className={
              polA
                ? "rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
                : "rounded-xl border-2 border-dashed border-gray-200 p-6 flex items-center justify-center"
            }
          >
            {polA ? (
              <PoliticianHero pol={polA} />
            ) : (
              <p className="text-[#4A4A4A] text-sm">
                Select a politician for this side.
              </p>
            )}
          </div>
          <div
            className={
              polB
                ? "rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
                : "rounded-xl border-2 border-dashed border-gray-200 p-6 flex items-center justify-center"
            }
          >
            {polB ? (
              <PoliticianHero pol={polB} />
            ) : (
              <p className="text-[#4A4A4A] text-sm">
                Select a politician for this side.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PoliticianHero({ pol }: { pol: PoliticianComparison }) {
  return (
    <div className="flex flex-col items-center text-center">
      {/* Photo */}
      <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-full bg-gray-100 ring-2 ring-gray-100 mb-3">
        {pol.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pol.photoUrl}
            alt={pol.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl font-semibold text-gray-400">
            {pol.name[0]}
          </div>
        )}
      </div>
      <h3 className="text-lg font-bold text-[#1A1A1A]">{pol.name}</h3>
      <p className="text-sm text-[#4A4A4A]">
        {pol.countryFlag} {pol.party}
      </p>

      {/* Grade + Meter */}
      <div className="flex items-center gap-4 mt-4">
        <div className="flex flex-col items-center">
          <span
            className={`inline-flex h-14 w-14 items-center justify-center rounded-full text-white font-extrabold text-xl ${GRADE_COLORS[pol.grade] ?? "bg-gray-400"}`}
          >
            {pol.grade}
          </span>
          <p className="text-sm font-semibold text-[#1A1A1A] mt-1">
            {pol.percentage}%
          </p>
        </div>
        <KoolAidMeter size="md" fulfillmentPercent={pol.percentage} />
      </div>

      {pol.totalPromises === 0 && (
        <p className="text-xs text-gray-400 mt-3 italic">
          No promises tracked yet
        </p>
      )}
    </div>
  );
}
