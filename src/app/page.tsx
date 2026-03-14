import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { calculateFulfillment } from "@/lib/grades";
import { PoliticianCard } from "@/components/PoliticianCard";
import { HeroSearch } from "@/components/HeroSearch";
import { getIssueWeights } from "@/lib/issue-weights-cache";
import Link from "next/link";

export const metadata: Metadata = {
  title: "NoKool — Politician Promise Tracker",
  description:
    "We don't drink it, neither should you. Track campaign promises, voting records, and campaign finance for US politicians.",
  openGraph: {
    images: ["/api/og/home"],
  },
};

export const dynamic = "force-dynamic";

const GRADE_ORDER: Record<string, number> = {
  F: 0,
  D: 1,
  C: 2,
  B: 3,
  A: 4,
  "N/A": 5,
};

const FEATURES = [
  {
    title: "Promise Tracker",
    desc: "See what they promised and whether they delivered.",
    borderColor: "border-l-brand-red",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "Voting Records",
    desc: "How they actually vote, in plain language.",
    borderColor: "border-l-[#2563EB]",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    title: "Money Trail",
    desc: "Follow the money. See who funds them.",
    borderColor: "border-l-[#16A34A]",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "Says vs Does",
    desc: "Cross-reference promises with actual votes.",
    borderColor: "border-l-[#D97706]",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.97zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.97z" />
      </svg>
    ),
  },
];

export default async function HomePage() {
  const politicians = await prisma.politician.findMany({
    include: { promises: true, votes: true },
    orderBy: { name: "asc" },
  });

  const issueWeights = await getIssueWeights();

  const politiciansWithGrades = politicians
    .map((pol) => ({
      ...pol,
      ...calculateFulfillment(
        pol.promises,
        { termStart: pol.termStart, termEnd: pol.termEnd, branch: pol.branch, chamber: pol.chamber },
        issueWeights,
      ),
      dataCount: pol.promises.length + pol.votes.length,
    }))
    .sort((a, b) => (GRADE_ORDER[a.grade] ?? 5) - (GRADE_ORDER[b.grade] ?? 5))
    .slice(0, 6);

  return (
    <div>
      {/* Hero */}
      <section className="relative bg-brand-ink -mt-[1px] overflow-hidden">
        {/* Subtle noise texture */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")" }} />
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-red/5 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
          <div className="max-w-2xl">
            <h1 className="text-6xl sm:text-7xl lg:text-8xl font-headline tracking-tight text-white">
              No<span className="text-brand-red">Kool</span>
            </h1>
            <p className="mt-3 text-sm font-medium uppercase tracking-[0.2em] text-gray-500 italic">
              We don&apos;t drink it, neither should you.
            </p>
            <p className="mt-8 text-lg sm:text-xl text-gray-300 leading-relaxed max-w-lg">
              Tracking what politicians promise vs. what they deliver.
              No spin, no partisan framing &mdash; just receipts.
            </p>
            <div className="mt-10 flex flex-col min-[375px]:flex-row flex-wrap gap-4">
              <Link
                href="/politicians"
                className="rounded-lg bg-brand-red px-7 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition-all duration-200"
              >
                Browse Politicians
              </Link>
              <HeroSearch />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-cream">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-headline text-brand-charcoal text-center mb-4">
            What We Track
          </h2>
          <p className="text-center text-slate mb-12 max-w-xl mx-auto">
            No spin. No partisan framing. Just data on what politicians say, how they vote, and who pays them.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className={`rounded-lg border border-gray-200 border-l-4 ${f.borderColor} bg-white p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200`}
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-cool-gray text-brand-charcoal">
                  {f.icon}
                </div>
                <h3 className="text-base font-semibold text-brand-charcoal mb-1">
                  {f.title}
                </h3>
                <p className="text-sm text-slate leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Politicians */}
      {politiciansWithGrades.length > 0 && (
        <section className="bg-cool-gray">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
            <div className="flex items-end justify-between mb-8">
              <div>
                <h2 className="text-2xl sm:text-3xl font-headline text-brand-charcoal">
                  Politicians We&apos;re Tracking
                </h2>
                <p className="mt-1 text-sm text-slate">
                  Sorted by worst grade first.
                </p>
              </div>
              <Link
                href="/politicians"
                className="text-sm font-medium text-[#2563EB] hover:text-blue-800 transition-colors whitespace-nowrap"
              >
                View All &rarr;
              </Link>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {politiciansWithGrades.map((pol) => (
                <PoliticianCard
                  key={pol.id}
                  id={pol.id}
                  name={pol.name}
                  party={pol.party}
                  photoUrl={pol.photoUrl}
                  termStartStr={pol.termStart.toISOString()}
                  termEndStr={pol.termEnd?.toISOString() ?? null}
                  inOfficeSinceStr={pol.inOfficeSince?.toISOString() ?? null}
                  grade={pol.grade}
                  percentage={pol.percentage}
                  promiseCount={pol.promises.length}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* AnTinfoil */}
      <section className="bg-[#1A1A1A]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-headline text-white mb-3">
              Read AnTinfoil
            </h2>
            <p className="text-sm text-gray-500 italic mb-6">
              Busting myths with facts, not theories.
            </p>
            <p className="text-gray-400 mb-8 leading-relaxed">
              NoKool&apos;s sibling project. A blog dedicated to busting political myths
              and misconceptions &mdash; different lens, same mission.
            </p>
            <a
              href="https://www.antinfoil.blog"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-all duration-200"
            >
              Visit AnTinfoil
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
