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

interface FullSyncResult {
  houseBills: number;
  houseVotes: number;
  senateBills: number;
  senateVotes: number;
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

interface ExecSyncResult {
  executiveOrders: number;
  memorandums: number;
  proclamations: number;
  updated: number;
  errors: string[];
}

interface PoliticianInfo {
  id: string;
  name: string;
  fecCandidateId: string | null;
  congressId: string | null;
  branch: string;
  chamber: string | null;
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

function Timer({ running }: { running: boolean }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) { setElapsed(0); return; }
    const start = Date.now();
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [running]);

  if (!running) return null;
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return (
    <span className="text-xs text-gray-400 tabular-nums">
      {mins}:{String(secs).padStart(2, "0")}
    </span>
  );
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

  // ── Full sync state ──
  const [fullSyncCongress, setFullSyncCongress] = useState(118);
  const [fullSyncChamber, setFullSyncChamber] = useState<"both" | "house" | "senate">("both");
  const [fullSyncing, setFullSyncing] = useState(false);
  const [fullSyncResult, setFullSyncResult] = useState<FullSyncResult | null>(null);
  const [fullSyncError, setFullSyncError] = useState("");

  // ── Backfill state ──
  const [backfilling, setBackfilling] = useState<string | null>(null);
  const [backfillResults, setBackfillResults] = useState<Record<string, { newVotes: number; checked: number }>>({});

  // ── FEC state ──
  const [fecMatching, setFecMatching] = useState(false);
  const [fecMatchResult, setFecMatchResult] = useState<FecMatchResult | null>(null);
  const [fecMatchError, setFecMatchError] = useState("");
  const [politicians, setPoliticians] = useState<PoliticianInfo[]>([]);
  const [fecSyncing, setFecSyncing] = useState<string | null>(null);
  const [fecSyncResults, setFecSyncResults] = useState<Record<string, FecSyncResult>>({});
  const [fecSyncErrors, setFecSyncErrors] = useState<Record<string, string>>({});
  const [fecSyncAllProgress, setFecSyncAllProgress] = useState<{ current: number; total: number; name: string } | null>(null);

  // ── FEC Summary state ──
  const [fecSummarySyncing, setFecSummarySyncing] = useState<string | null>(null);
  const [fecSummaryResults, setFecSummaryResults] = useState<Record<string, { synced: number; errors: string[] }>>({});
  const [fecSummaryErrors, setFecSummaryErrors] = useState<Record<string, string>>({});

