import { PromiseStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { canAutoApply, isValidTransition } from "./status-rules";

interface ApplyStatusChangeInput {
  promiseId: string;
  newStatus: PromiseStatus;
  eventDate: Date;
  title: string;
  description?: string;
  sourceUrl?: string;
  createdBy: "human" | "ai_auto" | "ai_flagged";
  confidence?: "high" | "medium" | "low" | null;
}

interface ApplyStatusChangeResult {
  applied: boolean;
  flagged?: boolean;
  invalid?: boolean;
  reason?: string;
  eventId?: string;
}

/**
 * Central function for ALL status changes (human or AI).
 * Enforces transition rules, creates PromiseEvent + backward-compat PromiseStatusChange.
 */
export async function applyStatusChange(
  input: ApplyStatusChangeInput,
): Promise<ApplyStatusChangeResult> {
  const promise = await prisma.promise.findUnique({
    where: { id: input.promiseId },
    select: { id: true, status: true },
  });

  if (!promise) {
    return { applied: false, invalid: true, reason: "Promise not found" };
  }

  const oldStatus = promise.status;
  const newStatus = input.newStatus;

  // Human-initiated changes can force any valid transition
  if (input.createdBy === "human") {
    if (!isValidTransition(oldStatus, newStatus)) {
      return {
        applied: false,
        invalid: true,
        reason: `Transition ${oldStatus} → ${newStatus} is not allowed`,
      };
    }

    // Apply immediately
    const [, event] = await prisma.$transaction([
      prisma.promise.update({
        where: { id: input.promiseId },
        data: { status: newStatus },
      }),
      prisma.promiseEvent.create({
        data: {
          promiseId: input.promiseId,
          eventType: "news",
          eventDate: input.eventDate,
          oldStatus,
          newStatus,
          title: input.title,
          description: input.description,
          sourceUrl: input.sourceUrl,
          createdBy: "human",
          confidence: null,
          reviewed: true,
          approved: true,
        },
      }),
      prisma.promiseStatusChange.create({
        data: {
          promiseId: input.promiseId,
          oldStatus,
          newStatus,
          changedAt: input.eventDate,
          note: input.title,
        },
      }),
    ]);

    return { applied: true, eventId: event.id };
  }

  // AI-initiated changes go through transition rules
  const result = canAutoApply(oldStatus, newStatus, input.confidence);

  if (result.type === "invalid") {
    return { applied: false, invalid: true, reason: result.reason };
  }

  if (result.type === "flag") {
    // Create flagged event but do NOT update promise status
    const event = await prisma.promiseEvent.create({
      data: {
        promiseId: input.promiseId,
        eventType: "news",
        eventDate: input.eventDate,
        oldStatus,
        newStatus,
        title: input.title,
        description: input.description,
        sourceUrl: input.sourceUrl,
        createdBy: "ai_flagged",
        confidence: input.confidence,
        reviewed: false,
        approved: false,
      },
    });

    return {
      applied: false,
      flagged: true,
      reason: result.reason,
      eventId: event.id,
    };
  }

  // Auto-apply
  const reviewed = result.markReviewed;
  const [, event] = await prisma.$transaction([
    prisma.promise.update({
      where: { id: input.promiseId },
      data: {
        status: newStatus,
        lastMonitoredAt: new Date(),
      },
    }),
    prisma.promiseEvent.create({
      data: {
        promiseId: input.promiseId,
        eventType: "news",
        eventDate: input.eventDate,
        oldStatus,
        newStatus,
        title: input.title,
        description: input.description,
        sourceUrl: input.sourceUrl,
        createdBy: "ai_auto",
        confidence: input.confidence,
        reviewed,
        approved: true,
      },
    }),
    prisma.promiseStatusChange.create({
      data: {
        promiseId: input.promiseId,
        oldStatus,
        newStatus,
        changedAt: input.eventDate,
        note: input.title,
      },
    }),
  ]);

  return { applied: true, eventId: event.id };
}

/**
 * Record a non-status-change event (bill vote, executive action, news, etc.)
 */
export async function recordPromiseEvent(input: {
  promiseId: string;
  eventType: string;
  eventDate: Date;
  title: string;
  description?: string;
  details?: string;
  sourceUrl?: string;
  createdBy: "human" | "ai_auto" | "ai_flagged";
  confidence?: "high" | "medium" | "low" | null;
  reviewed?: boolean;
  approved?: boolean;
  statusChange?: string;
}): Promise<string> {
  const event = await prisma.promiseEvent.create({
    data: {
      promiseId: input.promiseId,
      eventType: input.eventType,
      eventDate: input.eventDate,
      title: input.title,
      description: input.description,
      details: input.details,
      sourceUrl: input.sourceUrl,
      statusChange: input.statusChange,
      createdBy: input.createdBy,
      confidence: input.confidence,
      reviewed: input.reviewed ?? false,
      approved: input.approved ?? true,
    },
  });
  return event.id;
}
