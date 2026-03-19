const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
p.promise.findMany({ select: { status: true } }).then(r => {
  const d = {};
  r.forEach(x => d[x.status] = (d[x.status] || 0) + 1);
  console.log("Status distribution:", d);
  p.$disconnect();
});
