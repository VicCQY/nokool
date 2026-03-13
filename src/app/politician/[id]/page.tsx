import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { calculateFulfillment } from "@/lib/grades";
import { StatusBadge } from "@/components/StatusBadge";
import { PromiseFilters } from "@/components/PromiseFilters";
import { PromiseTimeline } from "@/components/PromiseTimeline";
import { KoolAidMeter } from "@/components/KoolAidMeter";
import { COUNTRIES } from "@/lib/countries";
import { PromiseStatus, VotePosition } from "@prisma/client";
import { Suspense } from "react";
import { ViewToggle } from "./ViewToggle";
import { ExpandableDescription } from "./ExpandableDescription";
import { ProfileTabs } from "./ProfileTabs";
import { VoteFilters } from "./VoteFilters";
import { VotePositionBadge } from "@/components/VotePositionBadge";
import { SaysVsDoes } from "@/components/SaysVsDoes";
import { MoneyTrail } from "@/components/MoneyTrail";
import { ExecutiveActionsTab } from "@/components/ExecutiveActionsTab";
import { NewsTab } from "@/components/NewsTab";
import { isAuthenticated } from "@/lib/admin-auth";
import Link from "next/link";
import { CategoryBreakdownSection } from "@/components/CategoryBreakdownSection";
import { getIssueWeights } from "@/lib/issue-weights-cache";
import { SEVERITY_LABELS } from "@/lib/issue-weights";
import { GradeBreakdown } from "./GradeBreakdown";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
  searchParams: {
    category?: string;
    status?: string;
    view?: string;
    tab?: string;
    voteCategory?: string;
    votePosition?: string;
    voteSort?: string;
  };
}

const GRADE_COLORS: Record<string, string> = {
  A: "bg-[#22C55E]",
  B: "bg-[#3B82F6]",
  C: "bg-[#F59E0B]",
  D: "bg-[#F97316]",
  F: "bg-[#EF4444]",
  "N/A": "bg-gray-400",
};

const GRADE_BAR_COLORS: Record<string, string> = {
  A: "bg-[#22C55E]",
  B: "bg-[#3B82F6]",
  C: "bg-[#F59E0B]",
  D: "bg-[#F97316]",
  F: "bg-[#EF4444]",
  "N/A": "bg-gray-300",
};

const STATUS_STAT_CONFIG: {
  key: PromiseStatus;
  label: string;
  dotColor: string;
}[] = [
  { key: "FULFILLED", label: "Fulfilled", dotColor: "bg-green-500" },
  { key: "PARTIAL", label: "Partial", dotColor: "bg-yellow-500" },
  { key: "IN_PROGRESS", label: "In Progress", dotColor: "bg-blue-500" },
  { key: "NOT_STARTED", label: "Not Started", dotColor: "bg-gray-400" },
  { key: "BROKEN", label: "Broken", dotColor: "bg-red-500" },
];

