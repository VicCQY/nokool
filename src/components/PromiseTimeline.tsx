"use client";

import { useState, useMemo } from "react";
import { PromiseStatus } from "@prisma/client";

interface StatusChange {
  id: string;
  oldStatus: PromiseStatus | null;
  newStatus: PromiseStatus;
  changedAt: string;
  note: string | null;
}

interface TimelinePromise {
  id: string;
  title: string;
  category: string;
  dateMade: string;
  status: PromiseStatus;
  statusChanges: StatusChange[];
}

interface PromiseTimelineProps {
  promises: TimelinePromise[];
  termStart: string;
  termEnd: string | null;
}

const STATUS_COLORS: Record<
  PromiseStatus,
  { fill: string; stroke: string; label: string }
> = {
  FULFILLED: { fill: "#22c55e", stroke: "#16a34a", label: "Fulfilled" },
  PARTIAL: { fill: "#eab308", stroke: "#ca8a04", label: "Partial" },
  IN_PROGRESS: { fill: "#3b82f6", stroke: "#2563eb", label: "In Progress" },
  NOT_STARTED: { fill: "#9ca3af", stroke: "#6b7280", label: "Not Started" },
  BROKEN: { fill: "#ef4444", stroke: "#dc2626", label: "Broken" },
};

type TimeRange = "All" | "5Y" | "1Y" | "6M" | "3M";
const RANGES: TimeRange[] = ["All", "5Y", "1Y", "6M", "3M"];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function subtractRange(now: Date, range: TimeRange): Date {
  const d = new Date(now);
  switch (range) {
    case "5Y":
      d.setFullYear(d.getFullYear() - 5);
      break;
    case "1Y":
      d.setFullYear(d.getFullYear() - 1);
      break;
    case "6M":
      d.setMonth(d.getMonth() - 6);
      break;
    case "3M":
      d.setMonth(d.getMonth() - 3);
      break;
    default:
      break;
  }
  return d;
}

function generateTicks(
  start: Date,
  end: Date,
  range: TimeRange,
): { label: string; pct: number }[] {
  const totalMs = end.getTime() - start.getTime();
  if (totalMs <= 0) return [];
  const ticks: { label: string; pct: number }[] = [];

  if (range === "3M") {
    // Bi-weekly labels
    const d = new Date(start);
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    // Start from the 1st and 15th of each month
    while (d <= end) {
      for (const day of [1, 15]) {
        const tick = new Date(d.getFullYear(), d.getMonth(), day);
        if (tick > start && tick < end) {
          const pct = ((tick.getTime() - start.getTime()) / totalMs) * 100;
          ticks.push({
            label: tick.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            }),
            pct,
          });
        }
      }
      d.setMonth(d.getMonth() + 1);
    }
  } else if (range === "6M" || range === "1Y") {
    // Monthly labels
    const d = new Date(start);
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    while (d <= end) {
      const pct = ((d.getTime() - start.getTime()) / totalMs) * 100;
      ticks.push({
        label: d.toLocaleDateString("en-US", {
          month: "short",
          year: range === "1Y" ? "2-digit" : undefined,
        }),
        pct,
      });
      d.setMonth(d.getMonth() + 1);
    }
  } else {
    // "All" or "5Y" — place ticks at Jan 1st of each year (or every 2 years for long spans)
    const yearSpan = end.getFullYear() - start.getFullYear();
    const yearInterval = yearSpan > 10 ? 2 : 1;

    // Start from the first full year after range start
    const firstYear = start.getMonth() === 0 && start.getDate() === 1
      ? start.getFullYear()
      : start.getFullYear() + 1;

    for (let yr = firstYear; yr <= end.getFullYear(); yr += yearInterval) {
      const tick = new Date(yr, 0, 1);
      if (tick > start && tick < end) {
        const pct = ((tick.getTime() - start.getTime()) / totalMs) * 100;
        ticks.push({ label: String(yr), pct });
      }
    }
  }

  return ticks;
}

