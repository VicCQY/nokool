"use client";

import Link from "next/link";
import { KoolAidMeter } from "./KoolAidMeter";

const GRADE_COLORS: Record<string, string> = {
  A: "bg-[#22C55E] text-white",
  B: "bg-[#3B82F6] text-white",
  C: "bg-[#F59E0B] text-white",
  D: "bg-[#F97316] text-white",
  F: "bg-[#EF4444] text-white",
  "N/A": "bg-gray-300 text-gray-600",
};

const GRADE_BAR_COLORS: Record<string, string> = {
  A: "bg-[#22C55E]",
  B: "bg-[#3B82F6]",
  C: "bg-[#F59E0B]",
  D: "bg-[#F97316]",
  F: "bg-[#EF4444]",
  "N/A": "bg-gray-300",
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
  return (
    <Link
      href={`/politician/${id}`}
      className="group block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-gray-300 hover:-translate-y-0.5"
    >
      <div className="flex items-start gap-4">
        {/* Photo */}
        <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-full bg-gray-100 ring-2 ring-gray-100">
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
          <h3 className="text-base font-bold text-[#1A1A1A] truncate group-hover:text-[#2563EB] transition-colors">
            {name}
          </h3>
          <p className="text-sm text-[#4A4A4A] mt-0.5">{party}</p>
          <p className="text-xs text-gray-400 mt-1">
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
            className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold ${GRADE_COLORS[grade] ?? GRADE_COLORS["N/A"]}`}
          >
            {grade}
          </span>
          <KoolAidMeter size="sm" fulfillmentPercent={percentage} />
        </div>
      </div>

      {/* Progress bar + promise count */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-gray-500">
            {promiseCount} promise{promiseCount !== 1 ? "s" : ""}
          </span>
          <span className="font-medium text-[#4A4A4A]">{percentage}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${GRADE_BAR_COLORS[grade] ?? GRADE_BAR_COLORS["N/A"]}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </Link>
  );
}
