-- Eligibility verification method toggles (API / RPA / voice)

ALTER TABLE "availity_integrations"
  ADD COLUMN IF NOT EXISTS "eligibilityApiEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "availity_integrations"
  ADD COLUMN IF NOT EXISTS "eligibilityVoiceEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Preserve existing API on/off behavior (previously gated by isActive)
UPDATE "availity_integrations"
SET "eligibilityApiEnabled" = "isActive";
