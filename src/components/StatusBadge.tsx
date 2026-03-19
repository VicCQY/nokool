"use client";

import { PromiseStatus } from "@prisma/client";

const STATUS_CONFIG: Record<
  PromiseStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  KEPT: { label: "Kept", bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  FIGHTING: { label: "Fighting", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  STALLED: { label: "Stalled", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  NOTHING: { label: "Nothing", bg: "bg-gray-50", text: "text-gray-600", dot: "bg-gray-400" },
  BROKE: { label: "Broke", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
};

export function StatusBadge({ status }: { status: PromiseStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
