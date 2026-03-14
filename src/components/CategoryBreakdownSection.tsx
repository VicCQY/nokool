"use client";

import { useState, useEffect } from "react";
import { CategoryRadarChart } from "./CategoryRadarChart";
import { CategoryBarChart } from "./CategoryBarChart";
import type { PromiseStatus } from "@prisma/client";

interface Props {
  promises: { category: string; status: PromiseStatus }[];
}

export function CategoryBreakdownSection({ promises }: Props) {
  const [chartType, setChartType] = useState<"radar" | "bars">("radar");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    setIsMobile(mql.matches);
    if (mql.matches) setChartType("bars");

    function handler(e: MediaQueryListEvent) {
      setIsMobile(e.matches);
      if (e.matches) setChartType("bars");
    }
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Need at least 1 promise with a category
  if (promises.length === 0) return null;

  // Radar needs 3+ categories
  const uniqueCategories = new Set(promises.map((p) => p.category));
  const canShowRadar = uniqueCategories.size >= 3;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-brand-charcoal">
          Where They Deliver (And Where They Don&apos;t)
        </h2>
        {canShowRadar && !isMobile && (
          <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
            <button
              onClick={() => setChartType("radar")}
              className={`px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                chartType === "radar"
                  ? "bg-[#0D0D0D] text-white"
                  : "text-slate hover:bg-gray-50"
              }`}
            >
              Radar
            </button>
            <button
              onClick={() => setChartType("bars")}
              className={`px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                chartType === "bars"
                  ? "bg-[#0D0D0D] text-white"
                  : "text-slate hover:bg-gray-50"
              }`}
            >
              Bars
            </button>
          </div>
        )}
      </div>

      {chartType === "radar" && canShowRadar ? (
        <CategoryRadarChart promises={promises} />
      ) : (
        <CategoryBarChart promises={promises} />
      )}
    </div>
  );
}
