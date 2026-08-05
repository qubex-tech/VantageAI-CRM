-- Practice-scoped browser-agent playbook configs
CREATE TABLE IF NOT EXISTS "practice_playbooks" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "playbookKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL,
    "sourceVideoUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practice_playbooks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "practice_playbooks_practiceId_playbookKey_key"
  ON "practice_playbooks"("practiceId", "playbookKey");

CREATE INDEX IF NOT EXISTS "practice_playbooks_practiceId_idx" ON "practice_playbooks"("practiceId");
CREATE INDEX IF NOT EXISTS "practice_playbooks_site_idx" ON "practice_playbooks"("site");
CREATE INDEX IF NOT EXISTS "practice_playbooks_playbookKey_idx" ON "practice_playbooks"("playbookKey");

ALTER TABLE "practice_playbooks"
  ADD CONSTRAINT "practice_playbooks_practiceId_fkey"
  FOREIGN KEY ("practiceId") REFERENCES "practices"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed availity.eligibility playbooks for practices with portal RPA enabled
INSERT INTO "practice_playbooks" (
  "id",
  "practiceId",
  "playbookKey",
  "name",
  "site",
  "isActive",
  "config",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  ai."practiceId",
  'availity.eligibility',
  'Availity Eligibility & Benefits',
  'availity',
  true,
  '{
    "version": 1,
    "resultCapture": {
      "networkFilter": "In Network",
      "scrollPasses": 6,
      "expandLabels": [
        "Benefit Information",
        "Expand",
        "Professional (Physician) Visit - Office",
        "Professional (Physician) Visit - Office - 98",
        "Professional (Physician) - 96",
        "Specialist",
        "Office Visit",
        "Medical Care - 1"
      ]
    },
    "payerSelection": {
      "preferShortBrandFirst": true,
      "rejectMedicareUnlessCrmSaysSo": true
    },
    "interpretation": {
      "requireMemberScopedActiveCoverage": true
    }
  }'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "availity_integrations" ai
WHERE ai."portalRpaEnabled" = true
ON CONFLICT ("practiceId", "playbookKey") DO NOTHING;
