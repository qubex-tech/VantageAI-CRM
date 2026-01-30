-- CreateTable
CREATE TABLE IF NOT EXISTS "practice_settings" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "smartFhir" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practice_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "smart_fhir_connections" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "fhirBaseUrl" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "accessTokenEnc" TEXT,
    "refreshTokenEnc" TEXT,
    "idTokenEnc" TEXT,
    "tokenType" TEXT,
    "expiresAt" TIMESTAMP(3),
    "patientContext" JSONB,
    "userContext" JSONB,
    "authorizationEndpoint" TEXT,
    "tokenEndpoint" TEXT,
    "revocationEndpoint" TEXT,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "lastConnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "smart_fhir_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "integration_audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "practice_settings_practiceId_key" ON "practice_settings"("practiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "practice_settings_practiceId_idx" ON "practice_settings"("practiceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "smart_fhir_connections_practiceId_issuer_key" ON "smart_fhir_connections"("practiceId", "issuer");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "smart_fhir_connections_practiceId_idx" ON "smart_fhir_connections"("practiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "smart_fhir_connections_status_idx" ON "smart_fhir_connections"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "integration_audit_logs_tenantId_idx" ON "integration_audit_logs"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "integration_audit_logs_tenantId_entity_entityId_idx" ON "integration_audit_logs"("tenantId", "entity", "entityId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "integration_audit_logs_createdAt_idx" ON "integration_audit_logs"("createdAt");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'practice_settings_practiceId_fkey'
    ) THEN
        ALTER TABLE "practice_settings" ADD CONSTRAINT "practice_settings_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'smart_fhir_connections_practiceId_fkey'
    ) THEN
        ALTER TABLE "smart_fhir_connections" ADD CONSTRAINT "smart_fhir_connections_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'integration_audit_logs_tenantId_fkey'
    ) THEN
        ALTER TABLE "integration_audit_logs" ADD CONSTRAINT "integration_audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'integration_audit_logs_actorUserId_fkey'
    ) THEN
        ALTER TABLE "integration_audit_logs" ADD CONSTRAINT "integration_audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
