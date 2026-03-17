import { PromiseStatus } from "@prisma/client";

type TransitionResult =
  | { type: "auto"; markReviewed: boolean }
  | { type: "flag"; reason: string }
  | { type: "invalid"; reason: string };

const FORWARD_TRANSITIONS: Record<PromiseStatus, PromiseStatus[]> = {
  NOT_STARTED: ["IN_PROGRESS", "PARTIAL", "FULFILLED", "BROKEN"],
  IN_PROGRESS: ["PARTIAL", "FULFILLED", "BROKEN", "REVERSED"],
  PARTIAL: ["FULFILLED", "BROKEN", "REVERSED"],
  FULFILLED: [],
  BROKEN: [],
  REVERSED: [],
};

const REGRESSION_TRANSITIONS: Record<PromiseStatus, PromiseStatus[]> = {
  NOT_STARTED: [],
  IN_PROGRESS: ["NOT_STARTED"],
  PARTIAL: ["IN_PROGRESS", "NOT_STARTED"],
  FULFILLED: ["REVERSED", "PARTIAL", "IN_PROGRESS", "NOT_STARTED"],
  BROKEN: ["REVERSED"],
  REVERSED: [],
};

/**
 * Determine whether a status transition can be auto-applied, needs flagging, or is invalid.
 */
export function canAutoApply(
  oldStatus: PromiseStatus,
  newStatus: PromiseStatus,
  confidence?: string | null,
): TransitionResult {
  // Same status — no-op
  if (oldStatus === newStatus) {
    return { type: "invalid", reason: "Status unchanged" };
  }

  // REVERSED is terminal
  if (oldStatus === "REVERSED") {
    return { type: "invalid", reason: "REVERSED is a terminal status" };
  }

  // BROKEN can only go to REVERSED
  if (oldStatus === "BROKEN" && newStatus !== "REVERSED") {
    return { type: "invalid", reason: "BROKEN can only transition to REVERSED" };
  }

  // Check forward transitions
  if (FORWARD_TRANSITIONS[oldStatus]?.includes(newStatus)) {
    if (confidence === "high" || confidence === "medium") {
      return { type: "auto", markReviewed: confidence === "high" };
    }
    // Low confidence or unspecified — still auto but mark unreviewed
    return { type: "auto", markReviewed: false };
  }

  // Check regression transitions (always require human review)
  if (REGRESSION_TRANSITIONS[oldStatus]?.includes(newStatus)) {
    return {
      type: "flag",
      reason: `${oldStatus} → ${newStatus} is a regression and requires human review`,
    };
  }

  // Anything else is invalid
  return { type: "invalid", reason: `Transition ${oldStatus} → ${newStatus} is not allowed` };
}

/**
 * Check if a transition is valid at all (forward or regression).
 * Human-initiated changes can bypass auto-apply rules but still can't make invalid transitions.
 */
export function isValidTransition(
  oldStatus: PromiseStatus,
  newStatus: PromiseStatus,
): boolean {
  if (oldStatus === newStatus) return false;
  if (oldStatus === "REVERSED") return false;
  if (oldStatus === "BROKEN" && newStatus !== "REVERSED") return false;

  return (
    FORWARD_TRANSITIONS[oldStatus]?.includes(newStatus) ||
    REGRESSION_TRANSITIONS[oldStatus]?.includes(newStatus) ||
    false
  );
}
