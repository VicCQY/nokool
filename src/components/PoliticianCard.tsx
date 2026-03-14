"use client";

import Link from "next/link";
import { KoolAidMeter } from "./KoolAidMeter";

const GRADE_COLORS: Record<string, string> = {
  A: "bg-grade-A text-white",
  B: "bg-grade-B text-white",
  C: "bg-grade-C text-white",
  D: "bg-grade-D text-white",
  F: "bg-grade-F text-white",
  "N/A": "bg-gray-300 text-gray-600",
};

const GRADE_BAR_COLORS: Record<string, string> = {
  A: "bg-grade-A",
  B: "bg-grade-B",
  C: "bg-grade-C",
  D: "bg-grade-D",
  F: "bg-grade-F",
  "N/A": "bg-gray-300",
};

const PARTY_BORDER_COLORS: Record<string, string> = {
  Democrat: "border-l-[#2563EB]",
  Republican: "border-l-brand-red",
  Independent: "border-l-[#8B5CF6]",
};

interface Props {
  id: string;
  name: string;
  party: string;
  photoUrl: string | null;
  termStartStr: string;
  termEndStr: string | null;
  grade: string;
  percentage: number;
  promiseCount: number;
}

export function PoliticianCard({
  id,
  name,
  party,
  photoUrl,
  termStartStr,
  termEndStr,
  grade,
  percentage,
  promiseCount,
}: Props) {
  const partyBorder = PARTY_BORDER_COLORS[party] || "border-l-gray-300";

  return (
    <Link
      href={`/politician/${id}`}
      className={`group block rounded-lg border border-gray-200 border-l-4 ${partyBorder} bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
    >
      <div className="flex items-start gap-4">
        {/* Photo */}
        <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-full bg-cool-gray ring-2 ring-gray-100">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-gray-400">
              {name[0]}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-headline text-brand-charcoal truncate group-hover:text-[#2563EB] transition-colors">
            {name}
          </h3>
          <p className="text-sm text-slate mt-0.5">{party}</p>
          <p className="text-xs font-data text-gray-400 mt-1">
            {new Date(termStartStr).toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            })}
            {" - "}
            {termEndStr
              ? new Date(termEndStr).toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                })
              : "Present"}
          </p>
        </div>

        {/* Grade + Kool-Aid Meter */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-lg font-data font-bold ${GRADE_COLORS[grade] ?? GRADE_COLORS["N/A"]}`}
          >
            {grade}
          </span>
          <KoolAidMeter size="sm" fulfillmentPercent={percentage} />
        </div>
      </div>

      {/* Progress bar + promise count */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-slate font-data">
            {promiseCount} promise{promiseCount !== 1 ? "s" : ""}
          </span>
          <span className="font-data font-medium text-brand-charcoal">{percentage}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-cool-gray overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${GRADE_BAR_COLORS[grade] ?? GRADE_BAR_COLORS["N/A"]}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </Link>
  );
}
