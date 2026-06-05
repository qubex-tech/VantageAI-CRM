-- CreateTable
CREATE TABLE IF NOT EXISTS "telnyx_integrations" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "fromNumber" TEXT NOT NULL,
    "phoneNumberId" TEXT,
    "messagingProfileId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telnyx_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "telnyx_integrations_practiceId_key" ON "telnyx_integrations"("practiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "telnyx_integrations_practiceId_idx" ON "telnyx_integrations"("practiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "telnyx_integrations_fromNumber_idx" ON "telnyx_integrations"("fromNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "telnyx_integrations_messagingProfileId_idx" ON "telnyx_integrations"("messagingProfileId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'telnyx_integrations_practiceId_fkey'
    ) THEN
        ALTER TABLE "telnyx_integrations" ADD CONSTRAINT "telnyx_integrations_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
