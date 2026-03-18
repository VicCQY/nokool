"use client";

import { useMemo } from "react";
import { PromiseStatus, VotePosition } from "@prisma/client";
import { StatusStamp } from "./StatusStamp";
import { getVoteAlignment, getAlignmentExplanation } from "@/lib/promise-bill-matcher";

interface StatusChangeData {
  id: string;
  oldStatus: PromiseStatus | null;
  newStatus: PromiseStatus;
  changedAt: string;
  note: string | null;
}

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

interface PromiseEventData {
  id: string;
  eventType: string;
  eventDate: string;
  title: string;
  description: string | null;
  sourceUrl: string | null;
}

interface PromiseWithJourney {
  id: string;
  title: string;
  category: string;
  status: PromiseStatus;
  weight: number;
  dateMade: string;
  sourceUrl: string;
  statusChanges: StatusChangeData[];
  events: PromiseEventData[];
  billLinks: BillLinkData[];
  actionLinks: ActionLinkData[];
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  EXECUTIVE_ORDER: "Executive Order",
  PRESIDENTIAL_MEMORANDUM: "Memorandum",
  PROCLAMATION: "Proclamation",
  BILL_SIGNED: "Bill Signed",
  BILL_VETOED: "Bill Vetoed",
  POLICY_DIRECTIVE: "Policy Directive",
};

const STATUS_LABELS: Record<PromiseStatus, string> = {
  FULFILLED: "Fulfilled",
  PARTIAL: "Partial",
  ADVANCING: "Advancing",
  IN_PROGRESS: "In Progress",
  NOT_STARTED: "Not Started",
  BROKEN: "Broken",
  REVERSED: "Reversed",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type TimelineEvent = {
  date: string;
  sortDate: number;
  statusTransition?: PromiseStatus; // shown when this event upgrades the status
} & (
  | { type: "promise_made"; sourceUrl: string }
  | { type: "legislation"; title: string; description: string | null; sourceUrl: string | null; isPassage: boolean }
  | { type: "bill_link"; bill: BillLinkData["bill"]; alignment: string; votePosition?: VotePosition | null }
  | { type: "action_link"; action: ActionLinkData["action"]; alignment: string }
);

// Status rank for determining upgrades (higher = better)
const STATUS_RANK: Record<string, number> = {
  NOT_STARTED: 0,
  IN_PROGRESS: 1,
  ADVANCING: 2,
  PARTIAL: 3,
  FULFILLED: 4,
};

/**
 * Calculate what status would be after this event, given running counts.
 * Returns the new status if it's an UPGRADE, or null if no change/downgrade.
 */
function calculateStatusAfterEvent(
  currentStatus: string,
  branch: string,
  counts: { votes: number; introductions: number; execActions: number; passed: boolean },
): PromiseStatus | null {
  let newStatus: PromiseStatus = "NOT_STARTED";

  if (branch === "executive") {
    if (counts.passed) newStatus = "FULFILLED";
    else if (counts.execActions >= 3) newStatus = "PARTIAL";
    else if (counts.execActions >= 1) newStatus = "ADVANCING";
    else if (counts.votes >= 1) newStatus = "IN_PROGRESS";
  } else {
    if (counts.passed) newStatus = "FULFILLED";
    else if (counts.introductions >= 3) newStatus = "PARTIAL";
    else if (counts.introductions >= 1) newStatus = "ADVANCING";
    else if (counts.votes >= 1) newStatus = "IN_PROGRESS";
  }

  // Only show upgrade transitions
  const oldRank = STATUS_RANK[currentStatus] ?? 0;
  const newRank = STATUS_RANK[newStatus] ?? 0;
  if (newRank > oldRank) return newStatus;
  return null;
}

const PASSAGE_PATTERN = /\bsigned into law\b|\benacted\b|\bbecame law\b/i;

function buildTimeline(promise: PromiseWithJourney, branch: string): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Promise made
  events.push({
    type: "promise_made",
    date: promise.dateMade,
    sortDate: new Date(promise.dateMade).getTime(),
    sourceUrl: promise.sourceUrl,
  });

  // Legislation events from PromiseEvents (AI research: introductions, passages)
  for (const evt of promise.events) {
    if (evt.eventType === "legislation") {
      events.push({
        type: "legislation",
        date: evt.eventDate,
        sortDate: new Date(evt.eventDate).getTime(),
        title: evt.title,
        description: evt.description,
        sourceUrl: evt.sourceUrl,
        isPassage: PASSAGE_PATTERN.test(evt.title),
      });
    }
  }

  // Bill links (from bill matching system)
  for (const link of promise.billLinks) {
    events.push({
      type: "bill_link",
      date: link.bill.dateVoted,
      sortDate: new Date(link.bill.dateVoted).getTime(),
      bill: link.bill,
      alignment: link.alignment,
      votePosition: link.votePosition,
    });
  }

  // Action links (executive actions)
  for (const link of promise.actionLinks) {
    events.push({
      type: "action_link",
      date: link.action.dateIssued,
      sortDate: new Date(link.action.dateIssued).getTime(),
      action: link.action,
      alignment: link.alignment,
    });
  }

  events.sort((a, b) => a.sortDate - b.sortDate);

  // Calculate status transitions chronologically
  let runningStatus = "NOT_STARTED";
  const counts = { votes: 0, introductions: 0, execActions: 0, passed: false };

  for (const event of events) {
    if (event.type === "promise_made") continue;

    if (event.type === "legislation") {
      counts.introductions++;
      if (event.isPassage) counts.passed = true;
    } else if (event.type === "bill_link") {
      counts.votes++;
    } else if (event.type === "action_link") {
      counts.execActions++;
    }

    const transition = calculateStatusAfterEvent(runningStatus, branch, counts);
    if (transition) {
      event.statusTransition = transition;
      runningStatus = transition;
    }
  }

  return events;
}

