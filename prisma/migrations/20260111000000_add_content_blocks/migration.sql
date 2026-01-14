-- CreateTable
CREATE TABLE IF NOT EXISTS "marketing_content_blocks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "blockData" JSONB NOT NULL,
    "blockType" TEXT NOT NULL,
    "category" TEXT,
    "tags" JSONB,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_content_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "marketing_content_blocks_tenantId_idx" ON "marketing_content_blocks"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "marketing_content_blocks_tenantId_category_idx" ON "marketing_content_blocks"("tenantId", "category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "marketing_content_blocks_tenantId_isGlobal_idx" ON "marketing_content_blocks"("tenantId", "isGlobal");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "marketing_content_blocks_createdByUserId_idx" ON "marketing_content_blocks"("createdByUserId");

-- AddForeignKey
ALTER TABLE "marketing_content_blocks" ADD CONSTRAINT "marketing_content_blocks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_content_blocks" ADD CONSTRAINT "marketing_content_blocks_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
