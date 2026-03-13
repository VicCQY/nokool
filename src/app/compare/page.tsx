import { prisma } from "@/lib/prisma";
import { calculateFulfillment } from "@/lib/grades";
import { COUNTRIES } from "@/lib/countries";
import { CompareView } from "./CompareView";

export const dynamic = "force-dynamic";

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
): PoliticianComparison | null {
  if (!politician) return null;

  const { percentage, grade } = calculateFulfillment(politician.promises);
  const countryInfo = COUNTRIES[politician.country as keyof typeof COUNTRIES];

  const statusCounts = {
    fulfilled: 0,
    partial: 0,
    inProgress: 0,
    notStarted: 0,
    broken: 0,
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

  const compA = polA ? buildComparison(polA) : null;
  const compB = polB ? buildComparison(polB) : null;

  return (
    <div>
      <section className="bg-[#0D0D0D] -mt-[1px]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
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