/**
 * For a given promise, find its effective status at a point in time.
 * Returns the most recent newStatus from statusChanges on or before `asOf`,
 * or the promise's original status if dateMade <= asOf and no changes yet.
 */
function statusAtDate(
  promise: TimelinePromise,
  asOf: Date,
): PromiseStatus | null {
  const made = new Date(promise.dateMade);
  if (made > asOf) return null; // promise didn't exist yet

  const changesBefore = promise.statusChanges
    .filter((c) => new Date(c.changedAt) <= asOf)
    .sort(
      (a, b) =>
        new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime(),
    );

  if (changesBefore.length > 0) return changesBefore[0].newStatus;
  return promise.status; // fallback to current status
}

function Tooltip({
  x,
  y,
  title,
  status,
  date,
  note,
  type,
  onClose,
  isMobile,
}: {
  x: number;
  y: number;
  title: string;
  status: string;
  date: string;
  note: string | null;
  type: "made" | "change";
  onClose: () => void;
  isMobile: boolean;
}) {
  return (
    <div
      className="fixed z-50 max-w-xs rounded-lg border border-gray-200 bg-white p-3 shadow-lg text-sm"
      style={
        isMobile
          ? { left: "50%", transform: "translateX(-50%)", top: y + 10 }
          : { left: x + 10, top: y - 10 }
      }
    >
      <button
        onClick={onClose}
        className="absolute top-1 right-2 text-gray-400 hover:text-gray-600 text-xs"
      >
        ×
      </button>
      <p className="font-semibold text-gray-900 pr-4">{title}</p>
      <p className="text-gray-500 mt-1">
        {type === "made" ? "Promise Made" : status} — {formatDate(date)}
      </p>
      {note && <p className="text-gray-600 mt-1 italic">{note}</p>}
    </div>
  );
}

