import { prisma } from "./prisma";
import { callPerplexity, parseJsonFromResponse } from "./perplexity-api";
import { sanitizeSourceUrl, validateSource } from "./source-validator";
import { applyStatusChange, recordPromiseEvent } from "./promise-updates";
import { PromiseStatus } from "@prisma/client";

const MODEL_MONITOR = "sonar-pro";

interface MonitorResult {
  checked: number;
  changed: number;
  autoApplied: number;
  flagged: number;
}

export async function monitorPromises(politicianId: string): Promise<MonitorResult> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const politician = await prisma.politician.findUnique({
    where: { id: politicianId },
    select: { name: true, party: true },
  });
  if (!politician) throw new Error("Politician not found");

  // Fetch eligible promises with their most recent event date
  const promises = await prisma.promise.findMany({
    where: {
      politicianId,
      status: { notIn: ["FULFILLED", "BROKEN", "REVERSED"] },
      autoUpdatable: true,
      OR: [
        { lastMonitoredAt: null },
        { lastMonitoredAt: { lt: sevenDaysAgo } },
      ],
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      dateMade: true,
      events: {
        orderBy: { eventDate: "desc" },
        take: 1,
        select: { eventDate: true },
      },
    },
    orderBy: { dateMade: "desc" },
  });

  if (promises.length === 0) {
    return { checked: 0, changed: 0, autoApplied: 0, flagged: 0 };
  }

  // Build prompt with last event date per promise
  const promiseList = promises
    .map((p, i) => {
      const lastEventDate = p.events[0]?.eventDate
        ? p.events[0].eventDate.toISOString().split("T")[0]
        : p.dateMade.toISOString().split("T")[0];
      return `${i + 1}. [${p.status}] "${p.title}" (last known event: ${lastEventDate}): ${p.description.slice(0, 80)}`;
    })
    .join("\n");

  const systemPrompt = `You are a political fact-checker checking for NEW developments only. For each promise, you are given the last known status and the date of the last known event. ONLY report developments that happened AFTER that date. If nothing new happened, say so.

For each promise with new developments, return:
{
  "title": "exact promise title",
  "changed": true,
  "events": [
    {
      "date": "YYYY-MM-DD",
      "type": "status_change" | "executive_action" | "legislation" | "news",
      "title": "what happened",
      "description": "details",
      "sourceUrl": "proof URL",
      "newStatus": "STATUS" (only for status_change type, null for others)
    }
  ]
}

For promises with no new developments:
{ "title": "exact promise title", "changed": false }

NEVER use wikipedia.org as a source URL. Every date must be the REAL date of the event, never today's date.
Status options: FULFILLED, PARTIAL, IN_PROGRESS, NOT_STARTED, BROKEN, REVERSED

Return ONLY a JSON array.`;

  const userPrompt = `Check for NEW developments on these promises by ${politician.name} (${politician.party}). Only report events AFTER the date shown for each promise.

${promiseList}

Return a JSON array. For unchanged promises, just { "title": "...", "changed": false }.`;

  const text = await callPerplexity(systemPrompt, userPrompt, MODEL_MONITOR);
  const parsed = parseJsonFromResponse(text);

  if (!Array.isArray(parsed)) {
    await prisma.promise.updateMany({
      where: { id: { in: promises.map((p) => p.id) } },
      data: { lastMonitoredAt: new Date() },
    });
    return { checked: promises.length, changed: 0, autoApplied: 0, flagged: 0 };
  }

  const VALID = ["NOT_STARTED", "IN_PROGRESS", "FULFILLED", "PARTIAL", "BROKEN", "REVERSED"];
  const VALID_TYPES = ["status_change", "executive_action", "legislation", "news"];
  const now = new Date();
  let changed = 0;
  let autoApplied = 0;
  let flagged = 0;

  for (const item of parsed) {
    if (!item || item.changed !== true || !Array.isArray(item.events)) continue;

    const promise = promises.find((p) => p.title === String(item.title))
      || promises[parsed.indexOf(item)];
    if (!promise) continue;

    changed++;

    for (const evt of item.events) {
      if (!evt || typeof evt !== "object") continue;

      // Date validation
      const eventDate = String(evt.date || "");
      const eventDateObj = new Date(eventDate);
      if (!eventDate || isNaN(eventDateObj.getTime()) || eventDateObj > now) continue;

      const evtType = String(evt.type || "news");
      const type = VALID_TYPES.includes(evtType) ? evtType : "news";

      // Source validation
      const rawUrl = String(evt.sourceUrl || "");
      const sourceUrl = sanitizeSourceUrl(rawUrl, promise.title);
      const srcVal = validateSource(sourceUrl);

      // Confidence
      let confidence: "high" | "medium" | "low" = "medium";
      if (!sourceUrl || !srcVal.valid) confidence = "low";
      else if (srcVal.trusted === false) confidence = "medium";
      else if (srcVal.trusted === true) confidence = "high";

      if (type === "status_change" && evt.newStatus) {
        const newStatus = String(evt.newStatus);
        if (!VALID.includes(newStatus) || newStatus === promise.status) continue;

        const result = await applyStatusChange({
          promiseId: promise.id,
          newStatus: newStatus as PromiseStatus,
          eventDate: new Date(eventDate),
          title: String(evt.title || `Status updated to ${newStatus}`),
          description: String(evt.description || ""),
          sourceUrl: sourceUrl || undefined,
          createdBy: confidence === "low" ? "ai_flagged" : "ai_auto",
          confidence,
        });

        if (result.applied) autoApplied++;
        if (result.flagged) flagged++;
      } else {
        // Non-status events
        const eventTypeMap: Record<string, string> = {
          executive_action: "executive_action",
          legislation: "bill_vote",
          news: "news",
        };
        await recordPromiseEvent({
          promiseId: promise.id,
          eventType: eventTypeMap[type] || "news",
          eventDate: new Date(eventDate),
          title: String(evt.title || ""),
          description: String(evt.description || ""),
          sourceUrl: sourceUrl || undefined,
          createdBy: confidence === "low" ? "ai_flagged" : "ai_auto",
          confidence,
          reviewed: false,
          approved: true,
        });
      }
    }
  }

  // Update lastMonitoredAt
  await prisma.promise.updateMany({
    where: { id: { in: promises.map((p) => p.id) } },
    data: { lastMonitoredAt: new Date() },
  });

  return { checked: promises.length, changed, autoApplied, flagged };
}
