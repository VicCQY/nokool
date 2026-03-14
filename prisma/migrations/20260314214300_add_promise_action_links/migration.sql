-- CreateTable
CREATE TABLE "PromiseActionLink" (
    "id" TEXT NOT NULL,
    "promiseId" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "alignment" TEXT NOT NULL DEFAULT 'supports',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromiseActionLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromiseActionLink_promiseId_idx" ON "PromiseActionLink"("promiseId");

-- CreateIndex
CREATE INDEX "PromiseActionLink_actionId_idx" ON "PromiseActionLink"("actionId");

-- CreateIndex
CREATE UNIQUE INDEX "PromiseActionLink_promiseId_actionId_key" ON "PromiseActionLink"("promiseId", "actionId");

-- AddForeignKey
ALTER TABLE "PromiseActionLink" ADD CONSTRAINT "PromiseActionLink_promiseId_fkey" FOREIGN KEY ("promiseId") REFERENCES "Promise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromiseActionLink" ADD CONSTRAINT "PromiseActionLink_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ExecutiveAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
