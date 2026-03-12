"use client";

import { useState } from "react";
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

const STATUS_COLORS: Record<PromiseStatus, { fill: string; stroke: string; label: string }> = {
  FULFILLED: { fill: "#22c55e", stroke: "#16a34a", label: "Fulfilled" },
  PARTIAL: { fill: "#eab308", stroke: "#ca8a04", label: "Partial" },
  IN_PROGRESS: { fill: "#3b82f6", stroke: "#2563eb", label: "In Progress" },
  NOT_STARTED: { fill: "#9ca3af", stroke: "#6b7280", label: "Not Started" },
  BROKEN: { fill: "#ef4444", stroke: "#dc2626", label: "Broken" },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function monthsBetween(start: Date, end: Date) {
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())
  );
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
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    title: string;
    status: string;
    date: string;
    note: string | null;
    type: "made" | "change";
  } | null>(null);

  const timelineStart = new Date(termStart);
  const timelineEnd = termEnd ? new Date(termEnd) : new Date();
  const totalMs = timelineEnd.getTime() - timelineStart.getTime();

  if (totalMs <= 0 || promises.length === 0) {
    return (
      <p className="text-center text-gray-500 py-8">
        No timeline data available.
      </p>
    );
  }

  // Generate time axis labels (monthly or yearly depending on span)
  const totalMonths = monthsBetween(timelineStart, timelineEnd);
  const tickInterval = totalMonths > 36 ? 12 : totalMonths > 18 ? 6 : totalMonths > 8 ? 3 : 1;
  const ticks: { label: string; pct: number }[] = [];
  const tickDate = new Date(timelineStart);
  tickDate.setDate(1);
  tickDate.setMonth(tickDate.getMonth() + 1);
  while (tickDate <= timelineEnd) {
    if (tickDate.getMonth() % tickInterval === 0) {
      const pct =
        ((tickDate.getTime() - timelineStart.getTime()) / totalMs) * 100;
      ticks.push({
        label: tickDate.toLocaleDateString("en-US", {
          month: "short",
          year: tickInterval >= 12 ? "numeric" : "2-digit",
        }),
        pct,
      });
    }
    tickDate.setMonth(tickDate.getMonth() + 1);
  }

  function pct(dateStr: string) {
    const d = new Date(dateStr).getTime();
    const clamped = Math.max(
      timelineStart.getTime(),
      Math.min(d, timelineEnd.getTime()),
    );
    return ((clamped - timelineStart.getTime()) / totalMs) * 100;
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
  const svgHeight = HEADER_HEIGHT + promises.length * ROW_HEIGHT + 8;

  return (
    <div onClick={() => setTooltip(null)}>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-3 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-gray-400 bg-white" />
          Promise Made
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
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-4 w-6 border-t-2 border-dashed border-gray-300" />
          Inaction
        </span>
      </div>

      {/* Desktop: horizontal timeline */}
      <div className="hidden md:block overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Promise labels on the left + SVG on the right */}
          <div className="flex">
            <div className="w-48 flex-shrink-0">
              <div style={{ height: HEADER_HEIGHT }} />
              {promises.map((p) => (
                <div
                  key={p.id}
                  className="text-xs text-gray-700 truncate pr-2 flex items-center"
                  style={{ height: ROW_HEIGHT }}
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
                  <g key={i}>
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
                {promises.map((p, rowIdx) => {
                  const y = HEADER_HEIGHT + rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                  const madePct = pct(p.dateMade);
                  const changes = [...p.statusChanges].sort(
                    (a, b) =>
                      new Date(a.changedAt).getTime() -
                      new Date(b.changedAt).getTime(),
                  );
                  // Filter to non-initial changes (where old status differs from new)
                  const meaningfulChanges = changes.filter(
                    (c) => c.oldStatus !== null,
                  );

                  const lastEventPct =
                    meaningfulChanges.length > 0
                      ? pct(
                          meaningfulChanges[meaningfulChanges.length - 1]
                            .changedAt,
                        )
                      : madePct;

                  const hasAction = meaningfulChanges.length > 0;

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

                      {/* Line from "made" to last status change (or to today if no changes) */}
                      {hasAction ? (
                        <>
                          {/* Solid line between markers */}
                          <line
                            x1={`${madePct}%`}
                            y1={y}
                            x2={`${lastEventPct}%`}
                            y2={y}
                            stroke="#6b7280"
                            strokeWidth={2}
                          />
                          {/* Dotted line from last event to today if not terminal */}
                          {p.status !== "FULFILLED" &&
                            p.status !== "BROKEN" && (
                              <line
                                x1={`${lastEventPct}%`}
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
                        /* Dotted line from made to today — inaction */
                        <line
                          x1={`${madePct}%`}
                          y1={y}
                          x2="100%"
                          y2={y}
                          stroke="#d1d5db"
                          strokeWidth={1.5}
                          strokeDasharray="4 3"
                        />
                      )}

                      {/* "Promise Made" marker */}
                      <circle
                        cx={`${madePct}%`}
                        cy={y}
                        r={6}
                        fill="white"
                        stroke="#6b7280"
                        strokeWidth={2}
                        className="cursor-pointer hover:r-[8]"
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

                      {/* Status change markers */}
                      {meaningfulChanges.map((sc) => {
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
        {promises.map((p) => {
          const changes = [...p.statusChanges]
            .filter((c) => c.oldStatus !== null)
            .sort(
              (a, b) =>
                new Date(a.changedAt).getTime() -
                new Date(b.changedAt).getTime(),
            );
          const hasAction = changes.length > 0;

          return (
            <div key={p.id} className="relative pl-6 border-l-2 border-gray-200">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">
                {p.title}
              </h4>

              {/* Promise made marker */}
              <div className="relative mb-3">
                <div className="absolute -left-[25px] top-1 h-3 w-3 rounded-full border-2 border-gray-400 bg-white" />
                <p className="text-xs text-gray-500">
                  <span className="font-medium text-gray-700">
                    Promise Made
                  </span>{" "}
                  — {formatDate(p.dateMade)}
                </p>
              </div>

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
              {!hasAction && (
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
                    <p className="text-xs text-gray-400 italic">Ongoing...</p>
                  </div>
                )}
            </div>
          );
        })}
      </div>

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
