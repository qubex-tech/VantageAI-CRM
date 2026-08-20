-- Practice-scoped eligibility vendor settings (methods + primary clearinghouse)
CREATE TABLE IF NOT EXISTS "practice_eligibility_settings" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "primaryVendorKey" TEXT NOT NULL DEFAULT 'availity',
    "apiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "rpaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "voiceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultProviderNpi" TEXT,
    "defaultProviderTaxId" TEXT,
    "defaultProviderOrgName" TEXT,
    "defaultServiceType" TEXT NOT NULL DEFAULT '30',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practice_eligibility_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "practice_eligibility_settings_practiceId_key"
  ON "practice_eligibility_settings"("practiceId");
CREATE INDEX IF NOT EXISTS "practice_eligibility_settings_practiceId_idx"
  ON "practice_eligibility_settings"("practiceId");

DO $$ BEGIN
  ALTER TABLE "practice_eligibility_settings"
    ADD CONSTRAINT "practice_eligibility_settings_practiceId_fkey"
    FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Stedi clearinghouse credentials
CREATE TABLE IF NOT EXISTS "stedi_integrations" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "apiKeyEnc" TEXT,
    "environment" TEXT NOT NULL DEFAULT 'test',
    "apiBaseUrl" TEXT,
    "useMockResponses" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stedi_integrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "stedi_integrations_practiceId_key"
  ON "stedi_integrations"("practiceId");
CREATE INDEX IF NOT EXISTS "stedi_integrations_practiceId_idx"
  ON "stedi_integrations"("practiceId");

DO $$ BEGIN
  ALTER TABLE "stedi_integrations"
    ADD CONSTRAINT "stedi_integrations_practiceId_fkey"
    FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "insurance_policies"
  ADD COLUMN IF NOT EXISTS "clearinghousePayerIds" JSONB;

ALTER TABLE "eligibility_checks"
  ADD COLUMN IF NOT EXISTS "vendorKey" TEXT;

-- Seed eligibility settings from existing Availity rows so behavior stays unchanged
INSERT INTO "practice_eligibility_settings" (
  "id",
  "practiceId",
  "primaryVendorKey",
  "apiEnabled",
  "rpaEnabled",
  "voiceEnabled",
  "defaultProviderNpi",
  "defaultProviderTaxId",
  "defaultServiceType",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  a."practiceId",
  'availity',
  a."eligibilityApiEnabled",
  a."portalRpaEnabled",
  a."eligibilityVoiceEnabled",
  a."defaultProviderNpi",
  a."defaultProviderTaxId",
  COALESCE(NULLIF(a."defaultServiceType", ''), '30'),
  NOW(),
  NOW()
FROM "availity_integrations" a
ON CONFLICT ("practiceId") DO NOTHING;

-- Copy Availity payer IDs into the vendor-keyed map
UPDATE "insurance_policies"
SET "clearinghousePayerIds" = jsonb_build_object('availity', "availityPayerId")
WHERE "availityPayerId" IS NOT NULL
  AND ("clearinghousePayerIds" IS NULL OR "clearinghousePayerIds" = 'null'::jsonb);

UPDATE "eligibility_checks"
SET "vendorKey" = 'availity'
WHERE "vendorKey" IS NULL
  AND "source" IN ('availity_api', 'availity_rpa');
