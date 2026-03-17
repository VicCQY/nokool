/**
 * Migration script: Convert existing PromiseStatusChange, PromiseBillLink,
 * and PromiseActionLink records into PromiseEvent records.
 *
 * Run with: npx tsx scripts/migrate-to-promise-events.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting migration to PromiseEvent records...\n");

  // Check if migration already ran (avoid duplicates)
  const existingEvents = await prisma.promiseEvent.count();
  if (existingEvents > 0) {
    console.log(`Found ${existingEvents} existing PromiseEvent records.`);
    console.log("Migration appears to have already run. Skipping to avoid duplicates.");
    console.log("If you want to re-run, delete all PromiseEvent records first.");
    return;
  }

  let totalCreated = 0;

  // 1. Create "promise_made" events for all existing promises
  console.log("1. Creating promise_made events...");
  const promises = await prisma.promise.findMany({
    select: { id: true, title: true, dateMade: true, sourceUrl: true },
  });

  for (const p of promises) {
    await prisma.promiseEvent.create({
      data: {
        promiseId: p.id,
        eventType: "promise_made",
        eventDate: p.dateMade,
        title: `Promise made: ${p.title}`,
        sourceUrl: p.sourceUrl,
        createdBy: "human",
        confidence: null,
        reviewed: true,
        approved: true,
      },
    });
    totalCreated++;
  }
  console.log(`   Created ${promises.length} promise_made events`);

  // 2. Convert PromiseStatusChange records
  console.log("2. Converting PromiseStatusChange records...");
  const statusChanges = await prisma.promiseStatusChange.findMany({
    include: { promise: { select: { title: true } } },
  });

  let scCount = 0;
  for (const sc of statusChanges) {
    // Skip the initial creation records (oldStatus is null)
    if (sc.oldStatus === null) continue;

    await prisma.promiseEvent.create({
      data: {
        promiseId: sc.promiseId,
        eventType: "status_change",
        eventDate: sc.changedAt,
        oldStatus: sc.oldStatus,
        newStatus: sc.newStatus,
        title: sc.note || `Status changed: ${sc.oldStatus} → ${sc.newStatus}`,
        description: sc.note,
        createdBy: "human",
        confidence: null,
        reviewed: true,
        approved: true,
      },
    });
    scCount++;
    totalCreated++;
  }
  console.log(`   Converted ${scCount} status change records (skipped ${statusChanges.length - scCount} initial creation records)`);

  // 3. Convert PromiseBillLinks
  console.log("3. Converting PromiseBillLink records...");
  const billLinks = await prisma.promiseBillLink.findMany({
    include: {
      bill: { select: { title: true, billNumber: true, dateVoted: true } },
      promise: {
        select: {
          politicianId: true,
        },
      },
    },
  });

  for (const link of billLinks) {
    // Try to find the vote position for this politician + bill
    const vote = await prisma.vote.findUnique({
      where: {
        politicianId_billId: {
          politicianId: link.promise.politicianId,
          billId: link.billId,
        },
      },
      select: { position: true },
    });

    const voteStr = vote ? ` (Voted ${vote.position})` : "";
    const alignStr = link.alignment === "aligns" ? "aligns with" : "contradicts";

    await prisma.promiseEvent.create({
      data: {
        promiseId: link.promiseId,
        eventType: "bill_vote",
        eventDate: link.bill.dateVoted,
        title: `${link.bill.billNumber}: ${link.bill.title}${voteStr} — ${alignStr} promise`,
        createdBy: link.relevance === "auto" ? "ai_auto" : "human",
        confidence: link.relevance === "auto" ? "medium" : null,
        reviewed: link.relevance !== "auto",
        approved: true,
      },
    });
    totalCreated++;
  }
  console.log(`   Converted ${billLinks.length} bill link records`);

  // 4. Convert PromiseActionLinks
  console.log("4. Converting PromiseActionLink records...");
  const actionLinks = await prisma.promiseActionLink.findMany({
    include: {
      action: { select: { title: true, type: true, dateIssued: true } },
    },
  });

  for (const link of actionLinks) {
    const alignStr = link.alignment === "supports" ? "supports" : "contradicts";
    await prisma.promiseEvent.create({
      data: {
        promiseId: link.promiseId,
        eventType: "executive_action",
        eventDate: link.action.dateIssued,
        title: `${link.action.type}: ${link.action.title} — ${alignStr} promise`,
        createdBy: "human",
        confidence: null,
        reviewed: true,
        approved: true,
      },
    });
    totalCreated++;
  }
  console.log(`   Converted ${actionLinks.length} action link records`);

  console.log(`\nMigration complete! Created ${totalCreated} PromiseEvent records total.`);
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
