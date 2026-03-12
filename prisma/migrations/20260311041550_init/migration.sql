-- CreateEnum
CREATE TYPE "Country" AS ENUM ('US', 'CA', 'UK', 'AU', 'FR', 'DE');

-- CreateEnum
CREATE TYPE "PromiseStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'FULFILLED', 'PARTIAL', 'BROKEN');

-- CreateTable
CREATE TABLE "Politician" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" "Country" NOT NULL,
    "party" TEXT NOT NULL,
    "photoUrl" TEXT,
    "termStart" TIMESTAMP(3) NOT NULL,
    "termEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Politician_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promise" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "dateMade" TIMESTAMP(3) NOT NULL,
    "sourceUrl" TEXT,
    "status" "PromiseStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "politicianId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromiseStatusChange" (
    "id" TEXT NOT NULL,
    "promiseId" TEXT NOT NULL,
    "oldStatus" "PromiseStatus",
    "newStatus" "PromiseStatus" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "PromiseStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Politician_country_idx" ON "Politician"("country");

-- CreateIndex
CREATE INDEX "Promise_politicianId_idx" ON "Promise"("politicianId");

-- CreateIndex
CREATE INDEX "Promise_status_idx" ON "Promise"("status");

-- CreateIndex
CREATE INDEX "Promise_category_idx" ON "Promise"("category");

-- CreateIndex
CREATE INDEX "PromiseStatusChange_promiseId_idx" ON "PromiseStatusChange"("promiseId");

-- AddForeignKey
ALTER TABLE "Promise" ADD CONSTRAINT "Promise_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromiseStatusChange" ADD CONSTRAINT "PromiseStatusChange_promiseId_fkey" FOREIGN KEY ("promiseId") REFERENCES "Promise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
