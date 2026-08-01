-- CreateTable
CREATE TABLE IF NOT EXISTS "pebble_integrations" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "webhookSecret" TEXT,
    "providerUserId" TEXT,
    "activeSessionId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pebble_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "pebble_integrations_practiceId_key" ON "pebble_integrations"("practiceId");
CREATE INDEX IF NOT EXISTS "pebble_integrations_practiceId_idx" ON "pebble_integrations"("practiceId");
CREATE INDEX IF NOT EXISTS "pebble_integrations_providerUserId_idx" ON "pebble_integrations"("providerUserId");
CREATE INDEX IF NOT EXISTS "pebble_integrations_activeSessionId_idx" ON "pebble_integrations"("activeSessionId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "pebble_integrations" ADD CONSTRAINT "pebble_integrations_practiceId_fkey"
    FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "pebble_integrations" ADD CONSTRAINT "pebble_integrations_providerUserId_fkey"
    FOREIGN KEY ("providerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
