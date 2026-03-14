import { prisma } from "@/lib/prisma";
import { calculateFulfillment } from "@/lib/grades";
import { PoliticianCard } from "@/components/PoliticianCard";
import { COUNTRIES, type CountryCode } from "@/lib/countries";
import { getIssueWeights } from "@/lib/issue-weights-cache";
import { BrowseFlow } from "./BrowseFlow";

export const dynamic = "force-dynamic";

const GRADE_ORDER: Record<string, number> = {
  F: 0, D: 1, C: 2, B: 3, A: 4, "N/A": 5,
};

interface PageProps {
  searchParams: { country?: string; branch?: string; chamber?: string };
}

export default async function PoliticiansPage({ searchParams }: PageProps) {
  const { country, branch, chamber } = searchParams;

  // Build filter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (country && Object.keys(COUNTRIES).includes(country)) {
    where.country = country;
  }
  if (branch) {
    where.branch = branch;
  }
  if (chamber) {
    where.chamber = chamber;
  }

  const politicians = await prisma.politician.findMany({
    where,
    include: { promises: true },
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
    }))
    .sort((a, b) => (GRADE_ORDER[a.grade] ?? 5) - (GRADE_ORDER[b.grade] ?? 5));

  const countryCounts = await prisma.politician.groupBy({
    by: ["country"],
    _count: true,
  });
  const activeCountries = countryCounts.map((c) => c.country);

  let activeBranches: string[] = [];
  if (country) {
    const branchCounts = await prisma.politician.groupBy({
      by: ["branch"],
      where: { country: country as CountryCode },
      _count: true,
    });
    activeBranches = branchCounts.map((b) => b.branch);
  }

  let activeChambers: string[] = [];
  if (country && branch === "legislative") {
    const chamberCounts = await prisma.politician.groupBy({
      by: ["chamber"],
      where: { country: country as CountryCode, branch: "legislative", chamber: { not: null } },
      _count: true,
    });
    activeChambers = chamberCounts
      .map((c) => c.chamber)
      .filter((c): c is string => c !== null);
  }

  const showPoliticians = country && branch && (branch !== "legislative" || chamber);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <Breadcrumb country={country} branch={branch} chamber={chamber} />

      <h1 className="text-2xl sm:text-3xl font-headline text-brand-charcoal mb-8">
        Browse Politicians
      </h1>

      <BrowseFlow
        country={country}
        branch={branch}
        chamber={chamber}
        activeCountries={activeCountries}
        activeBranches={activeBranches}
        activeChambers={activeChambers}
      />

      {showPoliticians && (
        <div className="mt-10">
          {politiciansWithGrades.length > 0 ? (
            <>
              <p className="text-sm text-slate font-data mb-6">
                {politiciansWithGrades.length} politician
                {politiciansWithGrades.length !== 1 ? "s" : ""} &mdash; worst grades first.
              </p>
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
            </>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
              <p className="text-slate">
                No politicians tracked in this category yet.
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Want to help?{" "}
                <a href="/about" className="text-[#2563EB] hover:underline">
                  Contact us
                </a>
                .
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Breadcrumb({
  country,
  branch,
  chamber,
}: {
  country?: string;
  branch?: string;
  chamber?: string;
}) {
  const countryInfo = country ? COUNTRIES[country as CountryCode] : null;

  const crumbs: { label: string; href: string }[] = [
    { label: "All Countries", href: "/politicians" },
  ];

  if (countryInfo && country) {
    crumbs.push({
      label: countryInfo.name,
      href: `/politicians?country=${country}`,
    });

    if (branch) {
      crumbs.push({
        label: branch === "executive" ? "Executive" : "Legislative",
        href: `/politicians?country=${country}&branch=${branch}`,
      });

      if (chamber) {
        crumbs.push({
          label: chamber === "house" ? "House" : "Senate",
          href: `/politicians?country=${country}&branch=${branch}&chamber=${chamber}`,
        });
      }
    }
  }

  return (
    <nav className="mb-6 overflow-x-auto">
      <ol className="flex items-center gap-1 text-sm whitespace-nowrap">
        {crumbs.map((crumb, i) => (
          <li key={crumb.href} className="flex items-center gap-1">
            {i > 0 && <span className="text-gray-300">/</span>}
            {i === crumbs.length - 1 ? (
              <span className="font-medium text-brand-charcoal">{crumb.label}</span>
            ) : (
              <a
                href={crumb.href}
                className="text-slate hover:text-brand-charcoal transition-colors"
              >
                {crumb.label}
              </a>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
