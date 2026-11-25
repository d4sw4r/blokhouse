-- AlterTable
ALTER TABLE "ConfigurationItem" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "source" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ConfigurationItem_source_externalId_key" ON "ConfigurationItem"("source", "externalId");

