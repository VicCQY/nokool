"use client";

import { useState } from "react";
import { PromiseStatus, VotePosition } from "@prisma/client";
import { StatusStamp } from "./StatusStamp";
import { getVoteAlignment, getAlignmentExplanation } from "@/lib/promise-bill-matcher";

interface BillLinkData {
  id: string;
  alignment: string;
  relevance: string;
  bill: {
    id: string;
    title: string;
    billNumber: string;
    category: string;
    dateVoted: string;
  };
  votePosition?: VotePosition | null;
}

interface ActionLinkData {
  id: string;
  alignment: string;
  action: {
    id: string;
    title: string;
    type: string;
    category: string;
    dateIssued: string;
  };
}

interface PromiseWithLinks {
  id: string;
  title: string;
  category: string;
  status: PromiseStatus;
  weight: number;
  billLinks: BillLinkData[];
  actionLinks?: ActionLinkData[];
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  EXECUTIVE_ORDER: "Executive Order",
  PRESIDENTIAL_MEMORANDUM: "Memorandum",
  PROCLAMATION: "Proclamation",
  BILL_SIGNED: "Bill Signed",
  BILL_VETOED: "Bill Vetoed",
  POLICY_DIRECTIVE: "Policy Directive",
};

const INITIAL_SHOW = 5;

