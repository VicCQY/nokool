"use client";

import { useState } from "react";
import { ExecutiveActionType } from "@prisma/client";

interface ActionData {
  id: string;
  title: string;
  type: ExecutiveActionType;
  summary: string;
  category: string;
  dateIssued: string;
  sourceUrl: string | null;
}

const TYPE_CONFIG: Record<
  ExecutiveActionType,
  { label: string; color: string; bg: string }
> = {
  EXECUTIVE_ORDER: {
    label: "Executive Order",
    color: "text-blue-700",
    bg: "bg-blue-50",
  },
  PRESIDENTIAL_MEMORANDUM: {
    label: "Memorandum",
    color: "text-purple-700",
    bg: "bg-purple-50",
  },
  PROCLAMATION: {
    label: "Proclamation",
    color: "text-teal-700",
    bg: "bg-teal-50",
  },
  BILL_SIGNED: {
    label: "Bill Signed",
    color: "text-green-700",
    bg: "bg-green-50",
  },
  BILL_VETOED: {
    label: "Bill Vetoed",
    color: "text-red-700",
    bg: "bg-red-50",
  },
  POLICY_DIRECTIVE: {
    label: "Policy Directive",
    color: "text-amber-700",
    bg: "bg-amber-50",
  },
};

const STAT_CONFIG: { key: ExecutiveActionType; dotColor: string }[] = [
  { key: "EXECUTIVE_ORDER", dotColor: "bg-blue-500" },
  { key: "PRESIDENTIAL_MEMORANDUM", dotColor: "bg-purple-500" },
  { key: "PROCLAMATION", dotColor: "bg-teal-500" },
  { key: "BILL_SIGNED", dotColor: "bg-green-500" },
  { key: "BILL_VETOED", dotColor: "bg-red-500" },
  { key: "POLICY_DIRECTIVE", dotColor: "bg-amber-500" },
];

export function ExecutiveActionsTab({
  actions,
}: {
  actions: ActionData[];
}) {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const types = Array.from(new Set(actions.map((a) => a.type))).sort();
  const categories = Array.from(new Set(actions.map((a) => a.category))).sort();

  const typeCounts = actions.reduce(
    (acc, a) => {
      acc[a.type] = (acc[a.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  let filtered = actions;
  if (typeFilter !== "all") {
    filtered = filtered.filter((a) => a.type === typeFilter);
  }
  if (categoryFilter !== "all") {
    filtered = filtered.filter((a) => a.category === categoryFilter);
  }

  return (
    <div>
      {/* Stats */}
      {actions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-6">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold text-[#1A1A1A]">
              {actions.length}
            </p>
            <p className="text-xs text-[#4A4A4A] mt-1">Total Actions</p>
          </div>
          {STAT_CONFIG.map(({ key, dotColor }) => {
            const count = typeCounts[key] || 0;
            if (count === 0) return null;
            return (
              <div
                key={key}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
                  <p className="text-2xl font-bold text-[#1A1A1A]">{count}</p>
                </div>
                <p className="text-xs text-[#4A4A4A] mt-1">
                  {TYPE_CONFIG[key].label}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          <option value="all">All Types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {TYPE_CONFIG[t]?.label || t}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Action cards */}
      <div className="space-y-4">
        {filtered.map((action) => (
          <ActionCard key={action.id} action={action} />
        ))}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
            <p className="text-[#4A4A4A]">
              {actions.length === 0
                ? "No executive actions tracked yet."
                : "No actions match the current filters."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionCard({ action }: { action: ActionData }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = TYPE_CONFIG[action.type];

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md">
      <div className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.color}`}
              >
                {cfg.label}
              </span>
              <h3 className="text-base font-bold text-[#1A1A1A]">
                {action.title}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 font-medium text-[#4A4A4A]">
                {action.category}
              </span>
              <span className="text-gray-400">
                {new Date(action.dateIssued).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              {action.sourceUrl && (
                <a
                  href={action.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#2563EB] hover:underline"
                >
                  Source &rarr;
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Expandable summary */}
        {action.summary && (
          <div className="mt-3">
            <p
              className={`text-sm text-[#4A4A4A] leading-relaxed ${
                !expanded ? "line-clamp-2" : ""
              }`}
            >
              {action.summary}
            </p>
            {action.summary.length > 120 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-1 text-xs text-[#2563EB] hover:underline"
              >
                {expanded ? "Show less" : "Read more"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