  // ── Executive Actions state ──
  const [execSyncing, setExecSyncing] = useState<string | null>(null);
  const [execSyncResults, setExecSyncResults] = useState<Record<string, ExecSyncResult>>({});
  const [execSyncErrors, setExecSyncErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/politicians?country=US")
      .then((r) => r.json())
      .then((data) => {
        setPoliticians(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data.map((p: any) => ({
            id: p.id, name: p.name,
            fecCandidateId: p.fecCandidateId,
            congressId: p.congressId,
            branch: p.branch || "legislative",
            chamber: p.chamber || null,
          }))
        );
      })
      .catch(() => {});
  }, [fecMatchResult, matchResult]);

  // ── Congress.gov handlers ──
  async function handleMatch() {
    setMatching(true); setMatchResult(null); setMatchError("");
    try {
      const res = await fetch("/api/admin/sync/match-members", { method: "POST" });
      const data = await res.json();
      if (!res.ok) setMatchError(data.error || "Failed to match members");
      else setMatchResult(data);
    } catch { setMatchError("Network error"); }
    finally { setMatching(false); }
  }

  async function handleSync() {
    setSyncing(true); setSyncResult(null); setSyncError("");
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
    } catch { setSyncError("Network error"); }
    finally { setSyncing(false); setSyncStatus(""); }
  }

  async function handleFullSync() {
    setFullSyncing(true); setFullSyncResult(null); setFullSyncError("");
    try {
      const res = await fetch("/api/admin/sync/full-vote-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ congress: fullSyncCongress, chamber: fullSyncChamber }),
      });
      const data = await res.json();
      if (!res.ok) setFullSyncError(data.error || "Full sync failed");
      else setFullSyncResult(data);
    } catch { setFullSyncError("Network error or timeout — the sync may still be running on the server"); }
    finally { setFullSyncing(false); }
  }

  async function handleBackfill(polId: string) {
    setBackfilling(polId);
    try {
      const res = await fetch("/api/admin/sync/backfill-votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ politicianId: polId }),
      });
      const data = await res.json();
      if (res.ok) setBackfillResults(prev => ({ ...prev, [polId]: data }));
    } catch {}
    finally { setBackfilling(null); }
  }

  // ── FEC handlers ──
  async function handleFecMatch() {
    setFecMatching(true); setFecMatchResult(null); setFecMatchError("");
    try {
      const res = await fetch("/api/admin/sync/match-fec", { method: "POST" });
      const data = await res.json();
      if (!res.ok) setFecMatchError(data.error || "Failed to match");
      else setFecMatchResult(data);
    } catch { setFecMatchError("Network error"); }
    finally { setFecMatching(false); }
  }

  async function handleFecSync(polId: string) {
    setFecSyncing(polId);
    setFecSyncResults(prev => { const next = { ...prev }; delete next[polId]; return next; });
    setFecSyncErrors(prev => { const next = { ...prev }; delete next[polId]; return next; });
    try {
      const res = await fetch("/api/admin/sync/fec-donations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ politicianId: polId }),
      });
      const data = await res.json();
      if (!res.ok) setFecSyncErrors(prev => ({ ...prev, [polId]: data.error || "Sync failed" }));
      else setFecSyncResults(prev => ({ ...prev, [polId]: data }));
    } catch { setFecSyncErrors(prev => ({ ...prev, [polId]: "Network error" })); }
    finally { setFecSyncing(null); }
  }

  async function handleFecSyncAll() {
    const eligible = politicians.filter(p => p.fecCandidateId);
    if (eligible.length === 0) return;
    setFecSyncing("all");
    setFecSyncResults({});
    setFecSyncErrors({});
    for (let i = 0; i < eligible.length; i++) {
      const pol = eligible[i];
      setFecSyncAllProgress({ current: i + 1, total: eligible.length, name: pol.name });
      try {
        const res = await fetch("/api/admin/sync/fec-donations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ politicianId: pol.id }),
        });
        const data = await res.json();
        if (!res.ok) setFecSyncErrors(prev => ({ ...prev, [pol.id]: data.error || "Sync failed" }));
        else setFecSyncResults(prev => ({ ...prev, [pol.id]: data }));
      } catch { setFecSyncErrors(prev => ({ ...prev, [pol.id]: "Network error" })); }
    }
    setFecSyncing(null);
    setFecSyncAllProgress(null);
  }

  // ── FEC Summary handlers ──
  async function handleFecSummarySync(polId: string) {
    setFecSummarySyncing(polId);
    setFecSummaryResults(prev => { const next = { ...prev }; delete next[polId]; return next; });
    setFecSummaryErrors(prev => { const next = { ...prev }; delete next[polId]; return next; });
    try {
      const res = await fetch("/api/admin/sync/fec-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ politicianId: polId }),
      });
      const data = await res.json();
      if (!res.ok) setFecSummaryErrors(prev => ({ ...prev, [polId]: data.error || "Sync failed" }));
      else setFecSummaryResults(prev => ({ ...prev, [polId]: data }));
    } catch { setFecSummaryErrors(prev => ({ ...prev, [polId]: "Network error" })); }
    finally { setFecSummarySyncing(null); }
  }

  async function handleFecSummarySyncAll() {
    setFecSummarySyncing("all");
    setFecSummaryResults({});
    setFecSummaryErrors({});
    try {
      const res = await fetch("/api/admin/sync/fec-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) setFecSummaryErrors(prev => ({ ...prev, all: data.error || "Sync failed" }));
      else setFecSummaryResults(prev => ({ ...prev, all: data }));
    } catch { setFecSummaryErrors(prev => ({ ...prev, all: "Network error" })); }
    finally { setFecSummarySyncing(null); }
  }

  // ── Executive Actions handlers ──
  async function handleExecSync(polId: string) {
    setExecSyncing(polId);
    setExecSyncResults(prev => { const next = { ...prev }; delete next[polId]; return next; });
    setExecSyncErrors(prev => { const next = { ...prev }; delete next[polId]; return next; });
    try {
      const res = await fetch("/api/admin/sync/executive-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ politicianId: polId }),
      });
      const data = await res.json();
      if (!res.ok) setExecSyncErrors(prev => ({ ...prev, [polId]: data.error || "Sync failed" }));
      else setExecSyncResults(prev => ({ ...prev, [polId]: data }));
    } catch { setExecSyncErrors(prev => ({ ...prev, [polId]: "Network error or timeout" })); }
    finally { setExecSyncing(null); }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Data Sync</h1>
      <p className="text-sm text-gray-500 mb-8">
        Sync real data from official government APIs.
      </p>

      {/* ── Congress.gov Section ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">US Voting Records</h2>
        <p className="text-sm text-gray-500 mb-6">Pull real bill and vote data from Congress.gov</p>

        {/* Match Members */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Step 1 — Match Members</h3>
          <p className="text-xs text-gray-400 mb-3">Links US politicians to their Congress.gov member IDs.</p>
          <button onClick={handleMatch} disabled={matching} className="rounded-lg bg-[#0D0D0D] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {matching ? <span className="flex items-center gap-2"><Spinner />Matching...</span> : "Match Members"}
          </button>
          {matchError && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3"><p className="text-sm text-red-700">{matchError}</p></div>}
          {matchResult && (
            <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-sm font-medium text-green-800 mb-2">{matchResult.matched.length} matched, {matchResult.unmatched.length} unmatched</p>
              {matchResult.matched.length > 0 && <ul className="text-xs text-green-600 space-y-0.5">{matchResult.matched.map(m => <li key={m.congressId}>{m.name} → {m.congressId}</li>)}</ul>}
              {matchResult.unmatched.length > 0 && <ul className="text-xs text-yellow-600 mt-2 space-y-0.5">{matchResult.unmatched.map(name => <li key={name}>{name}</li>)}</ul>}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 mb-8" />

        {/* Quick Sync Votes */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Step 2a — Quick Sync</h3>
          <p className="text-xs text-gray-400 mb-4">Fetch a limited batch of bills and roll call votes from Congress.gov.</p>
          <div className="flex flex-wrap gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Congress</label>
              <select value={congress} onChange={e => setCongress(Number(e.target.value))} disabled={syncing} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value={118}>118th (2023-2025)</option>
                <option value={119}>119th (2025-2027)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Bills to sync</label>
              <input type="number" value={limit} onChange={e => setLimit(Math.min(Math.max(Number(e.target.value) || 1, 1), 100))} disabled={syncing} min={1} max={100} className="w-24 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
          </div>
          <button onClick={handleSync} disabled={syncing} className="rounded-lg bg-[#0D0D0D] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {syncing ? <span className="flex items-center gap-2"><Spinner />Syncing...</span> : "Sync Recent Votes"}
          </button>
          {syncStatus && <p className="mt-3 text-sm text-gray-500 animate-pulse">{syncStatus}</p>}
          {syncError && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3"><p className="text-sm text-red-700">{syncError}</p></div>}
          {syncResult && (
            <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-sm font-medium text-green-800 mb-1">Synced {syncResult.billsSynced} bills, {syncResult.votesSynced} votes</p>
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

        <div className="border-t border-gray-100 mb-8" />

        {/* Full Sync */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Step 2b — Full Sync</h3>
          <p className="text-xs text-gray-400 mb-2">
            Fetch ALL roll call votes for a Congress directly from clerk.house.gov and senate.gov XML sources.
          </p>
          <p className="text-xs text-amber-600 mb-4">
            This will fetch 1000+ roll call votes. May take 15-30 minutes. Already-synced votes are skipped automatically.
          </p>
          <div className="flex flex-wrap gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Congress</label>
              <select value={fullSyncCongress} onChange={e => setFullSyncCongress(Number(e.target.value))} disabled={fullSyncing} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value={118}>118th (2023-2025)</option>
                <option value={119}>119th (2025-2027)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Chamber</label>
              <select value={fullSyncChamber} onChange={e => setFullSyncChamber(e.target.value as "house" | "senate" | "both")} disabled={fullSyncing} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value="both">Both Chambers</option>
                <option value="house">House Only</option>
                <option value="senate">Senate Only</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleFullSync} disabled={fullSyncing || syncing} className="rounded-lg bg-[#0D0D0D] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {fullSyncing ? <span className="flex items-center gap-2"><Spinner />Full Sync Running...</span> : "Full Sync"}
            </button>
            <Timer running={fullSyncing} />
          </div>
          {fullSyncError && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3"><p className="text-sm text-red-700">{fullSyncError}</p></div>}
          {fullSyncResult && (
            <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-sm font-medium text-green-800 mb-1">Full sync complete</p>
              <ul className="text-xs text-green-600 space-y-0.5">
                <li>House: {fullSyncResult.houseBills} bills, {fullSyncResult.houseVotes} votes</li>
                <li>Senate: {fullSyncResult.senateBills} bills, {fullSyncResult.senateVotes} votes</li>
                <li>Total: {fullSyncResult.houseBills + fullSyncResult.senateBills} bills, {fullSyncResult.houseVotes + fullSyncResult.senateVotes} votes</li>
              </ul>
              {fullSyncResult.errors.length > 0 && (
                <div className="mt-2 max-h-40 overflow-y-auto">
                  <p className="text-xs font-medium text-yellow-700 mb-1">Errors ({fullSyncResult.errors.length}):</p>
                  <ul className="text-xs text-yellow-600 space-y-0.5">{fullSyncResult.errors.map((err, i) => <li key={i}>{err}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 mb-8" />

        {/* Backfill Votes */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Backfill Votes</h3>
          <p className="text-xs text-gray-400 mb-4">
            Re-scan existing bills to find votes for a specific politician. Useful after adding a new politician.
          </p>
          <div className="space-y-3">
            {politicians.filter(p => p.congressId).map(pol => (
              <div key={pol.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{pol.name}</p>
                  <p className="text-xs text-gray-400">{pol.congressId}</p>
                </div>
                <button
                  onClick={() => handleBackfill(pol.id)}
                  disabled={backfilling !== null}
                  className="rounded-lg bg-gray-200 px-4 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {backfilling === pol.id ? <span className="flex items-center gap-1.5"><Spinner />Backfilling...</span> : "Backfill Votes"}
                </button>
                {backfillResults[pol.id] && (
                  <span className="text-xs text-green-600">
                    +{backfillResults[pol.id].newVotes} votes (checked {backfillResults[pol.id].checked} bills)
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FEC Campaign Finance Section ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">US Campaign Finance (FEC)</h2>
        <p className="text-sm text-gray-500 mb-6">Pull real campaign donation data from the Federal Election Commission</p>

        {/* Match FEC Candidates */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Step 1 — Match FEC Candidates</h3>
          <p className="text-xs text-gray-400 mb-3">Links US politicians to their FEC candidate IDs. If auto-matching fails, you can manually enter the FEC Candidate ID on the politician&apos;s edit page.</p>
          <button onClick={handleFecMatch} disabled={fecMatching} className="rounded-lg bg-[#0D0D0D] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {fecMatching ? <span className="flex items-center gap-2"><Spinner />Matching...</span> : "Match FEC Candidates"}
          </button>
          {fecMatchError && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3"><p className="text-sm text-red-700">{fecMatchError}</p></div>}
          {fecMatchResult && (
            <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-sm font-medium text-green-800 mb-2">{fecMatchResult.matched.length} matched, {fecMatchResult.unmatched.length} unmatched</p>
              {fecMatchResult.matched.length > 0 && <ul className="text-xs text-green-600 space-y-0.5">{fecMatchResult.matched.map(m => <li key={m.fecCandidateId}>{m.name} → {m.fecCandidateId}</li>)}</ul>}
              {fecMatchResult.unmatched.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-yellow-700 mb-1">Unmatched ({fecMatchResult.unmatched.length}) — set FEC ID manually on their edit page:</p>
                  <ul className="text-xs text-yellow-600 space-y-0.5">{fecMatchResult.unmatched.map(name => <li key={name}>{name}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 mb-8" />

        {/* Sync Donations */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Step 2 — Sync Donations</h3>
          <p className="text-xs text-gray-400 mb-4">
            Fetch top donors for each politician. Election years are auto-determined: senators every 6 years, house every 2 years, executive every 4 years.
          </p>
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={handleFecSyncAll}
                disabled={fecSyncing !== null}
                className="rounded-lg bg-[#0D0D0D] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {fecSyncing === "all" ? <span className="flex items-center gap-2"><Spinner />Syncing All...</span> : "Sync All Donations"}
              </button>
              <Timer running={fecSyncing === "all"} />
            </div>
            {fecSyncAllProgress && (
              <p className="mt-2 text-xs text-gray-500 animate-pulse">
                Syncing {fecSyncAllProgress.name} ({fecSyncAllProgress.current}/{fecSyncAllProgress.total})...
              </p>
            )}
          </div>
          <div className="border-t border-gray-100 mb-4" />
          <p className="text-xs text-gray-400 mb-4">Or sync individually:</p>
          <div className="space-y-3">
            {politicians.length === 0 && <p className="text-xs text-gray-400">No US politicians in the database.</p>}
            {politicians.filter(p => p.fecCandidateId).map(pol => (
              <div key={pol.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{pol.name}</p>
                  <p className="text-xs text-gray-400">FEC: {pol.fecCandidateId}{pol.chamber === "senate" ? " · Senate" : pol.branch === "executive" ? " · Executive" : " · House"}</p>
                </div>
                <button onClick={() => handleFecSync(pol.id)} disabled={fecSyncing !== null} className="rounded-lg bg-gray-200 px-4 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  {fecSyncing === pol.id ? <span className="flex items-center gap-1.5"><Spinner />Syncing...</span> : "Sync Donations"}
                </button>
                {fecSyncErrors[pol.id] && <div className="w-full mt-2 rounded-lg border border-red-200 bg-red-50 p-2"><p className="text-xs text-red-700">{fecSyncErrors[pol.id]}</p></div>}
                {fecSyncResults[pol.id] && (
                  <div className="w-full mt-2 rounded-lg border border-green-200 bg-green-50 p-2">
                    <p className="text-xs font-medium text-green-800">
                      Synced {fecSyncResults[pol.id].donorsCreated} donors, {fecSyncResults[pol.id].donationsCreated} donations totaling {formatCurrency(fecSyncResults[pol.id].totalAmount)} for {pol.name}
                    </p>
                    {fecSyncResults[pol.id].errors.length > 0 && (
                      <ul className="text-xs text-yellow-600 mt-1 space-y-0.5">{fecSyncResults[pol.id].errors.map((err, i) => <li key={i}>{err}</li>)}</ul>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FEC Summary Totals Section ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">FEC Official Totals</h2>
        <p className="text-sm text-gray-500 mb-6">
          Pull official pre-calculated campaign finance totals from the FEC candidate totals endpoint. These power the headline stats on each politician&apos;s Money Trail tab.
        </p>

        <div className="mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={handleFecSummarySyncAll}
              disabled={fecSummarySyncing !== null}
              className="rounded-lg bg-[#0D0D0D] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {fecSummarySyncing === "all" ? <span className="flex items-center gap-2"><Spinner />Syncing All...</span> : "Sync All Politicians"}
            </button>
            <Timer running={fecSummarySyncing === "all"} />
          </div>
          {fecSummaryErrors["all"] && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2"><p className="text-xs text-red-700">{fecSummaryErrors["all"]}</p></div>}
          {fecSummaryResults["all"] && (
            <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-2">
              <p className="text-xs font-medium text-green-800">Synced {fecSummaryResults["all"].synced} summaries</p>
              {fecSummaryResults["all"].errors.length > 0 && (
                <div className="mt-1 max-h-40 overflow-y-auto">
                  <ul className="text-xs text-yellow-600 space-y-0.5">{fecSummaryResults["all"].errors.map((err, i) => <li key={i}>{err}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 mb-4" />
        <p className="text-xs text-gray-400 mb-4">Or sync individually:</p>

        <div className="space-y-3">
          {politicians.filter(p => p.fecCandidateId).map(pol => (
            <div key={pol.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{pol.name}</p>
                <p className="text-xs text-gray-400">FEC: {pol.fecCandidateId}</p>
              </div>
              <button
                onClick={() => handleFecSummarySync(pol.id)}
                disabled={fecSummarySyncing !== null}
                className="rounded-lg bg-gray-200 px-4 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {fecSummarySyncing === pol.id ? <span className="flex items-center gap-1.5"><Spinner />Syncing...</span> : "Sync Summary"}
              </button>
              {fecSummaryErrors[pol.id] && <div className="w-full mt-2 rounded-lg border border-red-200 bg-red-50 p-2"><p className="text-xs text-red-700">{fecSummaryErrors[pol.id]}</p></div>}
              {fecSummaryResults[pol.id] && (
                <div className="w-full mt-2 rounded-lg border border-green-200 bg-green-50 p-2">
                  <p className="text-xs font-medium text-green-800">Synced {fecSummaryResults[pol.id].synced} summaries</p>
                  {fecSummaryResults[pol.id].errors.length > 0 && (
                    <ul className="text-xs text-yellow-600 mt-1 space-y-0.5">{fecSummaryResults[pol.id].errors.map((err, i) => <li key={i}>{err}</li>)}</ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Executive Actions (Federal Register) Section ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Executive Actions (Federal Register)</h2>
        <p className="text-sm text-gray-500 mb-6">
          Sync executive orders, memorandums, and proclamations from the Federal Register API. No API key required.
        </p>

        <div className="space-y-3">
          {politicians.filter(p => p.branch === "executive").length === 0 && (
            <p className="text-xs text-gray-400">No executive branch politicians in the database.</p>
          )}
          {politicians.filter(p => p.branch === "executive").map(pol => (
            <div key={pol.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{pol.name}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleExecSync(pol.id)}
                  disabled={execSyncing !== null}
                  className="rounded-lg bg-[#0D0D0D] px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {execSyncing === pol.id ? <span className="flex items-center gap-1.5"><Spinner />Syncing...</span> : "Sync Executive Actions"}
                </button>
                <Timer running={execSyncing === pol.id} />
              </div>
              {execSyncErrors[pol.id] && (
                <div className="w-full mt-2 rounded-lg border border-red-200 bg-red-50 p-2">
                  <p className="text-xs text-red-700">{execSyncErrors[pol.id]}</p>
                </div>
              )}
              {execSyncResults[pol.id] && (
                <div className="w-full mt-2 rounded-lg border border-green-200 bg-green-50 p-2">
                  <p className="text-xs font-medium text-green-800">
                    Synced {execSyncResults[pol.id].executiveOrders} executive orders, {execSyncResults[pol.id].memorandums} memorandums, {execSyncResults[pol.id].proclamations} proclamations for {pol.name}
                  </p>
                  {execSyncResults[pol.id].updated > 0 && (
                    <p className="text-xs text-green-600 mt-0.5">{execSyncResults[pol.id].updated} existing actions updated</p>
                  )}
                  {execSyncResults[pol.id].errors.length > 0 && (
                    <div className="mt-1 max-h-40 overflow-y-auto">
                      <ul className="text-xs text-yellow-600 space-y-0.5">{execSyncResults[pol.id].errors.map((err, i) => <li key={i}>{err}</li>)}</ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
