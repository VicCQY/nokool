-- AlterTable
ALTER TABLE "Promise" ADD COLUMN     "weight" INTEGER NOT NULL DEFAULT 3;

-- CreateTable
CREATE TABLE "IssueWeight" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "source" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IssueWeight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IssueWeight_category_key" ON "IssueWeight"("category");
