import { prisma } from "./prisma";
import { callPerplexity, parseJsonFromResponse } from "./perplexity-api";
import { sanitizeSourceUrl, validateSource } from "./source-validator";
import { applyStatusChange } from "./promise-updates";
import { PromiseStatus } from "@prisma/client";

const MODEL_MONITOR = "sonar"; // cheaper model for monitoring

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

  // Fetch eligible promises
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
    select: { id: true, title: true, description: true, status: true, dateMade: true },
    orderBy: { dateMade: "desc" },
  });

  if (promises.length === 0) {
    return { checked: 0, changed: 0, autoApplied: 0, flagged: 0 };
  }

  const promiseList = promises
    .map((p, i) => `${i + 1}. [${p.status}] "${p.title}": ${p.description.slice(0, 80)}`)
    .join("\n");

  const systemPrompt = `You are a political fact-checker. For each active campaign promise, check if there have been any developments in the last 30 days. Only report CHANGES — if nothing happened, say so.

For each promise, return:
{ "title": "exact title", "changed": true/false, "suggestedStatus": "STATUS", "eventDate": "YYYY-MM-DD", "reason": "what happened", "sourceUrl": "proof URL", "confidence": "high/medium/low" }

If nothing changed, just return { "title": "exact title", "changed": false }

NEVER use wikipedia.org as a source URL.
eventDate must be the date of the ACTUAL EVENT, not today.
Status options: FULFILLED, PARTIAL, IN_PROGRESS, NOT_STARTED, BROKEN, REVERSED

Return ONLY a JSON array.`;

  const userPrompt = `Check these active campaign promises by ${politician.name} (${politician.party}) for any developments in the last 30 days:

${promiseList}

Return a JSON array. For unchanged promises, just { "title": "...", "changed": false }.`;

  const text = await callPerplexity(systemPrompt, userPrompt, MODEL_MONITOR);
  const parsed = parseJsonFromResponse(text);

  if (!Array.isArray(parsed)) {
    // Update lastMonitoredAt even on parse failure
    await prisma.promise.updateMany({
      where: { id: { in: promises.map((p) => p.id) } },
      data: { lastMonitoredAt: new Date() },
    });
    return { checked: promises.length, changed: 0, autoApplied: 0, flagged: 0 };
  }

  const VALID = ["NOT_STARTED", "IN_PROGRESS", "FULFILLED", "PARTIAL", "BROKEN", "REVERSED"];
  const VALID_CONFIDENCE = ["high", "medium", "low"];
  const now = new Date();
  let changed = 0;
  let autoApplied = 0;
  let flagged = 0;

  for (const item of parsed) {
    if (!item || item.changed !== true) continue;

    const promise = promises.find((p) => p.title === String(item.title))
      || promises[parsed.indexOf(item)];
    if (!promise) continue;

    const suggestedStatus = VALID.includes(String(item.suggestedStatus))
      ? String(item.suggestedStatus)
      : null;
    if (!suggestedStatus || suggestedStatus === promise.status) continue;

    // Source validation
    const rawUrl = String(item.sourceUrl || "");
    const sourceUrl = sanitizeSourceUrl(rawUrl, promise.title);

    // Confidence
    let confidence = String(item.confidence || "low").toLowerCase();
    if (!VALID_CONFIDENCE.includes(confidence)) confidence = "low";
    const srcVal = validateSource(sourceUrl);
    if (!sourceUrl || !srcVal.valid) confidence = "low";
    else if (srcVal.trusted === false && confidence === "high") confidence = "medium";

    // Date validation
    let eventDate = String(item.eventDate || "");
    const eventDateObj = new Date(eventDate);
    if (!eventDate || isNaN(eventDateObj.getTime()) || eventDateObj > now) {
      eventDate = now.toISOString().split("T")[0];
      confidence = "low";
    }

    const result = await applyStatusChange({
      promiseId: promise.id,
      newStatus: suggestedStatus as PromiseStatus,
      eventDate: new Date(eventDate),
      title: String(item.reason || `Status update: ${promise.status} → ${suggestedStatus}`),
      sourceUrl: sourceUrl || undefined,
      createdBy: confidence === "low" ? "ai_flagged" : "ai_auto",
      confidence: confidence as "high" | "medium" | "low",
    });

    changed++;
    if (result.applied) autoApplied++;
    if (result.flagged) flagged++;
  }

  // Update lastMonitoredAt for all checked promises
  await prisma.promise.updateMany({
    where: { id: { in: promises.map((p) => p.id) } },
    data: { lastMonitoredAt: new Date() },
  });

  return { checked: promises.length, changed, autoApplied, flagged };
}
