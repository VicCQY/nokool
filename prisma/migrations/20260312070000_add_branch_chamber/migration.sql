-- AlterTable
ALTER TABLE "Politician" ADD COLUMN "branch" TEXT NOT NULL DEFAULT 'executive';
ALTER TABLE "Politician" ADD COLUMN "chamber" TEXT;
