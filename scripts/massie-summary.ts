import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const votes = await prisma.vote.findMany({
    where: { politician: { congressId: "M001184" } },
    include: { bill: { select: { billNumber: true, title: true, category: true, dateVoted: true } } },
    orderBy: { bill: { dateVoted: "desc" } },
  });

  console.log(`\n=== Thomas Massie — ${votes.length} Voting Records ===\n`);

  const positionCounts: Record<string, number> = { YEA: 0, NAY: 0, ABSENT: 0, ABSTAIN: 0 };

  for (const v of votes) {
    positionCounts[v.position]++;
    const date = v.bill.dateVoted.toISOString().slice(0, 10);
    console.log(`  ${v.position.padEnd(7)} | ${v.bill.billNumber.padEnd(12)} | ${date} | ${v.bill.category.padEnd(14)} | ${v.bill.title.slice(0, 55)}`);
  }

  console.log(`\n--- Summary ---`);
  console.log(`YEA:     ${positionCounts.YEA}`);
  console.log(`NAY:     ${positionCounts.NAY}`);
  console.log(`ABSENT:  ${positionCounts.ABSENT}`);
  console.log(`ABSTAIN: ${positionCounts.ABSTAIN}`);
  console.log(`Total:   ${votes.length}`);

  const totalBills = await prisma.bill.count();
  const totalVotes = await prisma.vote.count();
  console.log(`\nDB: ${totalBills} bills, ${totalVotes} total votes`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
