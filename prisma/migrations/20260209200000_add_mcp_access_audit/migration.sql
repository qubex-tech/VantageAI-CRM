-- CreateTable
CREATE TABLE "mcp_access_audit_logs" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "patientId" TEXT,
    "policyId" TEXT,
    "toolName" TEXT NOT NULL,
    "fieldsReturnedJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_access_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mcp_access_audit_logs_requestId_idx" ON "mcp_access_audit_logs"("requestId");
CREATE INDEX "mcp_access_audit_logs_actorId_createdAt_idx" ON "mcp_access_audit_logs"("actorId", "createdAt");
CREATE INDEX "mcp_access_audit_logs_patientId_createdAt_idx" ON "mcp_access_audit_logs"("patientId", "createdAt");
