import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Search",
  description: "Search across politicians, promises, bills, and donors on NoKool.",
};
import { calculateFulfillment } from "@/lib/grades";
import { COUNTRIES, type CountryCode } from "@/lib/countries";
import Link from "next/link";
import { SearchPageClient } from "./SearchPageClient";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { q?: string };
}

const GRADE_COLORS: Record<string, string> = {
  A: "bg-grade-A",
  B: "bg-grade-B",
  C: "bg-grade-C",
  D: "bg-grade-D",
  F: "bg-grade-F",
  "N/A": "bg-gray-400",
};

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  KEPT: { bg: "bg-green-50", text: "text-green-700", label: "Kept" },
  FIGHTING: { bg: "bg-blue-50", text: "text-blue-700", label: "Fighting" },
  STALLED: { bg: "bg-yellow-50", text: "text-yellow-700", label: "Stalled" },
  NOTHING: { bg: "bg-gray-50", text: "text-gray-600", label: "Nothing" },
  BROKE: { bg: "bg-red-50", text: "text-red-700", label: "Broke" },
};

const DONOR_TYPE_LABELS: Record<string, string> = {
  CORPORATION: "Corporation",
  PAC: "PAC",
  SUPER_PAC: "Super PAC",
  INDIVIDUAL: "Individual",
  UNION: "Union",
  NONPROFIT: "Nonprofit",
  TRADE_ASSOCIATION: "Trade Assoc.",
};

const DONOR_TYPE_COLORS: Record<string, string> = {
  CORPORATION: "bg-blue-50 text-blue-700",
  PAC: "bg-purple-50 text-purple-700",
  SUPER_PAC: "bg-violet-50 text-violet-700",
  INDIVIDUAL: "bg-gray-50 text-gray-600",
  UNION: "bg-amber-50 text-amber-700",
  NONPROFIT: "bg-teal-50 text-teal-700",
  TRADE_ASSOCIATION: "bg-orange-50 text-orange-700",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function SearchPage({ searchParams }: PageProps) {
  const q = searchParams.q?.trim() || "";

  if (!q || q.length < 2) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        <SearchPageClient initialQuery={q} />
        <div className="text-center py-16">
          <p className="text-slate">Enter at least 2 characters to search.</p>
        </div>
      </div>
    );
  }

  const [politicians, promises, bills, donors] = await Promise.all([
    prisma.politician.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { party: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { promises: { select: { status: true, weight: true, category: true } } },
    }),
    prisma.promise.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { category: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { politician: { select: { id: true, name: true } } },
    }),
    prisma.bill.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { summary: { contains: q, mode: "insensitive" } },
          { billNumber: { contains: q, mode: "insensitive" } },
        ],
      },
      include: {
        votes: {
          take: 1,
          select: { politician: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.donor.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { industry: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { donations: { select: { amount: true } } },
    }),
  ]);

  const totalResults =
    politicians.length + promises.length + bills.length + donors.length;

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
      <SearchPageClient initialQuery={q} />

      <p className="text-sm font-data text-slate mb-8">
        {totalResults} result{totalResults !== 1 ? "s" : ""} for &ldquo;{q}&rdquo;
      </p>

      {totalResults === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-slate">
            No results found for &ldquo;{q}&rdquo;
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Try different keywords or check your spelling.
          </p>
        </div>
      )}

      {/* Politicians */}
      {politicians.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-brand-charcoal mb-3 flex items-center gap-2">
            Politicians
            <span className="text-xs font-data bg-cool-gray text-slate rounded-full px-2 py-0.5 font-medium">
              {politicians.length}
            </span>
          </h2>
          <div className="space-y-3">
            {politicians.map((p) => {
              const { percentage, grade } = calculateFulfillment(p.promises);
              const country = COUNTRIES[p.country as CountryCode];
              return (
                <Link
                  key={p.id}
                  href={`/politician/${p.id}`}
                  className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-cool-gray">
                    {p.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photoUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-gray-500">
                        {p.name[0]}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-brand-charcoal">{p.name}</p>
                    <p className="text-sm text-slate">
                      {country?.flag} {p.party} &middot;{" "}
                      <span className="font-data">{p.promises.length}</span> promises &middot;{" "}
                      <span className="font-data">{percentage}%</span> fulfilled
                    </p>
                  </div>
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-data font-bold text-white ${GRADE_COLORS[grade]}`}
                  >
                    {grade}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Promises */}
      {promises.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-brand-charcoal mb-3 flex items-center gap-2">
            Promises
            <span className="text-xs font-data bg-cool-gray text-slate rounded-full px-2 py-0.5 font-medium">
              {promises.length}
            </span>
          </h2>
          <div className="space-y-3">
            {promises.map((p) => {
              const sc = STATUS_CONFIG[p.status];
              return (
                <Link
                  key={p.id}
                  href={`/politician/${p.politician.id}?tab=promises`}
                  className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="font-semibold text-brand-charcoal">{p.title}</p>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${sc.bg} ${sc.text}`}>
                          {sc.label}
                        </span>
                        <span className="inline-flex items-center rounded-md bg-cool-gray px-2 py-0.5 text-xs font-medium text-slate">
                          {p.category}
                        </span>
                      </div>
                      <p className="text-sm text-slate">by {p.politician.name}</p>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{p.description}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Bills */}
      {bills.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-brand-charcoal mb-3 flex items-center gap-2">
            Bills
            <span className="text-xs font-data bg-cool-gray text-slate rounded-full px-2 py-0.5 font-medium">
              {bills.length}
            </span>
          </h2>
          <div className="space-y-3">
            {bills.map((b) => {
              const href = b.votes[0]?.politician.id
                ? `/politician/${b.votes[0].politician.id}?tab=votes`
                : "#";
              return (
                <Link
                  key={b.id}
                  href={href}
                  className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="font-semibold text-brand-charcoal">{b.title}</p>
                    <span className="text-xs font-data text-slate">{b.billNumber}</span>
                    <span className="inline-flex items-center rounded-md bg-cool-gray px-2 py-0.5 text-xs font-medium text-slate">
                      {b.category}
                    </span>
                  </div>
                  <p className="text-sm text-slate font-data">
                    {b.dateVoted.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    {b.votes[0]?.politician.name && (
                      <> <span className="font-sans">&middot; voted on by {b.votes[0].politician.name}</span></>
                    )}
                  </p>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{b.summary}</p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Donors */}
      {donors.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-brand-charcoal mb-3 flex items-center gap-2">
            Donors
            <span className="text-xs font-data bg-cool-gray text-slate rounded-full px-2 py-0.5 font-medium">
              {donors.length}
            </span>
          </h2>
          <div className="space-y-3">
            {donors.map((d) => {
              const total = d.donations.reduce((s, don) => s + don.amount, 0);
              return (
                <div
                  key={d.id}
                  className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-brand-charcoal">{d.name}</p>
                    <p className="text-sm text-slate">
                      {d.industry} &middot;{" "}
                      <span className="font-data">{d.donations.length}</span> donation{d.donations.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${DONOR_TYPE_COLORS[d.type]}`}>
                    {DONOR_TYPE_LABELS[d.type]}
                  </span>
                  <span className="text-sm font-data font-bold text-brand-charcoal whitespace-nowrap">
                    {formatCurrency(total)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
