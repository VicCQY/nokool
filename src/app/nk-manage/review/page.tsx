"use client";

import { useState, useEffect } from "react";

interface PendingEvent {
  id: string;
  promiseId: string;
  promiseTitle: string;
  promiseStatus: string;
  politicianName: string;
  eventType: string;
  eventDate: string;
  oldStatus: string | null;
  newStatus: string | null;
  title: string;
  description: string | null;
  sourceUrl: string | null;
  createdBy: string;
  confidence: string | null;
  createdAt: string;
}

interface Stats {
  pendingCount: number;
  autoAppliedThisWeek: number;
  rejectedThisWeek: number;
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "bg-green-100 text-green-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-red-100 text-red-700",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  status_change: "Status Change",
  bill_vote: "Bill Vote",
  executive_action: "Executive Action",
  news: "News",
  promise_made: "Promise Made",
  research_note: "Research Note",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ReviewPage() {
  const [pending, setPending] = useState<PendingEvent[]>([]);
  const [stats, setStats] = useState<Stats>({ pendingCount: 0, autoAppliedThisWeek: 0, rejectedThisWeek: 0 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadQueue();
  }, []);

  async function loadQueue() {
    setLoading(true);
    try {
      const res = await fetch("/api/nk-manage/review");
      const data = await res.json();
      setPending(data.pending || []);
      setStats(data.stats || { pendingCount: 0, autoAppliedThisWeek: 0, rejectedThisWeek: 0 });
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(eventId: string, action: "approve" | "reject") {
    setActionLoading((prev) => ({ ...prev, [eventId]: true }));
    try {
      await fetch(`/api/nk-manage/review/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      setPending((prev) => prev.filter((e) => e.id !== eventId));
      setStats((prev) => ({
        ...prev,
        pendingCount: prev.pendingCount - 1,
        ...(action === "reject" ? { rejectedThisWeek: prev.rejectedThisWeek + 1 } : {}),
      }));
    } finally {
      setActionLoading((prev) => ({ ...prev, [eventId]: false }));
    }
  }

  async function handleApproveAllHigh() {
    const highConfidence = pending.filter((e) => e.confidence === "high");
    for (const event of highConfidence) {
      await handleAction(event.id, "approve");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading review queue...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Review Queue</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-mono font-bold text-gray-900">{stats.pendingCount}</p>
          <p className="text-xs text-gray-500 mt-1">Items awaiting review</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-mono font-bold text-green-600">{stats.autoAppliedThisWeek}</p>
          <p className="text-xs text-gray-500 mt-1">Auto-applied this week</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-mono font-bold text-red-600">{stats.rejectedThisWeek}</p>
          <p className="text-xs text-gray-500 mt-1">Rejected this week</p>
        </div>
      </div>

      {/* Bulk actions */}
      {pending.some((e) => e.confidence === "high") && (
        <div className="mb-4">
          <button
            onClick={handleApproveAllHigh}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
          >
            Approve All High Confidence ({pending.filter((e) => e.confidence === "high").length})
          </button>
        </div>
      )}

      {/* Pending items */}
      {pending.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500">No items awaiting review.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((event) => (
            <div
              key={event.id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-gray-900">
                  {event.politicianName}
                </span>
                <span className="text-gray-300">&middot;</span>
                <span className="text-sm text-gray-600">{event.promiseTitle}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {EVENT_TYPE_LABELS[event.eventType] || event.eventType}
                </span>
                {event.confidence && (
                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${CONFIDENCE_COLORS[event.confidence] || "bg-gray-100 text-gray-600"}`}>
                    {event.confidence}
                  </span>
                )}
                <span className="text-xs text-gray-400">
                  Event: {formatDate(event.eventDate)}
                </span>
              </div>

              {event.eventType === "status_change" && event.oldStatus && event.newStatus && (
                <p className="text-sm text-gray-800 mb-1">
                  <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{event.oldStatus}</span>
                  {" → "}
                  <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded font-semibold">{event.newStatus}</span>
                </p>
              )}

              <p className="text-sm text-gray-600 mb-1">{event.title}</p>
              {event.description && (
                <p className="text-xs text-gray-400 italic mb-1">{event.description}</p>
              )}

              {event.sourceUrl && (
                <a
                  href={event.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mb-2"
                >
                  View Source
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleAction(event.id, "approve")}
                  disabled={actionLoading[event.id]}
                  className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleAction(event.id, "reject")}
                  disabled={actionLoading[event.id]}
                  className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
