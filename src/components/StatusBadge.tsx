"use client";

import { PromiseStatus } from "@prisma/client";

const STATUS_CONFIG: Record<
  PromiseStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  FULFILLED: { label: "Fulfilled", bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  PARTIAL: { label: "Partial", bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500" },
  ADVANCING: { label: "Advancing", bg: "bg-teal-50", text: "text-teal-700", dot: "bg-teal-500" },
  BROKEN: { label: "Broken", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  IN_PROGRESS: { label: "In Progress", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  NOT_STARTED: { label: "Not Started", bg: "bg-gray-50", text: "text-gray-600", dot: "bg-gray-400" },
  REVERSED: { label: "Reversed", bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500" },
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
