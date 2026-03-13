-- AlterTable
ALTER TABLE "Politician" ADD COLUMN "fecCandidateId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Politician_fecCandidateId_key" ON "Politician"("fecCandidateId");
