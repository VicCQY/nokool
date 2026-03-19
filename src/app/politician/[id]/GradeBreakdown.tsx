"use client";

import { useState } from "react";
import { SEVERITY_LABELS, ISSUE_WEIGHTS, STATUS_VALUES, STATUS_LABELS } from "@/lib/issue-weights";

interface Props {
  promises: Array<{
    title: string;
    category: string;
    status: string;
    weight: number;
  }>;
  issueWeights: Record<string, number>;
}

export function GradeBreakdown({ promises, issueWeights }: Props) {
  const [open, setOpen] = useState(false);
  const weights = issueWeights || ISSUE_WEIGHTS;

  let totalWeighted = 0;
  let totalMax = 0;

  const rows = promises.map((p) => {
    const severity = p.weight || 3;
    const issueWeight = weights[p.category] || 1.0;
    const combinedWeight = severity * issueWeight;
    const statusValue = STATUS_VALUES[p.status] ?? 0;
    const weighted = statusValue * combinedWeight;
    const max = 100 * combinedWeight;

    totalWeighted += weighted;
    totalMax += max;

    return {
      title: p.title,
      severity,
      severityLabel: SEVERITY_LABELS[severity] || "Standard",
      issueWeight,
      category: p.category,
      status: p.status,
      statusLabel: STATUS_LABELS[p.status] || p.status,
      statusValue,
      weighted: Math.round(weighted),
      max: Math.round(max),
    };
  });

  const finalPercent = totalMax > 0
    ? Math.max(0, Math.min(100, Math.round((totalWeighted / totalMax) * 100)))
    : 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm text-gray-500 hover:text-brand-charcoal transition-colors"
      >
        <span>How is this grade calculated?</span>
        <svg
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-4">
          <p className="text-sm text-gray-600">
            Each promise gets a status: <strong>Kept</strong> (100), <strong>Fighting</strong> (80),
            {" "}<strong>Stalled</strong> (30), <strong>Nothing</strong> (0), or <strong>Broke</strong> (-150).
            The grade weights each by severity and issue priority.
          </p>

          <p className="text-xs text-gray-400">
            Grade = (sum of status value &times; severity &times; issue weight) / (sum of 100 &times; severity &times; issue weight) &times; 100
          </p>

          {/* Breakdown table */}
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-400 uppercase tracking-wider">
                  <th className="py-2 pr-3 font-medium">Promise</th>
                  <th className="py-2 pr-3 font-medium whitespace-nowrap">Severity</th>
                  <th className="py-2 pr-3 font-medium whitespace-nowrap">Issue Wt</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium text-right">Weighted</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2 pr-3 text-brand-charcoal max-w-[200px] truncate">
                      {row.title}
                    </td>
                    <td className="py-2 pr-3 text-gray-500 whitespace-nowrap">
                      {row.severity} ({row.severityLabel})
                    </td>
                    <td className="py-2 pr-3 text-gray-500 whitespace-nowrap">
                      {row.issueWeight.toFixed(1)} ({row.category})
                    </td>
                    <td className="py-2 pr-3 text-gray-500">{row.statusLabel}</td>
                    <td className="py-2 text-right font-mono text-brand-charcoal">
                      {row.weighted}/{row.max}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200">
                  <td colSpan={4} className="py-2 pr-3 font-mono font-semibold text-brand-charcoal">
                    Total: {Math.round(totalWeighted)} / {Math.round(totalMax)}
                  </td>
                  <td className="py-2 text-right font-mono font-semibold text-brand-charcoal">
                    {finalPercent}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
