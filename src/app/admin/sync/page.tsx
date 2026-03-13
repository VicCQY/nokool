"use client";

import { useState, useEffect } from "react";

interface MatchResult {
  matched: { name: string; congressId: string }[];
  unmatched: string[];
}

interface SyncResult {
  billsSynced: number;
  votesSynced: number;
  billsSkipped: number;
  errors: string[];
}

interface FecMatchResult {
  matched: { name: string; fecCandidateId: string }[];
  unmatched: string[];
}

interface FecSyncResult {
  donorsCreated: number;
  donationsCreated: number;
  totalAmount: number;
  errors: string[];
}

interface PoliticianInfo {
  id: string;
  name: string;
  fecCandidateId: string | null;
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function SyncPage() {
  // ── Congress.gov state ──
  const [congress, setCongress] = useState(118);
  const [limit, setLimit] = useState(20);
  const [matching, setMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [matchError, setMatchError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState("");

  // ── FEC state ──
  const [fecMatching, setFecMatching] = useState(false);
  const [fecMatchResult, setFecMatchResult] = useState<FecMatchResult | null>(null);
  const [fecMatchError, setFecMatchError] = useState("");
  const [politicians, setPoliticians] = useState<PoliticianInfo[]>([]);
  const [fecCycles, setFecCycles] = useState<number[]>([2024]);
  const [fecSyncing, setFecSyncing] = useState<string | null>(null); // politicianId being synced
  const [fecSyncResults, setFecSyncResults] = useState<Record<string, FecSyncResult>>({});
  const [fecSyncErrors, setFecSyncErrors] = useState<Record<string, string>>({});

  // Load politicians list
  useEffect(() => {
    fetch("/api/politicians?country=US")
      .then((r) => r.json())
      .then((data) => {
        setPoliticians(
          data.map((p: PoliticianInfo) => ({
            id: p.id,
            name: p.name,
            fecCandidateId: p.fecCandidateId,
          }))
        );
      })
      .catch(() => {});
  }, [fecMatchResult]);

  // ── Congress.gov handlers ──
  async function handleMatch() {
    setMatching(true);
    setMatchResult(null);
    setMatchError("");
    try {
      const res = await fetch("/api/admin/sync/match-members", { method: "POST" });
      const data = await res.json();
      if (!res.ok) setMatchError(data.error || "Failed to match members");
      else setMatchResult(data);
    } catch {
      setMatchError("Network error");
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
      if (!res.ok) setSyncError(data.error || "Sync failed");
      else setSyncResult(data);
    } catch {
      setSyncError("Network error");
    } finally {
      setSyncing(false);
      setSyncStatus("");
    }
  }

  // ── FEC handlers ──
  async function handleFecMatch() {
    setFecMatching(true);
    setFecMatchResult(null);
    setFecMatchError("");
    try {
      const res = await fetch("/api/admin/sync/match-fec", { method: "POST" });
      const data = await res.json();
      if (!res.ok) setFecMatchError(data.error || "Failed to match");
      else setFecMatchResult(data);
    } catch {
      setFecMatchError("Network error");
    } finally {
      setFecMatching(false);
    }
  }

  async function handleFecSync(polId: string) {
    setFecSyncing(polId);
    setFecSyncResults((prev) => {
      const next = { ...prev };
      delete next[polId];
      return next;
    });
    setFecSyncErrors((prev) => {
      const next = { ...prev };
      delete next[polId];
      return next;
    });

    try {
      const res = await fetch("/api/admin/sync/fec-donations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ politicianId: polId, cycles: fecCycles }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFecSyncErrors((prev) => ({ ...prev, [polId]: data.error || "Sync failed" }));
      } else {
        setFecSyncResults((prev) => ({ ...prev, [polId]: data }));
      }
    } catch {
      setFecSyncErrors((prev) => ({ ...prev, [polId]: "Network error" }));
    } finally {
      setFecSyncing(null);
    }
  }

  function toggleCycle(cycle: number) {
    setFecCycles((prev) =>
      prev.includes(cycle) ? prev.filter((c) => c !== cycle) : [...prev, cycle]
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Data Sync</h1>
      <p className="text-sm text-gray-500 mb-8">
        Sync real data from official government APIs.
      </p>

      {/* ── Congress.gov Section ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          US Voting Records
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Pull real bill and vote data from Congress.gov
        </p>

        {/* Match Members */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Step 1 — Match Members</h3>
          <p className="text-xs text-gray-400 mb-3">
            Links US politicians to their Congress.gov member IDs.
          </p>
          <button onClick={handleMatch} disabled={matching} className="rounded-lg bg-[#0D0D0D] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {matching ? <span className="flex items-center gap-2"><Spinner />Matching...</span> : "Match Members"}
          </button>
          {matchError && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3"><p className="text-sm text-red-700">{matchError}</p></div>}
          {matchResult && (
            <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-sm font-medium text-green-800 mb-2">{matchResult.matched.length} matched, {matchResult.unmatched.length} unmatched</p>
              {matchResult.matched.length > 0 && <ul className="text-xs text-green-600 space-y-0.5">{matchResult.matched.map((m) => <li key={m.congressId}>{m.name} → {m.congressId}</li>)}</ul>}
              {matchResult.unmatched.length > 0 && <ul className="text-xs text-yellow-600 mt-2 space-y-0.5">{matchResult.unmatched.map((name) => <li key={name}>{name}</li>)}</ul>}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 mb-8" />

        {/* Sync Votes */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Step 2 — Sync Votes</h3>
          <p className="text-xs text-gray-400 mb-4">Fetch bills and roll call votes from Congress.gov.</p>
          <div className="flex flex-wrap gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Congress</label>
              <select value={congress} onChange={(e) => setCongress(Number(e.target.value))} disabled={syncing} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value={118}>118th (2023–2025)</option>
                <option value={119}>119th (2025–2027)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Bills to sync</label>
              <input type="number" value={limit} onChange={(e) => setLimit(Math.min(Math.max(Number(e.target.value) || 1, 1), 100))} disabled={syncing} min={1} max={100} className="w-24 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
          </div>
          <button onClick={handleSync} disabled={syncing} className="rounded-lg bg-[#0D0D0D] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {syncing ? <span className="flex items-center gap-2"><Spinner />Syncing...</span> : "Sync Recent Votes"}
          </button>
          {syncStatus && <p className="mt-3 text-sm text-gray-500 animate-pulse">{syncStatus}</p>}
          {syncError && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3"><p className="text-sm text-red-700">{syncError}</p></div>}
          {syncResult && (
            <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-sm font-medium text-green-800 mb-1">Synced {syncResult.billsSynced} bills, {syncResult.votesSynced} votes from the {congress}th Congress</p>
              <p className="text-xs text-green-600">{syncResult.billsSkipped} bills skipped (no roll call votes)</p>
              {syncResult.errors.length > 0 && (
                <div className="mt-2 max-h-40 overflow-y-auto">
                  <p className="text-xs font-medium text-yellow-700 mb-1">Warnings ({syncResult.errors.length}):</p>
                  <ul className="text-xs text-yellow-600 space-y-0.5">{syncResult.errors.map((err, i) => <li key={i}>{err}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── FEC Campaign Finance Section ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          US Campaign Finance (FEC)
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Pull real campaign donation data from the Federal Election Commission
        </p>

        {/* Match FEC Candidates */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Step 1 — Match FEC Candidates
          </h3>
          <p className="text-xs text-gray-400 mb-3">
            Links US politicians to their FEC candidate IDs. Required before syncing donations.
          </p>
          <button
            onClick={handleFecMatch}
            disabled={fecMatching}
            className="rounded-lg bg-[#0D0D0D] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {fecMatching ? (
              <span className="flex items-center gap-2"><Spinner />Matching...</span>
            ) : (
              "Match FEC Candidates"
            )}
          </button>

          {fecMatchError && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">{fecMatchError}</p>
            </div>
          )}

          {fecMatchResult && (
            <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-sm font-medium text-green-800 mb-2">
                {fecMatchResult.matched.length} matched, {fecMatchResult.unmatched.length} unmatched
              </p>
              {fecMatchResult.matched.length > 0 && (
                <ul className="text-xs text-green-600 space-y-0.5">
                  {fecMatchResult.matched.map((m) => (
                    <li key={m.fecCandidateId}>{m.name} → {m.fecCandidateId}</li>
                  ))}
                </ul>
              )}
              {fecMatchResult.unmatched.length > 0 && (
                <ul className="text-xs text-yellow-600 mt-2 space-y-0.5">
                  {fecMatchResult.unmatched.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 mb-8" />

        {/* Step 2: Sync Donations */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Step 2 — Sync Donations
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            Fetch top donors for each politician. Select election cycles and click sync.
          </p>

          {/* Cycle selection */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-2">
              Election Cycles
            </label>
            <div className="flex gap-3">
              {[2020, 2022, 2024].map((cycle) => (
                <label key={cycle} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fecCycles.includes(cycle)}
                    onChange={() => toggleCycle(cycle)}
                    disabled={fecSyncing !== null}
                    className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  <span className="text-sm text-gray-700">{cycle}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Per-politician sync */}
          <div className="space-y-3">
            {politicians.length === 0 && (
              <p className="text-xs text-gray-400">No US politicians in the database.</p>
            )}
            {politicians.map((pol) => (
              <div
                key={pol.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{pol.name}</p>
                  <p className="text-xs text-gray-400">
                    {pol.fecCandidateId
                      ? `FEC: ${pol.fecCandidateId}`
                      : "No FEC ID — run Match first"}
                  </p>
                </div>
                <button
                  onClick={() => handleFecSync(pol.id)}
                  disabled={fecSyncing !== null || !pol.fecCandidateId || fecCycles.length === 0}
                  className="rounded-lg bg-[#0D0D0D] px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {fecSyncing === pol.id ? (
                    <span className="flex items-center gap-1.5"><Spinner />Syncing...</span>
                  ) : (
                    "Sync Donations"
                  )}
                </button>

                {fecSyncErrors[pol.id] && (
                  <div className="w-full mt-2 rounded-lg border border-red-200 bg-red-50 p-2">
                    <p className="text-xs text-red-700">{fecSyncErrors[pol.id]}</p>
                  </div>
                )}

                {fecSyncResults[pol.id] && (
                  <div className="w-full mt-2 rounded-lg border border-green-200 bg-green-50 p-2">
                    <p className="text-xs font-medium text-green-800">
                      Synced {fecSyncResults[pol.id].donorsCreated} donors,{" "}
                      {fecSyncResults[pol.id].donationsCreated} donations totaling{" "}
                      {formatCurrency(fecSyncResults[pol.id].totalAmount)} for {pol.name}
                    </p>
                    {fecSyncResults[pol.id].errors.length > 0 && (
                      <ul className="text-xs text-yellow-600 mt-1 space-y-0.5">
                        {fecSyncResults[pol.id].errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
