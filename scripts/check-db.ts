import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const pols = await p.politician.findMany({ select: { name: true, country: true, congressId: true, branch: true, chamber: true } });
  console.log("Politicians:", JSON.stringify(pols, null, 2));
}
main().catch(console.error).finally(() => p.$disconnect());
