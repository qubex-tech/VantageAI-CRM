-- Vantage-owned calendar blocks / meetings (overlay for slot-fill; not written to EHR/Cal)
CREATE TABLE IF NOT EXISTS "calendar_blocks" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "providerId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "recurrenceFrequency" TEXT NOT NULL DEFAULT 'none',
    "recurrenceInterval" INTEGER NOT NULL DEFAULT 1,
    "recurrenceByDay" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recurrenceUntil" TIMESTAMP(3),
    "recurrenceCount" INTEGER,
    "exceptionDates" TIMESTAMP(3)[] DEFAULT ARRAY[]::TIMESTAMP(3)[],
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_blocks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "calendar_blocks_practiceId_startTime_idx"
ON "calendar_blocks"("practiceId", "startTime");

CREATE INDEX IF NOT EXISTS "calendar_blocks_practiceId_providerId_startTime_idx"
ON "calendar_blocks"("practiceId", "providerId", "startTime");

CREATE INDEX IF NOT EXISTS "calendar_blocks_practiceId_recurrenceUntil_idx"
ON "calendar_blocks"("practiceId", "recurrenceUntil");

ALTER TABLE "calendar_blocks" ADD CONSTRAINT "calendar_blocks_practiceId_fkey"
FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "calendar_blocks" ADD CONSTRAINT "calendar_blocks_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
