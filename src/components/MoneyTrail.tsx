"use client";

import { useState, useMemo } from "react";
import { DonorType } from "@prisma/client";

interface DonorData {
  id: string;
  name: string;
  type: DonorType;
  industry: string;
}

interface DonationData {
  id: string;
  amount: number;
  date: string;
  electionCycle: string;
  sourceUrl: string | null;
  donor: DonorData;
}

interface LobbyingData {
  id: string;
  lobbyistName: string;
  clientName: string;
  clientIndustry: string;
  issue: string;
  amount: number;
  year: number;
  sourceUrl: string | null;
}

const DONOR_TYPE_COLORS: Record<DonorType, { bg: string; text: string }> = {
  CORPORATION: { bg: "bg-blue-50", text: "text-blue-700" },
  PAC: { bg: "bg-purple-50", text: "text-purple-700" },
  SUPER_PAC: { bg: "bg-violet-50", text: "text-violet-700" },
  INDIVIDUAL: { bg: "bg-gray-50", text: "text-gray-600" },
  UNION: { bg: "bg-amber-50", text: "text-amber-700" },
  NONPROFIT: { bg: "bg-teal-50", text: "text-teal-700" },
  TRADE_ASSOCIATION: { bg: "bg-orange-50", text: "text-orange-700" },
};

const DONOR_TYPE_LABELS: Record<DonorType, string> = {
  CORPORATION: "Corporation",
  PAC: "PAC",
  SUPER_PAC: "Super PAC",
  INDIVIDUAL: "Individual",
  UNION: "Union",
  NONPROFIT: "Nonprofit",
  TRADE_ASSOCIATION: "Trade Assoc.",
};

