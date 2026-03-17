"use client";

import { useState, useEffect, useRef } from "react";
import {
  calculateCategoryBreakdown,
  type CategoryBreakdown,
} from "@/lib/categories";
import type { PromiseStatus } from "@prisma/client";

interface Props {
  promises: { category: string; status: PromiseStatus; weight?: number; dateMade?: string; expectedMonths?: number | null }[];
  termInfo?: { termStart: string; termEnd: string | null; branch: string; chamber: string | null };
  issueWeights?: Record<string, number>;
}

function polarToXY(
  cx: number,
  cy: number,
  radius: number,
  angleRad: number,
): [number, number] {
  return [
    cx + radius * Math.cos(angleRad - Math.PI / 2),
    cy + radius * Math.sin(angleRad - Math.PI / 2),
  ];
}

export function CategoryRadarChart({ promises, termInfo, issueWeights }: Props) {
  const parsedTermInfo = termInfo ? {
    termStart: new Date(termInfo.termStart),
    termEnd: termInfo.termEnd ? new Date(termInfo.termEnd) : null,
    branch: termInfo.branch,
    chamber: termInfo.chamber,
  } : undefined;
  const breakdown = calculateCategoryBreakdown(promises, parsedTermInfo, issueWeights);
  const [animProgress, setAnimProgress] = useState(0);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    data: CategoryBreakdown;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const start = performance.now();
          const duration = 1000;
          const animate = (now: number) => {
            const t = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            setAnimProgress(eased);
            if (t < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (breakdown.length < 3) {
    return null; // Radar needs at least 3 axes
  }

  const size = 400;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.36;
  const labelR = size * 0.46;
  const n = breakdown.length;
  const angleStep = (2 * Math.PI) / n;

  // Grid rings at 25, 50, 75, 100%
  const rings = [0.25, 0.5, 0.75, 1.0];

  function ringPoints(fraction: number): string {
    return breakdown
      .map((_, i) => {
        const [x, y] = polarToXY(cx, cy, maxR * fraction, i * angleStep);
        return `${x},${y}`;
      })
      .join(" ");
  }

  // Data polygon
  const dataPoints = breakdown
    .map((cat, i) => {
      const r = (cat.fulfillmentPercent / 100) * maxR * animProgress;
      const [x, y] = polarToXY(cx, cy, r, i * angleStep);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div
      ref={containerRef}
      className="relative flex justify-center"
      onClick={() => setTooltip(null)}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full max-w-[400px] md:max-w-[400px] overflow-visible"
      >
        {/* Grid rings */}
        {rings.map((r) => (
          <polygon
            key={r}
            points={ringPoints(r)}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={0.8}
          />
        ))}

        {/* Axis lines */}
        {breakdown.map((_, i) => {
          const [x, y] = polarToXY(cx, cy, maxR, i * angleStep);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="#e5e7eb"
              strokeWidth={0.8}
            />
          );
        })}

        {/* Data polygon */}
        <polygon
          points={dataPoints}
          fill="rgba(37,99,235,0.2)"
          stroke="#2563EB"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Data points + hit areas */}
        {breakdown.map((cat, i) => {
          const r = (cat.fulfillmentPercent / 100) * maxR * animProgress;
          const [dx, dy] = polarToXY(cx, cy, r, i * angleStep);
          const [hx, hy] = polarToXY(cx, cy, maxR * 0.5, i * angleStep);
          return (
            <g key={cat.category}>
              {/* Invisible hit area */}
              <circle
                cx={hx}
                cy={hy}
                r={24}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect) {
                    setTooltip({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                      data: cat,
                    });
                  }
                }}
                onMouseLeave={() => setTooltip(null)}
              />
              {/* Visible dot */}
              <circle cx={dx} cy={dy} r={4} fill="#2563EB" />
            </g>
          );
        })}

        {/* Labels */}
        {breakdown.map((cat, i) => {
          const angle = i * angleStep;
          const [lx, ly] = polarToXY(cx, cy, labelR, angle);
          // Determine text-anchor based on position
          const normalizedAngle = ((angle - Math.PI / 2) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
          let anchor: "middle" | "start" | "end" = "middle";
          if (normalizedAngle > 0.1 && normalizedAngle < Math.PI - 0.1)
            anchor = "start";
          else if (normalizedAngle > Math.PI + 0.1 && normalizedAngle < 2 * Math.PI - 0.1)
            anchor = "end";

          return (
            <text
              key={cat.category}
              x={lx}
              y={ly}
              textAnchor={anchor}
              dominantBaseline="central"
              className="fill-[#4A4A4A] text-[11px] font-medium"
            >
              {cat.category}
            </text>
          );
        })}

        {/* Ring labels */}
        {rings.map((r) => {
          const [, y] = polarToXY(cx, cy, maxR * r, 0);
          return (
            <text
              key={r}
              x={cx + 3}
              y={y - 3}
              className="fill-gray-300 text-[9px]"
            >
              {Math.round(r * 100)}%
            </text>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-20 rounded-lg border border-gray-200 bg-white p-3 shadow-lg text-sm pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <p className="font-bold text-[#1A1A1A]">{tooltip.data.category}</p>
          <p className="text-xs text-[#4A4A4A] mt-1">
            {tooltip.data.total} promise{tooltip.data.total !== 1 ? "s" : ""} &mdash;{" "}
            <span className="font-semibold">{tooltip.data.fulfillmentPercent}%</span>{" "}
            score
          </p>
          <div className="flex gap-2 mt-1 text-[10px] text-gray-400">
            <span className="text-green-600">{tooltip.data.fulfilled} done</span>
            <span className="text-yellow-600">{tooltip.data.partial} partial</span>
            <span className="text-red-600">{tooltip.data.broken} broken</span>
            <span className="text-blue-600">{tooltip.data.inProgress} active</span>
          </div>
        </div>
      )}
    </div>
  );
}
