-- AlterTable
ALTER TABLE "knowledge_base_articles"
ADD COLUMN "summary" TEXT,
ADD COLUMN "lastSummarizedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "knowledge_base_articles_lastSummarizedAt_idx" ON "knowledge_base_articles"("lastSummarizedAt");
