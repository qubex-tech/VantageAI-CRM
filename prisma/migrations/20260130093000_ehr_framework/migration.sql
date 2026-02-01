-- Add ehrIntegrations settings
ALTER TABLE "practice_settings" ADD COLUMN IF NOT EXISTS "ehrIntegrations" JSONB;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ehr_connections" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'connected',
  "issuer" TEXT NOT NULL,
  "fhirBaseUrl" TEXT NOT NULL,
  "authorizationEndpoint" TEXT,
  "tokenEndpoint" TEXT,
  "revocationEndpoint" TEXT,
  "clientId" TEXT NOT NULL,
  "clientSecretEnc" TEXT,
  "scopesRequested" TEXT,
  "scopesGranted" TEXT,
  "accessTokenEnc" TEXT,
  "refreshTokenEnc" TEXT,
  "expiresAt" TIMESTAMP(3),
  "idTokenClaimsSummary" JSONB,
  "vendorConfig" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ehr_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ehr_facility_maps" (
  "id" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "externalFacilityId" TEXT NOT NULL,
  "name" TEXT,
  "status" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ehr_facility_maps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ehr_connections_tenantId_providerId_issuer_key" ON "ehr_connections"("tenantId", "providerId", "issuer");
CREATE INDEX IF NOT EXISTS "ehr_connections_tenantId_idx" ON "ehr_connections"("tenantId");
CREATE INDEX IF NOT EXISTS "ehr_connections_providerId_idx" ON "ehr_connections"("providerId");
CREATE INDEX IF NOT EXISTS "ehr_connections_status_idx" ON "ehr_connections"("status");

CREATE INDEX IF NOT EXISTS "ehr_facility_maps_connectionId_idx" ON "ehr_facility_maps"("connectionId");
CREATE INDEX IF NOT EXISTS "ehr_facility_maps_externalFacilityId_idx" ON "ehr_facility_maps"("externalFacilityId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ehr_connections_tenantId_fkey'
  ) THEN
    ALTER TABLE "ehr_connections" ADD CONSTRAINT "ehr_connections_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ehr_facility_maps_connectionId_fkey'
  ) THEN
    ALTER TABLE "ehr_facility_maps" ADD CONSTRAINT "ehr_facility_maps_connectionId_fkey"
      FOREIGN KEY ("connectionId") REFERENCES "ehr_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Data migration from smart_fhir_connections to ehr_connections (eCW)
INSERT INTO "ehr_connections" (
  "id",
  "tenantId",
  "providerId",
  "status",
  "issuer",
  "fhirBaseUrl",
  "authorizationEndpoint",
  "tokenEndpoint",
  "revocationEndpoint",
  "clientId",
  "scopesRequested",
  "scopesGranted",
  "accessTokenEnc",
  "refreshTokenEnc",
  "expiresAt",
  "idTokenClaimsSummary",
  "createdAt",
  "updatedAt"
)
SELECT
  "id",
  "practiceId" as "tenantId",
  'ecw' as "providerId",
  CASE
    WHEN "status" = 'revoked' THEN 'disconnected'
    WHEN "status" = 'expired' THEN 'expired'
    ELSE 'connected'
  END as "status",
  "issuer",
  "fhirBaseUrl",
  "authorizationEndpoint",
  "tokenEndpoint",
  "revocationEndpoint",
  "clientId",
  "scopes",
  "scopes",
  "accessTokenEnc",
  "refreshTokenEnc",
  "expiresAt",
  jsonb_build_object(
    'patientContext', "patientContext",
    'userContext', "userContext"
  ),
  "createdAt",
  "updatedAt"
FROM "smart_fhir_connections";

-- Migrate smartFhir settings to ehrIntegrations
UPDATE "practice_settings"
SET "ehrIntegrations" = jsonb_build_object(
  'enabledProviders', CASE
    WHEN ("smartFhir"->>'enabled')::boolean = true THEN jsonb_build_array('ecw')
    ELSE jsonb_build_array()
  END,
  'providerConfigs', jsonb_build_object(
    'ecw', jsonb_build_object(
      'issuer', "smartFhir"->>'issuer',
      'fhirBaseUrl', "smartFhir"->>'fhirBaseUrl',
      'clientId', "smartFhir"->>'clientId'
    )
  ),
  'enableWrite', ("smartFhir"->>'enableWrite')::boolean,
  'enablePatientCreate', ("smartFhir"->>'enablePatientCreate')::boolean,
  'enableNoteCreate', ("smartFhir"->>'enableNoteCreate')::boolean
)
WHERE "smartFhir" IS NOT NULL;

-- Drop old table
DROP TABLE IF EXISTS "smart_fhir_connections";
