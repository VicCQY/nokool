"use client";

import { VotePosition } from "@prisma/client";

const VOTE_CONFIG: Record<
  VotePosition,
  { label: string; bg: string; text: string }
> = {
  YEA: { label: "Yea", bg: "bg-green-50", text: "text-green-700" },
  NAY: { label: "Nay", bg: "bg-red-50", text: "text-red-700" },
  ABSTAIN: { label: "Abstain", bg: "bg-amber-50", text: "text-amber-700" },
  ABSENT: { label: "Absent", bg: "bg-gray-100", text: "text-gray-500" },
};

export function VotePositionBadge({ position }: { position: VotePosition }) {
  const config = VOTE_CONFIG[position];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.bg} ${config.text}`}
    >
      {config.label}
    </span>
  );
}
