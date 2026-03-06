-- Add authFlow to separate SMART vs backend connections
ALTER TABLE "ehr_connections"
  ADD COLUMN IF NOT EXISTS "authFlow" TEXT NOT NULL DEFAULT 'smart_launch';

-- Update unique index to include authFlow
DROP INDEX IF EXISTS "ehr_connections_tenantId_providerId_issuer_key";
CREATE UNIQUE INDEX IF NOT EXISTS "ehr_connections_tenantId_providerId_issuer_authFlow_key"
  ON "ehr_connections"("tenantId", "providerId", "issuer", "authFlow");

CREATE INDEX IF NOT EXISTS "ehr_connections_authFlow_idx" ON "ehr_connections"("authFlow");