const INDUSTRY_COLORS: Record<string, string> = {
  "Oil & Gas": "bg-orange-500",
  Finance: "bg-blue-500",
  Technology: "bg-indigo-500",
  Pharmaceutical: "bg-emerald-500",
  Defense: "bg-slate-500",
  Healthcare: "bg-rose-500",
  Education: "bg-yellow-500",
  "Real Estate": "bg-amber-600",
  Political: "bg-purple-500",
  Entertainment: "bg-pink-500",
  Transportation: "bg-cyan-500",
  Engineering: "bg-teal-500",
  Labour: "bg-red-500",
  Manufacturing: "bg-gray-500",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function MoneyTrail({
  donations,
  lobbyingRecords,
}: {
  donations: DonationData[];
  lobbyingRecords: LobbyingData[];
}) {
  // Derive available cycles from data, sorted descending
  const allCycles = useMemo(() => {
    const cycles = Array.from(new Set(donations.map((d) => d.electionCycle))).sort(
      (a, b) => b.localeCompare(a),
    );
    return cycles;
  }, [donations]);

  // Default to most recent cycle
  const [selectedCycle, setSelectedCycle] = useState(allCycles[0] || "All");
  const [donorTypeFilter, setDonorTypeFilter] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [donorSort, setDonorSort] = useState("amount");
  const [showAllDonors, setShowAllDonors] = useState(false);
  const [expandedDonor, setExpandedDonor] = useState<string | null>(null);
  const [lobbyIndustryFilter, setLobbyIndustryFilter] = useState("");

  // Filter donations by selected cycle
  const cycleDonations = useMemo(() => {
    if (selectedCycle === "All") return donations;
    return donations.filter((d) => d.electionCycle === selectedCycle);
  }, [donations, selectedCycle]);

  // Stats (computed from cycle-filtered donations)
  const totalDonations = cycleDonations.reduce((sum, d) => sum + d.amount, 0);
  const uniqueDonors = new Set(cycleDonations.map((d) => d.donor.id)).size;
  const largestDonation = cycleDonations.reduce(
    (max, d) => (d.amount > max.amount ? d : max),
    cycleDonations[0] || { amount: 0, donor: { name: "N/A" } },
  );

  // Industry breakdown (from cycle-filtered donations)
  const industryTotals: Record<string, number> = {};
  for (const d of cycleDonations) {
    industryTotals[d.donor.industry] =
      (industryTotals[d.donor.industry] || 0) + d.amount;
  }
  const sortedIndustries = Object.entries(industryTotals).sort(
    (a, b) => b[1] - a[1],
  );
  const topIndustry = sortedIndustries[0]?.[0] || "N/A";
  const maxIndustryAmount = sortedIndustries[0]?.[1] || 1;

  // Aggregate donors (from cycle-filtered donations)
  const donorMap = new Map<
    string,
    { donor: DonorData; total: number; count: number; donations: DonationData[] }
  >();
  for (const d of cycleDonations) {
    const existing = donorMap.get(d.donor.id);
    if (existing) {
      existing.total += d.amount;
      existing.count++;
      existing.donations.push(d);
    } else {
      donorMap.set(d.donor.id, {
        donor: d.donor,
        total: d.amount,
        count: 1,
        donations: [d],
      });
    }
  }

  let donorList = Array.from(donorMap.values());

  // Filter donors
  if (donorTypeFilter) {
    donorList = donorList.filter((d) => d.donor.type === donorTypeFilter);
  }
  if (industryFilter) {
    donorList = donorList.filter((d) => d.donor.industry === industryFilter);
  }

  // Sort donors
  if (donorSort === "amount") {
    donorList.sort((a, b) => b.total - a.total);
  } else if (donorSort === "name") {
    donorList.sort((a, b) => a.donor.name.localeCompare(b.donor.name));
  } else if (donorSort === "date") {
    donorList.sort((a, b) => {
      const aLatest = Math.max(
        ...a.donations.map((d) => new Date(d.date).getTime()),
      );
      const bLatest = Math.max(
        ...b.donations.map((d) => new Date(d.date).getTime()),
      );
      return bLatest - aLatest;
    });
  }

  const displayedDonors = showAllDonors ? donorList : donorList.slice(0, 10);

  // Unique industries for filter dropdown (from cycle-filtered data)
  const allIndustries = Array.from(
    new Set(cycleDonations.map((d) => d.donor.industry)),
  ).sort();
  const lobbyIndustries = Array.from(
    new Set(lobbyingRecords.map((l) => l.clientIndustry)),
  ).sort();

  // Filtered lobbying
  let filteredLobbying = lobbyingRecords;
  if (lobbyIndustryFilter) {
    filteredLobbying = filteredLobbying.filter(
      (l) => l.clientIndustry === lobbyIndustryFilter,
    );
  }

  if (donations.length === 0 && lobbyingRecords.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
        <p className="text-slate">No financial data available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* CYCLE SELECTOR */}
      {donations.length > 0 && allCycles.length > 0 && (
        <div className="flex items-center gap-1.5 rounded-lg bg-gray-100 p-1 w-fit">
          {[...allCycles, "All"].map((cycle) => (
            <button
              key={cycle}
              onClick={() => {
                setSelectedCycle(cycle);
                setShowAllDonors(false);
                setExpandedDonor(null);
              }}
              className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-all ${
                selectedCycle === cycle
                  ? "bg-[#0D0D0D] text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {cycle}
            </button>
          ))}
        </div>
      )}

      {/* SECTION A — Stats */}
      {cycleDonations.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-2xl font-mono font-bold text-brand-charcoal">
              {formatCurrency(totalDonations)}
            </p>
            <p className="text-xs text-slate mt-1">
              Total Received{selectedCycle !== "All" ? ` (${selectedCycle})` : ""}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-2xl font-mono font-bold text-brand-charcoal">{uniqueDonors}</p>
            <p className="text-xs text-slate mt-1">Unique Donors</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-2xl font-mono font-bold text-brand-charcoal">
              {formatCurrency(largestDonation.amount)}
            </p>
            <p className="text-xs text-slate mt-1 truncate">
              Largest — {largestDonation.donor.name}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-2xl font-mono font-bold text-brand-charcoal truncate">
              {topIndustry}
            </p>
            <p className="text-xs text-slate mt-1">Top Industry</p>
          </div>
        </div>
      )}

      {/* SECTION B — Top Donors + Industry Breakdown */}
      {cycleDonations.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Top Donors */}
          <div className="lg:col-span-3 rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="p-5 border-b border-gray-100">
              <h3 className="text-lg font-headline text-brand-charcoal mb-3">
                Top Donors
              </h3>
              <div className="flex flex-wrap gap-2">
                <select
                  value={donorTypeFilter}
                  onChange={(e) => setDonorTypeFilter(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-slate shadow-sm focus:border-brand-charcoal focus:ring-1 focus:ring-brand-charcoal focus:outline-none"
                >
                  <option value="">All Types</option>
                  {Object.entries(DONOR_TYPE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  value={industryFilter}
                  onChange={(e) => setIndustryFilter(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-slate shadow-sm focus:border-brand-charcoal focus:ring-1 focus:ring-brand-charcoal focus:outline-none"
                >
                  <option value="">All Industries</option>
                  {allIndustries.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </select>
                <select
                  value={donorSort}
                  onChange={(e) => setDonorSort(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-slate shadow-sm focus:border-brand-charcoal focus:ring-1 focus:ring-brand-charcoal focus:outline-none"
                >
                  <option value="amount">Highest Amount</option>
                  <option value="date">Most Recent</option>
                  <option value="name">Name A-Z</option>
                </select>
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {displayedDonors.map((item, i) => {
                const typeStyle = DONOR_TYPE_COLORS[item.donor.type];
                const isExpanded = expandedDonor === item.donor.id;
                // Collect unique cycles for this donor's donations
                const donorCycles = Array.from(
                  new Set(item.donations.map((d) => d.electionCycle)),
                ).sort((a, b) => b.localeCompare(a));
                return (
                  <div key={item.donor.id}>
                    <button
                      onClick={() =>
                        setExpandedDonor(isExpanded ? null : item.donor.id)
                      }
                      className="w-full px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <span className="text-xs font-medium text-gray-400 w-5 text-right">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-brand-charcoal truncate">
                            {item.donor.name}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${typeStyle.bg} ${typeStyle.text}`}
                          >
                            {DONOR_TYPE_LABELS[item.donor.type]}
                          </span>
                          {selectedCycle === "All" && donorCycles.map((c) => (
                            <span
                              key={c}
                              className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {item.donor.industry} &middot; {item.count} donation
                          {item.count !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <span className="text-sm font-mono font-bold text-brand-charcoal whitespace-nowrap">
                        {formatCurrency(item.total)}
                      </span>
                      <svg
                        className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                    {isExpanded && (
                      <div className="bg-gray-50 px-5 py-3 border-t border-gray-100">
                        <div className="space-y-2 ml-8">
                          {item.donations.map((don) => (
                            <div
                              key={don.id}
                              className="flex flex-wrap items-center gap-3 text-xs"
                            >
                              <span className="font-medium text-brand-charcoal">
                                {formatCurrency(don.amount)}
                              </span>
                              <span className="text-gray-400">
                                {new Date(don.date).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </span>
                              <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-gray-500">
                                {don.electionCycle}
                              </span>
                              {don.sourceUrl && (
                                <a
                                  href={don.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-brand-red hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Source
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {donorList.length > 10 && (
              <div className="p-3 border-t border-gray-100 text-center">
                <button
                  onClick={() => setShowAllDonors(!showAllDonors)}
                  className="text-sm font-medium text-brand-red hover:underline"
                >
                  {showAllDonors
                    ? "Show top 10"
                    : `Show all ${donorList.length} donors`}
                </button>
              </div>
            )}

            {displayedDonors.length === 0 && (
              <p className="p-5 text-center text-sm text-gray-400">
                No donors match the current filters.
              </p>
            )}
          </div>

          {/* Right: Industry Breakdown */}
          <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white shadow-sm p-5">
            <h3 className="text-lg font-headline text-brand-charcoal mb-4">
              By Industry
            </h3>
            <div className="space-y-3">
              {sortedIndustries.map(([industry, amount]) => {
                const pct = Math.round((amount / totalDonations) * 100);
                const barWidth = Math.round(
                  (amount / maxIndustryAmount) * 100,
                );
                const barColor =
                  INDUSTRY_COLORS[industry] || "bg-gray-400";
                return (
                  <div key={industry}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-brand-charcoal truncate">
                        {industry}
                      </span>
                      <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                        {formatCurrency(amount)} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barColor} transition-all duration-500`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SECTION C — Lobbying Records */}
      {lobbyingRecords.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="p-5 border-b border-gray-100">
            <h3 className="text-lg font-headline text-brand-charcoal mb-3">
              Lobbying Records
            </h3>
            <select
              value={lobbyIndustryFilter}
              onChange={(e) => setLobbyIndustryFilter(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-slate shadow-sm focus:border-brand-charcoal focus:ring-1 focus:ring-brand-charcoal focus:outline-none"
            >
              <option value="">All Industries</option>
              {lobbyIndustries.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">
                    Lobbyist
                  </th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">
                    Client
                  </th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">
                    Industry
                  </th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">
                    Issue
                  </th>
                  <th className="px-5 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                  <th className="px-5 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">
                    Year
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLobbying.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-sm text-gray-900">
                      {record.lobbyistName}
                    </td>
                    <td className="px-5 py-3 text-sm font-medium text-gray-900">
                      {record.clientName}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-slate">
                        {record.clientIndustry}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500 max-w-xs truncate">
                      {record.issue}
                    </td>
                    <td className="px-5 py-3 text-sm font-mono font-semibold text-brand-charcoal text-right whitespace-nowrap">
                      {formatCurrency(record.amount)}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-400 text-right">
                      {record.year}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-gray-100">
            {filteredLobbying.map((record) => (
              <div key={record.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-brand-charcoal">
                      {record.clientName}
                    </p>
                    <p className="text-xs text-gray-400">
                      via {record.lobbyistName}
                    </p>
                  </div>
                  <span className="text-sm font-mono font-bold text-brand-charcoal">
                    {formatCurrency(record.amount)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 font-medium text-slate">
                    {record.clientIndustry}
                  </span>
                  <span className="text-gray-400">{record.year}</span>
                </div>
                <p className="text-xs text-gray-500">{record.issue}</p>
              </div>
            ))}
          </div>

          {filteredLobbying.length === 0 && (
            <p className="p-5 text-center text-sm text-gray-400">
              No lobbying records match the current filter.
            </p>
          )}
        </div>
      )}

      {/* DISCLAIMER */}
      {donations.length > 0 && (
        <p className="text-xs text-gray-400 leading-relaxed italic">
          Donation data sourced from FEC filings. Figures reflect itemized
          contributions and may not represent total fundraising. Visit{" "}
          <a
            href="https://www.fec.gov"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-500"
          >
            fec.gov
          </a>{" "}
          for complete records.
        </p>
      )}
    </div>
  );
}
