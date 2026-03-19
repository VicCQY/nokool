"use client";

import { useMemo, useState } from "react";
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
  relevanceScore?: number;
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
  relevanceScore?: number;
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
  details: string | null;
  statusChange: string | null;
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

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const PASSAGE_PATTERN = /\bsigned into law\b|\benacted\b|\bbecame law\b|\bpassed into law\b/i;

type TimelineEvent = {
  date: string;
  sortDate: number;
} & (
  | { type: "announcement"; title: string; description: string | null; details: string | null; sourceUrl: string | null; statusChange: string | null }
  | { type: "news"; title: string; description: string | null; details: string | null; sourceUrl: string | null; statusChange: string | null }
  | { type: "legislation"; title: string; description: string | null; details: string | null; sourceUrl: string | null; isPassage: boolean; statusChange: string | null }
  | { type: "bill_link"; bill: BillLinkData["bill"]; alignment: string; votePosition?: VotePosition | null }
  | { type: "action_link"; action: ActionLinkData["action"]; alignment: string }
);

function buildTimeline(promise: PromiseWithJourney): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Add the promise-made event as an announcement
  events.push({
    type: "announcement",
    date: promise.dateMade,
    sortDate: new Date(promise.dateMade).getTime(),
    title: "Promise Made",
    description: null,
    details: null,
    sourceUrl: promise.sourceUrl,
    statusChange: null,
  });

  for (const evt of promise.events) {
    if (evt.eventType === "announcement") {
      events.push({
        type: "announcement",
        date: evt.eventDate,
        sortDate: new Date(evt.eventDate).getTime(),
        title: evt.title,
        description: evt.description,
        details: evt.details,
        sourceUrl: evt.sourceUrl,
        statusChange: evt.statusChange,
      });
    } else if (evt.eventType === "news") {
      events.push({
        type: "news",
        date: evt.eventDate,
        sortDate: new Date(evt.eventDate).getTime(),
        title: evt.title,
        description: evt.description,
        details: evt.details,
        sourceUrl: evt.sourceUrl,
        statusChange: evt.statusChange,
      });
    } else if (evt.eventType === "legislation") {
      events.push({
        type: "legislation",
        date: evt.eventDate,
        sortDate: new Date(evt.eventDate).getTime(),
        title: evt.title,
        description: evt.description,
        details: evt.details,
        sourceUrl: evt.sourceUrl,
        isPassage: PASSAGE_PATTERN.test(evt.title),
        statusChange: evt.statusChange,
      });
    }
  }

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
      {(supportsCount > 0 || opposesCount > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-gray-200 border-t-2 border-t-green-500 bg-white p-4 shadow-sm">
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

      <div className="space-y-4">
        {promises.map((promise) => (
          <PromiseJourneyCard key={promise.id} promise={promise} />
        ))}
      </div>
    </div>
  );
}

function PromiseJourneyCard({ promise }: { promise: PromiseWithJourney }) {
  const events = useMemo(() => buildTimeline(promise), [promise]);

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

        {/* Status at bottom */}
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

function StatusChangeBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    KEPT: "bg-green-100 text-green-700",
    FIGHTING: "bg-blue-100 text-blue-700",
    STALLED: "bg-amber-100 text-amber-700",
    NOTHING: "bg-gray-100 text-gray-600",
    BROKE: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${colors[status] || "bg-gray-100 text-gray-600"}`}>
      → {status}
    </span>
  );
}

function ExpandableDetails({ details }: { details: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(!open)} className="text-[11px] text-brand-red hover:underline mt-0.5">
        {open ? "Show less" : "See more"}
      </button>
      {open && <p className="text-[11px] text-slate mt-1 leading-relaxed">{details}</p>}
    </>
  );
}

function TimelineEventRow({ event }: { event: TimelineEvent }) {
  if (event.type === "announcement") {
    return (
      <div className="relative py-2">
        <div className="absolute -left-[27px] top-3 h-3.5 w-3.5 rounded-full border-2 border-blue-400 bg-blue-100" />
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
              Announcement
            </span>
            <span className="text-xs text-slate">{formatDate(event.date)}</span>
            {event.statusChange && <StatusChangeBadge status={event.statusChange} />}
          </div>
          <p className="text-xs text-brand-charcoal mt-1">{event.title}</p>
          {event.description && <p className="text-[11px] text-slate mt-0.5">{event.description}</p>}
          {event.details && <ExpandableDetails details={event.details} />}
          {event.sourceUrl && (
            <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-[11px] text-brand-red hover:underline mt-0.5">
              Source <ExternalIcon />
            </a>
          )}
        </div>
      </div>
    );
  }

  if (event.type === "news") {
    return (
      <div className="relative py-2">
        <div className="absolute -left-[27px] top-3 h-3.5 w-3.5 rounded-sm bg-purple-500 border border-purple-600" />
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
              News
            </span>
            <span className="text-xs text-slate">{formatDate(event.date)}</span>
            {event.statusChange && <StatusChangeBadge status={event.statusChange} />}
          </div>
          <p className="text-xs text-brand-charcoal mt-1">{event.title}</p>
          {event.description && <p className="text-[11px] text-slate mt-0.5">{event.description}</p>}
          {event.details && <ExpandableDetails details={event.details} />}
          {event.sourceUrl && (
            <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-[11px] text-brand-red hover:underline mt-0.5">
              Source <ExternalIcon />
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
                <CheckIcon /> Passed
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">
                Legislation
              </span>
            )}
            <span className="text-xs text-slate">{formatDate(event.date)}</span>
            {event.statusChange && <StatusChangeBadge status={event.statusChange} />}
          </div>
          <p className={`text-xs mt-1 ${isPassage ? "font-semibold text-green-800" : "text-brand-charcoal"}`}>
            {event.title}
          </p>
          {event.description && (
            <p className="text-[11px] text-slate mt-0.5">{event.description}</p>
          )}
          {event.details && <ExpandableDetails details={event.details} />}
          {event.sourceUrl && (
            <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-[11px] text-brand-red hover:underline mt-0.5">
              Source <ExternalIcon />
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
                <CheckIcon /> Supports Promise
              </span>
            )}
            {alignment === "opposes" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted-red px-2 py-0.5 text-[11px] font-semibold text-red-700">
                <XIcon /> Opposes Promise
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
          </div>
          <p className="text-xs text-brand-charcoal mt-1">{event.action.title}</p>
          <div className="mt-1">
            {event.alignment === "supports" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                <CheckIcon /> Supports Promise
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted-red px-2 py-0.5 text-[11px] font-semibold text-red-700">
                <XIcon /> Contradicts Promise
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
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

function ExternalIcon() {
  return (
    <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}
