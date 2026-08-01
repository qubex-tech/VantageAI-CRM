-- AlterTable
ALTER TABLE "availity_integrations" ADD COLUMN IF NOT EXISTS "portalRpaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "availity_integrations" ADD COLUMN IF NOT EXISTS "portalRpaUseMock" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE IF NOT EXISTS "browser_credentials" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordEnc" TEXT NOT NULL,
    "totpSecretEnc" TEXT,
    "extraEnc" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "browser_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "browser_agent_runs" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "playbookId" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "input" JSONB,
    "output" JSONB,
    "errorMessage" TEXT,
    "sessionId" TEXT,
    "artifactUrls" JSONB,
    "eligibilityCheckId" TEXT,
    "durationMs" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "browser_agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "browser_credentials_practiceId_site_key" ON "browser_credentials"("practiceId", "site");
CREATE INDEX IF NOT EXISTS "browser_credentials_practiceId_idx" ON "browser_credentials"("practiceId");
CREATE INDEX IF NOT EXISTS "browser_credentials_site_idx" ON "browser_credentials"("site");
CREATE INDEX IF NOT EXISTS "browser_agent_runs_practiceId_idx" ON "browser_agent_runs"("practiceId");
CREATE INDEX IF NOT EXISTS "browser_agent_runs_status_idx" ON "browser_agent_runs"("status");
CREATE INDEX IF NOT EXISTS "browser_agent_runs_playbookId_idx" ON "browser_agent_runs"("playbookId");
CREATE INDEX IF NOT EXISTS "browser_agent_runs_eligibilityCheckId_idx" ON "browser_agent_runs"("eligibilityCheckId");
CREATE INDEX IF NOT EXISTS "browser_agent_runs_practiceId_status_idx" ON "browser_agent_runs"("practiceId", "status");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "browser_credentials" ADD CONSTRAINT "browser_credentials_practiceId_fkey"
    FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "browser_agent_runs" ADD CONSTRAINT "browser_agent_runs_practiceId_fkey"
    FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
