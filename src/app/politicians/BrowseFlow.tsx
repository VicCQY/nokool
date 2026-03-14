"use client";

import { useRouter } from "next/navigation";
import { COUNTRIES, type CountryCode } from "@/lib/countries";

interface Props {
  country?: string;
  branch?: string;
  chamber?: string;
  activeCountries: string[];
  activeBranches: string[];
  activeChambers: string[];
}

const ALL_COUNTRIES: { code: CountryCode; name: string; flag: string }[] = [
  { code: "US", name: "United States", flag: "\u{1F1FA}\u{1F1F8}" },
  { code: "CA", name: "Canada", flag: "\u{1F1E8}\u{1F1E6}" },
];

export function BrowseFlow({
  country,
  branch,
  chamber,
  activeCountries,
  activeBranches,
  activeChambers,
}: Props) {
  const router = useRouter();

  // Step 1: Country selection
  if (!country) {
    return (
      <div>
        <h2 className="text-lg font-headline text-brand-charcoal mb-4">
          Select a Country
        </h2>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
          {ALL_COUNTRIES.map((c) => {
            const hasData = activeCountries.includes(c.code);
            return (
              <button
                key={c.code}
                onClick={() => router.push(`/politicians?country=${c.code}`)}
                disabled={!hasData}
                className={`group relative flex flex-col items-center gap-3 rounded-lg border-2 p-8 sm:p-10 transition-all duration-200 ${
                  hasData
                    ? "border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-brand-red/30 hover:-translate-y-0.5 cursor-pointer"
                    : "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                }`}
              >
                <span className="text-5xl sm:text-6xl">{c.flag}</span>
                <span className="text-sm sm:text-base font-semibold text-brand-charcoal">
                  {c.name}
                </span>
                {!hasData && (
                  <span className="text-xs text-slate">No data yet</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const countryInfo = COUNTRIES[country as CountryCode];
  const isUS = country === "US";
  const isCA = country === "CA";

  // Step 2: Branch selection
  if (!branch) {
    return (
      <div>
        <h2 className="text-lg font-headline text-brand-charcoal mb-4">
          <span className="text-2xl mr-2">{countryInfo?.flag}</span>
          {countryInfo?.name} &mdash; Select Branch
        </h2>
        <div className="grid gap-4 grid-cols-2 max-w-lg">
          <BranchCard
            title="Executive"
            subtitle={isCA ? "Prime Minister" : "President"}
            icon={
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
              </svg>
            }
            active={activeBranches.includes("executive")}
            onClick={() =>
              router.push(`/politicians?country=${country}&branch=executive`)
            }
          />
          <BranchCard
            title="Legislative"
            subtitle={isCA ? "Parliament" : isUS ? "Congress" : "Legislature"}
            icon={
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
              </svg>
            }
            active={activeBranches.includes("legislative")}
            onClick={() =>
              router.push(`/politicians?country=${country}&branch=legislative`)
            }
          />
        </div>
      </div>
    );
  }

  // Step 2.5: Chamber selection (legislative only, if chambers exist)
  if (branch === "legislative" && !chamber && activeChambers.length > 0) {
    return (
      <div>
        <h2 className="text-lg font-headline text-brand-charcoal mb-4">
          <span className="text-2xl mr-2">{countryInfo?.flag}</span>
          {countryInfo?.name} Legislative &mdash; Select Chamber
        </h2>
        <div className="grid gap-4 grid-cols-2 max-w-lg">
          <BranchCard
            title={isUS ? "Senate" : "Upper House"}
            subtitle={isUS ? "100 members" : ""}
            icon={
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            }
            active={activeChambers.includes("senate")}
            onClick={() =>
              router.push(
                `/politicians?country=${country}&branch=legislative&chamber=senate`
              )
            }
          />
          <BranchCard
            title={isUS ? "House of Representatives" : "Lower House"}
            subtitle={isUS ? "435 members" : ""}
            icon={
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            }
            active={activeChambers.includes("house")}
            onClick={() =>
              router.push(
                `/politicians?country=${country}&branch=legislative&chamber=house`
              )
            }
          />
        </div>
      </div>
    );
  }

  return null;
}

function BranchCard({
  title,
  subtitle,
  icon,
  active,
  onClick,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!active}
      className={`group flex flex-col items-center gap-3 rounded-lg border-2 p-6 sm:p-8 transition-all duration-200 ${
        active
          ? "border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-brand-red/30 hover:-translate-y-0.5 cursor-pointer"
          : "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
      }`}
    >
      <div className="text-brand-charcoal">{icon}</div>
      <div className="text-center">
        <p className="text-sm sm:text-base font-semibold text-brand-charcoal">
          {title}
        </p>
        {subtitle && (
          <p className="text-xs text-slate mt-0.5">{subtitle}</p>
        )}
      </div>
      {!active && <span className="text-xs text-slate">No data yet</span>}
    </button>
  );
}
