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

const STAT_TOP_BORDERS: Record<string, string> = {
  EXECUTIVE_ORDER: "border-t-blue-500",
  PRESIDENTIAL_MEMORANDUM: "border-t-purple-500",
  PROCLAMATION: "border-t-teal-500",
  BILL_SIGNED: "border-t-green-500",
  BILL_VETOED: "border-t-red-500",
  POLICY_DIRECTIVE: "border-t-amber-500",
};

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
          <div className="rounded-xl border border-gray-200 border-t-2 border-t-brand-charcoal bg-white p-4 shadow-sm">
            <p className="text-2xl font-mono font-bold text-brand-charcoal">
              {actions.length}
            </p>
            <p className="text-xs text-slate mt-1">Total Actions</p>
          </div>
          {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
            const count = typeCounts[key] || 0;
            if (count === 0) return null;
            return (
              <div
                key={key}
                className={`rounded-xl border border-gray-200 border-t-2 ${STAT_TOP_BORDERS[key]} bg-white p-4 shadow-sm`}
              >
                <p className="text-2xl font-mono font-bold text-brand-charcoal">{count}</p>
                <p className="text-xs text-slate mt-1">
                  {cfg.label}
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
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate shadow-sm focus:border-brand-charcoal focus:ring-1 focus:ring-brand-charcoal focus:outline-none"
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
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate shadow-sm focus:border-brand-charcoal focus:ring-1 focus:ring-brand-charcoal focus:outline-none"
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
            <p className="text-slate">
              {actions.length === 0
                ? "No executive actions recorded."
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
              <h3 className="text-base font-semibold text-brand-charcoal">
                {action.title}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center rounded-md bg-cool-gray px-2 py-1 font-medium text-slate">
                {action.category}
              </span>
              <span className="font-mono text-gray-400">
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
                  className="inline-flex items-center gap-0.5 text-brand-red hover:underline"
                >
                  Source
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>

        {action.summary && (
          <div className="mt-3">
            <p
              className={`text-sm text-slate leading-relaxed ${
                !expanded ? "line-clamp-2" : ""
              }`}
            >
              {action.summary}
            </p>
            {action.summary.length > 120 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-1 text-xs text-brand-red hover:underline"
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
