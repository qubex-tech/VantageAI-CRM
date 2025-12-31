-- CreateTable
CREATE TABLE IF NOT EXISTS "sendgrid_integrations" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sendgrid_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "sendgrid_integrations_practiceId_key" ON "sendgrid_integrations"("practiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sendgrid_integrations_practiceId_idx" ON "sendgrid_integrations"("practiceId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'sendgrid_integrations_practiceId_fkey'
    ) THEN
        ALTER TABLE "sendgrid_integrations" ADD CONSTRAINT "sendgrid_integrations_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

