const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // Step 1: Add new enum values to existing PostgreSQL PromiseStatus type
  const newValues = ["KEPT", "FIGHTING", "STALLED", "NOTHING", "BROKE"];
  for (const v of newValues) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TYPE "PromiseStatus" ADD VALUE IF NOT EXISTS '${v}'`);
      console.log("Added enum value: " + v);
    } catch (e) {
      console.log("Value " + v + " exists or error: " + e.message);
    }
  }

  // Step 2: Migrate Promise.status data
  const mapping = {
    FULFILLED: "KEPT",
    PARTIAL: "FIGHTING",
    ADVANCING: "FIGHTING",
    IN_PROGRESS: "FIGHTING",
    MINIMAL_EFFORT: "STALLED",
    NOT_STARTED: "NOTHING",
    BROKEN: "BROKE",
    REVERSED: "BROKE",
  };

  for (const [old, newStatus] of Object.entries(mapping)) {
    try {
      const result = await prisma.$executeRawUnsafe(
        `UPDATE "Promise" SET status = '${newStatus}'::"PromiseStatus" WHERE status = '${old}'::"PromiseStatus"`
      );
      if (result > 0) console.log(`Promise.status: ${old} -> ${newStatus}: ${result} rows`);
    } catch (e) {
      console.log("Error mapping " + old + ": " + e.message);
    }
  }

  // Step 3: Migrate Promise.statusOverride
  for (const [old, newStatus] of Object.entries(mapping)) {
    try {
      const result = await prisma.$executeRawUnsafe(
        `UPDATE "Promise" SET "statusOverride" = '${newStatus}'::"PromiseStatus" WHERE "statusOverride" = '${old}'::"PromiseStatus"`
      );
      if (result > 0) console.log(`Promise.statusOverride: ${old} -> ${newStatus}: ${result} rows`);
    } catch (e) {}
  }

  // Step 4: Migrate PromiseStatusChange (oldStatus and newStatus are PromiseStatus enum)
  for (const [old, newStatus] of Object.entries(mapping)) {
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "PromiseStatusChange" SET "newStatus" = '${newStatus}'::"PromiseStatus" WHERE "newStatus" = '${old}'::"PromiseStatus"`
      );
      await prisma.$executeRawUnsafe(
        `UPDATE "PromiseStatusChange" SET "oldStatus" = '${newStatus}'::"PromiseStatus" WHERE "oldStatus" = '${old}'::"PromiseStatus"`
      );
    } catch (e) {}
  }

  // Step 5: Migrate PromiseEvent oldStatus/newStatus (these are String?, not enum)
  for (const [old, newStatus] of Object.entries(mapping)) {
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "PromiseEvent" SET "newStatus" = '${newStatus}' WHERE "newStatus" = '${old}'`
      );
      await prisma.$executeRawUnsafe(
        `UPDATE "PromiseEvent" SET "oldStatus" = '${newStatus}' WHERE "oldStatus" = '${old}'`
      );
    } catch (e) {}
  }

  console.log("\nMigration complete");

  // Print final distribution
  const promises = await prisma.promise.findMany({ select: { status: true } });
  const dist = {};
  for (const p of promises) {
    dist[p.status] = (dist[p.status] || 0) + 1;
  }
  console.log("Final distribution:", dist);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
