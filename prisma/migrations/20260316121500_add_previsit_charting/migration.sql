-- Add practice-level pre-chart template settings
ALTER TABLE "practice_settings"
  ADD COLUMN IF NOT EXISTS "healixPreChartTemplate" JSONB;

-- CreateTable
CREATE TABLE IF NOT EXISTS "pre_visit_charts" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "chartType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "templateSnapshot" JSONB NOT NULL,
    "generatedSections" JSONB NOT NULL,
    "evidenceBundle" JSONB NOT NULL,
    "generationMeta" JSONB,
    "healixConversationId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pre_visit_charts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pre_visit_charts_practiceId_idx" ON "pre_visit_charts"("practiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pre_visit_charts_patientId_idx" ON "pre_visit_charts"("patientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pre_visit_charts_updatedAt_idx" ON "pre_visit_charts"("updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pre_visit_charts_chartType_idx" ON "pre_visit_charts"("chartType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pre_visit_charts_status_idx" ON "pre_visit_charts"("status");

-- AddForeignKey
ALTER TABLE "pre_visit_charts"
  ADD CONSTRAINT "pre_visit_charts_practiceId_fkey"
  FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_visit_charts"
  ADD CONSTRAINT "pre_visit_charts_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_visit_charts"
  ADD CONSTRAINT "pre_visit_charts_healixConversationId_fkey"
  FOREIGN KEY ("healixConversationId") REFERENCES "healix_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_visit_charts"
  ADD CONSTRAINT "pre_visit_charts_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
