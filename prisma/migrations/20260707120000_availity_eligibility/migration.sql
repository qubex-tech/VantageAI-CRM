-- Availity eligibility integration

ALTER TABLE "insurance_policies" ADD COLUMN IF NOT EXISTS "availityPayerId" TEXT;
ALTER TABLE "insurance_policies" ADD COLUMN IF NOT EXISTS "eligibilityStatus" TEXT;
ALTER TABLE "insurance_policies" ADD COLUMN IF NOT EXISTS "lastEligibilityCheckedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "insurance_policies_availityPayerId_idx" ON "insurance_policies"("availityPayerId");

CREATE TABLE IF NOT EXISTS "availity_integrations" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "clientId" TEXT,
    "clientSecretEnc" TEXT,
    "environment" TEXT NOT NULL DEFAULT 'demo',
    "apiBaseUrl" TEXT,
    "defaultProviderNpi" TEXT,
    "defaultProviderTaxId" TEXT,
    "defaultServiceType" TEXT NOT NULL DEFAULT '30',
    "submitterId" TEXT,
    "submitterStateCode" TEXT,
    "useMockResponses" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "availity_integrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "availity_integrations_practiceId_key" ON "availity_integrations"("practiceId");
CREATE INDEX IF NOT EXISTS "availity_integrations_practiceId_idx" ON "availity_integrations"("practiceId");

ALTER TABLE "availity_integrations" DROP CONSTRAINT IF EXISTS "availity_integrations_practiceId_fkey";
ALTER TABLE "availity_integrations" ADD CONSTRAINT "availity_integrations_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "eligibility_checks" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'availity_api',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "availityCoverageId" TEXT,
    "availityStatusCode" TEXT,
    "requestPayload" JSONB,
    "rawResponse" JSONB,
    "parsedSummary" JSONB,
    "errorMessage" TEXT,
    "fallbackCallId" TEXT,
    "fallbackConversationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "eligibility_checks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "eligibility_checks_practiceId_idx" ON "eligibility_checks"("practiceId");
CREATE INDEX IF NOT EXISTS "eligibility_checks_patientId_idx" ON "eligibility_checks"("patientId");
CREATE INDEX IF NOT EXISTS "eligibility_checks_policyId_idx" ON "eligibility_checks"("policyId");
CREATE INDEX IF NOT EXISTS "eligibility_checks_status_idx" ON "eligibility_checks"("status");
CREATE INDEX IF NOT EXISTS "eligibility_checks_practiceId_patientId_idx" ON "eligibility_checks"("practiceId", "patientId");

ALTER TABLE "eligibility_checks" DROP CONSTRAINT IF EXISTS "eligibility_checks_practiceId_fkey";
ALTER TABLE "eligibility_checks" ADD CONSTRAINT "eligibility_checks_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "eligibility_checks" DROP CONSTRAINT IF EXISTS "eligibility_checks_patientId_fkey";
ALTER TABLE "eligibility_checks" ADD CONSTRAINT "eligibility_checks_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "eligibility_checks" DROP CONSTRAINT IF EXISTS "eligibility_checks_policyId_fkey";
ALTER TABLE "eligibility_checks" ADD CONSTRAINT "eligibility_checks_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "insurance_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
