-- CreateTable
CREATE TABLE "nexhealth_connections" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'sandbox',
    "subdomain" TEXT NOT NULL,
    "institutionId" INTEGER,
    "locationId" INTEGER NOT NULL,
    "locationName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastSuccessfulSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncError" TEXT,
    "syncReadStatus" TEXT,
    "syncWriteStatus" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nexhealth_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nexhealth_app_credentials" (
    "id" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "webhookEndpointId" TEXT,
    "webhookSecretEncrypted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nexhealth_app_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nexhealth_connections_practiceId_key" ON "nexhealth_connections"("practiceId");

-- CreateIndex
CREATE INDEX "nexhealth_connections_practiceId_idx" ON "nexhealth_connections"("practiceId");

-- CreateIndex
CREATE INDEX "nexhealth_connections_subdomain_locationId_idx" ON "nexhealth_connections"("subdomain", "locationId");

-- CreateIndex
CREATE INDEX "nexhealth_connections_status_idx" ON "nexhealth_connections"("status");

-- CreateIndex
CREATE UNIQUE INDEX "nexhealth_app_credentials_environment_key" ON "nexhealth_app_credentials"("environment");

-- AddForeignKey
ALTER TABLE "nexhealth_connections" ADD CONSTRAINT "nexhealth_connections_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
