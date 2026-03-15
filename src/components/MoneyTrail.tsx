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

interface FecSummaryData {
  cycle: string;
  totalReceipts: number;
  individualTotal: number;
  pacTotal: number;
  partyTotal: number;
  candidateTotal: number;
  otherTotal: number;
  disbursements: number;
  cashOnHand: number;
  debt: number;
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

function formatCompact(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return formatCurrency(amount);
}

export function MoneyTrail({
  donations,
  fecSummaries = [],
}: {
  donations: DonationData[];
  fecSummaries?: FecSummaryData[];
}) {
  // Derive available cycles from both summaries and donations
  const allCycles = useMemo(() => {
    const cycleSet = new Set<string>();
    for (const s of fecSummaries) cycleSet.add(s.cycle);
    for (const d of donations) cycleSet.add(d.electionCycle);
    return Array.from(cycleSet).sort((a, b) => b.localeCompare(a));
  }, [fecSummaries, donations]);

  const [selectedCycle, setSelectedCycle] = useState(allCycles[0] || "All");
  const [donorTypeFilter, setDonorTypeFilter] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [donorSort, setDonorSort] = useState("amount");
  const [showAllDonors, setShowAllDonors] = useState(false);
  const [expandedDonor, setExpandedDonor] = useState<string | null>(null);

  // Get the FEC summary for the selected cycle
  const activeSummary = useMemo(() => {
    if (selectedCycle === "All") {
      // Combine all summaries
      if (fecSummaries.length === 0) return null;
      return fecSummaries.reduce(
        (acc, s) => ({
          cycle: "All",
          totalReceipts: acc.totalReceipts + s.totalReceipts,
          individualTotal: acc.individualTotal + s.individualTotal,
          pacTotal: acc.pacTotal + s.pacTotal,
          partyTotal: acc.partyTotal + s.partyTotal,
          candidateTotal: acc.candidateTotal + s.candidateTotal,
          otherTotal: acc.otherTotal + s.otherTotal,
          disbursements: acc.disbursements + s.disbursements,
          cashOnHand: s.cashOnHand, // use most recent
          debt: s.debt,
        }),
        {
          cycle: "All",
          totalReceipts: 0,
          individualTotal: 0,
          pacTotal: 0,
          partyTotal: 0,
          candidateTotal: 0,
          otherTotal: 0,
          disbursements: 0,
          cashOnHand: 0,
          debt: 0,
        },
      );
    }
    return fecSummaries.find((s) => s.cycle === selectedCycle) || null;
  }, [fecSummaries, selectedCycle]);

  // Filter donations by selected cycle
  const cycleDonations = useMemo(() => {
    if (selectedCycle === "All") return donations;
    return donations.filter((d) => d.electionCycle === selectedCycle);
  }, [donations, selectedCycle]);

  // Industry breakdown (from cycle-filtered donations, excluding aggregate individual entries)
  const nonAggregateDonations = cycleDonations.filter(
    (d) => !d.donor.name.includes("Small-Dollar") && !d.donor.name.includes("Large-Dollar"),
  );
  const industryTotals: Record<string, number> = {};
  for (const d of nonAggregateDonations) {
    industryTotals[d.donor.industry] =
      (industryTotals[d.donor.industry] || 0) + d.amount;
  }
  const sortedIndustries = Object.entries(industryTotals).sort(
    (a, b) => b[1] - a[1],
  );
  const maxIndustryAmount = sortedIndustries[0]?.[1] || 1;
  const industryDonationTotal = nonAggregateDonations.reduce((s, d) => s + d.amount, 0);

  // Aggregate donors (from cycle-filtered donations, excluding aggregate entries)
  const donorMap = new Map<
    string,
    { donor: DonorData; total: number; count: number; donations: DonationData[] }
  >();
  for (const d of nonAggregateDonations) {
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

  if (donorTypeFilter) {
    donorList = donorList.filter((d) => d.donor.type === donorTypeFilter);
  }
  if (industryFilter) {
    donorList = donorList.filter((d) => d.donor.industry === industryFilter);
  }

  if (donorSort === "amount") {
    donorList.sort((a, b) => b.total - a.total);
  } else if (donorSort === "name") {
    donorList.sort((a, b) => a.donor.name.localeCompare(b.donor.name));
  } else if (donorSort === "date") {
    donorList.sort((a, b) => {
      const aLatest = Math.max(...a.donations.map((d) => new Date(d.date).getTime()));
      const bLatest = Math.max(...b.donations.map((d) => new Date(d.date).getTime()));
      return bLatest - aLatest;
    });
  }

  const displayedDonors = showAllDonors ? donorList : donorList.slice(0, 10);

  const allIndustries = Array.from(
    new Set(nonAggregateDonations.map((d) => d.donor.industry)),
  ).sort();

  // Contribution breakdown data from FEC summary
  const breakdownItems = useMemo(() => {
    if (!activeSummary || activeSummary.totalReceipts === 0) return [];
    const s = activeSummary;
    // Split individual into itemized (large) and unitemized (small)
    // We don't have the split in the summary, so approximate:
    // individualTotal is the full amount
    const items: { label: string; amount: number; color: string }[] = [];
    // We store individualTotal as itemized + unitemized combined
    // For the breakdown, show as one "Individual" category
    if (s.individualTotal > 0) items.push({ label: "Individual Contributions", amount: s.individualTotal, color: "bg-blue-500" });
    if (s.pacTotal > 0) items.push({ label: "PAC Contributions", amount: s.pacTotal, color: "bg-purple-500" });
    if (s.partyTotal > 0) items.push({ label: "Party/Committee Transfers", amount: s.partyTotal, color: "bg-amber-500" });
    if (s.candidateTotal > 0) items.push({ label: "Candidate Self-Funding", amount: s.candidateTotal, color: "bg-emerald-500" });
    if (s.otherTotal > 0) items.push({ label: "Other", amount: s.otherTotal, color: "bg-gray-400" });
    return items;
  }, [activeSummary]);

  const hasData = donations.length > 0 || fecSummaries.length > 0;

  if (!hasData) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
        <p className="text-slate">No campaign finance data available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* CYCLE SELECTOR */}
      {allCycles.length > 0 && (
        <div className="flex items-center gap-1.5 rounded-lg bg-gray-100 p-1 w-fit max-w-full overflow-x-auto">
          {[...allCycles, ...(allCycles.length > 1 ? ["All"] : [])].map((cycle) => (
            <button
              key={cycle}
              onClick={() => {
                setSelectedCycle(cycle);
                setShowAllDonors(false);
                setExpandedDonor(null);
              }}
              className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-all whitespace-nowrap ${
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

      {/* SECTION A — Official Stats from FEC Summary */}
      {activeSummary && activeSummary.totalReceipts > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xl sm:text-2xl font-mono font-bold text-brand-charcoal truncate">
              {formatCompact(activeSummary.totalReceipts)}
            </p>
            <p className="text-xs text-slate mt-1">
              Total Receipts
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xl sm:text-2xl font-mono font-bold text-brand-charcoal truncate">
              {formatCompact(activeSummary.individualTotal)}
            </p>
            <p className="text-xs text-slate mt-1">Individual Contributions</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xl sm:text-2xl font-mono font-bold text-brand-charcoal truncate">
              {formatCompact(activeSummary.pacTotal)}
            </p>
            <p className="text-xs text-slate mt-1">PAC Contributions</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xl sm:text-2xl font-mono font-bold text-brand-charcoal truncate">
              {formatCompact(activeSummary.cashOnHand)}
            </p>
            <p className="text-xs text-slate mt-1">Cash on Hand</p>
          </div>
        </div>
      )}

      {/* SECTION B — Contribution Breakdown */}
      {breakdownItems.length > 0 && activeSummary && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
          <h3 className="text-lg font-semibold text-brand-charcoal mb-4">
            Contribution Breakdown
          </h3>
          {/* Stacked bar */}
          <div className="h-6 w-full rounded-full bg-gray-100 overflow-hidden flex mb-4">
            {breakdownItems.map((item) => {
              const pct = (item.amount / activeSummary.totalReceipts) * 100;
              if (pct < 0.5) return null;
              return (
                <div
                  key={item.label}
                  className={`h-full ${item.color} transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                  title={`${item.label}: ${formatCurrency(item.amount)} (${pct.toFixed(1)}%)`}
                />
              );
            })}
          </div>
          {/* Legend */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {breakdownItems.map((item) => {
              const pct = ((item.amount / activeSummary.totalReceipts) * 100).toFixed(1);
              return (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-sm ${item.color} shrink-0`} />
                  <span className="text-xs text-brand-charcoal font-medium truncate">
                    {item.label}
                  </span>
                  <span className="text-xs text-gray-400 whitespace-nowrap ml-auto">
                    {formatCompact(item.amount)} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
          {/* Additional stats row */}
          {(activeSummary.disbursements > 0 || activeSummary.debt > 0) && (
            <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-x-6 gap-y-1">
              {activeSummary.disbursements > 0 && (
                <p className="text-xs text-gray-400">
                  Spent: <span className="font-medium text-brand-charcoal">{formatCompact(activeSummary.disbursements)}</span>
                </p>
              )}
              {activeSummary.debt > 0 && (
                <p className="text-xs text-gray-400">
                  Debt: <span className="font-medium text-brand-charcoal">{formatCompact(activeSummary.debt)}</span>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* SECTION C — Top Donors + Industry Breakdown */}
      {nonAggregateDonations.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Top Donors */}
          <div className="lg:col-span-3 rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="p-5 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-brand-charcoal mb-1">
                Top Donors
              </h3>
              <p className="text-xs text-gray-400 mb-3">
                Based on itemized contributions ($200+). Small-dollar donors are not individually listed.
              </p>
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
            <h3 className="text-lg font-semibold text-brand-charcoal mb-1">
              By Industry
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Based on itemized contributions ($200+).
            </p>
            <div className="space-y-3">
              {sortedIndustries.map(([industry, amount]) => {
                const pct = Math.round((amount / industryDonationTotal) * 100);
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

      {/* DISCLAIMER */}
      {hasData && (
        <p className="text-xs text-gray-400 leading-relaxed italic">
          Headline totals sourced from official FEC candidate filings.
          Donor details based on itemized FEC Schedule A filings ($200+). Visit{" "}
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
