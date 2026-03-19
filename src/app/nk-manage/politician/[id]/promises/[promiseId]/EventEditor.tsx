"use client";

import { useState, useEffect } from "react";

interface EventData {
  id: string;
  eventType: string;
  eventDate: string;
  title: string;
  description: string | null;
  details: string | null;
  sourceUrl: string | null;
  statusChange: string | null;
  createdBy: string;
}

const EVENT_TYPES = [
  { value: "announcement", label: "Announcement", color: "bg-blue-100 text-blue-700" },
  { value: "news", label: "News", color: "bg-purple-100 text-purple-700" },
  { value: "legislation", label: "Legislation", color: "bg-teal-100 text-teal-700" },
];

const STATUS_OPTIONS = [
  { value: "", label: "No change" },
  { value: "KEPT", label: "KEPT" },
  { value: "FIGHTING", label: "FIGHTING" },
  { value: "STALLED", label: "STALLED" },
  { value: "NOTHING", label: "NOTHING" },
  { value: "BROKE", label: "BROKE" },
];

const inputClass = "w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none";

export function EventEditor({ promiseId }: { promiseId: string }) {
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadEvents();
  }, [promiseId]);

  async function loadEvents() {
    setLoading(true);
    try {
      const res = await fetch(`/api/nk-manage/promises/${promiseId}/events`);
      const data = await res.json();
      setEvents(data.events || []);
    } catch {
      setMessage("Failed to load events");
    } finally {
      setLoading(false);
    }
  }

  function updateEvent(index: number, field: string, value: string | null) {
    setEvents((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [field]: value } : e)),
    );
  }

  async function handleDelete(eventId: string) {
    if (!confirm("Delete this event?")) return;
    try {
      await fetch(`/api/nk-manage/promises/${promiseId}/events`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
      setMessage("Event deleted");
    } catch {
      setMessage("Failed to delete event");
    }
  }

  async function handleAddEvent() {
    try {
      const res = await fetch(`/api/nk-manage/promises/${promiseId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "news",
          eventDate: new Date().toISOString().split("T")[0],
          title: "New event",
        }),
      });
      const data = await res.json();
      if (data.id) {
        setEvents((prev) => [
          ...prev,
          {
            id: data.id,
            eventType: "news",
            eventDate: new Date().toISOString().split("T")[0],
            title: "New event",
            description: null,
            details: null,
            sourceUrl: null,
            statusChange: null,
            createdBy: "human",
          },
        ]);
        setMessage("Event added");
      }
    } catch {
      setMessage("Failed to add event");
    }
  }

  async function handleSaveAll() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`/api/nk-manage/promises/${promiseId}/events`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
      });
      if (res.ok) {
        setMessage("All events saved");
      } else {
        const data = await res.json();
        setMessage(data.error || "Save failed");
      }
    } catch {
      setMessage("Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-400">Loading events...</p>;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">
          Timeline Events ({events.length})
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handleAddEvent}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
          >
            + Add Event
          </button>
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="rounded-md bg-green-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save All"}
          </button>
        </div>
      </div>

      {message && (
        <p className="text-xs text-blue-600 mb-3">{message}</p>
      )}

      {events.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No timeline events yet.</p>
      ) : (
        <div className="space-y-4">
          {events.map((evt, i) => (
            <div
              key={evt.id}
              className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gray-400 font-mono">#{i + 1}</span>
                  {EVENT_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => updateEvent(i, "eventType", t.value)}
                      className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${
                        evt.eventType === t.value
                          ? t.color
                          : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                  <span className="text-[10px] text-gray-300">{evt.createdBy}</span>
                </div>
                <button
                  onClick={() => handleDelete(evt.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors"
                  title="Delete event"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-0.5">Date</label>
                  <input
                    type="date"
                    value={evt.eventDate}
                    onChange={(e) => updateEvent(i, "eventDate", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-400 mb-0.5">Title</label>
                  <input
                    type="text"
                    value={evt.title}
                    onChange={(e) => updateEvent(i, "title", e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-0.5">Summary (1 line, shown on timeline)</label>
                <input
                  type="text"
                  value={evt.description || ""}
                  onChange={(e) => updateEvent(i, "description", e.target.value || null)}
                  placeholder="Brief summary..."
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-0.5">Details (expanded view, 3-4 sentences)</label>
                <textarea
                  value={evt.details || ""}
                  onChange={(e) => updateEvent(i, "details", e.target.value || null)}
                  placeholder="Full context, background, and impact..."
                  rows={2}
                  className={inputClass + " resize-none"}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-0.5">Source URL</label>
                  <input
                    type="url"
                    value={evt.sourceUrl || ""}
                    onChange={(e) => updateEvent(i, "sourceUrl", e.target.value || null)}
                    placeholder="https://..."
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-0.5">Status Change at this event</label>
                  <select
                    value={evt.statusChange || ""}
                    onChange={(e) => updateEvent(i, "statusChange", e.target.value || null)}
                    className={inputClass}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
