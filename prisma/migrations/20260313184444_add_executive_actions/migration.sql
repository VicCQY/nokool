-- CreateEnum
CREATE TYPE "ExecutiveActionType" AS ENUM ('EXECUTIVE_ORDER', 'PRESIDENTIAL_MEMORANDUM', 'PROCLAMATION', 'BILL_SIGNED', 'BILL_VETOED', 'POLICY_DIRECTIVE');

-- CreateTable
CREATE TABLE "ExecutiveAction" (
    "id" TEXT NOT NULL,
    "politicianId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ExecutiveActionType" NOT NULL,
    "summary" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "dateIssued" TIMESTAMP(3) NOT NULL,
    "sourceUrl" TEXT,
    "relatedPromises" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecutiveAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExecutiveAction_politicianId_idx" ON "ExecutiveAction"("politicianId");

-- CreateIndex
CREATE INDEX "ExecutiveAction_type_idx" ON "ExecutiveAction"("type");

-- CreateIndex
CREATE INDEX "ExecutiveAction_category_idx" ON "ExecutiveAction"("category");

-- AddForeignKey
ALTER TABLE "ExecutiveAction" ADD CONSTRAINT "ExecutiveAction_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;