export default async function PoliticianPage({
  params,
  searchParams,
}: PageProps) {
  const activeTab = searchParams.tab ?? "saysvsdoes";

  const politician = await prisma.politician.findUnique({
    where: { id: params.id },
    include: {
      promises: {
        orderBy: { dateMade: "desc" },
        include: {
          statusChanges: { orderBy: { changedAt: "asc" } },
        },
      },
      votes: {
        include: {
          bill: true,
        },
        orderBy: { bill: { dateVoted: "desc" } },
      },
      donations: {
        include: { donor: true },
        orderBy: { amount: "desc" },
      },
      lobbyingRecords: {
        orderBy: { amount: "desc" },
      },
      executiveActions: {
        orderBy: { dateIssued: "desc" },
      },
    },
  });

  if (!politician) notFound();

  let isAdmin = false;
  try { isAdmin = isAuthenticated(); } catch {}

  const issueWeights = await getIssueWeights();
  const termInfo = {
    termStart: politician.termStart,
    termEnd: politician.termEnd,
    branch: politician.branch,
    chamber: politician.chamber,
  };
  const { percentage, grade, termProgress } = calculateFulfillment(
    politician.promises,
    termInfo,
    issueWeights,
  );
  const countryInfo = COUNTRIES[politician.country as keyof typeof COUNTRIES];

  // Promise filtering
  let filteredPromises = politician.promises;
  if (searchParams.category) {
    filteredPromises = filteredPromises.filter(
      (p) => p.category === searchParams.category,
    );
  }
  if (searchParams.status) {
    filteredPromises = filteredPromises.filter(
      (p) => p.status === (searchParams.status as PromiseStatus),
    );
  }

  const statusCounts = politician.promises.reduce(
    (acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const isTimelineView = searchParams.view === "timeline";

  const timelinePromises = filteredPromises.map((p) => ({
    id: p.id,
    title: p.title,
    category: p.category,
    dateMade: p.dateMade.toISOString(),
    status: p.status,
    statusChanges: p.statusChanges.map((sc) => ({
      id: sc.id,
      oldStatus: sc.oldStatus,
      newStatus: sc.newStatus,
      changedAt: sc.changedAt.toISOString(),
      note: sc.note,
    })),
  }));

  // Vote filtering
  let filteredVotes = politician.votes;
  if (searchParams.voteCategory) {
    filteredVotes = filteredVotes.filter(
      (v) => v.bill.category === searchParams.voteCategory,
    );
  }
  if (searchParams.votePosition) {
    filteredVotes = filteredVotes.filter(
      (v) => v.position === (searchParams.votePosition as VotePosition),
    );
  }
  if (searchParams.voteSort === "category") {
    filteredVotes = [...filteredVotes].sort((a, b) =>
      a.bill.category.localeCompare(b.bill.category),
    );
  }

  // Vote stats
  const totalVotes = politician.votes.length;
  const voteCounts = politician.votes.reduce(
    (acc, v) => {
      acc[v.position] = (acc[v.position] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const absentCount = voteCounts["ABSENT"] || 0;
  const participationRate =
    totalVotes > 0
      ? Math.round(((totalVotes - absentCount) / totalVotes) * 100)
      : 0;

  return (
    <div>
      {/* Hero header */}
      <section className="bg-[#0D0D0D] -mt-[1px]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* Photo */}
            <div className="h-20 w-20 sm:h-24 sm:w-24 flex-shrink-0 overflow-hidden rounded-full bg-gray-800 ring-4 ring-white/10">
              {politician.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={politician.photoUrl}
                  alt={politician.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-4xl font-semibold text-gray-500">
                  {politician.name[0]}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {politician.name}
              </h1>
              <p className="text-gray-400 mt-1">
                {countryInfo.flag} {politician.party}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {politician.termStart.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
                {" - "}
                {politician.termEnd
                  ? politician.termEnd.toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })
                  : "Present"}
              </p>
              <Link
                href={`/compare?a=${politician.id}`}
                className="inline-flex items-center gap-1.5 mt-3 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Compare with...
              </Link>
            </div>

            {/* Grade + Kool-Aid Meter */}
            <div className="flex items-center gap-5 sm:gap-6">
              <div className="flex flex-col items-center">
                <span
                  className={`inline-flex h-16 w-16 items-center justify-center rounded-full text-white font-extrabold text-2xl shadow-lg ${GRADE_COLORS[grade] ?? "bg-gray-400"}`}
                >
                  {grade}
                </span>
                <p className="text-white text-sm font-semibold mt-2">
                  {percentage}%
                </p>
                <p className="text-gray-500 text-xs">
                  {politician.promises.length} promises
                </p>
              </div>
              <KoolAidMeter size="lg" fulfillmentPercent={percentage} />
            </div>
          </div>

          {/* Fulfillment bar */}
          <div className="mt-6 max-w-md">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
              <span>Term: {Math.round(termProgress * 100)}% complete</span>
              <span>{percentage}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${GRADE_BAR_COLORS[grade] ?? "bg-gray-400"}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats cards (only on promises tab) */}
      {activeTab === "promises" && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Total */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-2xl font-bold text-[#1A1A1A]">
                {politician.promises.length}
              </p>
              <p className="text-xs text-[#4A4A4A] mt-1">Total Promises</p>
            </div>
            {STATUS_STAT_CONFIG.map(({ key, label, dotColor }) => (
              <div
                key={key}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${dotColor}`}
                  />
                  <p className="text-2xl font-bold text-[#1A1A1A]">
                    {statusCounts[key] || 0}
                  </p>
                </div>
                <p className="text-xs text-[#4A4A4A] mt-1">{label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Vote Stats (only on votes tab, legislative only) */}
      {politician.branch !== "executive" && activeTab === "votes" && totalVotes > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-2xl font-bold text-[#1A1A1A]">{totalVotes}</p>
              <p className="text-xs text-[#4A4A4A] mt-1">Total Votes</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                <p className="text-2xl font-bold text-[#1A1A1A]">
                  {voteCounts["YEA"] || 0}
                </p>
              </div>
              <p className="text-xs text-[#4A4A4A] mt-1">Yea</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                <p className="text-2xl font-bold text-[#1A1A1A]">
                  {voteCounts["NAY"] || 0}
                </p>
              </div>
              <p className="text-xs text-[#4A4A4A] mt-1">Nay</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <p className="text-2xl font-bold text-[#1A1A1A]">
                  {voteCounts["ABSTAIN"] || 0}
                </p>
              </div>
              <p className="text-xs text-[#4A4A4A] mt-1">Abstain</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-gray-400" />
                <p className="text-2xl font-bold text-[#1A1A1A]">
                  {voteCounts["ABSENT"] || 0}
                </p>
              </div>
              <p className="text-xs text-[#4A4A4A] mt-1">Absent</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-2xl font-bold text-[#1A1A1A]">
                {participationRate}%
              </p>
              <p className="text-xs text-[#4A4A4A] mt-1">Participation</p>
            </div>
          </div>
        </section>
      )}

      {/* Category Breakdown (only on promises tab) */}
      {activeTab === "promises" && politician.promises.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-8">
          <CategoryBreakdownSection
            promises={politician.promises.map((p) => ({
              category: p.category,
              status: p.status,
            }))}
          />
        </section>
      )}

      {/* Grade Breakdown (only on promises tab) */}
      {activeTab === "promises" && politician.promises.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-6">
          <GradeBreakdown
            promises={politician.promises.map((p) => ({
              title: p.title,
              category: p.category,
              status: p.status,
              weight: p.weight,
            }))}
            termProgress={termProgress}
            issueWeights={issueWeights}
            chamber={politician.chamber}
          />
        </section>
      )}

      {/* Tabs */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-8">
        <Suspense>
          <ProfileTabs branch={politician.branch} />
        </Suspense>
      </section>

      {/* Content */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* ===== PROMISES TAB ===== */}
        {activeTab === "promises" && (
          <>
            {/* Filters + View Toggle */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <Suspense>
                <PromiseFilters />
              </Suspense>
              <Suspense>
                <ViewToggle />
              </Suspense>
            </div>

            {/* Timeline View */}
            {isTimelineView && (
              <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-[#1A1A1A] mb-4">
                  Promise Timeline
                </h2>
                <PromiseTimeline
                  promises={timelinePromises}
                  termStart={politician.termStart.toISOString()}
                  termEnd={
                    politician.termEnd
                      ? politician.termEnd.toISOString()
                      : null
                  }
                />
              </div>
            )}

            {/* List View */}
            {!isTimelineView && (
              <div className="space-y-4">
                {filteredPromises.map((promise) => (
                  <PromiseCard key={promise.id} promise={promise} />
                ))}
                {filteredPromises.length === 0 && (
                  <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
                    <p className="text-[#4A4A4A]">
                      No promises match the current filters.
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ===== VOTING RECORD TAB (legislative only) ===== */}
        {politician.branch !== "executive" && activeTab === "votes" && (
          <>
            <div className="mb-6">
              <Suspense>
                <VoteFilters />
              </Suspense>
            </div>

            <div className="space-y-4">
              {filteredVotes.map((vote) => (
                <div
                  key={vote.id}
                  className="rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md"
                >
                  <div className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className="text-base font-bold text-[#1A1A1A]">
                            {vote.bill.title}
                          </h3>
                          <span className="text-xs text-gray-400 font-mono">
                            {vote.bill.billNumber}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 font-medium text-[#4A4A4A]">
                            {vote.bill.category}
                          </span>
                          <span className="text-gray-400">
                            {vote.bill.dateVoted.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                          <span className="text-xs text-gray-400">
                            {vote.bill.session}
                          </span>
                          {vote.bill.sourceUrl && (
                            <a
                              href={vote.bill.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#2563EB] hover:underline"
                            >
                              Official page &rarr;
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <VotePositionBadge position={vote.position} />
                      </div>
                    </div>
                    <ExpandableDescription description={vote.bill.summary} />
                  </div>
                </div>
              ))}
              {filteredVotes.length === 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
                  <p className="text-[#4A4A4A]">
                    {politician.votes.length === 0
                      ? "No voting records available yet."
                      : "No votes match the current filters."}
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ===== SAYS VS DOES TAB ===== */}
        {activeTab === "saysvsdoes" && (
          <SaysVsDoes
            promises={politician.promises.map((p) => ({
              id: p.id,
              title: p.title,
              category: p.category,
              status: p.status,
            }))}
            votes={politician.votes.map((v) => ({
              id: v.id,
              position: v.position,
              bill: {
                id: v.bill.id,
                title: v.bill.title,
                billNumber: v.bill.billNumber,
                category: v.bill.category,
                dateVoted: v.bill.dateVoted.toISOString(),
              },
            }))}
            actions={politician.executiveActions.map((a) => ({
              id: a.id,
              title: a.title,
              type: a.type,
              category: a.category,
              dateIssued: a.dateIssued.toISOString(),
              relatedPromises: a.relatedPromises,
            }))}
            branch={politician.branch}
          />
        )}

        {/* ===== EXECUTIVE ACTIONS TAB (executive only) ===== */}
        {politician.branch === "executive" && activeTab === "actions" && (
          <ExecutiveActionsTab
            actions={politician.executiveActions.map((a) => ({
              id: a.id,
              title: a.title,
              type: a.type,
              summary: a.summary,
              category: a.category,
              dateIssued: a.dateIssued.toISOString(),
              sourceUrl: a.sourceUrl,
            }))}
          />
        )}

        {/* ===== NEWS TAB ===== */}
        {activeTab === "news" && (
          <NewsTab politicianId={politician.id} isAdmin={isAdmin} />
        )}

        {/* ===== MONEY TRAIL TAB ===== */}
        {activeTab === "money" && (
          <MoneyTrail
            donations={politician.donations.map((d) => ({
              id: d.id,
              amount: d.amount,
              date: d.date.toISOString(),
              electionCycle: d.electionCycle,
              sourceUrl: d.sourceUrl,
              donor: {
                id: d.donor.id,
                name: d.donor.name,
                type: d.donor.type,
                industry: d.donor.industry,
              },
            }))}
            lobbyingRecords={politician.lobbyingRecords.map((l) => ({
              id: l.id,
              lobbyistName: l.lobbyistName,
              clientName: l.clientName,
              clientIndustry: l.clientIndustry,
              issue: l.issue,
              amount: l.amount,
              year: l.year,
              sourceUrl: l.sourceUrl,
            }))}
          />
        )}
      </section>
    </div>
  );
}

function PromiseCard({
  promise,
}: {
  promise: {
    id: string;
    title: string;
    description: string;
    category: string;
    dateMade: Date;
    sourceUrl: string | null;
    status: PromiseStatus;
    weight: number;
  };
}) {
  const severityLabel = SEVERITY_LABELS[promise.weight] || "Standard";

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md">
      <div className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h3 className="text-base font-bold text-[#1A1A1A]">
                {promise.title}
              </h3>
              <StatusBadge status={promise.status} />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 font-medium text-[#4A4A4A]">
                {promise.category}
              </span>
              <span
                className="inline-flex items-center gap-0.5 text-gray-400"
                title={`Promise Severity: ${severityLabel} (${promise.weight}/5)`}
              >
                {Array.from({ length: 5 }, (_, i) => (
                  <span
                    key={i}
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      i < promise.weight ? "bg-gray-500" : "bg-gray-200"
                    }`}
                  />
                ))}
              </span>
              <span className="text-gray-400">
                Made{" "}
                {promise.dateMade.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              {promise.sourceUrl && (
                <a
                  href={promise.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#2563EB] hover:underline"
                >
                  Source &rarr;
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Expandable description */}
        <ExpandableDescription description={promise.description} />
      </div>
    </div>
  );
}
