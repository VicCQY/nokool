-- CreateIndex
CREATE UNIQUE INDEX "Bill_billNumber_country_key" ON "Bill"("billNumber", "country");
