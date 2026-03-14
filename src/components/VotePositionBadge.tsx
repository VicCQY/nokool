"use client";

import { VotePosition } from "@prisma/client";

const VOTE_STAMP_CONFIG: Record<
  VotePosition,
  { label: string; border: string; text: string; bg: string }
> = {
  YEA: {
    label: "Yea",
    border: "border-green-600",
    text: "text-green-700",
    bg: "bg-green-50",
  },
  NAY: {
    label: "Nay",
    border: "border-red-600",
    text: "text-red-700",
    bg: "bg-red-50",
  },
  ABSTAIN: {
    label: "Abstain",
    border: "border-amber-500",
    text: "text-amber-700",
    bg: "bg-amber-50",
  },
  ABSENT: {
    label: "Absent",
    border: "border-gray-400",
    text: "text-gray-500",
    bg: "bg-gray-50",
  },
};

export function VotePositionBadge({ position }: { position: VotePosition }) {
  const config = VOTE_STAMP_CONFIG[position];
  return (
    <span
      className={`inline-flex items-center uppercase font-bold tracking-wider text-[11px] px-2 py-0.5 border-2 border-dashed ${config.border} ${config.text} ${config.bg}`}
      style={{ transform: "rotate(-2deg)" }}
    >
      {config.label}
    </span>
  );
}
