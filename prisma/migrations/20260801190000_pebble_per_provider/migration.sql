-- Allow multiple Index ring credentials per practice (one per provider).

-- Drop practice-wide uniqueness
DROP INDEX IF EXISTS "pebble_integrations_practiceId_key";

-- Remove rows that cannot be migrated to a provider-bound credential
DELETE FROM "pebble_integrations" WHERE "providerUserId" IS NULL;

-- Require provider ownership
ALTER TABLE "pebble_integrations" ALTER COLUMN "providerUserId" SET NOT NULL;

-- One credential per clinician within a practice
CREATE UNIQUE INDEX IF NOT EXISTS "pebble_integrations_practiceId_providerUserId_key"
  ON "pebble_integrations"("practiceId", "providerUserId");

-- Secrets must be globally unique so webhook auth maps to exactly one provider
CREATE UNIQUE INDEX IF NOT EXISTS "pebble_integrations_webhookSecret_key"
  ON "pebble_integrations"("webhookSecret");

-- Cascade delete when provider user is removed (was SET NULL)
DO $$ BEGIN
  ALTER TABLE "pebble_integrations" DROP CONSTRAINT "pebble_integrations_providerUserId_fkey";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "pebble_integrations" ADD CONSTRAINT "pebble_integrations_providerUserId_fkey"
    FOREIGN KEY ("providerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