export function PromiseTimeline({
  promises,
  termStart,
  termEnd,
}: PromiseTimelineProps) {
  const [activeRange, setActiveRange] = useState<TimeRange>("All");
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    title: string;
    status: string;
    date: string;
    note: string | null;
    type: "made" | "change";
  } | null>(null);

  const now = useMemo(() => new Date(), []);

  // Compute time range bounds
  const { rangeStart, rangeEnd } = useMemo(() => {
    const end = termEnd ? new Date(termEnd) : now;

    if (activeRange === "All") {
      // From earliest promise date (or termStart) to today
      let earliest = new Date(termStart);
      for (const p of promises) {
        const d = new Date(p.dateMade);
        if (d < earliest) earliest = d;
      }
      return { rangeStart: earliest, rangeEnd: end };
    }

    const start = subtractRange(end, activeRange);
    // If the computed start is before termStart, just use termStart
    const termStartDate = new Date(termStart);
    return {
      rangeStart: start < termStartDate ? termStartDate : start,
      rangeEnd: end,
    };
  }, [activeRange, termStart, termEnd, promises, now]);

  const totalMs = rangeEnd.getTime() - rangeStart.getTime();

  // Filter promises that are active in this range
  const filteredPromises = useMemo(() => {
    if (activeRange === "All") return promises;

    return promises.filter((p) => {
      const made = new Date(p.dateMade);
      // Promise was made before range end
      if (made > rangeEnd) return false;

      // Has any status change within the range?
      const hasChangeInRange = p.statusChanges.some((sc) => {
        const d = new Date(sc.changedAt);
        return d >= rangeStart && d <= rangeEnd;
      });
      if (hasChangeInRange) return true;

      // Promise was made within the range?
      if (made >= rangeStart) return true;

      // Promise was active (not terminal) at range start
      const s = statusAtDate(p, rangeStart);
      if (s && s !== "FULFILLED" && s !== "BROKEN") return true;

      return false;
    });
  }, [promises, activeRange, rangeStart, rangeEnd]);

  const ticks = useMemo(
    () => generateTicks(rangeStart, rangeEnd, activeRange),
    [rangeStart, rangeEnd, activeRange],
  );

  if (totalMs <= 0 || promises.length === 0) {
    return (
      <p className="text-center text-gray-500 py-8">
        No timeline data available.
      </p>
    );
  }

  function pct(dateStr: string) {
    const d = new Date(dateStr).getTime();
    const clamped = Math.max(
      rangeStart.getTime(),
      Math.min(d, rangeEnd.getTime()),
    );
    return ((clamped - rangeStart.getTime()) / totalMs) * 100;
  }

  function handleMarkerClick(
    e: React.MouseEvent,
    data: {
      title: string;
      status: string;
      date: string;
      note: string | null;
      type: "made" | "change";
    },
  ) {
    e.stopPropagation();
    setTooltip({ x: e.clientX, y: e.clientY, ...data });
  }

  const ROW_HEIGHT = 44;
  const HEADER_HEIGHT = 32;
  const svgHeight =
    HEADER_HEIGHT + filteredPromises.length * ROW_HEIGHT + 8;

  return (
    <div onClick={() => setTooltip(null)}>
      {/* Time range controls + Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        {/* Range buttons */}
        <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={(e) => {
                e.stopPropagation();
                setActiveRange(r);
                setTooltip(null);
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                activeRange === r
                  ? "bg-[#0D0D0D] text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full border-2 border-gray-400 bg-white" />
            Made
          </span>
          {Object.entries(STATUS_COLORS).map(([key, val]) => (
            <span key={key} className="flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: val.fill }}
              />
              {val.label}
            </span>
          ))}
        </div>
      </div>

      {/* No activity message */}
      {filteredPromises.length === 0 && activeRange !== "All" ? (
        <p className="text-center text-gray-400 py-8 text-sm">
          No activity in the last{" "}
          {activeRange === "5Y"
            ? "5 years"
            : activeRange === "1Y"
              ? "year"
              : activeRange === "6M"
                ? "6 months"
                : "3 months"}
        </p>
      ) : (
        <>
          {/* Desktop: horizontal timeline */}
          <div className="hidden md:block overflow-x-auto">
            <div className="min-w-[700px]">
              <div className="flex">
                <div className="w-52 flex-shrink-0 border-r border-gray-200 mr-3">
                  <div style={{ height: HEADER_HEIGHT }} />
                  {filteredPromises.map((p) => (
                    <div
                      key={p.id}
                      className="text-xs text-gray-700 truncate pr-4 flex items-center"
                      style={{ height: ROW_HEIGHT, maxWidth: "208px" }}
                      title={p.title}
                    >
                      {p.title}
                    </div>
                  ))}
                </div>
                <div className="flex-1 relative">
                  <svg
                    width="100%"
                    height={svgHeight}
                    className="overflow-visible"
                  >
                    {/* Tick lines and labels */}
                    {ticks.map((t, i) => (
                      <g
                        key={`${activeRange}-${i}`}
                        className="transition-opacity duration-300"
                      >
                        <line
                          x1={`${t.pct}%`}
                          y1={HEADER_HEIGHT}
                          x2={`${t.pct}%`}
                          y2={svgHeight}
                          stroke="#e5e7eb"
                          strokeWidth={1}
                        />
                        <text
                          x={`${t.pct}%`}
                          y={HEADER_HEIGHT - 6}
                          textAnchor="middle"
                          className="fill-gray-400 text-[10px]"
                        >
                          {t.label}
                        </text>
                      </g>
                    ))}

                    {/* Promise rows */}
                    {filteredPromises.map((p, rowIdx) => {
                      const y =
                        HEADER_HEIGHT +
                        rowIdx * ROW_HEIGHT +
                        ROW_HEIGHT / 2;
                      const madeDate = new Date(p.dateMade);
                      const madeInRange = madeDate >= rangeStart;
                      const madePct = pct(p.dateMade);

                      const changes = [...p.statusChanges]
                        .sort(
                          (a, b) =>
                            new Date(a.changedAt).getTime() -
                            new Date(b.changedAt).getTime(),
                        )
                        .filter((c) => c.oldStatus !== null);

                      // Only show changes within the visible range
                      const visibleChanges = changes.filter((c) => {
                        const d = new Date(c.changedAt);
                        return d >= rangeStart && d <= rangeEnd;
                      });

                      const allVisibleEvents = [
                        ...(madeInRange ? [{ pct: madePct }] : []),
                        ...visibleChanges.map((c) => ({
                          pct: pct(c.changedAt),
                        })),
                      ];

                      const firstPct =
                        allVisibleEvents.length > 0
                          ? Math.min(...allVisibleEvents.map((e) => e.pct))
                          : 0;
                      const lastPct =
                        allVisibleEvents.length > 0
                          ? Math.max(...allVisibleEvents.map((e) => e.pct))
                          : 0;

                      const isTerminal =
                        p.status === "FULFILLED" || p.status === "BROKEN";

                      // If the promise was made before range, draw from left edge
                      const lineStart = madeInRange ? madePct : 0;

                      return (
                        <g key={p.id}>
                          {/* Row background stripe */}
                          {rowIdx % 2 === 0 && (
                            <rect
                              x="0"
                              y={HEADER_HEIGHT + rowIdx * ROW_HEIGHT}
                              width="100%"
                              height={ROW_HEIGHT}
                              fill="#f9fafb"
                            />
                          )}

                          {/* Status indicator at left edge for promises made before range */}
                          {!madeInRange && (
                            <>
                              {/* Show a half-circle at left to indicate continuation */}
                              <circle
                                cx="0%"
                                cy={y}
                                r={4}
                                fill={
                                  STATUS_COLORS[
                                    statusAtDate(p, rangeStart) || p.status
                                  ].fill
                                }
                                stroke={
                                  STATUS_COLORS[
                                    statusAtDate(p, rangeStart) || p.status
                                  ].stroke
                                }
                                strokeWidth={1.5}
                                opacity={0.6}
                              />
                            </>
                          )}

                          {/* Lines */}
                          {visibleChanges.length > 0 || madeInRange ? (
                            <>
                              {/* Solid line from first to last visible event */}
                              <line
                                x1={`${lineStart}%`}
                                y1={y}
                                x2={`${Math.max(lastPct, lineStart)}%`}
                                y2={y}
                                stroke="#6b7280"
                                strokeWidth={2}
                              />
                              {/* Dotted line to right edge if not terminal */}
                              {!isTerminal && (
                                <line
                                  x1={`${Math.max(lastPct, firstPct, lineStart)}%`}
                                  y1={y}
                                  x2="100%"
                                  y2={y}
                                  stroke="#d1d5db"
                                  strokeWidth={1.5}
                                  strokeDasharray="4 3"
                                />
                              )}
                            </>
                          ) : (
                            /* Promise with no visible events but still active */
                            <line
                              x1="0%"
                              y1={y}
                              x2="100%"
                              y2={y}
                              stroke="#d1d5db"
                              strokeWidth={1.5}
                              strokeDasharray="4 3"
                            />
                          )}

                          {/* "Promise Made" marker (only if in range) */}
                          {madeInRange && (
                            <circle
                              cx={`${madePct}%`}
                              cy={y}
                              r={6}
                              fill="white"
                              stroke="#6b7280"
                              strokeWidth={2}
                              className="cursor-pointer"
                              onClick={(e) =>
                                handleMarkerClick(e, {
                                  title: p.title,
                                  status: "Promise Made",
                                  date: p.dateMade,
                                  note: null,
                                  type: "made",
                                })
                              }
                            />
                          )}

                          {/* Status change markers */}
                          {visibleChanges.map((sc) => {
                            const cx = pct(sc.changedAt);
                            const color = STATUS_COLORS[sc.newStatus];
                            return (
                              <circle
                                key={sc.id}
                                cx={`${cx}%`}
                                cy={y}
                                r={6}
                                fill={color.fill}
                                stroke={color.stroke}
                                strokeWidth={1.5}
                                className="cursor-pointer"
                                onClick={(e) =>
                                  handleMarkerClick(e, {
                                    title: p.title,
                                    status: color.label,
                                    date: sc.changedAt,
                                    note: sc.note,
                                    type: "change",
                                  })
                                }
                              />
                            );
                          })}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile: vertical timeline */}
          <div className="md:hidden space-y-6">
            {filteredPromises.map((p) => {
              const changes = [...p.statusChanges]
                .filter((c) => c.oldStatus !== null)
                .filter((c) => {
                  if (activeRange === "All") return true;
                  const d = new Date(c.changedAt);
                  return d >= rangeStart && d <= rangeEnd;
                })
                .sort(
                  (a, b) =>
                    new Date(a.changedAt).getTime() -
                    new Date(b.changedAt).getTime(),
                );

              const madeInRange = new Date(p.dateMade) >= rangeStart;
              const hasAction = changes.length > 0;

              return (
                <div
                  key={p.id}
                  className="relative pl-6 border-l-2 border-gray-200"
                >
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">
                    {p.title}
                  </h4>

                  {/* Promise made marker */}
                  {madeInRange && (
                    <div className="relative mb-3">
                      <div className="absolute -left-[25px] top-1 h-3 w-3 rounded-full border-2 border-gray-400 bg-white" />
                      <p className="text-xs text-gray-500">
                        <span className="font-medium text-gray-700">
                          Promise Made
                        </span>{" "}
                        — {formatDate(p.dateMade)}
                      </p>
                    </div>
                  )}

                  {/* Status at range start (if promise predates range) */}
                  {!madeInRange && (
                    <div className="relative mb-3">
                      <div
                        className="absolute -left-[25px] top-1 h-3 w-3 rounded-full opacity-60"
                        style={{
                          backgroundColor:
                            STATUS_COLORS[
                              statusAtDate(p, rangeStart) || p.status
                            ].fill,
                        }}
                      />
                      <p className="text-xs text-gray-400 italic">
                        Status at range start:{" "}
                        {STATUS_COLORS[statusAtDate(p, rangeStart) || p.status]
                          .label}
                      </p>
                    </div>
                  )}

                  {/* Status changes */}
                  {changes.map((sc) => {
                    const color = STATUS_COLORS[sc.newStatus];
                    return (
                      <div key={sc.id} className="relative mb-3">
                        <div
                          className="absolute -left-[25px] top-1 h-3 w-3 rounded-full"
                          style={{ backgroundColor: color.fill }}
                        />
                        <p className="text-xs text-gray-500">
                          <span
                            className="font-medium"
                            style={{ color: color.stroke }}
                          >
                            {color.label}
                          </span>{" "}
                          — {formatDate(sc.changedAt)}
                        </p>
                        {sc.note && (
                          <p className="text-xs text-gray-400 italic mt-0.5">
                            {sc.note}
                          </p>
                        )}
                      </div>
                    );
                  })}

                  {/* Inaction indicator */}
                  {!hasAction && madeInRange && (
                    <div className="relative mb-3">
                      <div className="absolute -left-[25px] top-1 h-3 w-3 rounded-full border-2 border-dashed border-gray-300 bg-white" />
                      <p className="text-xs text-gray-400 italic">
                        No action taken since promise was made
                      </p>
                    </div>
                  )}
                  {hasAction &&
                    p.status !== "FULFILLED" &&
                    p.status !== "BROKEN" && (
                      <div className="relative">
                        <div className="absolute -left-[25px] top-1 h-3 w-3 rounded-full border-2 border-dashed border-gray-300 bg-white" />
                        <p className="text-xs text-gray-400 italic">
                          Ongoing...
                        </p>
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Tooltip */}
      {tooltip && (
        <Tooltip
          {...tooltip}
          onClose={() => setTooltip(null)}
          isMobile={typeof window !== "undefined" && window.innerWidth < 768}
        />
      )}
    </div>
  );
}