export function SaysVsDoes({
  promises,
  branch,
}: {
  promises: PromiseWithLinks[];
  branch?: string;
}) {
  const isExecutive = branch === "executive";

  // Calculate summary stats
  let supportsCount = 0;
  let opposesCount = 0;
  let noDataCount = 0;

  for (const promise of promises) {
    if (isExecutive) {
      const actionLinks = promise.actionLinks || [];
      if (actionLinks.length === 0) {
        noDataCount++;
      } else {
        for (const link of actionLinks) {
          if (link.alignment === "supports") supportsCount++;
          else if (link.alignment === "contradicts") opposesCount++;
        }
      }
    } else {
      const links = promise.billLinks || [];
      if (links.length === 0) {
        noDataCount++;
      } else {
        for (const link of links) {
          if (!link.votePosition) continue;
          const result = getVoteAlignment(link.alignment, link.votePosition);
          if (result === "supports") supportsCount++;
          else if (result === "opposes") opposesCount++;
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-200 border-t-2 border-t-status-fulfilled bg-white p-4 shadow-sm">
          <p className="text-2xl font-mono font-bold text-brand-charcoal">{supportsCount}</p>
          <p className="text-xs text-slate mt-1">
            {isExecutive ? "Actions supporting promises" : "Votes supporting promises"}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 border-t-2 border-t-brand-red bg-white p-4 shadow-sm">
          <p className="text-2xl font-mono font-bold text-brand-charcoal">{opposesCount}</p>
          <p className="text-xs text-slate mt-1">
            {isExecutive ? "Actions contradicting promises" : "Votes opposing promises"}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 border-t-2 border-t-gray-400 bg-white p-4 shadow-sm">
          <p className="text-2xl font-mono font-bold text-brand-charcoal">{noDataCount}</p>
          <p className="text-xs text-slate mt-1">Promises with no linked data</p>
        </div>
      </div>

      {/* Promise cards */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-charcoal mb-1">
          Says vs Does
        </h2>
        <p className="text-sm text-slate mb-5">
          {isExecutive
            ? "How do their promises line up with their executive actions?"
            : "Each promise is linked to specific bills. Vote alignment shows whether their voting record supports or contradicts what they promised."}
        </p>

        <div className="space-y-5">
          {promises.map((promise) => (
            <PromiseCard
              key={promise.id}
              promise={promise}
              isExecutive={isExecutive}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function PromiseCard({
  promise,
  isExecutive,
}: {
  promise: PromiseWithLinks;
  isExecutive: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const links = promise.billLinks || [];
  const actionLinks = promise.actionLinks || [];
  const displayLinks = expanded ? links : links.slice(0, INITIAL_SHOW);
  const remaining = links.length - INITIAL_SHOW;

  return (
    <div className="rounded-lg border border-gray-100 bg-brand-paper p-4">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-brand-charcoal">
          &ldquo;{promise.title}&rdquo;
        </span>
        <StatusStamp status={promise.status} size="sm" id={promise.id} />
        <span className="inline-flex items-center rounded-md bg-cool-gray px-2 py-0.5 text-xs font-medium text-slate">
          {promise.category}
        </span>
        <span
          className="inline-flex items-center gap-0.5 text-slate"
          title={`Weight: ${promise.weight}/5`}
        >
          {Array.from({ length: 5 }, (_, i) => (
            <span
              key={i}
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                i < promise.weight ? "bg-brand-charcoal" : "bg-gray-200"
              }`}
            />
          ))}
        </span>
      </div>

      {isExecutive ? (
        actionLinks.length === 0 ? (
          <p className="text-xs text-slate ml-1">
            No executive actions linked to this promise yet
          </p>
        ) : (
          <div className="space-y-2 ml-3 border-l-2 border-gray-200 pl-3">
            {actionLinks.map((link) => (
              <div
                key={link.id}
                className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                    {ACTION_TYPE_LABELS[link.action.type] || link.action.type}
                  </span>
                  <span className="text-sm text-brand-charcoal truncate">
                    {link.action.title}
                  </span>
                </div>
                {link.alignment === "supports" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Supports Promise
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted-red px-2 py-0.5 text-xs font-semibold text-red-700">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Contradicts Promise
                  </span>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        links.length === 0 ? (
          <p className="text-xs text-slate ml-1">
            No voting data linked yet
          </p>
        ) : (
          <div className="space-y-2">
            {displayLinks.map((link) => (
              <BillLinkRow key={link.id} link={link} />
            ))}
            {remaining > 0 && !expanded && (
              <button
                onClick={() => setExpanded(true)}
                className="text-xs font-medium text-brand-red hover:underline ml-1"
              >
                Show {remaining} more bill{remaining !== 1 ? "s" : ""}
              </button>
            )}
            {expanded && remaining > 0 && (
              <button
                onClick={() => setExpanded(false)}
                className="text-xs font-medium text-brand-red hover:underline ml-1"
              >
                Show less
              </button>
            )}
          </div>
        )
      )}
    </div>
  );
}

function BillLinkRow({ link }: { link: BillLinkData }) {
  const votePos = link.votePosition;
  const alignment = votePos ? getVoteAlignment(link.alignment, votePos) : "neutral";
  const explanation = votePos ? getAlignmentExplanation(link.alignment, votePos) : "";

  return (
    <div className="ml-3 border-l-2 border-gray-200 pl-3 py-1.5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm text-brand-charcoal truncate">
            {link.bill.title}
          </span>
          <span className="font-mono text-xs text-slate hidden sm:inline flex-shrink-0">
            {link.bill.billNumber}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {votePos && (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
              {votePos === "YEA" ? "Yea" : votePos === "NAY" ? "Nay" : votePos === "ABSTAIN" ? "Abstain" : "Absent"}
            </span>
          )}
          {alignment === "supports" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Supports Promise
            </span>
          )}
          {alignment === "opposes" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted-red px-2 py-0.5 text-xs font-semibold text-red-700">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Opposes Promise
            </span>
          )}
          {alignment === "neutral" && votePos && (
            <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-xs font-semibold text-gray-500">
              No Position
            </span>
          )}
          {!votePos && (
            <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-xs font-semibold text-gray-500">
              No Vote Data
            </span>
          )}
        </div>
      </div>
      {explanation && (
        <p className="text-[11px] text-slate mt-0.5 ml-0">
          {explanation}
        </p>
      )}
      {link.relevance === "auto" && (
        <span className="text-[10px] text-gray-400 italic">auto-matched</span>
      )}
    </div>
  );
}
