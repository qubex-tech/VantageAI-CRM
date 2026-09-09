-- CreateTable
CREATE TABLE IF NOT EXISTS "apidaze_integrations" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "fromNumber" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "apidaze_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "apidaze_integrations_practiceId_key" ON "apidaze_integrations"("practiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "apidaze_integrations_practiceId_idx" ON "apidaze_integrations"("practiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "apidaze_integrations_fromNumber_idx" ON "apidaze_integrations"("fromNumber");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'apidaze_integrations_practiceId_fkey'
    ) THEN
        ALTER TABLE "apidaze_integrations" ADD CONSTRAINT "apidaze_integrations_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
