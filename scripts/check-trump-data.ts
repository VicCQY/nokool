import * as fs from "fs";
const envFile = fs.readFileSync(".env", "utf-8");
for (const line of envFile.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx);
  let val = trimmed.slice(eqIdx + 1);
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
    val = val.slice(1, -1);
  process.env[key] = val;
}

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const trump = await prisma.politician.findFirst({
    where: { name: { contains: "Trump" } },
    select: { id: true, name: true, termStart: true, termEnd: true },
  });
  if (!trump) { console.log("Not found"); return; }
  console.log(`${trump.name} | termStart: ${trump.termStart.toISOString().slice(0,10)} | termEnd: ${trump.termEnd?.toISOString().slice(0,10) ?? "null"}`);

  const promises = await prisma.promise.findMany({
    where: { politicianId: trump.id },
    select: { id: true, title: true, status: true, dateMade: true },
    orderBy: { dateMade: "asc" },
  });
  console.log(`\n${promises.length} promises:`);
  for (const pr of promises) {
    console.log(`  ${pr.dateMade.toISOString().slice(0,10)} ${pr.status.padEnd(12)} ${pr.title.slice(0,55)}`);
  }

  const changes = await prisma.promiseStatusChange.findMany({
    where: { promise: { politicianId: trump.id } },
    select: { changedAt: true, oldStatus: true, newStatus: true, promise: { select: { title: true } } },
    orderBy: { changedAt: "asc" },
  });
  console.log(`\n${changes.length} status changes:`);
  for (const c of changes) {
    console.log(`  ${c.changedAt.toISOString().slice(0,10)} ${(c.oldStatus||"(initial)").padEnd(12)} -> ${c.newStatus.padEnd(12)} ${c.promise.title.slice(0,40)}`);
  }

  // Compute what the timeline ranges would look like
  const now = new Date();
  const earliest = promises.reduce((min, p) => p.dateMade < min ? p.dateMade : min, promises[0].dateMade);
  console.log(`\nDate range for "All": ${earliest.toISOString().slice(0,10)} to ${now.toISOString().slice(0,10)}`);
  console.log(`Total days: ${Math.round((now.getTime() - earliest.getTime()) / 86400000)}`);

  // All dates as % of total range
  const totalMs = now.getTime() - earliest.getTime();
  console.log(`\nPromise date positions (% of All range):`);
  for (const pr of promises) {
    const pct = ((pr.dateMade.getTime() - earliest.getTime()) / totalMs * 100).toFixed(1);
    console.log(`  ${pct}% | ${pr.dateMade.toISOString().slice(0,10)} | ${pr.title.slice(0,40)}`);
  }

  await prisma.$disconnect();
}
main().catch(console.error);
