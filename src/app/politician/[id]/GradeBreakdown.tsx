"use client";

import { useState } from "react";
import { SEVERITY_LABELS } from "@/lib/issue-weights";
import { getTimeAdjustedStatusValue } from "@/lib/time-decay";

interface Props {
  promises: Array<{
    title: string;
    category: string;
    status: string;
    weight: number;
  }>;
  termProgress: number;
  issueWeights: Record<string, number>;
  chamber: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  FULFILLED: "Fulfilled",
  PARTIAL: "Partial",
  IN_PROGRESS: "In Progress",
  NOT_STARTED: "Not Started",
  BROKEN: "Broken",
};

export function GradeBreakdown({
  promises,
  termProgress,
  issueWeights,
  chamber,
}: Props) {
  const [open, setOpen] = useState(false);

  // Calculate term length label
  const termYears = chamber === "senate" ? 6 : chamber === "house" ? 2 : 4;
  const currentYear = Math.min(
    Math.ceil(termProgress * termYears),
    termYears,
  );

  let totalWeightedScore = 0;
  let totalMaxWeight = 0;

  const rows = promises.map((p) => {
    const severity = p.weight || 3;
    const issueWeight = issueWeights[p.category] || 1.0;
    const statusValue = getTimeAdjustedStatusValue(p.status, termProgress);
    const combinedWeight = severity * issueWeight;
    const score = combinedWeight * statusValue;

    totalWeightedScore += score;
    totalMaxWeight += combinedWeight;

    return {
      title: p.title,
      severity,
      severityLabel: SEVERITY_LABELS[severity] || "Standard",
      issueWeight,
      category: p.category,
      status: p.status,
      statusLabel: STATUS_LABELS[p.status] || p.status,
      statusValue: Math.round(statusValue * 100) / 100,
      score: Math.round(score * 100) / 100,
    };
  });

  const finalPercent = totalMaxWeight > 0
    ? Math.max(0, Math.min(100, (totalWeightedScore / totalMaxWeight) * 100))
    : 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm text-gray-500 hover:text-gray-700 transition-colors"
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
            This grade uses a weighted formula based on promise severity, voter
            issue priorities, and term progress.
          </p>

          {/* Term progress bar */}
          <div>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>
                Year {currentYear} of {termYears} &mdash;{" "}
                {Math.round(termProgress * 100)}% through term
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-500"
                style={{ width: `${Math.round(termProgress * 100)}%` }}
              />
            </div>
          </div>

          <p className="text-xs text-gray-400">
            Unfinished promises are graded more leniently early in a term. As the
            term progresses, NOT_STARTED and IN_PROGRESS promises increasingly
            hurt the grade.
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
                  <th className="py-2 pr-3 font-medium whitespace-nowrap">Adj. Value</th>
                  <th className="py-2 font-medium text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2 pr-3 text-gray-700 max-w-[200px] truncate">
                      {row.title}
                    </td>
                    <td className="py-2 pr-3 text-gray-500 whitespace-nowrap">
                      {row.severity} ({row.severityLabel})
                    </td>
                    <td className="py-2 pr-3 text-gray-500 whitespace-nowrap">
                      {row.issueWeight.toFixed(1)} ({row.category})
                    </td>
                    <td className="py-2 pr-3 text-gray-500">{row.statusLabel}</td>
                    <td className="py-2 pr-3 text-gray-500">{row.statusValue}</td>
                    <td className="py-2 text-right font-mono text-gray-700">
                      {row.score > 0 ? "+" : ""}
                      {row.score.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200">
                  <td colSpan={5} className="py-2 pr-3 font-semibold text-gray-700">
                    Total: {totalWeightedScore.toFixed(1)} / {totalMaxWeight.toFixed(1)}
                  </td>
                  <td className="py-2 text-right font-semibold text-gray-700">
                    {finalPercent.toFixed(1)}%
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
