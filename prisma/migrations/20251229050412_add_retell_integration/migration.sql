-- CreateTable
CREATE TABLE "retell_integrations" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "agentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retell_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "retell_integrations_practiceId_key" ON "retell_integrations"("practiceId");

-- CreateIndex
CREATE INDEX "retell_integrations_practiceId_idx" ON "retell_integrations"("practiceId");

-- AddForeignKey
ALTER TABLE "retell_integrations" ADD CONSTRAINT "retell_integrations_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
