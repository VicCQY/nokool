import { prisma } from "@/lib/prisma";
import { calculateFulfillment } from "@/lib/grades";
import { PoliticianCard } from "@/components/PoliticianCard";
import { COUNTRIES, type CountryCode } from "@/lib/countries";
import { HeroSearch } from "@/components/HeroSearch";
import Link from "next/link";

export const dynamic = "force-dynamic";

const GRADE_ORDER: Record<string, number> = {
  F: 0,
  D: 1,
  C: 2,
  B: 3,
  A: 4,
  "N/A": 5,
};

export default async function HomePage() {
  const politicians = await prisma.politician.findMany({
    include: { promises: true },
    orderBy: { name: "asc" },
  });

  // Compute grades and sort worst-first within each country
  const politiciansWithGrades = politicians.map((pol) => ({
    ...pol,
    ...calculateFulfillment(pol.promises),
  }));

  const grouped = politiciansWithGrades.reduce(
    (acc, pol) => {
      if (!acc[pol.country]) acc[pol.country] = [];
      acc[pol.country].push(pol);
      return acc;
    },
    {} as Record<string, typeof politiciansWithGrades>,
  );

  // Sort worst grade first within each country
  for (const country of Object.keys(grouped)) {
    grouped[country].sort(
      (a, b) => (GRADE_ORDER[a.grade] ?? 5) - (GRADE_ORDER[b.grade] ?? 5),
    );
  }

  const countryOrder = Object.keys(COUNTRIES) as CountryCode[];

  return (
    <div>
      {/* Hero */}
      <section className="bg-[#0D0D0D] -mt-[1px]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <div className="max-w-2xl">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
              No<span className="text-red-500">Kool</span>
            </h1>
            <p className="mt-2 text-sm font-medium uppercase tracking-widest text-gray-500">
              We don&apos;t drink it, neither should you.
            </p>
            <p className="mt-6 text-lg sm:text-xl text-gray-300 leading-relaxed">
              Tracking what politicians promise vs. what they deliver.
              No spin, no partisan framing &mdash; just receipts.
            </p>
            <HeroSearch />
          </div>
        </div>
      </section>

      {/* Politicians */}
      <section id="politicians" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#1A1A1A]">
              Politicians
            </h2>
            <p className="mt-1 text-sm text-[#4A4A4A]">
              {politicians.length} leaders tracked across{" "}
              {Object.keys(grouped).length} countries &mdash; worst grades
              first.
            </p>
          </div>
        </div>

        {countryOrder.map((code) => {
          const pols = grouped[code];
          if (!pols?.length) return null;
          const country = COUNTRIES[code];

          return (
            <section key={code} className="mb-12">
              <h3 className="mb-5 flex items-center gap-2 text-lg font-semibold text-[#1A1A1A]">
                <span className="text-2xl">{country.flag}</span>
                {country.name}
              </h3>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {pols.map((pol) => (
                  <PoliticianCard
                    key={pol.id}
                    id={pol.id}
                    name={pol.name}
                    party={pol.party}
                    photoUrl={pol.photoUrl}
                    termStartStr={pol.termStart.toISOString()}
                    termEndStr={pol.termEnd?.toISOString() ?? null}
                    grade={pol.grade}
                    percentage={pol.percentage}
                    promiseCount={pol.promises.length}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {politicians.length === 0 && (
          <p className="text-center text-[#4A4A4A] py-16">
            No politicians tracked yet. Add some via the{" "}
            <a href="/admin" className="text-blue-600 hover:underline">
              admin panel
            </a>
            .
          </p>
        )}
      </section>
    </div>
  );
}
