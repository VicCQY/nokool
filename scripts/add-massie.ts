import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Upsert Thomas Massie
  const massie = await prisma.politician.upsert({
    where: { congressId: "M001184" },
    update: {
      name: "Thomas Massie",
      party: "Republican",
      branch: "legislative",
      chamber: "house",
    },
    create: {
      name: "Thomas Massie",
      country: "US",
      party: "Republican",
      photoUrl: "",
      termStart: new Date("2012-11-06"),
      termEnd: null,
      congressId: "M001184",
      branch: "legislative",
      chamber: "house",
    },
  });
  console.log(`✓ Thomas Massie: id=${massie.id}, congressId=${massie.congressId}`);

  // Upsert Donald Trump
  const trump = await prisma.politician.upsert({
    where: { congressId: "trump-executive" },
    update: {
      name: "Donald Trump",
      party: "Republican",
      branch: "executive",
    },
    create: {
      name: "Donald Trump",
      country: "US",
      party: "Republican",
      photoUrl: "",
      termStart: new Date("2025-01-20"),
      termEnd: null,
      congressId: "trump-executive",
      branch: "executive",
      chamber: null,
    },
  });
  console.log(`✓ Donald Trump: id=${trump.id}`);

  // Verify
  const count = await prisma.politician.count();
  console.log(`\nTotal politicians in database: ${count}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
