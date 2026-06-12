-- CreateTable
CREATE TABLE "open_dental_connections" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "customerKeyEncrypted" TEXT NOT NULL,
    "apiMode" TEXT NOT NULL DEFAULT 'remote',
    "baseUrl" TEXT NOT NULL DEFAULT 'https://api.opendental.com/api/v1',
    "fallbackBaseUrls" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastHealthCheckAt" TIMESTAMP(3),
    "lastSuccessfulSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncError" TEXT,
    "odVersion" TEXT,
    "enabledPermissions" JSONB,
    "capabilityMetadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "open_dental_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "open_dental_connections_practiceId_key" ON "open_dental_connections"("practiceId");

-- CreateIndex
CREATE INDEX "open_dental_connections_practiceId_idx" ON "open_dental_connections"("practiceId");

-- CreateIndex
CREATE INDEX "open_dental_connections_status_idx" ON "open_dental_connections"("status");

-- AddForeignKey
ALTER TABLE "open_dental_connections" ADD CONSTRAINT "open_dental_connections_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
