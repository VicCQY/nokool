-- CreateEnum
CREATE TYPE "VotePosition" AS ENUM ('YEA', 'NAY', 'ABSTAIN', 'ABSENT');

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "billNumber" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "country" "Country" NOT NULL,
    "session" TEXT NOT NULL,
    "dateVoted" TIMESTAMP(3) NOT NULL,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "politicianId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "position" "VotePosition" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vote_politicianId_billId_key" ON "Vote"("politicianId", "billId");

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
