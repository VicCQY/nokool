import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { calculateFulfillment } from "@/lib/grades";
import { COUNTRIES } from "@/lib/countries";
import { getIssueWeights } from "@/lib/issue-weights-cache";
import { CompareView } from "./CompareView";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { a?: string; b?: string };
}): Promise<Metadata> {
  if (!searchParams.a || !searchParams.b) {
    return {
      title: "Compare Politicians",
      description: "Compare two politicians side-by-side on promises, voting records, and campaign finance.",
    };
  }

  const [polA, polB] = await Promise.all([
    prisma.politician.findUnique({
      where: { id: searchParams.a },
      select: { name: true, promises: { select: { status: true, category: true, weight: true, dateMade: true } }, termStart: true, termEnd: true, branch: true, chamber: true },
    }),
    prisma.politician.findUnique({
      where: { id: searchParams.b },
      select: { name: true, promises: { select: { status: true, category: true, weight: true, dateMade: true } }, termStart: true, termEnd: true, branch: true, chamber: true },
    }),
  ]);

  if (!polA || !polB) {
    return { title: "Compare Politicians" };
  }

  const weights = await getIssueWeights();
  const gradeA = calculateFulfillment(polA.promises, { termStart: polA.termStart, termEnd: polA.termEnd, branch: polA.branch, chamber: polA.chamber }, weights).grade;
  const gradeB = calculateFulfillment(polB.promises, { termStart: polB.termStart, termEnd: polB.termEnd, branch: polB.branch, chamber: polB.chamber }, weights).grade;

  return {
    title: `${polA.name} vs ${polB.name}`,
    description: `Compare ${polA.name} (${gradeA}) and ${polB.name} (${gradeB}) on promises, voting records, and campaign finance.`,
  };
}

interface PageProps {
  searchParams: { a?: string; b?: string };
}

export interface PoliticianComparison {
  id: string;
  name: string;
  country: string;
  countryFlag: string;
  party: string;
  photoUrl: string | null;
  grade: string;
  percentage: number;
  totalPromises: number;
  fulfilled: number;
  partial: number;
  inProgress: number;
  notStarted: number;
  broken: number;
  categories: Record<string, { count: number; percentage: number }>;
}

function buildComparison(
  politician: Awaited<ReturnType<typeof fetchPolitician>>,
  issueWeights: Record<string, number>,
): PoliticianComparison | null {
  if (!politician) return null;

  const { percentage, grade } = calculateFulfillment(
    politician.promises,
    { termStart: politician.termStart, termEnd: politician.termEnd, branch: politician.branch, chamber: politician.chamber },
    issueWeights,
  );
  const countryInfo = COUNTRIES[politician.country as keyof typeof COUNTRIES];

  const statusCounts = {
    fulfilled: 0,
    partial: 0,
    inProgress: 0,
    notStarted: 0,
    broken: 0,
    reversed: 0,
  };

  const categoryMap: Record<
    string,
    { total: number; fulfilled: number; partial: number }
  > = {};

  for (const p of politician.promises) {
    if (p.status === "FULFILLED") statusCounts.fulfilled++;
    else if (p.status === "PARTIAL") statusCounts.partial++;
    else if (p.status === "IN_PROGRESS") statusCounts.inProgress++;
    else if (p.status === "NOT_STARTED") statusCounts.notStarted++;
    else if (p.status === "BROKEN") statusCounts.broken++;
    else if (p.status === "REVERSED") statusCounts.reversed++;

    if (!categoryMap[p.category]) {
      categoryMap[p.category] = { total: 0, fulfilled: 0, partial: 0 };
    }
    categoryMap[p.category].total++;
    if (p.status === "FULFILLED") categoryMap[p.category].fulfilled++;
    if (p.status === "PARTIAL") categoryMap[p.category].partial++;
  }

  const categories: Record<string, { count: number; percentage: number }> = {};
  for (const [cat, data] of Object.entries(categoryMap)) {
    const pct =
      data.total > 0
        ? Math.round(
            ((data.fulfilled + data.partial * 0.5) / data.total) * 100,
          )
        : 0;
    categories[cat] = { count: data.total, percentage: pct };
  }

  return {
    id: politician.id,
    name: politician.name,
    country: countryInfo.name,
    countryFlag: countryInfo.flag,
    party: politician.party,
    photoUrl: politician.photoUrl,
    grade,
    percentage,
    totalPromises: politician.promises.length,
    ...statusCounts,
    categories,
  };
}

async function fetchPolitician(id: string) {
  return prisma.politician.findUnique({
    where: { id },
    include: { promises: true },
  });
}

export default async function ComparePage({ searchParams }: PageProps) {
  const polA = searchParams.a ? await fetchPolitician(searchParams.a) : null;
  const polB = searchParams.b ? await fetchPolitician(searchParams.b) : null;

  const issueWeights = await getIssueWeights();
  const compA = polA ? buildComparison(polA, issueWeights) : null;
  const compB = polB ? buildComparison(polB, issueWeights) : null;

  return (
    <div>
      <section className="bg-brand-ink -mt-[1px]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <h1 className="text-2xl sm:text-3xl font-headline text-white tracking-tight">
            Compare Politicians
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Select two politicians to compare their track records side by side.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <CompareView
          initialA={compA}
          initialB={compB}
          selectedIdA={searchParams.a ?? null}
          selectedIdB={searchParams.b ?? null}
        />
      </section>
    </div>
  );
}
