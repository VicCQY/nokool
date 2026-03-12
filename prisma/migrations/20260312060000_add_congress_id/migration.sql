-- AlterTable
ALTER TABLE "Politician" ADD COLUMN "congressId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Politician_congressId_key" ON "Politician"("congressId");
