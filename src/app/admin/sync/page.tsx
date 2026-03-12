"use client";

import { useState } from "react";

interface MatchResult {
  matched: { name: string; congressId: string }[];
  unmatched: string[];
  error?: string;
}

interface SyncResult {
  billsSynced: number;
  votesSynced: number;
  billsSkipped: number;
  errors: string[];
  error?: string;
}

export default function SyncPage() {
  const [congress, setCongress] = useState(118);
  const [limit, setLimit] = useState(20);

  // Match state
  const [matching, setMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [matchError, setMatchError] = useState("");

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState("");

  const hasApiKey = true; // Will show warning from API if not set

  async function handleMatch() {
    setMatching(true);
    setMatchResult(null);
    setMatchError("");

    try {
      const res = await fetch("/api/admin/sync/match-members", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setMatchError(data.error || "Failed to match members");
      } else {
        setMatchResult(data);
      }
    } catch {
      setMatchError("Network error — could not reach the server");
    } finally {
      setMatching(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    setSyncError("");
    setSyncStatus("Fetching bills and votes from Congress.gov...");

    try {
      const res = await fetch("/api/admin/sync/congress-votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ congress, limit }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSyncError(data.error || "Sync failed");
      } else {
        setSyncResult(data);
      }
    } catch {
      setSyncError("Network error — could not reach the server");
    } finally {
      setSyncing(false);
      setSyncStatus("");
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Data Sync</h1>
      <p className="text-sm text-gray-500 mb-8">
        Sync real voting record data from official government APIs.
      </p>

      {/* Congress.gov section */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          US Voting Records
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Pull real bill and vote data from Congress.gov
        </p>

        {/* Step 1: Match Members */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Step 1 — Match Members
          </h3>
          <p className="text-xs text-gray-400 mb-3">
            Links US politicians in the database to their Congress.gov member
            IDs. Required before syncing votes.
          </p>
          <button
            onClick={handleMatch}
            disabled={matching}
            className="rounded-lg bg-[#0D0D0D] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {matching ? (
              <span className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Matching...
              </span>
            ) : (
              "Match Members"
            )}
          </button>

          {matchError && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">{matchError}</p>
            </div>
          )}

          {matchResult && (
            <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-sm font-medium text-green-800 mb-2">
                {matchResult.matched.length} matched,{" "}
                {matchResult.unmatched.length} unmatched
              </p>
              {matchResult.matched.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs font-medium text-green-700 mb-1">
                    Matched:
                  </p>
                  <ul className="text-xs text-green-600 space-y-0.5">
                    {matchResult.matched.map((m) => (
                      <li key={m.congressId}>
                        {m.name} → {m.congressId}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {matchResult.unmatched.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-yellow-700 mb-1">
                    Unmatched:
                  </p>
                  <ul className="text-xs text-yellow-600 space-y-0.5">
                    {matchResult.unmatched.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100 mb-8" />

        {/* Step 2: Sync Votes */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Step 2 — Sync Votes
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            Fetch bills and roll call votes from Congress.gov. This can take
            several minutes depending on how many bills you sync.
          </p>

          <div className="flex flex-wrap gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Congress
              </label>
              <select
                value={congress}
                onChange={(e) => setCongress(Number(e.target.value))}
                disabled={syncing}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value={118}>118th (2023–2025)</option>
                <option value={119}>119th (2025–2027)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Bills to sync
              </label>
              <input
                type="number"
                value={limit}
                onChange={(e) =>
                  setLimit(
                    Math.min(Math.max(Number(e.target.value) || 1, 1), 100)
                  )
                }
                disabled={syncing}
                min={1}
                max={100}
                className="w-24 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          </div>

          <button
            onClick={handleSync}
            disabled={syncing || !hasApiKey}
            className="rounded-lg bg-[#0D0D0D] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {syncing ? (
              <span className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Syncing...
              </span>
            ) : (
              "Sync Recent Votes"
            )}
          </button>

          {syncStatus && (
            <p className="mt-3 text-sm text-gray-500 animate-pulse">
              {syncStatus}
            </p>
          )}

          {syncError && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">{syncError}</p>
            </div>
          )}

          {syncResult && (
            <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-sm font-medium text-green-800 mb-1">
                Synced {syncResult.billsSynced} bill
                {syncResult.billsSynced !== 1 ? "s" : ""},{" "}
                {syncResult.votesSynced} vote
                {syncResult.votesSynced !== 1 ? "s" : ""} from the {congress}th
                Congress
              </p>
              <p className="text-xs text-green-600">
                {syncResult.billsSkipped} bill
                {syncResult.billsSkipped !== 1 ? "s" : ""} skipped (no roll call
                votes)
              </p>
              {syncResult.errors.length > 0 && (
                <div className="mt-2 max-h-40 overflow-y-auto">
                  <p className="text-xs font-medium text-yellow-700 mb-1">
                    Warnings ({syncResult.errors.length}):
                  </p>
                  <ul className="text-xs text-yellow-600 space-y-0.5">
                    {syncResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
