import { PromiseStatus } from "@prisma/client";

type TransitionResult =
  | { type: "auto"; markReviewed: boolean }
  | { type: "flag"; reason: string }
  | { type: "invalid"; reason: string };

const FORWARD_TRANSITIONS: Record<PromiseStatus, PromiseStatus[]> = {
  NOTHING: ["STALLED", "FIGHTING", "KEPT", "BROKE"],
  STALLED: ["FIGHTING", "KEPT", "BROKE"],
  FIGHTING: ["KEPT", "BROKE"],
  KEPT: [],
  BROKE: [],
};

const REGRESSION_TRANSITIONS: Record<PromiseStatus, PromiseStatus[]> = {
  NOTHING: [],
  STALLED: ["NOTHING"],
  FIGHTING: ["STALLED", "NOTHING"],
  KEPT: ["FIGHTING", "STALLED", "NOTHING", "BROKE"],
  BROKE: [],
};

/**
 * Determine whether a status transition can be auto-applied, needs flagging, or is invalid.
 */
export function canAutoApply(
  oldStatus: PromiseStatus,
  newStatus: PromiseStatus,
  confidence?: string | null,
): TransitionResult {
  if (oldStatus === newStatus) {
    return { type: "invalid", reason: "Status unchanged" };
  }

  // BROKE is terminal
  if (oldStatus === "BROKE") {
    return { type: "invalid", reason: "BROKE is a terminal status" };
  }

  // Check forward transitions
  if (FORWARD_TRANSITIONS[oldStatus]?.includes(newStatus)) {
    if (confidence === "high" || confidence === "medium") {
      return { type: "auto", markReviewed: confidence === "high" };
    }
    return { type: "auto", markReviewed: false };
  }

  // Check regression transitions (always require human review)
  if (REGRESSION_TRANSITIONS[oldStatus]?.includes(newStatus)) {
    return {
      type: "flag",
      reason: `${oldStatus} → ${newStatus} is a regression and requires human review`,
    };
  }

  return { type: "invalid", reason: `Transition ${oldStatus} → ${newStatus} is not allowed` };
}

/**
 * Check if a transition is valid at all (forward or regression).
 */
export function isValidTransition(
  oldStatus: PromiseStatus,
  newStatus: PromiseStatus,
): boolean {
  if (oldStatus === newStatus) return false;
  if (oldStatus === "BROKE") return false;

  return (
    FORWARD_TRANSITIONS[oldStatus]?.includes(newStatus) ||
    REGRESSION_TRANSITIONS[oldStatus]?.includes(newStatus) ||
    false
  );
}