export function SaysVsDoes({
  promises,
  branch,
}: {
  promises: PromiseWithJourney[];
  branch?: string;
}) {
  const isExecutive = branch === "executive";

  // Summary stats — only count promises with bill/action links
  const { supportsCount, opposesCount } = useMemo(() => {
    let supports = 0;
    let opposes = 0;
    for (const promise of promises) {
      if (isExecutive) {
        for (const link of promise.actionLinks) {
          if (link.alignment === "supports") supports++;
          else if (link.alignment === "contradicts") opposes++;
        }
      }
      for (const link of promise.billLinks) {
        if (!link.votePosition) continue;
        const result = getVoteAlignment(link.alignment, link.votePosition);
        if (result === "supports") supports++;
        else if (result === "opposes") opposes++;
      }
    }
    return { supportsCount: supports, opposesCount: opposes };
  }, [promises, isExecutive]);

  return (
    <div className="space-y-6">
      {/* Summary stats — only shown when there is linked data */}
      {(supportsCount > 0 || opposesCount > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-gray-200 border-t-2 border-t-status-fulfilled bg-white p-4 shadow-sm">
            <p className="text-2xl font-mono font-bold text-brand-charcoal">{supportsCount}</p>
            <p className="text-xs text-slate mt-1">
              {isExecutive ? "Actions/votes supporting promises" : "Votes supporting promises"}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 border-t-2 border-t-brand-red bg-white p-4 shadow-sm">
            <p className="text-2xl font-mono font-bold text-brand-charcoal">{opposesCount}</p>
            <p className="text-xs text-slate mt-1">
              {isExecutive ? "Actions/votes contradicting promises" : "Votes opposing promises"}
            </p>
          </div>
        </div>
      )}

      {/* Promise journey cards */}
      <div className="space-y-4">
        {promises.map((promise) => (
          <PromiseJourneyCard
            key={promise.id}
            promise={promise}
            branch={branch || "legislative"}
          />
        ))}
      </div>
    </div>
  );
}

