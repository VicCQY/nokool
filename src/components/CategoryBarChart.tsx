"use client";

import { useState } from "react";
import {
  calculateCategoryBreakdown,
  type CategoryBreakdown,
} from "@/lib/categories";
import type { PromiseStatus } from "@prisma/client";

interface Props {
  promises: { category: string; status: PromiseStatus }[];
}

const SEGMENTS: {
  key: keyof CategoryBreakdown;
  label: string;
  color: string;
}[] = [
  { key: "fulfilled", label: "Fulfilled", color: "#22c55e" },
  { key: "partial", label: "Partial", color: "#eab308" },
  { key: "inProgress", label: "In Progress", color: "#3b82f6" },
  { key: "notStarted", label: "Not Started", color: "#9ca3af" },
  { key: "broken", label: "Broken", color: "#ef4444" },
];

export function CategoryBarChart({ promises }: Props) {
  const breakdown = calculateCategoryBreakdown(promises).sort(
    (a, b) => b.fulfillmentPercent - a.fulfillmentPercent,
  );
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    label: string;
    count: number;
    category: string;
  } | null>(null);

  if (breakdown.length === 0) return null;

  const maxTotal = Math.max(...breakdown.map((c) => c.total));

  return (
    <div
      className="relative space-y-3"
      onClick={() => setTooltip(null)}
    >
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-2 text-xs">
        {SEGMENTS.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: s.color }}
            />
            {s.label}
          </span>
        ))}
      </div>

      {breakdown.map((cat) => (
        <div key={cat.category} className="group">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-sm font-medium text-[#1A1A1A] w-28 sm:w-36 truncate shrink-0">
              {cat.category}
            </span>
            <div className="flex-1 flex h-6 rounded-md overflow-hidden bg-gray-100">
              {SEGMENTS.map((seg) => {
                const count = cat[seg.key] as number;
                if (count === 0) return null;
                const widthPct = (count / maxTotal) * 100;
                return (
                  <div
                    key={seg.key}
                    className="h-full transition-all duration-500 cursor-pointer relative"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: seg.color,
                      minWidth: count > 0 ? 4 : 0,
                    }}
                    onMouseEnter={(e) => {
                      const rect = (
                        e.currentTarget.closest(".relative") as HTMLElement
                      )?.getBoundingClientRect();
                      if (rect) {
                        setTooltip({
                          x: e.clientX - rect.left,
                          y: e.clientY - rect.top,
                          label: seg.label,
                          count,
                          category: cat.category,
                        });
                      }
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}
            </div>
            <span className="text-xs text-[#4A4A4A] w-16 text-right shrink-0">
              <span className="font-bold">{cat.fulfillmentPercent}%</span>
              <span className="text-gray-400 ml-1">({cat.total})</span>
            </span>
          </div>
        </div>
      ))}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-20 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg text-xs pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <p className="font-medium text-[#1A1A1A]">
            {tooltip.category}
          </p>
          <p className="text-[#4A4A4A]">
            {tooltip.label}: {tooltip.count}
          </p>
        </div>
      )}
    </div>
  );
}
