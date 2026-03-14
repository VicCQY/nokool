-- CreateTable
CREATE TABLE "PromiseBillLink" (
    "id" TEXT NOT NULL,
    "promiseId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "relevance" TEXT NOT NULL DEFAULT 'auto',
    "alignment" TEXT NOT NULL DEFAULT 'supports',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromiseBillLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromiseBillLink_promiseId_idx" ON "PromiseBillLink"("promiseId");

-- CreateIndex
CREATE INDEX "PromiseBillLink_billId_idx" ON "PromiseBillLink"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "PromiseBillLink_promiseId_billId_key" ON "PromiseBillLink"("promiseId", "billId");

-- AddForeignKey
ALTER TABLE "PromiseBillLink" ADD CONSTRAINT "PromiseBillLink_promiseId_fkey" FOREIGN KEY ("promiseId") REFERENCES "Promise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromiseBillLink" ADD CONSTRAINT "PromiseBillLink_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