function PromiseJourneyCard({
  promise,
  branch,
}: {
  promise: PromiseWithJourney;
  branch: string;
}) {
  const events = useMemo(() => buildTimeline(promise, branch), [promise, branch]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-sm font-semibold text-brand-charcoal">
          &ldquo;{promise.title}&rdquo;
        </span>
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

      {/* Timeline */}
      <div className="relative ml-3 border-l-2 border-gray-200 pl-5 space-y-0">
        {events.map((event, i) => (
          <TimelineEventRow key={i} event={event} />
        ))}

        {/* Current status at bottom */}
        <div className="relative py-2">
          <div className="absolute -left-[27px] top-3 h-3.5 w-3.5 rounded-full border-2 border-brand-charcoal bg-white flex items-center justify-center">
            <div className="h-1.5 w-1.5 rounded-full bg-brand-charcoal" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate">Current:</span>
            <StatusStamp status={promise.status} size="sm" id={promise.id} />
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineEventRow({
  event,
}: {
  event: TimelineEvent;
}) {
  if (event.type === "promise_made") {
    return (
      <div className="relative py-2">
        <div className="absolute -left-[27px] top-3 h-3.5 w-3.5 rounded-full border-2 border-gray-400 bg-white" />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-700">Promise Made</span>
          <span className="text-xs text-slate">{formatDate(event.date)}</span>
          {event.sourceUrl && (
            <a
              href={event.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-[11px] text-brand-red hover:underline"
            >
              Source
              <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>
      </div>
    );
  }

  if (event.type === "legislation") {
    const isPassage = event.isPassage;
    const dotColor = isPassage ? "bg-green-500 border-green-600" : "bg-teal-500 border-teal-600";
    return (
      <div className="relative py-2">
        <div className={`absolute -left-[27px] top-3 h-3.5 w-3.5 rounded-sm ${dotColor}`} />
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            {isPassage ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                <CheckIcon />
                Passed
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">
                Legislation
              </span>
            )}
            <span className="text-xs text-slate">{formatDate(event.date)}</span>
            <StatusTransitionBadge status={event.statusTransition} />
          </div>
          <p className={`text-xs mt-1 ${isPassage ? "font-semibold text-green-800" : "text-brand-charcoal"}`}>
            {event.title}
          </p>
          {event.description && (
            <p className="text-[11px] text-slate mt-0.5">{event.description}</p>
          )}
          {event.sourceUrl && (
            <a
              href={event.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-[11px] text-brand-red hover:underline mt-0.5"
            >
              Source
              <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>
      </div>
    );
  }

  if (event.type === "bill_link") {
    const votePos = event.votePosition;
    const alignment = votePos ? getVoteAlignment(event.alignment, votePos) : "neutral";
    const explanation = votePos ? getAlignmentExplanation(event.alignment, votePos) : "";

    return (
      <div className="relative py-2">
        <div className="absolute -left-[27px] top-3 h-3.5 w-3.5 rounded-sm bg-blue-500 border border-blue-600" />
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
              Bill Vote
            </span>
            <span className="text-xs text-slate">{formatDate(event.date)}</span>
            <StatusTransitionBadge status={event.statusTransition} />
          </div>
          <p className="text-xs text-brand-charcoal mt-1">
            {event.bill.title}
            <span className="font-mono text-slate ml-1.5">{event.bill.billNumber}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {votePos && (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                {votePos === "YEA" ? "Yea" : votePos === "NAY" ? "Nay" : votePos === "ABSTAIN" ? "Abstain" : "Absent"}
              </span>
            )}
            {alignment === "supports" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                <CheckIcon />
                Supports Promise
              </span>
            )}
            {alignment === "opposes" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted-red px-2 py-0.5 text-[11px] font-semibold text-red-700">
                <XIcon />
                Opposes Promise
              </span>
            )}
            {alignment === "neutral" && votePos && (
              <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
                No Position
              </span>
            )}
          </div>
          {explanation && (
            <p className="text-[11px] text-slate mt-0.5">{explanation}</p>
          )}
        </div>
      </div>
    );
  }

  if (event.type === "action_link") {
    return (
      <div className="relative py-2">
        <div className="absolute -left-[27px] top-3 h-3.5 w-3.5 rounded-sm bg-purple-500 border border-purple-600" />
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
              {ACTION_TYPE_LABELS[event.action.type] || event.action.type}
            </span>
            <span className="text-xs text-slate">{formatDate(event.date)}</span>
            <StatusTransitionBadge status={event.statusTransition} />
          </div>
          <p className="text-xs text-brand-charcoal mt-1">{event.action.title}</p>
          <div className="mt-1">
            {event.alignment === "supports" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                <CheckIcon />
                Supports Promise
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted-red px-2 py-0.5 text-[11px] font-semibold text-red-700">
                <XIcon />
                Contradicts Promise
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

const TRANSITION_COLORS: Record<string, string> = {
  IN_PROGRESS: "bg-blue-50 text-blue-700",
  ADVANCING: "bg-teal-50 text-teal-700",
  PARTIAL: "bg-amber-50 text-amber-700",
  FULFILLED: "bg-green-50 text-green-700",
};

function StatusTransitionBadge({ status }: { status?: PromiseStatus }) {
  if (!status) return null;
  const color = TRANSITION_COLORS[status] || "bg-gray-50 text-gray-600";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${color}`}>
      → {STATUS_LABELS[status]}
    </span>
  );
}


function CheckIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
