-- CreateTable
CREATE TABLE "MarketingLead" (
    "id" TEXT NOT NULL,
    "practiceName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "workEmail" TEXT NOT NULL,
    "practiceWebsite" TEXT,
    "practiceType" TEXT NOT NULL,
    "providerCount" TEXT NOT NULL,
    "automationFocus" TEXT NOT NULL,
    "source" TEXT,
    "referrer" TEXT,
    "userAgent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketingLead_createdAt_idx" ON "MarketingLead"("createdAt");

-- CreateIndex
CREATE INDEX "MarketingLead_workEmail_idx" ON "MarketingLead"("workEmail");

-- CreateIndex
CREATE INDEX "MarketingLead_status_idx" ON "MarketingLead"("status");
