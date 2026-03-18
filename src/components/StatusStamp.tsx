"use client";

import { PromiseStatus } from "@prisma/client";

const STATUS_STAMP_CONFIG: Record<
  PromiseStatus,
  { label: string; border: string; text: string; bg: string }
> = {
  FULFILLED: {
    label: "Fulfilled",
    border: "border-green-600",
    text: "text-green-700",
    bg: "bg-green-50",
  },
  PARTIAL: {
    label: "Partial",
    border: "border-amber-500",
    text: "text-amber-700",
    bg: "bg-amber-50",
  },
  ADVANCING: {
    label: "Advancing",
    border: "border-teal-500",
    text: "text-teal-700",
    bg: "bg-teal-50",
  },
  IN_PROGRESS: {
    label: "In Progress",
    border: "border-blue-500",
    text: "text-blue-700",
    bg: "bg-blue-50",
  },
  MINIMAL_EFFORT: {
    label: "Minimal",
    border: "border-gray-400",
    text: "text-gray-500",
    bg: "bg-gray-100",
  },
  NOT_STARTED: {
    label: "Not Started",
    border: "border-gray-400",
    text: "text-gray-500",
    bg: "bg-gray-50",
  },
  BROKEN: {
    label: "Broken",
    border: "border-red-600",
    text: "text-red-700",
    bg: "bg-red-50",
  },
  REVERSED: {
    label: "Reversed",
    border: "border-orange-500",
    text: "text-orange-700",
    bg: "bg-orange-50",
  },
};

// Deterministic rotation based on string hash so it's stable across renders
function getRotation(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  // Range: -3 to -1 degrees
  return -1 - (Math.abs(hash) % 3);
}

const SIZE_CLASSES = {
  sm: "px-1.5 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-xs",
  lg: "px-3.5 py-1.5 text-sm",
};

export function StatusStamp({
  status,
  size = "md",
  id = "",
}: {
  status: PromiseStatus;
  size?: "sm" | "md" | "lg";
  id?: string;
}) {
  const config = STATUS_STAMP_CONFIG[status];
  const rotation = getRotation(status + id);
  const isBroken = status === "BROKEN";

  return (
    <span
      className={`inline-flex items-center uppercase font-bold tracking-wider border-2 ${
        isBroken ? "border-double border-[3px]" : "border-dashed"
      } ${config.border} ${config.text} ${config.bg} ${SIZE_CLASSES[size]}`}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      {config.label}
    </span>
  );
}
